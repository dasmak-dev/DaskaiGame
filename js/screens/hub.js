/* =============================================================
 * screens/hub.js — El campamento (pantalla principal).
 *
 *  v4.54: dos columnas (en móvil, una):
 *  - Principal: la escena del campamento (components/camp.js) y, justo
 *    debajo, la barra de la próxima expedición (Enter para jugar).
 *  - Lateral: TU EQUIPO en filas compactas (dibujo, formas, nivel, PV/PM,
 *    avisos), «Qué hacer ahora» y las MISIONES DE HOY en una línea cada una.
 *  - Acciones extra que añadan otros archivos con
 *    DK.menus.add('hub', { id, icon, label, desc, action | screen })
 *    salen como botones bajo la expedición.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', { id: 'home', icon: 'campfire', order: 10, screen: 'hub', pin: true, label: () => t('nav.home') });

  // Menú de acciones rápidas: otros archivos pueden añadir opciones con
  // DK.menus.add('hub', { id, icon, label, desc, action | screen }).
  // (No hay descanso gratis ni de pago: fuera de las expediciones sólo se cura con objetos.)
  DK.menus.define('hub');

  let justLead = null; // el que acaba de hacerse líder (para animarlo una vez)
  /** Fila compacta de un daskai del equipo (columna lateral). */
  function teamRow(d, i, refresh) {
    const sp = DK.daskai.species(d), s = DK.daskai.stats(d);
    const hp = DK.util.percent(d.cur.hp, s.hp), mp = DK.util.percent(d.cur.mp, s.mp), fainted = DK.daskai.isFainted(d);
    const st = d.status && D.statuses[d.status];
    const flags = [
      d.isNew ? h('span', { class: 'hs-flag new', tip: t('newMark.tip') }, t('newMark.label')) : null,
      DK.daskai.canEvolve(d) ? h('span', { class: 'hs-flag evo', tip: t('evo.readyTip') }, DK.icon('evolve', 12)) : null,
      DK.daskai.talentsPending(d).length ? h('span', { class: 'hs-flag talent', tip: t('talent.pendingTip') }, DK.icon('star', 12)) : null,
      DK.training && DK.training.isTraining(d.uid) ? h('span', { class: 'hs-flag train', tip: t('train.inTraining') }, DK.icon('dumbbell', 12)) : null,
      st ? h('span', { class: 'hs-flag bad', tip: DK.tr('statuses', st) }, DK.icon(st.icon, 12)) : null,
      fainted ? h('span', { class: 'hs-flag bad', tip: t('common.fainted') }, DK.icon('skull', 12)) : null,
    ].filter(Boolean);
    const lead = i === 0;
    // v4.58: pulsar abre un resumen rápido (V.quickStats); la corona de la derecha lo hace líder en un clic
    const open = h('button', { class: 'hs-open', type: 'button', 'aria-label': `${DK.daskai.name(d)} · ${t('common.lvl')} ${d.level}`, tip: t('home.openTip'),
      onClick: () => { DK.audio.sfx('select'); V.quickStats(d, { onChange: refresh }); } },
      h('span', { class: 'hs-art' }, V.dSprite(d, { size: 46 }), V.formPips(d)),
      h('span', { class: 'hs-main' },
        h('span', { class: 'hs-name' }, h('b', { tip: DK.daskai.speciesName(d) }, DK.daskai.name(d)), h('small', null, `${t('common.lvl')} ${d.level}`)),
        h('span', { class: 'hs-bars', tip: `${d.cur.hp}/${s.hp} ${t('common.hpShort')} · ${d.cur.mp}/${s.mp} ${t('common.mpShort')}` },
          h('i', { class: 'hp' + (hp < 25 ? ' low' : hp < 50 ? ' mid' : '') }, h('i', { style: { width: hp + '%' } })),
          h('i', { class: 'mp' }, h('i', { style: { width: mp + '%' } })))),
      flags.length ? h('span', { class: 'hs-flags' }, flags) : null);
    const star = h('button', { class: 'hs-star' + (lead ? ' on' : ''), type: 'button', 'aria-pressed': String(lead),
      tip: lead ? t('home.leaderNow') : t('home.makeLeaderTip', { name: DK.daskai.name(d) }), 'aria-label': lead ? t('home.leaderNow') : t('detail.makeLeader'),
      onClick: () => {
        if (lead) { DK.audio.sfx('error'); return; }
        DK.party.setLeader(d.uid); DK.audio.sfx('swap');
        DK.ui.toast(t('home.newLeader', { name: DK.daskai.name(d) }), { icon: 'crown', kind: 'good' });
        justLead = d.uid; refresh();
      } }, DK.icon('crown', 16));
    const el = h('div', { class: 'hs-mon' + (fainted ? ' fainted' : '') + (lead ? ' lead' : '') + (justLead === d.uid ? ' just-lead' : ''), style: { '--c': D.houseColor(sp.house) } }, open, star);
    DK.ui.attachContextMenu(el, () => V.daskaiActions(d, { onChange: refresh, onOpen: () => DK.router.reset('team', { uid: d.uid }) }));
    return el;
  }

  /** Misión de hoy en una sola línea (con su botón de cobrar). */
  function missionLine(m, refresh) {
    const done = m.progress >= m.target;
    const claim = () => { if (DK.missions.claim(m)) { DK.audio.sfx('achievement'); DK.ui.toast(t('missions.claimedToast', { coins: m.reward.coins }), { icon: 'gift', kind: 'good' }); refresh(); } };
    return h('div', { class: 'hm-row' + (m.claimed ? ' claimed' : done ? ' done' : '') },
      h('span', { class: 'hm-icon' }, DK.icon(m.icon, 15)),
      h('span', { class: 'hm-main' }, h('span', { class: 'hm-text', tip: DK.missionText(m) }, DK.missionText(m)),
        h('span', { class: 'hm-bar' }, h('i', { style: { width: Math.min(100, Math.round((m.progress / m.target) * 100)) + '%' } }))),
      m.claimed ? h('span', { class: 'hm-end ok', tip: t('missions.claimed') }, DK.icon('check', 14))
        : done ? btn({ icon: 'gift', label: t('missions.claim'), size: 'sm', variant: 'primary', cls: 'hm-claim', onClick: claim })
          : h('span', { class: 'hm-end', tip: `${m.reward.coins} · ${t('pass.points', { n: DK.missions.passPoints(m) })}` }, h('small', null, `${Math.min(m.progress, m.target)}/${m.target}`), DK.icon('coin', 12), h('b', null, m.reward.coins)));
  }

  /** Barra de la próxima expedición (bajo la escena): mapa, datos y botón de jugar. */
  function playBar(refresh) {
    const exp = DK.expedition.active();
    // Sin expedición: la zona del primer mapa de la próxima (se elige al azar)
    const z = exp ? D.zones[exp.zone] : D.zones[DK.expedition.nextStart().zone];
    const rec = DK.world.recommended();
    if (!z) return null;
    const problems = DK.world.warnings(z.id).filter((w) => w.kind !== 'good');
    const art = h('div', { class: 'play-art', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, DK.scenes.render(z.scene, z.colors),
      h('div', { class: 'play-sprites' }, z.enemies.slice(0, 3).map((e) => V.sprite(e.species, { size: 40, silhouette: !DK.codex.getEntry(z.id, e.species), cls: 'float' }))));
    // Avisos (equipo herido, zona fácil…) en una línea; si alguno se cura con objetos, al pulsar se cura
    const heal = problems.some((w) => w.action === 'heal');
    const warn = problems.length ? h(heal ? 'button' : 'span', { class: 'hx-warn k-' + problems[0].kind, type: heal ? 'button' : null, tip: problems.map((w) => w.text).join('\n') + (heal ? '\n' + t('heal.button') : ''),
      onClick: heal ? async () => { if (await V.healDialog(DK.party.active())) refresh(); } : null },
      DK.icon(problems[0].icon || 'info', 14), h('span', null, problems[0].text), problems.length > 1 ? h('b', null, '+' + (problems.length - 1)) : null,
      heal ? DK.icon('flask', 14) : null) : null;
    return h('section', { class: 'card play-card hub-exp' + (exp ? ' running' : '') }, art,
      h('div', { class: 'play-body' },
        h('span', { class: 'hx-kicker' }, exp ? t('home.expedition') : t('exp.firstMap')),
        h('h2', null, z.name),
        h('div', { class: 'chips' }, h('span', { class: 'chip' }, DK.icon('star', 13), `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`),
          V.sizeChip(exp ? DK.expedition.size() : DK.expedition.nextStart().size),
          exp ? h('span', { class: 'chip' }, DK.icon('compass', 13), t('exp.depth', { n: exp.depth || 1 })) : null,
          exp ? h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.progress', { step: exp.step, total: exp.total, items: DK.expedition.lootCount(), coins: exp.loot.coins })) : null,
          !exp && DK.expedition.bestDepth() ? h('span', { class: 'chip pos' }, DK.icon('trophy', 13), t('exp.best', { n: DK.expedition.bestDepth() })) : null),
        warn),
      h('div', { class: 'hx-actions' },
        btn({ icon: exp ? 'map' : 'play', label: exp ? t('exp.openMap') : t('home.playExp'), size: 'lg', variant: 'primary', hotkey: '↵', cls: 'play-btn', onClick: () => DK.play.quick() }),
        h('div', { class: 'hx-sub' },
          !exp && rec && DK.world.freeUnlocked(rec.id) ? btn({ icon: 'swords', label: t('zones.free'), variant: 'ghost', size: 'sm', tip: t('zones.freeDesc') + ' · ' + rec.name, onClick: () => DK.play.start(rec.id) }) : null,
          btn({ icon: 'map', label: t('nav.battle'), variant: 'ghost', size: 'sm', onClick: () => DK.router.reset('zones') }))));
  }

  DK.screens.register('hub', {
    title: () => t('nav.home'), icon: 'campfire', section: 'home', back: false, music: 'menu', tutorial: 'hub',
    render(params) {
      const refresh = () => DK.router.refresh();
      params.todo = params.todo || {};
      const team = DK.party.active();
      DK.keys.on('Enter', () => DK.play.quick());

      // Columna lateral: tu equipo (filas compactas), misiones de hoy y avisos
      const max = DK.config.maxTeam;
      const hurt = team.some((d) => DK.daskai.hpPct(d) < 1 || d.status || d.cur.mp < DK.daskai.stats(d).mp);
      const teamCard = h('section', { class: 'card hub-team2' },
        h('div', { class: 'panel-head' }, DK.icon('users', 17), h('h3', null, t('home.yourTeam')), h('span', { class: 'hs-count' }, `${team.length}/${max}`),
          h('span', { class: 'grow' }),
          // v4.57: curar a todo el equipo (elige los objetos justos y lo enseña antes de usarlos)
          hurt ? btn({ icon: 'flask', label: t('healAll.tip'), iconOnly: true, size: 'sm', variant: 'tone', cls: 'hs-heal', tip: t('healAll.tip'), onClick: async () => { if (await V.healDialog(team)) refresh(); } }) : null,
          btn({ icon: 'edit', label: t('home.manage'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('team') })),
        h('div', { class: 'hs-list' }, team.map((d, i) => teamRow(d, i, refresh)), (setTimeout(() => { justLead = null; }, 0), null),
          team.length < max ? h('button', { class: 'hs-add', type: 'button', onClick: () => DK.router.reset('team') }, DK.icon('plus', 14), h('span', null, t('home.manage'))) : null));

      const daily = DK.missions.list('daily');
      const missionsCard = h('section', { class: 'card hub-missions' },
        h('div', { class: 'panel-head' }, DK.icon('scroll', 17), h('h3', null, t('home.today')),
          h('span', { class: 'hs-count' }, `${daily.filter((m) => m.claimed).length}/${daily.length}`), h('span', { class: 'grow' }),
          btn({ icon: 'next', label: t('home.allMissions'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('progress', { tab: 'missions' }) })),
        h('div', { class: 'hm-list' }, daily.map((m) => missionLine(m, refresh))));

      const extra = DK.menus.items('hub');
      const extraRow = extra.length ? h('div', { class: 'row gap-s wrap' }, extra.map((it) => btn({ icon: it.icon, label: typeof it.label === 'function' ? it.label() : it.label, variant: it.variant || 'tone', tip: typeof it.desc === 'function' ? it.desc() : it.desc, onClick: () => DK.menus.activate(it) }))) : null;

      return h('div', { class: 'screen hub camp-screen hub-v3' },
        h('div', { class: 'hub-main' }, V.campScene({ team, compact: true }), playBar(refresh), extraRow),
        h('aside', { class: 'hub-side' }, teamCard, V.todoCard(refresh, params.todo), missionsCard));
    },
  });

})();
