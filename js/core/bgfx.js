/* =============================================================
 * core/bgfx.js — Fondo animado de remolino de pintura (DK.bgfx, v4.44).
 *
 * Un <canvas id="bgfx"> fijo detrás de todo, pintado con un shader WebGL
 * a baja resolución (píxeles gordos) y a ~30 fps: tres colores que se
 * mezclan girando despacio, como un remolino de pintura.
 *
 *   · Colores e intensidad desde CSS: --bgfx-a, --bgfx-b, --bgfx-c, --bgfx-op
 *     (v4.77: el tono de a y b gira despacio cada pocos minutos; ver hueShift)
 *     (css/motion.css §6, cambian con el tema y el estilo).
 *   · Sólo en las pantallas de fuera de la expedición: se apaga en
 *     OFF_SCREENS y mientras haya una expedición en curso.
 *   · Ajuste «Fondo animado» (settings.bgFx). Con alto contraste no sale;
 *     con «Reducir animaciones» se queda quieto (un solo fotograma).
 *   · Se pausa con la pestaña oculta. Sin WebGL no hace nada (queda el
 *     degradado normal del <body>).
 * ============================================================= */
(function () {
  const OFF_SCREENS = ['expedition', 'battle', 'expSummary', 'gameOver'];
  const PIXEL = 4;          // tamaño del «píxel» del fondo
  const FPS = 30;

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `precision mediump float;
uniform vec2 uRes;uniform float uT;uniform vec3 uA;uniform vec3 uB;uniform vec3 uC;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/length(uRes);
  float d=length(uv);
  float ang=atan(uv.y,uv.x)+uT*.035-d*(2.6+.4*sin(uT*.05));
  uv=vec2(cos(ang),sin(ang))*d*22.;
  vec2 w=vec2(uv.x+uv.y);
  float t=uT*.55;
  for(int i=0;i<5;i++){
    w+=sin(max(uv.x,uv.y))+uv;
    uv+=.5*vec2(cos(5.11+.35*w.y+t*.13),sin(w.x-.11*t));
    uv-=cos(uv.x+uv.y)-sin(uv.x*.71-uv.y);
  }
  float k=1.4;
  float paint=clamp(length(uv)*.035*k,0.,2.);
  float a=max(0.,1.-k*abs(1.-paint));
  float b=max(0.,1.-k*abs(paint));
  float c=1.-min(1.,a+b);
  vec3 col=uA*a+uB*b+uC*c;
  col*=1.-smoothstep(.3,.85,d)*.55;
  gl_FragColor=vec4(col,1.);
}`;

  let canvas = null, gl = null, prog = null, U = {}, raf = 0, last = 0, t0 = 0, on = false, colors = null;

  const hex = (s, def) => {
    s = (s || '').trim(); const m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (!m) return def;
    const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors = [hex(cs.getPropertyValue('--bgfx-a'), [.23, .16, .48]), hex(cs.getPropertyValue('--bgfx-b'), [.42, .08, .19]), hex(cs.getPropertyValue('--bgfx-c'), [.04, .05, .1])];
  }

  function init() {
    if (canvas) return !!gl;
    canvas = document.createElement('canvas');
    canvas.id = 'bgfx'; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' }); } catch (_) { gl = null; }
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uT', 'uA', 'uB', 'uC'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    t0 = performance.now() - Math.random() * 60000;
    window.addEventListener('resize', () => { if (on) { resize(); if (still()) draw(performance.now()); } });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : update()));
    return true;
  }

  function resize() {
    const w = Math.max(1, Math.ceil(innerWidth / PIXEL)), h = Math.max(1, Math.ceil(innerHeight / PIXEL));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  /**
   * v4.77: el color va cambiando muy de vez en cuando y poco a poco: cada HUE_EVERY segundos
   * el tono de los dos colores vivos gira hacia otro de HUES, en HUE_FADE segundos (suave).
   * El fondo oscuro (--bgfx-c) no cambia.
   */
  const HUE_EVERY = 150, HUE_FADE = 45, HUES = [0, 40, -35, 80, -70, 130, 20, -110, 170, 60];
  function hueShift(sec) {
    const k = Math.floor(sec / HUE_EVERY), into = sec - k * HUE_EVERY;
    const from = HUES[k % HUES.length], to = HUES[(k + 1) % HUES.length];
    const x = Math.min(1, Math.max(0, (into - (HUE_EVERY - HUE_FADE)) / HUE_FADE)), e = x * x * (3 - 2 * x);
    return from + (to - from) * e;
  }
  function rotate([r, g, b], deg) {
    // giro de tono en RGB (matriz de rotación sobre el eje gris)
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), k = (1 - c) / 3, q = Math.sqrt(1 / 3) * s;
    const m = [c + k, k - q, k + q, k + q, c + k, k - q, k - q, k + q, c + k];
    return [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b].map((v) => Math.min(1, Math.max(0, v)));
  }
  function draw(now) {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uT, (now - t0) / 1000);
    const hs = still() ? 0 : hueShift((now - t0) / 1000);
    gl.uniform3fv(U.uA, rotate(colors[0], hs)); gl.uniform3fv(U.uB, rotate(colors[1], hs)); gl.uniform3fv(U.uC, colors[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS) return;
    last = now; draw(now);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  const still = () => DK.settings.reducedMotion();

  /** ¿Debe verse ahora? */
  function wanted() {
    const S = DK.settings;
    if (S.get('bgFx') === false || S.get('highContrast')) return false;
    if (OFF_SCREENS.includes(document.body.dataset.screen)) return false;
    if (DK.store && DK.store.state && DK.expedition && DK.expedition.active()) return false;
    return true;
  }

  /** Enciende, apaga o repinta según el ajuste, la pantalla y el tema. */
  function update() {
    on = wanted();
    document.body.classList.toggle('bgfx-on', on);
    if (!on) { stop(); return; }
    if (!init()) { document.body.classList.remove('bgfx-on'); return; }
    readColors(); resize();
    if (still()) { stop(); draw(performance.now()); return; }
    if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
  }

  DK.bgfx = { update, offScreens: OFF_SCREENS, isOn: () => on };
  DK.on('screen:enter', update);
  DK.on('settings:changed', () => requestAnimationFrame(update));
  ['expedition:end', 'expedition:complete'].forEach((ev) => DK.on(ev, () => setTimeout(update, 0)));
})();
