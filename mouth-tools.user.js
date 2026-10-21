// ==UserScript==
// @name         CatWar: инструменты для рта
// @namespace    catwar-mouth-tools
// @version      2.0.0
// @description  Чердак с закреплением типов (🔒 — защита от случайного смешивания), сортировка прямо в блоке рта, быстрое выделение типов и кнопки смешивания — без отдельных окон.
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
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * Инструменты для рта (бывший «Рецепт»):
 *   - чердак: ненужные типы — отдельным сворачиваемым блоком вверху рта
 *     (Shift+клик по предмету — на чердак / обратно);
 *   - закрепление 🔒: закреплённый тип не выделяется «Быстрым выделением»
 *     (Ctrl+клик), «Выбрать всё» и кнопками смешивания — не смешать случайно
 *     (Alt+клик по предмету — закрепить/открепить тип);
 *   - сортировка «как у игры / по типу» — селект прямо в блоке рта,
 *     плавающее окно и «рецепт» убраны (v2.0.0);
 *   - быстрое выделение: Ctrl+клик (⌘ на Mac) — «галка» на весь тип,
 *     работает и в режиме смешивания;
 *   - кнопки смешивания (✚ Всё / → В смешение / ✖ Снять) — прилипающая
 *     панель у списка рта, влившись из отдельного мода mix-select.
 *
 * Игра: выделение — Vue-флаг isActive, «Смешать» зовёт нативный confirm().
 * Всё выделение идёт через игровые методы (showActions/hideActions).
 * Миграция с v1.x: recipe/pos/size/collapsed больше не читаются,
 * sortMode 'recipe' → 'game', чердак и свёрнутость сохраняются.
 */

