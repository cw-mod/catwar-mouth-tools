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
3. **«Attic» (чердак)** — `Shift`+click moves an item kind to a separate
   **collapsible block at the top of the mouth** (dimmed, greyed out) to keep
   unneeded items out of the way; click the «Чердак ×N» strip above the mouth
   to fold/unfold it; `Shift`+click again moves the kind back. Panel button
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
  kind goes to the attic block). Panel button «Разобрать чердак» clears all.
  Reordering is done via reactive `splice` — and it must be called as
  `list.splice(...)`, **not** `Array.prototype.splice.apply(list, ...)`:
  the latter bypasses Vue 2's patched array methods, so Vue never re-renders
  and the sort visibly lags by seconds (the «recipe sort is slow» bug,
  fixed in v1.8.0).
- The game's «Выбрать всё» button (`#item_multi`, `item.selectAll`) is patched
  to select only non-attic items — attic kinds are never bulk-selected
  (v1.8.1). Changing the recipe (Alt+click) now re-applies «by recipe» sort
  immediately (v1.8.1).
- Verified against the Oct 19 2026 bundle: mouth state is `vm.item.list`
  (`{id, type, isLocked, expiresAt…}`), server re-sorts by
  `["lastPick","id"]` inside `thing add` only. See
  `agent-context/notes/07-item-mouth-state.md` (workspace docs).
