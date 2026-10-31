/* =============================================================
 * systems/audio.js — Efectos de sonido y música sintetizados.
 *
 * No usa archivos de audio: todo se genera con Web Audio API, así
 * el juego sigue funcionando sin conexión y sin descargas.
 *
 *   DK.audio.sfx('hit')        → efecto (ver lista en SFX)
 *   DK.audio.music('menu')     → pista ('menu', 'boss' o el `scene` de una zona)
 *   DK.audio.music(null)       → silencio
 *
 * Para añadir un efecto: añade una función a SFX que use tone()/noise().
 * Para añadir una pista: añade una entrada a TRACKS.
 * Los navegadores sólo permiten sonar tras la primera interacción;
 * por eso el contexto se crea con el primer clic o tecla.
 * ============================================================= */
(function () {
  let ctx = null, master, musicGain, sfxGain;
  let wantedTrack = null, seq = null;

  /** Crea el contexto de audio (tras la primera interacción del usuario). */
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    updateVolumes();
    if (wantedTrack) startTrack(wantedTrack);
    return ctx;
  }
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }, { capture: true }));

  /** Aplica los volúmenes de los ajustes. */
  function updateVolumes() {
    if (!ctx) return;
    const S = DK.settings;
    const m = S.get('muted') ? 0 : 1;
    musicGain.gain.setTargetAtTime(S.get('musicVol') * m * 0.6, ctx.currentTime, 0.05);
    sfxGain.gain.setTargetAtTime(S.get('sfxVol') * m, ctx.currentTime, 0.02);
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /**
   * Programa una nota.
   * @param {number} freq   frecuencia (Hz)
   * @param {number} dur    duración (s)
   * @param {Object} o      {type, vol, slide (Hz final), delay (s), out (nodo), attack}
   */
  function tone(freq, dur, { type = 'sine', vol = 0.2, slide, delay = 0, out = sfxGain, attack = 0.005 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** Programa un ruido filtrado (golpes, viento...). */
  function noise(dur, { vol = 0.3, freq = 1200, delay = 0, out = sfxGain, q = 1 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t);
  }

  /** Arpegio rápido de notas MIDI. */
  const arp = (notes, step, o) => notes.forEach((n, i) => tone(midi(n), o.dur || 0.18, Object.assign({}, o, { delay: (o.delay || 0) + i * step })));

  /** Catálogo de efectos. */
  const SFX = {
    click: () => tone(midi(88), 0.04, { type: 'triangle', vol: 0.06 }),
    select: () => { tone(midi(76), 0.05, { type: 'triangle', vol: 0.08 }); tone(midi(83), 0.07, { type: 'triangle', vol: 0.08, delay: 0.04 }); },
    hit: () => { noise(0.14, { vol: 0.45, freq: 900 }); tone(150, 0.14, { type: 'square', vol: 0.12, slide: 60 }); },
    crit: () => { noise(0.2, { vol: 0.55, freq: 1600 }); tone(900, 0.2, { type: 'sawtooth', vol: 0.12, slide: 200 }); },
    miss: () => noise(0.18, { vol: 0.2, freq: 3000, q: 0.6 }),
    heal: () => arp([72, 76, 79, 84], 0.06, { type: 'sine', vol: 0.12, dur: 0.25 }),
    mana: () => arp([79, 86, 91], 0.05, { type: 'sine', vol: 0.1, dur: 0.22 }),
    buff: () => tone(400, 0.25, { type: 'triangle', vol: 0.12, slide: 900 }),
    debuff: () => tone(800, 0.25, { type: 'triangle', vol: 0.12, slide: 300 }),
    status: () => { tone(300, 0.3, { type: 'sawtooth', vol: 0.07, slide: 250 }); tone(310, 0.3, { type: 'sawtooth', vol: 0.07, slide: 240 }); },
    faint: () => tone(440, 0.6, { type: 'sawtooth', vol: 0.12, slide: 70 }),
    capture: () => { tone(300, 0.5, { type: 'sine', vol: 0.15, slide: 1200 }); noise(0.4, { vol: 0.15, freq: 4000, delay: 0.1 }); },
    captured: () => arp([72, 79, 84, 91], 0.08, { type: 'triangle', vol: 0.14, dur: 0.3 }),
    captureFail: () => tone(700, 0.35, { type: 'square', vol: 0.08, slide: 180 }),
    levelup: () => arp([72, 76, 79, 84, 88], 0.07, { type: 'triangle', vol: 0.14, dur: 0.3 }),
    win: () => { arp([67, 72, 76, 79], 0.1, { type: 'square', vol: 0.08, dur: 0.2 }); arp([84, 88, 91], 0, { type: 'triangle', vol: 0.1, dur: 0.8, delay: 0.42 }); },
    lose: () => arp([67, 64, 60, 55], 0.22, { type: 'triangle', vol: 0.12, dur: 0.35 }),
    flee: () => noise(0.35, { vol: 0.25, freq: 600, q: 0.5 }),
    coin: () => { tone(midi(88), 0.07, { type: 'square', vol: 0.06 }); tone(midi(95), 0.18, { type: 'square', vol: 0.06, delay: 0.06 }); },
    craft: () => { noise(0.1, { vol: 0.3, freq: 2500 }); arp([67, 74, 79], 0.08, { type: 'triangle', vol: 0.12, dur: 0.22, delay: 0.08 }); },
    error: () => tone(160, 0.18, { type: 'square', vol: 0.08 }),
    evolve: () => { tone(200, 1.6, { type: 'sine', vol: 0.15, slide: 1600, attack: 0.3 }); arp([84, 88, 91, 96], 0.12, { type: 'triangle', vol: 0.1, dur: 0.4, delay: 1.5 }); },
    shiny: () => arp([96, 100, 103, 108], 0.05, { type: 'sine', vol: 0.08, dur: 0.3 }),
    achievement: () => arp([72, 79, 84, 88, 91], 0.06, { type: 'square', vol: 0.06, dur: 0.25 }),
    swap: () => { tone(500, 0.1, { type: 'triangle', vol: 0.1, slide: 800 }); tone(800, 0.12, { type: 'triangle', vol: 0.08, slide: 500, delay: 0.1 }); },
  };

  /* ---------------- Música ----------------
   * Cada pista: tempo, tónica (MIDI), progresión [semitonos, 'M'|'m'],
   * forma de onda del arpegio y si lleva percusión.
   */
  const MAJ = [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']];
  const MIN = [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']];
  const TRACKS = {
    menu: { bpm: 80, root: 60, prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], wave: 'triangle', drums: false },
    meadow: { bpm: 104, root: 65, prog: MAJ, wave: 'square', drums: true },
    forest: { bpm: 94, root: 62, prog: [[0, 'm'], [5, 'M'], [10, 'M'], [7, 'm']], wave: 'triangle', drums: true },
    beach: { bpm: 110, root: 67, prog: MAJ, wave: 'triangle', drums: true },
    cave: { bpm: 90, root: 57, prog: MIN, wave: 'sine', drums: true },
    volcano: { bpm: 126, root: 64, prog: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']], wave: 'sawtooth', drums: true },
    temple: { bpm: 98, root: 70, prog: [[0, 'M'], [2, 'M'], [7, 'M'], [5, 'M']], wave: 'triangle', drums: true },
    abyss: { bpm: 78, root: 48, prog: MIN, wave: 'sine', drums: false },
    sky: { bpm: 116, root: 64, prog: MAJ, wave: 'triangle', drums: true },
    boss: { bpm: 144, root: 62, prog: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']], wave: 'sawtooth', drums: true },
  };

  function startTrack(name) {
    stopTrack();
    const tr = TRACKS[name];
    if (!tr || !ctx) return;
    const eighth = 60 / tr.bpm / 2;
    seq = { tr, step: 0, next: ctx.currentTime + 0.1, eighth };
    seq.timer = setInterval(() => {
      if (!ctx || !seq) return;
      while (seq.next < ctx.currentTime + 0.3) { playStep(seq.step, seq.next - ctx.currentTime); seq.next += seq.eighth; seq.step++; }
    }, 90);
  }
  function stopTrack() { if (seq) { clearInterval(seq.timer); seq = null; } }

  /** Toca un paso (corchea) de la pista activa. */
  function playStep(step, delay) {
    const { tr, eighth } = seq;
    const bar = Math.floor(step / 8) % tr.prog.length, beat = step % 8;
    const [r, q] = tr.prog[bar];
    const chord = [0, q === 'M' ? 4 : 3, 7, 12];
    const root = tr.root + r;
    const o = { out: musicGain, delay: Math.max(0, delay) };
    if (beat === 0) chord.slice(0, 3).forEach((n) => tone(midi(root + n - 12), eighth * 8, { ...o, type: 'sine', vol: 0.035, attack: 0.2 }));
    if (beat % 4 === 0) tone(midi(root - 24), eighth * 3.5, { ...o, type: 'triangle', vol: 0.16 });
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    if (!(tr.bpm < 85 && beat % 2)) tone(midi(root + chord[pattern[beat]]), eighth * 0.9, { ...o, type: tr.wave, vol: tr.wave === 'sawtooth' || tr.wave === 'square' ? 0.025 : 0.05 });
    if (tr.drums) {
      if (beat % 4 === 0) tone(110, 0.12, { ...o, type: 'sine', vol: 0.18, slide: 40 });
      if (beat % 2 === 1) noise(0.04, { ...o, vol: 0.05, freq: 7000 });
      if (beat === 4) noise(0.12, { ...o, vol: 0.09, freq: 1800 });
    }
  }

  DK.audio = {
    /** Reproduce un efecto por nombre. */
    sfx(name) {
      if (!ctx || DK.settings.get('muted') || DK.settings.get('sfxVol') <= 0) return;
      try { (SFX[name] || SFX.click)(); } catch (e) { /* audio no disponible */ }
    },
    /** Cambia la música ('menu', 'boss', escena de zona o null). */
    music(name) {
      if (name === wantedTrack && seq) return;
      wantedTrack = name;
      if (!ctx) return;
      if (!name) stopTrack(); else startTrack(name);
    },
    updateVolumes,
    /** Lista de efectos disponibles (para la guía y pruebas). */
    list: () => Object.keys(SFX),
    registerSfx(name, fn) { SFX[name] = fn; },
    registerTrack(name, def) { TRACKS[name] = def; },
    helpers: { tone, noise, midi },
  };

  DK.on('settings:changed', ({ key }) => { if (!key || /Vol|muted/.test(key)) updateVolumes(); });

  /** Vibración en móviles (si está activada). */
  DK.vibrate = (pattern) => { if (DK.settings.get('vibration') && navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) { /* */ } };
})();
