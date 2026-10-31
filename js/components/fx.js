/* =============================================================
 * components/fx.js — Partículas y efectos de los ataques.
 *
 *   await DK.fx.attack(capa, spriteAtacante, spriteObjetivo, {house, kind, crit})
 *   DK.fx.burst(capa, spriteObjetivo, 'fuego')
 *   DK.fx.heal(capa, sprite)
 *
 * Cada casa tiene un estilo en STYLES (colores, forma y movimiento).
 * Para añadir uno nuevo: añade una entrada con {colors, shape, motion}.
 * Se desactiva con "Reducir movimiento" o "Saltar animaciones".
 * ============================================================= */
(function () {
  const STYLES = {
    fuego: { colors: ['#fde047', '#fb923c', '#ef4444'], shape: 'circle', motion: 'rise' },
    agua: { colors: ['#bae6fd', '#38bdf8', '#0284c7'], shape: 'bubble', motion: 'spread' },
    tierra: { colors: ['#a16207', '#78716c', '#65a30d'], shape: 'square', motion: 'fall' },
    luz: { colors: ['#fffbeb', '#fde047', '#facc15'], shape: 'star', motion: 'radial' },
    oscuridad: { colors: ['#c4b5fd', '#8b5cf6', '#4c1d95'], shape: 'circle', motion: 'implode' },
    neutral: { colors: ['#ffffff', '#e2e8f0', '#cbd5e1'], shape: 'circle', motion: 'radial' },
  };

  const enabled = () => !DK.settings.reducedMotion() && !DK.settings.get('skipAnims');
  const speed = () => DK.settings.get('battleSpeed') || 1;

  /** Centro de un elemento relativo a la capa. */
  function center(layer, el) {
    const a = layer.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height * 0.55 };
  }

  /** Crea una partícula. */
  function particle(layer, x, y, color, shape, size) {
    const p = document.createElement('span');
    p.className = 'fx-p fx-' + shape;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;--pc:${color}`;
    layer.append(p);
    return p;
  }

  /**
   * Explosión de partículas sobre un objetivo.
   * @param {HTMLElement} layer capa de efectos (position: absolute; inset: 0)
   * @param {HTMLElement} target sprite objetivo
   * @param {string} house casa (estilo)
   * @param {number} n número de partículas
   */
  function burst(layer, target, house = 'neutral', n = 16) {
    if (!enabled() || !layer || !target) return;
    const st = STYLES[house] || STYLES.neutral;
    const c = center(layer, target);
    const dur = 700 / speed();
    for (let i = 0; i < n; i++) {
      const size = 6 + Math.random() * 10;
      const p = particle(layer, c.x, c.y, st.colors[i % st.colors.length], st.shape, size);
      const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 60;
      let dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist, from = 'translate(-50%,-50%)';
      if (st.motion === 'rise') dy = -Math.abs(dy) - 30;
      if (st.motion === 'fall') { dy = Math.abs(dy) + 20; from = `translate(${dx * 0.2 - 50}%, -160%)`; }
      if (st.motion === 'implode') { from = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; dx = 0; dy = 0; }
      p.animate([
        { transform: from + ' scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${st.motion === 'implode' ? 0.2 : 0.4})`, opacity: 0 },
      ], { duration: dur * (0.7 + Math.random() * 0.5), easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => p.remove();
    }
  }

  /** Tajos para ataques físicos. */
  function slash(layer, target, crit) {
    if (!enabled() || !layer || !target) return;
    const c = center(layer, target);
    const n = crit ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'fx-slash' + (crit ? ' crit' : '');
      s.style.cssText = `left:${c.x}px;top:${c.y}px;--rot:${-35 + i * 35}deg`;
      layer.append(s);
      s.animate([
        { transform: `translate(-50%,-50%) rotate(var(--rot)) scaleX(0)`, opacity: 1 },
        { transform: `translate(-50%,-50%) rotate(var(--rot)) scaleX(1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(-50%,-50%) rotate(var(--rot)) scaleX(1.1)`, opacity: 0 },
      ], { duration: 380 / speed(), delay: (i * 70) / speed(), easing: 'ease-out', fill: 'backwards' }).onfinish = () => s.remove();
    }
  }

  /** Proyectil desde el atacante hasta el objetivo. Devuelve promesa. */
  function projectile(layer, from, to, house) {
    return new Promise((resolve) => {
      if (!enabled() || !layer || !from || !to) return resolve();
      const st = STYLES[house] || STYLES.neutral;
      const a = center(layer, from), b = center(layer, to);
      const dur = 380 / speed();
      for (let i = 0; i < 5; i++) {
        const p = particle(layer, a.x, a.y, st.colors[i % st.colors.length], st.shape, 18 - i * 2.5);
        p.animate([
          { transform: 'translate(-50%,-50%)', opacity: 0.95 },
          { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px))`, opacity: 0.9 },
        ], { duration: dur, delay: (i * 35) / speed(), easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'backwards' }).onfinish = () => p.remove();
      }
      setTimeout(resolve, dur + 60);
    });
  }

  DK.fx = {
    styles: STYLES,
    burst,
    slash,
    projectile,

    /**
     * Efecto completo de un ataque.
     * @param {Object} o {house, kind ('fisico'|'magico'), crit}
     */
    async attack(layer, from, to, { house, kind, crit } = {}) {
      if (!enabled()) return;
      if (kind === 'magico') { await projectile(layer, from, to, house || 'neutral'); burst(layer, to, house || 'neutral', crit ? 26 : 18); }
      else { slash(layer, to, crit); if (house) burst(layer, to, house, 10); }
    },

    /** Brillo verde ascendente (curación). */
    heal(layer, target, color = '#4ade80') {
      if (!enabled() || !layer || !target) return;
      const c = center(layer, target);
      for (let i = 0; i < 10; i++) {
        const p = particle(layer, c.x + (Math.random() - 0.5) * 70, c.y + 20, color, 'plus', 10 + Math.random() * 6);
        p.animate([{ transform: 'translate(-50%,-50%)', opacity: 0 }, { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -400%)', opacity: 0 }],
          { duration: 900 / speed(), delay: (i * 50) / speed(), fill: 'backwards' }).onfinish = () => p.remove();
      }
    },

    /** Confeti (victoria, subida de nivel). */
    confetti(layer, n = 40) {
      if (!enabled() || !layer) return;
      const w = layer.clientWidth;
      const colors = ['#fde047', '#f97316', '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899'];
      for (let i = 0; i < n; i++) {
        const p = particle(layer, Math.random() * w, -10, colors[i % colors.length], 'square', 6 + Math.random() * 6);
        p.animate([{ transform: 'translate(-50%,0) rotate(0)' }, { transform: `translate(${(Math.random() - 0.5) * 120}px, ${layer.clientHeight + 30}px) rotate(${Math.random() * 720}deg)` }],
          { duration: 1600 + Math.random() * 900, delay: Math.random() * 300, easing: 'cubic-bezier(.3,.5,.6,1)' }).onfinish = () => p.remove();
      }
    },
  };
})();
