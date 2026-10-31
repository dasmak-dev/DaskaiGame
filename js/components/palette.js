/* =============================================================
 * components/palette.js — Buscador de comandos (Ctrl+K / Cmd+K).
 *
 * Escribe "poción", "Aquelo", "volcán", "ajustes"... y salta allí o
 * ejecuta la acción. Para añadir resultados propios:
 *   DK.palette.addSource(() => [{ icon, label, hint, group, run: () => {...} }]);
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const D = DK.data;
  const t = (k, v) => DK.t(k, v);
  const val = (x) => (typeof x === 'function' ? x() : x);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const sources = [];
  /** ¿Hay una expedición en curso? Entonces sólo se ofrece lo de la expedición. */
  const inExp = () => !!DK.expedition.active();

  /* ---------- Fuentes de resultados ---------- */
  // Secciones de la navegación
  sources.push(() => DK.app.navItems().map((n) => ({ group: t('palette.sections'), icon: n.icon, label: val(n.label), run: () => DK.router.reset(n.screen) })));
  // Daskai del jugador
  sources.push(() => DK.party.all().filter((d) => !inExp() || DK.party.isActive(d.uid) || DK.party.canJoin(d.uid)).map((d) => ({ group: t('palette.daskai'), icon: 'paw', label: DK.daskai.name(d), hint: `${t('common.lvl')} ${d.level} · ${DK.tr('houses', D.houses[DK.daskai.species(d).house])}`, run: () => DK.router.reset('team', { uid: d.uid }) })));
  // Objetos (los que tienes primero)
  sources.push(() => Object.values(D.items).filter((it) => !inExp() || DK.bag.count(it.id)).map((it) => ({ group: t('palette.items'), icon: it.icon, label: it.name, hint: DK.bag.count(it.id) ? t('item.owned', { n: DK.bag.count(it.id) }) : t('palette.notOwned'), weight: DK.bag.count(it.id) ? 1 : 0,
    run: () => DK.router.reset('inventory', DK.bag.count(it.id) ? { item: it.id } : { q: it.name }) })));
  // Zonas desbloqueadas
  sources.push(() => (inExp() ? [] : DK.world.unlockedZones()).map((z) => ({ group: t('palette.zones'), icon: z.icon, label: z.name, hint: `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`, run: () => DK.router.reset('zones', { zone: z.id }) })));
  // Acciones
  sources.push(() => [
    { icon: 'play', label: t('home.play'), run: () => DK.play.quick() },
    { icon: 'flask', label: t('heal.button'), run: async () => { if (await DK.views.healDialog(DK.party.active())) DK.router.refresh(); } },
    { icon: 'anvil', label: t('nav.craft'), home: true, run: () => DK.router.reset('craft') },
    { icon: 'scroll', label: t('menu.missions'), home: true, run: () => DK.router.reset('progress', { tab: 'missions' }) },
    { icon: 'award', label: t('menu.achievements'), home: true, run: () => DK.router.reset('progress', { tab: 'ach' }) },
    { icon: 'settings', label: t('top.settings'), run: () => DK.settingsPanel.open() },
    { icon: 'help', label: t('top.help'), run: () => DK.help.open() },
    { icon: 'contrast', label: t('palette.toggleTheme'), run: () => DK.app.toggleTheme() },
    { icon: DK.settings.get('muted') ? 'volume' : 'volumeOff', label: DK.settings.get('muted') ? t('battle.unmute') : t('battle.mute'), run: () => DK.settings.set('muted', !DK.settings.get('muted')) },
    { icon: 'exit', label: t('hub.saveExit'), run: () => { DK.store.save(); DK.router.reset('mainMenu'); } },
  ].filter((a) => !(a.home && inExp())).map((a) => ({ ...a, group: t('palette.actions') })));

  /** Lista de resultados para un texto. */
  function search(q) {
    const nq = norm(q.trim());
    const all = sources.flatMap((s) => { try { return s(); } catch (e) { return []; } });
    if (!nq) return all.filter((r) => r.group === t('palette.sections') || r.group === t('palette.actions')).slice(0, 14);
    return all
      .map((r) => {
        const l = norm(r.label), hnt = norm(r.hint);
        const score = l.startsWith(nq) ? 3 : l.includes(nq) ? 2 : hnt.includes(nq) ? 1 : 0;
        return { r, score: score + (r.weight || 0) * 0.5 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((x) => x.r);
  }

  DK.palette = {
    /** Añade una fuente de resultados: () => [{icon, label, hint, group, run}] */
    addSource(fn) { sources.push(fn); },

    /** Abre el buscador. */
    open() {
      if (!DK.store.state) return;
      if (document.querySelector('.palette')) return;
      const input = h('input', { class: 'input palette-input', type: 'search', placeholder: t('palette.placeholder'), 'aria-label': t('palette.placeholder'), autocomplete: 'off' });
      const list = h('div', { class: 'palette-list', role: 'listbox' });
      let results = [], idx = 0, m;
      const run = (r) => { m.close(); setTimeout(() => r.run(), 30); };
      const draw = () => {
        results = search(input.value);
        idx = Math.min(idx, Math.max(0, results.length - 1));
        let lastGroup = null;
        list.replaceChildren(...(results.length ? results.flatMap((r, i) => {
          const out = [];
          if (r.group !== lastGroup) { out.push(h('div', { class: 'palette-group' }, r.group)); lastGroup = r.group; }
          const row = h('button', { class: 'palette-item' + (i === idx ? ' active' : ''), type: 'button', role: 'option', 'aria-selected': i === idx },
            DK.icon(r.icon || 'next', 18), h('span', { class: 'grow' }, r.label), r.hint ? h('span', { class: 'muted small' }, r.hint) : null);
          row.addEventListener('mouseenter', () => { idx = i; list.querySelectorAll('.palette-item').forEach((el, j) => el.classList.toggle('active', j === idx)); });
          row.addEventListener('click', () => run(r));
          out.push(row);
          return out;
        }) : [DK.ui.empty('search', t('palette.noResults'), '')]));
        const act = list.querySelector('.palette-item.active');
        if (act) act.scrollIntoView({ block: 'nearest' });
      };
      input.addEventListener('input', () => { idx = 0; draw(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(results.length - 1, idx + 1); draw(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
        if (e.key === 'Enter' && results[idx]) { e.preventDefault(); run(results[idx]); }
      });
      m = DK.ui.modal({ title: t('palette.title'), icon: 'search', cls: 'palette', content: h('div', null, input, list, h('p', { class: 'muted small palette-help' }, t('palette.help'))) });
      draw();
      setTimeout(() => input.focus(), 40);
    },
  };

  // Ctrl+K / Cmd+K desde cualquier sitio (salvo en combate)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const cur = DK.router.current();
      if (cur && DK.screens.get(cur.id).nav === false && cur.id !== 'mainMenu') return;
      DK.palette.open();
    }
  });
})();
