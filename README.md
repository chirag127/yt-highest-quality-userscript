# ⤒ YouTube Highest Quality

Always play YouTube at the highest quality the video and your connection actually allow — no menu clicking, and it stays set for every following video.

## Install
First read the shared **[userscript install guide](https://github.com/chirag127/userscript-install-guide)** (how to set up ScriptCat/Tampermonkey). Then click:
**[Install yt-highest-quality.user.js](https://github.com/chirag127/yt-highest-quality-userscript/raw/main/yt-highest-quality.user.js)**

## Use
It works on its own. Navigate to any video and it pins playback to the best available resolution.

A small **⤒** button appears in the player's control bar. Click it once to also set the **account-wide preference**, so newly started videos begin at max quality without the script having to intervene each time. Hover it afterwards to see what it did (`already`, `set:1080p`, …).

## What it does not do
- It never forces a resolution your connection cannot sustain. The target is always the **highest the current video offers**, taken from the player's own available-quality list.
- It does not fight a deliberate choice: if you manually pick a lower quality, the script waits briefly and re-pins only when YouTube itself has dropped the level.
- `Auto` is respected. Auto already picks the best your bandwidth carries; overriding it would buffer-lock a slow connection.

## Why not just `setPlaybackQuality()`?
Because it does not work. `setPlaybackQuality()` is current-video scoped and the adaptive algorithm usually wins anyway. This script uses the two mechanisms that do work:

| API | Scope | Used for |
|-----|-------|----------|
| `setPlaybackQualityRange(best, best)` | current video | pin the video already playing |
| `getUserPlaybackQualityPreference()` (via the real settings menu) | account | make all future videos start at max |

Recent YouTube builds expose no public setter for the preference, so the settings menu is driven the way a user would. If any expected element is missing the attempt is abandoned rather than guessing.

## License
[MIT](LICENSE) © 2026 chirag127
<!-- okf-bundle -->
## 🧠 Knowledge bundle (OKF)

This repository ships its documentation as an
**Open Knowledge Format** bundle in `okf/` —
written so both a human and an AI agent can understand the script without reading the code.

| File | Contents |
|------|----------|
| `okf/bundle.md` | Overview of the collection |
| `okf/index.md` | Catalogue of concepts |
| `okf/concepts/` | Shared knowledge (architecture, metadata, testing, DOM notes) |
| `okf/scripts/` | This script's own note (where applicable) |

Regenerate every repository's copy from the canonical bundle with `node okf/sync-okf.mjs`.
