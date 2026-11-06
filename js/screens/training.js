/* =============================================================
 * screens/training.js — Campo de entrenamiento (DK.training).
 *
 * Huecos con daskai ganando experiencia en tiempo real. Cada hueco muestra
 * el nivel en vivo, el ritmo, la aceleración por tiempo y lo que se cobra
 * al sacarlo («Sacar» paga y aplica; la X lo saca gratis sin experiencia).
 * Para meter a uno: hueco libre → eliges daskai → acelerador (×1 gratis,
 * ×2, ×3, ×5 de pago) con la previsión de niveles y cobro a 1/4/8/24 h.
 * No se puede abrir durante una expedición (DK.router.guard).
 *
 * params: { pick: true (eligiendo daskai), uid, boost, who }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const T = () => DK.training;

  DK.menus.add('nav', {
    id: 'training', icon: 'dumbbell', order: 17, screen: 'training', mobile: false, dock: false, label: () => t('nav.training'),
    visible: () => !DK.store.state || DK.unlocks.has('training'),   // se abre al derrotar al primer jefe
    badge: () => { const n = DK.store.state ? T().readyCount() : 0; return n ? String(n) : ''; },
  });

  const hours = (x) => DK.util.duration(Math.round(x * 3600));
  const num = (n) => Math.round(n).toLocaleString(DK.i18n.lang);
  const pctTxt = (f) => (+(f * 100).toFixed(f >= 0.1 ? 0 : 1)).toLocaleString(DK.i18n.lang) + '%';
  const fmtMult = (m) => '×' + (+m.toFixed(2)).toLocaleString(DK.i18n.lang);

  /** Hueco ocupado: nivel en vivo, ritmo, cobro y botón de sacarlo. */
  function busySlot(slot, refresh) {
    const p = T().progress(slot), d = p.d;
    if (!d) return null;
    const C = DK.config.training, curve = DK.config.expCurve(p.level);
    const fill = p.capped ? 1 : Math.min(1, p.levelExp / curve);
    const afford = DK.wallet.get() >= p.fee;
    const finish = (r) => {
      if (!r) { DK.audio.sfx('error'); DK.ui.toast(t('train.noMoney'), { icon: 'coin', kind: 'bad' }); return null; }
      DK.app.renderNav(); refresh(); return r;
    };
    const collect = async () => {
      const r = finish(T().collect(slot.uid, true)); if (!r) return;
      DK.audio.sfx('levelup');
      DK.ui.toast(t('train.collectedExp', { name: DK.daskai.name(d), n: num(r.exp), c: num(r.fee) }), { icon: 'dumbbell', kind: 'good' });
      if (r.levelInfo) await V.afterLevel(d, r.levelInfo);
    };
    const free = async () => {
      if (!(await DK.ui.confirm(t('train.freeOut'), t('train.freeOutText', { name: DK.daskai.name(d), n: num(p.exp) }), { danger: true, okLabel: t('train.freeOut') }))) return;
      if (finish(T().collect(slot.uid, false))) DK.ui.toast(t('train.freedOut', { name: DK.daskai.name(d) }), { icon: 'dumbbell' });
    };
    return h('div', { class: 'card train-slot busy' + (p.done || p.capped ? ' ready' : '') },
      h('div', { class: 'train-slot-head' },
        h('div', { class: 'train-sprite' }, V.dSprite(d, { size: 72, cls: 'idle' })),
        h('div', { class: 'grow stack-xs' },
          h('div', { class: 'row gap-s wrap' }, h('b', null, DK.daskai.name(d)),
            h('span', { class: 'tr-lv' }, `${t('common.lvl')} ${d.level}`, p.levels > 0 ? h('b', null, ' → ', p.level) : null)),
          h('div', { class: 'chips' },
            h('span', { class: 'chip', tip: t('train.rateTip') }, DK.icon('bolt', 12), t('train.rateNow', { p: pctTxt(p.rate) })),
            h('span', { class: 'chip' + (p.ramp > 1.01 ? ' pos' : ''), tip: t('train.rampTip', { p: Math.round(C.ramp.perHour * 100), m: fmtMult(C.ramp.max) }) }, DK.icon('arrowUp', 12), fmtMult(p.ramp)),
            p.boost > 1 ? h('span', { class: 'chip pos', tip: t('train.boostTip') }, DK.icon('sparkles', 12), t('train.boostTag', { m: p.boost })) : null))),
      h('div', { class: 'train-progress' },
        h('div', { class: 'train-bar' }, h('span', { style: { width: Math.round(fill * 100) + '%' } })),
        h('div', { class: 'row between small' }, h('span', null, DK.icon('clock', 12), ' ', hours(p.hours), h('span', { class: 'muted' }, ' / ', C.maxHours, ' h')),
          h('span', { class: 'muted' }, p.capped ? t('train.capLevel', { n: DK.config.maxLevel }) : p.done ? t('train.phaseDone') : t('train.toNext', { p: Math.round(fill * 100) })))),
      h('div', { class: 'tr-bill' },
        h('span', null, DK.icon('star', 13), ' ', h('b', null, t('train.gotExp', { n: num(p.exp) })), p.levels > 0 ? h('span', { class: 'badge good' }, t('train.levelsUp', { n: p.levels })) : null),
        h('span', { class: 'tr-fee' + (afford ? '' : ' bad'), tip: t('train.feeTip') }, t('train.fee'), ' ', DK.icon('coin', 13), ' ', num(p.fee))),
      // v4.48: sin monedas, «Sacar sin experiencia» va debajo a todo lo ancho (antes aplastaba al otro botón)
      h('div', { class: 'tr-actions' + (afford ? '' : ' stacked') },
        btn({ icon: 'check', label: t('train.collect', { n: num(p.fee) }), variant: p.done || p.capped ? 'primary' : 'tone', disabled: !afford, tip: afford ? null : t('train.up.noMoney', { n: num(p.fee - DK.wallet.get()) }), onClick: collect, cls: 'grow' }),
        btn({ icon: 'x', label: afford ? null : t('train.freeOut'), size: afford ? 'sm' : null, variant: 'ghost', tip: t('train.freeOutTip'), onClick: free, cls: 'tr-free' })));
  }

  /** Hueco libre: botón para meter a alguien. */
  const freeSlot = (params, refresh) => h('button', { class: 'card train-slot free', type: 'button', onClick: () => { params.pick = true; params.uid = null; refresh(); } },
    DK.icon('plus', 26), h('b', null, t('train.free')), h('span', { class: 'muted small' }, t('train.freeHint')));

  const lockedSlot = () => h('div', { class: 'card train-slot locked', tip: t('train.lockedTip') }, DK.icon('lock', 22), h('span', { class: 'muted small' }, t('train.locked')));

  /**
   * Elegir daskai: cuadrícula de retratos (arriba los que pueden, aparte los
   * que no, con el motivo). Luego: acelerador y previsión de niveles y cobro.
   */
  function picker(params, refresh) {
    const d = params.uid && DK.party.get(params.uid);
    params.who = params.who || 'all';
    const back = btn({ icon: 'back', label: t('common.back'), size: 'sm', variant: 'ghost', onClick: () => { params.pick = false; params.uid = null; refresh(); } });
    if (!d) {
      const all = DK.party.all().filter((x) => !x.temp && !T().isTraining(x.uid)).sort((a, b) => b.level - a.level);
      const shown = all.filter((x) => params.who === 'all' || (params.who === 'team') === DK.party.isActive(x.uid));
      const reason = (x) => T().cannot(x, 1);
      const ok = shown.filter((x) => !reason(x)), no = shown.filter((x) => reason(x));
      const tile = (x, why) => {
        const sp = DK.daskai.species(x);
        return h('button', { class: 'tr-tile' + (why ? ' off' : ''), type: 'button', disabled: !!why, style: { '--c': D.houseColor(sp.house) },
          tip: why || `${DK.daskai.name(x)} · ${t('common.lvl')} ${x.level}`, onClick: () => { params.uid = x.uid; params.boost = 1; DK.audio.sfx('select'); refresh(); } },
          DK.party.isActive(x.uid) ? h('span', { class: 'tr-tag team', tip: t('team.inTeam') }, DK.icon('users', 11)) : null,
          V.dSprite(x, { size: 56 }),
          h('b', null, DK.daskai.name(x)),
          h('small', null, `${t('common.lvl')} ${x.level}`),
          why ? h('span', { class: 'tr-why' }, why) : h('span', { class: 'tr-cost', tip: t('train.rateTip') }, DK.icon('bolt', 11), ' ', t('train.perMin', { p: pctTxt(T().pct(x.level) * (1 + T().instr().rate)) })));
      };
      const filt = DK.ui.segmented({ value: params.who, onChange: (v) => { params.who = v; refresh(); },
        options: [{ value: 'all', label: t('train.whoAll', { n: all.length }) }, { value: 'team', label: t('train.whoTeam'), icon: 'users' }, { value: 'box', label: t('train.whoBox'), icon: 'grid' }] });
      return h('div', { class: 'panel stack-s tr-picker' },
        h('div', { class: 'panel-head' }, DK.icon('users', 18), h('h3', null, t('train.pickTitle')), h('span', { class: 'grow' }), back),
        h('p', { class: 'muted small' }, t('train.pickHint')),
        filt,
        ok.length ? h('div', { class: 'tr-grid' }, ok.map((x) => tile(x))) : DK.ui.empty('users', t('train.nobody'), ''),
        no.length ? h('details', { class: 'tr-no' }, h('summary', null, DK.icon('lock', 13), ' ', t('train.cantList', { n: no.length })), h('div', { class: 'tr-grid' }, no.map((x) => tile(x, reason(x))))) : null);
    }
    const C = DK.config.training;
    const boost = C.boosts.includes(params.boost) ? params.boost : 1;
    const why = T().cannot(d, boost), cost = T().boostCost(d, boost);
    const go = () => {
      if (!T().start(d.uid, boost)) { DK.audio.sfx('error'); DK.ui.toast(T().cannot(d, boost) || t('train.cant'), { icon: 'alert', kind: 'bad' }); return; }
      DK.audio.sfx('select'); DK.ui.toast(t('train.started', { name: DK.daskai.name(d) }), { icon: 'dumbbell', kind: 'good' });
      params.pick = false; params.uid = null; DK.app.renderNav(); refresh();
    };
    const boostBtn = (m) => {
      const c = T().boostCost(d, m), on = m === boost, poor = c > DK.wallet.get();
      return h('button', { class: 'tr-boost' + (on ? ' on' : '') + (poor ? ' poor' : ''), type: 'button', role: 'radio', 'aria-checked': String(on), disabled: poor, onClick: () => { params.boost = m; DK.audio.sfx('select'); refresh(); } },
        h('b', null, '×' + m), c ? h('span', null, DK.icon('coin', 11), ' ', num(c)) : h('span', null, t('train.boostFree')));
    };
    const plan = [1, 4, 8, C.maxHours].map((hh) => ({ hh, s: T().simulate(d, hh * 60, boost) }));
    return h('div', { class: 'panel stack tr-setup' },
      h('div', { class: 'panel-head' }, DK.icon('dumbbell', 18), h('h3', null, t('train.setup', { name: DK.daskai.name(d) })), h('span', { class: 'grow' }), back),
      V.daskaiRow(d, { compact: true }),
      h('p', { class: 'muted small' }, t('train.expHelp', { p: pctTxt(T().pct(d.level) * (1 + T().instr().rate)), r: Math.round(C.ramp.perHour * 100), m: fmtMult(C.ramp.max) })),
      h('div', { class: 'stack-s' }, h('b', null, DK.icon('sparkles', 14), ' ', t('train.boost')),
        h('div', { class: 'tr-boosts', role: 'radiogroup' }, C.boosts.map(boostBtn)),
        h('p', { class: 'muted small' }, t('train.boostHelp'))),
      h('div', { class: 'tr-plan' },
        h('div', { class: 'tr-plan-row head' }, h('span', null, t('train.planTime')), h('span', null, t('train.planLevel')), h('span', null, t('train.planFee'))),
        plan.map(({ hh, s }) => h('div', { class: 'tr-plan-row' },
          h('span', null, DK.icon('clock', 12), ' ', hh, ' h'),
          h('span', null, `${t('common.lvl')} ${s.level}`, s.levels ? h('b', { class: 'good-text' }, ` +${s.levels}`) : null),
          h('span', { class: 'tr-fee' }, DK.icon('coin', 12), ' ', num(s.fee))))),
      h('div', { class: 'warning' }, DK.icon('info', 16), h('span', null, t('train.rules', { h: C.maxHours }))),
      DK.party.isActive(d.uid) ? h('p', { class: 'small warn-text' }, DK.icon('alert', 13), ' ', t('train.leavesTeam')) : null,
      h('div', { class: 'row gap-s wrap between' }, cost ? V.coins(cost) : h('span', { class: 'muted small' }, t('train.payLater')),
        btn({ icon: 'dumbbell', label: cost ? t('train.startPaid', { n: num(cost) }) : t('train.start'), variant: 'primary', disabled: !!why, tip: why, onClick: go })),
      why ? h('p', { class: 'small bad-text' }, why) : null);
  }

  /**
   * Mejoras del campo (Instructor), compacto: una barra de 4 niveles, lo que da
   * el siguiente y su precio (emblemas de jefe + monedas). El detalle de cada
   * nivel va en el tooltip de su casilla.
   */
  function upgradePanel(refresh) {
    const I = DK.config.training.instructor, lv = T().level(), next = T().nextLevel(), why = T().cannotBuy();
    const fx = (x) => [t('train.up.slots', { n: DK.config.training.slots + x.slots }), t('train.up.rate', { n: Math.round(x.rate * 100) }), t('train.up.discount', { n: Math.round(x.discount * 100) })];
    const lack = () => why === 'emblems' ? t('train.up.noEmblems', { n: next.emblems - DK.camp.emblems() }) : t('train.up.noMoney', { n: num(next.cost - DK.wallet.get()) });
    const buy = () => {
      if (!T().buyLevel()) { DK.audio.sfx('error'); DK.ui.toast(lack(), { icon: 'alert', kind: 'bad' }); return; }
      DK.audio.sfx('levelup'); DK.ui.toast(t('train.up.bought', { n: T().level() }), { icon: 'dumbbell', kind: 'good' }); DK.app.renderNav(); refresh();
    };
    return h('section', { class: 'card tr-up' },
      h('div', { class: 'tr-up-head' },
        h('span', { class: 'tr-up-icon' }, DK.icon('crown', 18)),
        h('div', { class: 'grow' },
          h('b', null, t('train.up.title')),
          h('div', { class: 'tr-up-steps' }, I.slice(1).map((x, i) => h('span', { class: 'tr-step' + (i < lv ? ' own' : '') + (i === lv ? ' next' : ''), tip: `${t('train.up.level', { n: i + 1, max: I.length - 1 })}: ${fx(x).join(' · ')}` })),
            h('small', { class: 'muted' }, t('train.up.level', { n: lv, max: I.length - 1 })))),
        next ? h('div', { class: 'tr-up-buy' },
          h('span', { class: 'tr-up-price' }, h('span', { class: why === 'emblems' ? 'bad-text' : '' }, V.emblems(next.emblems)), h('span', { class: why === 'coins' ? 'tr-fee bad' : 'tr-fee' }, DK.icon('coin', 13), ' ', num(next.cost))),
          btn({ icon: 'arrowUp', label: t('train.up.buy', { n: lv + 1 }), size: 'sm', variant: why ? 'tone' : 'primary', disabled: !!why, tip: why ? lack() : null, onClick: buy }))
          : h('span', { class: 'badge good' }, DK.icon('crown', 12), ' ', t('train.up.maxed'))),
      next ? h('p', { class: 'tr-up-next small' }, h('span', { class: 'muted' }, t('train.up.next')), ' ', fx(next).join(' · ')) : null);
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
      if (slots.length) params._timer = setInterval(() => { if (!document.querySelector('.train-screen')) return clearInterval(params._timer); if (!params.pick) refresh(); }, 20000);
      return h('div', { class: 'screen train-screen' },
        h('div', { class: 'card camp-hero' },
          h('span', { class: 'camp-hero-icon' }, DK.icon('dumbbell', 34)),
          h('div', { class: 'grow' }, h('h2', null, t('train.title')), h('p', { class: 'muted' }, t('train.text')),
            h('div', { class: 'chips' },
              h('span', { class: 'chip' }, DK.icon('users', 13), t('train.slots', { n: slots.length, max: n })),
              T().level() ? h('span', { class: 'chip pos' }, DK.icon('dumbbell', 13), t('train.instructor', { n: Math.round(T().instr().rate * 100), d: Math.round(T().instr().discount * 100) })) : null)),
          h('div', { class: 'shop-wallet' }, V.coins(DK.wallet.get()))),
        params.pick ? picker(params, refresh) : null,
        h('div', { class: 'train-grid' }, grid),
        upgradePanel(refresh));
    },
    onLeave(params) { clearInterval(params._timer); },
  });
})();
