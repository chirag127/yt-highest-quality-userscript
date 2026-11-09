# AGENTS.md — yt-highest-quality-userscript

Single-file userscript. `yt-highest-quality.user.js` at repo root IS the product. No build, no deps, `@grant none`.

## 🥇 Prime directive — always use the best method

Always use **the best available method** for every task. This outranks convenience, familiarity, and the fact that something already works.

**If existing code is not using the best method, or is not the best code it can be, change it.** Do not preserve a worse approach to keep a diff small. A small diff is a virtue only while the result is correct.

Rank by: **correct → robust → simple → fast**, in that order. On a tie, pick fewer moving parts and fewer future breakages.

## Method (best method — do not revert to polling menus)

Quality on YouTube has three APIs and only two of them work:

| API | Scope | Use |
|-----|-------|-----|
| `setPlaybackQuality(lvl)` | current video | **do not use** — adaptive algorithm overrides it |
| `setPlaybackQualityRange(a, b)` | current video | pin the current video |
| `getUserPlaybackQualityPreference()` | account, persisted | read state; set by driving the real settings menu |

The account preference has **no public setter** in current builds. Driving the settings
menu (`Quality ▸ <highest>`) is therefore the best available method for persistence —
not a hack to be replaced with a guessed internal call.

## Rules

- One file, zero deps, `@grant none`. Bump `@version`; keep `@updateURL`/`@downloadURL` on raw `main`.
- Discover the player with a **`MutationObserver`**, never `setInterval`. The player is replaced
  by SPA navigation; only an observer reacts to the actual swap.
- Guard re-attachment with a `WeakSet`. YouTube re-fires events on the same element during
  navigation; without the guard, listeners stack until the page crawls.
- Never act on `onStateChange` codes other than `1` (playing). Earlier codes fire before the
  final manifest exists, so the available-quality list is wrong at that moment.
- Never target `auto` as a resolution. `auto` is a mode; it is fine to leave as the preference.

### Learned the hard way

- Applying quality on a timer produces **visible thrashing** and can trip rate heuristics.
  React to events and skip the write when the current level already equals the best.
- `getAvailableQualityLevels()` includes `"auto"`. Ranking it against real resolutions
  silently selects it.
- A manual downgrade and an adaptive drop look identical from `onPlaybackQualityChange`
  alone; a short grace period before re-pinning is the pragmatic discriminator.

## Install docs
Shared guide: https://github.com/chirag127/userscript-install-guide — link it, never duplicate install steps.

## Test
`sctl install <raw url>`, open a video, confirm the ⤒ button appears and playback sits at the
highest level `getAvailableQualityLevels()` reports. Then click ⤒ and confirm
`getUserPlaybackQualityPreference()` changes.
<!-- okf-requirement -->
## 🧠 OKF documentation requirement (mandatory)

**Every repository in this collection MUST ship an Open Knowledge Format (OKF) bundle in `okf/`.**

A repository without `okf/` is **incomplete**, even if the script works.

### What must exist

```
okf/
├── bundle.md      overview of the collection
├── index.md       catalogue of concepts
├── concepts/      all shared concept notes
└── scripts/       THIS repository's own script note (where one applies)
```

### Rules

1. **Never hand-edit** a repository's `okf/` copy. The canonical bundle is
   `repos/own/public/userscripts/okf/` in the `c:\ws` monorepo.
2. After changing the canonical bundle, regenerate every copy:
   `node okf/sync-okf.mjs`
3. Verify nothing has drifted: `node okf/sync-okf.mjs --check` — must exit `0`.
4. `README.md` must link to `okf/`. `AGENTS.md` (this file) must restate this requirement.
5. When adding a new script, add its note at `okf/scripts/<repo-name>.md` in the canonical
   bundle first, then sync.

Full detail: [`okf/concepts/okf-requirement.md`](okf/concepts/okf-requirement.md)
