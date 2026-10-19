# CatWar: mouth tools — сортировка во рту, рецепт, чердак

Userscript for `/cw3` (catwar.su / catwar.net):

1. **Sort mouth items** — game order, by type, or **by recipe** (recipe items
   first, in recipe order — e.g. recipe `a+b+c`, mouth `baabv` → `abcab`... i.e.
   first found instance of each recipe kind in recipe order, then the rest);
   the chosen order is always re-applied after the game re-sorts
   (`lastPick`) on every new item.
2. **Pinned «recipe» window** — floating panel (outside `#app`, like
   `#chat_float`), resizable by dragging the bottom-right corner:
   `Alt`+click a mouth item to add/remove that item kind from the recipe;
   the recipe is a row of game-sized icons (one of each kind, no counters) —
   missing kinds are dimmed, present ones get a green outline, and the whole
   panel glows green when the recipe can be assembled from the mouth.
3. **«Attic» (чердак)** — `Shift`+click moves an item kind to a **separate
  row** of the mouth (dimmed, greyed out, always last) to keep unneeded
  items out of the way; `Shift`+click again moves it back. Panel button
  «Разобрать чердак» returns everything at once.

Everything is client-side (no socket emits), state in `localStorage`
key `cwb_mouth_tools`. Plain clicks keep the vanilla game item menu.

## Install

https://cw-mod.github.io/catwar-mouth-tools/

## Files

- `mouth-tools.user.js` — the userscript
- `mouth-tools.meta.js` — header only (Tampermonkey update check)
- `index.html` — install page (GitHub Pages, branch `main`, root)

## Notes

- Attic marks are per item **type** (`Shift`+click any instance → the whole
  kind goes to the attic row). Panel button «Разобрать чердак» clears all.
  Reordering is done via reactive `splice` (Vue 2 doesn't see direct index
  assignment — that was the «sort sometimes doesn't re-apply» bug, fixed in
  v1.7.0).
- Verified against the Oct 19 2026 bundle: mouth state is `vm.item.list`
  (`{id, type, isLocked, expiresAt…}`), server re-sorts by
  `["lastPick","id"]` inside `thing add` only. See
  `agent-context/notes/07-item-mouth-state.md` (workspace docs).
