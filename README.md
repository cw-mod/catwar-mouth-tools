# CatWar: mouth tools — сортировка во рту, рецепт, крестики

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
3. **Stale crosses** — `Ctrl`/`⌘`+click draws a big red SVG cross over **all
  items of that kind** in the mouth (per type) plus a light red tint;
  states are mutually exclusive: a kind is either crossed out, or in the
  recipe, or unmarked. Overlay via `data-cwb-*` + CSS pseudo-element
  (survives Vue re-renders).

Everything is client-side (no socket emits), state in `localStorage`
key `cwb_mouth_tools`. Plain clicks keep the vanilla game item menu.

## Install

https://cw-mod.github.io/catwar-mouth-tools/

## Files

- `mouth-tools.user.js` — the userscript
- `mouth-tools.meta.js` — header only (Tampermonkey update check)
- `index.html` — install page (GitHub Pages, branch `main`, root)

## Notes

- Crosses are per item **type** (`Ctrl`+click any instance → the whole kind
  is crossed). Panel button «Снять крестики» clears all. Crossed kinds
  don't count toward recipe progress and are excluded from recipe sorting.
- Verified against the Oct 19 2026 bundle: mouth state is `vm.item.list`
  (`{id, type, isLocked, expiresAt…}`), server re-sorts by
  `["lastPick","id"]` inside `thing add` only. See
  `agent-context/notes/07-item-mouth-state.md` (workspace docs).