/* eslint-disable no-var */
(function () {
  'use strict';

  var LS_KEY = 'cwb_mouth_tools'; // единый JSON: чердак, закрепы, сортировка
  var PREFIX = 'data-';           // атрибуты data-cwb-* на чужих (Vue) элементах — переживают ре-рендер

  // --------------------------------------------------------------- state

  var st = load();
  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(LS_KEY)) || {};
      return {
        atticFolded: !!parsed.atticFolded,                 // чердак свёрнут
        sortMode: parsed.sortMode === 'type' ? 'type' : 'game', // game | type ('recipe' и мусор → game)
        attic: parsed.attic || {},                         // {type: true} — чердак
        pins: parsed.pins || {}                            // {type: true} — 🔒 закреплённые
      };
    } catch (e) {
      return { atticFolded: false, sortMode: 'game', attic: {}, pins: {} };
    }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  // --------------------------------------------------------------- styles

  css([
    // чердак: приглушённые предметы отдельным блоком ВВЕРХУ рта;
    // первый «обычный» предмет начинает новую строку (grid-column-start: 1)
    '#itemList .itemInMouth[data-cwb-attic] { opacity: .45; filter: grayscale(.7); }',
    '#itemList .itemInMouth[data-cwb-main-first] { grid-column-start: 1; margin-top: 8px; }',
    '#itemList.cwb-attic-folded .itemInMouth[data-cwb-attic] { display: none; }',

    // 🔒 закреплённый тип: значок-замок в углу предмета
    '#itemList .itemInMouth[data-cwb-pinned] { position: relative; }',
    '#itemList .itemInMouth[data-cwb-pinned]::after { content: "\\1F512"; position: absolute;',
    '  right: 0; bottom: 0; font-size: 9px; line-height: 1; pointer-events: none; }',

    // панель инструментов рта (вставляется перед #itemList, внутри блока рта)
    '#cwb-mt-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;',
    '  margin: 2px 0 4px; font: 11px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;',
    '  color: #f2f2f2; user-select: none; }',
    '.cwb-mt-chip { cursor: pointer; font: inherit; color: inherit; padding: 1px 8px;',
    '  background: rgba(25,25,28,.7); border: 1px solid rgba(255,255,255,.25); border-radius: 6px; }',
    '.cwb-mt-chip:hover { background: rgba(25,25,28,.9); }',
    '.cwb-mt-lbl { opacity: .75; }',
    '.cwb-mt-sort { font: inherit; color: inherit; padding: 1px 4px;',
    '  background: rgba(25,25,28,.7); border: 1px solid rgba(255,255,255,.25); border-radius: 6px; }',
    '.cwb-mt-pins { opacity: .85; cursor: help; }',
    '.cwb-mt-hint { font-size: 10px; opacity: .55; }',

    // прилипающая панель смешивания (в body, НЕ внутри Vue-контейнеров)
    '#cwb-mt-mixbar { display: flex; gap: 4px; align-items: center; padding: 2px;',
    '  background: rgba(28,20,12,.92); border: 1px solid rgba(243,228,200,.25); border-radius: 8px; }',
    '#cwb-mt-mixbar button { cursor: pointer; }'
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
  function itemTypeById(id) {
    var item = vm.item.list.filter(function (i) { return String(i.id) === String(id); })[0];
    return item ? itemType(item) : null;
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
      var cmp = CMP[st.sortMode];
      if (cmp) vm.item.list.sort(cmp);
      floatAttic(vm.item.list); // чердак — всегда отдельным (верхним) блоком рта
    } catch (e) { /* ignore */ }
    requestAnimationFrame(function () { busy = false; mark(); });
  }

  // Vue 2 не видит запись по индексу — только методы массива (splice)
  function reorderList(list, out) {
    if (out.length !== list.length) return;
    var args = [0, list.length].concat(out);
    list.splice.apply(list, args);
  }

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
    applySort(); // сортировка (если выбрана) + чердак; в «как у игры» без чердака ничего не меняет
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
    var pinnedTypes = {}; // типы с 🔒, чьи предметы сейчас во рту
    container.querySelectorAll('.itemInMouth').forEach(function (el) {
      var t = typeById[el.id];
      if (t == null) {
        var img = el.querySelector('img');
        var m = img && img.src ? img.src.match(/things\/(\d+)\.png/) : null;
        t = m ? m[1] : null;
      }
      setAttr(el, 'cwb-type', t != null ? t : null);
      // чердак и закрепление — на всём типе предмета
      var isAttic = t != null && !!st.attic[t];
      setAttr(el, 'cwb-attic', isAttic ? '1' : null);
      var isPinned = t != null && !!st.pins[t];
      setAttr(el, 'cwb-pinned', isPinned ? '1' : null);
      if (isPinned) pinnedTypes[t] = true;
      setAttr(el, 'cwb-attic-first', null); // легаси v1.5–1.7
      setAttr(el, 'cwb-main-first', null);
      if (isAttic) atticCount++;
      else if (!firstMain) firstMain = el;
    });
    // первый «обычный» предмет после чердачного блока начинает новую строку рта
    if (atticCount && firstMain) setAttr(firstMain, 'cwb-main-first', '1');

    // свёрнутость чердака (CSS прячет .itemInMouth[data-cwb-attic])
    container.classList.toggle('cwb-attic-folded', !!st.atticFolded);

    syncControls(container, atticCount, Object.keys(pinnedTypes).length);
  }
  function setAttr(el, name, val) {
    if (val != null) el.setAttribute(PREFIX + name, val);
    else el.removeAttribute(PREFIX + name);
    // подчистить легаси-атрибуты v1.0–1.4 (задвоенный префикс data-cwb-cwb-*)
    el.removeAttribute('data-cwb-' + name);
  }

  // панель инструментов рта: [Чердак ×N ▾] [Сортировка ▾] [🔒 ×M] + подсказка.
  // mark() вызывается после каждого изменения списка — если игра прибрала
  // наш вставной элемент при перерендере родителя, он создаётся заново.
  function syncControls(container, atticCount, pinnedCount) {
    var bar = document.getElementById('cwb-mt-controls');
    if (!bar) {
      if (!container.parentNode) return;
      bar = document.createElement('div');
      bar.id = 'cwb-mt-controls';
      bar.innerHTML =
        '<button type="button" id="cwb-mt-attic-toggle" class="cwb-mt-chip" title="свернуть/развернуть чердак"></button>' +
        '<span class="cwb-mt-lbl">Сортировка</span>' +
        '<select class="cwb-mt-sort" data-role="sortmode" title="порядок предметов во рту">' +
        '  <option value="game">как у игры</option>' +
        '  <option value="type">по типу</option>' +
        '</select>' +
        '<span class="cwb-mt-pins" title="закреплённые типы (Alt+клик по предмету — закрепить/открепить)"></span>' +
        '<span class="cwb-mt-hint">Ctrl+клик (⌘) — весь тип · Shift+клик — чердак · Alt+клик — 🔒 закрепить</span>';
      bar.querySelector('#cwb-mt-attic-toggle').addEventListener('click', function () {
        st.atticFolded = !st.atticFolded;
        save();
        mark();
      });
      bar.querySelector('[data-role="sortmode"]').addEventListener('change', function (e) {
        st.sortMode = e.target.value;
        save();
        if (st.sortMode === 'game') vm.$nextTick(mark); // просто перерисовать метки
        else applySort();
      });
      container.parentNode.insertBefore(bar, container);
    }

    var att = bar.querySelector('#cwb-mt-attic-toggle');
    att.style.display = atticCount ? '' : 'none';
    att.textContent = 'Чердак ×' + atticCount + (st.atticFolded ? ' ▸' : ' ▾');

    var pins = bar.querySelector('.cwb-mt-pins');
    pins.style.display = pinnedCount ? '' : 'none';
    pins.textContent = '🔒 ×' + pinnedCount;

    var sel = bar.querySelector('[data-role="sortmode"]');
    if (sel.value !== st.sortMode) sel.value = st.sortMode;
  }

  // --------------------------------------------------------------- attic & pins

  function isPinned(type) { return type != null && !!st.pins[type]; }

  function toggleAttic(type) {
    if (st.attic[type]) delete st.attic[type];
    else st.attic[type] = true;
    save();
    applySort(); // чердачные предметы всегда поднимаются наверх — обновляем порядок
  }

  function togglePin(type) {
    if (st.pins[type]) delete st.pins[type];
    else st.pins[type] = true;
    save();
    mark();
  }

  // --------------------------------------------------------------- interactions

  // модификаторы: Alt+клик — 🔒 закрепить/открепить тип (защита от
  // случайного выделения/смешивания), Shift+клик — на чердак / обратно.
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

    if (e.altKey) togglePin(type);
    else toggleAttic(type);
  }, true);

  // Ctrl+клик (Cmd на Mac) по предмету — «галка» на все предметы этого типа.
  // Использует игровой мультивыбор: vm.item.showActions(t, true) (как selectAll).
  // Работает и в режиме смешивания; 🔒 закреплённые типы не трогает.
  document.addEventListener('click', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.shiftKey || e.altKey) return;
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

  // --------------------------------------------------------------- selection & mixing

  // годен к быстрому выделению: не заблокирован игрой и не 🔒 закреплён
  function mixable(it) { return it && !it.isLocked && !isPinned(itemType(it)); }

  function selectType(type) {
    if (!vm || !vm.item) return;
    if (isPinned(type)) return; // 🔒 закреплённые не выделяем случайно
    var of = vm.item.list.filter(function (i) { return itemType(i) === type && mixable(i); });
    if (!of.length) return;
    var anyOff = of.some(function (i) { return !i.isActive; }); // есть невыделенные?
    of.forEach(function (i) {
      if (anyOff ? !i.isActive : i.isActive) vm.item.showActions(i, true); // toggle
    });
  }

  function ensureMixMode() {
    if (vm.item.mixMode) return;
    try { vm.item.enableMixMode(); }
    catch (e) { vm.item.mixMode = true; } // запасной путь, если метод переименуют
  }
  function markActive(it) {
    try { vm.item.showActions(it, true); }
    catch (e) { it.isActive = true; } // запасной путь
  }

  // «✚ Всё»: войти в режим смешивания и выделить всё (кроме 🔒 и заблокированных)
  function mixAll() {
    if (!vm || !vm.item) return;
    ensureMixMode();
    vm.item.list.forEach(function (it) {
      if (mixable(it) && !it.isActive) markActive(it);
    });
  }

  // «→ В смешение»: войти в режим смешивания, СОХРАНИВ текущее выделение
  // (игра при входе в режим его сбрасывает — мы возвращаем)
  function mixSelected() {
    if (!vm || !vm.item || vm.item.mixMode) return;
    var ids = vm.item.list.filter(function (i) { return i.isActive; })
      .map(function (i) { return i.id; });
    ensureMixMode();
    vm.item.list.forEach(function (it) {
      if (!it.isActive && ids.indexOf(it.id) !== -1) markActive(it);
    });
  }

  function clearSelection() {
    if (!vm || !vm.item) return;
    try { vm.item.hideActions(); }
    catch (e) {
      vm.item.list.forEach(function (it) { it.isActive = false; });
    }
  }

  // «Выбрать всё» (#item_multi) — только предметы вне чердака и без 🔒.
  // Игра: item.selectAll() идёт по list и для каждого невыбранного зовёт
  // showActions(t, true); в режиме смешивания у игры это no-op — сохраняем.
  function patchSelectAll() {
    if (typeof vm.item.selectAll !== 'function') return;      // игра изменилась — тихо пропускаем
    if (vm.item.selectAll.cwbAtticSkip) return;                 // уже патчено
    var wrapped = function () {
      if (vm.item.mixMode) return;
      vm.item.list.forEach(function (t) {
        if (t.isActive) return;
        var ty = itemType(t);
        if (ty != null && (st.attic[ty] || st.pins[ty])) return; // чердак и 🔒 — не выбираем
        vm.item.showActions(t, true);
      });
    };
    wrapped.cwbAtticSkip = true;
    vm.item.selectAll = wrapped;
  }

  // --------------------------------------------------------------- mix bar
  // Прилипающая панель у списка рта (в body — НЕ внутри Vue-контейнеров):
  // [✚ Всё] [→ В смешение] [✖ Снять]. Позиция ограничена вьюпортом.

  function buildMixBtn(text, title, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-btn ui-btn--tiny'; // игровой класс кнопок — родной вид
    b.textContent = text;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  }

  function mountMixBar() {
    var bar = document.getElementById('cwb-mt-mixbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'cwb-mt-mixbar';
      bar.style.position = 'fixed';
      bar.style.zIndex = '99999';
      bar.appendChild(buildMixBtn('✚ Всё',
        'Войти в режим смешивания и выделить все предметы (кроме 🔒 и заблокированных)',
        mixAll));
      bar.appendChild(buildMixBtn('→ В смешение',
        'Войти в режим смешивания, сохранив текущее выделение (например, после Ctrl+кликов)',
        mixSelected));
      bar.appendChild(buildMixBtn('✖ Снять',
        'Снять выделение со всех предметов',
        clearSelection));
      document.body.appendChild(bar);
    } else if (!bar.isConnected) {
      document.body.appendChild(bar);
    }
    positionMixBar(bar);
  }

  function positionMixBar(bar) {
    var td = document.querySelector('#tr_mouth > td');
    if (!td || !td.isConnected) { bar.style.visibility = 'hidden'; return; }
    var r = td.getBoundingClientRect();
    var vh = window.innerHeight;
    // панель рта не на экране (выше/ниже вьюпорта) — прячем панель смешивания
    if (r.width === 0 || r.bottom <= 0 || r.top >= vh) {
      bar.style.visibility = 'hidden';
      return;
    }
    var barH = bar.offsetHeight || 33;
    var top = r.bottom + 4;                 // желаем: сразу под панелью рта
    var maxTop = vh - barH - 8;             // но не ниже низа экрана
    var minTop = Math.max(r.top + 4, 8);    // и не выше начала панели рта
    if (top > maxTop) top = Math.max(maxTop, minTop);
    if (top < minTop) top = minTop;
    bar.style.left = Math.round(r.left) + 'px';
    bar.style.top = Math.round(top) + 'px';
    bar.style.visibility = 'visible';
  }

  // --------------------------------------------------------------- init

  function init(vue) {
    vm = vue;

    patchSelectAll();

    // реактивность: подписка на состав списка (id по порядку)
    vm.$watch(function () { return vm.item.list.map(function (i) { return i.id; }).join(','); },
      onListChange, { immediate: true });

    // панель смешивания: трекинг позиции (компакт/нюх/ре-рендеры) + скролл/ресайз
    mountMixBar();
    setInterval(mountMixBar, 1000);
    window.addEventListener('scroll', function () {
      var bar = document.getElementById('cwb-mt-mixbar');
      if (bar) positionMixBar(bar);
    }, true); // capture: скроллится не window, а внутренние блоки
    window.addEventListener('resize', function () {
      var bar = document.getElementById('cwb-mt-mixbar');
      if (bar) positionMixBar(bar);
    });
  }
})();
