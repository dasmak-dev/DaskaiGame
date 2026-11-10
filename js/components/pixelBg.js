/* =============================================================
 * components/pixelBg.js — v5.20: fondos en pixel art (ajuste «pixelArt»).
 *
 *   DK.pixelBg.on()            → ¿está activo el pixel art?
 *   DK.pixelBg.swap(root)      → cambia cada capa SVG del fondo que haya dentro de `root`
 *                                (paisaje del combate y de los mapas, laterales de la expedición)
 *                                por una imagen pequeña escalada sin suavizar
 *
 * Cómo funciona: el SVG de la capa se pinta en un lienzo diminuto (≈ 300 px de ancho para un
 * paisaje), se reducen sus colores y su transparencia a escalones (posterizado) y se muestra
 * como <img> con `image-rendering: pixelated`. Las variables CSS (var(--sil)…) se resuelven
 * antes con los colores reales del elemento, porque una imagen no ve la hoja de estilos.
 * El cielo por bandas y las partículas cuadradas que se mueven a saltos están en css/pixel.css
 * (se activan con :root[data-px="on"]). Las imágenes se guardan en caché (máx. 60).
 *
 * Qué capas se cambian: SELECTORS (svg.scene-far, svg.scene-near y .ps-side svg). Para que
 * otra capa salga en pixel art, añade su selector y su ancho en píxeles a SELECTORS.
 * ============================================================= */
(function () {
  /** selector → [ancho del lienzo en px, ajuste del <img>] */
  const SELECTORS = [
    ['svg.scene-far', 300, 'cover'],
    ['svg.scene-near', 300, 'cover'],
    ['.ps-side svg', 96, 'contain'],
  ];
  const cache = new Map();
  const remember = (k, v) => { cache.set(k, v); if (cache.size > 60) cache.delete(cache.keys().next().value); return v; };
  const on = () => !!(DK.settings && DK.settings.get('pixelArt') !== false);

  /* ---------- colores ---------- */
  let probeCtx = null;
  /** Cualquier color CSS (también color-mix) → 'rgba(r,g,b,a)' usando el elemento para resolverlo. */
  function toRgba(value, el) {
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
    probe.style.color = value;
    (el.isConnected ? el : document.body).appendChild(probe);
    const c = getComputedStyle(probe).color; probe.remove();
    if (!probeCtx) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; probeCtx = cv.getContext('2d', { willReadFrequently: true }); }
    probeCtx.clearRect(0, 0, 1, 1); probeCtx.fillStyle = '#000'; probeCtx.fillStyle = c; probeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  }
  /** Sustituye var(--x) por su color real (las imágenes SVG no ven las variables de la página). */
  function resolveVars(text, el) {
    if (!text.includes('var(')) return text;
    const cs = getComputedStyle(el), memo = {};
    return text.replace(/var\((--[\w-]+)\)/g, (_, n) => (memo[n] = memo[n] || toRgba(cs.getPropertyValue(n).trim() || 'transparent', el)));
  }

  /* ---------- pintar en pequeño ---------- */
  function loadSvg(text) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text); });
  }
  /** Colores en escalones de 24 y transparencia en octavos: bordes duros y degradados en bandas. */
  function posterize(ctx, w, hh) {
    const img = ctx.getImageData(0, 0, w, hh), d = img.data, q = (v) => Math.min(255, Math.round(v / 24) * 24);
    for (let i = 0; i < d.length; i += 4) {
      const a = Math.round((d[i + 3] / 255) * 8) / 8;
      if (a <= 0) { d[i + 3] = 0; continue; }
      d[i] = q(d[i]); d[i + 1] = q(d[i + 1]); d[i + 2] = q(d[i + 2]); d[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }
  /** SVG (texto) → dataURL de una imagen pequeña en pixel art. */
  async function raster(text, outW) {
    const vb = (text.match(/viewBox="([\d.\s-]+)"/) || [])[1];
    const [, , vw, vh] = (vb || '0 0 1000 400').split(/\s+/).map(Number);
    const outH = Math.max(1, Math.round(outW * vh / vw));
    // tamaño exacto del lienzo y sin estilos de la página (filtros, clases de animación…)
    const src = text.replace(/^<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb || '0 0 1000 400'}" width="${outW}" height="${outH}" preserveAspectRatio="none" shape-rendering="crispEdges">`);
    const im = await loadSvg(src);
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = outW; c.height = outH;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(im, 0, 0, outW, outH);
    try { posterize(ctx, outW, outH); } catch (e) { /* lienzo «manchado»: se queda sin posterizar */ }
    return c.toDataURL('image/png');
  }

  /** Cambia un <svg> por su <img> en pixel art (en cuanto esté lista; si falla, se queda el SVG). */
  function swapOne(svgEl, outW, fit) {
    if (svgEl.dataset.px) return;
    svgEl.dataset.px = '1';
    const make = (url) => {
      if (!url || !svgEl.parentNode) return;
      const img = document.createElement('img');
      img.src = url; img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.decoding = 'async';
      img.className = 'px-layer px-' + fit + ' ' + (svgEl.getAttribute('class') || '');
      svgEl.replaceWith(img);
    };
    const go = () => {
      const text = resolveVars(svgEl.outerHTML, svgEl), key = outW + '|' + text;
      if (cache.has(key)) return make(cache.get(key));
      svgEl.style.visibility = 'hidden'; // sin el destello del dibujo suave antes del pixelado
      raster(text, outW).then((url) => { remember(key, url); if (url) make(url); else svgEl.style.visibility = ''; });
    };
    // las variables CSS sólo se pueden leer con el elemento ya en la página
    if (!svgEl.outerHTML.includes('var(') || svgEl.isConnected) return go();
    let tries = 0;
    const wait = () => (svgEl.isConnected ? go() : ++tries < 30 ? requestAnimationFrame(wait) : (delete svgEl.dataset.px));
    requestAnimationFrame(wait);
  }

  DK.pixelBg = {
    on,
    SELECTORS,
    /** Pasa a pixel art las capas de fondo dentro de `root` (no hace nada si el ajuste está apagado). */
    swap(root) {
      if (!root || !on()) return root;
      SELECTORS.forEach(([sel, w, fit]) => root.querySelectorAll(sel).forEach((s) => swapOne(s, w, fit)));
      return root;
    },
    /** Para las pruebas: cuántas imágenes hay en caché. */
    cacheSize: () => cache.size,
  };

  // Al cambiar el ajuste se rehace el fondo de la expedición (las demás pantallas se repintan solas)
  DK.on('settings:changed', ({ key }) => {
    if (key !== 'pixelArt') return;
    const bd = document.getElementById('zone-backdrop');
    if (bd) delete bd.dataset.zone;
  });
})();
