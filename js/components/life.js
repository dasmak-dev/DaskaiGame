/* =============================================================
 * components/life.js — Daskai «vivos» (v5.4), muy ligero.
 *
 *   V.sprite(..., { cls: 'alive' })  → respira (css/juice.css) y parpadea de vez en cuando.
 *   DK.life.react(el, 'hop'|'happy')  → saltito al pulsarlo, alegría al subir de nivel.
 *
 * El parpadeo cambia un momento el dibujo por el mismo con los ojos cerrados
 * (DK.looks.svg/pixel con { blink: true }). Sólo parpadean los ojos que están
 * abiertos de base (DK.looks.canBlink): los dormidos, felices, guiños, gafas…
 * se quedan como están. Un único temporizador para todos; nada si la pestaña
 * está oculta o con «Reducir movimiento» / «Saltar animaciones».
 * ============================================================= */
(function () {
  const quiet = () => document.hidden || (DK.settings && (DK.settings.reducedMotion() || DK.settings.get('skipAnims')));
  const inView = (el) => { if (!el.isConnected || !el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };

  function blink(el) {
    const a = el._life; if (!a || el._blinking) return;
    const done = () => { el._blinking = false; };
    if (a.pixel) {
      const img = el.querySelector('img.sprite-px'); if (!img) return;
      const url = DK.looks.pixelCached(a.sid, a.look, { shiny: a.shiny, blink: true });
      if (!url) { DK.looks.pixel(a.sid, a.look, { shiny: a.shiny, blink: true }); return; } // se prepara para la próxima vez
      const orig = img.src; el._blinking = true; img.src = url;
      setTimeout(() => { if (img.isConnected) img.src = orig; done(); }, 130);
    } else {
      const svg = el.querySelector('svg'); if (!svg) return;
      const orig = el.innerHTML; el._blinking = true;
      el.innerHTML = DK.looks.svg(a.sid, a.look, { flip: a.flip, shiny: a.shiny, blink: true });
      setTimeout(() => { if (el.isConnected) el.innerHTML = orig; done(); }, 130);
    }
  }

  setInterval(() => {
    if (quiet()) return;
    const list = document.querySelectorAll('.sprite.alive[data-blink]');
    for (let i = 0, n = 0; i < list.length && n < 40; i++) {
      const el = list[i];
      if (Math.random() > 0.09 || !inView(el)) continue;
      n++;
      blink(el);
      if (Math.random() < 0.18) setTimeout(() => blink(el), 260); // a veces, doble parpadeo
    }
  }, 700);

  /*
   * v5.5: en la hoguera (y sólo ahí) los daskai hacen cosas de vez en cuando: miran a los lados, se
   * estiran, dan un saltito, bailan, se acercan al fuego a calentarse, se giran… Los que duermen, a
   * veces se acurrucan. Uno cada ~2 s, nunca el mismo dos veces seguidas.
   */
  const CAMP_ACTS = ['look', 'stretch', 'hop', 'dance', 'warm', 'turn', 'nod', 'bounce'];
  let lastActor = null;
  setInterval(() => {
    if (quiet()) return;
    const list = [...document.querySelectorAll('.camp-mon .sprite.alive')].filter((el) => !el._acting && inView(el));
    if (!list.length) return;
    const pool = list.length > 1 ? list.filter((el) => el !== lastActor) : list;
    const el = pool[Math.floor(Math.random() * pool.length)]; lastActor = el;
    const cpool = el.querySelector('.dk-arm') ? CAMP_ACTS.concat(['wave', 'cheer']) : CAMP_ACTS;
    const act = el.classList.contains('asleep') ? 'snuggle' : cpool[Math.floor(Math.random() * cpool.length)];
    el._acting = true; el.classList.add('ca-' + act);
    // a veces dos se saludan a la vez
    if (act === 'hop' && list.length > 2 && Math.random() < 0.35) { const o = list.find((x) => x !== el && !x.classList.contains('asleep')); if (o) { o._acting = true; o.classList.add('ca-hop'); setTimeout(() => { o.classList.remove('ca-hop'); o._acting = false; }, 900); } }
    setTimeout(() => { el.classList.remove('ca-' + act); el._acting = false; }, act === 'dance' || act === 'warm' ? 1700 : 1100);
  }, 2100);

  /*
   * v5.11: fuera de la hoguera (fichas, resumen, combate, equipo…) los daskai también hacen gestos cortos
   * de vez en cuando: mirar a un lado, ladear la cabeza, saltito, contonearse, estirarse.
   */
  const ACTS = ['look', 'tilt', 'hop', 'wiggle', 'stretch', 'peek'];
  const ARM_ACTS = ['wave', 'wave', 'cheer', 'flex'];
  setInterval(() => {
    if (quiet()) return;
    const list = [...document.querySelectorAll('.sprite.alive')].filter((el) => !el.closest('.camp-mon') && !el._acting && !el.classList.contains('asleep') && inView(el));
    const n = Math.min(2, Math.ceil(list.length / 6));
    for (let k = 0; k < n && list.length; k++) {
      const el = list.splice(Math.floor(Math.random() * list.length), 1)[0];
      if (el.closest('.arena') && (el.classList.contains('hit') || el.classList.contains('faint') || el.classList.contains('charge'))) continue;
      const pool = el.querySelector('.dk-arm') ? ACTS.concat(ARM_ACTS) : ACTS; // v5.15: con brazos, a veces saludan o los levantan
      const act = pool[Math.floor(Math.random() * pool.length)];
      el._acting = true; el.classList.add('ia-' + act);
      setTimeout(() => { el.classList.remove('ia-' + act); el._acting = false; }, 1200);
    }
  }, 2600);

  // v5.4: botones que se hunden al pulsarlos (y un toque de vibración en el móvil)
  const PRESS = '.btn:not(:disabled), .dock-slot, .save-tool, .camp-spot, .bt-mon';
  let pressed = null;
  const release = () => { if (pressed) { const el = pressed; pressed = null; setTimeout(() => el.classList.remove('is-pressed'), 60); } };
  // v5.10: con el dedo se espera un momento antes de hundirlo (al desplazar la pantalla por encima de la hoguera
  // los lugares parpadeaban); si el dedo se mueve o el navegador lo convierte en desplazamiento, no se hunde
  let pressT = null, sx = 0, sy = 0;
  const cancelPress = () => { clearTimeout(pressT); pressT = null; };
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest && ev.target.closest(PRESS); if (!el) return;
    release(); cancelPress();
    if (ev.pointerType === 'touch') {
      sx = ev.clientX; sy = ev.clientY;
      pressT = setTimeout(() => { pressT = null; pressed = el; el.classList.add('is-pressed'); if (DK.vibrate) DK.vibrate(8); }, 90);
    } else { pressed = el; el.classList.add('is-pressed'); }
  }, { passive: true });
  document.addEventListener('pointermove', (ev) => { if (pressT && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) cancelPress(); }, { passive: true });
  ['pointerup', 'pointercancel', 'dragstart'].forEach((n) => document.addEventListener(n, () => { cancelPress(); release(); }, { passive: true }));
  document.addEventListener('scroll', () => { cancelPress(); release(); }, { passive: true, capture: true });

  DK.life = {
    mark(el, a) {
      el.style.setProperty('--dk-d', (-Math.random() * 4).toFixed(2) + 's');
      if (DK.looks.canBlink(a.sid, a.look)) { el._life = a; el.dataset.blink = '1'; }
    },
    /**
     * v5.4: duerme (de noche en la hoguera): ojos cerrados todo el rato, respiración lenta y «Zzz».
     * Si sus ojos ya están cerrados de base, sólo cambia la respiración.
     */
    sleep(el) {
      if (!el) return;
      el.classList.add('asleep');
      const a = el._life; delete el.dataset.blink; if (!a) return;
      const set = (url) => { const img = el.querySelector('img.sprite-px'); if (img && url) img.src = url; };
      if (a.pixel) {
        const url = DK.looks.pixelCached(a.sid, a.look, { shiny: a.shiny, blink: true });
        // (dos intentos: el dibujo normal puede llegar un poco después y taparía los ojos cerrados)
        const go = (u) => { setTimeout(() => set(u), 30); setTimeout(() => set(u), 700); };
        if (url) go(url); else DK.looks.pixel(a.sid, a.look, { shiny: a.shiny, blink: true }).then(go);
      } else el.innerHTML = DK.looks.svg(a.sid, a.look, { flip: a.flip, shiny: a.shiny, blink: true });
    },
    /** Reacción corta del dibujo: 'hop' (saltito) o 'happy' (salto con brillo). */
    react(el, kind = 'hop') {
      if (!el || quiet()) return;
      const cls = 'dk-' + kind;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 700);
    },
  };
})();
