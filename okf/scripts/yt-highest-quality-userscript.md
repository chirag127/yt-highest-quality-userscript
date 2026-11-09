---
type: Script
title: YouTube Highest Quality
description: Keeps YouTube playback at the highest resolution the video and connection allow, using the quality range pin for the current video and the persisted account preference for everything after it.
repo: https://github.com/chirag127/yt-highest-quality-userscript
install: https://github.com/chirag127/yt-highest-quality-userscript/raw/main/yt-highest-quality.user.js
version: "1.0.0"
tags: [userscript, youtube, video-quality, player-api]
timestamp: 2026-11-08T00:00:00Z
---

# YouTube Highest Quality

Most "force HD" scripts call `setPlaybackQuality()` on a timer and appear to work in
testing while actually fighting the player. This one uses the two mechanisms that hold.

## The three quality APIs, and which ones work

| API | Scope | Verdict |
|-----|-------|---------|
| `setPlaybackQuality(level)` | current video | **Unreliable.** The adaptive algorithm usually wins, and the value is discarded on the next video. |
| `setPlaybackQualityRange(min, max)` | current video | **Works.** Pinning `min === max` leaves the algorithm no legal choice. |
| `getUserPlaybackQualityPreference()` | account, persisted | **Works, read-only.** No public setter exists in current builds. |

Because the preference has no setter, persistence requires driving the real settings menu
(`Quality ▸ highest`). That is the best available method, not a shortcut — guessing at an
unexposed internal setter would break on the next player build.

## Structure

1. **Discovery** — a `MutationObserver` on `documentElement`. The player element is replaced
   by SPA navigation, so a one-shot lookup on load misses every subsequent video. A
   `WeakSet` guards re-attachment, because YouTube re-fires events on the same element and
   unguarded listeners stack until the page crawls.
2. **Per-video pin** — on `onStateChange === 1` (playing). Earlier state codes fire before
   the final manifest exists, so `getAvailableQualityLevels()` is wrong at that moment.
3. **Persistence** — on demand, via the ⤒ control-bar button.

## Traps worth remembering

- `getAvailableQualityLevels()` returns `"auto"` alongside real resolutions. Ranking it
  naively selects a mode instead of a resolution.
- A manual downgrade and an adaptive drop are indistinguishable from
  `onPlaybackQualityChange` alone. A short grace period before re-pinning is the pragmatic
  discriminator.
- Writing quality on a polling timer causes visible thrashing and can trip rate heuristics.
  Skip the write when the current level already equals the best.

## Verification performed

- Forced the player down to 360p via `setPlaybackQualityRange("small","small")`; the script
  restored 1080p unaided.
- Confirmed the ⤒ button reports `already` when the preference is at max, and that
  `getUserPlaybackQualityPreference()` persists `hd2160` → `hd1080` across reloads.
