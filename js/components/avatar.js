/* =============================================================
 * components/avatar.js — Foto de perfil del jugador, marcos y títulos.
 *
 *   DK.views.avatar(player, { size })   → círculo con la foto y su marco
 *   DK.avatars.icons / colors           → opciones del tipo "icono"
 *   DK.avatars.frames()                 → marcos con su requisito
 *   DK.avatars.titles()                 → títulos desbloqueados (logros)
 *   DK.avatars.fromFile(file)           → Promise<dataURL> recortada a 160 px
 *
 * player.avatar puede ser:
 *   null                                   → el líder del equipo (tal cual: su aspecto y colores)
 *   { kind: 'daskai', species, shiny }     → un daskai que hayas visto
 *   { kind: 'icon', icon, color }          → icono sobre color
 *   { kind: 'image', src }                 → foto propia (dataURL, se guarda en la partida)
 *
 * Para añadir un marco: un fr(id, grupo, paint, { req, reqText }) más en FRAMES y su nombre en
 * lang → profile.frame.<id> (y profile.frameReq.<id> si se desbloquea).
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const st = () => DK.store.state;

  // v5.20: más iconos, colores lisos y degradados ('g:#a,#b')
  const icons = ['user', 'swords', 'crown', 'star', 'heart', 'shield', 'paw', 'gem', 'flame', 'droplet', 'leaf', 'moon', 'sun', 'mountain', 'bolt', 'compass',
    'skull', 'demon', 'dagger', 'fang', 'claw', 'feather', 'crystal', 'orb', 'rune', 'anvil', 'hammer', 'helmet', 'trophy', 'flag', 'music', 'dice',
    'eye', 'snowflake', 'campfire', 'sprout', 'potion', 'scroll', 'target', 'globe'];
  const colors = ['#6d5dfc', '#0ea5e9', '#14b8a6', '#65a30d', '#f2b705', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#475569',
    '#1e1b4b', '#7f1d1d', '#14532d', '#0c4a6e', '#78350f', '#111827', '#b45309', '#be185d', '#0f766e', '#e7c27a',
    'g:#6d5dfc,#22d3ee', 'g:#f97316,#be123c', 'g:#22c55e,#0f766e', 'g:#f472b6,#7c3aed', 'g:#fde68a,#b45309', 'g:#0f172a,#7c3aed', 'g:#38bdf8,#1e3a8a', 'g:#a3e635,#365314'];
  /** Fondo CSS de un color de icono (liso o degradado). */
  const bgCss = (c) => (String(c).startsWith('g:') ? `linear-gradient(135deg, ${c.slice(2).split(',').join(', ')})` : c);

  /**
   * v5.20: cada marco se describe con `paint` y de ahí salen el CSS y el dibujo de la tarjeta:
   *   { k: 'solid', c: [color] } · { k: 'lin', c: [...], a: grados } · { k: 'conic', c: [...], from: grados }
   *   { k: 'stripes', c: [a, b], n: trozos }  (anillo a rayas)
   * group: basic (gratis) · house · feat (hazañas) · shiny · pass (la senda)
   */
  const paintCss = (pt) => pt.k === 'solid' ? pt.c[0]
    : pt.k === 'lin' ? `linear-gradient(${pt.a || 135}deg, ${pt.c.join(', ')})`
    : pt.k === 'conic' ? `conic-gradient(from ${pt.from || 0}deg, ${pt.c.join(', ')}, ${pt.c[0]})`
    : `repeating-conic-gradient(${pt.c[0]} 0 ${180 / (pt.n || 12)}deg, ${pt.c[1]} ${180 / (pt.n || 12)}deg ${360 / (pt.n || 12)}deg)`;
  const fr = (id, group, paint, extra = {}) => Object.assign({ id, group, paint, css: paintCss(paint), req: () => true }, extra);
  const S = () => st().stats;
  const feat = (id, paint, test, textKey, n) => fr(id, 'feat', paint, { req: () => test(n), reqText: () => t('profile.frameReq.' + textKey, { n }) });
  const legendBeaten = () => Object.values(st().legends || {}).some((x) => x && x.defeated > 0);

  /** Marcos: el requisito se comprueba con el estado actual de la partida. */
  const FRAMES = [
    fr('none', 'basic', { k: 'solid', c: ['var(--border)'] }),
    fr('iron', 'basic', { k: 'lin', c: ['#cbd5e1', '#475569', '#94a3b8', '#334155'] }),
    fr('ivory', 'basic', { k: 'lin', c: ['#fff7e6', '#d6c7a6', '#fff7e6'] }),
    fr('night', 'basic', { k: 'conic', c: ['#1e1b4b', '#6366f1', '#1e1b4b', '#312e81'] }),
    fr('blood', 'basic', { k: 'lin', c: ['#450a0a', '#ef4444', '#7f1d1d'] }),
    fr('verdant', 'basic', { k: 'lin', c: ['#14532d', '#4ade80', '#166534'] }),
    fr('tide', 'basic', { k: 'lin', c: ['#0c4a6e', '#38bdf8', '#0e7490'] }),
    fr('dashes', 'basic', { k: 'stripes', c: ['#e7c27a', '#3b2b1d'], n: 12 }),
    fr('candy', 'basic', { k: 'stripes', c: ['#f9a8d4', '#fff'], n: 10 }),
    ...Object.values(D.houses).map((hs) => fr(hs.id, 'house', { k: 'solid', c: [hs.color] }, {
      house: hs.id,
      req: () => (S().defeatedHouses[hs.id] || 0) >= 10,
      reqText: () => t('profile.frameHouse', { n: 10, house: DK.tr('houses', hs) }),
    })),
    feat('explorer', { k: 'lin', c: ['#a16207', '#fde68a', '#a16207'], a: 90 }, (n) => (S().expeditions || 0) >= n, 'explorer', 10),
    feat('hunter', { k: 'stripes', c: ['#22c55e', '#14532d'], n: 8 }, (n) => (S().captures || 0) >= n, 'hunter', 25),
    feat('streak', { k: 'stripes', c: ['#f472b6', '#7c3aed'], n: 14 }, (n) => (S().bestStreak || 0) >= n, 'streak', 15),
    feat('abyss', { k: 'conic', c: ['#0f172a', '#7c3aed', '#22d3ee', '#0f172a'] }, (n) => (S().bestDepth || 0) >= n, 'abyss', 4),
    feat('slayer', { k: 'conic', c: ['#450a0a', '#f97316', '#fde047', '#f97316'], from: 45 }, (n) => (S().bossesDefeated || 0) >= n, 'slayer', 15),
    fr('mythic', 'feat', { k: 'conic', c: ['#fde68a', '#22d3ee', '#a78bfa', '#f472b6'] }, { glow: true, req: legendBeaten, reqText: () => t('profile.frameReq.mythic') }),
    fr('gold', 'feat', { k: 'lin', c: ['#fde68a', '#f59e0b', '#b45309', '#fde68a'] }, { glow: true, req: () => DK.achievements.unlockedCount() >= 10, reqText: () => t('profile.frameGold', { n: 10 }) }),
    fr('shiny', 'shiny', { k: 'conic', c: ['#f472b6', '#facc15', '#34d399', '#60a5fa', '#a78bfa'] }, { glow: true, req: () => DK.party.all().some((d) => d.shiny), reqText: () => t('profile.frameShiny') }),
    fr('legend', 'feat', { k: 'conic', c: ['#6d5dfc', '#22d3ee', '#6d5dfc', '#f472b6'], from: 90 }, { glow: true, req: () => DK.achievements.unlockedCount() >= D.achievements.length, reqText: () => t('profile.frameLegend') }),
  ];

  /* Marcos de la Senda (una terna por temporada) y variocolores por casa */
  const METAL = { bronce: ['#e0b07a', '#8a5a2b'], plata: ['#f8fafc', '#64748b'], oro: ['#fde68a', '#b45309'] };
  const SEASON_TINT = ['#38bdf8', '#a855f7', '#22c55e', '#f43f5e', '#eab308', '#14b8a6'];
  const seasonFrames = () => {
    const out = [], n = DK.pass ? DK.pass.season() : 1;
    for (let s = 1; s <= n; s++) Object.entries(METAL).forEach(([m, [a, b]], i) => {
      const id = s > 1 ? `senda${s}_${m}` : `senda_${m}`, tint = SEASON_TINT[(s - 2 + SEASON_TINT.length) % SEASON_TINT.length];
      const paint = s > 1 ? { k: 'conic', c: [a, tint, b, tint], from: i * 40 } : m === 'oro' ? { k: 'conic', c: [a, b, '#fff7d6', '#d97706'] } : { k: 'lin', c: [a, b, a, b] };
      out.push(fr(id, 'pass', paint, { season: s, metal: m, glow: m === 'oro', req: () => DK.pass.has('frame', id), reqText: () => t('pass.frameReqSeason', { n: [10, 20, 30][i], s }) }));
    });
    return out;
  };
  const shinyFrames = () => Object.values(D.houses).map((hs) => fr('shiny_' + hs.id, 'shiny', { k: 'conic', c: [hs.color, '#fde68a', hs.color, '#f9a8d4'] }, {
    shinyHouse: hs.id, glow: true,
    req: () => DK.party.all().some((d) => d.shiny && D.species[d.species].house === hs.id), reqText: () => t('profile.frameShinyHouse', { house: DK.tr('houses', hs) }),
  }));
  const allFrames = () => FRAMES.concat(shinyFrames(), seasonFrames());
  const GROUPS = ['basic', 'house', 'feat', 'shiny', 'pass'];

  /** Relleno de un marco en un <canvas> (tarjeta de compartir), centrado en cx, cy de radio r. */
  function canvasFill(ctx, paint, cx, cy, r) {
    const css = (c) => (c === 'var(--border)' ? 'rgba(255,255,255,.25)' : c);
    if (paint.k === 'solid') return css(paint.c[0]);
    if (paint.k === 'lin') {
      const a = ((paint.a || 135) - 90) * Math.PI / 180, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
      const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      paint.c.forEach((c, i) => g.addColorStop(i / (paint.c.length - 1), c)); return g;
    }
    if (!ctx.createConicGradient) return paint.c[0];
    const g = ctx.createConicGradient(((paint.from || 0) - 90) * Math.PI / 180, cx, cy);
    if (paint.k === 'conic') { const cs = paint.c.concat(paint.c[0]); cs.forEach((c, i) => g.addColorStop(i / (cs.length - 1), c)); return g; }
    const n = (paint.n || 12) * 2; // a rayas: paradas duras
    for (let i = 0; i < n; i++) { const c = paint.c[i % 2]; g.addColorStop(i / n, c); g.addColorStop((i + 1) / n - 0.0001, c); }
    return g;
  }

  DK.avatars = {
    icons, colors, bgCss, GROUPS, canvasFill,
    /** Nombre de un marco para mostrarlo. */
    frameName(f) {
      return f.shinyHouse ? t('profile.frameShinyName', { house: DK.tr('houses', D.houses[f.shinyHouse]) }) : f.season ? t('pass.frameName', { metal: t('pass.metal.' + f.metal), n: f.season })
        : t('profile.frame.' + (f.house ? 'house' : f.id), { house: f.house ? DK.tr('houses', D.houses[f.house]) : '' });
    },
    /** Lista de marcos con `unlocked` calculado. */
    frames() { return allFrames().map((f) => ({ ...f, unlocked: f.req() })); },
    frame(id) { return allFrames().find((f) => f.id === id) || FRAMES[0]; },
    /** Los marcos de un grupo (basic, house, feat, shiny, pass) con `unlocked`. */
    framesOf(group) { return DK.avatars.frames().filter((f) => f.group === group); },
    /** Títulos: el de por defecto + el nombre de cada logro conseguido. */
    titles() {
      const pass = DK.pass.titles().map((id) => ({ id: 'pass:' + id, label: DK.pass.titleName(id) }));
      return [{ id: null, label: t('hub.adventurer') }].concat(pass,
        D.achievements.filter((a) => st().achievements[a.id]).map((a) => ({ id: a.id, label: DK.achievements.name(a) })));
    },
    titleText(p) {
      if (p.title && p.title.startsWith('pass:') && DK.pass.titles().includes(p.title.slice(5))) return DK.pass.titleName(p.title.slice(5));
      const a = p.title && st().achievements[p.title] && D.achievements.find((x) => x.id === p.title); return a ? DK.achievements.name(a) : t('hub.adventurer');
    },
    /** Especies que el jugador conoce (las suyas y las vistas en el códice). */
    knownSpecies() {
      const set = new Set(DK.party.all().map((d) => d.species));
      Object.values(st().codex || {}).forEach((z) => Object.keys(z.enemies || {}).forEach((s) => set.add(s)));
      return [...set].filter((s) => D.species[s]);
    },
    /**
     * v4.73: qué daskai sale en la foto: { species, look, shiny } o null.
     *   · un daskai elegido de la lista → su forma típica (como hasta ahora)
     *   · sin foto (el líder) → el líder tal cual es (su aspecto, sus dos casas, su forma)
     * @param {Object|null} av  player.avatar
     * @param {Object} [leader] líder ya resuelto (otra ranura); si no, el de la partida activa
     */
    subject(av, leader) {
      if (av && av.kind === 'daskai') return D.species[av.species] ? { species: av.species, look: null, shiny: !!av.shiny } : null;
      if (av && av.kind) return null;
      if (leader) return D.species[leader.species] ? leader : null;
      const d = DK.store.state ? (DK.party.leader() || DK.party.all()[0]) : null;
      return d ? { species: d.species, look: DK.looks.of(d), shiny: !!d.shiny } : null;
    },
    /**
     * Lee una imagen del ordenador y la recorta en un cuadrado de 160 px (JPEG).
     * @param {File} file
     * @returns {Promise<string>} dataURL
     */
    fromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
        const r = new FileReader();
        r.onerror = reject;
        r.onload = () => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            const S = 160, side = Math.min(img.width, img.height);
            const c = document.createElement('canvas'); c.width = c.height = S;
            c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
            resolve(c.toDataURL('image/jpeg', 0.85));
          };
          img.src = r.result;
        };
        r.readAsDataURL(file);
      });
    },
  };

  /**
   * Foto de perfil con su marco.
   * @param {Object} p  st.player (o un objeto con avatar/frame)
   * @param {Object} [o] {size = 48, avatar, frame, leader} (avatar/frame para previsualizar; leader = el
   *   líder de otra ranura, { species, look, shiny }, para las partidas guardadas)
   */
  V.avatar = (p, { size = 48, avatar, frame, leader } = {}) => {
    const av = avatar !== undefined ? avatar : p && p.avatar;
    const fr = DK.avatars.frame(frame !== undefined ? frame : p && p.frame);
    let inner;
    if (av && av.kind === 'image') inner = h('img', { src: av.src, alt: '' });
    else if (av && av.kind === 'icon') inner = h('span', { class: 'avatar-icon', style: { background: bgCss(av.color) } }, DK.icon(av.icon, Math.round(size * 0.5)));
    else {
      const who = DK.avatars.subject(av, leader);
      const house = who && D.species[who.species] ? D.species[who.species].house : 'luz';
      inner = h('span', { class: 'avatar-daskai', style: { '--c': D.houseColor(house) } },
        who ? V.sprite(who.species, { size: Math.round(size * 0.9), look: who.look, shiny: who.shiny }) : DK.icon('user', Math.round(size * 0.5)));
    }
    return h('span', { class: 'avatar-pic frame-' + fr.id + (fr.id !== 'none' ? ' fr-rich' : '') + (fr.glow ? ' fr-glow' : ''), style: { width: size + 'px', height: size + 'px', '--frame': fr.css }, 'aria-hidden': 'true' }, inner);
  };
})();
