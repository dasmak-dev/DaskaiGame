/* =============================================================
 * components/celebrations.js — Pantallas de subida de nivel y de
 * evolución (con animaciones de números y destellos).
 *
 *   await DK.views.levelUpDialog(d, infoDeGainExp)
 *   await DK.views.evolveDialog(d)   → true si evolucionó
 * ============================================================= */
(function () {
  const { h, modal } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const V = (DK.views = DK.views || {});

  /** Anima un número de `from` a `to` en un elemento. */
  function countUp(el, from, to, ms) {
    if (DK.settings.reducedMotion() || DK.settings.get('skipAnims')) { el.textContent = to; return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * Ventana de subida de nivel: atributos antes → después.
   * @param {Object} d     daskai
   * @param {Object} info  resultado de DK.daskai.gainExp()
   */
  V.levelUpDialog = (d, info) => {
    if (!info.levels.length) return Promise.resolve();
    DK.audio.sfx('levelup');
    const rows = D.statKeys.map((k, i) => {
      const val = h('b', { class: 'lu-val' }, info.before[k]);
      const gain = info.after[k] - info.before[k];
      const row = h('div', { class: 'lu-row', style: { animationDelay: i * 80 + 'ms' } },
        h('span', { class: 'stat-name' }, DK.icon(D.stats[k].icon, 16), DK.tr('stats', D.stats[k]), V.growthBadge(d, k)),
        h('span', { class: 'muted' }, info.before[k]), DK.icon('next', 14), val,
        h('span', { class: 'lu-gain ' + (gain > 0 ? 'pos' : '') }, gain > 0 ? '+' + gain : '—'));
      setTimeout(() => countUp(val, info.before[k], info.after[k], 600), 250 + i * 90);
      return row;
    });
    const fxLayer = h('div', { class: 'fx-layer' });
    const m = modal({
      title: t('levelup.title', { name: DK.daskai.name(d), level: d.level }), icon: 'star', cls: 'levelup-modal',
      content: h('div', { class: 'levelup' }, fxLayer,
        h('div', { class: 'lu-head' }, V.dSprite(d, { size: 110, cls: 'float glow-once' }),
          h('div', null, h('div', { class: 'lu-level' }, t('common.lvl'), ' ', h('b', null, d.level)),
            info.levels.length > 1 ? h('span', { class: 'badge good' }, t('levelup.multi', { n: info.levels.length })) : null,
            h('p', { class: 'muted small' }, t('levelup.restored')))),
        h('div', { class: 'lu-rows' }, rows),
        info.talent ? h('div', { class: 'warning good mt' }, DK.icon('star', 16), h('span', null, t('talent.unlocked', { n: info.talent }))) : null,
        info.learned.length ? h('div', { class: 'chips mt' }, info.learned.map((m2) => h('span', { class: 'chip pos' }, DK.icon('sparkles', 13), t('levelup.learned', { move: D.moves[m2].name })))) : null),
      actions: [{ label: t('common.continue'), icon: 'next', variant: 'primary', value: true }],
    });
    setTimeout(() => DK.fx.confetti(fxLayer, 30), 100);
    // Al llegar a un nivel de talento (10, 20…) se elige uno
    return m.promise.then(() => (DK.daskai.talentsPending(d).length && info.talent ? V.talentDialog(d) : null));
  };

  /**
   * Propone evolucionar. Si se acepta, anima y aplica la evolución.
   * @returns {Promise<boolean>}
   */
  /**
   * Avisos de subida de nivel del resto del equipo (v4.59): tarjetitas que entran por un lado,
   * se quedan un par de segundos y se van, sin tapar nada ni pedir clics.
   * @param {Array} list [{ uid, from, to, evolveReady }]
   */
  V.levelFeed = (list) => {
    if (!list || !list.length) return;
    let host = document.querySelector('.lvl-feed');
    if (!host) { host = h('div', { class: 'lvl-feed', 'aria-live': 'polite' }); document.body.append(host); }
    list.forEach((x, i) => setTimeout(() => {
      const d = DK.party.get(x.uid); if (!d) return;
      const card = h('div', { class: 'lvl-card', style: { '--c': D.houseColor(DK.daskai.species(d).house) } },
        h('span', { class: 'lvl-art' }, V.dSprite(d, { size: 40 })),
        h('span', { class: 'lvl-main' }, h('b', null, DK.daskai.name(d)),
          h('span', { class: 'lvl-lv' }, `${t('common.lvl')} ${x.from}`, DK.icon('next', 11), h('b', null, x.to)),
          x.evolveReady ? h('small', { class: 'lvl-evo' }, DK.icon('evolve', 11), t('evo.ready')) : null),
        h('span', { class: 'lvl-badge' }, DK.icon('arrowUp', 14)));
      host.append(card);
      DK.audio.sfx('select');
      setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 400); }, 2600);
    }, i * 380));
  };

  V.evolveDialog = async (d) => {
    if (!DK.daskai.canEvolve(d)) return false;
    const nf = DK.daskai.nextForm(d), into = D.species[nf.into];
    const intoName = DK.daskai.speciesName({ species: nf.into, extra: (d.extra || 0) + (nf.extra ? 1 : 0) });
    const stage = h('div', { class: 'evo-stage' }, V.dSprite(d, { size: 150, cls: 'evo-from' }), V.sprite(into.id, { look: DK.looks.of(d, (d.form || 0) + 1), size: 150, shiny: !!d.shiny, cls: 'evo-to' }));
    const text = h('p', { class: 'center' }, t('evo.question', { name: DK.daskai.name(d), into: intoName }));
    let evolved = false;
    const oldName = DK.daskai.name(d);
    await modal({
      title: t('evo.title'), icon: 'evolve', dismissable: false, cls: 'evo-modal',
      content: h('div', { class: 'evo' }, stage, text),
      actions: [
        { label: t('evo.later'), icon: 'clock', variant: 'ghost', value: false },
        { label: t('evo.go'), icon: 'evolve', variant: 'primary', onClick: async (close) => {
          stage.classList.add('evolving');
          DK.audio.sfx('evolve');
          DK.vibrate([60, 60, 60, 60, 200]);
          const wait = DK.settings.reducedMotion() || DK.settings.get('skipAnims') ? 50 : 2200;
          await DK.util.sleep(wait);
          const r = DK.daskai.evolve(d);
          evolved = true;
          stage.classList.add('done');
          text.textContent = t('evo.done', { name: oldName, into: into.name });
          // Cuánto ha subido cada atributo (nueva base + puntos extra de evolución)
          // v4.59: tabla ordenada (icono, atributo, antes → después, +subida) con una barra que crece una a una
          if (r) {
            const top = Math.max(...D.statKeys.map((k) => r.after[k]));
            const total = D.statKeys.reduce((n, k) => n + (r.after[k] - r.before[k]), 0);
            text.after(h('div', { class: 'evo-gains' },
              h('div', { class: 'evg-head' }, h('span', null, t('evo.gains')), h('b', { class: 'evg-total' }, '+' + total)),
              h('div', { class: 'evg-grid' }, D.statKeys.map((k, i) => {
                const up = r.after[k] - r.before[k];
                return h('div', { class: 'evg-row', style: { '--i': i } },
                  h('span', { class: 'evg-ico' }, DK.icon(D.stats[k].icon, 14)),
                  h('span', { class: 'evg-name' }, DK.tr('stats', D.stats[k], 'short')),
                  h('span', { class: 'evg-bar' }, h('i', { class: 'old', style: { width: Math.round((r.before[k] / top) * 100) + '%' } }), h('i', { class: 'new', style: { left: Math.round((r.before[k] / top) * 100) + '%', width: Math.max(1, Math.round((up / top) * 100)) + '%' } })),
                  h('span', { class: 'evg-val' }, h('small', null, r.before[k]), DK.icon('next', 11), h('b', null, r.after[k])),
                  h('span', { class: 'evg-up' + (up ? '' : ' zero') }, up ? '+' + up : '='));
              }))));
          }
          // Se queda abierta para leer las subidas: sólo queda «Continuar»
          const foot = stage.closest('.modal-backdrop') && stage.closest('.modal-backdrop').querySelector('.modal-actions');
          if (foot) foot.replaceChildren(DK.ui.btn({ label: t('common.continue'), icon: 'next', variant: 'primary', onClick: () => close(true) }));
          else close(true);
        } },
      ],
    }).promise;
    if (evolved) DK.ui.toast(t('evo.done', { name: oldName, into: into.name }), { icon: 'evolve', kind: 'good' });
    return evolved;
  };
})();
