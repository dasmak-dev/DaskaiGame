/* =============================================================
 * core/app.js — Carcasa de la aplicación.
 *
 *  ┌──────────── barra superior: Volver · ruta (Sección › Pantalla) · Buscar · Ayuda · Ajustes · Tema
 *  │ navegación │
 *  │  lateral   │   contenido de la pantalla
 *  │ (escritorio│
 *  └────────────┴── en móvil la navegación pasa a una barra inferior
 *
 * La navegación sale del menú 'nav' (DK.menus). Cada pantalla de
 * primer nivel se añade sola:
 *   DK.menus.add('nav', { id: 'team', icon: 'users', label: () => DK.t('nav.team'), screen: 'team', order: 20 });
 * y en su definición indica a qué sección pertenece: section: 'team'.
 * Las pantallas con `nav: false` (menú principal, combate...) ocultan la navegación.
 * ============================================================= */
(function () {
  let topbar, titleEl, backBtn, actionsEl, screenHost, sideNav, bottomNav;
  let installPrompt = null;
  let lastEntry = null;

  const val = (x) => (typeof x === 'function' ? x() : x);

  DK.menus.define('nav');

  DK.app = {
    /** Arranca el juego: aplica ajustes, construye la carcasa y abre el menú principal. */
    init() {
      const { h, btn } = DK.ui;
      DK.settings.apply();
      const root = document.getElementById('app');
      backBtn = btn({ icon: 'back', label: DK.t('common.back'), variant: 'ghost', onClick: () => DK.router.back(), hotkey: 'Esc' });
      titleEl = h('nav', { class: 'topbar-title', 'aria-label': DK.t('nav.breadcrumb') });
      actionsEl = h('div', { class: 'topbar-right' });
      topbar = h('header', { class: 'topbar' }, h('div', { class: 'topbar-left' }, backBtn), titleEl, actionsEl);
      sideNav = h('nav', { class: 'side-nav', 'aria-label': DK.t('nav.main') });
      bottomNav = h('nav', { class: 'bottom-nav', 'aria-label': DK.t('nav.main') });
      screenHost = h('main', { class: 'screen-host', id: 'main' });
      root.append(h('a', { class: 'skip-link', href: '#main' }, DK.t('common.skipToContent')), topbar,
        h('div', { class: 'app-body' }, sideNav, screenHost), bottomNav);
      this.renderActions();

      // Reconstruir textos cuando cambian idioma o tema
      DK.on('settings:changed', ({ key }) => {
        if (key === 'lang' || key === 'theme' || !key) {
          backBtn.querySelector('.btn-label').textContent = DK.t('common.back');
          this.renderActions();
          this.renderNav();
        }
      });
      // Las insignias de la navegación cambian con el juego
      ['battle:end', 'mission:ready', 'crafted', 'coins', 'game:loaded'].forEach((ev) => DK.on(ev, () => this.renderNav()));

      // Instalación como app (sólo navegadores compatibles y servido por http/https)
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; DK.emit('app:installable'); });
      if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

      DK.router.reset('mainMenu');
    },

    /**
     * Muestra una pantalla en el contenedor (lo llama el router).
     * @param {HTMLElement} el   contenido
     * @param {Object} def       definición de la pantalla
     * @param {Object} entry     {id, params}
     * @param {boolean} canBack  mostrar botón Volver
     * @param {string} dir       'forward' | 'back' | 'fade' | 'none'
     */
    mount(el, def, entry, canBack, dir) {
      lastEntry = { def, entry };
      backBtn.style.visibility = canBack ? 'visible' : 'hidden';
      this.renderTitle(def, entry);
      if (dir !== 'none') el.classList.add('screen-enter', 'enter-' + dir);
      screenHost.replaceChildren(el);
      if (dir !== 'none') { screenHost.scrollTop = 0; window.scrollTo(0, 0); }
      document.body.dataset.screen = entry.id;
      document.body.dataset.nav = this.navVisible(def) ? 'on' : 'off';
      this.renderNav();
    },

    /** ¿Se muestra la navegación en esta pantalla? */
    navVisible(def) { return !!DK.store.state && def.nav !== false; },

    /** Ruta de la barra superior: "Equipo › Aquelo". */
    renderTitle(def, entry) {
      const { h } = DK.ui;
      const tt = typeof def.title === 'function' ? def.title(entry.params) : def.title;
      const section = def.section && DK.menus.items('nav').find((n) => n.id === def.section);
      const parts = [];
      if (section && section.screen !== entry.id) {
        parts.push(h('button', { class: 'crumb', type: 'button', onClick: () => DK.router.reset(section.screen) }, DK.icon(section.icon, 18), h('span', null, val(section.label))));
        parts.push(h('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '›'));
        parts.push(h('span', { class: 'crumb current' }, tt || ''));
      } else {
        if (def.icon && tt) parts.push(DK.icon(def.icon, 20));
        parts.push(h('span', null, tt || ''));
      }
      titleEl.replaceChildren(...parts);
    },

    /**
     * Opciones de navegación según el modo. Durante una expedición sólo
     * se ven las marcadas con `expedition: true` (o 'only': sólo entonces).
     */
    navItems() {
      const inExp = !!(DK.store.state && DK.expedition && DK.expedition.active());
      return DK.menus.items('nav').filter((it) => (inExp ? !!it.expedition : it.expedition !== 'only'));
    },

    /** Pinta la navegación lateral y la inferior. */
    renderNav() {
      if (!sideNav || !lastEntry) return;
      const { h } = DK.ui;
      if (!this.navVisible(lastEntry.def)) { sideNav.replaceChildren(); bottomNav.replaceChildren(); return; }
      const active = lastEntry.def.section || lastEntry.entry.id;
      const items = this.navItems();
      const make = (it, cls) => {
        const badge = it.badge ? it.badge() : '';
        const b = h('button', { class: cls + (active === it.id ? ' active' : ''), type: 'button', 'aria-current': active === it.id ? 'page' : null, tip: cls === 'bnav-item' ? val(it.label) : null },
          h('span', { class: 'nav-icon' }, DK.icon(it.icon, 20), badge ? h('span', { class: 'nav-dot' }, badge) : null),
          h('span', { class: 'nav-label' }, val(it.label)));
        b.addEventListener('click', () => { DK.audio.sfx('select'); if (it.action) it.action(); else DK.router.reset(it.screen, typeof it.params === 'function' ? it.params() : it.params || {}); });
        return b;
      };
      const st = DK.store.state;
      const exp = st && DK.expedition.active();
      sideNav.replaceChildren(
        h('div', { class: 'nav-brand' }, h('span', { class: 'nav-logo' }, 'DASKAI')),
        // En expedición: tarjeta de la expedición en vez del perfil
        exp ? DK.views.expNavCard(exp)
          : st ? h('button', { class: 'nav-profile' + (active === 'profile' ? ' active' : ''), type: 'button', tip: DK.t('nav.profile'), onClick: () => DK.router.reset('profile') },
            DK.views.avatar(st.player, { size: 40 }), h('span', { class: 'nav-profile-text' }, h('b', null, st.player.name), h('span', { class: 'muted small' }, DK.avatars.titleText(st.player)))) : null,
        ...items.filter((it) => it.id !== 'profile').map((it) => make(it, 'nav-item')),
        h('div', { class: 'nav-footer' }, st ? DK.views.coins(DK.wallet.get()) : null,
          exp ? h('span', { class: 'nav-loot', tip: DK.t('exp.lootCoinsTip') }, DK.icon('gift', 14), ' ', exp.loot.coins) : null));
      // Barra inferior (móvil): si caben (≤ 5) van todas; si no, las fijas (`pin`) y «Más»
      const pinned = items.length <= 5 ? items : items.filter((it) => it.pin);
      const rest = items.filter((it) => !pinned.includes(it));
      const bottom = pinned.map((it) => make(it, 'bnav-item'));
      if (rest.length) {
        const badges = rest.map((it) => (it.badge ? it.badge() : '')).filter(Boolean);
        const num = badges.reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
        const on = rest.some((it) => it.id === active);
        const more = h('button', { class: 'bnav-item bnav-more' + (on ? ' active' : ''), type: 'button', 'aria-haspopup': 'dialog' },
          h('span', { class: 'nav-icon' }, DK.icon('grid', 20), badges.length ? h('span', { class: 'nav-dot' }, num ? String(num) : '!') : null),
          h('span', { class: 'nav-label' }, DK.t('nav.more')));
        more.addEventListener('click', () => { DK.audio.sfx('select'); this.openMore(rest, active); });
        bottom.push(more);
      }
      bottomNav.replaceChildren(...bottom);
    },

    /** Hoja «Más» del móvil: el resto de secciones en botones grandes. */
    openMore(rest, active) {
      const { h } = DK.ui;
      const d = DK.ui.drawer({ id: 'navMore', title: DK.t('nav.more'), icon: 'grid', cls: 'more-sheet', content: (close) => h('div', { class: 'more-grid' }, rest.map((it) => {
        const badge = it.badge ? it.badge() : '';
        return h('button', { class: 'more-item' + (active === it.id ? ' active' : ''), type: 'button',
          onClick: () => { close(); DK.audio.sfx('select'); if (it.action) it.action(); else DK.router.reset(it.screen, typeof it.params === 'function' ? it.params() : it.params || {}); } },
          h('span', { class: 'more-icon' }, DK.icon(it.icon, 24), badge ? h('span', { class: 'nav-dot' }, badge) : null),
          h('span', { class: 'more-label' }, val(it.label)));
      })) });
      return d;
    },

    /** Botones de la derecha de la barra superior. */
    renderActions() {
      const { btn, h } = DK.ui;
      const dark = DK.settings.theme() === 'dark';
      const items = [
        { icon: 'search', label: DK.t('top.search'), onClick: () => DK.palette.open(), hotkey: 'Ctrl K' },
        { icon: 'help', label: DK.t('top.help'), onClick: () => DK.help.open(), hotkey: '?' },
        { icon: 'settings', label: DK.t('top.settings'), onClick: () => DK.settingsPanel.open() },
        { icon: dark ? 'sun' : 'moon', label: dark ? DK.t('top.light') : DK.t('top.dark'), onClick: () => this.toggleTheme() },
      ];
      const wide = h('div', { class: 'topbar-actions' }, items.map((i) => btn({ ...i, variant: 'ghost', tip: i.hotkey ? `${i.label} (${i.hotkey})` : i.label })));
      const more = btn({ icon: 'menu', label: DK.t('top.more'), variant: 'ghost', cls: 'topbar-more', onClick: () => {
        DK.ui.drawer({ id: 'more', title: DK.t('top.more'), icon: 'menu', content: (close) => h('div', { class: 'menu menu-stack' },
          (DK.store.state ? [{ icon: 'user', label: DK.t('nav.profile'), onClick: () => DK.router.reset('profile') }] : []).concat(items).map((i) => btn({ ...i, hotkey: null, variant: 'tone', size: 'lg', onClick: () => { close(); i.onClick(); } }))) });
      } });
      // Campana de avisos (siempre visible) con el número de no leídos
      const bell = btn({ icon: 'bell', label: DK.t('notices.title'), variant: 'ghost', cls: 'topbar-bell', tip: DK.t('notices.title'), onClick: () => DK.ui.openNotices() });
      const dot = h('span', { class: 'nav-dot bell-dot hidden' });
      bell.append(dot);
      const upd = () => { const n = DK.ui.unreadNotices(); dot.textContent = n > 9 ? '9+' : n; dot.classList.toggle('hidden', !n); };
      if (this._offBell) this._offBell();
      this._offBell = DK.on('notices:changed', upd);
      upd();
      actionsEl.replaceChildren(bell, wide, more);
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
