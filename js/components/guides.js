/* =============================================================
 * components/guides.js — Tutorial guiado y ventana de Ayuda.
 *
 * TUTORIAL
 *   Cada pantalla con `tutorial: 'clave'` muestra, la primera vez,
 *   los pasos definidos en el idioma: lang/es.js → tut.<clave> = [{title, text, icon}]
 *   DK.tutorial.show('battle', true)  → fuerza mostrarlo
 *   DK.tutorial.reset()               → vuelve a mostrar todos
 *
 * AYUDA (botón "Ayuda" o tecla ?) — se abre en un panel lateral
 *   DK.help.open('houses')  → pestañas: houses, combat, keys, glossary
 * ============================================================= */
(function () {
  const { h, btn, modal, tabs } = DK.ui;
  const D = DK.data;
  const { t } = DK;

  /* ======================= TUTORIAL ======================= */
  DK.tutorial = {
    /** Muestra el tutorial de una pantalla si no se ha visto. */
    maybe(id) {
      if (!DK.settings.get('tutorials') || !DK.store.state) return;
      if (DK.settings.get('seenTutorials')[id]) return;
      setTimeout(() => this.show(id), 350);
    },
    /** Marca un tutorial como visto. */
    markSeen(id) { const s = Object.assign({}, DK.settings.get('seenTutorials')); s[id] = true; DK.settings.set('seenTutorials', s); },
    /** Vuelve a activar todos los tutoriales. */
    reset() { DK.settings.set('seenTutorials', {}); DK.settings.set('tutorials', true); },

    /** Muestra los pasos de un tutorial. */
    show(id) {
      const steps = DK.i18n.lookup(DK.i18n.lang, 'tut.' + id) || DK.i18n.lookup('es', 'tut.' + id);
      if (!Array.isArray(steps) || !steps.length) return;
      let i = 0;
      const body = h('div', { class: 'tutorial' });
      const dots = h('div', { class: 'tut-dots' });
      let m;
      const draw = () => {
        const s = steps[i];
        body.replaceChildren(
          h('div', { class: 'tut-icon' }, DK.icon(s.icon || 'info', 34)),
          h('h3', null, s.title), h('p', null, s.text),
          dots);
        dots.replaceChildren(...steps.map((_, j) => h('span', { class: j === i ? 'on' : '' })));
        m.el.querySelector('.tut-prev').disabled = i === 0;
        m.el.querySelector('.tut-next .btn-label').textContent = i === steps.length - 1 ? t('tut.finish') : t('tut.next');
      };
      m = modal({
        title: t('tut.title'), icon: 'help', content: body, dismissable: true,
        actions: [
          { label: t('tut.skipAll'), icon: 'x', variant: 'ghost', onClick: (close) => { DK.settings.set('tutorials', false); close(); } },
          { label: t('tut.prev'), icon: 'back', variant: 'ghost', cls: 'tut-prev', onClick: () => { if (i > 0) { i--; draw(); } } },
          { label: t('tut.next'), icon: 'next', variant: 'primary', cls: 'tut-next', onClick: (close) => { if (i < steps.length - 1) { i++; draw(); } else close(); } },
        ],
      });
      DK.keys.on('ArrowRight', () => { if (i < steps.length - 1) { i++; draw(); } });
      DK.keys.on('ArrowLeft', () => { if (i > 0) { i--; draw(); } });
      draw();
      m.promise.then(() => this.markSeen(id));
    },
  };

  /* ======================= AYUDA ======================= */

  /** Diagrama en pentágono del ciclo de casas. */
  function houseCycle() {
    const order = ['luz', 'oscuridad', 'agua', 'fuego', 'tierra'];
    const R = 108, cx = 170, cy = 172; // las etiquetas van hacia fuera para no pisar las flechas
    const pts = order.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    let arrows = '';
    pts.forEach(([x1, y1], i) => {
      const [x2, y2] = pts[(i + 1) % 5];
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const sx = x1 + ux * 34, sy = y1 + uy * 34, ex = x2 - ux * 38, ey = y2 - uy * 38;
      arrows += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="currentColor" stroke-width="2.5" marker-end="url(#arr)" opacity=".7"/>`;
    });
    const nodes = order.map((id, i) => {
      const [x, y] = pts[i];
      // Etiqueta fuera de las flechas: arriba la de arriba, debajo y hacia fuera las demás
      const [ox, oy] = [[0, -40], [22, 50], [18, 50], [-18, 50], [-22, 50]][i];
      return `<circle cx="${x}" cy="${y}" r="30" fill="${D.houseColor(id)}" opacity=".9"/><text x="${x + ox}" y="${y + oy}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${DK.tr('houses', D.houses[id])}</text>`;
    }).join('');
    const wrap = h('div', { class: 'house-cycle' });
    wrap.innerHTML = `<svg viewBox="-10 0 360 350" role="img" aria-label="${t('help.cycleAria')}"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>${arrows}${nodes}</svg>`;
    // Iconos encima de los círculos
    order.forEach((id, i) => {
      const [x, y] = pts[i];
      const ic = DK.icon(D.houses[id].icon, 26, 'cycle-icon');
      ic.style.left = ((x + 10) / 360) * 100 + '%'; ic.style.top = (y / 350) * 100 + '%';
      wrap.append(ic);
    });
    return wrap;
  }

  const keysList = () => [
    ['1-9', t('help.keys.menu')], ['Esc', t('help.keys.back')], ['?', t('help.keys.help')],
    ['1-4', t('help.keys.moves')], ['B · C · F · S', t('help.keys.battleActions')], ['Ctrl K', t('help.keys.palette')], ['R', t('help.keys.repeat')],
    ['A', t('help.keys.auto')], ['V', t('help.keys.speed')], ['Space', t('help.keys.skip')], ['L', t('help.keys.log')],
  ];

  DK.help = {
    /** Abre la ventana de ayuda en una pestaña. */
    open(tab = 'houses') {
      DK.ui.drawer({
        id: 'help', title: t('help.title'), icon: 'help', size: 'wide',
        content: tabs({
          active: tab,
          items: [
            { id: 'houses', label: t('help.houses'), icon: 'sun', render: () => h('div', { class: 'help-houses' }, houseCycle(),
              h('div', null, h('p', null, t('help.housesText', { strong: Math.round((DK.config.house.strongDamage - 1) * 100), weak: Math.round(DK.config.house.weakDefense * 100) })),
                h('div', { class: 'list' }, Object.values(D.houses).map((hs) => h('div', { class: 'help-house-row' }, DK.views.houseBadge(hs.id),
                  h('span', { class: 'small' }, t('help.houseRow', { strong: DK.tr('houses', D.houses[hs.strongVs]), weak: DK.tr('houses', DK.views.weakAgainst(hs.id)) }))))))) },
            { id: 'combat', label: t('help.combat'), icon: 'swords', render: () => h('ul', { class: 'help-list' }, (DK.i18n.lookup(DK.i18n.lang, 'help.combatRules') || DK.i18n.lookup('es', 'help.combatRules')).map((r) => h('li', null, r))) },
            { id: 'keys', label: t('help.keys.title'), icon: 'keyboard', render: () => h('div', { class: 'keys-grid' }, keysList().map(([k, d]) => h('div', { class: 'key-row' }, h('kbd', null, k), h('span', null, d)))) },
            { id: 'glossary', label: t('help.glossary'), icon: 'book2', render: () => h('div', { class: 'list' },
              [...D.statKeys, 'regen'].map((k) => h('div', { class: 'gloss-row' }, DK.icon(D.stats[k].icon, 16), h('b', null, DK.tr('stats', D.stats[k])), h('span', { class: 'muted small' }, t('tips.stat.' + k)))),
              Object.values(D.statuses).map((s) => h('div', { class: 'gloss-row' }, DK.views.statusTag(s.id), h('span', { class: 'muted small' }, DK.tr('statuses', s, 'desc'))))) },
          ],
        }),
        actions: [
          { label: t('help.replayTutorial'), icon: 'refresh', variant: 'ghost', onClick: (close) => { close(); const cur = DK.screens.get(DK.router.current().id); if (cur && cur.tutorial) DK.tutorial.show(cur.tutorial); } },
          { label: t('common.close'), icon: 'x', variant: 'primary' },
        ],
      });
    },
  };
})();
