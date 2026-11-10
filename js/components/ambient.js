/* =============================================================
 * components/ambient.js — v5.7: vida en los fondos (mapa de la expedición y combate).
 *
 *   DK.ambient.map(scene, alto)   → capa para el mapa (sombras de nubes, partículas por la zona)
 *   DK.ambient.battle(scene)      → capa extra para el fondo del combate (rayos de luz, aurora, calor…)
 * Sólo CSS, pocas partículas; nada con «Reducir movimiento» / «Saltar animaciones».
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  // qué hay en cada zona: [tipo de partícula, cuántas por cada 1000 px de mapa], y efectos de luz
  const KIND = {
    meadow: { p: [['firefly', 9], ['pollen', 8], ['butterfly', 3]], clouds: true, fx: ['sunbeam'] },
    forest: { p: [['leaf', 10], ['firefly', 7]], clouds: true, fx: ['rays'] },
    beach: { p: [['sparkle', 10], ['bubble', 6], ['gull', 2]], clouds: true, fx: ['shimmer'] },
    cave: { p: [['dust', 12], ['drip', 5], ['glint', 6]], fx: ['glowpulse'] },
    volcano: { p: [['ember', 16], ['ash', 8]], fx: ['heat', 'lava'] },
    temple: { p: [['mote', 14], ['sparkle', 5]], fx: ['rays'] },
    swamp: { p: [['wisp', 7], ['bubble', 7], ['firefly', 5]], fx: ['fog'] },
    abyss: { p: [['voidspark', 12], ['wisp', 5]], fx: ['stars', 'pulse'] },
    glacier: { p: [['snow', 18], ['sparkle', 6]], clouds: true, fx: ['aurora'] },
    sky: { p: [['streak', 8], ['sparkle', 8]], clouds: true, fx: ['sunbeam'] },
  };
  const off = () => DK.settings && (DK.settings.reducedMotion() || DK.settings.get('skipAnims'));
  const rnd = (a, b) => a + Math.random() * (b - a);
  function parts(kinds, per) {
    const out = [];
    kinds.forEach(([k, n]) => {
      const count = Math.max(2, Math.round(n * per));
      for (let i = 0; i < count; i++) out.push(h('i', { class: 'am am-' + k, style: { left: rnd(0, 100).toFixed(1) + '%', top: rnd(2, 98).toFixed(1) + '%', animationDelay: (-rnd(0, 14)).toFixed(2) + 's', animationDuration: rnd(0.75, 1.35).toFixed(2) * ({ ember: 5, snow: 9, leaf: 11, drip: 3.5, ash: 10, streak: 3, gull: 26, butterfly: 14 }[k] || 8) + 's', '--s': rnd(0.6, 1.3).toFixed(2), '--x': rnd(-40, 40).toFixed(0) + 'px' } }));
    });
    return out;
  }
  const base = (scene) => KIND[scene] || KIND.meadow;
  const sceneOf = (id) => String(id || '').replace(/^boss_/, '').replace('secret', 'abyss');

  /* ---------- v5.9: paisaje de los lados de la pantalla de la expedición (por zona) ----------
   * Tiras verticales (viewBox 0 0 320 1000) a izquierda y derecha (la derecha en espejo), con piezas que se
   * mecen (.ps-sway) o flotan (.ps-bob). Colores con variables CSS (--sil oscuro, --sil2 medio, --glow).
   */
  const sw = (inner, i, cls = 'ps-sway') => `<g class="${cls}" style="--o:${-(i * 1.37) % 6}s;--d:${5 + (i % 4)}s">${inner}</g>`;
  const pine = (x, y, hh, i, f = 'var(--sil)') => sw(`<path d="M${x} ${y - hh} L${x + hh * .3} ${y - hh * .55} L${x + hh * .16} ${y - hh * .55} L${x + hh * .4} ${y - hh * .2} L${x + hh * .2} ${y - hh * .2} L${x + hh * .46} ${y} L${x - hh * .46} ${y} L${x - hh * .2} ${y - hh * .2} L${x - hh * .4} ${y - hh * .2} L${x - hh * .16} ${y - hh * .55} L${x - hh * .3} ${y - hh * .55} Z" style="fill:${f}"/>`, i);
  const oak = (x, y, hh, i, f = 'var(--sil)') => sw(`<rect x="${x - hh * .05}" y="${y - hh * .55}" width="${hh * .1}" height="${hh * .55}" style="fill:${f}"/><circle cx="${x}" cy="${y - hh * .7}" r="${hh * .3}" style="fill:${f}"/><circle cx="${x - hh * .22}" cy="${y - hh * .58}" r="${hh * .2}" style="fill:${f}"/><circle cx="${x + hh * .22}" cy="${y - hh * .6}" r="${hh * .22}" style="fill:${f}"/>`, i);
  const palm = (x, y, hh, i) => sw(`<path d="M${x} ${y} Q${x + hh * .12} ${y - hh * .5} ${x + hh * .02} ${y - hh}" stroke="var(--sil)" stroke-width="${hh * .06}" fill="none"/>` + [-150, -110, -60, -20, 20].map((a) => `<path d="M${x + hh * .02} ${y - hh} q${Math.cos(a * Math.PI / 180) * hh * .3} ${Math.sin(a * Math.PI / 180) * hh * .3 - 10} ${Math.cos(a * Math.PI / 180) * hh * .5} ${Math.sin(a * Math.PI / 180) * hh * .5 + hh * .12}" stroke="var(--sil)" stroke-width="${hh * .05}" fill="none" stroke-linecap="round"/>`).join(''), i);
  const dead = (x, y, hh, i) => sw(`<path d="M${x - 6} ${y} L${x - 3} ${y - hh} L${x + 3} ${y - hh} L${x + 6} ${y} Z" style="fill:var(--sil)"/><path d="M${x} ${y - hh * .5} q${hh * .2} -10 ${hh * .3} ${-hh * .2} M${x} ${y - hh * .7} q${-hh * .2} -10 ${-hh * .28} ${-hh * .18} M${x} ${y - hh * .88} q${hh * .12} -6 ${hh * .18} ${-hh * .12}" stroke="var(--sil)" stroke-width="5" fill="none" stroke-linecap="round"/>`, i);
  const reeds = (x, y, n, i) => sw(Array.from({ length: n }, (_, k) => `<path d="M${x + k * 9} ${y} q${(k % 3) * 4 - 4} -40 ${(k % 2 ? 8 : -6)} ${-(60 + (k * 13) % 50)}" stroke="var(--sil)" stroke-width="3" fill="none" stroke-linecap="round"/>`).join(''), i);
  const stal = (x, hh, i) => `<path d="M${x - 14} 0 L${x} ${hh} L${x + 14} 0 Z" style="fill:var(--sil)"/>` + (i % 2 ? `<circle class="ps-glow" style="--o:${-i}s" cx="${x}" cy="${hh + 10}" r="3" fill="var(--glow)"/>` : '');
  const crystal = (x, y, hh, i) => `<g class="ps-glow" style="--o:${-i * .8}s"><path d="M${x - 14} ${y} L${x - 6} ${y - hh * .8} L${x} ${y - hh} L${x + 7} ${y - hh * .75} L${x + 14} ${y} Z" style="fill:var(--glow)" opacity=".5"/></g><path d="M${x - 14} ${y} L${x - 6} ${y - hh * .8} L${x} ${y - hh} L${x + 7} ${y - hh * .75} L${x + 14} ${y} Z" style="fill:var(--sil)" opacity=".7"/>`;
  const column = (x, y, hh, i) => `<rect x="${x - 18}" y="${y - hh}" width="36" height="${hh}" style="fill:var(--sil)"/><rect x="${x - 26}" y="${y - hh - 12}" width="52" height="14" style="fill:var(--sil)"/>` + (i % 2 ? '' : `<path d="M${x - 18} ${y - hh * .45} l36 -18 v14 l-36 18 Z" style="fill:var(--sil2)"/>`);
  const tentacle = (x, y, hh, i) => sw(`<path d="M${x - 14} ${y} C${x - 20} ${y - hh * .4} ${x + 50} ${y - hh * .6} ${x + 16} ${y - hh} C${x + 60} ${y - hh * .55} ${x + 22} ${y - hh * .35} ${x + 16} ${y} Z" style="fill:var(--sil)"/>`, i);
  const island = (x, y, k, i) => sw(`<path d="M${x - 60 * k} ${y} Q${x} ${y - 14 * k} ${x + 60 * k} ${y} L${x + 30 * k} ${y + 24 * k} L${x} ${y + 52 * k} L${x - 26 * k} ${y + 26 * k} Z" style="fill:var(--sil)"/><path d="M${x - 60 * k} ${y} Q${x} ${y - 14 * k} ${x + 60 * k} ${y}" stroke="var(--glow)" stroke-width="${5 * k}" fill="none" opacity=".6"/>`, i, 'ps-bob');
  const rock = (x, y, w, i, lava) => `<path d="M${x - w} ${y} L${x - w * .6} ${y - w * .9} L${x + w * .1} ${y - w * 1.1} L${x + w * .8} ${y - w * .5} L${x + w} ${y} Z" style="fill:var(--sil)"/>` + (lava ? `<path class="ps-glow" style="--o:${-i}s" d="M${x - w * .2} ${y - w * .95} L${x} ${y - w * .3} L${x + w * .25} ${y}" stroke="var(--glow)" stroke-width="4" fill="none"/>` : '');
  const SIDES = {
    meadow: () => oak(90, 1000, 360, 0) + oak(220, 1000, 240, 1, 'var(--sil2)') + reeds(20, 1000, 14, 2) + reeds(170, 1000, 10, 3),
    forest: () => pine(70, 1000, 520, 0) + pine(200, 1000, 380, 1, 'var(--sil2)') + pine(280, 1000, 260, 2) + oak(140, 1000, 220, 3, 'var(--sil2)'),
    beach: () => palm(110, 1000, 420, 0) + palm(240, 1000, 300, 1) + reeds(20, 1000, 8, 2),
    cave: () => [30, 95, 160, 230, 290].map((x, i) => stal(x, 90 + (i * 47) % 140, i)).join('') + crystal(80, 1000, 220, 0) + crystal(200, 1000, 150, 1),
    volcano: () => rock(110, 1000, 150, 0, true) + rock(250, 1000, 90, 1, true),
    temple: () => column(90, 1000, 520, 0) + column(230, 1000, 380, 1),
    swamp: () => dead(80, 1000, 420, 0) + dead(220, 1000, 300, 1) + reeds(10, 1000, 16, 2) + reeds(170, 1000, 12, 3),
    abyss: () => tentacle(80, 1000, 520, 0) + tentacle(220, 1000, 360, 1) + island(160, 260, .9, 2),
    glacier: () => crystal(90, 1000, 420, 0) + crystal(200, 1000, 300, 1) + crystal(270, 1000, 200, 2) + pine(150, 1000, 240, 3, 'var(--sil2)'),
    sky: () => island(140, 380, 1.3, 0) + island(220, 700, .9, 1) + island(80, 160, .7, 2),
  };
  DK.ambient = {
    /** v5.9: paisaje animado a los lados de la pantalla de la expedición + partículas por toda la pantalla. */
    page(scene) {
      const sc = sceneOf(scene), f = SIDES[sc] || SIDES.meadow;
      const strip = (side) => { const el = h('div', { class: 'ps-side ' + side }); el.innerHTML = `<svg viewBox="0 0 320 1000" preserveAspectRatio="xMidYMax meet" width="100%" height="100%">${f()}</svg>`; return el; };
      const el = h('div', { class: 'amb-page amb-' + sc, 'aria-hidden': 'true' }, strip('left'), strip('right'), off() ? null : h('div', { class: 'amb amb-pagefx' }, ...parts(base(sc).p, 1.2)));
      return DK.pixelBg ? DK.pixelBg.swap(el) : el; // v5.20: laterales en pixel art
    },
    map(scene, height = 800) {
      if (off()) return null;
      const K = base(sceneOf(scene)), per = Math.max(0.6, height / 1000);
      return h('div', { class: 'amb amb-map amb-' + sceneOf(scene), 'aria-hidden': 'true' },
        K.clouds ? Array.from({ length: Math.round(3 * per) + 1 }, (_, i) => h('span', { class: 'amb-cloud', style: { top: ((i + 0.5) / (Math.round(3 * per) + 1)) * 100 + '%', animationDelay: -rnd(0, 60) + 's', animationDuration: rnd(55, 85) + 's', '--s': rnd(0.8, 1.5).toFixed(2) } })) : null,
        ...parts(K.p, per));
    },
    battle(scene) {
      if (off()) return null;
      const K = base(sceneOf(scene));
      return h('div', { class: 'amb amb-battle amb-' + sceneOf(scene), 'aria-hidden': 'true' },
        ...K.fx.map((f) => h('span', { class: 'amb-fx fx-' + f }, f === 'rays' || f === 'sunbeam' ? [h('b'), h('b'), h('b')] : null)),
        ...parts(K.p.slice(0, 2), 0.9));
    },
  };
})();
