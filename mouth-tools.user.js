// ==UserScript==
// @name         CatWar: предметы во рту — сортировка, рецепт, крестики
// @namespace    catwar-mouth-tools
// @version      1.0.0
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
        collapsed: !!parsed.collapsed,
        sortMode: parsed.sortMode || 'game',   // game | type | fresh | lock | id
        holdOrder: parsed.holdOrder !== false, // сохранять порядок при новых предметах
        recipe: Array.isArray(parsed.recipe) ? parsed.recipe : [], // [{type, cnt}]
        stale: parsed.stale || {}              // {type: true}
      };
    } catch (e) {
      return { pos: null, collapsed: false, sortMode: 'game', holdOrder: true, recipe: [], stale: {} };
    }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  // --------------------------------------------------------------- styles

  css([
    // крестик и рамки на предметах во рту; только data-* + CSS,
    // классы/стили .itemInMouth Vue перезаписывает (см. pitfalls)
    '#itemList .itemInMouth { position: relative; }',
    '#itemList .itemInMouth[data-cwb-stale]::after {',
    '  content: "\\2716";',
    '  position: absolute; inset: 0;',
    '  display: flex; align-items: center; justify-content: center;',
    '  color: #e0224d; font: 900 40px/1 sans-serif;',
    '  text-shadow: 0 1px 3px rgba(255,255,255,.9), 0 0 5px rgba(0,0,0,.55);',
    '  opacity: .85; pointer-events: none; z-index: 2;',
    '}',
    '#itemList .itemInMouth[data-cwb-recipe] { outline: 2px solid #2f9e51; outline-offset: -1px; border-radius: 4px; }',

    // панель «рецепт» (жёстко вне #app, как #chat_float / #fightPanel)
    '#cwb-mt-root {',
    '  position: fixed; z-index: 100000; width: 300px;',
    '  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;',
    '  background: rgba(25, 25, 28, .92); color: #f2f2f2;',
    '  border: 1px solid rgba(255,255,255,.25); border-radius: 10px;',
    '  box-shadow: 0 8px 24px rgba(0,0,0,.35); box-sizing: border-box; user-select: none;',
    '}',
    '#cwb-mt-root.complete { border-color: #2f9e51; box-shadow: 0 8px 24px rgba(47,158,81,.35); }',
    '#cwb-mt-root.hidden { display: none; }',
    '#cwb-mt-root.collapsed .cwb-mt-body { display: none; }',
    '#cwb-mt-root.collapsed { width: auto; min-width: 170px; }',
    '.cwb-mt-head { display: flex; align-items: center; gap: 8px; padding: 5px 8px;',
    '  cursor: move; touch-action: none; background: rgba(255,255,255,.08);',
    '  border-radius: 10px 10px 0 0; font-weight: 600; }',
    '.cwb-mt-title { flex: none; }',
    '.cwb-mt-status { margin-left: auto; color: #66d68a; font-weight: 600; font-size: 11px; }',
    '#cwb-mt-root:not(.complete) .cwb-mt-status { color: transparent; }',
    '.cwb-mt-actions { display: flex; gap: 2px; }',
    '.cwb-mt-head .cwb-mt-btn { border: 0; background: rgba(255,255,255,.12); color: inherit; }',
    '.cwb-mt-head .cwb-mt-btn:hover { background: rgba(255,255,255,.25); }',
    '.cwb-mt-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }',
    '.cwb-mt-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
    '.cwb-mt-hint { font-size: 10px; opacity: .6; }',
    '.cwb-mt-lbl { opacity: .75; }',
    '.cwb-mt-hold { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }',
    '.cwb-mt-sort, .cwb-mt-btn { font: inherit; border-radius: 6px; }',
    '.cwb-mt-sort { background: rgba(255,255,255,.12); color: inherit; border: 1px solid rgba(255,255,255,.25); padding: 2px 6px; }',
    '.cwb-mt-btn { cursor: pointer; border: 0; background: rgba(255,255,255,.12); color: inherit; padding: 3px 8px; }',
    '.cwb-mt-btn:hover { background: rgba(255,255,255,.25); }',
    '.cwb-mt-btnrow button { flex: 1 1 auto; }',
    '.cwb-mt-recipe { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }',
    '.cwb-mt-empty { opacity: .65; padding: 4px 2px; }',
    '.cwb-mt-line { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 6px; background: rgba(255,255,255,.06); }',
    '.cwb-mt-line.ok { background: rgba(47,158,81,.28); }',
    '.cwb-mt-line.lack .cwb-mt-count { color: #ff8f9d; }',
    '.cwb-mt-thumb { width: 34px; height: 34px; display: block; image-rendering: pixelated; }',
    '.cwb-mt-typed { font-size: 10px; opacity: .7; }',
    '.cwb-mt-count { margin-left: auto; font-weight: 600; }'
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
    type: function (a, b) { return (cmpInt(itemType(a)) - cmpInt(itemType(b))) || (a.id - b.id); },
    id: function (a, b) { return a.id - b.id; },
    fresh: function (a, b) {
      // срок годности: сначала то, что портится раньше; без срока — в конец
      var av = a.expiresAt == null ? 1 : 0, bv = b.expiresAt == null ? 1 : 0;
      return (av - bv) || ((a.expiresAt || 0) - (b.expiresAt || 0)) || (a.id - b.id);
    },
    lock: function (a, b) {
      var av = a.isLocked ? 1 : 0, bv = b.isLocked ? 1 : 0;
      return (av - bv) || (cmpInt(itemType(a)) - cmpInt(itemType(b))) || (a.id - b.id);
    }
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
      setAttr(el, 'cwb-stale', (t != null && st.stale[t]) ? '1' : null);
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
      if (t == null || st.stale[t]) return; // крестики не считаем собранными
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

  // модификаторы: Alt+клик — добавить/убрать из рецепта, Ctrl/⌘+клик — крестик.
  // Обычный клик не трогаем: у игры свой @click="item.showActions(now)".
  document.addEventListener('click', function (e) {
    if (!e.altKey && !e.ctrlKey && !e.metaKey) return;
    var el = e.target && e.target.closest ? e.target.closest('#itemList .itemInMouth') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    var type = el.getAttribute(PREFIX + 'type');
    if (type == null) type = itemTypeById(el.id);
    if (type == null) return;

    if (e.altKey) toggleRecipe(type);
    else toggleStale(type);
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
  function toggleStale(type) {
    if (st.stale[type]) delete st.stale[type];
    else st.stale[type] = true;
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
      '  <div class="cwb-mt-row cwb-mt-hint">Ctrl(⌘)+клик — отметить/снять крестик</div>' +
      '  <div class="cwb-mt-row">' +
      '    <label class="cwb-mt-lbl">Сортировка</label>' +
      '    <select class="cwb-mt-sort" data-role="sortmode">' +
      '      <option value="game">как у игры</option>' +
      '      <option value="type">по типу</option>' +
      '      <option value="fresh">по свежести</option>' +
      '      <option value="lock">по закреплённости</option>' +
      '      <option value="id">по id</option>' +
      '    </select>' +
      '    <label class="cwb-mt-lbl cwb-mt-hold"><input type="checkbox" data-role="hold"/> держать</label>' +
      '  </div>' +
      '  <div class="cwb-mt-row cwb-mt-btnrow">' +
      '    <button type="button" class="cwb-mt-btn" data-act="clear-recipe">Очистить рецепт</button>' +
      '    <button type="button" class="cwb-mt-btn" data-act="clear-stale">Снять крестики</button>' +
      '  </div>' +
      '</div>';

    // элементы, куда игра не лезет: тело, снаружи #app
    document.body.appendChild(panel);

    // восстановление позиции
    if (st.pos) {
      panel.style.left = Math.max(0, st.pos.x) + 'px';
      panel.style.top = Math.max(0, st.pos.y) + 'px';
    } else {
      panel.style.right = '12px';
      panel.style.bottom = '80px';
    }
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
        st.stale = {};
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

    // строки рецепта
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
        '<div class="cwb-mt-line' + (ok ? ' ok' : ' lack') + '">' +
        (img ? '<img class="cwb-mt-thumb" src="' + img + '" alt="">' : '') +
        '<span class="cwb-mt-typed" title="тип ' + r.type + '">#' + r.type + '</span>' +
        '<span class="cwb-mt-count">' + h + ' / ' + r.cnt + '</span>' +
        '<button type="button" class="cwb-mt-btn" data-act="rm" data-type="' + r.type + '">✕</button>' +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-act="rm"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var t = b.getAttribute('data-type');
        st.recipe = st.recipe.filter(function (r) { return r.type !== t; });
        save();
        mark();
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
      root.style.right = '';
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
})();
