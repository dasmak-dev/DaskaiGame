/* =============================================================
 * screens/profile.js — Perfil del aventurero.
 *
 *  - Cabecera: foto (daskai, icono o imagen propia), marco, nombre,
 *    título (logros) y lema. Todo se edita en la propia pantalla.
 *  - Resumen: combates, % de victorias, racha, mayor golpe...
 *  - Gráficos: últimos combates, resultados, victorias por casa y por zona.
 *  - Estadísticas detalladas, daskai más usados y últimos logros.
 *
 * params: { edit: bool, avTab: 'daskai'|'icon'|'image' }
 * Las estadísticas se registran en systems/progress.js (evento battle:end).
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const t = (k, v) => DK.t(k, v);
  const num = (n) => Math.round(n || 0).toLocaleString(DK.i18n.lang);

  DK.menus.add('nav', { id: 'profile', icon: 'user', order: 70, screen: 'profile', mobile: false, label: () => t('nav.profile') });

  /** Colores de cada resultado (se reutilizan en la tira y en la barra apilada). */
  const OUTCOMES = {
    won: { icon: 'trophy', color: 'var(--good)' },
    captured: { icon: 'orb', color: 'var(--primary)' },
    fled: { icon: 'flee', color: 'var(--muted)' },
    lost: { icon: 'skull', color: 'var(--bad)' },
  };

  /** "hace 5 min" / "hace 2 h" / fecha. */
  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return t('profile.agoNow');
    if (s < 3600) return t('profile.agoMin', { n: Math.floor(s / 60) });
    if (s < 86400) return t('profile.agoHour', { n: Math.floor(s / 3600) });
    return new Date(ts).toLocaleDateString(DK.i18n.lang);
  }

  /* ---------- Cabecera y editor ---------- */
  function hero(params, refresh) {
    const p = DK.store.state.player, s = DK.store.state.stats;
    const save = () => { DK.store.save(); DK.app.renderNav(); };
    const nameInput = h('input', { class: 'input profile-name-input', value: p.name, maxlength: 16, 'aria-label': t('newGame.nameLabel') });
    const commitName = () => {
      const v = nameInput.value.trim();
      if (v.length < 2) { nameInput.value = p.name; DK.ui.toast(t('newGame.nameError'), { icon: 'x', kind: 'bad' }); return; }
      if (v !== p.name) { p.name = v; save(); DK.ui.toast(t('profile.saved'), { icon: 'check', kind: 'good' }); }
    };
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
    const motto = h('input', { class: 'input input-sm profile-motto', value: p.motto || '', maxlength: 60, placeholder: t('profile.mottoPh'), 'aria-label': t('profile.motto') });
    motto.addEventListener('change', () => { p.motto = motto.value.trim(); save(); });

    const pic = h('button', { class: 'profile-pic', type: 'button', tip: t('profile.changePic'), onClick: () => { params.edit = !params.edit; refresh(); } },
      V.avatar(p, { size: 112 }), h('span', { class: 'profile-pic-edit' }, DK.icon('edit', 16)));

    return h('div', { class: 'card profile-hero' },
      pic,
      h('div', { class: 'profile-id' },
        h('span', { class: 'muted small' }, DK.icon('award', 13), ' ', DK.avatars.titleText(p)),
        nameInput,
        motto,
        h('div', { class: 'chips' },
          h('span', { class: 'chip' }, DK.icon('clock', 13), DK.util.duration(s.playTime)),
          h('span', { class: 'chip' }, DK.icon('flag', 13), t('profile.since', { date: new Date(DK.store.state.created || Date.now()).toLocaleDateString(DK.i18n.lang) })),
          h('span', { class: 'chip' }, DK.icon('folder', 13), t('profile.slot', { n: DK.store.slot })))),
      h('div', { class: 'profile-hero-actions' },
        btn({ icon: 'edit', label: params.edit ? t('profile.doneEditing') : t('profile.customize'), variant: params.edit ? 'primary' : 'tone', onClick: () => { params.edit = !params.edit; refresh(); } }),
        btn({ icon: 'share', label: t('share.button'), variant: 'tone', onClick: () => DK.shareCard.open() }),
        DK.ui.select({ label: t('profile.title'), value: p.title || '', onChange: (v) => { p.title = v || null; save(); refresh(); },
          options: DK.avatars.titles().map((x) => ({ value: x.id || '', label: x.label })) })));
  }

  /** Editor de foto y marco (dentro de la pantalla, sin ventana). */
  function editor(params, refresh) {
    const p = DK.store.state.player;
    const set = (av) => { p.avatar = av; DK.store.save(); DK.app.renderNav(); DK.audio.sfx('select'); refresh(); };
    const isSel = (av) => JSON.stringify(av) === JSON.stringify(p.avatar);
    const opt = (av, content, tip) => h('button', { class: 'avatar-opt' + (isSel(av) ? ' selected' : ''), type: 'button', tip, onClick: () => set(av) }, content);

    const file = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
    file.addEventListener('change', async () => {
      try { set({ kind: 'image', src: await DK.avatars.fromFile(file.files[0]) }); DK.ui.toast(t('profile.saved'), { icon: 'check', kind: 'good' }); }
      catch (e) { DK.ui.toast(t('profile.imageError'), { icon: 'x', kind: 'bad' }); }
    });

    const tabs = DK.ui.tabs({
      active: params.avTab, onChange: (id) => (params.avTab = id),
      items: [
        { id: 'daskai', label: t('profile.tabDaskai'), icon: 'paw', render: () => h('div', { class: 'avatar-opts' },
          opt(null, V.avatar(p, { size: 56, avatar: null, frame: 'none' }), t('profile.leader')),
          DK.avatars.knownSpecies().map((sp) => opt({ kind: 'daskai', species: sp }, V.avatar(p, { size: 56, avatar: { kind: 'daskai', species: sp }, frame: 'none' }), D.species[sp].name)),
          DK.party.all().filter((d) => d.shiny).map((d) => opt({ kind: 'daskai', species: d.species, shiny: true }, V.avatar(p, { size: 56, avatar: { kind: 'daskai', species: d.species, shiny: true }, frame: 'none' }), `${D.species[d.species].name} · ${t('common.shiny')}`))) },
        { id: 'icon', label: t('profile.tabIcon'), icon: 'star', render: () => {
          const cur = p.avatar && p.avatar.kind === 'icon' ? p.avatar : { icon: 'user', color: DK.avatars.colors[0] };
          return h('div', { class: 'stack-s' },
            h('div', { class: 'avatar-opts' }, DK.avatars.icons.map((ic) => opt({ kind: 'icon', icon: ic, color: cur.color }, V.avatar(p, { size: 52, avatar: { kind: 'icon', icon: ic, color: cur.color }, frame: 'none' })))),
            h('div', { class: 'color-opts' }, DK.avatars.colors.map((c) => h('button', { class: 'color-opt' + (p.avatar && p.avatar.kind === 'icon' && p.avatar.color === c ? ' selected' : ''), type: 'button', style: { background: c }, 'aria-label': c, onClick: () => set({ kind: 'icon', icon: cur.icon, color: c }) }))));
        } },
        { id: 'image', label: t('profile.tabImage'), icon: 'upload', render: () => h('div', { class: 'stack-s' },
          h('p', { class: 'muted small' }, t('profile.imageHint')),
          h('div', { class: 'row gap-s wrap' },
            btn({ icon: 'upload', label: t('profile.upload'), variant: 'primary', onClick: () => file.click() }),
            p.avatar && p.avatar.kind === 'image' ? btn({ icon: 'trash', label: t('profile.removeImage'), variant: 'ghost', onClick: () => set(null) }) : null),
          file) },
      ],
    });

    const frames = h('div', { class: 'avatar-opts' }, DK.avatars.frames().map((f) => {
      const b = h('button', { class: 'avatar-opt' + (p.frame === f.id ? ' selected' : '') + (f.unlocked ? '' : ' locked'), type: 'button', disabled: !f.unlocked,
        tip: f.unlocked ? t('profile.frame.' + (f.house ? 'house' : f.id), { house: f.house ? DK.tr('houses', D.houses[f.house]) : '' }) : f.reqText(),
        onClick: () => { p.frame = f.id; DK.store.save(); DK.app.renderNav(); DK.audio.sfx('select'); refresh(); } },
        V.avatar(p, { size: 52, frame: f.id }), f.unlocked ? null : h('span', { class: 'avatar-lock' }, DK.icon('lock', 14)));
      return b;
    }));

    return h('div', { class: 'card profile-editor' },
      h('div', { class: 'panel-head' }, DK.icon('user', 18), h('h3', null, t('profile.picTitle'))), tabs,
      h('h4', null, DK.icon('sparkle', 16), ' ', t('profile.frames')), h('p', { class: 'muted small' }, t('profile.framesHint')), frames);
  }

  /* ---------- Resumen y gráficos ---------- */
  function kpis(s) {
    const decided = s.wins + s.losses;
    const rate = decided ? Math.round((s.wins / decided) * 100) : 0;
    const R = 26, C = 2 * Math.PI * R;
    const ring = h('div', { class: 'kpi-ring', tip: t('profile.rateTip', { w: s.wins, l: s.losses }) });
    ring.innerHTML = `<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${R}" class="ring-bg"/><circle cx="32" cy="32" r="${R}" class="ring-fg" stroke-dasharray="${(C * rate) / 100} ${C}" transform="rotate(-90 32 32)"/></svg><b>${rate}%</b>`;
    const tile = (icon, label, value, sub) => h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label' }, DK.icon(icon, 15), label), h('b', { class: 'kpi-value' }, value), sub ? h('span', { class: 'muted small' }, sub) : null);
    return h('div', { class: 'kpi-grid' },
      h('div', { class: 'card kpi kpi-rate' }, ring, h('div', null, h('span', { class: 'kpi-label' }, t('profile.winRate')), h('span', { class: 'muted small' }, t('profile.rateSub', { w: num(s.wins), l: num(s.losses) })))),
      tile('swords', t('pstats.battles'), num(s.battles), t('profile.flees', { n: num(s.flees) })),
      tile('flame', t('profile.streak'), num(s.streak), t('profile.bestStreak', { n: num(s.bestStreak) })),
      tile('target', t('profile.biggestHit'), num(s.biggestHit), t('profile.crits', { n: num(s.crits) })),
      tile('orb', t('pstats.captures'), num(s.captures), t('profile.shinies', { n: num(s.shinies) })),
      tile('crown', t('pstats.bosses'), num(s.bossesDefeated), t('profile.expeditions', { n: num(s.expeditions) })),
      tile('compass', t('profile.bestDepth'), s.bestDepth ? t('exp.depth', { n: s.bestDepth }) : '—', t('profile.bestDepthSub')));
  }

  /** Tira de los últimos combates (un punto por combate, el más reciente a la derecha). */
  function historyCard(s) {
    const hist = s.history || [];
    const legend = h('div', { class: 'chart-legend' }, Object.entries(OUTCOMES).map(([k, o]) =>
      h('span', { class: 'legend-item' }, h('span', { class: 'legend-dot', style: { background: o.color } }), t('profile.out.' + k))));
    const body = hist.length
      ? h('div', { class: 'stack-s' },
        h('div', { class: 'hist-strip', role: 'img', 'aria-label': t('profile.history') }, hist.slice().reverse().map((x) => h('span', {
          class: 'hist-dot', style: { background: OUTCOMES[x.outcome] ? OUTCOMES[x.outcome].color : 'var(--muted)' },
          tip: `${t('profile.out.' + x.outcome)} · ${x.enemy ? D.species[x.enemy.species].name + ' ' + t('common.lvl') + ' ' + x.enemy.level : ''} · ${D.zones[x.zone] ? D.zones[x.zone].name : ''}`,
        }))),
        legend,
        h('div', { class: 'list hist-list' }, hist.slice(0, 8).map((x) => {
          const o = OUTCOMES[x.outcome] || OUTCOMES.fled;
          return h('div', { class: 'hist-row' },
            h('span', { class: 'hist-icon', style: { color: o.color } }, DK.icon(o.icon, 18)),
            x.enemy ? V.sprite(x.enemy.species, { size: 36, shiny: x.enemy.shiny }) : null,
            h('div', { class: 'grow' },
              h('b', null, t('profile.out.' + x.outcome), ' · ', x.enemy ? `${D.species[x.enemy.species].name} ${t('common.lvl')} ${x.enemy.level}` : ''),
              h('div', { class: 'muted small' }, [D.zones[x.zone] && D.zones[x.zone].name, x.ally && t('profile.with', { name: D.species[x.ally.species].name }), x.turns && t('profile.turns', { n: x.turns })].filter(Boolean).join(' · '))),
            x.boss ? h('span', { class: 'badge leader' }, DK.icon('crown', 13), t('codex.boss')) : null,
            h('span', { class: 'muted small nowrap' }, ago(x.t)));
        })))
      : DK.ui.empty('swords', t('profile.noHistory'), t('profile.noHistoryText'));
    return h('div', { class: 'card' }, h('div', { class: 'panel-head' }, DK.icon('list', 18), h('h3', null, t('profile.history')), hist.length ? h('span', { class: 'muted small' }, t('profile.lastN', { n: hist.length })) : null), body);
  }

  /** Barra apilada con el reparto de resultados. */
  function outcomesCard(s) {
    const parts = [['won', Math.max(0, s.wins - s.captures)], ['captured', s.captures], ['fled', s.flees], ['lost', s.losses]].filter(([, n]) => n > 0);
    const total = parts.reduce((a, [, n]) => a + n, 0);
    return h('div', { class: 'card' }, h('div', { class: 'panel-head' }, DK.icon('chart', 18), h('h3', null, t('profile.outcomes'))),
      total ? h('div', { class: 'stack-s' },
        h('div', { class: 'stack-bar' }, parts.map(([k, n]) => h('span', { style: { flex: n, background: OUTCOMES[k].color }, tip: `${t('profile.out.' + k)}: ${n} (${Math.round((n / total) * 100)}%)` }))),
        h('div', { class: 'chart-legend' }, parts.map(([k, n]) => h('span', { class: 'legend-item' }, h('span', { class: 'legend-dot', style: { background: OUTCOMES[k].color } }), `${t('profile.out.' + k)} `, h('b', null, n)))))
        : h('p', { class: 'muted small' }, t('profile.noHistoryText')));
  }

  /** Barras horizontales: [{icon, label, value, color}] */
  function hbars(rows, empty) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (!rows.some((r) => r.value)) return h('p', { class: 'muted small' }, empty);
    return h('div', { class: 'hbars' }, rows.map((r) => h('div', { class: 'hbar-row', tip: `${r.label}: ${r.value}` },
      h('span', { class: 'hbar-label' }, r.icon ? DK.icon(r.icon, 15) : null, r.label),
      h('span', { class: 'hbar-track' }, h('span', { class: 'hbar-fill', style: { width: (r.value / max) * 100 + '%', background: r.color } })),
      h('b', { class: 'hbar-val' }, num(r.value)))));
  }

  function housesCard(s) {
    return h('div', { class: 'card' }, h('div', { class: 'panel-head' }, DK.icon('swords', 18), h('h3', null, t('profile.byHouse'))),
      hbars(Object.values(D.houses).map((hs) => ({ icon: hs.icon, label: DK.tr('houses', hs), value: s.defeatedHouses[hs.id] || 0, color: D.houseColor(hs.id) })), t('profile.noHistoryText')));
  }

  function zonesCard() {
    const rows = Object.values(D.zones).filter((z) => DK.world.isUnlocked(z.id)).map((z) => ({ icon: z.icon, label: z.name, value: DK.world.progress(z.id).wins, color: z.colors[1] }));
    return h('div', { class: 'card' }, h('div', { class: 'panel-head' }, DK.icon('map', 18), h('h3', null, t('profile.byZone'))), hbars(rows, t('profile.noHistoryText')));
  }

  function detailCards(s) {
    const row = (icon, label, val) => h('div', { class: 'stat-line' }, DK.icon(icon, 16), h('span', { class: 'grow' }, label), h('b', null, val));
    const species = Object.values(D.species);
    const known = DK.avatars.knownSpecies().length;
    const zones = DK.codex.discoveredZones();
    const codexPct = zones.length ? Math.round((zones.reduce((a, z) => a + DK.codex.completion(z), 0) / Object.keys(D.zones).length) * 100) : 0;
    return h('div', { class: 'stats-grid' },
      h('div', { class: 'card' }, h('h3', null, t('pstats.combat')),
        row('target', t('pstats.damageDealt'), num(s.damageDealt)), row('shield', t('pstats.damageTaken'), num(s.damageTaken)),
        row('bolt', t('pstats.crits'), num(s.crits)), row('flask', t('pstats.itemsUsed'), num(s.itemsUsed)),
        row('gauge', t('profile.avgDamage'), num(s.battles ? s.damageDealt / s.battles : 0))),
      h('div', { class: 'card' }, h('h3', null, t('profile.collection')),
        row('paw', t('profile.owned'), num(DK.party.all().length)), row('book', t('profile.speciesSeen'), `${known}/${species.length}`),
        row('map', t('profile.codex'), codexPct + '%'), row('evolve', t('pstats.evolutions'), num(s.evolutions)),
        row('sparkles', t('pstats.shinies'), num(s.shinies)), row('trash', t('pstats.released'), num(s.released)), row('skull', t('profile.fallen'), num((DK.store.state.graveyard || []).length))),
      h('div', { class: 'card' }, h('h3', null, t('pstats.economy')),
        row('coin', t('profile.coinsNow'), num(DK.wallet.get())), row('coin', t('pstats.coinsEarned'), num(s.coinsEarned)),
        row('shop', t('pstats.coinsSpent'), num(s.coinsSpent)), row('anvil', t('pstats.crafts'), num(s.crafts))));
  }

  /** Los 3 daskai que más han luchado. */
  function favoritesCard(s) {
    const top = Object.entries(s.usage || {}).map(([uid, n]) => ({ d: DK.party.get(uid), n })).filter((x) => x.d).sort((a, b) => b.n - a.n).slice(0, 3);
    return h('div', { class: 'card' }, h('div', { class: 'panel-head' }, DK.icon('heart', 18), h('h3', null, t('profile.favorites'))),
      top.length ? h('div', { class: 'fav-list' }, top.map((x, i) => h('button', { class: 'fav-item', type: 'button', onClick: () => DK.router.reset('team', { uid: x.d.uid }) },
        h('span', { class: 'fav-rank' }, i + 1), V.dSprite(x.d, { size: 56 }),
        h('div', { class: 'grow' }, h('b', null, DK.daskai.name(x.d)), h('div', { class: 'muted small' }, `${t('common.lvl')} ${x.d.level} · ${t('pstats.usedIn', { n: x.n })}`)))))
        : h('p', { class: 'muted small' }, t('profile.noHistoryText')));
  }

  function achievementsCard() {
    const st = DK.store.state;
    const recent = D.achievements.filter((a) => st.achievements[a.id]).sort((a, b) => st.achievements[b.id] - st.achievements[a.id]).slice(0, 4);
    return h('div', { class: 'card' }, h('div', { class: 'panel-head' }, DK.icon('award', 18), h('h3', null, t('profile.lastAch')),
      btn({ icon: 'next', label: t('home.allMissions'), size: 'sm', variant: 'ghost', onClick: () => DK.router.reset('progress', { tab: 'ach' }) })),
      DK.ui.bar({ value: DK.achievements.unlockedCount(), max: D.achievements.length, kind: 'exp' }),
      recent.length ? h('div', { class: 'list mt' }, recent.map((a) => h('div', { class: 'stat-line' }, DK.icon(a.icon, 16), h('span', { class: 'grow' }, t(`achievements.${a.id}.name`)), h('span', { class: 'muted small' }, ago(st.achievements[a.id])))))
        : h('p', { class: 'muted small' }, t('profile.noAch')));
  }

  /**
   * Historial de expediciones: mejor resultado por zona y últimas expediciones
   * (pulsar una abre su resumen completo).
   */
  function expeditionsCard() {
    const hist = DK.store.state.expHistory || [];
    const OUT = { completed: ['trophy', 'good'], retreat: ['flag', 'warn'], lost: ['skull', 'bad'], lostBoss: ['crown', 'bad'] };
    // Resumen: mejor profundidad, mapas superados y expediciones cobradas
    const best = Math.max(0, ...hist.map((x) => x.depth || 1));
    const maps = hist.reduce((a, x) => a + (x.zones || []).length, 0);
    const cashed = hist.filter((x) => x.outcome === 'completed').length;
    return h('div', { class: 'card stack-s' },
      h('div', { class: 'panel-head' }, DK.icon('flag', 18), h('h3', null, t('profile.expTitle')), h('span', { class: 'muted small' }, t('profile.expCount', { n: hist.length }))),
      hist.length ? h('div', { class: 'stack-s' },
        h('div', { class: 'chips' },
          h('span', { class: 'chip pos' }, DK.icon('compass', 13), t('exp.best', { n: best })),
          h('span', { class: 'chip' }, DK.icon('crown', 13), t('sum.maps') + ': ' + maps),
          h('span', { class: 'chip' }, DK.icon('trophy', 13), t('profile.expCashed', { n: cashed, total: hist.length }))),
        h('h4', null, DK.icon('list', 14), ' ', t('profile.expRecent')),
        h('div', { class: 'list' }, hist.slice(0, 10).map((x, i) => {
          const [icon, cls] = OUT[x.outcome] || OUT.retreat;
          return h('button', { class: 'exp-hist ' + cls, type: 'button', onClick: () => DK.router.go('expSummary', { index: i }) },
            h('span', { class: 'exp-hist-icon' }, DK.icon(icon, 16)),
            h('div', { class: 'grow' }, h('b', null, D.zones[x.zone] ? D.zones[x.zone].name : x.zone),
              h('div', { class: 'muted small' }, [t('sum.out.' + x.outcome), t('exp.depth', { n: x.depth || 1 }), t('exp.floor', { step: Math.min(x.step, x.total), total: x.total }), (x.fallen || []).length ? t('profile.expFallen', { n: x.fallen.length }) : null].filter(Boolean).join(' · '))),
            h('span', { class: 'muted small nowrap' }, ago(x.endedAt)), DK.icon('next', 14));
        }))) : h('p', { class: 'muted small' }, t('profile.expNone')));
  }

  DK.screens.register('profile', {
    title: () => t('nav.profile'), icon: 'user', section: 'profile', music: 'menu', tutorial: 'profile',
    render(params) {
      const refresh = () => DK.router.refresh();
      const s = DK.store.state.stats;
      params.avTab = params.avTab || 'daskai';
      return h('div', { class: 'screen profile-screen' },
        hero(params, refresh),
        params.edit ? editor(params, refresh) : null,
        kpis(s),
        h('div', { class: 'profile-grid' },
          h('div', { class: 'stack' }, historyCard(s), expeditionsCard()),
          h('div', { class: 'stack' }, outcomesCard(s), housesCard(s), zonesCard(), favoritesCard(s), achievementsCard())),
        // Estadísticas detalladas a todo el ancho (3 columnas si caben)
        detailCards(s));
    },
  });
})();
