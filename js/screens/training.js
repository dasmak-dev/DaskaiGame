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
  const { t } = DK;
  const T = () => DK.training;

  DK.menus.add('nav', {
    id: 'training', icon: 'dumbbell', order: 17, screen: 'training', mobile: false, label: () => t('nav.training'),
    visible: () => !DK.store.state || DK.unlocks.has('training'),   // se abre al derrotar al primer jefe
    badge: () => { const n = DK.store.state ? T().readyCount() : 0; return n ? String(n) : ''; },
  });

  const hours = (x) => DK.util.duration(Math.round(x * 3600));
  const fmtMult = (m) => '×' + (+m.toFixed(2)).toLocaleString(DK.i18n.lang);

  /** Hueco ocupado: progreso en vivo y botón de recoger. */
  function busySlot(slot, refresh) {
    const p = T().progress(slot), d = p.d;
    if (!d) return null;
    const T0 = DK.config.training;
    const what = slot.kind === 'exp'
      ? t('train.gotExp', { n: (p.exp || 0).toLocaleString(DK.i18n.lang) })
      : t('train.gotStat', { n: p.gain || 0, stat: DK.tr('stats', D.stats[slot.stat]) });
    const k = p.stretch || 1;
    const phase = p.done ? t('train.phaseDone') : p.norm < T0.fullHours ? t('train.phaseFull') : t('train.phaseHalf');
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
            slot.kind === 'exp' ? t('train.kindExp') : t('train.kindStatOf', { stat: DK.tr('stats', D.stats[slot.stat]) })),
          slot.plan === 'time' ? h('span', { class: 'chip warn', tip: t('train.slowTip') }, DK.icon('clock', 13), t('train.slowTag', { m: fmtMult(slot.mult) })) : null)),
      h('div', { class: 'train-progress', tip: t('train.curveTip', { a: +(T0.fullHours * k).toFixed(1), b: +(T0.halfHours * k).toFixed(1) }) },
        h('div', { class: 'train-bar' }, h('span', { style: { width: Math.round(p.pct * 100) + '%' } }),
          h('i', { class: 'mark', style: { left: (T0.fullHours / T().maxEff()) * 100 + '%' } })),
        h('div', { class: 'row between small' }, h('span', null, DK.icon('clock', 12), ' ', hours(p.hours)), h('span', { class: 'muted' }, phase))),
      h('p', { class: 'train-got' }, DK.icon('sparkles', 14), ' ', h('b', null, what),
        p.capped ? h('span', { class: 'badge warn' }, slot.kind === 'exp' ? t('train.capLevel', { n: DK.config.maxLevel }) : t('train.capStat')) : null,
        slot.kind === 'stat' && !p.capped && !p.done ? h('span', { class: 'muted small' }, ' · ', t('train.nextPoint', { time: hours(p.nextIn / (1 + T().instr().rate)) })) : null),
      btn({ icon: 'check', label: t('train.collect'), variant: p.done || p.capped ? 'primary' : 'tone', onClick: collect }));
  }

  /** Hueco libre: botón para meter a alguien. */
  const freeSlot = (params, refresh) => h('button', { class: 'card train-slot free', type: 'button', onClick: () => { params.pick = true; params.uid = null; refresh(); } },
    DK.icon('plus', 26), h('b', null, t('train.free')), h('span', { class: 'muted small' }, t('train.freeHint')));

  const lockedSlot = () => h('div', { class: 'card train-slot locked', tip: t('train.lockedTip') }, DK.icon('lock', 22), h('span', { class: 'muted small' }, t('train.locked')));

  /** Por encima del nivel recomendado: pagar más o tardar más. */
  function planChooser(d, mult, plan, params, refresh) {
    const C = DK.config.training;
    const opt = (id, icon, cost, desc) => h('button', { class: 'train-plan' + (plan === id ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(plan === id), onClick: () => { params.plan = id; refresh(); } },
      h('span', { class: 'tp-icon' }, DK.icon(icon, 18)),
      h('span', { class: 'tp-body' }, h('b', null, t('train.plan.' + id)), h('span', { class: 'muted small' }, desc)),
      V.coins(cost));
    return h('div', { class: 'stack-s' },
      h('p', { class: 'small train-over' }, DK.icon('arrowUp', 14), ' ', t('train.overNote', { name: DK.daskai.name(d), n: T().levelCap(), m: fmtMult(mult) })),
      h('div', { class: 'train-plans', role: 'radiogroup' },
        opt('coins', 'coin', T().cost(d, 'exp', 'coins'), t('train.planDesc.coins', { a: C.fullHours, b: C.halfHours })),
        opt('time', 'clock', T().cost(d, 'exp', 'time'), t('train.planDesc.time', { a: +(C.fullHours * mult).toFixed(1), b: +(C.halfHours * mult).toFixed(1) }))));
  }

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
          const why = T().cannot(x, 'exp', 'time') && T().cannot(x, 'stat');
          const m = T().overMult(x);
          return V.daskaiRow(x, { compact: true, onClick: () => { params.uid = x.uid; refresh(); },
            tags: [DK.party.isActive(x.uid) ? h('span', { class: 'badge' }, t('team.inTeam')) : null,
              m > 1 ? h('span', { class: 'badge', tip: t('train.overTip', { n: T().levelCap() }) }, DK.icon('arrowUp', 12), t('train.overBadge', { m: fmtMult(m) })) : null,
              why ? h('span', { class: 'badge warn' }, why) : null].filter(Boolean) });
        })) : DK.ui.empty('users', t('train.nobody'), ''));
    }
    const kind = params.kind, stat = params.stat;
    const mult = T().overMult(d, kind);
    const plan = mult > 1 ? (params.plan || 'coins') : 'coins';
    const why = T().cannot(d, kind, plan);
    const cost = T().cost(d, kind, plan);
    const C = DK.config.training;
    const k = plan === 'time' ? mult : 1;
    const go = () => {
      if (!T().start(d.uid, kind, stat, plan)) { DK.audio.sfx('error'); DK.ui.toast(T().cannot(d, kind, plan) || t('train.cant'), { icon: 'alert', kind: 'bad' }); return; }
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
          ? t('train.expHelp', { n: Math.round(C.expPerHour(d.level) / k).toLocaleString(DK.i18n.lang) })
          : t('train.statHelp', { h: C.statHours, max: C.statMax, have: Math.round(T().trainedTotal(d)) }))),
      kind === 'exp' && mult > 1 ? planChooser(d, mult, plan, params, refresh) : null,
      kind === 'stat' ? h('div', { class: 'train-stats', role: 'radiogroup' }, statKeys.map((s) => h('button', { class: 'train-stat' + (stat === s ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(stat === s), onClick: () => { params.stat = s; refresh(); } },
        h('span', { class: 'ts-icon' }, DK.icon(D.stats[s].icon, 18)),
        h('span', { class: 'ts-name' }, DK.tr('stats', D.stats[s])),
        h('span', { class: 'ts-foot' }, h('b', null, t('train.perPoint', { n: C.statPer[s] })), V.growthBadge(d, s)),
        stat === s ? h('span', { class: 'ts-check' }, DK.icon('check', 12)) : null))) : null,
      h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('train.rules', { a: +(C.fullHours * k).toFixed(1), b: +(C.halfHours * k).toFixed(1) }))),
      DK.party.isActive(d.uid) ? h('p', { class: 'small warn-text' }, DK.icon('alert', 13), ' ', t('train.leavesTeam')) : null,
      h('div', { class: 'row gap-s wrap between' }, V.coins(cost),
        btn({ icon: 'dumbbell', label: t('train.start', { n: cost }), variant: 'primary', disabled: !!why, tip: why, onClick: go })),
      why ? h('p', { class: 'small bad-text' }, why) : null);
  }

  DK.screens.register('training', {
    title: () => t('nav.training'), icon: 'dumbbell', section: 'training', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      if (!DK.unlocks.has('training')) {
        return h('div', { class: 'screen train-screen' }, h('div', { class: 'card locked-feature' },
          h('span', { class: 'lf-icon' }, DK.icon('lock', 30)),
          h('h2', null, t('train.title')), h('p', { class: 'muted' }, t('unlock.trainingLocked')),
          btn({ icon: 'map', label: t('nav.battle'), variant: 'primary', onClick: () => DK.router.reset('zones') })));
      }
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
              h('span', { class: 'chip', tip: t('train.capTip', { m: DK.config.training.levelMargin, p: Math.round(DK.config.training.overStep * 100) }) }, DK.icon('star', 13), t('train.cap', { n: T().levelCap() })),
              DK.camp.value('instructor') ? h('span', { class: 'chip pos' }, DK.icon('dumbbell', 13), t('train.instructor', { n: Math.round(T().instr().rate * 100) })) : null)),
          h('div', { class: 'shop-wallet' }, V.coins(DK.wallet.get()))),
        params.pick ? picker(params, refresh) : null,
        h('div', { class: 'train-grid' }, grid));
    },
    onLeave(params) { clearInterval(params._timer); },
  });
})();
