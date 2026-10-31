/* =============================================================
 * core/ui.js — Componentes de interfaz reutilizables.
 *
 * Regla del juego: todos los botones llevan icono + texto.
 *   const { h, btn, modal } = DK.ui;
 *   h('div', {class:'card'}, 'Hola')           → crea elementos
 *   btn({icon:'check', label:'Aceptar', onClick})
 *   modal({title, content, actions})           → ventana emergente
 * ============================================================= */
(function () {
  const t = (k, v) => DK.t(k, v);

  /**
   * Crea un elemento HTML.
   * @param {string} tag    etiqueta ('div', 'button'...)
   * @param {Object} props  atributos: class, style (objeto), onClick, dataset, tip, html...
   * @param {...*} children hijos: nodos, textos o arrays (null/false se ignoran)
   */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
        } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'tip') el.dataset.tip = v;
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  }

  /** Añade hijos a un elemento (acepta arrays anidados). */
  function append(el, children) {
    for (const ch of children.flat(Infinity)) {
      if (ch == null || ch === false) continue;
      el.append(ch instanceof Node ? ch : document.createTextNode(String(ch)));
    }
    return el;
  }

  /**
   * Botón con icono + texto.
   * @param {Object} o
   * @param {string} o.icon     icono
   * @param {string} o.label    texto principal
   * @param {string} [o.desc]   texto secundario (visible en size:'lg')
   * @param {Function} o.onClick
   * @param {string} [o.variant] '' | 'primary' | 'ghost' | 'danger' | 'tone'
   * @param {string} [o.size]    '' | 'sm' | 'lg'
   * @param {string} [o.hotkey]  tecla que se muestra como pista (no la registra)
   * @param {string} [o.tip]     texto de ayuda al pasar el ratón
   * @param {boolean} [o.silent] no reproducir sonido al pulsar
   */
  function btn({ icon, label, desc, onClick, variant = '', size = '', disabled = false, title, cls = '', type = 'button', hotkey, tip, silent } = {}) {
    const b = h('button', {
      class: ['btn', variant && 'btn-' + variant, size && 'btn-' + size, cls].filter(Boolean).join(' '),
      type, disabled: !!disabled, 'aria-label': title || label, tip: tip || null,
    },
      icon ? DK.icon(icon, size === 'sm' ? 16 : size === 'lg' ? 22 : 18) : null,
      label || desc ? h('span', { class: 'btn-text' },
        label ? h('span', { class: 'btn-label' }, label) : null,
        desc && size === 'lg' ? h('span', { class: 'btn-desc' }, desc) : null) : null,
      hotkey ? h('kbd', { class: 'hotkey' }, hotkey) : null);
    b.addEventListener('click', (e) => {
      if (b.disabled) return;
      if (!silent && DK.audio) DK.audio.sfx('click');
      if (onClick) onClick(e);
    });
    return b;
  }

  /** Tarjeta grande de menú (icono + título + descripción + insignia). */
  function tile({ icon, label, desc, onClick, disabled, badge, accent, locked, hotkey }) {
    const el = h('button', { class: 'tile' + (locked ? ' locked' : ''), type: 'button', disabled: !!disabled, style: accent ? { '--accent': accent } : null },
      h('span', { class: 'tile-icon' }, DK.icon(locked ? 'lock' : icon, 26)),
      h('span', { class: 'tile-text' }, h('span', { class: 'tile-label' }, label), desc ? h('span', { class: 'tile-desc' }, desc) : null),
      badge != null && badge !== '' ? h('span', { class: 'tile-badge' }, badge) : null,
      hotkey ? h('kbd', { class: 'hotkey' }, hotkey) : null,
      h('span', { class: 'tile-arrow' }, DK.icon('next', 18)));
    el.addEventListener('click', (e) => { if (!el.disabled) { DK.audio && DK.audio.sfx('select'); onClick && onClick(e); } });
    return el;
  }

  /**
   * Barra de progreso (vida, maná, experiencia).
   * Métodos del elemento devuelto:
   *   el.update(valor, maximo)
   *   el.preview(desde, hasta) → marca un tramo (daño previsto); preview(null) lo quita
   */
  function bar({ value = 0, max = 1, kind = 'hp', text = true, label, icon } = {}) {
    const fill = h('div', { class: 'bar-fill' });
    const prev = h('div', { class: 'bar-preview' });
    const txt = h('span', { class: 'bar-text' });
    const el = h('div', { class: `bar bar-${kind}`, tip: label || null },
      icon ? h('span', { class: 'bar-icon' }, DK.icon(icon, 13)) : null,
      h('div', { class: 'bar-track' }, fill, prev),
      text ? txt : null);
    let lastMax = max;
    el.update = (v, m) => {
      lastMax = m;
      const pct = m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
      fill.style.width = pct + '%';
      if (kind === 'hp') { el.classList.toggle('low', pct < 25); el.classList.toggle('mid', pct >= 25 && pct < 50); }
      txt.textContent = kind === 'exp' ? `${Math.floor(v)}/${m}` : `${Math.max(0, Math.round(v))}/${m}`;
    };
    el.preview = (from, to) => {
      if (from == null) { prev.style.width = '0'; return; }
      const a = Math.max(0, Math.min(from, to)), b = Math.max(from, to);
      prev.style.left = (a / lastMax) * 100 + '%';
      prev.style.width = ((b - a) / lastMax) * 100 + '%';
    };
    el.update(value, max);
    return el;
  }

  /**
   * Ventana modal.
   * @param {Object} o
   * @param {string} o.title
   * @param {string} [o.icon]
   * @param {Node|Function} o.content  nodo o función (close) => nodo
   * @param {Array} [o.actions]        [{label, icon, variant, value, onClick(close)}]
   * @param {boolean} [o.dismissable]  se cierra con Esc / clic fuera
   * @param {string} [o.size]          '' | 'wide' | 'full'
   * @returns {{close, promise, el, body}} promise se resuelve con el valor de cierre
   */
  const openModals = new Set();
  /**
   * En el móvil las ventanas y paneles son hojas que suben desde abajo:
   * se pueden cerrar deslizándolas hacia abajo desde el asa o la cabecera.
   */
  const isSheet = () => window.matchMedia('(max-width: 600px)').matches;
  function swipeToClose(panel, handles, close) {
    handles.filter(Boolean).forEach((hd) => hd.addEventListener('pointerdown', (e) => {
      if (!isSheet() || e.pointerType === 'mouse' || e.target.closest('button, input')) return;
      const sy = e.clientY; let dy = 0;
      panel.style.transition = 'none';
      const mv = (ev) => { dy = Math.max(0, ev.clientY - sy); panel.style.transform = `translateY(${dy}px)`; };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        panel.style.transition = '';
        if (dy > 90) close(null); else panel.style.transform = '';
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }));
  }

  function modal({ title, icon, content, actions = [], dismissable = true, size = '', cls = '' }) {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    const backdrop = h('div', { class: 'modal-backdrop' });
    let closed = false;
    DK.keys.push();
    const close = (val) => {
      if (closed) return; closed = true;
      openModals.delete(close);
      backdrop.classList.add('closing');
      DK.keys.pop();
      setTimeout(() => backdrop.remove(), 160);
      resolve(val);
    };
    if (dismissable) DK.keys.on('Escape', () => close(null));
    const body = h('div', { class: 'modal-body' }, typeof content === 'function' ? content(close) : content);
    const foot = actions.length
      ? h('div', { class: 'modal-actions' }, actions.map((a) => btn({ ...a, onClick: () => (a.onClick ? a.onClick(close) : close(a.value)) })))
      : null;
    const grab = dismissable ? h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }) : null;
    const head = title ? h('div', { class: 'modal-head' }, icon ? DK.icon(icon, 22) : null, h('h3', null, title)) : null;
    const box = h('div', { class: `modal ${size ? 'modal-' + size : ''} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
      grab, head, body, foot);
    if (dismissable) swipeToClose(box, [grab, head], close);
    backdrop.append(box);
    if (dismissable) backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(null); });
    document.body.append(backdrop);
    openModals.add(close);
    setTimeout(() => { const f = box.querySelector('input, .modal-actions .btn-primary'); if (f) f.focus(); }, 30);
    return { close, promise, el: box, body };
  }

  /** Cierra todos los modales y paneles abiertos (lo usa el router al cambiar de pantalla). */
  function closeAll() { [...openModals].forEach((c) => c(null)); }

  /**
   * Panel lateral deslizante (ajustes, ayuda, estadísticas de combate...).
   * A diferencia de un modal, no saca al jugador de lo que está haciendo.
   * @param {Object} o
   * @param {string} [o.id]       identificador: abrir dos veces el mismo id lo cierra (alternar)
   * @param {string} o.title
   * @param {string} [o.icon]
   * @param {Node|Function} o.content  nodo o (close) => nodo
   * @param {Array} [o.actions]   botones del pie (igual que en modal)
   * @param {boolean} [o.modal]   true (por defecto): oscurece el fondo y captura el teclado.
   *                              false: deja usar la pantalla de detrás
   * @param {string} [o.size]     '' | 'wide'
   * @returns {{close, promise, el, body}}
   */
  const openDrawers = {};
  function drawer({ id, title, icon, content, actions = [], modal: isModal = true, size = '', cls = '' }) {
    if (id && openDrawers[id]) { openDrawers[id](null); return null; }
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    let closed = false;
    const wrap = h('div', { class: `drawer-wrap ${isModal ? 'is-modal' : 'is-free'}` });
    const close = (val) => {
      if (closed) return; closed = true;
      openModals.delete(close);
      if (id) delete openDrawers[id];
      wrap.classList.add('closing');
      if (isModal) DK.keys.pop();
      setTimeout(() => wrap.remove(), 220);
      resolve(val);
    };
    if (isModal) { DK.keys.push(); DK.keys.on('Escape', () => close(null)); }
    const body = h('div', { class: 'drawer-body' }, typeof content === 'function' ? content(close) : content);
    const foot = actions.length ? h('div', { class: 'drawer-actions' }, actions.map((a) => btn({ ...a, onClick: () => (a.onClick ? a.onClick(close) : close(a.value)) }))) : null;
    const grab = h('div', { class: 'sheet-grab', 'aria-hidden': 'true' });
    const head = h('div', { class: 'drawer-head' }, icon ? DK.icon(icon, 22) : null, h('h3', null, title || ''),
      btn({ icon: 'x', label: t('common.close'), variant: 'ghost', size: 'sm', hotkey: isModal ? 'Esc' : null, onClick: () => close(null) }));
    const panel = h('aside', { class: `drawer ${size ? 'drawer-' + size : ''} ${cls}`, role: isModal ? 'dialog' : 'complementary', 'aria-label': title || '' },
      grab, head, body, foot);
    swipeToClose(panel, [grab, head], close);
    if (isModal) wrap.append(h('div', { class: 'drawer-backdrop', onMousedown: () => close(null) }));
    wrap.append(panel);
    document.body.append(wrap);
    openModals.add(close);
    if (id) openDrawers[id] = close;
    return { close, promise, el: panel, body };
  }

  /**
   * Menú contextual flotante (clic derecho o pulsación larga).
   * @param {{x:number, y:number}} pos  coordenadas de pantalla
   * @param {Array} items  [{icon, label, onClick, disabled, danger}] (null = separador)
   */
  let ctxMenu = null;
  function contextMenu(pos, items) {
    closeContextMenu();
    const list = h('div', { class: 'ctx-menu', role: 'menu' }, items.map((it) => it
      ? h('button', { class: 'ctx-item' + (it.danger ? ' danger' : ''), type: 'button', role: 'menuitem', disabled: !!it.disabled,
        onClick: () => { closeContextMenu(); DK.audio && DK.audio.sfx('click'); it.onClick(); } }, DK.icon(it.icon, 16), h('span', null, it.label))
      : h('div', { class: 'ctx-sep' })));
    document.body.append(list);
    const r = list.getBoundingClientRect();
    list.style.left = Math.min(pos.x, window.innerWidth - r.width - 8) + 'px';
    list.style.top = Math.min(pos.y, window.innerHeight - r.height - 8) + 'px';
    ctxMenu = list;
    DK.keys.push();
    DK.keys.on('Escape', closeContextMenu);
    setTimeout(() => { const f = list.querySelector('.ctx-item'); if (f) f.focus(); }, 10);
  }
  function closeContextMenu() { if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; DK.keys.pop(); } }
  document.addEventListener('mousedown', (e) => { if (ctxMenu && !ctxMenu.contains(e.target)) closeContextMenu(); });
  window.addEventListener('scroll', () => closeContextMenu(), true);

  /**
   * Conecta un menú contextual a un elemento (clic derecho y pulsación larga).
   * @param {HTMLElement} el
   * @param {Function} getItems  () => items (se calculan al abrir)
   */
  function attachContextMenu(el, getItems) {
    el.dataset.ctx = '1';
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (el.dataset.dragging) return; contextMenu({ x: e.clientX, y: e.clientY }, getItems()); });
    let timer;
    el.addEventListener('touchstart', (e) => {
      const tch = e.touches[0];
      timer = setTimeout(() => { if (el.dataset.dragging) return; el.dataset.longpress = '1'; contextMenu({ x: tch.clientX, y: tch.clientY }, getItems()); }, 550);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => el.addEventListener(ev, () => clearTimeout(timer), { passive: true }));
    // Evita que el clic tras una pulsación larga abra además la ficha
    el.addEventListener('click', (e) => { if (el.dataset.longpress) { e.stopImmediatePropagation(); e.preventDefault(); delete el.dataset.longpress; } }, true);
  }

  /** ¿Pantalla estrecha (móvil / tablet vertical)? */
  const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

  /** Pregunta Sí/No. Devuelve promesa con true/false. */
  function confirm(title, text, { okLabel = t('common.accept'), okIcon = 'check', cancelLabel = t('common.cancel'), danger = false, icon = 'info' } = {}) {
    return modal({
      title, icon,
      content: h('p', { class: 'muted' }, text),
      actions: [
        { label: cancelLabel, icon: 'x', variant: 'ghost', value: false },
        { label: okLabel, icon: okIcon, variant: danger ? 'danger' : 'primary', value: true },
      ],
    }).promise.then((v) => !!v);
  }

  /** Pide un texto al usuario. Devuelve promesa con el texto o null. */
  function prompt(title, { value = '', placeholder = '', maxlength = 16, okLabel = t('common.accept'), icon = 'edit' } = {}) {
    const input = h('input', { class: 'input', type: 'text', value, placeholder, maxlength });
    const m = modal({
      title, icon, content: input,
      actions: [
        { label: t('common.cancel'), icon: 'x', variant: 'ghost', value: null },
        { label: okLabel, icon: 'check', variant: 'primary', onClick: (close) => close(input.value.trim()) },
      ],
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') m.close(input.value.trim()); });
    return m.promise;
  }

  /** Notificación temporal en la parte inferior. kind: '' | 'good' | 'bad' */
  let toastHost;
  /* ---------- Avisos (toasts) agrupados ----------
   * - Como mucho TOAST_MAX avisos a la vez; el resto se resume en
   *   «+N avisos más · Ver» que abre el historial.
   * - Un aviso repetido mientras se ve suma «×2», «×3»... en vez de apilarse.
   * - Todos quedan en DK.ui.notices (historial de la sesión, campana de la barra superior).
   */
  // En el móvil: 1 aviso a la vez, más corto, encima de la barra inferior; se quita tocándolo
  const toastMax = () => (isSheet() ? 1 : 2), toastMs = () => (isSheet() ? 2400 : 3000);
  const notices = [];
  let unread = 0, overflow = 0, moreEl = null, moreTimer = null;
  function hostEl() {
    if (!toastHost) { toastHost = h('div', { class: 'toast-host', 'aria-live': 'polite' }); document.body.append(toastHost); }
    return toastHost;
  }
  /** Programa la salida de un aviso (se reinicia si se repite). */
  function schedule(el) {
    clearTimeout(el._t1); clearTimeout(el._t2);
    el._t1 = setTimeout(() => el.classList.add('out'), toastMs());
    el._t2 = setTimeout(() => { el.remove(); }, toastMs() + 400);
  }
  function showMore() {
    const host = hostEl();
    if (!moreEl) {
      moreEl = h('button', { class: 'toast toast-more', type: 'button', onClick: () => { openNotices(); } });
      host.append(moreEl);
    }
    moreEl.replaceChildren(DK.icon('bell', 16), h('span', null, t('notices.more', { n: overflow })), h('b', null, t('notices.view')));
    clearTimeout(moreTimer);
    moreTimer = setTimeout(() => { if (moreEl) { moreEl.remove(); moreEl = null; } overflow = 0; }, toastMs() + 1500);
  }
  /**
   * Muestra un aviso breve.
   * @param {string} text
   * @param {Object} [o] {icon, kind: ''|'good'|'bad'}
   */
  function toast(text, { icon = 'info', kind = '' } = {}) {
    if (notices[0] && notices[0].text === text) { notices[0].n = (notices[0].n || 1) + 1; notices[0].at = Date.now(); }
    else notices.unshift({ text, icon, kind, at: Date.now() });
    if (notices.length > 60) notices.length = 60;
    unread++;
    DK.emit && DK.emit('notices:changed', { unread });
    if (openDrawers.notices) { refreshNotices(); }
    const host = hostEl();
    const live = [...host.querySelectorAll('.toast:not(.out):not(.toast-more)')];
    const same = live.find((el) => el.dataset.text === text);
    if (same) {
      same._n = (same._n || 1) + 1;
      let c = same.querySelector('.toast-count');
      if (!c) { c = h('span', { class: 'toast-count' }); same.append(c); }
      c.textContent = '×' + same._n;
      same.classList.remove('bump'); void same.offsetWidth; same.classList.add('bump');
      schedule(same);
      return;
    }
    if (live.length >= toastMax()) { overflow++; showMore(); return; }
    const el = h('div', { class: 'toast ' + kind, dataset: { text }, role: 'status', onClick: () => { clearTimeout(el._t1); el.classList.add('out'); setTimeout(() => el.remove(), 300); } },
      DK.icon(icon, 18), h('span', { class: 'grow' }, text));
    if (moreEl) host.insertBefore(el, moreEl); else host.append(el);
    schedule(el);
  }

  /** Historial de avisos en un panel lateral. */
  let noticesBody = null;
  function noticeList() {
    const ago = (ts) => { const s = (Date.now() - ts) / 1000; return s < 60 ? t('profile.agoNow') : s < 3600 ? t('profile.agoMin', { n: Math.floor(s / 60) }) : t('profile.agoHour', { n: Math.floor(s / 3600) }); };
    return notices.length
      ? h('div', { class: 'notice-list' }, notices.map((n) => h('div', { class: 'notice ' + n.kind }, DK.icon(n.icon, 18), h('span', { class: 'grow' }, n.text), n.n > 1 ? h('span', { class: 'toast-count' }, '×' + n.n) : null, h('span', { class: 'muted small nowrap' }, ago(n.at)))))
      : empty('bell', t('notices.empty'), t('notices.emptyText'));
  }
  function refreshNotices() { if (noticesBody) noticesBody.replaceChildren(noticeList()); }
  function openNotices() {
    if (moreEl) { moreEl.remove(); moreEl = null; overflow = 0; }
    unread = 0; DK.emit && DK.emit('notices:changed', { unread });
    if (openDrawers.notices) return;
    noticesBody = h('div');
    refreshNotices();
    const d = drawer({ id: 'notices', title: t('notices.title'), icon: 'bell', content: noticesBody,
      actions: [{ label: t('notices.clear'), icon: 'trash', variant: 'ghost', onClick: () => { notices.length = 0; refreshNotices(); } }, { label: t('common.close'), icon: 'x', variant: 'primary' }] });
    if (d) d.promise.then(() => { noticesBody = null; });
  }

  /**
   * Pestañas.
   * @param {Object} o
   * @param {Array} o.items   [{id, label, icon, count, render() → Node}]
   * @param {string} [o.active] pestaña inicial
   * @param {Function} [o.onChange] (id) => void
   */
  function tabs({ items, active, onChange, cls = '' }) {
    const barEl = h('div', { class: 'tabs', role: 'tablist' });
    const panel = h('div', { class: 'tab-panel', role: 'tabpanel' });
    let cur = items.find((i) => i.id === active) ? active : items[0] && items[0].id;
    function show(id) {
      cur = id;
      barEl.querySelectorAll('.tab').forEach((x) => { const on = x.dataset.id === id; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); });
      const it = items.find((i) => i.id === id);
      panel.replaceChildren(it ? it.render() : '');
      onChange && onChange(id);
    }
    items.forEach((it) =>
      barEl.append(h('button', { class: 'tab', type: 'button', role: 'tab', dataset: { id: it.id }, onClick: () => { DK.audio && DK.audio.sfx('click'); show(it.id); } },
        it.icon ? DK.icon(it.icon, 16) : null, h('span', null, it.label),
        it.count != null && it.count !== '' ? h('span', { class: 'tab-count' }, it.count) : null)));
    const el = h('div', { class: 'tabs-wrap ' + cls }, barEl, panel);
    if (cur) show(cur);
    el.show = show;
    return el;
  }

  /** Mensaje de "no hay nada". */
  function empty(icon, title, text, action) {
    return h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, DK.icon(icon, 34)), h('h4', null, title), text ? h('p', { class: 'muted' }, text) : null, action || null);
  }

  /** Interruptor on/off con etiqueta. onChange(valor). */
  function toggle({ label, icon, value, onChange, desc }) {
    const input = h('input', { type: 'checkbox', class: 'switch-input' });
    input.checked = !!value;
    input.addEventListener('change', () => { DK.audio && DK.audio.sfx('click'); onChange(input.checked); });
    return h('label', { class: 'setting-row' },
      icon ? DK.icon(icon, 18) : null,
      h('span', { class: 'setting-text' }, h('b', null, label), desc ? h('span', { class: 'muted small' }, desc) : null),
      input, h('span', { class: 'switch', 'aria-hidden': 'true' }));
  }

  /** Deslizador 0-1 con etiqueta. onChange(valor). */
  function slider({ label, icon, value, onChange, min = 0, max = 1, step = 0.05 }) {
    const out = h('span', { class: 'slider-val' }, Math.round(value * 100) + '%');
    const input = h('input', { type: 'range', class: 'slider', min, max, step, value });
    input.addEventListener('input', () => { out.textContent = Math.round(input.value * 100) + '%'; onChange(parseFloat(input.value)); });
    return h('label', { class: 'setting-row' }, icon ? DK.icon(icon, 18) : null, h('span', { class: 'setting-text' }, h('b', null, label)), input, out);
  }

  /**
   * Selector segmentado (botones excluyentes).
   * options: [{value, label, icon}]
   */
  function segmented({ options, value, onChange, size = 'sm' }) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup' });
    const draw = () => wrap.replaceChildren(...options.map((o) => btn({
      icon: o.icon, label: o.label, size, variant: o.value === value ? 'primary' : 'ghost', tip: o.tip,
      onClick: () => { value = o.value; draw(); onChange(o.value); },
    })));
    draw();
    return wrap;
  }

  /** Desplegable nativo. options: [{value, label}] */
  function select({ options, value, onChange, label }) {
    const s = h('select', { class: 'select', 'aria-label': label || '' }, options.map((o) => h('option', { value: o.value }, o.label)));
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  /* ---------------- Tooltips ----------------
   * Cualquier elemento con data-tip="texto" (o prop `tip` en h())
   * muestra una burbuja al pasar el ratón, al enfocarlo o al
   * mantener pulsado en pantallas táctiles.
   */
  let tipEl, tipTimer;
  function showTip(target, touch = false) {
    const text = target.dataset.tip;
    if (!text) return;
    if (!tipEl) { tipEl = h('div', { class: 'tooltip', role: 'tooltip' }); document.body.append(tipEl); }
    tipEl.textContent = text;
    tipEl.classList.toggle('touch', touch);
    tipEl.classList.add('show');
    const r = target.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 6) y = r.bottom + 8;
    x = Math.max(6, Math.min(window.innerWidth - tw - 6, x));
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); if (tipEl) tipEl.classList.remove('show'); }
  let lastTouch = 0;
  document.addEventListener('mouseover', (e) => {
    if (Date.now() - lastTouch < 1500) return; // ratón simulado tras un toque
    const tgt = e.target.closest && e.target.closest('[data-tip]');
    clearTimeout(tipTimer);
    if (tgt) tipTimer = setTimeout(() => showTip(tgt), 350); else hideTip();
  });
  document.addEventListener('focusin', (e) => { if (Date.now() - lastTouch < 1500) return; const tgt = e.target.closest && e.target.closest('[data-tip]'); if (tgt) showTip(tgt); });
  document.addEventListener('focusout', () => { if (Date.now() - lastTouch > 1500) hideTip(); });
  /*
   * Pantallas táctiles:
   *  - tocar algo que no es un botón (un atributo, una etiqueta…) muestra su explicación;
   *  - mantener pulsado un botón muestra su explicación sin pulsarlo;
   *  - la burbuja se queda hasta el siguiente toque.
   * Dentro de las fichas con menú contextual (pulsación larga) no se usa.
   */
  const INTERACTIVE = 'button, a, input, select, textarea, label, [role=button], .clickable, [data-drag]';
  let touchTip = null, touchXY = null, longTipped = null;
  document.addEventListener('touchstart', (e) => {
    lastTouch = Date.now();
    const tgt = e.target.closest && e.target.closest('[data-tip]');
    clearTimeout(tipTimer);
    if (tipEl && tipEl.classList.contains('show') && (!tgt || tgt !== touchTip)) { hideTip(); touchTip = null; }
    if (!tgt || tgt.closest('[data-ctx]')) return;
    const tch = e.touches[0]; touchXY = [tch.clientX, tch.clientY]; longTipped = null;
    if (tgt.closest(INTERACTIVE)) tipTimer = setTimeout(() => { longTipped = tgt; touchTip = tgt; showTip(tgt, true); DK.vibrate && DK.vibrate(15); }, 450);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!touchXY) return; const tch = e.touches[0];
    if (Math.hypot(tch.clientX - touchXY[0], tch.clientY - touchXY[1]) > 10) { clearTimeout(tipTimer); touchXY = null; }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    clearTimeout(tipTimer);
    const tgt = e.target.closest && e.target.closest('[data-tip]');
    if (longTipped) {
      // Tras una pulsación larga no se pulsa el botón
      const el = longTipped; longTipped = null;
      const stop = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
      el.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 400);
      return;
    }
    if (touchXY && tgt && !tgt.closest(INTERACTIVE) && !tgt.closest('[data-ctx]')) {
      if (touchTip === tgt && tipEl && tipEl.classList.contains('show')) { hideTip(); touchTip = null; } else { touchTip = tgt; showTip(tgt, true); }
    }
    touchXY = null;
  });
  // Evita el menú del sistema al mantener pulsado un botón con explicación
  document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-tip]') && !e.target.closest('[data-ctx]') && matchMedia('(hover: none)').matches) e.preventDefault(); });
  window.addEventListener('scroll', hideTip, true);

  /* ---------------- Arrastrar (ratón, lápiz y dedo) ----------------
   * Arrastre propio con eventos de puntero (más fiable que el arrastre
   * HTML5, que no funciona con <button> en algunos navegadores).
   *   pointerDrag(el, { zones: '.selector', onDrop: (zona, evento) => {}, touch: true })
   * Con el dedo (touch: true) hay que mantener pulsado un momento antes de
   * mover, para no confundirlo con desplazar la pantalla.
   * Tras soltar se anula el clic, para no contar dos veces.
   */
  function pointerDrag(el, { zones, onDrop, touch = false, holdMs = 260 }) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const isTouch = e.pointerType === 'touch';
      if (isTouch && !touch) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost = null, over = null, armed = !isTouch, holdT = null;
      const zoneAt = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.closest(zones); };
      // Con el dedo: una vez «agarrado» se bloquea el desplazamiento de la página
      const blockScroll = (te) => { if (armed && te.cancelable) te.preventDefault(); };
      if (isTouch) {
        holdT = setTimeout(() => { armed = true; el.classList.add('drag-armed'); if (DK.vibrate) DK.vibrate(15); }, holdMs);
        window.addEventListener('touchmove', blockScroll, { passive: false });
      }
      const cleanup = () => {
        clearTimeout(holdT);
        window.removeEventListener('pointermove', moveFn); window.removeEventListener('pointerup', upFn); window.removeEventListener('pointercancel', cancelFn);
        window.removeEventListener('touchmove', blockScroll, { passive: false });
        el.classList.remove('drag-armed');
        setTimeout(() => delete el.dataset.dragging, 50);
      };
      const moveFn = (ev) => {
        const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
        if (!armed) { if (dist > 8) cleanup(); return; } // se movió antes de agarrar: es desplazar
        if (!ghost && dist < 6) return;
        if (!ghost) {
          const r = el.getBoundingClientRect();
          ghost = el.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.classList.remove('drag-armed');
          Object.assign(ghost.style, { position: 'fixed', width: r.width + 'px', height: r.height + 'px', left: 0, top: 0, pointerEvents: 'none', zIndex: 500 });
          document.body.append(ghost); el.classList.add('dragging'); document.body.classList.add('is-dragging'); hideTip();
          el.dataset.dragging = '1'; closeContextMenu();
        }
        ghost.style.transform = `translate(${ev.clientX - ghost.offsetWidth / 2}px, ${ev.clientY - ghost.offsetHeight / 2}px) rotate(-4deg)`;
        const z = zoneAt(ev.clientX, ev.clientY);
        if (z !== over) { if (over) over.classList.remove('drop-over'); over = z; if (over) over.classList.add('drop-over'); }
      };
      const finish = (ev, drop) => {
        cleanup();
        if (!ghost) return;
        ghost.remove(); el.classList.remove('dragging'); document.body.classList.remove('is-dragging');
        if (over) over.classList.remove('drop-over');
        // Anula el clic que el navegador lanza al soltar
        const stop = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
        el.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 50);
        const z = drop && zoneAt(ev.clientX, ev.clientY);
        if (z) onDrop(z, ev);
      };
      const upFn = (ev) => finish(ev, true);
      const cancelFn = (ev) => finish(ev, false);
      window.addEventListener('pointermove', moveFn); window.addEventListener('pointerup', upFn); window.addEventListener('pointercancel', cancelFn);
    });
    return el;
  }

  DK.ui = { h, append, btn, tile, bar, modal, drawer, openNotices, notices, unreadNotices: () => unread, contextMenu, attachContextMenu, closeContextMenu, isNarrow, closeAll, confirm, prompt, toast, tabs, empty, toggle, slider, segmented, select, hideTip, pointerDrag };
})();
