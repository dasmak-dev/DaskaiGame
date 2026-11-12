/* =============================================================
 * admin/admin.js — Panel de administración (admin.html, v5.40).
 *
 * Seguridad: todo lo que hace pasa por funciones admin_* de Supabase que comprueban,
 * en el servidor, que la sesión (Supabase Auth) es de un usuario de public.admins.
 * Esta página no guarda ninguna clave secreta: sólo la URL y la clave pública del juego.
 *
 * Secciones: Resumen · Jugadores (y su ficha) · Soporte (chat) · Denuncias · Sospechosos ·
 * Clasificaciones · Noticias · Regalos · Registro · Ajustes.
 * ============================================================= */
(function () {
  'use strict';
  const root = document.getElementById('adm');
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } } };
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* */ } }, del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* */ } } };

  /* ---------------- Mini DOM ---------------- */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else n.append(c instanceof Node ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return n;
  }
  const $ = (sel, r = document) => r.querySelector(sel);
  /** Como replaceChildren, pero sin pintar «null» cuando un hijo es opcional (v5.41.2). */
  const put = (n, ...k) => n.replaceChildren(...k.flat(9).filter((x) => x != null && x !== false));
  const fmtN = (n) => Number(n || 0).toLocaleString('es');
  const fmtD = (d) => (d ? new Date(d).toLocaleString('es', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const ago = (d) => { if (!d) return '—'; const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  const hrs = (s) => `${Math.floor((s || 0) / 3600)} h ${Math.floor(((s || 0) % 3600) / 60)} min`;
  const icon = (name, size = 16) => { try { return window.DK && DK.icon ? DK.icon(name, size) : el('span'); } catch (e) { return el('span'); } };
  const btn = (label, onClick, cls = '', ic) => el('button', { class: 'ab ' + cls, type: 'button', onClick }, ic ? icon(ic, 14) : null, label);
  function toast(msg, bad) { const t = el('div', { class: 'at' + (bad ? ' bad' : '') }, msg); document.body.append(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200); }
  function modal(title, content, actions) {
    return new Promise((resolve) => {
      const close = (v) => { bg.remove(); resolve(v); };
      const bg = el('div', { class: 'adm-mbg', onClick: (e) => { if (e.target === bg) close(null); } },
        el('div', { class: 'adm-m' }, el('div', { class: 'adm-mh' }, el('b', null, title), btn('×', () => close(null), 'ghost')),
          el('div', { class: 'adm-mbd' }, typeof content === 'function' ? content(close) : content),
          actions ? el('div', { class: 'adm-mf' }, actions.map((a) => btn(a.label, () => close(a.value !== undefined ? a.value : a.run ? a.run() : true), a.cls || ''))) : null));
      document.body.append(bg);
      const f = bg.querySelector('input,textarea'); if (f) f.focus();
    });
  }
  async function ask(title, label, value = '', opts = {}) {
    const inp = opts.area ? el('textarea', { class: 'ai', rows: 4 }) : el('input', { class: 'ai', type: opts.type || 'text' }); inp.value = value;
    const r = await modal(title, el('label', { class: 'af' }, el('span', null, label), inp, opts.help ? el('small', { class: 'muted' }, opts.help) : null),
      [{ label: 'Cancelar', value: null, cls: 'ghost' }, { label: opts.ok || 'Aceptar', cls: opts.danger ? 'danger' : 'primary', run: () => inp.value }]);
    return r;
  }
  const confirmBox = (title, text, ok = 'Sí', danger = true) => modal(title, el('p', null, text), [{ label: 'Cancelar', value: false, cls: 'ghost' }, { label: ok, value: true, cls: danger ? 'danger' : 'primary' }]);

  /* ---------------- Datos del juego (para dibujar) ---------------- */
  const G = { ok: false };
  async function loadGame() {
    try {
      const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const adminCss = $('link[href="css/admin.css"]');
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => { const n = el('link', { rel: 'stylesheet', href: l.getAttribute('href') }); document.head.insertBefore(n, adminCss); });
      const srcs = [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => !/main\.js$/.test(s));
      for (const src of srcs) await new Promise((res) => { const s = el('script', { src }); s.onload = res; s.onerror = res; document.body.append(s); });
      G.ok = !!(window.DK && DK.data && DK.data.species && DK.views && DK.views.buildView);
      try { DK.i18n.setLang('es'); } catch (e) { /* */ }
    } catch (e) { G.ok = false; }
    // v5.41.1: sin el juego (p. ej. abriendo admin.html desde el disco, file://) al menos la conexión: dk.js + config.js
    if (!(window.DK && DK.config && DK.config.online)) {
      for (const src of ['js/core/dk.js', 'js/data/config.js']) await new Promise((res) => { const s = el('script', { src }); s.onload = res; s.onerror = res; document.body.append(s); });
    }
  }
  const isFile = location.protocol === 'file:';
  const D = () => (window.DK && DK.data) || {};
  const spName = (s) => (D().species && D().species[s] ? D().species[s].name : s);
  const itemName = (id) => { const it = D().items && D().items[id]; if (!it) return id; try { return DK.tr('items', it); } catch (e) { return it.name || id; } };
  function sprite(species, shiny, size = 40) {
    if (!G.ok || !D().species[species]) return el('span', { class: 'asp-ph' }, (species || '?').slice(0, 2));
    try { return DK.views.sprite(species, { shiny: !!shiny, size }); } catch (e) { return el('span', { class: 'asp-ph' }, species.slice(0, 2)); }
  }
  function buildView(b) {
    if (G.ok) { try { return DK.views.buildView(b); } catch (e) { /* texto */ } }
    const team = (b && b.team) || b || [];
    return el('ul', null, team.map((x) => el('li', null, `${x.n || spName(x.s)} · ${spName(x.s)} Nv. ${x.l}${x.sh ? ' ★' : ''}`)));
  }
  function itemIcon(id, size = 18) { try { return G.ok && D().items[id] ? DK.views.itemIcon(D().items[id], size) : el('span'); } catch (e) { return el('span'); } }

  let liveTimer = null;
  /* ---------------- Supabase ---------------- */
  const cfg = () => {
    const o = (window.DK && DK.config && DK.config.online) || {};
    // (sólo el origen: https://xxxx.supabase.co, aunque se haya pegado con /rest/v1/ o con espacios)
    const origin = (u) => { try { const x = new URL(String(u || '').trim()); return /^https?:$/.test(x.protocol) ? x.origin : ''; } catch (e) { return ''; } };
    return { url: origin(LS.get('dkadm.url')) || origin(o.supabaseUrl), key: String(LS.get('dkadm.key') || o.supabaseKey || '').trim() };
  };
  const store = () => (LS.get('dkadm.remember') === '1' ? LS : SS);
  let session = null;
  try { session = JSON.parse(LS.get('dkadm.session') || SS.get('dkadm.session') || 'null'); } catch (e) { session = null; }
  const saveSession = (s) => { session = s; LS.del('dkadm.session'); SS.del('dkadm.session'); if (s) store().set('dkadm.session', JSON.stringify(s)); };

  async function auth(path, body) {
    const c = cfg();
    if (!c.url || !c.key) throw new Error('Falta la conexión con Supabase (URL y clave pública): ábrela en «Conexión».');
    let r;
    try { r = await fetch(`${c.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error(`No se pudo conectar con ${c.url}. Revisa tu conexión o que la URL de «Conexión» sea correcta.`); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code = j.error_code || j.code || '';
      if (code === 'invalid_credentials' || /Invalid login/i.test(j.msg || j.error_description || '')) throw new Error('INVALID');
      if (code === 'email_not_confirmed') throw new Error('El usuario existe pero su email no está confirmado: en Supabase → Authentication → Users, ábrelo y pulsa «Confirm email» (o créalo de nuevo con «Auto Confirm User»).');
      if (r.status === 401 || /api key/i.test(j.message || '')) throw new Error('La clave pública no es válida: revisa «Conexión».');
      throw new Error(j.error_description || j.msg || j.message || ('HTTP ' + r.status));
    }
    return j;
  }
  const keep = (j) => saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || (session && session.email) });
  async function refresh() { if (!session || !session.refresh_token) throw new Error('nosession'); keep(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })); }
  async function rpc(name, body, retry = true) {
    const c = cfg();
    if (!session) throw new Error('nosession');
    if (session.expires_at - Date.now() < 60000) await refresh();
    const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    if (r.status === 401 && retry) { await refresh(); return rpc(name, body, false); }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
    if (!r.ok) { const m = (j && (j.message || j.hint)) || ('HTTP ' + r.status); throw new Error(/notadmin/.test(m) ? 'Esta cuenta no es admin.' : m); }
    return j;
  }
  /* ---------------- Imágenes (Supabase Storage, almacén «daskai-media») ---------------- */
  const BUCKET = 'daskai-media';
  /** Reduce la imagen (máx. 1600 px, WebP) para que ocupe poco; los GIF se suben tal cual. */
  async function shrink(file) {
    if (file.type === 'image/gif' || !window.createImageBitmap) return file;
    try {
      const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      if (k === 1 && file.size < 350000) return file;
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.86));
      return blob && blob.size < file.size ? blob : file;
    } catch (e) { return file; }
  }
  async function uploadImage(file) {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Sólo imágenes PNG, JPG, WebP o GIF.');
    const blob = await shrink(file);
    if (blob.size > 5 * 1024 * 1024) throw new Error('La imagen ocupa más de 5 MB.');
    if (session.expires_at - Date.now() < 60000) await refresh();
    const c = cfg(), ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[blob.type] || 'img';
    const path = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const r = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + session.access_token, 'Content-Type': blob.type, 'cache-control': 'max-age=31536000', 'x-upsert': 'false' }, body: blob });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error('No se pudo subir: ' + (j.message || j.error || 'HTTP ' + r.status) + (r.status === 400 || r.status === 403 || r.status === 404 ? ' (¿has ejecutado el SQL de la v5.41?)' : '')); }
    return `${c.url}/storage/v1/object/public/${BUCKET}/${path}`;
  }
  /** Selector de imagen: botón para subir, pegar dirección, vista previa y quitar. node.value() → url o null */
  function imagePicker(init) {
    let url = init || null;
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: { display: 'none' } });
    const prev = el('div', { class: 'aimg-prev' });
    const status = el('small', { class: 'muted' });
    const draw = () => put(prev, url ? el('div', { class: 'aimg-box' }, el('img', { src: url, alt: '' }), el('button', { class: 'ax', type: 'button', title: 'Quitar', onClick: () => { url = null; draw(); } }, '×')) : null);
    const pick = async (f) => { if (!f) return; status.textContent = 'Subiendo…'; try { url = await uploadImage(f); status.textContent = ''; draw(); } catch (e) { status.textContent = ''; toast(e.message, true); } };
    file.addEventListener('change', () => pick(file.files[0]));
    const node = el('div', { class: 'aimg' }, file, el('div', { class: 'arow-c' }, btn('Imagen…', () => file.click(), 'ghost asm', 'image'),
      btn('Pegar dirección', async () => { const u = await ask('Imagen por dirección', 'Dirección https de la imagen', url || ''); if (u !== null) { url = /^https:\/\//.test(u.trim()) ? u.trim() : null; if (u.trim() && !url) toast('Tiene que empezar por https://', true); draw(); } }, 'ghost asm'), status), prev);
    node.addEventListener('paste', (e) => { const it = [...(e.clipboardData || {}).items || []].find((x) => x.type.startsWith('image/')); if (it) { e.preventDefault(); pick(it.getAsFile()); } });
    node.value = () => url; node.pick = pick; node.clear = () => { url = null; draw(); };
    draw();
    return node;
  }
  const imgEl = (u, cls = 'aimg-msg') => (u ? el('a', { class: cls, href: u, target: '_blank', rel: 'noopener noreferrer' }, el('img', { src: u, alt: '', loading: 'lazy' })) : null);

  const API = {
    whoami: () => rpc('admin_whoami'), stats: () => rpc('admin_stats'),
    players: (q, filter, limit, offset) => rpc('admin_players', { p_q: q, p_filter: filter, p_limit: limit, p_offset: offset }),
    player: (tid) => rpc('admin_player', { p_tid: tid }),
    ban: (tid, reason) => rpc('admin_ban', { p_tid: tid, p_reason: reason }), unban: (tid) => rpc('admin_unban', { p_tid: tid }),
    rename: (tid, name, lock) => rpc('admin_rename', { p_tid: tid, p_name: name, p_lock: lock }),
    scores: (board, period, flagged) => rpc('admin_scores', { p_board: board, p_period: period || null, p_flagged: !!flagged, p_limit: 200 }),
    flagged: () => rpc('admin_flagged'), score: (pid, board, period, action) => rpc('admin_score', { p_player: pid, p_board: board, p_period: period, p_action: action }),
    resetScores: (tid) => rpc('admin_reset_scores', { p_tid: tid }), deletePlayer: (tid) => rpc('admin_delete_player', { p_tid: tid }),
    reports: (open) => rpc('admin_reports', { p_open: open }), closeReport: (id, tid) => rpc('admin_report_close', { p_report: id || null, p_tid: tid || null }),
    news: () => rpc('admin_news_list'), newsSave: (n) => rpc('admin_news_save', n.p_img ? n : (({ p_img, ...x }) => x)(n)), // (sin imagen funciona también con la base de datos de la v5.40) newsDelete: (id) => rpc('admin_news_delete', { p_news: id }),
    send: (tid, text, gift, img) => rpc('admin_send', Object.assign({ p_tid: tid, p_text: text, p_gift: gift || null }, img ? { p_img: img } : {})),
    analytics: (d) => rpc('admin_analytics', { p_days: d }), weekly: () => rpc('admin_weekly_reports'), weeklyRun: (cur, email) => rpc('admin_weekly_run', { p_current: !!cur, p_email: !!email }), clans: () => rpc('admin_clans'), clanDelete: (id) => rpc('admin_clan_delete', { p_clan: id }),
    threads: () => rpc('admin_threads'), thread: (tid) => rpc('admin_thread', { p_tid: tid }), dms: (tid) => rpc('admin_dms', { p_tid: tid }), log: () => rpc('admin_log_list', { p_limit: 300 }),
  };

  /* ---------------- Estructura ---------------- */
  const NAV = [['home', 'Resumen', 'chart'], ['players', 'Jugadores', 'users'], ['support', 'Soporte', 'mail'], ['reports', 'Denuncias', 'alert'],
    ['flagged', 'Sospechosos', 'flag'], ['boards', 'Clasificaciones', 'trophy'], ['news', 'Noticias', 'megaphone'], ['gifts', 'Regalos', 'gift'], ['weekly', 'Informes', 'scroll'], ['stats', 'Estadísticas', 'compass'], ['clans', 'Clanes', 'crown'], ['log', 'Registro', 'list'], ['settings', 'Ajustes', 'settings']];
  let badges = {};
  /*
   * v5.42.1: el marco (menú, cabecera y cuerpo) se crea UNA vez; al cambiar de sección o pulsar un botón sólo se
   * cambia el contenido. Mientras llegan los datos se deja lo que había (atenuado) y sale una barrita arriba:
   * nada desaparece ni parpadea.
   */
  const UI = {};
  function frame() {
    if (UI.root && root.contains(UI.root)) return UI;
    UI.nav = el('nav', { class: 'an' });
    UI.title = el('h1');
    UI.bar = el('div', { class: 'ac-bar' });
    UI.body = el('div', { class: 'ac-b' });
    UI.root = el('div', { class: 'aw' }, UI.nav, el('main', { class: 'ac' }, el('header', { class: 'ac-h' }, UI.title, el('span', { class: 'grow' }), btn('Actualizar', () => route(), 'ghost asm', 'refresh'), UI.bar), UI.body));
    put(root, UI.root);
    UI.active = null;
    return UI;
  }
  function drawNav(active) {
    frame();
    put(UI.nav, el('div', { class: 'an-logo' }, icon('shield', 18), el('b', null, 'Daskai'), el('small', null, 'admin')),
      NAV.map(([k, label, ic]) => el('a', { class: 'an-i' + (k === active ? ' on' : ''), href: '#' + k }, icon(ic, 15), el('span', null, label), badges[k] ? el('i', { class: 'an-badge' }, badges[k]) : null)),
      el('div', { class: 'an-foot' }, el('small', null, session && session.email ? session.email : ''), btn('Salir', logout, 'ghost asm', 'exit')));
    UI.active = active;
  }
  /** Pinta una sección ya hecha (sin esperas). */
  function shell(active, title, ...content) {
    frame(); drawNav(active); UI.title.textContent = title;
    put(UI.body, content); UI.view = active + ':' + title;
  }
  let busyN = 0;
  const busy = (on) => { busyN = Math.max(0, busyN + (on ? 1 : -1)); frame(); UI.bar.classList.toggle('on', busyN > 0); };
  /** Trabajo en segundo plano con la barrita (lo de la pantalla se queda). */
  async function working(fn) { busy(true); try { return await fn(); } finally { busy(false); } }
  const loading = () => el('p', { class: 'muted' }, 'Cargando…');
  const fail = (e) => el('p', { class: 'aerr' }, '⚠ ', e && e.message ? e.message : String(e));
  let secSeq = 0;
  /** Sección con datos: se queda lo anterior hasta que llega lo nuevo (si es otra sección y tarda, «Cargando…» a los 400 ms). */
  async function section(active, title, fn) {
    const seq = ++secSeq, key = active + ':' + title;
    frame(); drawNav(active); UI.title.textContent = title;
    const other = UI.view !== key;
    const slow = other ? setTimeout(() => { if (seq === secSeq) put(UI.body, loading()); }, 400) : null;
    busy(true);
    let out;
    try { out = [].concat(await fn()); } catch (e) { out = [fail(e)]; }
    clearTimeout(slow); busy(false);
    if (seq !== secSeq) return; // (ya se ha ido a otra sección)
    put(UI.body, el('div', { class: 'ac-sec' }, out)); UI.view = key;
    drawNav(active);
  }
  const card = (title, ...kids) => el('section', { class: 'acard' }, title ? el('h3', null, title) : null, kids);
  const table = (heads, rows) => el('div', { class: 'atw' }, el('table', { class: 'at-t' }, el('thead', null, el('tr', null, heads.map((x) => el('th', null, x)))), el('tbody', null, rows)));
  const pill = (txt, cls = '') => el('span', { class: 'ap ' + cls }, txt);
  const go = (hash) => { if (location.hash === '#' + hash) route(); else location.hash = hash; };

  /* ---------------- Entrar ---------------- */
  function loginView(msg) {
    const c = cfg();
    const email = el('input', { class: 'ai', type: 'email', autocomplete: 'username', placeholder: 'tu@email.com' });
    const pass = el('input', { class: 'ai', type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña' });
    const rem = el('input', { type: 'checkbox' }); rem.checked = LS.get('dkadm.remember') === '1';
    const url = el('input', { class: 'ai', value: c.url, placeholder: 'https://xxxx.supabase.co' });
    const key = el('input', { class: 'ai', value: c.key, placeholder: 'sb_publishable_…' });
    const out = el('p', { class: 'aerr' }, msg || '');
    const submit = async (e) => {
      e.preventDefault(); out.textContent = '';
      if (url.value.trim() && url.value.trim() !== cfg().url) LS.set('dkadm.url', url.value.trim());
      if (key.value.trim() && key.value.trim() !== cfg().key) LS.set('dkadm.key', key.value.trim());
      LS.set('dkadm.remember', rem.checked ? '1' : '0');
      try { keep(await auth('token?grant_type=password', { email: email.value.trim(), password: pass.value })); const w = await API.whoami(); if (!w || !w.admin) { saveSession(null); out.textContent = 'Has entrado, pero esta cuenta no está en la lista de admins (tabla public.admins).'; return; } route(); }
      catch (err) { out.textContent = err.message === 'INVALID' ? 'Supabase dice que el email o la contraseña no son correctos. Comprueba que el usuario existe en Authentication → Users con ese email exacto; si dudas de la contraseña, bórralo y créalo otra vez (y vuelve a ejecutar el insert en public.admins, porque cambia su id).' : err.message; }
    };
    put(root, el('div', { class: 'alog' }, el('form', { class: 'acard alog-c', onSubmit: submit },
      el('div', { class: 'alog-t' }, icon('shield', 28), el('h1', null, 'Panel de Daskai'), el('small', { class: 'muted' }, 'Sólo para administradores')),
      el('label', { class: 'af' }, el('span', null, 'Email'), email), el('label', { class: 'af' }, el('span', null, 'Contraseña'), pass),
      el('label', { class: 'achk' }, rem, ' Recordarme en este navegador'),
      el('button', { class: 'ab primary abig', type: 'submit' }, 'Entrar'), out,
      el('details', { class: 'muted' }, el('summary', null, 'Conexión'), el('label', { class: 'af' }, el('span', null, 'URL de Supabase'), url), el('label', { class: 'af' }, el('span', null, 'Clave pública'), key),
        el('small', null, 'Normalmente se toman solas de js/data/config.js. La cuenta se crea en Supabase → Authentication → Users y se añade a public.admins.'),
        el('small', { class: 'mono' }, 'Ahora: ' + (cfg().url || '(sin URL)')))),
      isFile ? el('p', { class: 'muted small', style: { maxWidth: '380px', textAlign: 'center' } }, 'Has abierto el panel desde el disco: funciona, pero para ver los dibujos de los daskai ábrelo desde la web del juego (…github.io/…/admin.html).') : null));
  }
  async function logout() { try { await fetch(`${cfg().url}/auth/v1/logout`, { method: 'POST', headers: { apikey: cfg().key, Authorization: 'Bearer ' + (session && session.access_token) } }); } catch (e) { /* */ } saveSession(null); loginView(); }

  /* ---------------- Resumen ---------------- */
  const statBox = (label, value, hash, cls = '') => el(hash ? 'a' : 'div', { class: 'astat ' + cls, href: hash ? '#' + hash : null }, el('small', null, label), el('b', null, fmtN(value)));
  const homeView = () => section('home', 'Resumen', async () => {
    const [s, threads] = await Promise.all([API.stats(), API.threads()]);
    badges = { support: s.support || 0, reports: s.reports || 0, flagged: s.flagged || 0 };
    const max = Math.max(1, ...(s.byDay || []).map((d) => d.n));
    return [
      el('div', { class: 'astats' }, statBox('Jugadores', s.players, 'players'), statBox('Activos 24 h', s.active24), statBox('Activos 7 días', s.active7), statBox('Nuevos 7 días', s.new7),
        statBox('Soporte sin leer', s.support, 'support', s.support ? 'warn' : ''), statBox('Denuncias abiertas', s.reports, 'reports', s.reports ? 'warn' : ''),
        statBox('Récords sospechosos', s.flagged, 'flagged', s.flagged ? 'warn' : ''), statBox('Baneados', s.banned, 'players/banned'), statBox('Noticias activas', s.news, 'news'),
        statBox('Amistades', s.friends), statBox('En buzones', s.inbox)),
      el('p', { class: 'muted' }, `Temporada ${s.season} · Semana ${s.week}`),
      card('Altas de los últimos 14 días', el('div', { class: 'abars' }, (s.byDay || []).map((d) => el('div', { class: 'abar', title: `${d.d}: ${d.n}` }, el('i', { style: { height: Math.max(4, (d.n / max) * 100) + '%' } }), el('small', null, d.d.slice(8)))))),
      card('Últimas conversaciones', threads.length ? threads.slice(0, 6).map((t) => el('a', { class: 'arow', href: '#support/' + t.trainer_id }, el('b', null, t.name || t.trainer_id), el('small', { class: 'muted' }, ' #' + t.trainer_id + ' · ' + ago(t.last_at)), t.unread ? pill(t.unread + ' nuevos', 'warn') : null, el('div', { class: 'muted small ellip' }, t.last))) : el('p', { class: 'muted' }, 'Nadie ha escrito todavía.')),
    ];
  });

  /* ---------------- Jugadores ---------------- */
  const FILTERS = [['recent', 'Activos hace poco'], ['new', 'Nuevos'], ['all', 'Todos'], ['reported', 'Con denuncias'], ['flagged', 'Con récords sospechosos'], ['support', 'Con mensajes sin leer'], ['banned', 'Baneados']];
  function playersView(filter = 'recent') {
    let page = 0;
    const q = el('input', { class: 'ai', type: 'search', placeholder: 'Buscar por nombre o ID…' });
    const sel = el('select', { class: 'ai' }, FILTERS.map(([k, l]) => el('option', { value: k, selected: k === filter }, l)));
    const list = el('div', null, loading());
    const pager = el('div', { class: 'arow-c' });
    const load = async () => {
      list.classList.add('loading');
      try {
        const rows = await API.players(q.value.trim(), sel.value, 50, page * 50);
        list.classList.remove('loading'); put(list, rows.length ? table(['', 'Jugador', 'ID', 'Última vez', 'Jugado', 'Averno', 'Prof.', 'Daskai', 'Estado'], rows.map((p) => {
          const fav = p.fav && p.fav.s;
          return el('tr', { class: 'click', onClick: () => go('player/' + p.trainer_id) }, el('td', null, fav ? sprite(fav, p.fav.sh, 32) : null),
            el('td', null, el('b', null, p.name), p.title ? el('div', { class: 'muted small' }, p.title) : null), el('td', { class: 'mono' }, p.trainer_id),
            el('td', null, ago(p.updated_at)), el('td', null, hrs(p.playtime)), el('td', null, fmtN(p.records && p.records.averno)), el('td', null, fmtN(p.records && p.records.depth)), el('td', null, fmtN(p.records && p.records.daskai)),
            el('td', null, p.banned ? pill('baneado', 'bad') : null, p.reports ? pill(p.reports + ' denuncias', 'warn') : null, p.flagged ? pill(p.flagged + ' sospechosos', 'warn') : null, p.unread ? pill(p.unread + ' sin leer', 'info') : null, p.name_locked ? pill('nombre fijo') : null));
        })) : el('p', { class: 'muted' }, 'Nadie coincide.'));
        put(pager, page > 0 ? btn('← Anteriores', () => { page--; load(); }, 'ghost asm') : null, el('span', { class: 'muted small' }, `Página ${page + 1}`), rows.length === 50 ? btn('Siguientes →', () => { page++; load(); }, 'ghost asm') : null);
      } catch (e) { list.classList.remove('loading'); put(list, fail(e)); }
    };
    let tm = null;
    q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { page = 0; load(); }, 300); });
    sel.addEventListener('change', () => { page = 0; load(); });
    shell('players', 'Jugadores', el('div', { class: 'atools' }, q, sel, btn('Abrir por ID', async () => { const id = await ask('Abrir ficha', 'ID de entrenador'); if (id) go('player/' + id.trim().toUpperCase()); }, 'ghost', 'user')), list, pager);
    load(); q.focus();
  }

  /* ---------------- Ficha de un jugador ---------------- */
  const PC = {}; // (fichas ya descargadas: cambiar de pestaña no vuelve a pedir nada)
  async function playerView(tid, tab = 'team', fresh = true) {
    let d = PC[tid];
    if (fresh || !d) {
      const seq = ++secSeq; frame(); drawNav('players');
      const slow = UI.view !== 'player:' + tid ? setTimeout(() => { if (seq === secSeq) { UI.title.textContent = 'Jugador #' + tid; put(UI.body, loading()); } }, 400) : null;
      try { d = await working(() => API.player(tid)); } catch (e) { clearTimeout(slow); if (seq === secSeq) shell('players', 'Jugador #' + tid, fail(e)); return; }
      clearTimeout(slow);
      if (seq !== secSeq) return;
      if (!d) { shell('players', 'Jugador #' + tid, el('p', { class: 'muted' }, 'No existe ningún perfil con ese ID.'), btn('← Volver', () => history.back(), 'ghost')); return; }
      PC[tid] = d;
    }
    const p = d.profile, pv = p.private || {}, rec = p.records || {};
    const reload = (tb = tab, f = false) => playerView(tid, tb, f);
    const act = async (fn, ok) => { try { const r = await working(fn); if (r && r !== 'ok' && typeof r === 'string') toast('Respuesta: ' + r, true); else toast(ok); reload(tab, true); } catch (e) { toast(e.message, true); } };
    const head = el('div', { class: 'aph' },
      el('div', { class: 'aph-av' }, p.fav && p.fav.s ? sprite(p.fav.s, p.fav.sh, 72) : icon('user', 40)),
      el('div', { class: 'aph-who' }, el('h2', null, p.name, p.name_locked ? pill('nombre fijo') : null, d.ban ? pill('BANEADO', 'bad') : null),
        p.title ? el('div', { class: 'agold' }, p.title) : null,
        el('div', { class: 'muted small' }, `#${p.trainer_id} · versión ${p.version || '?'} · alta ${fmtD(p.created_at)} · última vez ${ago(p.updated_at)} · ${hrs(p.playtime)} jugadas`),
        d.ban ? el('div', { class: 'aerr' }, 'Motivo del baneo: ' + (d.ban.reason || '—') + ' · ' + fmtD(d.ban.created_at)) : null),
      el('div', { class: 'aph-act' },
        btn('Mensaje / regalo', () => composeTo(p.trainer_id, p.name).then((ok) => ok && reload('chat', true)), 'primary', 'mail'),
        d.ban ? btn('Quitar baneo', () => act(() => API.unban(p.trainer_id), 'Baneo quitado'), '', 'check')
          : btn('Banear', async () => { const r = await ask('Banear a ' + p.name, 'Motivo', 'trampas', { ok: 'Banear', danger: true, help: 'Desaparece de todas las tablas y no puede enviar nada. Se puede deshacer.' }); if (r !== null) act(() => API.ban(p.trainer_id, r), 'Baneado'); }, 'danger', 'lock'),
        btn('Renombrar', async () => { const r = await ask('Cambiar el nombre', 'Nombre nuevo (se queda fijo: el juego no lo puede cambiar)', p.name); if (r) act(() => API.rename(p.trainer_id, r, true), 'Nombre cambiado'); }, 'ghost', 'edit'),
        btn('Borrar récords', async () => { if (await confirmBox('Borrar récords', `Se borran TODOS los récords de ${p.name} (todas las tablas y temporadas).`)) act(() => API.resetScores(p.trainer_id), 'Récords borrados'); }, 'ghost', 'trash'),
        btn('Borrar jugador', async () => { const r = await ask('Borrar jugador', `Escribe ${p.trainer_id} para borrar su perfil, récords, amigos, buzón y chat. (Para que no vuelva, banéalo.)`, '', { ok: 'Borrar', danger: true }); if (r && r.trim().toUpperCase() === p.trainer_id) { try { await API.deletePlayer(p.trainer_id); toast('Jugador borrado'); go('players'); } catch (e) { toast(e.message, true); } } }, 'ghost danger-t', 'trash')));
    const recs = el('div', { class: 'astats asm' }, [['Averno', rec.averno], ['Más profunda', rec.depth], ['Abismo', rec.abyss], ['Semanal', rec.weekly], ['Variocolores', rec.shinies], ['Combates', rec.battles],
      ['Daskai', rec.daskai], ['Intercambios', rec.trades], ['Logros', rec.achievements], ['Nivel máx.', rec.maxLv], ['Monedas', pv.coins], ['Emblemas', pv.emblems]].map(([l, v]) => statBox(l, v)));
    const TABS = [['team', 'Equipo'], ['box', `Daskai (${(pv.box || []).length})`], ['bag', 'Bolsa'], ['scores', `Récords (${d.scores.length + d.averno.length})`], ['friends', `Amigos (${d.friends.filter((f) => f.mutual).length})`], ['reports', `Denuncias (${d.reports.length})`], ['chat', 'Mensajes' + (d.support.length || d.dms ? ` (${(d.support.length ? 1 : 0) + (d.dms | 0)})` : '')]];
    const tabBody = el('div', { class: 'atab-b' });
    const tabs = el('div', { class: 'atabs' }, TABS.map(([k, l]) => el('button', { class: 'atab' + (k === tab ? ' on' : ''), type: 'button', 'data-k': k,
      onClick: () => { if (k === tab) return; tab = k; tabs.querySelectorAll('.atab').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); put(tabBody, bodyFor(k)); } }, l)));
    // (cambiar de pestaña sólo cambia esta parte: sin volver a pedir datos ni redibujar la ficha)
    function bodyFor(tab) {
      let body;
      if (tab === 'team') body = el('div', null, p.fav ? card('Favorito', buildView({ team: [p.fav] })) : null, card('Equipo actual', buildView({ team: p.team || [] })));
      else if (tab === 'box') {
        const box = (pv.box || []).map(([s, l, sh, n, st]) => ({ s, l, sh, n, st }));
        const f = el('input', { class: 'ai', type: 'search', placeholder: 'Filtrar por especie o mote…' });
        const sort = el('select', { class: 'ai' }, [['l', 'Nivel'], ['s', 'Especie'], ['sh', 'Variocolores primero']].map(([k, l]) => el('option', { value: k }, l)));
        const grid = el('div', { class: 'abox' });
        const draw = () => { const q = f.value.trim().toLowerCase(); const l = box.filter((x) => !q || spName(x.s).toLowerCase().includes(q) || (x.n || '').toLowerCase().includes(q));
          l.sort((a, b) => (sort.value === 's' ? spName(a.s).localeCompare(spName(b.s)) : sort.value === 'sh' ? b.sh - a.sh || b.l - a.l : b.l - a.l));
          grid.replaceChildren(...l.slice(0, 600).map((x) => el('div', { class: 'abx' + (x.sh ? ' sh' : ''), title: `${spName(x.s)} Nv. ${x.l}` }, sprite(x.s, x.sh, 48), el('b', null, x.n || spName(x.s)), el('small', null, `Nv. ${x.l}${x.st ? ' · ' + '✦'.repeat(Math.min(5, x.st)) : ''}${x.sh ? ' · ★' : ''}`)))); };
        f.addEventListener('input', draw); sort.addEventListener('change', draw); draw();
        body = box.length ? el('div', null, el('div', { class: 'atools' }, f, sort, el('small', { class: 'muted' }, `${box.length} daskai · ${box.filter((x) => x.sh).length} variocolores`)), grid)
          : el('p', { class: 'muted' }, 'Este jugador aún no ha enviado sus cajas (llegan con la v5.40 del juego).');
      } else if (tab === 'bag') {
        const bag = Object.entries(pv.bag || {}).sort((a, b) => b[1] - a[1]);
        body = el('div', null, el('p', null, `Monedas: ${fmtN(pv.coins)} · Emblemas: ${fmtN(pv.emblems)} · Ranura ${pv.slot || '?'} · Idioma ${pv.lang || '?'}`),
          bag.length ? el('div', { class: 'abag' }, bag.map(([id, n]) => el('div', { class: 'abg' }, itemIcon(id, 20), el('span', null, itemName(id)), el('b', null, '×' + fmtN(n))))) : el('p', { class: 'muted' }, 'Sin datos de la bolsa.'));
      } else if (tab === 'scores') {
        const rows = d.averno.map((a) => ({ board: 'averno', period: a.season, value: a.floors, flagged: a.flagged, at: a.updated_at, build: { team: a.team, relics: a.relics } }))
          .concat(d.scores.map((s) => ({ board: s.board, period: s.period, value: s.value, flagged: s.flagged, at: s.updated_at, build: s.build })));
        body = rows.length ? table(['Tabla', 'Periodo', 'Valor', 'Fecha', 'Estado', ''], rows.map((r) => el('tr', null, el('td', null, BOARD[r.board] || r.board), el('td', null, r.period), el('td', null, el('b', null, fmtN(r.value))), el('td', null, fmtD(r.at)),
          el('td', null, r.flagged ? pill('sospechoso', 'warn') : pill('visible', 'ok')),
          el('td', { class: 'nowrap' }, btn('Equipo', () => modal('Equipo del récord', buildView(r.build)), 'ghost asm'),
            r.flagged ? btn('Dar por bueno', () => act(() => API.score(p.player_id, r.board, r.period, 'ok'), 'Visible'), 'ghost asm') : btn('Ocultar', () => act(() => API.score(p.player_id, r.board, r.period, 'flag'), 'Oculto'), 'ghost asm'),
            btn('Borrar', async () => { if (await confirmBox('Borrar récord', 'Se borra este récord.')) act(() => API.score(p.player_id, r.board, r.period, 'delete'), 'Borrado'); }, 'ghost asm danger-t'))))) : el('p', { class: 'muted' }, 'Sin récords publicados.');
      } else if (tab === 'friends') {
        // v5.43: cada amigo en una fila compacta: dibujo, nombre, ID, título, última vez, tiempo jugado y estado
        const ST = { friend: ['amigos', 'ok'], sent: ['solicitud enviada', 'info'], incoming: ['le ha pedido amistad', 'warn'] };
        const row = (f) => { const st = f.status || (f.mutual ? 'friend' : 'sent');
          return el('a', { class: 'afr', href: '#player/' + f.tid },
            el('span', { class: 'afr-av' }, f.fav && f.fav.s ? sprite(f.fav.s, f.fav.sh, 36) : icon('user', 18)),
            el('span', { class: 'afr-who' }, el('b', null, f.name || '¿?', ' ', el('small', { class: 'muted mono' }, '#' + f.tid)), el('small', { class: 'muted ellip' }, [f.title, f.updated_at ? 'visto ' + ago(f.updated_at) : null, f.playtime != null ? hrs(f.playtime) : null].filter(Boolean).join(' · '))),
            el('span', { class: 'afr-st' }, pill((ST[st] || ST.friend)[0], (ST[st] || ST.friend)[1]), f.banned ? pill('baneado', 'bad') : null, f.since ? el('small', { class: 'muted' }, 'desde ' + fmtD(f.since).split(',')[0]) : null)); };
        const groups = [['friend', 'Amigos'], ['incoming', 'Solicitudes recibidas'], ['sent', 'Solicitudes enviadas']].map(([k, l]) => { const g = d.friends.filter((f) => (f.status || (f.mutual ? 'friend' : 'sent')) === k); return g.length ? [el('small', { class: 'agrp' }, `${l} (${g.length})`), el('div', { class: 'afrs' }, g.map(row))] : null; });
        body = d.friends.length ? el('div', { class: 'astack' }, groups) : el('p', { class: 'muted' }, 'Sin amigos ni solicitudes.');
      }
      else if (tab === 'reports') body = el('div', null, d.reports.length ? table(['Fecha', 'Denuncia', 'Motivo', 'Estado'], d.reports.map((r) => el('tr', null, el('td', null, fmtD(r.created_at)), el('td', null, el('a', { href: '#player/' + r.reporter }, '#' + r.reporter)), el('td', null, REASON[r.reason] || r.reason), el('td', null, r.closed ? pill('cerrada') : pill('abierta', 'warn')))))
        : el('p', { class: 'muted' }, 'Nadie le ha denunciado.'), d.reports.some((r) => !r.closed) ? btn('Cerrar todas sus denuncias', () => act(() => API.closeReport(null, p.trainer_id), 'Cerradas'), 'ghost') : null, el('p', { class: 'muted small' }, `Ha denunciado a otros ${d.reportsBy} veces.`));
      else {
        // v5.43: conversaciones del jugador: con el equipo (puedes contestar) y con otros jugadores (sólo lectura; duran 24 h)
        const right = el('div', { class: 'adm-conv' });
        const list = el('div', { class: 'athreads' });
        let dms = null;
        const pick = (k) => {
          list.querySelectorAll('.athr').forEach((a) => a.classList.toggle('on', a.dataset.k === k));
          if (k === 'team') { put(right, el('div', { class: 'arow-c' }, el('h3', null, 'Con el equipo')), chatBox(p.trainer_id, p.name, d.support, () => reload('chat', true))); return; }
          const c = (dms || []).find((x) => x.with === k); if (!c) return;
          const bub = (m) => el('div', { class: 'abub ' + (m.from_tid === p.trainer_id ? 'them' : 'other') }, el('p', null, m.body), el('small', null, (m.from_tid === p.trainer_id ? p.name : (c.name || c.with)) + ' · ' + fmtD(m.created_at)));
          const log = el('div', { class: 'achat' }, (c.messages || []).map(bub));
          put(right, el('div', { class: 'arow-c' }, el('h3', null, `${p.name} ↔ ${c.name || '#' + c.with}`), el('a', { href: '#player/' + c.with }, 'Ver ficha →'), el('span', { class: 'grow' }), el('small', { class: 'muted' }, 'Sólo lectura · se borran a las 24 h')), log);
          setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);
        };
        const drawList = () => put(list,
          el('small', { class: 'agrp' }, 'Con el equipo'),
          el('a', { class: 'athr', href: 'javascript:void 0', 'data-k': 'team', onClick: (e) => { e.preventDefault(); pick('team'); } }, el('b', null, 'Equipo Daskai'), el('small', { class: 'muted' }, d.support.length ? `${d.support.length} mensajes` : 'Sin mensajes')),
          el('small', { class: 'agrp' }, 'Con otros jugadores (24 h)'),
          dms === null ? el('p', { class: 'muted small' }, 'Cargando…') : dms.length ? dms.map((c) => el('a', { class: 'athr', href: 'javascript:void 0', 'data-k': c.with, onClick: (e) => { e.preventDefault(); pick(c.with); } },
            el('b', null, c.name || '#' + c.with), el('small', { class: 'muted' }, `#${c.with} · ${c.count} mensajes · ${ago(c.last_at)}`))) : el('p', { class: 'muted small' }, 'Ninguna en las últimas 24 h.'));
        drawList(); pick('team');
        API.dms(p.trainer_id).then((x) => { dms = x || []; drawList(); list.querySelector('.athr[data-k="team"]').classList.add('on'); }).catch((e) => { dms = []; drawList(); toast('Conversaciones: ' + e.message, true); });
        body = el('div', { class: 'asplit' }, list, right);
      }
      return body;
    }
    put(tabBody, bodyFor(tab));
    shell('players', p.name, head, recs, tabs, tabBody); UI.view = 'player:' + tid;
  }
  const BOARD = { averno: 'Averno', depth: 'Más profunda', weekly: 'Semanal', abyss: 'Abismo', shiny: 'Variocolores' };
  const REASON = { cheat: 'Trampas', name: 'Nombre ofensivo', msg: 'Mensajes molestos', other: 'Otro' };

  /* ---------------- Chat y regalos ---------------- */
  function chatBox(tid, name, list, after) {
    const ta = el('textarea', { class: 'ai', rows: 3, maxlength: 500, placeholder: `Escribe a ${name}… (le llega a su buzón)` });
    const bub = (m) => el('div', { class: 'abub ' + (m.from_admin ? 'me' : 'them') }, m.body ? el('p', null, m.body) : null, imgEl(m.img), el('small', null, (m.from_admin ? 'Tú' : name) + ' · ' + fmtD(m.created_at)));
    const log = el('div', { class: 'achat' }, list.length ? list.map(bub) : el('p', { class: 'muted' }, 'Sin mensajes todavía.'));
    // v5.42: la conversación se actualiza sola cada 5 s mientras está abierta
    let lastId = Math.max(0, ...list.map((m) => +m.id || 0));
    clearInterval(liveTimer);
    liveTimer = setInterval(async () => {
      if (document.hidden || !document.body.contains(log)) { if (!document.body.contains(log)) clearInterval(liveTimer); return; }
      try { const l = await API.thread(tid), nw = l.filter((m) => +m.id > lastId); if (!nw.length) return;
        if (!lastId) log.replaceChildren(); nw.forEach((m) => log.append(bub(m))); lastId = Math.max(lastId, ...nw.map((m) => +m.id)); log.scrollTop = log.scrollHeight; } catch (e) { /* */ }
    }, 5000);
    const ip = imagePicker();
    ta.addEventListener('paste', (e) => { const it = [...(e.clipboardData || {}).items || []].find((x) => x.type.startsWith('image/')); if (it) { e.preventDefault(); ip.pick(it.getAsFile()); } });
    setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);
    const send = async () => { const txt = ta.value.trim(), img = ip.value(); if (!txt && !img) return; try { await API.send(tid, txt, null, img); ta.value = ''; ip.clear();
      const l = await API.thread(tid), nw = l.filter((m) => +m.id > lastId); if (!lastId) log.replaceChildren(); nw.forEach((m) => log.append(bub(m))); lastId = Math.max(lastId, ...nw.map((m) => +m.id)); log.scrollTop = log.scrollHeight; } catch (e) { toast(e.message, true); } };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
    return el('div', { class: 'achatw' }, log, ta, ip, el('div', { class: 'arow-c' }, el('small', { class: 'muted' }, 'Ctrl+Enter para enviar · puedes pegar una imagen'), el('span', { class: 'grow' }), btn('Regalo…', () => composeTo(tid, name).then((ok) => ok && after()), 'ghost', 'gift'), btn('Enviar', send, 'primary', 'next')));
  }
  /** Editor de regalo: objetos con cantidad, monedas y emblemas → {items, coins, emblems} o null */
  /** v5.41.3: ventana con todos los objetos (buscar, filtrar por tipo, pulsar para sumar). Cambia `items` ({id: n}). */
  const RCOL = { comun: '#cbd5e1', raro: '#60a5fa', epico: '#c084fc', legendario: '#fbbf24' };
  const CATNAME = { batalla: 'Batalla', mejora: 'Mejora', equipo: 'Equipamiento', pieza: 'Piezas', forja: 'Forja' };
  function itemPicker(items) {
    const all = Object.values(D().items || {}).sort((a, b) => (Object.keys(CATNAME).indexOf(a.category) - Object.keys(CATNAME).indexOf(b.category)) || ((D().rarities[a.rarity] || {}).order || 0) - ((D().rarities[b.rarity] || {}).order || 0) || itemName(a.id).localeCompare(itemName(b.id)));
    let cat = 'all', q = '';
    const search = el('input', { class: 'ai', type: 'search', placeholder: `Buscar entre ${all.length} objetos…` });
    const cats = el('div', { class: 'acats' });
    const grid = el('div', { class: 'aitems' });
    const sum = el('small', { class: 'muted' });
    const total = () => { const n = Object.keys(items).length; sum.textContent = n ? `${n} objeto(s) elegidos · ${Object.values(items).reduce((a, b) => a + b, 0)} unidades` : 'Pulsa un objeto para añadirlo (Mayús + clic: +10; clic derecho: −1).'; };
    const drawCats = () => cats.replaceChildren(...[['all', 'Todos', all.length]].concat(Object.keys(CATNAME).map((k) => [k, CATNAME[k], all.filter((x) => x.category === k).length])).filter(([, , n]) => n)
      .map(([k, l, n]) => el('button', { class: 'acat' + (k === cat ? ' on' : ''), type: 'button', onClick: () => { cat = k; drawCats(); drawGrid(); } }, l, el('i', null, n))));
    const card = (it) => {
      const n = items[it.id] || 0;
      const b = el('button', { class: 'aitem' + (n ? ' on' : ''), type: 'button', title: (it.desc || '') + (it.id ? `\n(${it.id})` : ''), style: { '--r': RCOL[it.rarity] || '#cbd5e1' } },
        el('span', { class: 'aitem-ic' }, itemIcon(it.id, 30)), el('b', null, itemName(it.id)), el('small', null, (D().rarities[it.rarity] || {}).name || ''), n ? el('i', { class: 'aitem-n' }, '×' + n) : null);
      b.addEventListener('click', (e) => { items[it.id] = Math.min(999, (items[it.id] || 0) + (e.shiftKey ? 10 : 1)); b.replaceWith(card(it)); total(); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!items[it.id]) return; items[it.id]--; if (!items[it.id]) delete items[it.id]; b.replaceWith(card(it)); total(); });
      return b;
    };
    const drawGrid = () => { const l = all.filter((x) => (cat === 'all' || x.category === cat) && (!q || itemName(x.id).toLowerCase().includes(q) || x.id.includes(q)));
      grid.replaceChildren(...(l.length ? l.map(card) : [el('p', { class: 'muted' }, 'Ningún objeto coincide.')])); };
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); drawGrid(); });
    drawCats(); drawGrid(); total();
    return modal('Elegir objetos', el('div', { class: 'astack apick' }, search, cats, grid, sum), [{ label: 'Listo', cls: 'primary', value: true }]);
  }
  /** Editor de regalo: objetos con cantidad, monedas y emblemas → {items, coins, emblems} o null */
  function giftEditor(init) {
    const items = Object.assign({}, (init && init.items) || {});
    const coins = el('input', { class: 'ai', type: 'number', min: 0, max: 1000000, value: (init && init.coins) || 0 });
    const emb = el('input', { class: 'ai', type: 'number', min: 0, max: 500, value: (init && init.emblems) || 0 });
    const chips = el('div', { class: 'achips agift-items' });
    const draw = () => chips.replaceChildren(...(Object.keys(items).length ? Object.entries(items).map(([id, n]) => {
      const qn = el('input', { class: 'ai aqn', type: 'number', min: 1, max: 999, value: n, title: 'Cantidad' });
      qn.addEventListener('change', () => { const v = Math.max(1, Math.min(999, qn.value | 0)); items[id] = v; qn.value = v; });
      return el('span', { class: 'ap gift' }, itemIcon(id, 18), el('span', null, itemName(id)), qn, el('button', { class: 'ax', type: 'button', title: 'Quitar', onClick: () => { delete items[id]; draw(); } }, '×'));
    }) : [el('small', { class: 'muted' }, 'Sin objetos.')]));
    // sin datos del juego (abierto desde el disco): escribir el id a mano
    const raw = el('input', { class: 'ai', placeholder: 'id del objeto (p. ej. pocion)' });
    const addRaw = () => { const id = raw.value.trim(); if (!id) return; items[id] = Math.min(999, (items[id] || 0) + 1); raw.value = ''; draw(); };
    raw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRaw(); } });
    draw();
    const node = el('div', { class: 'agift' },
      G.ok ? el('div', { class: 'arow-c' }, btn('Elegir objetos…', () => itemPicker(items).then(draw), 'primary asm', 'gift'), el('small', { class: 'muted' }, 'Abre la lista con todos los objetos del juego.'))
        : el('div', { class: 'arow-c' }, raw, btn('Añadir', addRaw, 'ghost asm', 'plus')),
      chips,
      el('div', { class: 'arow-c' }, el('label', { class: 'af inl' }, el('span', null, 'Monedas'), coins), el('label', { class: 'af inl' }, el('span', null, 'Emblemas'), emb)));
    node.value = () => { const g = {}; if (Object.keys(items).length) g.items = Object.assign({}, items); if (coins.value | 0) g.coins = Math.min(1e6, coins.value | 0); if (emb.value | 0) g.emblems = Math.min(500, emb.value | 0); return Object.keys(g).length ? g : null; };
    return node;
  }
  async function composeTo(tid, name) {
    const ta = el('textarea', { class: 'ai', rows: 3, maxlength: 500, placeholder: 'Mensaje (opcional si hay regalo)' });
    const ge = giftEditor(), ip = imagePicker();
    const r = await modal(`Para ${name || ''} #${tid}`, el('div', { class: 'astack' }, ta, ip, el('b', null, 'Regalo (opcional)'), ge, el('small', { class: 'muted' }, 'El regalo llega a su buzón y lo recoge una vez. El mensaje también queda en su chat con el equipo.')),
      [{ label: 'Cancelar', value: null, cls: 'ghost' }, { label: 'Enviar', cls: 'primary', run: () => ({ text: ta.value.trim(), gift: ge.value(), img: ip.value() }) }]);
    if (!r || (!r.text && !r.gift && !r.img)) return false;
    try { const x = await API.send(tid, r.text, r.gift, r.img); if (x !== 'ok') { toast('Respuesta: ' + x, true); return false; } toast('Enviado'); return true; } catch (e) { toast(e.message, true); return false; }
  }

  /* ---------------- Soporte ---------------- */
  /** Soporte: lista a la izquierda; elegir otra conversación sólo cambia la parte derecha (sin recargar la sección). */
  const SUP = {};
  async function supportView(sel) {
    if (UI.view === 'support:Soporte' && SUP.side && UI.body.contains(SUP.side)) { drawNav('support'); return SUP.select(sel); }
    await section('support', 'Soporte', async () => {
      const threads = await API.threads();
      badges.support = threads.reduce((a, t) => a + (t.unread | 0), 0) || 0;
      SUP.threads = threads;
      SUP.main = el('div');
      SUP.side = el('div', { class: 'athreads' }, threads.length ? threads.map((t) => el('a', { class: 'athr', href: '#support/' + t.trainer_id, 'data-tid': t.trainer_id }, el('b', null, t.name || t.trainer_id, t.unread ? pill(t.unread, 'warn') : null), el('small', { class: 'muted' }, '#' + t.trainer_id + ' · ' + ago(t.last_at)), el('div', { class: 'muted small ellip' }, t.last))) : el('p', { class: 'muted' }, 'Sin conversaciones.'),
        btn('Nueva conversación', async () => { const id = await ask('Escribir a un jugador', 'ID de entrenador'); if (id) go('support/' + id.trim().toUpperCase()); }, 'ghost asm', 'plus'));
      SUP.select = async (tid) => {
        SUP.side.querySelectorAll('.athr').forEach((a) => a.classList.toggle('on', a.dataset.tid === tid));
        if (!tid) { put(SUP.main, el('p', { class: 'muted' }, 'Elige una conversación.')); return; }
        const seq = SUP.seq = (SUP.seq | 0) + 1, t = SUP.threads.find((x) => x.trainer_id === tid);
        const show = (th) => put(SUP.main, el('div', { class: 'arow-c' }, el('h3', null, (t && t.name) || tid), el('a', { href: '#player/' + tid }, 'Ver ficha →')), chatBox(tid, (t && t.name) || tid, th, () => SUP.select(tid)));
        SUP.cache = SUP.cache || {};
        if (SUP.cache[tid]) show(SUP.cache[tid]); // (lo ya visto sale al momento; luego se completa)
        let th; try { th = await working(() => API.thread(tid)); } catch (e) { if (seq === SUP.seq) put(SUP.main, fail(e)); return; }
        if (seq !== SUP.seq) return; // (ya has elegido otra)
        const a = SUP.side.querySelector(`.athr[data-tid="${tid}"] .ap`);
        if (a) { a.remove(); badges.support = Math.max(0, (badges.support | 0) - ((t && t.unread) | 0)); if (t) t.unread = 0; drawNav('support'); }
        const same = SUP.cache[tid] && JSON.stringify(SUP.cache[tid].map((m) => m.id)) === JSON.stringify(th.map((m) => m.id));
        SUP.cache[tid] = th;
        if (!same) show(th);
      };
      return el('div', { class: 'asplit' }, SUP.side, SUP.main);
    });
    if (SUP.select) SUP.select(sel);
  }

  /* ---------------- Denuncias ---------------- */
  const reportsView = (all) => section('reports', 'Denuncias', async () => {
    const list = await API.reports(!all);
    const by = {};
    list.forEach((r) => { (by[r.target_tid] = by[r.target_tid] || { tid: r.target_tid, name: r.target_name, banned: r.banned, items: [] }).items.push(r); });
    const groups = Object.values(by).sort((a, b) => b.items.length - a.items.length);
    return [el('div', { class: 'atools' }, btn(all ? 'Sólo abiertas' : 'Ver también las cerradas', () => reportsView(!all), 'ghost asm')),
      groups.length ? groups.map((g) => card(null, el('div', { class: 'arow-c' }, el('a', { href: '#player/' + g.tid }, el('b', null, g.name || '?'), ' #' + g.tid), pill(g.items.length + ' denuncias', 'warn'), g.banned ? pill('baneado', 'bad') : null, el('span', { class: 'grow' }),
        g.banned ? null : btn('Banear', async () => { const r = await ask('Banear #' + g.tid, 'Motivo', 'trampas', { ok: 'Banear', danger: true }); if (r !== null) { await API.ban(g.tid, r); await API.closeReport(null, g.tid); toast('Baneado'); reportsView(all); } }, 'danger asm', 'lock'),
        btn('Cerrar', async () => { await API.closeReport(null, g.tid); toast('Cerradas'); reportsView(all); }, 'ghost asm', 'check')),
      el('ul', { class: 'small' }, g.items.slice(0, 12).map((r) => el('li', null, `${fmtD(r.created_at)} · ${REASON[r.reason] || r.reason || '—'} · por `, el('a', { href: '#player/' + r.reporter }, '#' + r.reporter), r.closed ? ' (cerrada)' : ''))))) : el('p', { class: 'muted' }, 'No hay denuncias abiertas. 🎉')];
  });

  /* ---------------- Sospechosos ---------------- */
  const flaggedView = () => section('flagged', 'Récords sospechosos', async () => {
    const list = await API.flagged();
    return [el('p', { class: 'muted' }, 'Récords que el servidor ha ocultado por ser un salto demasiado grande. No se ven en las tablas hasta que los des por buenos.'),
      list.length ? table(['Tabla', 'Jugador', 'Valor', 'Periodo', 'Tiempo jugado', 'Fecha', ''], list.map((r) => el('tr', null, el('td', null, BOARD[r.board] || r.board),
        el('td', null, r.trainer_id ? el('a', { href: '#player/' + r.trainer_id }, r.name || r.trainer_id) : r.name), el('td', null, el('b', null, fmtN(r.value))), el('td', null, r.period), el('td', null, hrs(r.playtime)), el('td', null, fmtD(r.updated_at)),
        el('td', { class: 'nowrap' }, btn('Dar por bueno', async () => { await API.score(r.player_id, r.board, r.period, 'ok'); toast('Visible'); flaggedView(); }, 'ghost asm'),
          btn('Borrar', async () => { await API.score(r.player_id, r.board, r.period, 'delete'); toast('Borrado'); flaggedView(); }, 'ghost asm danger-t'),
          r.trainer_id ? btn('Banear', async () => { const why = await ask('Banear #' + r.trainer_id, 'Motivo', 'récord imposible', { ok: 'Banear', danger: true }); if (why !== null) { await API.ban(r.trainer_id, why); toast('Baneado'); flaggedView(); } }, 'danger asm') : null)))) : el('p', { class: 'muted' }, 'Nada sospechoso. 🎉')];
  });

  /* ---------------- Clasificaciones ---------------- */
  function boardsView(board = 'averno') {
    const sel = el('select', { class: 'ai' }, Object.entries(BOARD).map(([k, l]) => el('option', { value: k, selected: k === board }, l)));
    const per = el('input', { class: 'ai aqty', type: 'number', min: 1, placeholder: 'actual' });
    const only = el('input', { type: 'checkbox' });
    const list = el('div', null, loading());
    const load = async () => {
      list.classList.add('loading');
      try {
        const rows = await API.scores(sel.value, per.value | 0, only.checked);
        list.classList.remove('loading'); put(list, rows.length ? table(['#', 'Jugador', 'Valor', 'Periodo', 'Tiempo jugado', 'Fecha', 'Estado', ''], rows.map((r, i) => el('tr', null, el('td', null, i + 1),
          el('td', null, r.trainer_id ? el('a', { href: '#player/' + r.trainer_id }, r.name) : r.name), el('td', null, el('b', null, fmtN(r.value))), el('td', null, r.period), el('td', null, hrs(r.playtime)), el('td', null, fmtD(r.updated_at)),
          el('td', null, r.banned ? pill('baneado', 'bad') : null, r.flagged ? pill('oculto', 'warn') : null),
          el('td', { class: 'nowrap' }, btn('Equipo', () => modal('Equipo de ' + r.name, buildView(r.build)), 'ghost asm'),
            btn(r.flagged ? 'Mostrar' : 'Ocultar', async () => { await API.score(r.player_id, sel.value, r.period, r.flagged ? 'ok' : 'flag'); load(); }, 'ghost asm'),
            btn('Borrar', async () => { if (await confirmBox('Borrar récord', `Borrar el récord de ${r.name}.`)) { await API.score(r.player_id, sel.value, r.period, 'delete'); load(); } }, 'ghost asm danger-t'))))) : el('p', { class: 'muted' }, 'Sin récords en ese periodo.'));
      } catch (e) { list.classList.remove('loading'); put(list, fail(e)); }
    };
    [sel, per, only].forEach((x) => x.addEventListener('change', load));
    shell('boards', 'Clasificaciones', el('div', { class: 'atools' }, sel, el('label', { class: 'af inl' }, el('span', null, 'Temporada / semana'), per), el('label', { class: 'achk' }, only, ' Sólo ocultos')), list);
    load();
  }

  /* ---------------- Noticias ---------------- */
  const newsView = () => section('news', 'Noticias', async () => {
    const list = await API.news();
    return [el('div', { class: 'atools' }, btn('Nueva noticia', () => newsEdit(null), 'primary', 'plus'), el('small', { class: 'muted' }, 'Las ven todos los jugadores en su buzón. Si llevan regalo, cada uno lo puede recoger una vez.')),
      list.length ? list.map((n) => card(null, el('div', { class: 'arow-c' }, n.pinned ? pill('fijada', 'info') : null, n.published ? (n.expires_at && new Date(n.expires_at) < new Date() ? pill('caducada') : pill('publicada', 'ok')) : pill('borrador'),
        el('b', null, n.title), el('span', { class: 'grow' }), el('small', { class: 'muted' }, fmtD(n.created_at)), btn('Editar', () => newsEdit(n), 'ghost asm', 'edit'),
        btn('Borrar', async () => { if (await confirmBox('Borrar noticia', n.title)) { await API.newsDelete(n.id); toast('Borrada'); newsView(); } }, 'ghost asm danger-t', 'trash')),
      n.body ? el('p', { class: 'pre' }, n.body) : null, imgEl(n.img), n.gift ? el('div', { class: 'muted small' }, '🎁 ', giftText(n.gift), ` · recogido por ${n.claims}`) : null,
      n.expires_at ? el('div', { class: 'muted small' }, 'Caduca: ' + fmtD(n.expires_at)) : null)) : el('p', { class: 'muted' }, 'Aún no hay noticias.')];
  });
  const giftText = (g) => [Object.entries(g.items || {}).map(([id, n]) => `${itemName(id)} ×${n}`).join(', '), g.coins ? fmtN(g.coins) + ' monedas' : '', g.emblems ? g.emblems + ' emblemas' : ''].filter(Boolean).join(' · ');
  const localDT = (d) => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  async function newsEdit(n) {
    const title = el('input', { class: 'ai', maxlength: 80, value: (n && n.title) || '' });
    const body = el('textarea', { class: 'ai', rows: 6, maxlength: 2000 }); body.value = (n && n.body) || '';
    const pinned = el('input', { type: 'checkbox' }); pinned.checked = !!(n && n.pinned);
    const pub = el('input', { type: 'checkbox' }); pub.checked = !n || n.published;
    const exp = el('input', { class: 'ai', type: 'datetime-local', value: localDT(n && n.expires_at) });
    const ge = giftEditor(n && n.gift), ip = imagePicker(n && n.img);
    const r = await modal(n ? 'Editar noticia' : 'Nueva noticia', el('div', { class: 'astack' },
      el('label', { class: 'af' }, el('span', null, 'Título'), title), el('label', { class: 'af' }, el('span', null, 'Texto'), body), el('b', null, 'Imagen (opcional)'), ip,
      el('div', { class: 'arow-c' }, el('label', { class: 'achk' }, pub, ' Publicada'), el('label', { class: 'achk' }, pinned, ' Fijada arriba'), el('label', { class: 'af inl' }, el('span', null, 'Caduca'), exp)),
      el('b', null, 'Regalo para todos (opcional)'), ge),
      [{ label: 'Cancelar', value: null, cls: 'ghost' }, { label: 'Guardar', cls: 'primary', run: () => true }]);
    if (!r) return;
    if (!title.value.trim()) { toast('Falta el título', true); return; }
    try { await API.newsSave({ p_news: n ? n.id : null, p_title: title.value.trim(), p_body: body.value, p_gift: ge.value(), p_pinned: pinned.checked, p_published: pub.checked, p_expires: exp.value ? new Date(exp.value).toISOString() : null, p_img: ip.value() }); toast('Guardada'); newsView(); }
    catch (e) { toast(e.message, true); }
  }

  /* ---------------- Regalos ---------------- */
  function giftsView() {
    const tid = el('input', { class: 'ai mono', maxlength: 6, placeholder: 'ABC123' });
    const text = el('textarea', { class: 'ai', rows: 2, maxlength: 500, placeholder: 'Mensaje que acompaña al regalo (opcional)' });
    const ge = giftEditor(), ip = imagePicker();
    const all = el('input', { type: 'checkbox' });
    const title = el('input', { class: 'ai', maxlength: 80, placeholder: 'Título de la noticia (si es para todos)' });
    all.addEventListener('change', () => { tid.disabled = all.checked; title.disabled = !all.checked; });
    title.disabled = true;
    const send = async () => {
      const g = ge.value(); if (!g) { toast('El regalo está vacío', true); return; }
      try {
        if (all.checked) { if (!title.value.trim()) { toast('Pon un título a la noticia', true); return; } await API.newsSave({ p_news: null, p_title: title.value.trim(), p_body: text.value, p_gift: g, p_pinned: false, p_published: true, p_expires: null, p_img: ip.value() }); toast('Noticia con regalo publicada'); go('news'); }
        else { const id = tid.value.trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(id)) { toast('ID no válido', true); return; } const r = await API.send(id, text.value.trim(), g, ip.value()); if (r !== 'ok') toast(r === 'notfound' ? 'No existe ese ID' : 'Respuesta: ' + r, true); else toast('Regalo enviado a #' + id); }
      } catch (e) { toast(e.message, true); }
    };
    shell('gifts', 'Regalos', card('Enviar un regalo', el('div', { class: 'astack' },
      el('div', { class: 'arow-c' }, el('label', { class: 'af inl' }, el('span', null, 'Para (ID)'), tid), el('label', { class: 'achk' }, all, ' Para todos los jugadores (se publica como noticia)')), title, text, ip, ge,
      el('div', { class: 'arow-c' }, el('span', { class: 'grow' }), btn('Enviar regalo', send, 'primary', 'gift')),
      el('small', { class: 'muted' }, 'Los objetos llegan a la bolsa de casa al recogerlos en el buzón. Máx. 999 por objeto, 1 000 000 de monedas y 500 emblemas.'))));
  }

  /* ---------------- v5.45: estadísticas anónimas y clanes ---------------- */
  const KIND = { exp: ['Expediciones por zona y final', 'Zona · final', 'pisos de media'], death: ['Dónde se cae (zona · piso)', 'Zona · piso', null], boss: ['Jefes', 'Zona · resultado', null],
    kind: ['Tipo de expedición', 'Tipo · final', null], size: ['Tamaño del mapa', 'Tamaño · final', null], rune: ['Runas usadas', 'Runa · final', null], corr: ['Corrupción', 'Nivel · final', null],
    nightmare: ['Pesadilla', 'Final', null], fallen: ['Daskai caídos (permadeath)', 'Zona · nivel', null], duel: ['Duelos', 'Resultado', null], active: ['Jugadores activos (días-jugador)', '', null],
    version: ['Versiones', 'Versión', null], lang: ['Idiomas', 'Idioma', null], teamlv: ['Nivel máximo del equipo', 'Nivel', null] };
  const OUT = { completed: 'completada', retreat: 'retirada', campfire: 'hoguera', lost: 'perdida', lostBoss: 'perdida en el jefe', won: 'ganado', fled: 'huida', normal: 'normal', abismo: 'Abismo', averno: 'Averno', small: 'pequeño', medium: 'mediano', xl: 'XL' };
  const zoneLbl = (key) => key.split(':').map((x, i) => (i === 0 && D().zones && D().zones[x] ? D().zones[x].name : OUT[x] || x.replace(/^f(\d+)$/, 'piso $1').replace(/^d(\d+)$/, 'mapa $1'))).join(' · ');
  /* v5.47: informes semanales (los crea la base de datos cada lunes; ver docs/ONLINE-SUPABASE.md §11) */
  const weeklyView = (sel) => section('weekly', 'Informes semanales', async () => {
    const R = await API.weekly(), list = (R && R.reports) || [];
    const run = (cur, email) => working(async () => { try { const r = await API.weeklyRun(cur, email); toast(email ? (r.email === 'sent' ? 'Informe generado y enviado' : r.email === 'nokey' ? 'Generado (falta la clave de Resend para enviarlo)' : 'Generado · correo: ' + r.email) : 'Informe generado'); go('weekly/' + r.week); } catch (e) { toast(e.message, true); } });
    const tools = el('div', { class: 'row gap-s wrap' },
      btn('Generar la semana pasada', () => run(false, false), 'asm', 'refresh'), btn('Semana en curso (provisional)', () => run(true, false), 'ghost asm', 'clock'),
      btn('Generar y enviar por correo', () => run(false, true), 'ghost asm', 'mail'));
    const status = el('p', { class: 'small muted' }, R && R.cron ? '✓ Se genera solo cada lunes a las 7:00 UTC. ' : '⚠ La tarea automática no está activa (falta pg_cron). ',
      R && R.email ? '✓ Se envía por correo con Resend.' : 'Correo: sin configurar (paso opcional del SQL de la v5.47).');
    if (!list.length) return [card(null, status, tools), card(null, el('p', { class: 'muted' }, 'Aún no hay informes. Pulsa «Generar la semana pasada» o espera al lunes.'))];
    const cur = list.find((r) => r.week === sel) || list[0], d = cur.data || {};
    const weeks = el('div', { class: 'row gap-s wrap' }, list.map((r) => btn(`Semana ${r.week}`, () => go('weekly/' + r.week), r.week === cur.week ? 'asm' : 'ghost asm')));
    const kv = (rows, head, avg) => rows && rows.length ? table([head, 'n'].concat(avg ? ['pisos'] : []), rows.map((x) => el('tr', null, el('td', null, zoneLbl(x.key)), el('td', null, x.n), avg ? el('td', null, x.avg) : null))) : el('p', { class: 'muted small' }, 'Sin datos.');
    const P = d.players || {}, Du = d.duels || {}, Cl = d.clans || {}, Cd = d.cloud || {}, Su = d.support || {};
    return [card(null, status, tools), weeks,
      card(`Semana ${cur.week} · ${cur.from} → ${cur.to}`,
        el('div', { class: 'astats' }, [['Jugadores activos', P.active], ['Nuevos', P.new], ['Total', P.total], ['Días-jugador', P.activeDays], ['Duelos', (Du.won | 0) + (Du.lost | 0)], ['Clanes', `${Cl.total | 0} (+${Cl.new | 0})`], ['Copias en la nube', `${Cd.saves | 0} · ${Cd.mb || 0} MB`], ['Base de datos', `${d.dbMb || 0} MB`], ['Soporte', `${Su.messages | 0} msj · ${Su.open | 0} denuncias`]]
          .map(([k, v]) => el('div', { class: 'astat' }, el('b', null, String(v == null ? '—' : v)), el('small', null, k)))),
        el('p', { class: 'small muted' }, cur.emailed_at ? `Correo: ${cur.email_note || 'enviado'} · ${fmtD(cur.emailed_at)}` : cur.email_note ? 'Correo: ' + cur.email_note : '')),
      card('Dónde se cae más (zona · piso)', kv(d.deaths, 'Zona · piso')),
      card('Expediciones (zona · final)', kv(d.expeditions, 'Zona · final', true)),
      card('Jefes', kv(d.bosses, 'Zona · resultado')),
      card('Daskai caídos', kv(d.fallen, 'Zona · nivel')),
      card('Runas', kv(d.runes, 'Runa · final')), card('Corrupción', kv(d.corruption, 'Nivel · final')), card('Tipos de expedición', kv(d.kinds, 'Tipo · final')), card('Versiones', kv(d.versions, 'Versión'))];
  });
  const statsView = (days) => section('stats', 'Estadísticas anónimas', async () => {
    const rows = await API.analytics(days);
    const by = {}; (rows || []).forEach((r) => (by[r.kind] = by[r.kind] || []).push(r));
    const pick = el('div', { class: 'row gap-s' }, [7, 30, 90].map((d) => btn(d + ' días', () => go('stats/' + d), d === days ? 'asm' : 'ghost asm')));
    if (!rows || !rows.length) return [pick, card(null, el('p', { class: 'muted' }, 'Aún no hay datos. Los juegos envían contadores cada 10 minutos (si el jugador no lo ha desactivado en Ajustes).'))];
    const order = Object.keys(KIND).filter((k) => by[k]).concat(Object.keys(by).filter((k) => !KIND[k]));
    return [pick, el('p', { class: 'muted small' }, 'Sólo contadores, sin ID de jugador. «n» = veces; «media» = valor medio cuando lo hay (p. ej. pisos completados).'),
      order.map((k) => { const [title, head, avg] = KIND[k] || [k, 'Clave', null]; const list = by[k].sort((a, b) => b.n - a.n).slice(0, 40); const tot = list.reduce((a, r) => a + r.n, 0);
        return card(title, table([head || 'Clave', 'n', '%', avg || ''], list.map((r) => el('tr', null, el('td', null, zoneLbl(r.key)), el('td', null, r.n), el('td', { class: 'muted' }, Math.round((r.n / Math.max(1, tot)) * 100) + '%'), el('td', null, avg && r.n ? (r.sum / r.n).toFixed(1) : ''))))); })];
  });
  const clansView = () => section('clans', 'Clanes', async () => {
    const list = await API.clans();
    return list.length ? card(null, table(['Etiqueta', 'Nombre', 'Miembros', 'Contrato', 'Creado', ''], list.map((c) => el('tr', null, el('td', { class: 'mono' }, c.tag), el('td', null, c.name, c.descr ? el('div', { class: 'small muted' }, c.descr) : null), el('td', null, c.members + '/20'), el('td', null, c.week), el('td', { class: 'nowrap' }, fmtD(c.created_at)),
      el('td', null, btn('Borrar', async () => { const r = await ask('Borrar clan', `Escribe ${c.tag} para borrar el clan «${c.name}» (sus miembros quedan sin clan).`, '', { ok: 'Borrar', danger: true }); if (r && r.trim().toUpperCase() === c.tag) { try { await API.clanDelete(c.id); toast('Clan borrado'); clansView(); } catch (e) { toast(e.message, true); } } }, 'ghost danger-t asm', 'trash')))))) : card(null, el('p', { class: 'muted' }, 'Aún no hay clanes.'));
  });

  /* ---------------- Registro y ajustes ---------------- */
  const LOGTXT = { ban: 'Baneo', unban: 'Quitó baneo', rename: 'Renombró', score_ok: 'Récord visible', score_flag: 'Ocultó récord', score_delete: 'Borró récord', reset_scores: 'Borró récords', delete_player: 'Borró jugador', report_close: 'Cerró denuncias', news_save: 'Guardó noticia', news_delete: 'Borró noticia', send: 'Envió mensaje/regalo' };
  const logView = () => section('log', 'Registro', async () => {
    const list = await API.log();
    return list.length ? table(['Fecha', 'Acción', 'Sobre', 'Detalle'], list.map((l) => el('tr', null, el('td', { class: 'nowrap' }, fmtD(l.at)), el('td', null, LOGTXT[l.action] || l.action),
      el('td', null, /^[A-Z0-9]{6}$/.test(l.target || '') ? el('a', { href: '#player/' + l.target }, '#' + l.target) : l.target), el('td', { class: 'small muted' }, l.detail ? JSON.stringify(l.detail).slice(0, 160) : '')))) : el('p', { class: 'muted' }, 'Nada todavía.');
  });
  function settingsView() {
    const c = cfg();
    shell('settings', 'Ajustes', card('Sesión', el('p', null, 'Has entrado como ', el('b', null, (session && session.email) || '?'), '.'), el('p', { class: 'muted small' }, 'La sesión se renueva sola. ' + (LS.get('dkadm.remember') === '1' ? 'Se recuerda en este navegador.' : 'Se olvida al cerrar la pestaña.')), btn('Salir', logout, 'ghost', 'exit')),
      card('Conexión', el('p', { class: 'mono small' }, c.url), el('p', { class: 'muted small' }, G.ok ? 'Datos del juego cargados: se ven dibujos y nombres.' : 'No se han podido cargar los datos del juego (abre el panel desde la misma web que el juego).'),
        btn('Volver a la conexión del juego', () => { LS.del('dkadm.url'); LS.del('dkadm.key'); toast('Hecho'); settingsView(); }, 'ghost asm')),
      card('Seguridad', el('ul', { class: 'small' },
        el('li', null, 'Todo se comprueba en el servidor: sin una sesión de un usuario de public.admins no se puede hacer nada desde aquí.'),
        el('li', null, 'En Supabase → Authentication → Sign In / Providers, desactiva «Allow new users to sign up».'),
        el('li', null, 'Para añadir otro admin: crea su usuario en Authentication y añádelo con: insert into public.admins (user_id, note) select id, \'nombre\' from auth.users where email = \'…\';'),
        el('li', null, 'Usa una contraseña larga y única para esta cuenta.'))));
  }

  /* ---------------- Rutas ---------------- */
  async function route() {
    if (!session) { loginView(); return; }
    const [k, a] = (location.hash.slice(1) || 'home').split('/');
    try {
      if (k === 'players') playersView(a || 'recent');
      else if (k === 'player' && a) playerView(a.toUpperCase());
      else if (k === 'support') supportView(a ? a.toUpperCase() : null);
      else if (k === 'reports') reportsView(false);
      else if (k === 'flagged') flaggedView();
      else if (k === 'boards') boardsView(a);
      else if (k === 'news') newsView();
      else if (k === 'gifts') giftsView();
      else if (k === 'log') logView();
      else if (k === 'weekly') weeklyView(+a || 0);
      else if (k === 'stats') statsView(+a || 7);
      else if (k === 'clans') clansView();
      else if (k === 'settings') settingsView();
      else homeView();
    } catch (e) { put(root, fail(e)); }
  }
  window.addEventListener('hashchange', route);

  (async function start() {
    await loadGame();
    if (session) { try { const w = await API.whoami(); if (!w || !w.admin) { saveSession(null); loginView('La sesión ha caducado o la cuenta no es admin.'); return; } } catch (e) { saveSession(null); loginView(e.message === 'nosession' ? '' : 'Vuelve a entrar.'); return; } }
    route();
  })();
  window.DKADM = { API, route, G }; // (para pruebas)
})();
