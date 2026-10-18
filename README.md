# CatWar: mouth tools — сортировка во рту, рецепт, крестики

Userscript for `/cw3` (catwar.su / catwar.net):

1. **Sort mouth items** — game order or by type; optional «держать» keeps the
   chosen order after the game re-sorts (`lastPick`) on every new item.
2. **Pinned «recipe» window** — floating panel (outside `#app`, like
   `#chat_float`), resizable by dragging the bottom-right corner:
   `Alt`+click a mouth item to add/remove it from the recipe; recipe is a
   row of game-sized icons with a `have/need` badge on each (crossed-out
   items don't count), turns green when collected; items matching the
   recipe get a green outline in the mouth.
3. **Stale crosses** — `Ctrl`/`⌘`+click draws a red ✖ on that **exact item
  instance** in the mouth (per-item id, not per type); overlay via
  `data-cwb-*` + CSS pseudo-element (survives Vue re-renders).

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
