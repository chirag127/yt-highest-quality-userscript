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
## 📚 Documentation lives in ONE place (mandatory)

All documentation for every repository in this workspace is **single-sourced** in the
umbrella repository:

```
c:\ws\docs\okf├── bundle.md            collection overview
├── index.md             catalogue of every concept and script note
├── concepts/            shared knowledge (architecture, testing, metadata, …)
└── scripts/             one note per userscript repository
```

### Rules

1. **Never create an `okf/` folder in this repository.** It is not duplicated here, by
   design. There was once a copy in every repo: 278 files describing 42 unique documents,
   with `concepts/architecture.md` physically present 32 times. Every edit had to be
   propagated to 30 repositories and drift was unavoidable.
2. **Never hand-edit a copy.** There are no copies. Edit the canonical file under
   `c:\ws\docs\okf\`.
3. **This repository's note is** `c:\ws\docs\okf\scripts\<repo-name>.md`. If it does not
   exist, add it before adding the script.
4. **Link, do not paste.** In `README.md`, link to the canonical note with a relative path
   from the workspace, e.g. `[documentation](../../../../../docs/okf/scripts/<repo-name>.md)`.
5. **Verify** with `node c:\ws\scripts\check-okf.mjs` — it exits `0` only when nothing is
   duplicated and every repository is linked and documented.
6. When adding a new script: create the repo, add `docs/okf/scripts/<repo-name>.md`, add it
   to the tables in `docs/okf/bundle.md` and `docs/okf/index.md`, then run the checker.

Full detail: `c:\ws\docs\okf\concepts\okf-requirement.md`.
