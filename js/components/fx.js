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
      for (let i = 0; i < 9; i++) { // v5.4: estela más larga
        const p = particle(layer, a.x, a.y, st.colors[i % st.colors.length], st.shape, Math.max(4, 19 - i * 1.7));
        p.animate([
          { transform: 'translate(-50%,-50%)', opacity: 0.95 },
          { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px))`, opacity: 0.9 },
        ], { duration: dur, delay: (i * 35) / speed(), easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'backwards' }).onfinish = () => p.remove();
      }
      setTimeout(resolve, dur + 60);
    });
  }

  /** v5.4: rayo de luz recto del atacante al objetivo. */
  function beam(layer, from, to) {
    return new Promise((resolve) => {
      if (!enabled() || !layer || !from || !to) return resolve();
      const a = center(layer, from), b = center(layer, to), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const el = document.createElement('span'); el.className = 'fx-beam';
      el.style.cssText = `left:${a.x}px;top:${a.y}px;width:${len}px;transform:rotate(${Math.atan2(dy, dx)}rad)`;
      layer.append(el);
      el.animate([{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1', offset: 0.35 }, { opacity: 0, scale: '1 0.2' }], { duration: 420 / speed(), easing: 'ease-out' }).onfinish = () => el.remove();
      setTimeout(resolve, 200 / speed());
    });
  }
  /**
   * v5.4: impacto según la casa: fuego → llamarada, agua → onda, tierra → polvo y temblor,
   * luz → destello de pantalla, oscuridad → sombra que envuelve.
   */
  function impact(layer, target, house, crit) {
    if (!enabled() || !layer || !target) return;
    const c = center(layer, target), arena = layer.closest('.arena');
    const ring = (cls, ms) => { const r = document.createElement('span'); r.className = 'fx-impact ' + cls; r.style.cssText = `left:${c.x}px;top:${c.y}px`; layer.append(r); setTimeout(() => r.remove(), ms / speed()); };
    if (house === 'fuego') ring('i-fire', 600);
    else if (house === 'agua') ring('i-wave', 700);
    else if (house === 'tierra') { ring('i-dust', 700); if (arena) { arena.classList.remove('quake'); void arena.offsetWidth; arena.classList.add('quake'); setTimeout(() => arena.classList.remove('quake'), 380); } }
    else if (house === 'luz') { if (arena) { arena.classList.remove('lightflash'); void arena.offsetWidth; arena.classList.add('lightflash'); setTimeout(() => arena.classList.remove('lightflash'), 360); } ring('i-light', 500); }
    else if (house === 'oscuridad') ring('i-dark', 750);
    else ring('i-neutral', 450);
    if (crit) ring('i-crit', 550);
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
      if (kind === 'magico') {
        // v5.4: luz → rayo directo; el resto, proyectil con estela
        if (house === 'luz') await beam(layer, from, to); else await projectile(layer, from, to, house || 'neutral');
        burst(layer, to, house || 'neutral', crit ? 26 : 18);
      } else { slash(layer, to, crit); if (house) burst(layer, to, house, 10); }
      impact(layer, to, house || 'neutral', crit);
    },
    /** v5.4: rastro de cada estado al aplicarse (copos, chispas, «z», destello…). */
    statusBurst(layer, target, status) {
      if (!enabled() || !layer || !target) return;
      const S = (DK.data.statuses || {})[status], c = center(layer, target);
      const map = { congelacion: ['❄', '#bae6fd'], paralisis: ['ϟ', '#fde047'], sueno: ['z', '#c4b5fd'], ceguera: ['✦', '#f8fafc'], veneno: ['•', '#c084fc'], quemadura: ['•', '#fb923c'] };
      const [ch, col] = map[status] || ['•', (S && S.color) || '#fff'];
      for (let i = 0; i < 9; i++) {
        const p = document.createElement('span'); p.className = 'fx-glyph'; p.textContent = ch;
        p.style.cssText = `left:${c.x + (Math.random() - 0.5) * 70}px;top:${c.y + (Math.random() - 0.5) * 40}px;color:${col};font-size:${12 + Math.random() * 12}px`;
        layer.append(p);
        p.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.3 }, { transform: `translate(${-50 + (Math.random() - 0.5) * 60}%, -260%) scale(.8)`, opacity: 0 }],
          { duration: (900 + Math.random() * 400) / speed(), delay: (i * 40) / speed(), easing: 'ease-out', fill: 'backwards' }).onfinish = () => p.remove();
      }
    },
    /** v5.4: el jefe se deshace en partículas que suben. */
    disintegrate(layer, target, house) {
      if (!enabled() || !layer || !target) return;
      const st = STYLES[house] || STYLES.neutral, r = target.getBoundingClientRect(), a = layer.getBoundingClientRect();
      for (let i = 0; i < 46; i++) {
        const x = r.left - a.left + r.width * (0.2 + Math.random() * 0.6), y = r.top - a.top + r.height * (0.25 + Math.random() * 0.6);
        const p = particle(layer, x, y, i % 3 ? st.colors[i % st.colors.length] : '#fff', 'square', 3 + Math.random() * 6);
        p.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 80}px), calc(-50% - ${60 + Math.random() * 120}px)) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
          { duration: 1300 + Math.random() * 900, delay: Math.random() * 600, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'backwards' }).onfinish = () => p.remove();
      }
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
