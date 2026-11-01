/* =============================================================
 * components/todoCard.js — «Qué hacer ahora» (Inicio).
 *
 * Reúne lo pendiente en avisos que llevan directo al sitio con un toque:
 * entrenamientos listos, talentos, evoluciones, misiones, curar, tónicos,
 * mejoras asequibles, huecos de entrenamiento y recetas.
 *
 *   DK.todo.list()        → [{ id, icon, kind, text, cta, run() }] ordenada por prioridad
 *   DK.views.todoCard(refresh)
 * Para añadir un aviso: una entrada más en SOURCES (devuelve null si no aplica).
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const V = (DK.views = DK.views || {});
  /** Texto en singular (clave + 'One') cuando n es 1. */
  const tn = (key, n, v = {}) => t(n === 1 && DK.i18n.lookup(DK.i18n.lang, key + 'One') ? key + 'One' : key, { n, ...v });
  const go = (screen, params) => () => DK.router.reset(screen, params || {});

  const SOURCES = [
    // Entrenamientos que ya no ganan más (o llegaron al tope)
    () => { const n = DK.training.readyCount(); return n ? { id: 'train', icon: 'dumbbell', kind: 'good', text: tn('todo.trainReady', n), cta: t('train.collect'), run: go('training') } : null; },
    // Talentos por elegir
    () => {
      const ds = DK.party.all().filter((d) => !d.temp && DK.daskai.talentsPending(d).length);
      if (!ds.length) return null;
      return { id: 'talent', icon: 'star', kind: 'good', text: ds.length === 1 ? t('todo.talentOne', { name: DK.daskai.name(ds[0]) }) : t('todo.talentMany', { n: ds.length }),
        cta: t('todo.choose'), run: async () => { for (const d of ds) await V.talentDialog(d); } };
    },
    // Evoluciones listas
    () => {
      const d = DK.party.all().find((x) => !x.temp && DK.daskai.canEvolve(x));
      return d ? { id: 'evo', icon: 'evolve', kind: 'good', text: t('todo.evolve', { name: DK.daskai.name(d) }), cta: t('evo.button'), run: () => V.evolveDialog(d) } : null;
    },
    // Objetivos de crafteo listos para fabricar
    () => {
      const ready = DK.crafting.goalsReady();
      if (!ready.length) return null;
      return { id: 'goals', icon: 'star', kind: 'good', text: ready.length === 1 ? t('todo.goalOne', { item: D.items[ready[0].result].name }) : t('todo.goalMany', { n: ready.length }),
        cta: t('todo.craft'), run: go('craft', ready.length === 1 ? { sel: ready[0].id } : {}) };
    },
    // Misiones por cobrar
    () => { const n = DK.missions.claimable(); return n ? { id: 'missions', icon: 'gift', kind: 'good', text: tn('todo.missions', n), cta: t('todo.claim'), run: go('progress', { tab: 'missions' }) } : null; },
    // Equipo herido
    () => {
      const hurt = DK.party.active().filter((d) => DK.daskai.hpPct(d) < 0.5);
      if (!hurt.length) return null;
      const out = hurt.some((d) => DK.daskai.isFainted(d));
      return { id: 'heal', icon: 'flask', kind: out ? 'bad' : 'warn', text: out ? tn('todo.fainted', hurt.length) : tn('todo.hurt', hurt.length), cta: t('heal.button'), run: () => V.healDialog(DK.party.active()) };
    },
    // Tónicos en la bolsa
    () => {
      const n = Object.values(D.tonicFor).reduce((a, id) => a + DK.bag.count(id), 0);
      const lead = DK.party.leader();
      return n && lead ? { id: 'tonic', icon: 'flask', kind: '', text: tn('todo.tonics', n), cta: t('todo.use'), run: go('team', { uid: lead.uid, panel: { open: 'items' } }) } : null;
    },
    // Mejoras que ya puedes pagar
    // Huecos libres en el entrenamiento (si hay alguien en la reserva)
    () => {
      if (!DK.unlocks.has('training')) return null;
      const free = DK.training.slotCount() - DK.training.slots().length;
      const idle = DK.party.all().some((d) => !d.temp && !DK.party.isActive(d.uid) && !DK.training.isTraining(d.uid));
      return free > 0 && idle ? { id: 'trainFree', icon: 'dumbbell', kind: '', text: tn('todo.trainFree', free), cta: t('todo.see'), run: go('training') } : null;
    },
    // Recetas que se pueden fabricar ya
    () => { const n = D.recipes.filter((r) => DK.crafting.canCraft(r)).length; return n ? { id: 'craft', icon: 'anvil', kind: '', text: tn('todo.craft', n), cta: t('todo.see'), run: go('craft') } : null; },
  ];

  DK.todo = {
    list() { return SOURCES.map((f) => { try { return f(); } catch (e) { return null; } }).filter(Boolean); },
  };

  /** Tarjeta del Inicio: los 3 primeros avisos (y «ver más»). */
  V.todoCard = (refresh, state = {}) => {
    const items = DK.todo.list();
    const shown = state.all ? items : items.slice(0, 3);
    const row = (it) => h('button', { class: 'todo-item k-' + (it.kind || 'info'), type: 'button', onClick: async () => { DK.audio.sfx('select'); await it.run(); refresh(); } },
      h('span', { class: 'todo-icon' }, DK.icon(it.icon, 18)),
      h('span', { class: 'todo-text' }, it.text),
      h('span', { class: 'todo-cta' }, it.cta, DK.icon('next', 14)));
    return h('div', { class: 'card todo-card' },
      h('div', { class: 'panel-head' }, DK.icon('bolt', 18), h('h3', null, t('todo.title')),
        items.length ? h('span', { class: 'badge' }, String(items.length)) : null),
      items.length ? h('div', { class: 'todo-list' }, shown.map(row),
        items.length > 3 ? btn({ icon: state.all ? 'arrowUp' : 'arrowDown', label: state.all ? t('todo.less') : t('todo.more', { n: items.length - 3 }), size: 'sm', variant: 'ghost', onClick: () => { state.all = !state.all; refresh(); } }) : null)
        : h('div', { class: 'todo-empty' }, DK.icon('check', 18), h('span', null, t('todo.none'))));
  };
})();
