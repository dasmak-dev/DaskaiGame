/* =============================================================
 * screens/zones.js — Batalla.
 *   Arriba: el cartel de la expedición (empezar una nueva o seguir la que
 *   está en curso). Las expediciones son infinitas y eligen zona al azar
 *   (systems/expedition.js), así que aquí no se elige zona para ellas.
 *   En medio: el mapa del mundo (un camino en pixel art con las zonas
 *   desbloqueadas, la siguiente «???» y el resto «+N»; ← → cambia de zona).
 *   Abajo: la ficha de la zona elegida, con sus récords y el combate libre
 *   (que se desbloquea al derrotar al jefe de esa zona).
 *
 *   DK.play.start(zona, { expedition })  → combate libre, o expedición (la zona se ignora)
 *   DK.play.quick()                      → continúa la expedición o empieza una
 *
 * params: { zone }
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;

  DK.menus.add('nav', { id: 'battle', icon: 'swords', order: 40, pin: true, screen: 'zones', label: () => t('nav.battle'), badge: () => (DK.expedition.active() ? '!' : '') });

  /* ---------- Empezar combates desde cualquier pantalla ---------- */
  DK.play = {
    /**
     * Empieza un combate en una zona.
     * @param {string} zoneId
     * @param {Object} [o] {expedition: true para empezar/continuar una expedición}
     * @returns {boolean} false si no hay daskai en pie
     */
    start(zoneId, { expedition = false } = {}) {
      let alive = DK.party.aliveActive();
      // Fuera de expedición, si nadie del equipo está en pie se recupera lo justo para salir
      if (!alive.length && !DK.expedition.active()) { DK.expedition.afterEnd(); alive = DK.party.aliveActive(); }
      if (!alive.length) { DK.audio.sfx('error'); DK.ui.toast(t('warn.allFainted'), { icon: 'skull', kind: 'bad' }); return false; }
      const exp = DK.expedition.active();
      if (exp && !expedition) { DK.ui.toast(t('zones.expBusy'), { icon: 'flag', kind: 'bad' }); return false; }
      if (expedition) {
        // Antes de salir se prepara la mochila (screens/expPrepare.js);
        // las expediciones se juegan desde su mapa (screens/expedition.js)
        DK.router.go(exp ? 'expedition' : 'expPrepare');
        return true;
      }
      if (!DK.world.freeUnlocked(zoneId)) { DK.audio.sfx('error'); DK.ui.toast(t('zones.freeLocked'), { icon: 'lock', kind: 'bad' }); return false; }
      DK.router.go('battle', { zone: zoneId, leaderUid: alive[0].uid });
      return true;
    },
    /** Botón "Jugar": continúa la expedición o entra en la zona recomendada. */
    quick() {
      const exp = DK.expedition.active();
      if (exp) return this.start(exp.zone, { expedition: true });
      return this.start(null, { expedition: true });
    },
  };

  /* ---------------- Ficha de la zona elegida ---------------- */
  /** Récords de una zona en una tira de iconos: mapas, profundidad, XL, jefe oculto y el mapa más rápido. */
  function recordsStrip(z) {
    const r = DK.world.progress(z.id).rec || { maps: 0, best: 0, sizes: {}, fastest: null };
    const sec = DK.world.secret(z.id);
    const cell = (icon, label, value, dim) => h('div', { class: 'bz-stat' + (dim ? ' dim' : ''), tip: label }, DK.icon(icon, 16), h('b', null, value), h('small', null, label));
    return h('div', { class: 'bz-stats', 'aria-label': t('zones.records') },
      cell('trophy', t('zones.winsShort'), String(DK.world.progress(z.id).wins || 0), !DK.world.progress(z.id).wins),
      cell('book', t('zones.codexShort'), Math.round(DK.codex.completion(z.id) * 100) + '%', !DK.codex.completion(z.id)),
      cell('map', t('zones.recMaps'), String(r.maps), !r.maps),
      cell('compass', t('zones.recDepth'), r.best ? String(r.best) : '—', !r.best),
      cell('mountain', t('zones.recXl'), String(r.sizes.xl || 0), !r.sizes.xl),
      cell('cave', t('zones.recSecret'), sec.defeated ? '×' + sec.defeated : '?', !sec.defeated),
      cell('clock', t('zones.recFast'), r.fastest ? DK.util.duration(Math.round(r.fastest / 1000)) : '—', !r.fastest));
  }

  /** Ficha compacta de una zona: dibujo con sus daskai, datos, récords y combate libre. */
  function zoneCard(z) {
    const exp = DK.expedition.active();
    const ok = DK.party.aliveActive().length > 0;
    const bossDone = DK.world.boss(z.id).defeated > 0;
    const free = DK.world.freeUnlocked(z.id);
    const art = h('div', { class: 'bz-art', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, DK.scenes.render(z.scene, z.colors),
      h('div', { class: 'bz-mons' }, z.enemies.map((e) => V.sprite(e.species, { size: 46, silhouette: !DK.codex.getEntry(z.id, e.species), cls: 'float' }))));
    return h('section', { class: 'card bz-card', style: { '--z1': z.colors[0], '--z2': z.colors[1] } }, art,
      h('div', { class: 'bz-body' },
        h('div', { class: 'bz-title' }, h('span', { class: 'bz-icon' }, DK.icon(z.icon, 22)),
          h('div', { class: 'grow' }, h('h3', null, z.name), h('span', { class: 'muted small' }, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`)),
          z.boss ? h('span', { class: 'chip' + (bossDone ? ' pos' : '') }, DK.icon('crown', 13), bossDone ? t('zones.bossDone') : t('zones.bossLevel', { n: z.boss.level })) : null),
        h('p', { class: 'muted small bz-desc' }, z.desc),
        recordsStrip(z),
        h('div', { class: 'bz-actions' },
          free
            ? btn({ icon: 'swords', label: t('zones.free'), desc: t('zones.freeDesc'), variant: 'tone', disabled: !ok || !!exp, tip: exp ? t('zones.expBusy') : null, onClick: () => DK.play.start(z.id) })
            : btn({ icon: 'lock', label: t('zones.free'), desc: t('zones.freeLocked'), variant: 'tone', disabled: true }))));
  }

  /* ---------------- Cartel de la expedición ---------------- */
  /** Empezar una expedición nueva o seguir la que está en curso: una línea y un botón grande. */
  function expeditionHero(refresh) {
    const exp = DK.expedition.active();
    const ok = DK.party.aliveActive().length > 0;
    const team = DK.party.active();
    const pv = exp ? null : DK.expedition.preview();
    const z = D.zones[exp ? exp.zone : pv.zone];
    const best = DK.expedition.bestDepth();
    const chips = exp
      ? [h('span', { class: 'chip' }, DK.icon('compass', 13), t('exp.depth', { n: exp.depth || 1 })),
        h('span', { class: 'chip' }, DK.icon('flag', 13), t('exp.floor', { step: Math.min(exp.step, exp.total), total: exp.total })),
        h('span', { class: 'chip' }, DK.icon('gift', 13), t('exp.lootNow', { items: DK.expedition.lootCount(), coins: exp.loot.coins }))]
      : [h('span', { class: 'chip' }, DK.icon(z.icon, 13), t('exp.nextZone', { zone: z.name })), V.sizeChip(pv.size), V.modChip(pv.mod),
        best ? h('span', { class: 'chip pos' }, DK.icon('trophy', 13), t('exp.best', { n: best })) : null,
        DK.rules.permadeath() ? h('span', { class: 'chip neg', tip: t('zones.permadeath') }, DK.icon('skull', 13), t('zones.hardMode')) : null];
    const problems = DK.world.warnings(z.id).filter((w) => w.kind !== 'good');
    return h('section', { class: 'bt-hero' + (exp ? ' on' : ''), style: { '--z1': z.colors[0], '--z2': z.colors[1] } },
      h('div', { class: 'bt-hero-bg', 'aria-hidden': 'true' }, DK.scenes.render(z.scene, z.colors)),
      h('div', { class: 'bt-hero-main' },
        h('div', { class: 'bt-hero-text' },
          h('span', { class: 'bt-kicker' }, DK.icon(exp ? 'flag' : 'compass', 14), exp ? t('home.expedition') : t('zones.heroNew')),
          h('h2', null, exp ? z.name : t('exp.start')),
          h('p', null, exp ? t('zones.heroOnLine') : t('zones.heroLine')),
          h('div', { class: 'chips' }, chips)),
        h('div', { class: 'bt-hero-go' },
          btn({ icon: exp ? 'map' : 'flag', label: exp ? t('exp.openMap') : t('exp.start'), size: 'lg', variant: 'primary', disabled: !ok, hotkey: '↵', cls: 'play-btn', onClick: () => DK.play.quick() }),
          exp ? h('span', { class: 'bt-hero-note', tip: t('exp.exitRuleTip') }, DK.icon('campfire', 13), ' ', t('exp.exitRule')) : null)),
      problems.length ? V.warnings(problems, async () => { if (await V.healDialog(team)) refresh(); }) : null);
  }

  /* ---------------- Mapa del mundo ----------------
   * Un camino en pixel art que une las zonas desbloqueadas; después, la
   * siguiente como «???» (con la pista para abrirla) y el resto como «+N».
   * Tu líder espera sobre la zona elegida. */
  const STEP = 168, MAP_H = 262, PAD = 90;
  const yAt = (i) => [172, 108, 180, 102, 164, 112][i % 6];

  function worldMap(sel, choose) {
    const rec = DK.world.recommended();
    const exp = DK.expedition.active();
    const all = Object.values(D.zones);
    const unlocked = all.filter((z) => DK.world.isUnlocked(z.id));
    const next = all.find((z) => !DK.world.isUnlocked(z.id));
    const hidden = all.filter((z) => !DK.world.isUnlocked(z.id) && z !== next).length;
    const stops = unlocked.map((z) => ({ z })).concat(next ? [{ z: next, locked: true }] : [], hidden ? [{ more: hidden }] : []);
    const W = PAD * 2 + STEP * (stops.length - 1);
    const pts = stops.map((s, i) => [PAD + i * STEP, yAt(i)]);

    // Terreno: una franja por parada con los colores de su zona (gris si no se conoce)
    const fogCols = ['#94a3b8', '#334155'];
    // (Las posiciones van respecto al centro del mapa, que ocupa al menos todo el ancho de la tarjeta.)
    const cx = (x) => `calc(50% + ${Math.round(x - W / 2)}px)`;
    const regions = stops.map((s, i) => {
      const cols = s.z && !s.locked ? s.z.colors : fogCols;
      const first = i === 0, last = i === stops.length - 1;
      const style = { left: first ? '0' : cx(pts[i][0] - STEP / 2), right: last ? '0' : null, width: last ? null : first ? cx(pts[i][0] + STEP / 2) : STEP + 'px', backgroundImage: `url(${DK.pix.terrain(cols, 'wm-' + i)})` };
      return h('span', { class: 'wm2-region' + (s.z && !s.locked ? '' : ' fog'), style });
    });

    // Camino: curvas suaves entre paradas (de tierra hasta la última conocida, de puntos después)
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'wm2-road'); svg.setAttribute('width', W); svg.setAttribute('height', MAP_H); svg.setAttribute('aria-hidden', 'true');
    svg.style.left = cx(0);
    const seg = (a, b) => { const mx = (a[0] + b[0]) / 2; return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`; };
    pts.slice(1).forEach((b, i) => {
      const lockedSeg = !!(stops[i + 1].locked || stops[i + 1].more);
      ['edge', 'fill', 'dash'].forEach((k) => {
        if (lockedSeg && k === 'dash') return;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', seg(pts[i], b)); path.setAttribute('class', 'r-' + k + (lockedSeg ? ' locked' : ''));
        svg.appendChild(path);
      });
    });

    // Adornos: árboles, arbustos y rocas lejos del camino
    const rnd = DK.util.seeded('wm-decor-' + stops.length);
    const kinds = ['pine', 'pine', 'bush', 'rock', 'pine', 'bush'];
    const decor = [];
    // (también a los lados del camino, por si el mapa es más ancho que el recorrido)
    const SIDE = 420;
    for (let i = 0, tries = 0; i < stops.length * 4 + 10 && tries < 300; tries++) {
      const x = -SIDE + rnd() * (W + SIDE * 2), y = 14 + rnd() * (MAP_H - 30);
      const near = pts.some(([px, py]) => Math.abs(px - x) < 54 && Math.abs(py - y) < 62);
      const k = Math.min(stops.length - 1, Math.max(0, Math.round((x - PAD) / STEP)));
      const onRoad = Math.abs(y - (pts[k][1])) < 30;
      if (near || onRoad) continue;
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      decor.push(h('span', { class: 'wm2-deco' + (stops[k].z && !stops[k].locked ? '' : ' fog'), style: { left: cx(x), top: y + 'px' } }, DK.pix.svg(DK.pix.sprites[kind](Math.floor(rnd() * 3)), 2)));
      i++;
    }

    // Paradas
    const leader = DK.party.active()[0];
    const nodes = stops.map((s, i) => {
      const [x, y] = pts[i];
      const pos = { left: cx(x), top: y + 'px' };
      if (s.more) return h('div', { class: 'wm2-node more', style: pos, tip: t('zones.moreHidden', { n: s.more }) },
        h('span', { class: 'wm2-pin' }, h('b', null, '+' + s.more)), h('span', { class: 'wm2-label' }, h('b', null, t('zones.moreShort'))));
      const z = s.z;
      if (s.locked) {
        const hint = t('zones.unlockHint2', { zone: D.zones[z.unlock] ? D.zones[z.unlock].name : t('zones.previous') });
        return h('div', { class: 'wm2-node locked', style: pos, tip: hint },
          h('span', { class: 'wm2-pin' }, DK.icon('lock', 22)),
          h('span', { class: 'wm2-label' }, h('b', null, '???'), h('small', null, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`)));
      }
      const bossDone = DK.world.boss(z.id).defeated > 0, isSel = sel && sel.id === z.id;
      const isRec = rec && rec.id === z.id, here = exp && exp.zone === z.id;
      return h('button', { class: 'wm2-node' + (isSel ? ' selected' : '') + (bossDone ? ' done' : ''), type: 'button', style: { ...pos, '--z1': z.colors[0], '--z2': z.colors[1] },
        'aria-pressed': String(!!isSel), 'aria-label': z.name, onClick: () => { DK.audio.sfx('select'); choose(z); } },
        isSel && leader ? h('span', { class: 'wm2-leader', 'aria-hidden': 'true' }, V.dSprite(leader, { size: 46 })) : null,
        h('span', { class: 'wm2-pin' }, DK.icon(z.icon, 24), bossDone ? h('span', { class: 'wm2-crown', tip: t('zones.bossDone') }, DK.icon('crown', 12)) : null),
        h('span', { class: 'wm2-label' }, h('b', null, z.name), h('small', null, `${t('common.lvl')} ${z.levels[0]}-${z.levels[1]}`)),
        here ? h('span', { class: 'wm2-tag exp' }, DK.icon('flag', 11), t('zones.inExpedition')) : isRec ? h('span', { class: 'wm2-tag' }, DK.icon('star', 11), t('zones.recommended')) : null);
    });

    const map = h('div', { class: 'wm2-map', style: { width: W + 'px', height: MAP_H + 'px' } }, regions, svg, decor, nodes);
    const scroll = h('div', { class: 'wm2-scroll' }, map);
    // Centra la zona elegida (sólo se desplaza la caja del mapa)
    setTimeout(() => {
      const i = stops.findIndex((s) => s.z && sel && s.z.id === sel.id);
      if (i >= 0 && scroll.scrollWidth > scroll.clientWidth) scroll.scrollLeft = Math.max(0, pts[i][0] - scroll.clientWidth / 2);
    }, 0);
    return h('section', { class: 'card wm2-card' },
      h('div', { class: 'panel-head' }, DK.icon('map', 18), h('h3', null, t('zones.worldMap')),
        h('span', { class: 'chip' }, DK.icon('flag', 13), t('zones.unlockedN', { n: unlocked.length, total: all.length })),
        h('span', { class: 'grow' }), h('span', { class: 'muted small wm2-help' }, t('zones.pickHint'))),
      scroll);
  }

  DK.screens.register('zones', {
    title: () => t('zones.title'), icon: 'map', section: 'battle', tutorial: 'zones', music: 'menu',
    render(params) {
      const refresh = () => DK.router.refresh();
      const rec = DK.world.recommended();
      const exp = DK.expedition.active();
      if (!params.zone || !DK.world.isUnlocked(params.zone)) params.zone = exp ? exp.zone : rec && rec.id;
      const sel = D.zones[params.zone];
      const unlocked = Object.values(D.zones).filter((z) => DK.world.isUnlocked(z.id));

      const choose = (z) => {
        params.zone = z.id; refresh();
        // En el móvil la ficha queda debajo del mapa: se lleva a la vista
        if (DK.ui.isNarrow()) setTimeout(() => { const c = document.querySelector('.bz-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
      };
      const step = (dir) => { const i = unlocked.findIndex((z) => z.id === params.zone); const z = unlocked[(i + dir + unlocked.length) % unlocked.length]; if (z) { DK.audio.sfx('select'); choose(z); } };
      DK.keys.on('ArrowLeft', () => step(-1)); DK.keys.on('ArrowRight', () => step(1));
      DK.keys.on('Enter', () => DK.play.quick());

      return h('div', { class: 'screen zones-screen bt-screen' },
        expeditionHero(refresh),
        worldMap(sel, choose),
        sel ? zoneCard(sel) : null);
    },
  });
})();
