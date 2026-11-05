/* =============================================================
 * screens/profile.js — Perfil del aventurero.
 *
 *  - Cabecera: foto (daskai, icono o imagen propia), marco, título (logros),
 *    nombre y datos de la partida; a la derecha, las cifras principales.
 *  - Avance de la partida (códice, objetos, zonas, jefes, logros, recetas)
 *    y rejilla de cifras (racha, mayor golpe, expediciones, colección...).
 *  - Gráficos: últimos combates, resultados, victorias por casa y por zona.
 *  - Estadísticas detalladas, daskai más usados y últimos logros.
 *
 * params: { edit: bool, avTab: 'daskai'|'icon'|'image' }
 * Las estadísticas se registran en systems/progress.js (evento battle:end).
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
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
  /**
   * Cabecera: foto, título, nombre editable, datos de la partida y, a la
   * derecha, las cuatro cifras principales (victorias, combates, profundidad, jefes).
   */
  function hero(params, refresh) {
    const st = DK.store.state, p = st.player, s = st.stats;
    const save = () => { DK.store.save(); DK.app.renderNav(); };
    const nameInput = h('input', { class: 'input profile-name-input', value: p.name, maxlength: 16, 'aria-label': t('newGame.nameLabel') });
    const commitName = () => {
      const v = nameInput.value.trim();
      if (v.length < 2) { nameInput.value = p.name; DK.ui.toast(t('newGame.nameError'), { icon: 'x', kind: 'bad' }); return; }
      if (v !== p.name) { p.name = v; save(); DK.ui.toast(t('profile.saved'), { icon: 'check', kind: 'good' }); }
    };
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
    const lead = DK.party.active()[0];
    const color = lead ? D.houseColor(DK.daskai.species(lead).house) : 'var(--gold)';
    const pic = h('button', { class: 'profile-pic', type: 'button', tip: t('profile.changePic'), onClick: () => { params.edit = !params.edit; refresh(); } },
      V.avatar(p, { size: 104 }), h('span', { class: 'profile-pic-edit' }, DK.icon('edit', 14)));
    const decided = s.wins + s.losses, rate = decided ? Math.round((s.wins / decided) * 100) : 0;
    const R = 24, C = 2 * Math.PI * R;
    const ring = h('div', { class: 'kpi-ring', tip: t('profile.rateTip', { w: s.wins, l: s.losses }) });
    ring.innerHTML = `<svg viewBox="0 0 60 60" width="60" height="60"><circle cx="30" cy="30" r="${R}" class="ring-bg"/><circle cx="30" cy="30" r="${R}" class="ring-fg" stroke-dasharray="${(C * rate) / 100} ${C}" transform="rotate(-90 30 30)"/></svg><b>${rate}%</b>`;
    const head = (icon, value, label) => h('div', { class: 'ph-stat' }, h('b', null, value), h('span', null, DK.icon(icon, 12), label));
    const diff = st.difficulty && D.difficulties[st.difficulty];
    return h('div', { class: 'card profile-hero ph', style: { '--ph': color } },
      h('div', { class: 'ph-id' }, pic,
        h('div', { class: 'profile-id' },
          h('label', { class: 'ph-title' }, DK.icon('award', 12),
            h('select', { class: 'ph-title-select', 'aria-label': t('profile.title'), onChange: (e) => { p.title = e.target.value || null; save(); refresh(); } },
              DK.avatars.titles().map((x) => h('option', { value: x.id || '', selected: (p.title || '') === (x.id || '') }, x.label)))),
          nameInput,
          h('div', { class: 'ph-meta' },
            h('span', null, DK.icon('clock', 12), DK.util.duration(s.playTime)),
            h('span', null, DK.icon('flag', 12), t('profile.since', { date: new Date(st.created || Date.now()).toLocaleDateString(DK.i18n.lang) })),
            h('span', null, DK.icon('folder', 12), t('profile.slot', { n: DK.store.slot })),
            diff ? h('span', null, DK.icon(diff.icon, 12), t('difficulty.' + st.difficulty + '.name')) : null),
          h('div', { class: 'ph-actions' },
            btn({ icon: 'edit', label: params.edit ? t('profile.doneEditing') : t('profile.customize'), size: 'sm', variant: params.edit ? 'primary' : 'tone', onClick: () => { params.edit = !params.edit; refresh(); } }),
            btn({ icon: 'share', label: t('share.button'), size: 'sm', variant: 'tone', onClick: () => DK.shareCard.open() })))),
      h('div', { class: 'ph-stats' },
        h('div', { class: 'ph-stat ring' }, ring, h('span', null, t('profile.winRate'))),
        head('swords', num(s.battles), t('pstats.battles')),
        head('compass', s.bestDepth ? String(s.bestDepth) : '—', t('profile.bestDepth')),
        head('crown', num(s.bossesDefeated), t('pstats.bosses'))));
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
        tip: f.unlocked ? (f.shinyHouse ? t('profile.frameShinyName', { house: DK.tr('houses', D.houses[f.shinyHouse]) }) : f.season ? t('pass.frameName', { metal: t('pass.metal.' + f.metal), n: f.season })
          : t('profile.frame.' + (f.house ? 'house' : f.id), { house: f.house ? DK.tr('houses', D.houses[f.house]) : '' })) : f.reqText(),
        onClick: () => { p.frame = f.id; DK.store.save(); DK.app.renderNav(); DK.audio.sfx('select'); refresh(); } },
        V.avatar(p, { size: 52, frame: f.id }), f.unlocked ? null : h('span', { class: 'avatar-lock' }, DK.icon('lock', 14)));
      return b;
    }));

    return h('div', { class: 'card profile-editor' },
      h('div', { class: 'panel-head' }, DK.icon('user', 18), h('h3', null, t('profile.picTitle'))), tabs,
      h('h4', null, DK.icon('sparkle', 16), ' ', t('profile.frames')), h('p', { class: 'muted small' }, t('profile.framesHint')), frames);
  }

  /* ---------- Resumen y gráficos ---------- */
  /** Cifras secundarias en una rejilla compacta. */
  function kpis(s) {
    const st = DK.store.state;
    const tile = (icon, label, value, sub, color) => h('div', { class: 'pk', style: color ? { '--pk': color } : null }, h('span', { class: 'pk-icon' }, DK.icon(icon, 16)),
      h('div', { class: 'pk-text' }, h('b', null, value), h('span', null, label), sub ? h('small', null, sub) : null));
    return h('div', { class: 'pk-grid' },
      tile('flame', t('profile.streak'), num(s.streak), t('profile.bestStreak', { n: num(s.bestStreak) }), '#f97316'),
      tile('target', t('profile.biggestHit'), num(s.biggestHit), t('profile.crits', { n: num(s.crits) }), '#ef4444'),
      tile('flag', t('profile.expTitle'), num(s.expeditions), t('profile.xl', { n: num(s.xlCleared || 0) }), '#a855f7'),
      tile('paw', t('profile.owned'), num(DK.party.all().length), t('profile.inTeam', { n: DK.party.active().length }), '#22c55e'),
      tile('evolve', t('pstats.evolutions'), num(s.evolutions), t('profile.shinies', { n: num(s.shinies) }), '#38bdf8'),
      tile('craftCog', t('pstats.crafts'), num(s.crafts), t('profile.recipesKnown', { n: (st.recipesKnown || []).length }), '#eab308'),
      tile('coin', t('pstats.coinsEarned'), num(s.coinsEarned), t('profile.coinsNowShort', { n: num(DK.wallet.get()) }), '#facc15'),
      tile('emblem', t('profile.emblems'), num(DK.camp.emblems()), t('profile.runes', { n: num(DK.runes ? DK.runes.total() : 0) }), '#e7c27a'));
  }

  /** Avance de la partida: códice, objetos, zonas, jefes, logros y recetas. */
  function progressCard() {
    const st = DK.store.state, tot = DK.codex.totals();
    const zones = Object.keys(D.zones), open = zones.filter((z) => DK.world.isUnlocked(z)).length;
    const recipes = D.recipes.length, known = D.recipes.filter((r) => (st.recipesKnown || []).includes(r.id)).length;
    const row = (icon, label, n, max, color) => {
      const pct = max ? Math.round((n / max) * 100) : 0;
      return h('div', { class: 'pp-row', tip: `${label}: ${n}/${max}` },
        h('span', { class: 'pp-label' }, DK.icon(icon, 14), label),
        h('span', { class: 'pp-track' }, h('i', { style: { width: pct + '%', background: color } })),
        h('b', null, `${n}/${max}`), h('small', null, pct + '%'));
    };
    const all = [[tot.species, tot.speciesTotal], [tot.items, tot.itemsTotal], [open, zones.length], [tot.bosses, tot.bossesTotal], [DK.achievements.unlockedCount(), D.achievements.length], [known, recipes]];
    const overall = Math.round((all.reduce((a, [n, m]) => a + (m ? n / m : 0), 0) / all.length) * 100);
    return h('div', { class: 'card pp' },
      h('div', { class: 'panel-head' }, DK.icon('chart', 18), h('h3', null, t('profile.progressTitle')), h('span', { class: 'grow' }), h('b', { class: 'pp-total' }, overall + '%')),
      h('div', { class: 'pp-rows' },
        row('book', t('profile.ppSpecies'), tot.species, tot.speciesTotal, '#22c55e'),
        row('bag', t('profile.ppItems'), tot.items, tot.itemsTotal, '#38bdf8'),
        row('map', t('profile.ppZones'), open, zones.length, '#eab308'),
        row('crown', t('profile.ppBosses'), tot.bosses, tot.bossesTotal, '#ef4444'),
        row('award', t('profile.ppAch'), DK.achievements.unlockedCount(), D.achievements.length, '#a855f7'),
        row('craftCog', t('profile.ppRecipes'), known, recipes, '#f97316')));
  }

  /** Tira de los últimos combates (un punto por combate, el más reciente a la derecha). */
  function historyCard(s) {
    const hist = s.history || [];
    const legend = h('div', { class: 'chart-legend' }, Object.entries(OUTCOMES).filter(([k]) => k !== 'captured' || DK.config.captureEnabled).map(([k, o]) =>
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
        row('shop', t('pstats.coinsSpent'), num(s.coinsSpent)), row('craftCog', t('pstats.crafts'), num(s.crafts))));
  }

  /**
   * Funciones desbloqueadas: entradas de la guía (data/wiki.js) que ya has
   * abierto y tienen una cifra (runas, corrupción, abismo, entrenamiento…).
   * Aparecen solas al desbloquearlas; pulsar abre su explicación en el Códice.
   */
  function featuresCard() {
    const list = DK.wiki.unlocked().filter((e) => e.stat);
    if (!list.length) return null;
    return h('div', { class: 'card pf-feat' },
      h('div', { class: 'panel-head' }, DK.icon('sparkles', 18), h('h3', null, t('wiki.unlockedTitle')), h('span', { class: 'muted small' }, `${DK.wiki.unlocked().length}/${D.wiki.length}`)),
      h('p', { class: 'muted small' }, t('wiki.unlockedHint')),
      h('div', { class: 'pf-feat-grid' }, list.map((e) => h('button', { class: 'pf-feat-row' + (e.group === 'endgame' ? ' late' : ''), type: 'button', tip: t('wiki.open'),
        onClick: () => DK.router.reset('codex', { tab: 'wiki', wsel: e.id }) },
        h('span', { class: 'pf-feat-icon' }, DK.icon(e.icon, 15)), h('span', { class: 'grow' }, DK.wiki.title(e)), h('b', null, e.stat())))));
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
      recent.length ? h('div', { class: 'list mt' }, recent.map((a) => h('div', { class: 'stat-line' }, DK.icon(a.icon, 16), h('span', { class: 'grow' }, DK.achievements.name(a)), h('span', { class: 'muted small' }, ago(st.achievements[a.id])))))
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
        h('div', { class: 'ph-row' }, progressCard(), kpis(s)),
        h('div', { class: 'profile-grid' },
          h('div', { class: 'stack' }, historyCard(s), expeditionsCard()),
          h('div', { class: 'stack' }, featuresCard(), outcomesCard(s), housesCard(s), zonesCard(), favoritesCard(s), achievementsCard())),
        // Estadísticas detalladas a todo el ancho (3 columnas si caben)
        detailCards(s));
    },
  });
})();
