/* =============================================================
 * screens/training.js — Campo de entrenamiento (DK.training).
 *
 * Huecos con daskai entrenando en tiempo real. Cada hueco muestra el
 * tiempo, la barra de rendimiento (100% → 50% → tope) y lo ganado; al
 * pulsar «Recoger» se aplica y vuelve al equipo si hay sitio.
 * Para meter a uno: hueco libre → eliges daskai → experiencia o un atributo.
 * No se puede abrir durante una expedición (DK.router.guard).
 *
 * params: { pick: true (eligiendo daskai), uid, kind, stat }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);
  const T = () => DK.training;

  DK.menus.add('nav', {
    id: 'training', icon: 'dumbbell', order: 17, screen: 'training', mobile: false, label: () => t('nav.training'),
    badge: () => { const n = DK.store.state ? T().readyCount() : 0; return n ? String(n) : ''; },
  });

  const hours = (x) => DK.util.duration(Math.round(x * 3600));

  /** Hueco ocupado: progreso en vivo y botón de recoger. */
  function busySlot(slot, refresh) {
    const p = T().progress(slot), d = p.d;
    if (!d) return null;
    const T0 = DK.config.training;
    const what = slot.kind === 'exp'
      ? t('train.gotExp', { n: (p.exp || 0).toLocaleString(DK.i18n.lang) })
      : t('train.gotStat', { n: p.gain || 0, stat: DK.tr('stats', D.stats[slot.stat]) });
    const phase = p.done ? t('train.phaseDone') : p.hours < T0.fullHours ? t('train.phaseFull') : t('train.phaseHalf');
    const collect = async () => {
      const r = T().collect(slot.uid);
      DK.audio.sfx('levelup');
      DK.ui.toast(r.kind === 'exp' ? t('train.collectedExp', { name: DK.daskai.name(d), n: r.exp }) : t('train.collectedStat', { name: DK.daskai.name(d), n: r.gain, stat: DK.tr('stats', D.stats[r.stat]) }), { icon: 'dumbbell', kind: 'good' });
      if (r.levelInfo) await V.afterLevel(d, r.levelInfo);
      DK.app.renderNav(); refresh();
    };
    return h('div', { class: 'card train-slot busy' + (p.done || p.capped ? ' ready' : '') },
      h('div', { class: 'train-slot-head' },
        h('div', { class: 'train-sprite' }, V.dSprite(d, { size: 72, cls: 'idle' })),
        h('div', { class: 'grow' },
          h('div', { class: 'row gap-s wrap' }, h('b', null, DK.daskai.name(d)), V.level(d.level)),
          h('span', { class: 'chip' }, DK.icon(slot.kind === 'exp' ? 'star' : D.stats[slot.stat].icon, 13),
            slot.kind === 'exp' ? t('train.kindExp') : t('train.kindStatOf', { stat: DK.tr('stats', D.stats[slot.stat]) })))),
      h('div', { class: 'train-progress', tip: t('train.curveTip', { a: T0.fullHours, b: T0.halfHours }) },
        h('div', { class: 'train-bar' }, h('span', { style: { width: Math.round(p.pct * 100) + '%' } }),
          h('i', { class: 'mark', style: { left: (T0.fullHours / T().maxEff()) * 100 + '%' } })),
        h('div', { class: 'row between small' }, h('span', null, DK.icon('clock', 12), ' ', hours(p.hours)), h('span', { class: 'muted' }, phase))),
      h('p', { class: 'train-got' }, DK.icon('sparkles', 14), ' ', h('b', null, what),
        p.capped ? h('span', { class: 'badge warn' }, slot.kind === 'exp' ? t('train.capLevel', { n: T().levelCap() }) : t('train.capStat')) : null,
        slot.kind === 'stat' && !p.capped && !p.done ? h('span', { class: 'muted small' }, ' · ', t('train.nextPoint', { time: hours(p.nextIn / (1 + T().instr().rate)) })) : null),
      btn({ icon: 'check', label: t('train.collect'), variant: p.done || p.capped ? 'primary' : 'tone', onClick: collect }));
  }

  /** Hueco libre: botón para meter a alguien. */
  const freeSlot = (params, refresh) => h('button', { class: 'card train-slot free', type: 'button', onClick: () => { params.pick = true; params.uid = null; refresh(); } },
    DK.icon('plus', 26), h('b', null, t('train.free')), h('span', { class: 'muted small' }, t('train.freeHint')));

  const lockedSlot = () => h('div', { class: 'card train-slot locked', tip: t('train.lockedTip') }, DK.icon('lock', 22), h('span', { class: 'muted small' }, t('train.locked')));

  /** Elegir daskai y tipo de entrenamiento. */
  function picker(params, refresh) {
    const list = DK.party.all().filter((d) => !d.temp && !T().isTraining(d.uid)).sort((a, b) => b.level - a.level);
    const d = params.uid && DK.party.get(params.uid);
    params.kind = params.kind || 'exp';
    params.stat = params.stat || 'atk';
    const back = btn({ icon: 'back', label: t('common.back'), size: 'sm', variant: 'ghost', onClick: () => { params.pick = false; params.uid = null; refresh(); } });
    if (!d) {
      return h('div', { class: 'panel stack-s' },
        h('div', { class: 'panel-head' }, DK.icon('users', 18), h('h3', null, t('train.pickTitle')), back),
        h('p', { class: 'muted small' }, t('train.pickHint', { n: T().levelCap() })),
        list.length ? h('div', { class: 'list' }, list.map((x) => {
          const why = T().cannot(x, 'exp') && T().cannot(x, 'stat');
          return V.daskaiRow(x, { compact: true, onClick: () => { params.uid = x.uid; refresh(); },
            tags: [DK.party.isActive(x.uid) ? h('span', { class: 'badge' }, t('team.inTeam')) : null, why ? h('span', { class: 'badge warn' }, why) : null].filter(Boolean) });
        })) : DK.ui.empty('users', t('train.nobody'), ''));
    }
    const kind = params.kind, stat = params.stat;
    const why = T().cannot(d, kind);
    const cost = T().cost(d, kind);
    const C = DK.config.training;
    const go = () => {
      if (!T().start(d.uid, kind, stat)) { DK.audio.sfx('error'); DK.ui.toast(T().cannot(d, kind) || t('train.cant'), { icon: 'alert', kind: 'bad' }); return; }
      DK.audio.sfx('select'); DK.ui.toast(t('train.started', { name: DK.daskai.name(d) }), { icon: 'dumbbell', kind: 'good' });
      params.pick = false; params.uid = null; DK.app.renderNav(); refresh();
    };
    const statKeys = D.statKeys;
    return h('div', { class: 'panel stack' },
      h('div', { class: 'panel-head' }, DK.icon('dumbbell', 18), h('h3', null, t('train.setup', { name: DK.daskai.name(d) })), back),
      V.daskaiRow(d, { compact: true }),
      h('div', { class: 'stack-s' }, h('b', null, t('train.kind')),
        DK.ui.segmented({ options: [{ value: 'exp', label: t('train.kindExp'), icon: 'star' }, { value: 'stat', label: t('train.kindStat'), icon: 'chart' }], value: kind, onChange: (v) => { params.kind = v; refresh(); } }),
        h('p', { class: 'muted small' }, kind === 'exp'
          ? t('train.expHelp', { n: C.expPerHour(d.level).toLocaleString(DK.i18n.lang), cap: T().levelCap() })
          : t('train.statHelp', { h: C.statHours, max: C.statMax, have: Math.round(T().trainedTotal(d)) }))),
      kind === 'stat' ? h('div', { class: 'train-stats' }, statKeys.map((k) => h('button', { class: 'train-stat' + (stat === k ? ' on' : ''), type: 'button', onClick: () => { params.stat = k; refresh(); } },
        DK.icon(D.stats[k].icon, 16), h('span', null, DK.tr('stats', D.stats[k])), h('b', { class: 'small' }, '+' + C.statPer[k]), V.growthBadge(d, k)))) : null,
      h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('train.rules', { a: C.fullHours, b: C.halfHours }))),
      DK.party.isActive(d.uid) ? h('p', { class: 'small warn-text' }, DK.icon('alert', 13), ' ', t('train.leavesTeam')) : null,
      h('div', { class: 'row gap-s wrap between' }, V.coins(cost),
        btn({ icon: 'dumbbell', label: t('train.start', { n: cost }), variant: 'primary', disabled: !!why, tip: why, onClick: go })),
      why ? h('p', { class: 'small bad-text' }, why) : null);
  }

  DK.screens.register('training', {
    title: () => t('nav.training'), icon: 'dumbbell', section: 'camp', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      const slots = T().slots(), n = T().slotCount();
      const grid = [];
      slots.forEach((s) => grid.push(busySlot(s, refresh)));
      for (let i = slots.length; i < n; i++) grid.push(freeSlot(params, refresh));
      for (let i = n; i < T().slotMax(); i++) grid.push(lockedSlot());
      // Se repinta solo cada 30 s mientras estás en la pantalla
      clearInterval(params._timer);
      if (slots.length) params._timer = setInterval(() => { if (!document.querySelector('.train-screen')) return clearInterval(params._timer); if (!params.pick) refresh(); }, 30000);
      return h('div', { class: 'screen train-screen' },
        h('div', { class: 'card camp-hero' },
          h('span', { class: 'camp-hero-icon' }, DK.icon('dumbbell', 34)),
          h('div', { class: 'grow' }, h('h2', null, t('train.title')), h('p', { class: 'muted' }, t('train.text')),
            h('div', { class: 'chips' },
              h('span', { class: 'chip' }, DK.icon('users', 13), t('train.slots', { n: slots.length, max: n })),
              h('span', { class: 'chip', tip: t('train.capTip', { m: DK.config.training.levelMargin }) }, DK.icon('star', 13), t('train.cap', { n: T().levelCap() })),
              DK.camp.value('instructor') ? h('span', { class: 'chip pos' }, DK.icon('dumbbell', 13), t('train.instructor', { n: Math.round(T().instr().rate * 100) })) : null)),
          h('div', { class: 'shop-wallet' }, V.coins(DK.wallet.get()))),
        params.pick ? picker(params, refresh) : null,
        h('div', { class: 'train-grid' }, grid));
    },
    onLeave(params) { clearInterval(params._timer); },
  });
})();
