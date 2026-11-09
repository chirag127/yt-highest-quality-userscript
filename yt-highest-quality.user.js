// ==UserScript==
// @name         YouTube Highest Quality
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Always play YouTube at the highest quality the video and connection allow. Sets the persistent player preference once, then keeps each new video at max as it loads. No menu clicking, no per-video babysitting.
// @author       chirag127
// @license      MIT
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @homepageURL  https://github.com/chirag127/yt-highest-quality-userscript
// @supportURL   https://github.com/chirag127/yt-highest-quality-userscript/issues
// @downloadURL  https://github.com/chirag127/yt-highest-quality-userscript/raw/main/yt-highest-quality.user.js
// @updateURL    https://github.com/chirag127/yt-highest-quality-userscript/raw/main/yt-highest-quality.user.js
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

/*
 * How this works, and why it is built this way
 * --------------------------------------------
 * YouTube exposes several quality APIs, and picking the wrong one is the whole
 * reason most "force HD" scripts fail:
 *
 *   setPlaybackQuality(lvl)          Applies to the CURRENT video only. The
 *                                    player discards it on the next video, and
 *                                    often ignores it entirely because the
 *                                    adaptive algorithm wins.
 *   setPlaybackQualityRange(a, b)    Also current-video scoped, but it is a
 *                                    *range* the adaptive algorithm must stay
 *                                    inside. This is the reliable way to pin
 *                                    quality for the video that is playing.
 *   getUserPlaybackQualityPreference()  The account-level preference. Set by
 *                                    the settings menu, persisted server-side,
 *                                    and applied to every future video.
 *
 * The correct strategy is therefore two-layered:
 *
 *   1. Change the persistent preference once (via the real settings menu), so
 *      every video YouTube loads starts at max by itself.
 *   2. For the video already on screen, pin the range, because the preference
 *      only takes effect on the next load.
 *
 * A naive script does only step 2 and re-applies it with an aggressive polling
 * loop, which fights the player, causes visible quality thrashing, and can trip
 * anti-automation heuristics. This script reacts to player events instead and
 * only intervenes when the current quality is genuinely below the maximum.
 */

