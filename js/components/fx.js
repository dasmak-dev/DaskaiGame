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

    /**
     * Cortinilla de juego a pantalla completa, en tres tiempos:
     *   1. dos franjas cierran la pantalla;
     *   2. con la pantalla tapada se llama a `mid()` (p. ej. cambiar de
     *      pantalla) y, si hay título, sale su cinta;
     *   3. las franjas se abren y aparece lo nuevo.
     * No bloquea la interfaz (pointer-events: none). Se acorta con
     * «Animaciones rápidas»; con «Reducir movimiento» sólo funde el título.
     * @param {Object} o  title, subtitle, icon, colors: [claro, oscuro], kind: 'zone'|'boss'|'elite'|'battle'
     * @param {Function} [mid]  se ejecuta con la pantalla tapada
     * @returns {Promise<void>} cuando termina
     */
    cover({ title = '', subtitle = '', icon = null, colors = ['#6d5dfc', '#1e1b4b'], kind = 'zone' } = {}, mid) {
      const { h } = DK.ui;
      document.querySelectorAll('.curtain').forEach((c) => c.remove());
      const reduced = DK.settings.reducedMotion();
      const fast = DK.settings.get('skipAnims');
      // [cerrar, mantener, abrir] en ms
      let [tc, th, to] = { battle: [200, 80, 300], elite: [240, 750, 320], boss: [280, 1150, 360], zone: [280, 1000, 360] }[kind] || [260, 800, 340];
      if (!title) th = Math.min(th, 120);
      if (fast) { tc = Math.round(tc * 0.7); th = Math.round(th * 0.5); to = Math.round(to * 0.8); }
      const el = h('div', { class: `curtain k-${kind}` + (reduced ? ' reduced' : '') + (title ? ' titled' : ''), 'aria-hidden': 'true',
        style: { '--c1': colors[0], '--c2': colors[1], '--tc': tc + 'ms', '--to': to + 'ms' } },
        h('div', { class: 'curtain-band top' }), h('div', { class: 'curtain-band bottom' }),
        title ? h('div', { class: 'curtain-card' },
          icon ? h('span', { class: 'curtain-icon' }, DK.icon(icon, 30)) : null,
          h('div', { class: 'curtain-text' }, subtitle ? h('small', null, subtitle) : null, h('b', null, title))) : null);
      document.body.append(el);
      const run = (fn) => { try { if (fn) fn(); } catch (e) { console.error(e); } };
      if (reduced) {
        run(mid);
        if (!title) { el.remove(); return Promise.resolve(); }
        el.classList.add('show');
        return new Promise((r) => setTimeout(() => { el.remove(); r(); }, th + 500));
      }
      if (kind !== 'battle') DK.audio.sfx(kind === 'boss' ? 'crit' : 'swap'); else DK.audio.sfx('select');
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('closed')));
        setTimeout(() => {
          run(mid);
          if (title) el.classList.add('show');
          setTimeout(() => {
            el.classList.add('opening'); el.classList.remove('show');
            setTimeout(() => { el.remove(); resolve(); }, to + 40);
          }, th);
        }, tc + 20);
      });
    },
    /** Cortinilla sin cambio de pantalla (título de zona sobre lo que ya se ve). */
    curtain(o = {}) { return DK.fx.cover(o); },

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
