/* =============================================================
 * components/weather.js — v5.4: clima ligero (sólo CSS, pocas partículas).
 *
 *   DK.weather.forZone(zone, seed) → 'clear' | 'rain' | 'snow' | 'fog' | 'ash'
 *   DK.weather.forCamp(date)       → clima del campamento (cambia cada 3 h)
 *   DK.weather.layer(kind)         → capa absoluta para poner encima de una escena
 *
 * Glaciar: nieve · Pantano: niebla (y a veces lluvia) · Bosque/Pradera/Playa: a veces
 * lluvia · Volcán: ceniza. Cuevas, templos, abismo y cielo: despejado.
 * Con «Reducir movimiento» la capa no se pinta.
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const hash = (s) => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x / 4294967296; };
  const BY_SCENE = {
    glacier: () => 'snow',
    swamp: (r) => (r < 0.3 ? 'rain' : 'fog'),
    forest: (r) => (r < 0.35 ? 'rain' : r < 0.5 ? 'fog' : 'clear'),
    meadow: (r) => (r < 0.25 ? 'rain' : 'clear'),
    beach: (r) => (r < 0.3 ? 'rain' : 'clear'),
    volcano: () => 'ash',
  };
  const COUNT = { rain: 46, snow: 55, ash: 26, fog: 0, clear: 0 };

  DK.weather = {
    forZone(zone, seed = '') {
      if (!zone) return 'clear';
      const f = BY_SCENE[zone.scene];
      return f ? f(hash(zone.id + '|' + seed)) : 'clear';
    },
    forCamp(d = new Date()) {
      const r = hash('camp|' + d.toDateString() + '|' + Math.floor(d.getHours() / 3));
      return r < 0.2 ? 'rain' : r < 0.34 ? 'fog' : 'clear';
    },
    layer(kind) {
      if (!kind || kind === 'clear' || DK.settings.reducedMotion() || DK.settings.get('skipAnims')) return null;
      const n = Math.round((COUNT[kind] || 0) * (innerWidth < 700 ? 0.5 : 1)); // v5.10: la mitad en el móvil
      return h('div', { class: 'wx wx-' + kind, 'aria-hidden': 'true' },
        kind === 'fog' || kind === 'rain' ? h('span', { class: 'wx-fog' }, h('i'), h('i')) : null,
        Array.from({ length: n }, (_, i) => {
          const r1 = hash(kind + i), r2 = hash(i + kind), r3 = hash('d' + i);
          return h('i', { style: { left: (r1 * 104 - 2).toFixed(1) + '%', animationDelay: (-r2 * 6).toFixed(2) + 's', animationDuration: (kind === 'rain' ? 0.55 + r3 * 0.35 : kind === 'snow' ? 5 + r3 * 5 : 6 + r3 * 5).toFixed(2) + 's', '--s': (0.6 + r3 * 0.8).toFixed(2), '--w': ((r1 - 0.5) * 60).toFixed(0) + 'px' } });
        }));
    },
  };
})();
