// ==UserScript==
// @name         CatWar: предметы во рту — сортировка, рецепт, чердак
// @namespace    catwar-mouth-tools
// @version      1.9.0
// @description  Сортировка предметов во рту (в т.ч. по рецепту), закреплённое плавающее окно «Рецепт» и «чердак» — отдельный сворачиваемый блок наверху рта для ненужных предметов.
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

  var LS_KEY = 'cwb_mouth_tools'; // единый JSON: позиция, рецепт, чердак, сортировка
  var PREFIX = 'data-';           // атрибуты data-cwb-* на чужих (Vue) элементах — переживают ре-рендер

  // --------------------------------------------------------------- state

  var st = load();
  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(LS_KEY)) || {};
      // рецепт — просто список типов, по одной штуке каждого;
      // старый формат [{type,cnt}] нормализуем в типы
      var recipe = Array.isArray(parsed.recipe)
        ? parsed.recipe.map(function (r) { return typeof r === 'object' ? r.type : r; })
            .filter(function (t) { return t != null; })
        : [];
      return {
        pos: typeof parsed.pos === 'object' && parsed.pos ? parsed.pos : null,
        size: parsed.size && typeof parsed.size.w === 'number' ? parsed.size : null,
        collapsed: !!parsed.collapsed,
        atticFolded: !!parsed.atticFolded,   // чердак свёрнут
        sortMode: parsed.sortMode || 'game',   // game | type (порядок держится всегда)
        recipe: recipe,
        attic: parsed.attic || {}                // {type: true} — «чердак»: отдельный блок рта
      };
    } catch (e) {
      return { pos: null, size: null, collapsed: false, atticFolded: false, sortMode: 'game', recipe: [], attic: {} };
    }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  // --------------------------------------------------------------- styles

  css([
    // «чердак»: ненужные виды предметов — отдельным сворачиваемым блоком ВВЕРХУ рта.
    // первый «обычный» предмет после чердачного блока начинает новую строку (grid-column-start: 1)
    '#itemList .itemInMouth[data-cwb-attic] { opacity: .45; filter: grayscale(.7); }',
    '#itemList .itemInMouth[data-cwb-main-first] { grid-column-start: 1; margin-top: 8px; }',
    '#itemList.cwb-attic-folded .itemInMouth[data-cwb-attic] { display: none; }',

    // заголовок-переключатель «Чердак ×N ▾» (вставляется перед #itemList)
    '#cwb-mt-attic-strip { display: inline-flex; align-items: center; gap: 6px;',
    '  margin: 2px 0 4px; padding: 1px 8px; width: max-content; box-sizing: border-box;',
    '  font: 11px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;',
    '  color: #f2f2f2; background: rgba(25,25,28,.7);',
    '  border: 1px solid rgba(255,255,255,.25); border-radius: 6px;',
    '  cursor: pointer; user-select: none; }',
    '#cwb-mt-attic-strip:hover { background: rgba(25,25,28,.9); }',
    '.cwb-mt-a-fold { display: inline-block; width: 1em; text-align: center; }',

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
    '.cwb-mt-item.lack { opacity: .4; }',                       // этого предмета нет во рту
    '.cwb-mt-item.ok img { outline: 2px solid #2f9e51; outline-offset: -1px; border-radius: 6px; }'
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
    if (busy) return;
    busy = true;
    try {
      if (st.sortMode === 'recipe') sortByRecipe(vm.item.list);
      else {
        var cmp = CMP[st.sortMode];
        if (cmp) vm.item.list.sort(cmp);
      }
      floatAttic(vm.item.list); // чердак — всегда отдельным (верхним) блоком рта
    } catch (e) { /* ignore */ }
    requestAnimationFrame(function () { busy = false; mark(); });
  }

  // реактивная замена порядка: Vue 2 не видит запись по индексам (list[j] = ...),
  // поэтому только через splice — иначе DOM не перерисуется.
  // ВАЖНО: splice берём через сам массив (list.splice), а НЕ через Array.prototype —
  // иначе вызывается нативный метод мимо перехватчика Vue, Vue не оповещается
  // и DOM висит со старым порядком до ближайшего перерендера игры
  // (симптом: «по рецепту» сортируется с огромной задержкой).
  function reorderList(list, out) {
    if (out.length !== list.length) return;
    var args = [0, list.length].concat(out);
    list.splice.apply(list, args);
  }

  // «по рецепту»: сначала предметы рецепта в порядке рецепта (а,б,в...),
  // остальные — после, в прежнем порядке. Пример: рецепт а+б+в, рот «ваабв» → «абвав»
  function sortByRecipe(list) {
    if (!st.recipe.length) return;
    var used = {};
    var out = [];
    st.recipe.forEach(function (type) {
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!used[it.id] && itemType(it) === type) { used[it.id] = 1; out.push(it); break; }
      }
    });
    list.forEach(function (it) { if (!used[it.id]) out.push(it); });
    reorderList(list, out);
  }

  // чердачные предметы — в начало списка (блок НАВЕРХУ рта, порядок остальных не меняется)
  function floatAttic(list) {
    if (!Object.keys(st.attic).length) return;
    var atticOut = [], out = [];
    list.forEach(function (it) {
      var t = itemType(it);
      if (t != null && st.attic[t]) atticOut.push(it);
      else out.push(it);
    });
    reorderList(list, atticOut.concat(out));
  }

  function onListChange() {
    if (busy || !vm || !vm.item) return;
    applySort(); // сортировка (если выбрана) + чердак; в режиме «как у игры» без чердака ничего не меняет
  }

  // --------------------------------------------------------------- marking

  function mark() {
    var container = document.getElementById('itemList');
    if (!container || !vm || !vm.item) return;

    // id -> type из актуального стейта; для подстраховки — парсинг img
    var typeById = {};
    vm.item.list.forEach(function (i) { if (i.id != null) typeById[i.id] = itemType(i); });

    var firstMain = null;
    var atticCount = 0;
    container.querySelectorAll('.itemInMouth').forEach(function (el) {
      var t = typeById[el.id];
      if (t == null) {
        var img = el.querySelector('img');
        var m = img && img.src ? img.src.match(/things\/(\d+)\.png/) : null;
        t = m ? m[1] : null;
      }
      setAttr(el, 'cwb-type', t != null ? t : null);
      // чердак — на всём типе предмета
      var isAttic = t != null && !!st.attic[t];
      setAttr(el, 'cwb-attic', isAttic ? '1' : null);
      setAttr(el, 'cwb-attic-first', null); // легаси v1.5–1.7
      setAttr(el, 'cwb-main-first', null);
      if (isAttic) atticCount++;
      else if (!firstMain) firstMain = el;
    });
    // первый «обычный» предмет после чердачного блока начинает новую строку рта
    if (atticCount && firstMain) setAttr(firstMain, 'cwb-main-first', '1');

    // свёрнутость чердака (CSS прячет .itemInMouth[data-cwb-attic])
    container.classList.toggle('cwb-attic-folded', !!st.atticFolded);

    syncAtticStrip(container, atticCount);

    updatePanel();
  }
  function setAttr(el, name, val) {
    if (val != null) el.setAttribute(PREFIX + name, val);
    else el.removeAttribute(PREFIX + name);
    // подчистить легаси-атрибуты v1.0–1.4 (задвоенный префикс data-cwb-cwb-*)
    el.removeAttribute('data-cwb-' + name);
  }

  // заголовок «Чердак ×N ▾» перед ртом: клик — свернуть/развернуть чердак.
  // mark() вызывается после каждого изменения списка — если игра прибрала
  // наш вставной элемент при перерендере родителя, он создаётся заново.
  function syncAtticStrip(container, atticCount) {
    var strip = document.getElementById('cwb-mt-attic-strip');
    if (!atticCount) {
      if (strip && strip.parentNode) strip.parentNode.removeChild(strip);
      return;
    }
    if (!strip) {
      if (!container.parentNode) return;
      strip = document.createElement('div');
      strip.id = 'cwb-mt-attic-strip';
      strip.title = 'свернуть/развернуть чердак';
      strip.addEventListener('click', function () {
        st.atticFolded = !st.atticFolded;
        save();
        mark();
      });
      container.parentNode.insertBefore(strip, container);
    }
    strip.innerHTML = 'Чердак ×' + atticCount +
      ' <span class="cwb-mt-a-fold">' + (st.atticFolded ? '▸' : '▾') + '</span>';
  }

  // --------------------------------------------------------------- counts

  function haveCounts() {
    var have = {};
    if (!vm || !vm.item) return have;
    vm.item.list.forEach(function (i) {
      var t = itemType(i);
      if (t == null) return;
      have[t] = (have[t] || 0) + 1;
    });
    return have;
  }
  function recipeComplete(have) {
    return st.recipe.length > 0 && st.recipe.every(function (t) { return (have[t] || 0) >= 1; });
  }

  // --------------------------------------------------------------- interactions

  // модификаторы: Alt+клик — добавить/убрать из рецепта (по типу),
  // Shift+клик — на чердак / обратно (отдельная строка рта).
  // Обычный клик не трогаем: у игры свой @click="item.showActions(now)".
  document.addEventListener('click', function (e) {
    if (!e.altKey && !e.shiftKey) return;
    var el = e.target && e.target.closest ? e.target.closest('#itemList .itemInMouth') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    var type = el.getAttribute(PREFIX + 'type');
    if (type == null) type = itemTypeById(el.id);
    if (type == null) return;

    if (e.altKey) toggleRecipe(type);
    else toggleAttic(type);
  }, true);

  function itemTypeById(id) {
    var item = vm.item.list.filter(function (i) { return String(i.id) === String(id); })[0];
    return item ? itemType(item) : null;
  }

  // Ctrl+клик (Cmd на Mac) по предмету — «галка» на все предметы этого типа:
  // если предмет не выделен — выделяем весь тип, если выделен — снимаем весь тип.
  // Использует игровой мультивыбор: vm.item.showActions(t, true) (как selectAll).
  document.addEventListener('click', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    var el = e.target && e.target.closest ? e.target.closest('#itemList .itemInMouth') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    var type = el.getAttribute(PREFIX + 'type');
    if (type == null) type = itemTypeById(el.id);
    if (type == null) return;

    selectType(type);
  }, true);

  // macOS: Ctrl+клик — это правая кнопка; глушим контекстное меню на предметах рта
  document.addEventListener('contextmenu', function (e) {
    if (!e.ctrlKey) return;
    if (e.target && e.target.closest && e.target.closest('#itemList .itemInMouth')) e.preventDefault();
  }, true);

  function selectType(type) {
    if (!vm || !vm.item || vm.item.mixMode) return; // как у игры: в режиме смешивания выбора нет
    var of = vm.item.list.filter(function (i) { return itemType(i) === type; });
    if (!of.length) return;
    var anyOff = of.some(function (i) { return !i.isActive; }); // есть невыделенные?
    of.forEach(function (i) {
      if (anyOff ? !i.isActive : i.isActive) vm.item.showActions(i, true); // toggle
    });
  }

  function toggleRecipe(type) {
    var i = st.recipe.indexOf(type);
    if (i !== -1) st.recipe.splice(i, 1);
    else st.recipe.push(type);
    save();
    applySort(); // состав рецепта изменился — пересобрать порядок «по рецепту»
  }
  function toggleAttic(type) {
    if (st.attic[type]) delete st.attic[type];
    else st.attic[type] = true;
    save();
    applySort(); // чердачные предметы всегда поднимаются наверх — обновляем порядок
  }

  // «Выбрать всё» (#item_multi) — только предметы вне чердака.
  // Игра: item.selectAll() идёт по list и для каждого невыбранного зовёт
  // item.showActions(t, true) (проверено по бандлу cw3.js); подменяем метод,
  // фильтруя чердачные типы. mixMode (смешивание) — как у игры: выбор отключён.
  function patchSelectAll() {
    if (typeof vm.item.selectAll !== 'function') return;      // игра изменилась — тихо пропускаем
    if (vm.item.selectAll.cwbAtticSkip) return;                 // уже патчено
    var wrapped = function () {
      if (vm.item.mixMode) return;
      vm.item.list.forEach(function (t) {
        if (t.isActive) return;
        var ty = itemType(t);
        if (ty != null && st.attic[ty]) return; // чердак — не выбираем
        vm.item.showActions(t, true);
      });
    };
    wrapped.cwbAtticSkip = true;
    vm.item.selectAll = wrapped;
  }

  // --------------------------------------------------------------- panel

  var panel = null;
  function init(vue) {
    vm = vue;

    buildPanel();
    patchSelectAll();

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
      '  </span>' +
      '</div>' +
      '<div class="cwb-mt-body">' +
      '  <div class="cwb-mt-recipe" data-role="recipe"></div>' +
      '  <div class="cwb-mt-row cwb-mt-hint">Alt+клик — в рецепт / из рецепта</div>' +
      '  <div class="cwb-mt-row cwb-mt-hint">Shift+клик — на чердак / обратно</div>' +
      '  <div class="cwb-mt-row cwb-mt-hint">Ctrl+клик (Cmd на Mac) — галка на весь тип</div>' +
      '  <div class="cwb-mt-row">' +
      '    <label class="cwb-mt-lbl">Сортировка</label>' +
      '    <select class="cwb-mt-sort" data-role="sortmode">' +
      '      <option value="game">как у игры</option>' +
      '      <option value="type">по типу</option>' +
      '      <option value="recipe">по рецепту</option>' +
      '    </select>' +
      '  </div>' +
      '  <div class="cwb-mt-row cwb-mt-btnrow">' +
      '    <button type="button" class="cwb-mt-btn" data-act="clear-recipe">Очистить рецепт</button>' +
      '    <button type="button" class="cwb-mt-btn" data-act="clear-attic">Разобрать чердак</button>' +
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

    // события панели
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'fold') {
        st.collapsed = !st.collapsed;
        panel.classList.toggle('collapsed', st.collapsed);
        btn.textContent = st.collapsed ? '▸' : '▾';
        save();
      } else if (act === 'clear-recipe') {
        st.recipe = [];
        save();
        applySort(); // рецепт опустел — вернуть порядок без «рецептных» наверху
      } else if (act === 'clear-attic') {
        st.attic = {};
        save();
        applySort();
      }
    });
    panel.querySelector('[data-role="sortmode"]').addEventListener('change', function (e) {
      st.sortMode = e.target.value;
      save();
      if (st.sortMode === 'game') vm.$nextTick(mark); // просто перерисовать метки
      else applySort();
    });

    makeDraggable(panel, panel.querySelector('.cwb-mt-head'));
    makeResizable(panel, resizeHandle);
    // клики внутри панели не должны доходить до документа (игра),
    // но наши собственные обработчики на самой панели это не ломает
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

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

    // рецепт: просто иконки в ряд (натуральный размер, как в игре), без счётчиков;
    // нет во рту — иконка приглушена, есть — с зелёной рамкой;
    // всё есть — панель светится зелёным (класс complete)
    var box = panel.querySelector('[data-role="recipe"]');
    if (!st.recipe.length) {
      box.innerHTML = '<div class="cwb-mt-empty">Рецепт пуст — Alt+клик по предмету во рту</div>';
      return;
    }
    var html = '';
    st.recipe.forEach(function (type) {
      var ok = (have[type] || 0) >= 1;
      var img = mouthItemUrl(type);
      html +=
        '<div class="cwb-mt-item' + (ok ? ' ok' : ' lack') + '" data-type="' + type + '"' +
        '     title="клик — убрать из рецепта">' +
        (img ? '<img src="' + img + '" alt="">' : '') +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.cwb-mt-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleRecipe(el.getAttribute('data-type')); // клик — убрать из рецепта
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
