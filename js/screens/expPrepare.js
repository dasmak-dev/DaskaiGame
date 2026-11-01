/* =============================================================
 * screens/expPrepare.js — Preparar la expedición (briefing).
 *
 * Todo lo que importa antes de salir, a la vista:
 *   - Cabecera: zona, TAMAÑO del mapa, niveles, dificultad, emblemas,
 *     avisos (recompensa por caer ante el jefe, provisiones) y «Partir».
 *   - Tu equipo: quién va, con su vida (y curar con objetos de casa).
 *   - Mochila: LISTA de lo que te llevas, con − / + por objeto.
 *   - Tu bolsa: LISTA de lo que puedes llevar (filtro por tipo), con «+».
 *
 * Durante la expedición sólo se puede usar lo que va en la mochila
 * (DK.bag trabaja sobre e.pack). Capacidad: DK.expedition.packCapacity().
 * También se puede arrastrar entre las dos listas (ratón o dedo).
 *
 * params: { pack: { id: n }, cat }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const E = () => DK.expedition;

  /** La última mochila, limitada a lo que aún tienes y a lo que cabe. */
  function lastPack() {
    const last = DK.store.state.lastPack || {}, home = DK.bag.home(), out = {};
    let room = E().packCapacity();
    Object.entries(last).forEach(([id, n]) => { const k = Math.min(n, home[id] || 0, room); if (k > 0 && E().canPack(id)) { out[id] = k; room -= k; } });
    return out;
  }

  /** Texto corto de lo que hace un objeto. */
  const effectOf = (it) => (it.use ? V.useText(it) : it.stats ? Object.entries(it.stats).map(([k, v]) => `${DK.tr('stats', D.stats[k])} ${v > 0 ? '+' : ''}${v}`).join(' · ') : it.desc);

  DK.screens.register('expPrepare', {
    title: () => t('pack.title'), icon: 'bag', section: 'battle', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      if (E().active()) { setTimeout(() => DK.router.reset('expedition'), 0); return h('div'); }
      // La mochila empieza vacía: tú decides qué te llevas
      params.pack = params.pack || {};
      params.cat = params.cat || 'all';
      const pack = params.pack, home = DK.bag.home();
      const cap = E().packCapacity(), used = E().packSize(pack);
      const left = (id) => (home[id] || 0) - (pack[id] || 0);
      /** Mueve n unidades a la mochila (n<0 las devuelve a la bolsa). */
      const move = (id, n) => {
        const cur = pack[id] || 0;
        const k = Math.max(0, Math.min(cur + n, home[id] || 0, cur + cap - used));
        if (k === cur) { if (n > 0) { DK.audio.sfx('error'); DK.ui.toast(used >= cap ? t('pack.full') : t('pack.noMore'), { icon: 'bag', kind: 'bad' }); } return; }
        if (k) pack[id] = k; else delete pack[id];
        DK.audio.sfx('select'); refresh();
      };

      const pv = E().preview(), z = D.zones[pv.zone];
      const team = DK.party.active();
      const ok = DK.party.aliveActive().length > 0;
      const go = () => { if (!ok) return; E().start(pack); DK.audio.sfx('select'); DK.router.reset('expedition'); };
      DK.keys.on('Enter', go);
      const diff = DK.rules.difficulty(), dd = D.difficulties[diff];
      const lvBonus = E().levelBonus(1) + ((pv.mod && D.mapMods[pv.mod].levels) || 0);

      /* ---------- Cabecera (briefing) ---------- */
      const goBtn = (cls) => btn({ icon: 'flag', label: t('pack.go'), desc: t('pack.goDesc', { n: used }), size: 'lg', variant: 'primary', hotkey: '↵', disabled: !ok, cls, onClick: go });
      const fact = (icon, label, value, tip, cls = '') => h('div', { class: 'brief-fact ' + cls, tip }, h('span', { class: 'brief-fact-icon' }, DK.icon(icon, 18)),
        h('span', { class: 'brief-fact-text' }, h('span', { class: 'muted small' }, label), h('b', null, value)));
      const hero = h('div', { class: 'card brief-hero', style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
        h('div', { class: 'brief-art' }, DK.scenes.render(z.scene, z.colors),
          h('div', { class: 'brief-art-sprites' }, z.enemies.slice(0, 3).map((en) => V.sprite(en.species, { size: 54, silhouette: !DK.codex.getEntry(z.id, en.species), cls: 'float' })))),
        h('div', { class: 'brief-main' },
          h('span', { class: 'muted small' }, t('exp.firstMap')),
          h('h2', null, DK.icon(z.icon, 22), ' ', z.name),
          h('div', { class: 'brief-facts' },
            fact(DK.config.expedition.sizes[pv.size].icon, t('brief.sizeFloors', { n: E().sizeFloors(pv.size) }), t('size.' + pv.size + '.name'), t('size.' + pv.size + '.desc', { n: E().sizeFloors(pv.size) }), 'size s-' + pv.size),
            fact('star', t('brief.levels'), `${t('common.lvl')} ${z.levels[0] + lvBonus}-${z.levels[1] + lvBonus}`, t('brief.levelsTip')),
            fact(dd.icon, t('brief.difficulty'), t('difficulty.' + diff + '.name'), t('difficulty.' + diff + '.desc'), 'diff d-' + diff),
            fact('emblem', t('emblem.title'), String(DK.camp.emblems()), t('emblem.help'), 'emblem'),
            pv.mod ? fact(D.mapMods[pv.mod].icon, t('brief.mod'), t('mod.' + pv.mod + '.name'), `${t('mod.' + pv.mod + '.desc')}\n${t('mod.reward', { n: Math.round((D.mapMods[pv.mod].coins || 0) * 100) })}`, 'mod m-' + pv.mod) : null,
            fact('crown', t('brief.reward'), t('brief.rewardValue', { n: E().bossEmblems(pv.size) }), t('brief.rewardTip'))),
          h('p', { class: 'small muted' }, t('size.' + pv.size + '.desc', { n: E().sizeFloors(pv.size) })),
          pv.mod ? h('div', { class: 'warning mod-note m-' + pv.mod }, DK.icon(D.mapMods[pv.mod].icon, 16), h('span', null, h('b', null, t('mod.' + pv.mod + '.name') + ': '), t('mod.' + pv.mod + '.desc'), ' ', t('mod.reward', { n: Math.round((D.mapMods[pv.mod].coins || 0) * 100) }))) : null,
          h('div', { class: 'brief-notes' },
            DK.store.state.consolation ? h('div', { class: 'warning good' }, DK.icon('crown', 16), h('span', null, t('pack.consolation'))) : null,
            DK.camp.value('provisiones') ? h('div', { class: 'warning good' }, DK.icon('flask', 16), h('span', null, t('pack.free', { n: DK.camp.value('provisiones') }))) : null,
            DK.rules.permadeath() ? h('div', { class: 'warning bad' }, DK.icon('skull', 16), h('span', null, t('zones.permadeath'))) : null)),
        h('div', { class: 'brief-go' }, goBtn('brief-go-btn'),
          h('p', { class: 'muted small' }, DK.icon('info', 12), ' ', t('pack.risk'), ' ', t('exp.exitRule') + '.')));

      /* ---------- Equipo ---------- */
      const teamPanel = h('div', { class: 'panel stack-s brief-team' },
        h('div', { class: 'panel-head' }, DK.icon('users', 18), h('h3', null, t('pack.team')), h('span', { class: 'badge' }, `${team.length}/${DK.config.maxTeam}`),
          h('span', { class: 'grow' }),
          btn({ icon: 'flask', label: t('heal.button'), size: 'sm', variant: 'ghost', onClick: async () => { if (await V.healDialog(team)) refresh(); } }),
          btn({ icon: 'edit', label: t('home.manage'), size: 'sm', variant: 'ghost', onClick: () => DK.router.go('team') })),
        h('div', { class: 'list' }, team.map((d) => V.daskaiRow(d, { compact: true }))),
        V.warnings(DK.world.warnings(pv.zone).filter((w) => w.kind !== 'good'), async () => { if (await V.healDialog(team)) refresh(); }));

      /* ---------- Mochila (lista) ---------- */
      const cats = DK.config.expedition.packCategories;
      const order = (a, b) => cats.indexOf(D.items[a].category) - cats.indexOf(D.items[b].category) || D.rarities[D.items[a].rarity].order - D.rarities[D.items[b].rarity].order || D.items[a].name.localeCompare(D.items[b].name);
      /** Fila de objeto. where: 'pack' (con − cantidad +) o 'bag' (con disponibles y +). */
      const row = (id, where) => {
        const it = D.items[id];
        const inPack = pack[id] || 0, avail = left(id);
        const el = h('div', { class: `pk-row r-${it.rarity}`, dataset: { id } },
          h('span', { class: 'pk-icon' }, V.itemIcon(it, 22)),
          h('span', { class: 'pk-main' }, h('b', null, it.name), h('span', { class: 'muted small' }, effectOf(it))),
          where === 'pack'
            ? h('span', { class: 'pk-step' },
              h('button', { class: 'pk-btn', type: 'button', 'aria-label': t('pack.less'), onClick: () => move(id, -1) }, DK.icon('minus', 14)),
              h('b', { class: 'pk-qty' }, String(inPack)),
              h('button', { class: 'pk-btn', type: 'button', 'aria-label': t('pack.more'), disabled: !avail || used >= cap, onClick: () => move(id, 1) }, DK.icon('plus', 14)))
            : h('span', { class: 'pk-step' },
              h('span', { class: 'pk-have muted small', tip: t('pack.haveTip') }, 'x' + avail),
              h('button', { class: 'pk-btn add', type: 'button', 'aria-label': t('pack.take'), tip: t('pack.tipAdd2'), disabled: used >= cap, onClick: (e) => move(id, e.shiftKey ? 99 : 1) }, DK.icon('plus', 14))));
        // Arrastrar de una lista a la otra (con el dedo: mantener pulsado)
        DK.ui.pointerDrag(el, { zones: '.pk-bag, .pk-pack', touch: true, onDrop: (zone, e) => {
          const to = zone.classList.contains('pk-pack') ? 'pack' : 'bag';
          if (to !== where) move(id, (to === 'pack' ? 1 : -1) * (e.shiftKey ? 99 : 1));
        } });
        return el;
      };

      const chosen = Object.keys(pack).sort(order);
      const last = lastPack();
      const full = used >= cap;
      const packPanel = h('div', { class: 'panel stack-s pk-pack' },
        h('div', { class: 'panel-head' }, DK.icon('bag', 18), h('h3', null, t('pack.backpack')),
          h('span', { class: 'badge ' + (full ? 'warn' : '') }, t('pack.cap', { n: used, max: cap }))),
        h('div', { class: 'cap-bar' + (full ? ' full' : ''), style: { '--p': Math.min(100, (used / cap) * 100) + '%' } }, h('span')),
        chosen.length ? h('div', { class: 'pk-list' }, chosen.map((id) => row(id, 'pack')))
          : h('div', { class: 'pk-empty' }, DK.icon('bag', 24), h('b', null, t('pack.empty')), h('span', { class: 'muted small' }, t('pack.dropHint2'))),
        h('div', { class: 'pk-actions' },
          Object.keys(last).length ? btn({ icon: 'repeat', label: t('pack.repeat'), size: 'sm', variant: 'ghost', onClick: () => { params.pack = last; refresh(); } }) : null,
          btn({ icon: 'sparkles', label: t('pack.suggest'), size: 'sm', variant: 'ghost', onClick: () => { params.pack = E().suggestPack(); refresh(); } }),
          chosen.length ? btn({ icon: 'x', label: t('pack.clear'), size: 'sm', variant: 'ghost', onClick: () => { params.pack = {}; refresh(); } }) : null));

      /* ---------- Bolsa (lista con filtro) ---------- */
      const all = Object.keys(home).filter((id) => home[id] > 0 && E().canPack(id)).sort(order);
      const countIn = (c) => all.filter((id) => c === 'all' || D.items[id].category === c).reduce((a, id) => a + left(id), 0);
      const filters = h('div', { class: 'pk-filters', role: 'tablist' }, [['all', 'layers', t('pack.all')], ...cats.map((c) => [c, D.categories[c].icon, DK.tr('categories', D.categories[c])])].map(([id, icon, label]) =>
        h('button', { class: 'pk-filter' + (params.cat === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': params.cat === id, onClick: () => { params.cat = id; refresh(); } },
          DK.icon(icon, 14), h('span', null, label), h('b', null, String(countIn(id))))));
      const shown = all.filter((id) => left(id) > 0 && (params.cat === 'all' || D.items[id].category === params.cat));
      const bagPanel = h('div', { class: 'panel stack-s pk-bag' },
        h('div', { class: 'panel-head' }, DK.icon('home', 18), h('h3', null, t('pack.bag')), h('span', { class: 'muted small' }, t('pack.bagHint2'))),
        filters,
        shown.length ? h('div', { class: 'pk-list' }, shown.map((id) => row(id, 'bag')))
          : DK.ui.empty('bag', all.length ? t('pack.allPacked') : t('pack.nothing'), all.length ? '' : t('pack.nothingText')));

      /* ---------- Objetivos de crafteo: qué materiales buscar ---------- */
      const needs = Object.entries(DK.crafting.goalNeeds());
      const goalsPanel = DK.crafting.goals().length ? h('div', { class: 'panel stack-s brief-goals' },
        h('div', { class: 'panel-head' }, DK.icon('star', 18), h('h3', null, t('craft.goals')),
          h('span', { class: 'grow' }), btn({ icon: 'anvil', label: t('nav.craft'), size: 'sm', variant: 'ghost', onClick: () => DK.router.go('craft') })),
        needs.length ? h('div', { class: 'pk-list' }, needs.map(([id, n]) => h('div', { class: 'pk-row r-' + D.items[id].rarity },
          h('span', { class: 'pk-icon' }, V.itemIcon(D.items[id], 20)),
          h('span', { class: 'pk-main' }, h('b', null, D.items[id].name), h('span', { class: 'muted small' }, V.craftSourceText ? V.craftSourceText(id) : '')),
          h('b', { class: 'goal-miss' }, t('craft.needMore', { n })))))
          : h('div', { class: 'warning good' }, DK.icon('check', 16), h('span', null, t('craft.goalsAllReady')))) : null;

      return h('div', { class: 'screen brief-screen' }, hero,
        h('div', { class: 'brief-grid' }, teamPanel, packPanel, h('div', { class: 'stack brief-right' }, bagPanel, goalsPanel)),
        h('div', { class: 'brief-sticky' }, goBtn('')));
    },
  });
})();
