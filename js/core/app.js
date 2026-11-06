/* =============================================================
 * core/app.js — Carcasa del juego.
 *
 *  ┌── HUD: perfil / Volver / Campamento · cinta con el título · monedas, emblemas, avisos, Menú
 *  │
 *  │      contenido de la pantalla (el campamento es la pantalla principal)
 *  │
 *  └── barra de accesos abajo (como la barra de objetos de un juego)
 *
 * El Menú (o Esc cuando no hay a dónde volver) abre la pausa: perfil,
 * buscar, ayuda, ajustes, tema y guardar y salir.
 *
 * La navegación sale del menú 'nav' (DK.menus). Cada pantalla de
 * primer nivel se añade sola:
 *   DK.menus.add('nav', { id: 'team', icon: 'users', label: () => DK.t('nav.team'), screen: 'team', order: 20 });
 * y en su definición indica a qué sección pertenece: section: 'team'.
 * Las pantallas con `nav: false` (menú principal, combate...) ocultan la navegación.
 * ============================================================= */
(function () {
  let topbar, leftEl, titleEl, resEl, actionsEl, screenHost, dock;
  let installPrompt = null;
  let lastEntry = null, lastCanBack = false;

  const val = (x) => (typeof x === 'function' ? x() : x);

  DK.menus.define('nav');

  DK.app = {
    /** Arranca el juego: aplica ajustes, construye la carcasa y abre el menú principal. */
    init() {
      const { h } = DK.ui;
      DK.settings.apply();
      const root = document.getElementById('app');
      leftEl = h('div', { class: 'hud-left' });
      titleEl = h('div', { class: 'hud-title', role: 'heading', 'aria-level': '1' });
      resEl = h('div', { class: 'hud-res' });
      actionsEl = h('div', { class: 'hud-actions' });
      topbar = h('header', { class: 'topbar game-hud' }, leftEl, titleEl, h('div', { class: 'hud-right' }, resEl, actionsEl));
      dock = h('nav', { class: 'game-dock', 'aria-label': DK.t('nav.main') });
      screenHost = h('main', { class: 'screen-host', id: 'main' });
      root.append(h('a', { class: 'skip-link', href: '#main' }, DK.t('common.skipToContent')), topbar,
        h('div', { class: 'app-body' }, screenHost), dock);
      this.renderActions();

      // Reconstruir textos cuando cambian idioma o tema
      DK.on('settings:changed', ({ key }) => {
        if (key === 'lang' || key === 'theme' || !key) { this.renderActions(); this.renderNav(); this.renderHud(); }
      });
      // Insignias de la barra de accesos y recursos del HUD
      ['battle:end', 'mission:ready', 'crafted', 'coins', 'game:loaded', 'unlocked'].forEach((ev) => DK.on(ev, () => { this.renderNav(); this.renderRes(); }));

      // Instalación como app (sólo navegadores compatibles y servido por http/https)
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; DK.emit('app:installable'); });
      // Service worker (caché sin conexión). v4.50: al llegar una versión nueva se recarga sola
      // (antes había que recargar dos veces para ver los cambios y parecía que no se habían aplicado)
      if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
        const hadSW = !!navigator.serviceWorker.controller;
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadSW || reloading) return;
          reloading = true;
          if (DK.store.state) DK.store.flush && DK.store.flush();
          location.reload();
        });
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update && r.update()).catch(() => {});
      }

      DK.router.reset('mainMenu');
    },

    /**
     * Muestra una pantalla en el contenedor (lo llama el router).
     * @param {HTMLElement} el   contenido
     * @param {Object} def       definición de la pantalla
     * @param {Object} entry     {id, params}
     * @param {boolean} canBack  hay una pantalla anterior a la que volver
     * @param {string} dir       'forward' | 'back' | 'fade' | 'none'
     */
    mount(el, def, entry, canBack, dir) {
      lastEntry = { def, entry }; lastCanBack = canBack;
      if (dir !== 'none') el.classList.add('screen-enter', 'enter-' + dir);
      screenHost.replaceChildren(el);
      if (dir !== 'none') { screenHost.scrollTop = 0; window.scrollTo(0, 0); }
      document.body.dataset.screen = entry.id;
      document.body.dataset.nav = this.navVisible(def) ? 'on' : 'off';
      this.renderNav();
    },

    /** ¿Se muestran el HUD de partida y la barra de accesos en esta pantalla? */
    navVisible(def) { return !!DK.store.state && def.nav !== false; },

    /**
     * HUD superior: a la izquierda tu perfil (en el campamento), «Volver»
     * o el atajo al campamento/mapa; en el centro el nombre de la pantalla
     * como cinta; a la derecha monedas, emblemas, avisos y el Menú.
     */
    renderHud() {
      if (!lastEntry) return;
      const { h, btn } = DK.ui;
      const { def, entry } = lastEntry;
      const st = DK.store.state, inGame = this.navVisible(def);
      const exp = st && DK.expedition && DK.expedition.active();
      const home = exp ? 'expedition' : 'hub';
      let left = null;
      if (lastCanBack) left = btn({ icon: 'back', label: DK.t('common.back'), variant: 'ghost', cls: 'hud-back', hotkey: 'Esc', onClick: () => DK.router.back() });
      else if (inGame && entry.id !== home) left = btn({ icon: exp ? 'map' : 'campfire', label: exp ? DK.t('nav.expMap') : DK.t('nav.home'), variant: 'ghost', cls: 'hud-back', onClick: () => DK.router.reset(home) });
      else if (inGame && !exp) left = h('button', { class: 'hud-profile', type: 'button', tip: DK.t('nav.profile'), onClick: () => DK.router.reset('profile') },
        DK.views.avatar(st.player, { size: 38 }), h('span', { class: 'hud-profile-text' }, h('b', null, st.player.name), h('small', null, DK.avatars.titleText(st.player))));
      else if (inGame && exp) left = DK.views.expNavCard(exp);
      leftEl.replaceChildren(...[left].filter(Boolean));
      const tt = typeof def.title === 'function' ? def.title(entry.params) : def.title;
      titleEl.replaceChildren(...(tt ? [h('span', { class: 'hud-ribbon' }, def.icon ? DK.icon(def.icon, 18) : null, h('span', { class: 'hud-ribbon-text' }, tt))] : []));
      this.renderRes();
    },

    /** Recursos del HUD: monedas, emblemas y (en expedición) el botín. */
    renderRes() {
      if (!resEl) return;
      const { h } = DK.ui;
      const st = DK.store.state;
      if (!st || !lastEntry || !this.navVisible(lastEntry.def)) { resEl.replaceChildren(); return; }
      const exp = DK.expedition.active();
      // Si la cifra cambia desde la última vez, la píldora da un saltito (css/motion.css .bump)
      const prev = this._resPrev || (this._resPrev = {});
      const pill = (icon, v, tip, cls) => {
        const bump = prev[cls] != null && prev[cls] !== v; prev[cls] = v;
        return h('span', { class: 'hud-pill ' + cls + (bump ? ' bump' : ''), tip }, DK.icon(icon, 16), h('b', null, Number(v).toLocaleString(DK.i18n.lang)));
      };
      // En expedición sólo se ve el botín (con lo que se paga en el mercader), no el monedero de casa
      resEl.replaceChildren(...[
        exp ? pill('gift', exp.loot.coins, DK.t('exp.lootCoinsTip'), 'coins loot') : pill('coin', DK.wallet.get(), DK.t('hub.coins'), 'coins'),
        pill('emblem', DK.camp.emblems(), DK.t('emblem.title'), 'emblems'),
      ].filter(Boolean));
    },

    /**
     * Opciones de navegación según el modo. Durante una expedición sólo
     * se ven las marcadas con `expedition: true` (o 'only': sólo entonces).
     */
    navItems() {
      const inExp = !!(DK.store.state && DK.expedition && DK.expedition.active());
      return DK.menus.items('nav').filter((it) => (inExp ? !!it.expedition : it.expedition !== 'only'));
    },

    /**
     * Barra de accesos (abajo, como la barra de objetos de un juego). En
     * pantallas estrechas, si no caben, las fijas (`pin`) y «Más».
     */
    renderNav() {
      if (!dock || !lastEntry) return;
      const { h } = DK.ui;
      if (!this.navVisible(lastEntry.def)) { dock.replaceChildren(); this.renderHud(); return; }
      const active = lastEntry.def.section || lastEntry.entry.id;
      // v4.62: las que llevan dock:false no salen en la barra (Entrenamiento: se entra por el muñeco del campamento)
      const items = this.navItems().filter((it) => it.id !== 'profile' && it.dock !== false);
      const go = (it) => { DK.audio.sfx('select'); if (it.action) it.action(); else DK.router.reset(it.screen, typeof it.params === 'function' ? it.params() : it.params || {}); };
      const make = (it) => {
        const badge = it.badge ? it.badge() : '';
        const b = h('button', { class: 'dock-slot' + (active === it.id ? ' active' : '') + (it.id === 'battle' || it.id === 'expmap' ? ' main' : ''), type: 'button', 'aria-current': active === it.id ? 'page' : null, tip: val(it.label) },
          h('span', { class: 'dock-icon' }, DK.icon(it.icon, 22), badge ? h('span', { class: 'nav-dot' }, badge) : null),
          h('span', { class: 'dock-label' }, val(it.label)));
        b.addEventListener('click', () => go(it));
        return b;
      };
      const narrow = window.innerWidth <= 600;
      const pinned = (!narrow || items.length <= 5 ? items : items.filter((it) => it.pin)).slice();
      const rest = items.filter((it) => !pinned.includes(it));
      // v4.54: el botón principal (Batalla / Mapa) siempre en el centro de la barra
      const mainAt = pinned.findIndex((it) => it.id === 'battle' || it.id === 'expmap');
      if (mainAt >= 0) {
        const total = pinned.length + (rest.length ? 1 : 0), mid = Math.min(Math.floor(total / 2), pinned.length - 1);
        const [m] = pinned.splice(mainAt, 1); pinned.splice(mid, 0, m);
      }
      const slots = pinned.map(make);
      if (rest.length) {
        const badges = rest.map((it) => (it.badge ? it.badge() : '')).filter(Boolean);
        const num = badges.reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
        const more = h('button', { class: 'dock-slot dock-more' + (rest.some((it) => it.id === active) ? ' active' : ''), type: 'button', 'aria-haspopup': 'dialog' },
          h('span', { class: 'dock-icon' }, DK.icon('grid', 22), badges.length ? h('span', { class: 'nav-dot' }, num ? String(num) : '!') : null),
          h('span', { class: 'dock-label' }, DK.t('nav.more')));
        more.addEventListener('click', () => { DK.audio.sfx('select'); this.openMore(rest, active); });
        slots.push(more);
      }
      dock.replaceChildren(h('div', { class: 'dock-bar' }, slots));
      this.renderHud();
    },

    /** Hoja «Más» del móvil: el resto de secciones en botones grandes. */
    openMore(rest, active) {
      const { h } = DK.ui;
      return DK.ui.drawer({ id: 'navMore', title: DK.t('nav.more'), icon: 'grid', cls: 'more-sheet', content: (close) => h('div', { class: 'more-grid' }, rest.map((it) => {
        const badge = it.badge ? it.badge() : '';
        return h('button', { class: 'more-item' + (active === it.id ? ' active' : ''), type: 'button',
          onClick: () => { close(); DK.audio.sfx('select'); if (it.action) it.action(); else DK.router.reset(it.screen, typeof it.params === 'function' ? it.params() : it.params || {}); } },
          h('span', { class: 'more-icon' }, DK.icon(it.icon, 24), badge ? h('span', { class: 'nav-dot' }, badge) : null),
          h('span', { class: 'more-label' }, val(it.label)));
      })) });
    },

    /**
     * Menú de pausa (botón Menú o Esc cuando no hay a dónde volver):
     * perfil, buscar, ayuda, ajustes, tema, instalar y guardar y salir.
     */
    openMenu() {
      const { h, btn } = DK.ui;
      if (document.querySelector('.pause-menu')) return null;
      const dark = DK.settings.theme() === 'dark';
      const st = DK.store.state;
      const items = [
        st ? { icon: 'user', label: DK.t('nav.profile'), run: () => DK.router.reset('profile') } : null,
        { icon: 'search', label: DK.t('top.search'), hotkey: 'Ctrl K', run: () => DK.palette.open() },
        { icon: 'help', label: DK.t('top.help'), hotkey: '?', run: () => DK.help.open() },
        { icon: 'settings', label: DK.t('top.settings'), run: () => DK.settingsPanel.open() },
        { icon: dark ? 'sun' : 'moon', label: dark ? DK.t('top.light') : DK.t('top.dark'), run: () => this.toggleTheme() },
        this.canInstall() ? { icon: 'download', label: DK.t('settings.install'), run: () => this.install() } : null,
        st ? { icon: 'exit', label: DK.t('hub.saveExit'), cls: 'pause-exit', run: () => { DK.store.save(); DK.router.reset('mainMenu'); } } : null,
      ].filter(Boolean);
      const m = DK.ui.modal({ title: DK.t('pause.title'), icon: 'pause', cls: 'pause-menu', size: 'sm',
        content: (close) => h('div', { class: 'pause-list' },
          btn({ icon: 'play', label: DK.t('pause.resume'), variant: 'primary', size: 'lg', onClick: () => close() }),
          items.map((i) => btn({ icon: i.icon, label: i.label, hotkey: i.hotkey || null, variant: 'tone', size: 'lg', cls: i.cls || '', onClick: () => { close(); DK.audio.sfx('select'); i.run(); } }))) });
      DK.audio.sfx('select');
      return m;
    },

    /** Botones de la derecha del HUD: avisos y Menú. */
    renderActions() {
      const { btn, h } = DK.ui;
      // Campana de avisos (siempre visible) con el número de no leídos
      const bell = btn({ icon: 'bell', label: DK.t('notices.title'), variant: 'ghost', cls: 'topbar-bell hud-icon', tip: DK.t('notices.title'), onClick: () => DK.ui.openNotices() });
      const dot = h('span', { class: 'nav-dot bell-dot hidden' });
      bell.append(dot);
      const upd = () => { const n = DK.ui.unreadNotices(); dot.textContent = n > 9 ? '9+' : n; dot.classList.toggle('hidden', !n); };
      if (this._offBell) this._offBell();
      this._offBell = DK.on('notices:changed', upd);
      upd();
      const menu = btn({ icon: 'menu', label: DK.t('pause.menu'), variant: 'ghost', cls: 'hud-menu', tip: DK.t('pause.menuTip'), onClick: () => this.openMenu() });
      actionsEl.replaceChildren(bell, menu);
    },

    /** Alterna tema claro/oscuro. */
    toggleTheme() { DK.settings.set('theme', DK.settings.theme() === 'dark' ? 'light' : 'dark'); },

    /** ¿Se puede ofrecer "Instalar como app"? */
    canInstall() { return !!installPrompt; },
    /** Lanza el diálogo de instalación del navegador. */
    async install() {
      if (!installPrompt) return false;
      installPrompt.prompt();
      const r = await installPrompt.userChoice;
      installPrompt = null;
      return r && r.outcome === 'accepted';
    },

    /** Salir del juego: guarda e intenta cerrar la ventana. */
    exit() {
      DK.store.save();
      window.close(); // sólo funciona si la ventana la abrió un script
      setTimeout(() => DK.router.reset('goodbye'), 120);
    },
  };

  // Atajo global de ayuda
  document.addEventListener('keydown', (e) => {
    if ((e.key === '?' || e.key === 'F1') && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName) && DK.help && !DK.keys.inModal()) { e.preventDefault(); DK.help.open(); }
  });
})();
