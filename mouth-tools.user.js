// ==UserScript==
// @name         CatWar: предметы во рту — сортировка, рецепт, крестики
// @namespace    catwar-mouth-tools
// @version      1.3.1
// @description  Сортировка предметов во рту, закреплённое плавающее окно с «рецептом» из нескольких предметов и красный крестик на предметах, отмеченных как неактуальные.
// @author       local
// @match        https://catwar.su/cw3
// @match        https://catwar.su/cw3/
// @match        https://catwar.su/cw3?*
// @match        https://catwar.su/cw3/*
// @match        https://catwar.net/cw3
// @match        https://catwar.net/cw3/
// @match        https://catwar.net/cw3?*
// @match        https://catwar.net/cw3/*
// @updateURL    https://cw-mod.github.io/catwar-mouth-tools/mouth-tools.meta.js
// @downloadURL  https://cw-mod.github.io/catwar-mouth-tools/mouth-tools.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

/* eslint-disable no-var */
(function () {
  'use strict';

  var LS_KEY = 'cwb_mouth_tools'; // единый JSON: позиция, рецепт, крестики, сортировка
  var PREFIX = 'data-cwb-';      // наши атрибуты на чужих (Vue) элементах — переживают ре-рендер

  // --------------------------------------------------------------- state

  var st = load();
  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(LS_KEY)) || {};
      return {
        pos: typeof parsed.pos === 'object' && parsed.pos ? parsed.pos : null,
        size: parsed.size && typeof parsed.size.w === 'number' ? parsed.size : null,
        collapsed: !!parsed.collapsed,
        sortMode: parsed.sortMode || 'game',   // game | type | fresh | lock | id
        holdOrder: parsed.holdOrder !== false, // сохранять порядок при новых предметах
        recipe: Array.isArray(parsed.recipe) ? parsed.recipe : [], // [{type, cnt}]
        staleIds: parsed.staleIds || {}        // {itemId: true} — крестик на конкретном экземпляре
      };
    } catch (e) {
      return { pos: null, size: null, collapsed: false, sortMode: 'game', holdOrder: true, recipe: [], staleIds: {} };
    }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  // --------------------------------------------------------------- styles

  css([
    // крестик и рамки на предметах во рту; только data-* + CSS,
    // классы/стили .itemInMouth Vue перезаписывает (см. pitfalls).
    // крестик — чистым CSS (градиенты), без шрифтовых символов:
    // две перекрещённые полосы + лёгкая красная заливка, видно всегда
    '#itemList .itemInMouth { position: relative; }',
    '#itemList .itemInMouth[data-cwb-stale] { background: rgba(224, 34, 77, .18); border-radius: 4px; }',
    '#itemList .itemInMouth[data-cwb-stale]::after {',
    '  content: "";',
    '  position: absolute; left: 0; top: 0; right: 0; bottom: 0;',
    '  background:',
    '    linear-gradient(to top right, transparent 46.5%, #e0224d 46.5%, #e0224d 53.5%, transparent 53.5%),',
    '    linear-gradient(to bottom right, transparent 46.5%, #e0224d 46.5%, #e0224d 53.5%, transparent 53.5%);',
    '  opacity: .9; pointer-events: none; z-index: 2;',
    '}',
    '#itemList .itemInMouth[data-cwb-recipe] { outline: 2px solid #2f9e51; outline-offset: -1px; border-radius: 4px; }',

    // панель «рецепт» (жёстко вне #app, как #chat_float / #fightPanel)
    '#cwb-mt-root {',
    '  position: fixed; z-index: 100000; width: 300px;',
    '  display: flex; flex-direction: column;',
    '  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;',
    '  background: rgba(25, 25, 28, .92); color: #f2f2f2;',
    '  border: 1px solid rgba(255,255,255,.25); border-radius: 10px;',
    '  box-shadow: 0 8px 24px rgba(0,0,0,.35); box-sizing: border-box; user-select: none;',
    '  overflow: hidden; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);',
    '}',
    '#cwb-mt-root.complete { border-color: #2f9e51; box-shadow: 0 8px 24px rgba(47,158,81,.35); }',
    '#cwb-mt-root.hidden { display: none; }',
    '#cwb-mt-root.collapsed .cwb-mt-body { display: none; }',
    '#cwb-mt-root.collapsed { width: auto !important; height: auto !important; min-width: 170px; }',
    '.cwb-mt-head { display: flex; align-items: center; gap: 8px; padding: 5px 8px;',
    '  cursor: move; touch-action: none; background: rgba(255,255,255,.08);',
    '  border-radius: 10px 10px 0 0; font-weight: 600; }',
    '.cwb-mt-title { flex: none; }',
    '.cwb-mt-status { margin-left: auto; color: #66d68a; font-weight: 600; font-size: 11px; }',
    '#cwb-mt-root:not(.complete) .cwb-mt-status { color: transparent; }',
    '.cwb-mt-actions { display: flex; gap: 2px; }',
    '.cwb-mt-head .cwb-mt-btn { border: 0; background: rgba(255,255,255,.12); color: inherit; }',
    '.cwb-mt-head .cwb-mt-btn:hover { background: rgba(255,255,255,.25); }',
    '.cwb-mt-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; overflow-y: auto; }',
    '.cwb-mt-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
    '.cwb-mt-hint { font-size: 10px; opacity: .6; }',
    '.cwb-mt-lbl { opacity: .75; }',
    '.cwb-mt-hold { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }',
    '.cwb-mt-sort, .cwb-mt-btn { font: inherit; border-radius: 6px; }',
    '.cwb-mt-sort { background: rgba(255,255,255,.12); color: inherit; border: 1px solid rgba(255,255,255,.25); padding: 2px 6px; }',
    '.cwb-mt-btn { cursor: pointer; border: 0; background: rgba(255,255,255,.12); color: inherit; padding: 3px 8px; }',
    '.cwb-mt-btn:hover { background: rgba(255,255,255,.25); }',
    '.cwb-mt-btnrow button { flex: 1 1 auto; }',
    '.cwb-mt-recipe { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }',
    '.cwb-mt-resize { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;',
    '  cursor: nwse-resize; touch-action: none; z-index: 3; opacity: .55;',
    '  background: repeating-linear-gradient(135deg, transparent 0 3px, currentColor 3px 4px, transparent 4px 8px);',
    '  background-size: 10px 10px; background-position: 3px 3px; }',
    '.cwb-mt-resize:hover { opacity: 1; }',
    '.cwb-mt-empty { opacity: .65; padding: 4px 2px; }',
    '.cwb-mt-item { position: relative; cursor: pointer; line-height: 0; border-radius: 6px; }',
    '.cwb-mt-item img { display: block; }', // натуральный размер, как в игре (#itemList img без width)
    '.cwb-mt-item:hover img { outline: 2px solid rgba(255,255,255,.6); outline-offset: -1px; }',
    '.cwb-mt-badge { position: absolute; right: 1px; bottom: 1px; padding: 1px 4px;',
    '  border-radius: 7px; font: 700 10px/1.3 sans-serif; color: #fff; line-height: 1.3;',
    '  background: rgba(194,49,79,.9); }',
    '.cwb-mt-item.ok .cwb-mt-badge { background: rgba(47,158,81,.92); }'
  ].join('\n'));

  function css(rule) {
    var style = document.createElement('style');
    style.textContent = rule;
    (document.head || document.documentElement).appendChild(style);
  }

  // --------------------------------------------------------------- boot

  function waitVue(attempt) {
    var app = document.querySelector('#app');
    if (app && app.__vue__ && app.__vue__.item && document.getElementById('itemList')) {
      init(app.__vue__);
      return;
    }
    if (attempt > 240) return; // ~60 c, дальше не ждём
    setTimeout(function () { waitVue(attempt + 1); }, 250);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitVue(0); });
  } else {
    waitVue(0);
  }

  // --------------------------------------------------------------- helpers

  var vm = null;
  function itemType(item) {
    if (item == null) return null;
    var t = item.type;
    if (t == null) t = item.to;
    if (t == null) return null;
    return String(t);
  }
  function mouthItemUrl(type) {
    // предметные картинки: things/<type>.png относительно /cw3/
    var el = document.querySelector('#itemList .itemInMouth img');
    if (el && el.src) return el.src.replace(/[^/]+\.png.*$/, type + '.png');
    var base = location.origin + location.pathname.replace(/\/?$/, '/'); // /cw3 → /cw3/
    try { return new URL('things/' + type + '.png', base).href; } catch (e) { return ''; }
  }

  // --------------------------------------------------------------- sorting

  var CMP = {
    type: function (a, b) { return (cmpInt(itemType(a)) - cmpInt(itemType(b))) || (a.id - b.id); }
  };
  function cmpInt(v) { var n = parseInt(v, 10); return isNaN(n) ? Number.MAX_SAFE_INTEGER : n; }

  var busy = false;
  function applySort() {
    var cmp = CMP[st.sortMode];
    if (!cmp || busy) return;
    busy = true;
    try { vm.item.list.sort(cmp); } catch (e) { /* ignore */ }
    requestAnimationFrame(function () { busy = false; mark(); });
  }

  function onListChange() {
    if (busy || !vm || !vm.item) return;
    if (st.holdOrder && st.sortMode !== 'game') {
      applySort();                    // сервер пересортировал/добавил — возвращаем наш порядок
    } else {
      vm.$nextTick(mark);
    }
  }

  // --------------------------------------------------------------- marking

  function mark() {
    var container = document.getElementById('itemList');
    if (!container || !vm || !vm.item) return;

    // id -> type из актуального стейта; для подстраховки — парсинг img
    var typeById = {};
    vm.item.list.forEach(function (i) { if (i.id != null) typeById[i.id] = itemType(i); });

    container.querySelectorAll('.itemInMouth').forEach(function (el) {
      var t = typeById[el.id];
      if (t == null) {
        var img = el.querySelector('img');
        var m = img && img.src ? img.src.match(/things\/(\d+)\.png/) : null;
        t = m ? m[1] : null;
      }
      setAttr(el, 'cwb-type', t != null ? t : null);
      // крестик — на конкретном экземпляре, по id предмета
      setAttr(el, 'cwb-stale', (el.id && st.staleIds[el.id]) ? '1' : null);
      setAttr(el, 'cwb-recipe', (t != null && recipeFind(t)) ? '1' : null);
    });

    updatePanel();
  }
  function setAttr(el, name, val) {
    if (val != null) el.setAttribute(PREFIX + name, val);
    else el.removeAttribute(PREFIX + name);
  }

  // --------------------------------------------------------------- counts

  function haveCounts() {
    var have = {};
    if (!vm || !vm.item) return have;
    vm.item.list.forEach(function (i) {
      var t = itemType(i);
      if (t == null) return;
      if (i.id != null && st.staleIds[i.id]) return; // перечёркнутые экземпляры не считаем
      have[t] = (have[t] || 0) + 1;
    });
    return have;
  }
  function recipeFind(type) {
    for (var i = 0; i < st.recipe.length; i++) if (st.recipe[i].type === type) return st.recipe[i];
    return null;
  }
  function recipeComplete(have) {
    return st.recipe.length > 0 && st.recipe.every(function (r) { return (have[r.type] || 0) >= r.cnt; });
  }

  // --------------------------------------------------------------- interactions

  // модификаторы: Alt+клик — добавить/убрать из рецепта (по типу),
  // Ctrl/⌘+клик — крестик на самом предмете (по экземпляру).
  // Обычный клик не трогаем: у игры свой @click="item.showActions(now)".
  document.addEventListener('click', function (e) {
    if (!e.altKey && !e.ctrlKey && !e.metaKey) return;
    var el = e.target && e.target.closest ? e.target.closest('#itemList .itemInMouth') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.altKey) {
      var type = el.getAttribute(PREFIX + 'type');
      if (type == null) type = itemTypeById(el.id);
      if (type != null) toggleRecipe(type);
    } else if (el.id) {
      toggleStale(String(el.id));
    }
  }, true);

  function itemTypeById(id) {
    var item = vm.item.list.filter(function (i) { return String(i.id) === String(id); })[0];
    return item ? itemType(item) : null;
  }

  function toggleRecipe(type) {
    var entry = recipeFind(type);
    if (entry) {
      entry.cnt -= 1;
      if (entry.cnt <= 0) st.recipe = st.recipe.filter(function (r) { return r !== entry; });
    } else {
      st.recipe.push({ type: type, cnt: 1 });
    }
    save();
    mark();
  }
  function toggleStale(id) {
    if (st.staleIds[id]) delete st.staleIds[id];
    else st.staleIds[id] = true;
    save();
    mark();
  }

  // --------------------------------------------------------------- panel

  var panel = null;
  function init(vue) {
    vm = vue;

    buildPanel();

    // реактивность: подписка на состав списка (id по порядку)
    vm.$watch(function () { return vm.item.list.map(function (i) { return i.id; }).join(','); },
      onListChange, { immediate: true });
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'cwb-mt-root';
    panel.innerHTML =
      '<div class="cwb-mt-head">' +
      '  <span class="cwb-mt-title">Рецепт</span>' +
      '  <span class="cwb-mt-status" data-role="status"></span>' +
      '  <span class="cwb-mt-actions">' +
      '    <button type="button" class="cwb-mt-btn cwb-mt-fold" data-act="fold">' + (st.collapsed ? '▸' : '▾') + '</button>' +
      '    <button type="button" class="cwb-mt-btn cwb-mt-close" data-act="close">×</button>' +
      '  </span>' +
      '</div>' +
      '<div class="cwb-mt-body">' +
      '  <div class="cwb-mt-recipe" data-role="recipe"></div>' +
      '  <div class="cwb-mt-row cwb-mt-hint">Alt+клик по предмету во рту — ± в рецепт</div>' +
      '  <div class="cwb-mt-row cwb-mt-hint">Ctrl(⌘)+клик по предмету — крестик на нём</div>' +
      '  <div class="cwb-mt-row">' +
      '    <label class="cwb-mt-lbl">Сортировка</label>' +
      '    <select class="cwb-mt-sort" data-role="sortmode">' +
      '      <option value="game">как у игры</option>' +
      '      <option value="type">по типу</option>' +
      '    </select>' +
      '    <label class="cwb-mt-lbl cwb-mt-hold" title="Пересортировывать предметы автоматически, когда игра добавляет новый (сервер вставляет его по своему правилу) — выбранный порядок сохраняется"><input type="checkbox" data-role="hold"/> держать порядок</label>' +
      '  </div>' +
      '  <div class="cwb-mt-row cwb-mt-btnrow">' +
      '    <button type="button" class="cwb-mt-btn" data-act="clear-recipe">Очистить рецепт</button>' +
      '    <button type="button" class="cwb-mt-btn" data-act="clear-stale">Снять крестики</button>' +
      '  </div>' +
      '</div>';

    // элементы, куда игра не лезет: тело, снаружи #app
    document.body.appendChild(panel);

    // уголок для изменения размера
    var resizeHandle = document.createElement('div');
    resizeHandle.className = 'cwb-mt-resize';
    resizeHandle.title = 'потянуть — изменить размер';
    panel.appendChild(resizeHandle);

    // восстановление позиции и размера
    if (st.pos) {
      panel.style.right = '';
      panel.style.bottom = '';
      panel.style.left = Math.max(0, st.pos.x) + 'px';
      panel.style.top = Math.max(0, st.pos.y) + 'px';
    } else {
      panel.style.right = '12px';
      panel.style.bottom = '80px';
    }
    if (st.size && st.size.w) panel.style.width = st.size.w + 'px';
    if (st.size && st.size.h) panel.style.height = st.size.h + 'px';
    panel.classList.toggle('collapsed', st.collapsed);
    panel.querySelector('[data-role="sortmode"]').value = st.sortMode;
    panel.querySelector('[data-role="hold"]').checked = st.holdOrder;

    // события панели
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'close') {
        panel.classList.add('hidden');
      } else if (act === 'fold') {
        st.collapsed = !st.collapsed;
        panel.classList.toggle('collapsed', st.collapsed);
        btn.textContent = st.collapsed ? '▸' : '▾';
        save();
      } else if (act === 'clear-recipe') {
        st.recipe = [];
        save();
        mark();
      } else if (act === 'clear-stale') {
        st.staleIds = {};
        save();
        mark();
      }
    });
    panel.querySelector('[data-role="sortmode"]').addEventListener('change', function (e) {
      st.sortMode = e.target.value;
      save();
      if (st.sortMode === 'game') vm.$nextTick(mark); // просто перерисовать метки
      else applySort();
    });
    panel.querySelector('[data-role="hold"]').addEventListener('change', function (e) {
      st.holdOrder = !!e.target.checked;
      save();
      if (st.holdOrder && st.sortMode !== 'game') applySort();
    });

    makeDraggable(panel, panel.querySelector('.cwb-mt-head'));
    makeResizable(panel, resizeHandle);
    panel.querySelectorAll('.cwb-mt-body').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    updatePanel();
  }

  function updatePanel() {
    if (!panel || !panel.isConnected) return;
    var have = haveCounts();

    // статус
    var status = panel.querySelector('[data-role="status"]');
    var complete = recipeComplete(have);
    status.textContent = complete ? 'собран ✓' : '';
    panel.classList.toggle('complete', complete);

    // строки рецепта: просто иконки в ряд (натуральный размер, как в игре),
    // счётчик — бейдж на иконке; клик по иконке — минус одна штука
    var box = panel.querySelector('[data-role="recipe"]');
    if (!st.recipe.length) {
      box.innerHTML = '<div class="cwb-mt-empty">Рецепт пуст — Alt+клик по предмету во рту</div>';
      return;
    }
    var html = '';
    st.recipe.forEach(function (r) {
      var h = have[r.type] || 0;
      var ok = h >= r.cnt;
      var img = mouthItemUrl(r.type);
      html +=
        '<div class="cwb-mt-item' + (ok ? ' ok' : ' lack') + '" data-type="' + r.type + '"' +
        '     title="есть ' + h + ' из ' + r.cnt + ' — клик: убрать одну">' +
        (img ? '<img src="' + img + '" alt="">' : '') +
        '<span class="cwb-mt-badge">' + h + '/' + r.cnt + '</span>' +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.cwb-mt-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleRecipe(el.getAttribute('data-type')); // тот же минус, что у Alt+клика
      });
    });
  }

  // --------------------------------------------------------------- draggable

  function makeDraggable(root, handle) {
    var drag = null;
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('button')) return; // не тянем за кнопки
      var rect = root.getBoundingClientRect();
      drag = { px: rect.left, py: rect.top, x0: e.clientX, y0: e.clientY };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    document.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var x = Math.max(0, Math.min(window.innerWidth - root.offsetWidth, drag.px + e.clientX - drag.x0));
      var y = Math.max(0, Math.min(window.innerHeight - 40, drag.py + e.clientY - drag.y0));
      // важно: при первичной привязке к правому-нижнему углу остаются
      // inline right/bottom — вместе с top/left они растягивают панель
      root.style.right = '';
      root.style.bottom = '';
      root.style.left = x + 'px';
      root.style.top = y + 'px';
    });
    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);
    function stopDrag() {
      if (!drag) return;
      drag = null;
      var rect = root.getBoundingClientRect();
      st.pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
      save();
      mark();
    }
  }

  // --------------------------------------------------------------- resizable

  function makeResizable(root, handle) {
    var rz = null;
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var rect = root.getBoundingClientRect();
      rz = { w: rect.width, h: rect.height, x0: e.clientX, y0: e.clientY };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    document.addEventListener('pointermove', function (e) {
      if (!rz) return;
      var w = Math.max(230, Math.min(window.innerWidth - 16, rz.w + e.clientX - rz.x0));
      var h = Math.max(140, Math.min(window.innerHeight - 16, rz.h + e.clientY - rz.y0));
      root.style.width = w + 'px';
      root.style.height = h + 'px';
    });
    document.addEventListener('pointerup', stopResize);
    document.addEventListener('pointercancel', stopResize);
    function stopResize() {
      if (!rz) return;
      rz = null;
      var rect = root.getBoundingClientRect();
      st.size = { w: Math.round(rect.width), h: Math.round(rect.height) };
      save();
    }
  }
})();
