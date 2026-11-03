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
 *   null                                   → el líder del equipo
 *   { kind: 'daskai', species, shiny }     → un daskai que hayas visto
 *   { kind: 'icon', icon, color }          → icono sobre color
 *   { kind: 'image', src }                 → foto propia (dataURL, se guarda en la partida)
 *
 * Para añadir un marco: un objeto más en FRAMES con { id, css, req, reqText }.
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const D = DK.data, V = DK.views;
  const { t } = DK;
  const st = () => DK.store.state;

  const icons = ['user', 'swords', 'crown', 'star', 'heart', 'shield', 'paw', 'gem', 'flame', 'droplet', 'leaf', 'moon', 'sun', 'mountain', 'bolt', 'compass'];
  const colors = ['#6d5dfc', '#0ea5e9', '#14b8a6', '#65a30d', '#f2b705', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#475569'];

  /** Marcos: el requisito se comprueba con el estado actual de la partida. */
  const FRAMES = [
    { id: 'none', css: 'var(--border)', req: () => true },
    ...Object.values(D.houses).map((hs) => ({
      id: hs.id, css: hs.color, house: hs.id,
      req: () => (st().stats.defeatedHouses[hs.id] || 0) >= 10,
      reqText: () => t('profile.frameHouse', { n: 10, house: DK.tr('houses', hs) }),
    })),
    { id: 'shiny', css: 'conic-gradient(from 0deg, #f472b6, #facc15, #34d399, #60a5fa, #a78bfa, #f472b6)', req: () => DK.party.all().some((d) => d.shiny), reqText: () => t('profile.frameShiny') },
    { id: 'gold', css: 'linear-gradient(135deg, #fde68a, #f59e0b, #b45309, #fde68a)', req: () => DK.achievements.unlockedCount() >= 10, reqText: () => t('profile.frameGold', { n: 10 }) },
    // Marcos de la Senda del aventurero (DK.pass)
    { id: 'senda_bronce', css: 'linear-gradient(135deg, #e0b07a, #8a5a2b, #f0c99a, #8a5a2b)', req: () => DK.pass.has('frame', 'senda_bronce'), reqText: () => t('pass.frameReq', { n: 10 }) },
    { id: 'senda_plata', css: 'linear-gradient(135deg, #f8fafc, #94a3b8, #e2e8f0, #64748b)', req: () => DK.pass.has('frame', 'senda_plata'), reqText: () => t('pass.frameReq', { n: 20 }) },
    { id: 'senda_oro', css: 'conic-gradient(from 0deg, #fde68a, #b45309, #fff7d6, #d97706, #fde68a)', req: () => DK.pass.has('frame', 'senda_oro'), reqText: () => t('pass.frameReq', { n: 30 }) },
    { id: 'legend', css: 'conic-gradient(from 90deg, #6d5dfc, #22d3ee, #6d5dfc, #f472b6, #6d5dfc)', req: () => DK.achievements.unlockedCount() >= D.achievements.length, reqText: () => t('profile.frameLegend') },
  ];

  DK.avatars = {
    icons, colors,
    /** Lista de marcos con `unlocked` calculado. */
    frames() { return FRAMES.map((f) => ({ ...f, unlocked: f.req() })); },
    frame(id) { return FRAMES.find((f) => f.id === id) || FRAMES[0]; },
    /** Títulos: el de por defecto + el nombre de cada logro conseguido. */
    titles() {
      const pass = D.pass.levels.filter((r, i) => r.title && DK.pass.claimed(i + 1)).map((r) => ({ id: 'pass:' + r.title, label: t('pass.titles.' + r.title) }));
      return [{ id: null, label: t('hub.adventurer') }].concat(pass,
        D.achievements.filter((a) => st().achievements[a.id]).map((a) => ({ id: a.id, label: DK.achievements.name(a) })));
    },
    titleText(p) {
      if (p.title && p.title.startsWith('pass:') && DK.pass.has('title', p.title.slice(5))) return t('pass.titles.' + p.title.slice(5));
      const a = p.title && st().achievements[p.title] && D.achievements.find((x) => x.id === p.title); return a ? DK.achievements.name(a) : t('hub.adventurer');
    },
    /** Especies que el jugador conoce (las suyas y las vistas en el códice). */
    knownSpecies() {
      const set = new Set(DK.party.all().map((d) => d.species));
      Object.values(st().codex || {}).forEach((z) => Object.keys(z.enemies || {}).forEach((s) => set.add(s)));
      return [...set].filter((s) => D.species[s]);
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
   * @param {Object} [o] {size = 48, avatar, frame} (avatar/frame para previsualizar)
   */
  V.avatar = (p, { size = 48, avatar, frame } = {}) => {
    const av = avatar !== undefined ? avatar : p && p.avatar;
    const fr = DK.avatars.frame(frame !== undefined ? frame : p && p.frame);
    let inner;
    if (av && av.kind === 'image') inner = h('img', { src: av.src, alt: '' });
    else if (av && av.kind === 'icon') inner = h('span', { class: 'avatar-icon', style: { background: av.color } }, DK.icon(av.icon, Math.round(size * 0.5)));
    else {
      const sp = av && av.kind === 'daskai' ? av.species : DK.store.state ? (DK.party.leader() || DK.party.all()[0] || {}).species : null;
      const house = sp && D.species[sp] ? D.species[sp].house : 'luz';
      inner = h('span', { class: 'avatar-daskai', style: { '--c': D.houseColor(house) } },
        sp ? V.sprite(sp, { size: Math.round(size * 0.9), shiny: !!(av && av.shiny) }) : DK.icon('user', Math.round(size * 0.5)));
    }
    return h('span', { class: 'avatar-pic frame-' + fr.id, style: { width: size + 'px', height: size + 'px', '--frame': fr.css }, 'aria-hidden': 'true' }, inner);
  };
})();
