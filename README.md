# CatWar: mouth tools — сортировка во рту, рецепт, крестики

Userscript for `/cw3` (catwar.su / catwar.net):

1. **Sort mouth items** — by type / freshness (soonest expiry first) / lock state
   / instance id; optional «держать» keeps the chosen order after the game
   re-sorts (`lastPick`) on every new item.
2. **Pinned «recipe» window** — floating collapsible panel (outside `#app`,
   like `#chat_float`): `Alt`+click a mouth item to add/remove it from the
   recipe; shows thumbnails, `have / need` counts (crossed-out items don't
   count), turns green when collected; items matching the recipe get a green
   outline in the mouth.
3. **Stale crosses** — `Ctrl`/`⌘`+click marks a whole item type as irrelevant:
   red ✖ overlay via `data-cwb-*` + CSS pseudo-element (survives Vue
   re-renders).

Everything is client-side (no socket emits), state in `localStorage`
key `cwb_mouth_tools`. Plain clicks keep the vanilla game item menu.

## Install

https://cw-mod.github.io/catwar-mouth-tools/

## Files

- `mouth-tools.user.js` — the userscript
- `mouth-tools.meta.js` — header only (Tampermonkey update check)
- `index.html` — install page (GitHub Pages, branch `main`, root)

## Notes

- Marks are per item **type** (persist after consumption; e.g. old ropes of
  that kind stay crossed). Panel button «Снять крестики» clears all.
- Verified against the Oct 19 2026 bundle: mouth state is `vm.item.list`
  (`{id, type, isLocked, expiresAt…}`), server re-sorts by
  `["lastPick","id"]` inside `thing add` only. See
  `agent-context/notes/07-item-mouth-state.md` (workspace docs).