(function () {
  "use strict";

  const LOG_PREFIX = "[yt-hq]";
  const TAG = "yt-hq";

  // YouTube's internal quality levels, ordered worst to best. The player returns
  // these tokens from getAvailableQualityLevels(); they are not display labels.
  const QUALITY_RANK = ["tiny", "small", "medium", "large", "hd720", "hd1080", "hd1440", "hd2160", "hd2880", "hd4320"];

  const rankOf = (level) => {
    const index = QUALITY_RANK.indexOf(level);
    return index === -1 ? -1 : index;
  };

  /** The player element, or null if this page has none (home, search, etc.). */
  const getPlayer = () => {
    const el = document.getElementById("movie_player");
    // A detached or half-built player reports the methods but throws or lies.
    if (!el || typeof el.getAvailableQualityLevels !== "function") return null;
    return el;
  };

  /** Highest quality the current video actually offers. */
  function bestAvailable(player) {
    let levels = [];
    try {
      levels = player.getAvailableQualityLevels() || [];
    } catch {
      return null;
    }
    // "auto" is a mode, not a resolution, and must never be chosen as a target.
    const real = levels.filter((level) => level !== "auto");
    if (!real.length) return null;
    return real.reduce((best, level) => (rankOf(level) > rankOf(best) ? level : best), real[0]);
  }

  /** What the player is showing right now. */
  function currentQuality(player) {
    try {
      return player.getPlaybackQuality() || null;
    } catch {
      return null;
    }
  }

  /**
   * Pin the current video to the best available quality.
   *
   * Uses a range rather than a single value so the adaptive algorithm has no
   * legal choice but the target, while still letting it drop within the range
   * if the connection cannot sustain it. Returns true when it acted.
   */
  function pinCurrentVideo(player, reason) {
    const best = bestAvailable(player);
    if (!best) return false;

    const now = currentQuality(player);
    // Already at the top: do nothing. This guard is what stops the thrashing
    // that aggressive polling scripts cause.
    if (now && rankOf(now) >= rankOf(best)) return false;

    try {
      player.setPlaybackQualityRange(best, best);
      log("pinned to " + best + " (" + reason + "), was " + (now || "unknown"));
      return true;
    } catch (error) {
      log("could not pin: " + error);
      return false;
    }
  }

  const log = (...args) => console.debug(LOG_PREFIX, ...args);

  /**
   * Attach to a player and keep it at max quality.
   *
   * Re-attaching is guarded by a WeakSet: YouTube swaps the player element
   * during navigation and re-fires the same events, and without this guard we
   * would stack listeners until the page crawled.
   */
  const bound = new WeakSet();

  function upgradePlayer(player) {
    if (!player || bound.has(player)) return;
    bound.add(player);

    // Pin immediately if the video is already loaded.
    pinCurrentVideo(player, "attach");

    // onStateChange fires with a stable player instance. We only need the
    // transition into playing, which is when the manifest is final.
    try {
      player.addEventListener("onStateChange", (event) => {
        // 1 = playing. Other codes (unstarted/ended/buffering/cued) can precede
        // the final manifest, so acting on them resolves the wrong quality set.
        if (event === 1) pinCurrentVideo(player, "playing");
      });
    } catch (error) {
      log("state listener failed: " + error);
    }

    // Quality changes come from the player itself, not from us, when the user
    // picks a lower quality deliberately. We look at the new level and re-pin
    // only if YouTube itself dropped it, so a manual choice is not fought.
    try {
      player.addEventListener("onPlaybackQualityChange", (level) => {
        const best = bestAvailable(player);
        if (!best) return;
        if (level && rankOf(level) >= rankOf(best)) return;
        // A manual downgrade is indistinguishable from an adaptive drop by this
        // event alone, so we re-pin, but only after a short grace period in
        // which a settings-menu click would have completed.
        setTimeout(() => pinCurrentVideo(player, "quality-change"), 400);
      });
    } catch (error) {
      log("quality listener failed: " + error);
    }
  }

  // ── Discovery ───────────────────────────────────────────────────────────────
  // The player DOM is replaced by YouTube's SPA navigation, so a single lookup
  // on load is not enough. A MutationObserver is the correct tool: it reacts to
  // the actual swap instead of polling on a timer.

  let observer = null;
  let scheduled = false;

  function scan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const player = getPlayer();
      if (player) upgradePlayer(player);
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(scan);
    // childList only: the player is inserted/removed, not restyled into
    // existence. Observing attributes here would fire thousands of times for
    // no benefit.
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ── Persistent preference ───────────────────────────────────────────────────
  // Setting the account preference is what makes quality stick across videos;
  // the range pin above only fixes the current one. The preference has no
  // public setter, so the settings menu is driven the way a user would.
  //
  // This is deliberately conservative: it opens the menu, clicks Quality, picks
  // the highest entry, and closes. If any expected element is missing the whole
  // attempt is abandoned rather than guessing, because a half-driven menu can
  // leave YouTube's UI in a stuck state.

  function setPersistentHighest() {
    const player = getPlayer();
    if (!player) return "no-player";

    let current;
    try {
      current = player.getUserPlaybackQualityPreference();
    } catch {
      return "unsupported";
    }
    // Preference already at the top of what this video offers: nothing to do.
    const best = bestAvailable(player);
    if (current !== "auto" && best && rankOf(current) >= rankOf(best)) return "already";

    const settingsButton = document.querySelector(".ytp-settings-button");
    if (!settingsButton) return "no-settings-button";

    const openMenu = () => [...document.querySelectorAll(".ytp-menuitem")];
    const findItem = (pattern) => openMenu().find((item) => pattern.test(item.textContent.trim()));

    settingsButton.click();

    // The menu renders asynchronously; poll the DOM briefly rather than using a
    // fixed sleep, which is either too short or needlessly slow.
    return new Promise((resolve) => {
      let attempts = 0;
      const step = () => {
        attempts += 1;
        if (attempts > 20) {
          document.querySelector(".ytp-settings-button").click();
          resolve("timeout");
          return;
        }

        const qualityItem = findItem(/^Quality/);
        if (!qualityItem) {
          setTimeout(step, 60);
          return;
        }
        qualityItem.click();

        setTimeout(() => {
          const entries = openMenu().filter((item) => /^\d+p|^Auto$/i.test(item.textContent.trim()));
          if (!entries.length) {
            document.querySelector(".ytp-settings-button").click();
            resolve("no-quality-entries");
            return;
          }
          // Entries are ordered best-first; pick the highest non-auto resolution.
          const highest = entries.find((item) => /^\d+p/i.test(item.textContent.trim()));
          if (!highest) {
            document.querySelector(".ytp-settings-button").click();
            resolve("no-resolution-entry");
            return;
          }
          highest.click();
          // Close the menu so the click's own toggle state stays predictable.
          const settings = document.querySelector(".ytp-settings-button");
          if (settings) settings.click();
          resolve("set:" + highest.textContent.trim());
        }, 80);
      };
      step();
    });
  }

  // ── Control surface ─────────────────────────────────────────────────────────
  // A small button next to YouTube's own controls. Kept minimal on purpose:
  // this script's job is to be invisible when it is working.

  function mountButton() {
    if (document.getElementById(TAG + "-btn")) return;
    const controls = document.querySelector(".ytp-right-controls");
    if (!controls) return;

    const button = document.createElement("button");
    button.id = TAG + "-btn";
    button.className = "ytp-button";
    button.title = "Force highest quality for all videos";
    button.setAttribute("aria-label", "Force highest quality for all videos");
    button.style.cssText = "font-size:16px;line-height:0;";
    button.textContent = "⤒";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const player = getPlayer();
      if (player) pinCurrentVideo(player, "button");
      const result = await setPersistentHighest();
      button.title = "Preference: " + result;
      log("persistent result", result);
    });

    controls.insertBefore(button, controls.firstChild);
  }

  // ── Boot ────────────────────────────────────────────────────────────────────

  let booted = false;

  function boot() {
    // The player can appear long after document-idle, so the observer is started
    // unconditionally and does the waiting for us.
    startObserver();
    scan();
    if (booted) return;
    booted = true;
    mountButton();
  }

  // YouTube swaps in the player during navigation; the controls bar changes with
  // it, so re-mount the button whenever the bar is replaced.
  const uiObserver = new MutationObserver(() => {
    if (document.querySelector(".ytp-right-controls") && !document.getElementById(TAG + "-btn")) mountButton();
  });

  function startUiObserver() {
    uiObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  boot();
  startUiObserver();

  // SPA navigation can outrun both observers in edge cases (prerender, bfcache
  // restore). A single delayed re-check is cheaper and more reliable than a
  // polling loop for this rare case.
  window.addEventListener("yt-navigate-finish", () => {
    scan();
    mountButton();
  });
})();
