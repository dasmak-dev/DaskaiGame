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
    if (wantedTrack && !hidden()) startTrack(wantedTrack);
    return ctx;
  }
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { ensure(); if (ctx && ctx.state === 'suspended' && !hidden()) ctx.resume(); }, { capture: true }));

  /*
   * El sonido sólo suena con el juego a la vista: al minimizarlo, cambiar
   * de app o bloquear el móvil se pausa el contexto (y el secuenciador de
   * la música) y al volver sigue la misma pista.
   */
  function pause() { stopTrack(); if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
  function wake() {
    if (!ctx || hidden()) return;
    const go = () => { if (wantedTrack && !seq) startTrack(wantedTrack); };
    if (ctx.state === 'suspended') ctx.resume().then(go, () => {}); else go();
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => (hidden() ? pause() : wake()));
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', wake);
  window.addEventListener('freeze', pause);

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
    // v5.4: interfaz con más cuerpo: un golpecito grave bajo el clic
    click: () => { tone(midi(88), 0.04, { type: 'triangle', vol: 0.06 }); tone(150, 0.06, { type: 'sine', vol: 0.09, slide: 90 }); noise(0.03, { vol: 0.08, freq: 3500, q: 2 }); },
    select: () => { tone(midi(76), 0.05, { type: 'triangle', vol: 0.08 }); tone(midi(83), 0.07, { type: 'triangle', vol: 0.08, delay: 0.04 }); tone(180, 0.08, { type: 'sine', vol: 0.07, slide: 110 }); },
    hit: () => { noise(0.14, { vol: 0.45, freq: 900 }); tone(150, 0.14, { type: 'square', vol: 0.12, slide: 60 }); },
    // v5.4: rugido del jefe al aparecer (ruido grave + tono que baja)
    roar: () => { noise(0.9, { vol: 0.35, freq: 260 }); tone(140, 0.9, { type: 'sawtooth', vol: 0.12, slide: 55, attack: 0.08 }); tone(70, 1.1, { type: 'square', vol: 0.06, slide: 40, delay: 0.05 }); },
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
    // v5.4: fanfarria: subida + acorde final sostenido
    levelup: () => { arp([72, 76, 79, 84], 0.08, { type: 'square', vol: 0.06, dur: 0.16 }); [84, 88, 91].forEach((n) => tone(midi(n), 0.9, { type: 'triangle', vol: 0.1, delay: 0.34, attack: 0.02 })); tone(midi(60), 0.9, { type: 'sine', vol: 0.12, delay: 0.34 }); },
    tick: () => { tone(midi(96), 0.03, { type: 'square', vol: 0.035 }); noise(0.02, { vol: 0.06, freq: 6000, q: 3 }); },
    win: () => { arp([67, 72, 76, 79], 0.1, { type: 'square', vol: 0.08, dur: 0.2 }); arp([84, 88, 91], 0, { type: 'triangle', vol: 0.1, dur: 0.8, delay: 0.42 }); },
    lose: () => arp([67, 64, 60, 55], 0.22, { type: 'triangle', vol: 0.12, dur: 0.35 }),
    flee: () => noise(0.35, { vol: 0.25, freq: 600, q: 0.5 }),
    // v5.4: monedas que tintinean (parciales metálicos + 2-3 golpecitos)
    coin: () => { [0, 0.07, 0.15].forEach((d, i) => { const f = 2400 + i * 350 + Math.random() * 200; tone(f, 0.22, { type: 'sine', vol: 0.05, delay: d }); tone(f * 2.76, 0.12, { type: 'sine', vol: 0.025, delay: d }); noise(0.03, { vol: 0.08, freq: 7000, q: 4, delay: d }); }); },
    // v5.4: golpe seco al engarzar una runa
    thud: () => { tone(110, 0.16, { type: 'sine', vol: 0.3, slide: 45 }); noise(0.07, { vol: 0.3, freq: 420, q: 0.8 }); tone(midi(79), 0.25, { type: 'triangle', vol: 0.04, delay: 0.05 }); },
    chest: () => { noise(0.25, { vol: 0.18, freq: 500, q: 0.6 }); tone(90, 0.2, { type: 'square', vol: 0.06, slide: 60 }); arp([76, 83, 88], 0.07, { type: 'triangle', vol: 0.1, dur: 0.3, delay: 0.22 }); },
    // v5.16: cofre de la expedición, más discreto: un clic de cerradura y dos notas suaves
    chestSoft: () => { noise(0.05, { vol: 0.06, freq: 1800, q: 1.5 }); tone(midi(79), 0.35, { type: 'sine', vol: 0.045, delay: 0.06, attack: 0.02 }); tone(midi(84), 0.45, { type: 'sine', vol: 0.04, delay: 0.16, attack: 0.03 }); },
    legend: () => { tone(300, 1.2, { type: 'sine', vol: 0.1, slide: 1200, attack: 0.25 }); [84, 88, 91, 96].forEach((n, i) => tone(midi(n), 1.2, { type: 'triangle', vol: 0.07, delay: 0.7 + i * 0.05 })); noise(0.6, { vol: 0.08, freq: 8000, q: 1, delay: 0.7 }); },
    forge: () => { [0, 0.12, 0.24].forEach((d) => { noise(0.05, { vol: 0.35, freq: 3200, q: 3, delay: d }); tone(1800 + Math.random() * 600, 0.3, { type: 'sine', vol: 0.04, delay: d }); }); tone(90, 0.3, { type: 'sine', vol: 0.2, slide: 50 }); },
    craft: () => { noise(0.1, { vol: 0.3, freq: 2500 }); arp([67, 74, 79], 0.08, { type: 'triangle', vol: 0.12, dur: 0.22, delay: 0.08 }); },
    error: () => tone(160, 0.18, { type: 'square', vol: 0.08 }),
    evolve: () => { tone(200, 1.6, { type: 'sine', vol: 0.15, slide: 1600, attack: 0.3 }); arp([84, 88, 91, 96], 0.12, { type: 'triangle', vol: 0.1, dur: 0.4, delay: 1.5 }); },
    shiny: () => arp([96, 100, 103, 108], 0.05, { type: 'sine', vol: 0.08, dur: 0.3 }),
    achievement: () => arp([72, 79, 84, 88, 91], 0.06, { type: 'square', vol: 0.06, dur: 0.25 }),
    swap: () => { tone(500, 0.1, { type: 'triangle', vol: 0.1, slide: 800 }); tone(800, 0.12, { type: 'triangle', vol: 0.08, slide: 500, delay: 0.1 }); },
  };

  /* ---------------- Música (fantasía oscura) ----------------
   * Cada pista se compone en tiempo real con capas:
   *   drone   nota grave sostenida (raíz + quinta) con filtro paso bajo
   *   pad     acorde menor lento, como un coro lejano (dos osciladores desafinados)
   *   lead    melodía escasa sobre la escala (pluck = cuerda, bell = campana,
   *           harp = arpa, brass = metal grave)
   *   drums   none | soft (tambor lejano) | war (tambores de guerra)
   *   fx      ambiente: drip (gotas), wind (viento), waves (olas), whisper (susurros)
   * Campos: bpm, root (MIDI), scale (semitonos), prog (grados de la escala por compás),
   * density (0-1, cuántas notas de la melodía suenan).
   * Para una pista nueva: DK.audio.registerTrack('id', { … }) y úsala como `music` de una pantalla.
   */
  const AEOL = [0, 2, 3, 5, 7, 8, 10], PHRY = [0, 1, 3, 5, 7, 8, 10], HARM = [0, 2, 3, 5, 7, 8, 11], DOR = [0, 2, 3, 5, 7, 9, 10];
  const TRACKS = {
    // Campamento: guitarra triste junto al fuego (como la música de un pueblo maldito)
    menu: { bpm: 72, root: 50, scale: HARM, prog: [0, 5, 3, 4], lead: 'pluck', pad: 0.5, drone: 0.8, drums: 'none', fx: 'wind', density: 0.65 },
    meadow: { bpm: 76, root: 52, scale: AEOL, prog: [0, 5, 6, 4], lead: 'pluck', pad: 0.6, drone: 0.7, drums: 'soft', fx: 'wind', density: 0.55 },
    forest: { bpm: 70, root: 47, scale: DOR, prog: [0, 3, 6, 4], lead: 'harp', pad: 0.8, drone: 0.9, drums: 'soft', fx: 'whisper', density: 0.45 },
    beach: { bpm: 68, root: 50, scale: AEOL, prog: [0, 5, 2, 6], lead: 'bell', pad: 0.7, drone: 0.6, drums: 'none', fx: 'waves', density: 0.4 },
    cave: { bpm: 60, root: 49, scale: PHRY, prog: [0, 1, 0, 6], lead: 'bell', pad: 0.5, drone: 1, drums: 'none', fx: 'drip', density: 0.3 },
    volcano: { bpm: 92, root: 45, scale: PHRY, prog: [0, 1, 5, 6], lead: 'brass', pad: 0.4, drone: 1, drums: 'war', fx: 'none', density: 0.5 },
    temple: { bpm: 62, root: 52, scale: HARM, prog: [0, 3, 4, 0], lead: 'bell', pad: 1, drone: 0.7, drums: 'soft', fx: 'whisper', density: 0.35 },
    abyss: { bpm: 52, root: 41, scale: PHRY, prog: [0, 1, 6, 1], lead: 'bell', pad: 0.9, drone: 1.2, drums: 'none', fx: 'whisper', density: 0.22 },
    swamp: { bpm: 58, root: 43, scale: DOR, prog: [0, 6, 1, 5], lead: 'harp', pad: 0.9, drone: 1.1, drums: 'soft', fx: 'drip', density: 0.3 }, // v5.0
    glacier: { bpm: 60, root: 55, scale: AEOL, prog: [0, 3, 5, 4], lead: 'bell', pad: 1.1, drone: 0.7, drums: 'none', fx: 'wind', density: 0.3 }, // v5.0
    sky: { bpm: 66, root: 54, scale: DOR, prog: [0, 6, 3, 4], lead: 'harp', pad: 1, drone: 0.6, drums: 'soft', fx: 'wind', density: 0.45 },
    // Jefes: tambores de guerra y metales graves
    boss: { bpm: 118, root: 45, scale: HARM, prog: [0, 5, 1, 4], lead: 'brass', pad: 0.6, drone: 1.1, drums: 'war', fx: 'none', density: 0.7 },
    boss_secret: { bpm: 104, root: 44, scale: PHRY, prog: [0, 1, 0, 6], lead: 'bell', pad: 0.9, drone: 1.2, drums: 'war', fx: 'whisper', density: 0.5 },
    // v4.88: menú principal: misterio (campanas lejanas, coro bajo y susurros)
    title: { bpm: 56, root: 45, scale: HARM, prog: [0, 6, 3, 4, 0, 5, 1, 4], lead: 'bell', pad: 1.1, drone: 1, drums: 'none', fx: 'whisper', density: 0.28, choir: 0.8 },
    // Sucesos y santuarios de la expedición: intriga (arpa y gotas, en frigio)
    mystery: { bpm: 64, root: 47, scale: PHRY, prog: [0, 1, 6, 1], lead: 'harp', pad: 0.8, drone: 0.9, drums: 'none', fx: 'drip', density: 0.32, choir: 0.4 },
    // Élites: pulso tenso y metales
    elite: { bpm: 112, root: 46, scale: PHRY, prog: [0, 1, 0, 5], lead: 'brass', pad: 0.5, drone: 1, drums: 'drive', fx: 'none', density: 0.6, pulse: 1 },
    // Jefe con poca vida o en su última fase
    boss_rage: { bpm: 132, root: 46, scale: HARM, prog: [0, 1, 5, 4], lead: 'brass', pad: 0.5, drone: 1.2, drums: 'war', fx: 'none', density: 0.8, pulse: 1, choir: 0.6 },
    // v5.17: electrónica rápida para algunos jefes y para los combates contra varios rivales seguidos
    //   arp = arpegio a semicorcheas · bass = bajo en contratiempo · drums 'edm' = bombo a negras, palmas y charles
    boss_synth: { bpm: 140, root: 45, scale: HARM, prog: [0, 5, 3, 4], lead: 'synth', pad: 0.4, drone: 0.6, drums: 'edm', fx: 'none', density: 0.55, arp: 1, bass: 1 },
    boss_synth_rage: { bpm: 152, root: 46, scale: PHRY, prog: [0, 1, 5, 4], lead: 'synth', pad: 0.4, drone: 0.8, drums: 'edm', fx: 'none', density: 0.7, arp: 1.2, bass: 1.2, pulse: 0.6 },
    horde: { bpm: 136, root: 47, scale: DOR, prog: [0, 3, 6, 4], lead: 'synth', pad: 0.5, drone: 0.5, drums: 'edm', fx: 'none', density: 0.5, arp: 0.9, bass: 1 },
    // Poca vida (< 30%) en combate: latido y ostinato tenso
    danger: { bpm: 126, root: 44, scale: PHRY, prog: [0, 1, 0, 1], lead: 'pulse', pad: 0.3, drone: 1.1, drums: 'heart', fx: 'none', density: 0.75, pulse: 1 },
  };
  /**
   * v4.88: variante de combate de una pista de zona ('meadow:fight'): más rápida,
   * con percusión y algo más densa. Las pistas también «evolucionan» por secciones
   * (ver playStep): A, B (otra progresión y la melodía una octava arriba), C (calma) y D.
   */
  function trackOf(name) {
    if (TRACKS[name]) return TRACKS[name];
    const [base, mode] = String(name || '').split(':');
    const tr = TRACKS[base]; if (!tr || mode !== 'fight') return null;
    return Object.assign({}, tr, { bpm: Math.round(tr.bpm * 1.22), drums: tr.drums === 'war' ? 'war' : 'drive', density: Math.min(0.85, tr.density + 0.18), pulse: 0.7, fx: 'none' });
  }

  /** Nota con filtro paso bajo y envolvente (instrumentos de la música). */
  function voice(freq, dur, { type = 'sawtooth', vol = 0.05, delay = 0, attack = 0.01, release = null, cutoff = 1200, detune = 0, out = musicGain } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (release || 0));
    f.connect(g); g.connect(out);
    (detune ? [-detune, detune] : [0]).forEach((dt) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = dt;
      o.connect(f); o.start(t); o.stop(t + dur + (release || 0) + 0.05);
    });
  }
  /** Generador pseudoaleatorio estable por pista y compás (la melodía se repite con variaciones). */
  const hashRnd = (str) => { let x = 0; for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) | 0; return () => { x = (x * 1103515245 + 12345) | 0; return ((x >>> 0) % 10000) / 10000; }; };

  /** v5.4: tensión del combate (0–1): capas de percusión extra que entran poco a poco. */
  let intensity = 0;
  /*
   * v5.17/v5.17.1: cada pista suena por su propio bus (GainNode → filtro paso bajo → musicGain). Al cambiar de
   * pista, la anterior se apaga poco a poco mientras su filtro se cierra (suena «alejándose») y la nueva entra
   * subiendo con el filtro abriéndose, con curvas de igual potencia (sin bache de volumen). La nueva además
   * empieza con 2 compases de introducción (sin percusión y con menos melodía). En mitad de un combate (furia,
   * peligro) el cambio es corto y con redoble; al salir del combate, el más largo.
   */
  let lastStop = 0;
  const FIGHT_RE = /^(boss|danger|elite|boss_rage|boss_secret|boss_synth|boss_synth_rage|horde)$|:fight$/;
  /** Curva de igual potencia (de 0 a 1 o de 1 a 0) para setValueCurveAtTime. */
  const eqCurve = (up, from = 1) => { const n = 64, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1); c[i] = Math.max(0.0001, from * (up ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2))); } return c; };
  /**
   * v5.19.1: el fundido de igual potencia como 12 rampas lineales en vez de setValueCurveAtTime. Una curva no se
   * puede interrumpir (cancelScheduledValues no la borra si ya empezó y setValueAtTime lanzaba «Can't add events
   * during a curve event» al cambiar de pista durante un fundido → la pantalla no se podía abrir). Las rampas sí.
   */
  function eqRamp(param, up, from, start, dur) {
    const c = eqCurve(up, from), n = 12;
    for (let i = 1; i <= n; i++) param.linearRampToValueAtTime(c[Math.round(i / n * (c.length - 1))], start + dur * i / n);
  }
  /** Para un parámetro donde esté ahora (cancelAndHold si existe; si no, su valor actual). */
  function holdAt(param, t) {
    const v = Math.max(0.0001, param.value);
    try { if (param.cancelAndHoldAtTime) { param.cancelAndHoldAtTime(t); return v; } } catch (e) { /* sigue abajo */ }
    param.cancelScheduledValues(t); param.setValueAtTime(v, t); return v;
  }
  /** v5.19.1: la música nunca rompe una pantalla: cualquier fallo de Web Audio se queda aquí. */
  function startTrack(name) { try { startTrackRaw(name); } catch (e) { console.warn('Música:', e); } }
  function startTrackRaw(name) {
    const prev = seq;
    const tr = trackOf(name);
    const fightish = (n) => FIGHT_RE.test(n || '');
    const swap = prev && fightish(prev.name) && /^(boss_rage|danger|boss_synth_rage)$/.test(name);
    const leavingFight = prev && fightish(prev.name) && !fightish(name);
    const enteringFight = prev && !fightish(prev.name) && fightish(name);
    // ¿Venimos de otra pista hace nada (p. ej. una pantalla sin música entre medias)? → entrada larga también
    const recent = !prev && ctx && lastStop && ctx.currentTime - lastStop < 4;
    const fadeOut = !prev ? 0 : swap ? 0.5 : leavingFight ? 3.2 : enteringFight ? 1.4 : 2.6;
    const fadeIn = swap ? 0.7 : leavingFight ? 3.6 : enteringFight ? 1.6 : prev || recent ? 3 : 1.2;
    stopTrack(fadeOut);
    if (!tr || !ctx) return;
    const eighth = 60 / tr.bpm / 2;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.5; filt.connect(musicGain);
    const bus = ctx.createGain(); bus.connect(filt);
    // La nueva entra un poco después de que la vieja empiece a irse (se solapan, sin hueco ni choque)
    const t0 = ctx.currentTime, lead = swap ? 0.1 + 3 * eighth : prev ? Math.min(1.2, fadeOut * 0.35) : recent ? 0.3 : 0.1;
    bus.gain.setValueAtTime(0.0001, t0);
    bus.gain.setValueAtTime(0.0001, t0 + lead * 0.6); eqRamp(bus.gain, true, 1, t0 + lead * 0.6, fadeIn);
    filt.frequency.setValueAtTime(swap ? 2500 : 450, t0);
    filt.frequency.setValueAtTime(swap ? 2500 : 450, t0 + lead * 0.6);
    filt.frequency.exponentialRampToValueAtTime(18000, t0 + lead * 0.6 + fadeIn * 1.1);
    if (swap) [0, 1, 2, 3, 4, 5].forEach((i) => noise(0.08, { out: musicGain, vol: 0.03 + i * 0.012, freq: 300 + i * 40, q: 0.8, delay: 0.1 + i * eighth / 2 }));
    seq = { tr, name, step: 0, next: t0 + lead, eighth, bus, filt, intro: swap ? 0 : 16 };
    const me = seq;
    me.timer = setInterval(() => {
      if (!ctx) return;
      // (la pista que se está yendo sigue sonando mientras se apaga: si no, sus notas cortas se cortaban en seco)
      while (me.next < ctx.currentTime + 0.3) { playStep(me, me.step, me.next - ctx.currentTime); me.next += me.eighth; me.step++; }
    }, 90);
  }
  /** Para la pista: con fade (segundos) se va apagando y su filtro se cierra (las notas programadas se desvanecen). */
  function stopTrack(fade = 0) { try { stopTrackRaw(fade); } catch (e) { console.warn('Música:', e); seq = null; } }
  function stopTrackRaw(fade = 0) {
    if (!seq) return;
    const old = seq, { bus, filt } = old; seq = null;
    if (!bus || !ctx || !(fade > 0)) clearInterval(old.timer);
    else setTimeout(() => clearInterval(old.timer), fade * 1000); // sigue tocando (cada vez más bajo) hasta apagarse
    if (!bus || !ctx) return;
    const t0 = ctx.currentTime, g = bus.gain;
    lastStop = t0;
    try {
      const v = holdAt(g, t0);
      if (fade > 0) {
        eqRamp(g, false, v, t0, fade);
        if (filt) { const fv = holdAt(filt.frequency, t0); filt.frequency.exponentialRampToValueAtTime(Math.min(fv, 320), t0 + fade); }
      } else g.linearRampToValueAtTime(0.0001, t0 + 0.03);
    } catch (e) { try { g.value = 0.0001; } catch (e2) { /* */ } } // la música nunca debe romper nada
    setTimeout(() => { try { bus.disconnect(); if (filt) filt.disconnect(); } catch (e) { /* ya desconectado */ } }, (fade + 0.8) * 1000);
  }

  /** Nota de la escala (grado g, puede pasar de 7) sobre la tónica. */
  const deg = (tr, g) => tr.root + tr.scale[((g % 7) + 7) % 7] + 12 * Math.floor(g / 7);

  /** Toca un paso (corchea) de la pista activa. */
  function playStep(S, step, delay) {
    const { tr: tr0, eighth, name } = S, bus = S.bus || musicGain;
    const barN = Math.floor(step / 8), beat = step % 8;
    // v4.88: la pista evoluciona por secciones de 8 compases: A · B (progresión rotada, melodía arriba) · C (calma) · D
    const sect = Math.floor(barN / 8) % 4;
    let tr = sect === 1 || sect === 3 ? Object.assign({}, tr0, { prog: tr0.prog.slice(2).concat(tr0.prog.slice(0, 2)), up: sect === 1 ? 12 : 0, density: tr0.density * (sect === 3 ? 1.15 : 1) })
      : sect === 2 ? Object.assign({}, tr0, { density: tr0.density * 0.45, drums: tr0.drums === 'war' || tr0.drums === 'heart' ? tr0.drums : 'none', pulse: 0 }) : tr0;
    // v5.17.1: introducción de 2 compases al entrar una pista (sin percusión ni capas rítmicas, melodía escasa)
    const intro = S.intro && step < S.intro;
    if (intro) Object.assign(tr === tr0 ? (tr = Object.assign({}, tr0)) : tr, { drums: 'none', arp: 0, bass: 0, pulse: 0, density: tr0.density * 0.4 });
    const bar = barN % tr.prog.length;
    const g0 = tr.prog[bar];
    const o = { delay: Math.max(0, delay), out: bus };
    const barLen = eighth * 8;
    // Drone y pad al empezar el compás
    if (beat === 0) {
      if (tr.drone) { voice(midi(deg(tr, g0) - 24), barLen * 1.05, { ...o, type: 'sawtooth', vol: 0.05 * tr.drone, attack: 0.6, release: 0.6, cutoff: 260, detune: 7 }); voice(midi(deg(tr, g0 + 4) - 24), barLen * 1.05, { ...o, type: 'sawtooth', vol: 0.03 * tr.drone, attack: 0.8, release: 0.6, cutoff: 220 }); }
      if (tr.pad) [0, 2, 4].forEach((k, i) => voice(midi(deg(tr, g0 + k) - 12), barLen, { ...o, delay: o.delay + i * 0.05, type: 'triangle', vol: 0.022 * tr.pad, attack: barLen * 0.35, release: 0.8, cutoff: 900, detune: 9 }));
      // v4.88: coro grave («aah») para las pistas de misterio
      if (tr.choir) [0, 4].forEach((k) => voice(midi(deg(tr, g0 + k)), barLen * 1.1, { ...o, type: 'sawtooth', vol: 0.012 * tr.choir, attack: barLen * 0.5, release: 1, cutoff: 650, detune: 14 }));
    }
    // v4.88: ostinato de tensión (corcheas en la tónica y la quinta)
    if (tr.pulse) voice(midi(deg(tr, g0 + (beat % 4 === 3 ? 4 : 0)) - 12), eighth * 0.8, { ...o, type: 'square', vol: 0.014 * tr.pulse, attack: 0.004, cutoff: 900 });
    // Melodía escasa (estable por compás)
    const rnd = hashRnd(name + ':' + (barN % (tr.prog.length * 2)) + ':' + beat);
    const playLead = rnd() < tr.density * (beat % 2 ? 0.55 : 1);
    if (playLead) {
      const g = g0 + [0, 2, 4, 7, 4, 2, 1, 6][Math.floor(rnd() * 8)];
      const n = deg(tr, g) + (tr.lead === 'brass' ? -12 : 0) + (tr.up || 0);
      if (tr.lead === 'pluck') { voice(midi(n), eighth * 2.6, { ...o, type: 'triangle', vol: 0.07, attack: 0.004, cutoff: 1800 }); voice(midi(n + 12), eighth * 1.2, { ...o, type: 'sawtooth', vol: 0.012, attack: 0.004, cutoff: 2400 }); }
      else if (tr.lead === 'harp') voice(midi(n + 12), eighth * 3, { ...o, type: 'triangle', vol: 0.05, attack: 0.003, cutoff: 2600 });
      else if (tr.lead === 'bell') { voice(midi(n + 12), eighth * 6, { ...o, type: 'sine', vol: 0.05, attack: 0.003, cutoff: 5000 }); voice(midi(n + 31), eighth * 3, { ...o, type: 'sine', vol: 0.012, attack: 0.003, cutoff: 6000 }); }
      else if (tr.lead === 'brass') voice(midi(n), eighth * 1.8, { ...o, type: 'sawtooth', vol: 0.045, attack: 0.04, cutoff: 700, detune: 6 });
      else if (tr.lead === 'pulse') voice(midi(n + 12), eighth * 0.9, { ...o, type: 'square', vol: 0.03, attack: 0.004, cutoff: 1600 });
    }
    // v5.17: capas electrónicas: arpegio a semicorcheas por el acorde, bajo en contratiempo y lead «synth»
    if (tr.arp) { const ch = [0, 2, 4, 7, 4, 2]; [0, 1].forEach((k) => { const n = deg(tr, g0 + ch[(beat * 2 + k) % ch.length]) + 12; voice(midi(n), eighth * 0.42, { ...o, delay: o.delay + k * eighth / 2, type: 'sawtooth', vol: 0.016 * tr.arp, attack: 0.003, cutoff: 1500 + (beat % 4) * 400 }); }); }
    if (tr.bass && beat % 2 === 1) voice(midi(deg(tr, g0) - 12), eighth * 0.7, { ...o, type: 'sawtooth', vol: 0.05 * tr.bass, attack: 0.004, cutoff: 420 + (bar % 2) * 180, detune: 5 });
    if (playLead && tr.lead === 'synth') { const g = g0 + [0, 2, 4, 7, 4, 2, 1, 6][Math.floor(rnd() * 8)], n = deg(tr, g) + 12 + (tr.up || 0); voice(midi(n), eighth * 1.6, { ...o, type: 'square', vol: 0.026, attack: 0.006, cutoff: 2600, detune: 8 }); }
    // Percusión
    if (tr.drums === 'soft' && beat === 0) tone(70, 0.5, { ...o, out: bus, type: 'sine', vol: 0.12, slide: 40 });
    // v4.88: «drive» (combate normal y élites) y «heart» (latido con poca vida)
    if (tr.drums === 'drive') {
      if (beat === 0 || beat === 4) tone(64, 0.3, { ...o, out: bus, type: 'sine', vol: 0.16, slide: 36 });
      if (beat === 2 || beat === 6) noise(0.12, { ...o, out: bus, vol: 0.05, freq: 1800, q: 0.9 });
      if (beat % 2 === 1) noise(0.04, { ...o, out: bus, vol: 0.018, freq: 5200 });
    }
    if (tr.drums === 'heart' && (beat === 0 || beat === 1)) tone(beat ? 52 : 58, 0.22, { ...o, out: bus, type: 'sine', vol: beat ? 0.14 : 0.2, slide: 30 });
    if (tr.drums === 'edm') { // v5.17: bombo a negras, palmas en 2 y 4, charles abierto a contratiempo
      if (beat % 2 === 0) tone(58, 0.22, { ...o, type: 'sine', vol: 0.2, slide: 34 });
      if (beat === 2 || beat === 6) { noise(0.1, { ...o, vol: 0.06, freq: 1500, q: 0.7 }); noise(0.06, { ...o, vol: 0.04, freq: 2600, q: 1, delay: o.delay + 0.012 }); }
      if (beat % 2 === 1) noise(0.07, { ...o, vol: 0.022, freq: 8000, q: 1.2 });
      noise(0.02, { ...o, vol: 0.008, freq: 9500, q: 2, delay: o.delay + eighth / 2 });
    }
    if (tr.drums === 'war') {
      if (beat === 0 || beat === 3 || beat === 6) tone(62, 0.35, { ...o, out: bus, type: 'sine', vol: 0.2, slide: 34 });
      if (beat === 4) { noise(0.18, { ...o, out: bus, vol: 0.08, freq: 260, q: 0.8 }); tone(110, 0.2, { ...o, out: bus, type: 'triangle', vol: 0.06, slide: 60 }); }
      if (beat % 2 === 1) noise(0.05, { ...o, out: bus, vol: 0.025, freq: 3200 });
    }
    // v5.4: capas de tensión (DK.audio.intensity): charles a semicorcheas, tambor grave y un pedal agudo
    if (intensity > 0.25 && tr.drums !== 'none') noise(0.03, { ...o, out: bus, vol: 0.012 * intensity, freq: 7000, q: 1.5, delay: o.delay + eighth / 2 });
    if (intensity > 0.5 && (beat === 1 || beat === 5)) tone(80, 0.25, { ...o, out: bus, type: 'sine', vol: 0.11 * intensity, slide: 40 });
    if (intensity > 0.75 && beat % 2 === 0) voice(midi(deg(tr, g0) + 24), eighth * 0.6, { ...o, type: 'square', vol: 0.008 * intensity, attack: 0.004, cutoff: 3000 });
    // Ambiente
    if (tr.fx === 'drip' && rnd() < 0.08) tone(midi(96 + Math.floor(rnd() * 8)), 0.12, { ...o, out: bus, type: 'sine', vol: 0.03, slide: midi(84) });
    if (tr.fx === 'wind' && beat === 0 && bar % 2 === 0) noise(barLen * 1.6, { ...o, out: bus, vol: 0.018, freq: 500, q: 0.4 });
    if (tr.fx === 'waves' && beat === 0) noise(barLen * 0.9, { ...o, out: bus, vol: 0.03, freq: 380, q: 0.3 });
    if (tr.fx === 'whisper' && beat === 2 && bar % 2 === 1) noise(eighth * 3, { ...o, out: bus, vol: 0.014, freq: 2400, q: 2 });
  }

  DK.audio = {
    /** Reproduce un efecto por nombre. */
    sfx(name) {
      if (!ctx || hidden() || DK.settings.get('muted') || DK.settings.get('sfxVol') <= 0) return;
      try { (SFX[name] || SFX.click)(); } catch (e) { /* audio no disponible */ }
    },
    /** Cambia la música ('menu', 'boss', escena de zona o null). */
    music(name) {
      if (name === wantedTrack && seq) return;
      wantedTrack = name;
      if (!ctx) return;
      if (!name || !/^(boss|danger|elite|boss_rage|boss_secret|boss_synth|boss_synth_rage|horde)$|:fight$/.test(name)) intensity = 0;
      if (!name || hidden()) stopTrack(name ? 0 : 0.8); else startTrack(name);
    },
    updateVolumes,
    /** v5.4: tensión de la música (0 = normal … 1 = máxima). El combate la ajusta con la vida de cada lado. */
    intensity(x) { intensity = Math.max(0, Math.min(1, +x || 0)); },
    /** Pista de la zona de la expedición en curso (o la del campamento). */
    zoneTrack() { const e = DK.expedition && DK.expedition.active(); const z = e && DK.data.zones[e.zone]; return z && TRACKS[z.scene] ? z.scene : 'menu'; },
    /** v4.88: pista que suena ahora (para las pruebas). */
    current: () => wantedTrack,
    has: (name) => !!trackOf(name),
    /** ¿Está sonando la música? (para las pruebas) */
    playing: () => !!seq && !!ctx && ctx.state === 'running',
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
