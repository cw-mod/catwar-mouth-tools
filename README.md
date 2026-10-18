# CatWar: mouth tools — сортировка во рту, рецепт, крестики

Userscript for `/cw3` (catwar.su / catwar.net):

1. **Sort mouth items** — game order or by type; the chosen order is always
   re-applied after the game re-sorts (`lastPick`) on every new item.
2. **Pinned «recipe» window** — floating panel (outside `#app`, like
   `#chat_float`), resizable by dragging the bottom-right corner:
   `Alt`+click a mouth item to add/remove that item kind from the recipe;
   the recipe is a row of game-sized icons (one of each kind, no counters) —
   missing kinds are dimmed, present ones get a green outline, and the whole
   panel glows green when the recipe can be assembled from the mouth
   (crossed-out instances don't count).
3. **Stale crosses** — `Ctrl`/`⌘`+click draws a big red SVG cross over that
  **exact item instance** in the mouth (per-item id, not per type) plus a
  light red tint; overlay via `data-cwb-*` + CSS pseudo-element (survives
  Vue re-renders).

Everything is client-side (no socket emits), state in `localStorage`
key `cwb_mouth_tools`. Plain clicks keep the vanilla game item menu.

## Install

https://cw-mod.github.io/catwar-mouth-tools/

## Files

- `mouth-tools.user.js` — the userscript
- `mouth-tools.meta.js` — header only (Tampermonkey update check)
- `index.html` — install page (GitHub Pages, branch `main`, root)

## Notes

- Crosses are per item **instance**: they disappear when the item is
  consumed/dropped (id is gone). Panel button «Снять крестики» clears all.
  Crossed-out instances don't count toward recipe progress.
- Verified against the Oct 19 2026 bundle: mouth state is `vm.item.list`
  (`{id, type, isLocked, expiresAt…}`), server re-sorts by
  `["lastPick","id"]` inside `thing add` only. See
  `agent-context/notes/07-item-mouth-state.md` (workspace docs).
