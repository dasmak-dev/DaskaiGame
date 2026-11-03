/* =============================================================
 * systems/sprites.js — Dibujo procedural de los daskai en SVG.
 *
 * Cada especie define en `sprite`:
 *   c1 (color del cuerpo), c2 (acento), rx/ry (tamaño),
 *   ears:  'none'|'cat'|'long'|'horns'|'antenna'|'crest'|'spikes'|'leaf'|'flame'|'fins'|'halo'
 *   tail:  'none'|'flame'|'leaf'|'spike'|'fin'|'curl'|'orb'
 *   eyes:  'big'|'sharp'|'glow'|'cyclops'|'sleepy'   eyeColor
 *   mark:  'star'|'gem'|'moon'|'stripes'|'spots'     wings: true
 *   body:  'round' (por defecto) | 'egg' | 'block' | 'ghost' (flota, sin pies) | 'long' (con segmentos detrás)
 *   legs:  'feet' (por defecto) | 'none' | 'quad' (cuatro patas) | 'tall' (patas de ave)
 *   extra: lista de añadidos: 'beak' | 'horn' | 'shell' | 'mane' | 'whiskers' | 'fangs' | 'arms' | 'claws' | 'cap' | 'crown' | 'scarf'
 * Para usar una imagen propia: sprite: { img: 'img/x.png' }
 *
 *   DK.sprites.svg(especie, { flip, shiny }) → texto SVG
 * ============================================================= */
(function () {
  /** Aclara (amt>0) u oscurece (amt<0) un color hexadecimal. */
  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
    r = Math.round((f - r) * t + r); g = Math.round((f - g) * t + g); b = Math.round((f - b) * t + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  const f = (n) => Math.round(n * 10) / 10;

  /** Gira el tono de un color (para las versiones variocolor). */
  function hueShift(hex, deg) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    let r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hh = 0, ss = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      ss = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hh /= 6;
    }
    hh = (hh + deg / 360) % 1;
    const q = l < 0.5 ? l * (1 + ss) : l + ss - l * ss, pp = 2 * l - q;
    const conv = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
    return '#' + to(ss ? conv(hh + 1 / 3) : l) + to(ss ? conv(hh) : l) + to(ss ? conv(hh - 1 / 3) : l);
  }

  const EARS = {
    none: () => '',
    cat: ({ cx, t, rx, ry, c1, c2, dk }) =>
      `<polygon points="${f(cx - rx * 0.78)},${f(t + ry * 0.5)} ${f(cx - rx * 0.62)},${f(t - 14)} ${f(cx - rx * 0.12)},${f(t + ry * 0.18)}" fill="${c1}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>` +
      `<polygon points="${f(cx - rx * 0.62)},${f(t + ry * 0.3)} ${f(cx - rx * 0.6)},${f(t - 6)} ${f(cx - rx * 0.32)},${f(t + ry * 0.2)}" fill="${c2}"/>` +
      `<polygon points="${f(cx + rx * 0.02)},${f(t + ry * 0.15)} ${f(cx + rx * 0.42)},${f(t - 12)} ${f(cx + rx * 0.66)},${f(t + ry * 0.45)}" fill="${c1}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`,
    long: ({ cx, t, rx, c1, c2, dk }) =>
      `<g transform="rotate(-20 ${f(cx - rx * 0.42)} ${f(t + 2)})"><ellipse cx="${f(cx - rx * 0.42)}" cy="${f(t - 10)}" rx="7" ry="20" fill="${c1}" stroke="${dk}" stroke-width="2"/><ellipse cx="${f(cx - rx * 0.42)}" cy="${f(t - 10)}" rx="3.5" ry="13" fill="${c2}"/></g>` +
      `<g transform="rotate(16 ${f(cx + rx * 0.22)} ${f(t + 2)})"><ellipse cx="${f(cx + rx * 0.22)}" cy="${f(t - 10)}" rx="7" ry="20" fill="${c1}" stroke="${dk}" stroke-width="2"/></g>`,
    horns: ({ cx, t, rx, c2, dk }) => {
      const a = `M ${f(cx - rx * 0.42)} ${f(t + 8)} Q ${f(cx - rx * 0.9)} ${f(t - 8)} ${f(cx - rx * 0.55)} ${f(t - 22)}`;
      const b = `M ${f(cx + rx * 0.2)} ${f(t + 7)} Q ${f(cx + rx * 0.66)} ${f(t - 8)} ${f(cx + rx * 0.36)} ${f(t - 22)}`;
      return `<path d="${a}" stroke="${dk}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${a}" stroke="${c2}" stroke-width="5.5" fill="none" stroke-linecap="round"/>` +
        `<path d="${b}" stroke="${dk}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${b}" stroke="${c2}" stroke-width="5.5" fill="none" stroke-linecap="round"/>`;
    },
    antenna: ({ cx, t, rx, c2, dk }) =>
      `<path d="M ${f(cx - rx * 0.3)} ${f(t + 5)} Q ${f(cx - rx * 0.4)} ${f(t - 8)} ${f(cx - rx * 0.6)} ${f(t - 18)}" stroke="${dk}" stroke-width="2.5" fill="none"/><circle cx="${f(cx - rx * 0.6)}" cy="${f(t - 18)}" r="4.5" fill="${c2}" stroke="${dk}" stroke-width="2"/>` +
      `<path d="M ${f(cx + rx * 0.1)} ${f(t + 5)} Q ${f(cx + rx * 0.15)} ${f(t - 8)} ${f(cx + rx * 0.3)} ${f(t - 18)}" stroke="${dk}" stroke-width="2.5" fill="none"/><circle cx="${f(cx + rx * 0.3)}" cy="${f(t - 18)}" r="4.5" fill="${c2}" stroke="${dk}" stroke-width="2"/>`,
    crest: ({ cx, t, rx, c2, dk }) =>
      [[-0.45, 16], [-0.1, 22], [0.28, 15]].map(([o, hgt]) => {
        const x = cx + rx * o;
        return `<polygon points="${f(x - 7)},${f(t + 6)} ${f(x - 2)},${f(t - hgt)} ${f(x + 7)},${f(t + 6)}" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`;
      }).join(''),
    spikes: ({ cx, t, rx, ry, c2, dk }) =>
      [[-0.7, 0.35, 12], [-0.38, 0.06, 15], [0, 0, 16], [0.38, 0.08, 13], [0.68, 0.38, 10]].map(([o, dy, hgt]) => {
        const x = cx + rx * o, y = t + ry * dy;
        return `<polygon points="${f(x - 6)},${f(y + 6)} ${f(x)},${f(y - hgt)} ${f(x + 6)},${f(y + 6)}" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`;
      }).join(''),
    leaf: ({ cx, t, c2, dk }) =>
      `<path d="M ${f(cx - 4)} ${f(t + 5)} C ${f(cx - 26)} ${f(t - 8)} ${f(cx - 16)} ${f(t - 30)} ${f(cx + 4)} ${f(t - 28)} C ${f(cx + 8)} ${f(t - 12)} ${f(cx + 2)} ${f(t - 2)} ${f(cx - 4)} ${f(t + 5)} Z" fill="${c2}" stroke="${dk}" stroke-width="2"/>` +
      `<path d="M ${f(cx - 3)} ${f(t + 3)} Q ${f(cx - 6)} ${f(t - 14)} ${f(cx + 2)} ${f(t - 25)}" stroke="${dk}" stroke-width="1.5" fill="none" opacity=".6"/>`,
    flame: ({ cx, t, c2 }) =>
      `<path d="M ${f(cx - 14)} ${f(t + 8)} C ${f(cx - 24)} ${f(t - 8)} ${f(cx - 8)} ${f(t - 14)} ${f(cx - 6)} ${f(t - 32)} C ${f(cx + 6)} ${f(t - 18)} ${f(cx + 18)} ${f(t - 16)} ${f(cx + 10)} ${f(t + 8)} Z" fill="${c2}"/>` +
      `<path d="M ${f(cx - 7)} ${f(t + 8)} C ${f(cx - 12)} ${f(t - 2)} ${f(cx - 4)} ${f(t - 6)} ${f(cx - 3)} ${f(t - 18)} C ${f(cx + 4)} ${f(t - 8)} ${f(cx + 9)} ${f(t - 6)} ${f(cx + 5)} ${f(t + 8)} Z" fill="#fef08a"/>`,
    fins: ({ cx, cy, t, rx, c2, dk }) =>
      `<polygon points="${f(cx - rx * 0.85)},${f(cy - 4)} ${f(cx - rx - 14)},${f(cy - 18)} ${f(cx - rx * 0.78)},${f(cy + 8)}" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>` +
      `<polygon points="${f(cx - 10)},${f(t + 6)} ${f(cx + 2)},${f(t - 18)} ${f(cx + 14)},${f(t + 7)}" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`,
    halo: ({ cx, t }) =>
      `<ellipse cx="${f(cx - 4)}" cy="${f(t - 12)}" rx="18" ry="5" fill="none" stroke="#fde047" stroke-width="4"/><ellipse cx="${f(cx - 4)}" cy="${f(t - 12)}" rx="18" ry="5" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>`,
  };

  const TAILS = {
    none: () => '',
    flame: ({ x, y, c2 }) =>
      `<path d="M ${f(x)} ${f(y)} C ${f(x + 14)} ${f(y - 4)} ${f(x + 14)} ${f(y - 22)} ${f(x + 26)} ${f(y - 36)} C ${f(x + 32)} ${f(y - 16)} ${f(x + 28)} ${f(y + 6)} ${f(x + 4)} ${f(y + 10)} Z" fill="${c2 === '#fed7aa' ? '#f97316' : c2}"/>` +
      `<path d="M ${f(x + 6)} ${f(y + 4)} C ${f(x + 14)} ${f(y)} ${f(x + 16)} ${f(y - 12)} ${f(x + 22)} ${f(y - 22)} C ${f(x + 26)} ${f(y - 8)} ${f(x + 22)} ${f(y + 4)} ${f(x + 6)} ${f(y + 6)} Z" fill="#fde047"/>`,
    leaf: ({ x, y, c2, dk }) =>
      `<path d="M ${f(x)} ${f(y)} C ${f(x + 10)} ${f(y - 24)} ${f(x + 30)} ${f(y - 26)} ${f(x + 32)} ${f(y - 30)} C ${f(x + 30)} ${f(y - 8)} ${f(x + 16)} ${f(y + 6)} ${f(x)} ${f(y + 4)} Z" fill="${c2}" stroke="${dk}" stroke-width="2"/>`,
    spike: ({ x, y, c2, dk }) =>
      `<polygon points="${f(x - 4)},${f(y - 9)} ${f(x + 26)},${f(y - 20)} ${f(x + 2)},${f(y + 9)}" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`,
    fin: ({ x, y, c2, dk }) =>
      `<polygon points="${f(x - 4)},${f(y)} ${f(x + 22)},${f(y - 18)} ${f(x + 15)},${f(y + 2)} ${f(x + 22)},${f(y + 18)}" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`,
    curl: ({ x, y, c1, dk }) =>
      `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 24)} ${f(y + 2)} ${f(x + 22)} ${f(y - 16)} Q ${f(x + 20)} ${f(y - 30)} ${f(x + 8)} ${f(y - 26)}" stroke="${dk}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
      `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 24)} ${f(y + 2)} ${f(x + 22)} ${f(y - 16)} Q ${f(x + 20)} ${f(y - 30)} ${f(x + 8)} ${f(y - 26)}" stroke="${c1}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    orb: ({ x, y, c2, dk }) =>
      `<path d="M ${f(x - 4)} ${f(y)} Q ${f(x + 12)} ${f(y - 2)} ${f(x + 18)} ${f(y - 18)}" stroke="${dk}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<circle cx="${f(x + 19)}" cy="${f(y - 22)}" r="10" fill="${c2}" opacity=".35"/><circle cx="${f(x + 19)}" cy="${f(y - 22)}" r="6" fill="${c2}" stroke="${dk}" stroke-width="2"/>`,
  };

  const WINGS = ({ cx, cy, rx, ry, c2, dk }) =>
    `<path d="M ${f(cx + rx * 0.1)} ${f(cy - ry * 0.35)} Q ${f(cx + rx + 22)} ${f(cy - ry - 22)} ${f(cx + rx + 20)} ${f(cy - 2)} Q ${f(cx + rx * 0.8)} ${f(cy + 2)} ${f(cx + rx * 0.2)} ${f(cy + 2)} Z" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round" opacity=".95"/>` +
    `<path d="M ${f(cx + rx * 0.4)} ${f(cy - ry * 0.3)} Q ${f(cx + rx + 6)} ${f(cy - ry - 4)} ${f(cx + rx + 12)} ${f(cy - 6)}" stroke="${dk}" stroke-width="1.5" fill="none" opacity=".5"/>`;

  function eyes(s, { cx, cy, rx, ry, dk }) {
    const er = Math.max(5, rx * 0.2);
    const e1 = [cx - rx * 0.42, cy - ry * 0.28], e2 = [cx + rx * 0.08, cy - ry * 0.32];
    const col = s.eyeColor || '#1b1b2f';
    const big = ([x, y], r = er) =>
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fff" stroke="${dk}" stroke-width="1.5"/>` +
      `<circle cx="${f(x - r * 0.25)}" cy="${f(y + r * 0.1)}" r="${f(r * 0.62)}" fill="${col}"/>` +
      `<circle cx="${f(x - r * 0.45)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.26)}" fill="#fff"/>`;
    switch (s.eyes) {
      case 'sharp': return [e1, e2].map(([x, y]) =>
        `<path d="M ${f(x - er)} ${f(y + 1)} Q ${f(x)} ${f(y - er * 1.1)} ${f(x + er)} ${f(y - 2)} Q ${f(x)} ${f(y + er * 0.8)} ${f(x - er)} ${f(y + 1)} Z" fill="#fff" stroke="${dk}" stroke-width="1.5"/>` +
        `<ellipse cx="${f(x - 1)}" cy="${f(y)}" rx="${f(er * 0.28)}" ry="${f(er * 0.62)}" fill="${col}"/>`).join('');
      case 'glow': return [e1, e2].map(([x, y]) =>
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 1.35)}" fill="${col}" opacity=".3"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(er * 0.8)}" fill="${col}"/><circle cx="${f(x - er * 0.25)}" cy="${f(y - er * 0.25)}" r="${f(er * 0.25)}" fill="#fff"/>`).join('');
      case 'cyclops': return big([cx - rx * 0.18, cy - ry * 0.3], er * 1.55);
      case 'sleepy': return [e1, e2].map(([x, y]) =>
        `<path d="M ${f(x - er)} ${f(y)} Q ${f(x)} ${f(y + er * 0.8)} ${f(x + er)} ${f(y)}" stroke="${dk}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('');
      default: return big(e1) + big(e2);
    }
  }

  function mark(s, { cx, cy, t, rx, ry, c2, dk }) {
    const x = cx - rx * 0.16, y = t + ry * 0.26;
    switch (s.mark) {
      case 'star': return `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const r = i % 2 ? 2.6 : 6; const a = -Math.PI / 2 + (i * Math.PI) / 5; return f(x + r * Math.cos(a)) + ',' + f(y + r * Math.sin(a)); }).join(' ')}" fill="#fde047" stroke="${dk}" stroke-width="1"/>`;
      case 'gem': return `<polygon points="${f(x)},${f(y - 6)} ${f(x + 5)},${f(y)} ${f(x)},${f(y + 6)} ${f(x - 5)},${f(y)}" fill="${s.gem || '#22d3ee'}" stroke="${dk}" stroke-width="1.5"/>`;
      case 'moon': return `<path d="M ${f(x + 3)} ${f(y - 6)} A 6 6 0 1 0 ${f(x + 3)} ${f(y + 6)} A 4.5 4.5 0 1 1 ${f(x + 3)} ${f(y - 6)} Z" fill="${c2}"/>`;
      case 'stripes': return [0, 1, 2].map((i) => `<path d="M ${f(cx + rx * 0.35 + i * 7)} ${f(cy - ry * 0.75 + i * 2)} q 4 ${f(ry * 0.3)} 0 ${f(ry * 0.6)}" stroke="${dk}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`).join('');
      case 'spots': return [[0.45, -0.4, 4], [0.65, -0.05, 3], [0.3, -0.7, 2.6]].map(([ox, oy, r]) => `<circle cx="${f(cx + rx * ox)}" cy="${f(cy + ry * oy)}" r="${r}" fill="${c2}" opacity=".85"/>`).join('');
      default: return '';
    }
  }

  /* ---------- Formas del cuerpo, patas y añadidos ---------- */
  /** Contorno del cuerpo (en lugar de la elipse redonda). */
  function bodyShape(kind, { cx, cy, t, rx, ry }, fill, dk) {
    const st = `fill="${fill}" stroke="${dk}" stroke-width="2.2" stroke-linejoin="round"`;
    switch (kind) {
      case 'egg': return `<path d="M ${f(cx)} ${f(t - 2)} C ${f(cx + rx * 0.95)} ${f(t - 2)} ${f(cx + rx * 1.08)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} C ${f(cx - rx * 1.08)} ${f(cy + ry)} ${f(cx - rx * 0.95)} ${f(t - 2)} ${f(cx)} ${f(t - 2)} Z" ${st}/>`;
      case 'block': return `<rect x="${f(cx - rx)}" y="${f(t + 2)}" width="${f(rx * 2)}" height="${f(ry * 2 - 2)}" rx="${f(ry * 0.42)}" ${st}/>`;
      case 'ghost': {
        const n = 4, w = (rx * 2) / n, yb = cy + ry * 0.92;
        let d = `M ${f(cx - rx)} ${f(cy)} A ${rx} ${ry} 0 0 1 ${f(cx + rx)} ${f(cy)} L ${f(cx + rx)} ${f(yb)}`;
        for (let i = 0; i < n; i++) { const x0 = cx + rx - i * w; d += ` Q ${f(x0 - w * 0.25)} ${f(yb + 8)} ${f(x0 - w * 0.5)} ${f(yb)} Q ${f(x0 - w * 0.75)} ${f(yb - 7)} ${f(x0 - w)} ${f(yb)}`; }
        return `<path d="${d} Z" ${st}/>`;
      }
      default: return `<ellipse cx="${cx}" cy="${f(cy)}" rx="${rx}" ry="${ry}" ${st}/>`;
    }
  }
  /** Segmentos de un cuerpo largo (serpiente, gusano, dragón), detrás del cuerpo. */
  function segments({ cx, cy, rx, ry }, fill, c2, dk) {
    return [[0.95, 0.62, 0.15], [1.5, 0.42, 0.35]].map(([ox, r, oy]) =>
      `<ellipse cx="${f(cx + rx * ox)}" cy="${f(cy + ry * oy)}" rx="${f(ry * r * 1.1)}" ry="${f(ry * r)}" fill="${fill}" stroke="${dk}" stroke-width="2"/>` +
      `<ellipse cx="${f(cx + rx * ox - 2)}" cy="${f(cy + ry * oy + ry * r * 0.35)}" rx="${f(ry * r * 0.6)}" ry="${f(ry * r * 0.35)}" fill="${c2}" opacity=".7"/>`).join('');
  }
  /** Patas: pies (por defecto), ninguna, cuatro o de ave. */
  function legs(kind, { cx, cy, rx, ry }, dk, c2) {
    const y = cy + ry;
    switch (kind) {
      case 'none': return '';
      case 'quad': return [-0.72, -0.3, 0.22, 0.62].map((o, i) => `<rect x="${f(cx + rx * o - 4.5)}" y="${f(y - ry * 0.35)}" width="9" height="${f(ry * 0.35 + 9)}" rx="4" fill="${i % 2 ? shade(dk, 0.15) : dk}"/>`).join('');
      case 'tall': return [-0.32, 0.18].map((o) => { const x = cx + rx * o; return `<path d="M ${f(x)} ${f(y - 4)} L ${f(x)} ${f(y + 9)} M ${f(x - 5)} ${f(y + 10)} L ${f(x + 4)} ${f(y + 10)}" stroke="${c2 === '#fff' ? '#f59e0b' : '#f59e0b'}" stroke-width="3.5" stroke-linecap="round"/>`; }).join('');
      default: return `<ellipse cx="${f(cx - rx * 0.5)}" cy="${f(y - 2)}" rx="7.5" ry="5" fill="${dk}"/><ellipse cx="${f(cx + rx * 0.38)}" cy="${f(y - 2)}" rx="7.5" ry="5" fill="${dk}"/>`;
    }
  }
  /** Añadidos detrás del cuerpo. */
  const EXTRA_BACK = {
    mane: ({ cx, cy, t, rx, ry, c2, dk }) => {
      const hx = cx - rx * 0.2, hy = cy - ry * 0.15, R = Math.max(rx, ry) * 1.02;
      return Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.95 + i * 0.13); const x = hx + Math.cos(a) * R, y = hy + Math.sin(a) * R; const a1 = a - 0.18, a2 = a + 0.18, r2 = R * 0.72;
        return `<polygon points="${f(hx + Math.cos(a1) * r2)},${f(hy + Math.sin(a1) * r2)} ${f(x + Math.cos(a) * 9)},${f(y + Math.sin(a) * 9)} ${f(hx + Math.cos(a2) * r2)},${f(hy + Math.sin(a2) * r2)}" fill="${c2}" stroke="${dk}" stroke-width="1.6" stroke-linejoin="round"/>`; }).join('');
    },
    scarf: () => '',
  };
  /** Añadidos delante del cuerpo (después del cuerpo, antes de los ojos). */
  const EXTRA_MID = {
    shell: ({ cx, cy, rx, ry, c2, dk }) => {
      const sx = cx + rx * 0.28, sy = cy - ry * 0.28, srx = rx * 0.78, sry = ry * 0.72;
      return `<path d="M ${f(sx - srx)} ${f(sy + sry * 0.55)} A ${f(srx)} ${f(sry)} 0 0 1 ${f(sx + srx)} ${f(sy + sry * 0.55)} Z" fill="${c2}" stroke="${dk}" stroke-width="2.2"/>` +
        `<path d="M ${f(sx - srx * 0.5)} ${f(sy + sry * 0.5)} L ${f(sx - srx * 0.3)} ${f(sy - sry * 0.2)} L ${f(sx + srx * 0.3)} ${f(sy - sry * 0.2)} L ${f(sx + srx * 0.5)} ${f(sy + sry * 0.5)} M ${f(sx - srx * 0.3)} ${f(sy - sry * 0.2)} L ${f(sx - srx * 0.1)} ${f(sy - sry * 0.85)} M ${f(sx + srx * 0.3)} ${f(sy - sry * 0.2)} L ${f(sx + srx * 0.25)} ${f(sy - sry * 0.8)}" stroke="${dk}" stroke-width="1.6" fill="none" opacity=".55"/>`;
    },
    cap: ({ cx, cy, t, rx, ry, c2, dk }) => {
      const y0 = cy - ry * 0.48;
      return `<path d="M ${f(cx - rx * 1.25)} ${f(y0)} Q ${f(cx - rx * 1.1)} ${f(t - ry * 0.55)} ${f(cx)} ${f(t - ry * 0.5)} Q ${f(cx + rx * 1.1)} ${f(t - ry * 0.55)} ${f(cx + rx * 1.25)} ${f(y0)} Q ${f(cx)} ${f(y0 + 7)} ${f(cx - rx * 1.25)} ${f(y0)} Z" fill="${c2}" stroke="${dk}" stroke-width="2.2"/>` +
        [[-0.6, -0.25, 4.5], [0.1, -0.55, 5.5], [0.7, -0.2, 4]].map(([ox, oy, r]) => `<circle cx="${f(cx + rx * ox)}" cy="${f(y0 + ry * oy)}" r="${r}" fill="#fff" opacity=".85"/>`).join('');
    },
    arms: ({ cx, cy, rx, ry, c1, dk }) =>
      `<ellipse cx="${f(cx - rx * 0.92)}" cy="${f(cy + ry * 0.22)}" rx="6" ry="9" transform="rotate(25 ${f(cx - rx * 0.92)} ${f(cy + ry * 0.22)})" fill="${shade(c1, -0.12)}" stroke="${dk}" stroke-width="2"/>`,
    claws: ({ cx, cy, rx, ry, c2, dk }) => [[-1.02, 0.05], [0.95, 0.1]].map(([ox, oy]) => {
      const x = cx + rx * ox, y = cy + ry * oy;
      return `<path d="M ${f(x)} ${f(y + 6)} Q ${f(x - 12)} ${f(y - 2)} ${f(x - 4)} ${f(y - 12)} L ${f(x - 1)} ${f(y - 4)} L ${f(x + 6)} ${f(y - 11)} Q ${f(x + 10)} ${f(y + 2)} ${f(x)} ${f(y + 6)} Z" fill="${c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`;
    }).join(''),
    scarf: ({ cx, cy, rx, ry }) =>
      `<path d="M ${f(cx - rx * 0.85)} ${f(cy + ry * 0.05)} Q ${f(cx - rx * 0.1)} ${f(cy + ry * 0.32)} ${f(cx + rx * 0.75)} ${f(cy + ry * 0.02)} L ${f(cx + rx * 0.72)} ${f(cy + ry * 0.24)} Q ${f(cx - rx * 0.1)} ${f(cy + ry * 0.55)} ${f(cx - rx * 0.85)} ${f(cy + ry * 0.25)} Z" fill="#dc2626" stroke="#450a0a" stroke-width="1.6"/>` +
      `<path d="M ${f(cx + rx * 0.55)} ${f(cy + ry * 0.2)} l 10 16 l -9 2 z" fill="#b91c1c" stroke="#450a0a" stroke-width="1.4"/>`,
  };
  /** Añadidos de la cara (encima de todo). */
  const EXTRA_FRONT = {
    beak: ({ mx, my }) => `<polygon points="${f(mx + 2)},${f(my - 4)} ${f(mx - 12)},${f(my + 1)} ${f(mx + 2)},${f(my + 5)}" fill="#f59e0b" stroke="#7c2d12" stroke-width="1.6" stroke-linejoin="round"/>`,
    horn: ({ cx, t, rx, c2, dk }) => `<polygon points="${f(cx - rx * 0.32)},${f(t + 7)} ${f(cx - rx * 0.2)},${f(t - 18)} ${f(cx - rx * 0.02)},${f(t + 7)}" fill="${c2 === '#fff' ? '#fde68a' : c2}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>`,
    whiskers: ({ cx, cy, rx, ry, dk }) => [[-1, -0.06], [-1, 0.08], [1, -0.08], [1, 0.06]].map(([s2, oy]) => {
      const x = s2 < 0 ? cx - rx * 0.62 : cx + rx * 0.22; return `<path d="M ${f(x)} ${f(cy + ry * oy)} l ${f(s2 * 13)} ${f(oy * 30)}" stroke="${dk}" stroke-width="1.4" opacity=".7"/>`; }).join(''),
    fangs: ({ mx, my }) => `<polygon points="${f(mx - 4)},${f(my + 1)} ${f(mx - 2.5)},${f(my + 6)} ${f(mx - 1)},${f(my + 1)}" fill="#fff"/><polygon points="${f(mx + 1)},${f(my + 1)} ${f(mx + 2.5)},${f(my + 6)} ${f(mx + 4)},${f(my + 1)}" fill="#fff"/>`,
    crown: ({ cx, t, rx }) => { const x = cx - rx * 0.2, y = t - 2; return `<path d="M ${f(x - 12)} ${f(y + 4)} L ${f(x - 12)} ${f(y - 8)} L ${f(x - 6)} ${f(y - 2)} L ${f(x)} ${f(y - 12)} L ${f(x + 6)} ${f(y - 2)} L ${f(x + 12)} ${f(y - 8)} L ${f(x + 12)} ${f(y + 4)} Z" fill="#facc15" stroke="#713f12" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${f(x)}" cy="${f(y - 1)}" r="2.4" fill="#ef4444"/>`; },
  };

  let seq = 0;
  /**
   * Genera el SVG de una especie.
   * @param {Object} sp            especie (DK.data.species[id])
   * @param {Object} [o]
   * @param {boolean} [o.flip]     mirar a la derecha (aliado en combate)
   * @param {boolean} [o.shiny]    colores variocolor
   */
  function svg(sp, { flip = false, shiny = false } = {}) {
    let s = sp.sprite || {};
    if (shiny && !s.img) s = Object.assign({}, s, { c1: hueShift(s.c1 || '#94a3b8', 150), c2: hueShift(s.c2 || '#e2e8f0', 150) });
    if (s.img) return `<img src="${s.img}" alt="${sp.name}" style="width:100%;height:100%;object-fit:contain;${flip ? 'transform:scaleX(-1)' : ''}">`;
    const id = 'dkg' + ++seq;
    const c1 = s.c1 || '#94a3b8', c2 = s.c2 || '#e2e8f0';
    const dk = shade(c1, -0.5), light = shade(c1, 0.4);
    const rx = s.rx || 30, ry = s.ry || 27;
    const kind = s.body || 'round', legKind = s.legs || (kind === 'ghost' ? 'none' : 'feet'), extra = s.extra || [];
    // Cuerpos largos se desplazan a la izquierda (los segmentos van detrás); con patas largas o
    // cuatro patas se levantan; los fantasmas flotan.
    const cx = kind === 'long' ? 52 : 60;
    const lift = legKind === 'quad' ? 7 : legKind === 'tall' ? 10 : legKind === 'none' ? 6 : 0;
    const cy = 98 - ry - lift, t = cy - ry;
    const P = { cx, cy, t, rx, ry, c1, c2, dk, x: cx + rx * (kind === 'long' ? 1.7 : 0.82), y: cy + ry * (kind === 'long' ? 0.4 : 0.15) };
    const mouthX = cx - rx * 0.22, mouthY = cy - ry * 0.02;
    P.mx = mouthX; P.my = mouthY;
    const back = (TAILS[s.tail] || TAILS.none)(P) + (s.wings ? WINGS(P) : '') + (EARS[s.ears] || EARS.none)(P) +
      extra.map((k) => (EXTRA_BACK[k] ? EXTRA_BACK[k](P) : '')).join('') + (kind === 'long' ? segments(P, `url(#${id})`, c2, dk) : '');
    const body = bodyShape(kind, P, `url(#${id})`, dk);
    const belly = kind === 'ghost' ? '' : `<ellipse cx="${cx - 4}" cy="${f(cy + ry * 0.32)}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.48)}" fill="${c2}" opacity=".8"/>`;
    const feet = legs(legKind, P, dk, c2);
    const mid = extra.map((k) => (EXTRA_MID[k] ? EXTRA_MID[k](P) : '')).join('');
    const beak = extra.includes('beak');
    const mouth = s.eyes === 'glow' || beak ? '' : `<path d="M ${f(mouthX - 4)} ${f(mouthY)} Q ${f(mouthX - 2)} ${f(mouthY + 3.5)} ${f(mouthX)} ${f(mouthY)} Q ${f(mouthX + 2)} ${f(mouthY + 3.5)} ${f(mouthX + 4)} ${f(mouthY)}" stroke="${dk}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    const cheeks = s.eyes === 'glow' || kind === 'block' ? '' : `<circle cx="${f(cx - rx * 0.66)}" cy="${f(cy + 1)}" r="4" fill="#ff6b9a" opacity=".35"/><circle cx="${f(cx + rx * 0.26)}" cy="${f(cy)}" r="4" fill="#ff6b9a" opacity=".3"/>`;
    const front = mark(s, P) + eyes(s, P) + mouth + cheeks + extra.map((k) => (EXTRA_FRONT[k] ? EXTRA_FRONT[k](P) : '')).join('');
    return `<svg viewBox="4 -6 112 116" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name}">` +
      `<defs><radialGradient id="${id}" cx="35%" cy="28%" r="80%"><stop offset="0%" stop-color="${light}"/><stop offset="55%" stop-color="${c1}"/><stop offset="100%" stop-color="${shade(c1, -0.28)}"/></radialGradient></defs>` +
      `<ellipse class="sprite-shadow" cx="60" cy="104" rx="${f(rx * (legKind === 'none' ? 0.7 : 0.95))}" ry="6" fill="#000" opacity="${legKind === 'none' ? '.12' : '.2'}"/>` +
      `<g ${flip ? 'transform="translate(120 0) scale(-1 1)"' : ''}><g class="sprite-body">${back}${feet}${body}${belly}${mid}${front}</g></g>` +
      (shiny ? '<g class="shiny-sparkles" fill="#fff8b0"><path d="M18 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M100 8l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z"/><path d="M104 70l1.2 3.6 3.6 1.2-3.6 1.2-1.2 3.6-1.2-3.6-3.6-1.2 3.6-1.2z"/></g>' : '') + '</svg>';
  }

  /* ======================= PIXEL ART =======================
   * Convierte el SVG de una especie en pixel art: lo dibuja en un lienzo
   * pequeño (PIX_W×PIX_H), endurece los bordes (sin semitransparencias),
   * reduce los colores por canal y añade un contorno oscuro de 1 píxel.
   * El resultado (PNG) se guarda en caché por especie y variocolor; la
   * pantalla lo amplía con `image-rendering: pixelated`.
   *
   *   DK.sprites.pixel(especie, { shiny }) → Promise<dataURL>
   *   DK.sprites.pixelCached(especie, { shiny }) → dataURL | null
   */
  const PIX_W = 64, PIX_H = 66, LEVELS = 8;
  const cache = new Map();
  const pending = new Map();
  const keyOf = (sp, shiny) => sp.id + (shiny ? '*' : '');
  function pixelCached(sp, { shiny = false } = {}) { return cache.get(keyOf(sp, shiny)) || null; }
  function pixel(sp, { shiny = false } = {}) {
    const key = keyOf(sp, shiny);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    if (sp.sprite && sp.sprite.img) return Promise.resolve(null);
    const text = svg(sp, { shiny }).replace('<svg ', `<svg width="${PIX_W}" height="${PIX_H}" `);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = PIX_W; c.height = PIX_H;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, PIX_W, PIX_H);
          const data = ctx.getImageData(0, 0, PIX_W, PIX_H), px = data.data;
          const step = 255 / (LEVELS - 1);
          const solid = new Uint8Array(PIX_W * PIX_H);
          for (let i = 0; i < px.length; i += 4) {
            const a = px[i + 3], dark = px[i] + px[i + 1] + px[i + 2] < 90;
            if (a >= 120) {
              for (let k = 0; k < 3; k++) px[i + k] = Math.round(Math.round(px[i + k] / step) * step);
              px[i + 3] = 255; solid[i / 4] = 1;
            } else if (a >= 25 && dark) { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 70; } // sombra
            else px[i + 3] = 0;
          }
          // Contorno: píxeles vacíos que tocan un píxel del cuerpo
          for (let y = 0; y < PIX_H; y++) for (let x = 0; x < PIX_W; x++) {
            const j = y * PIX_W + x; if (solid[j]) continue;
            const n = (x > 0 && solid[j - 1]) || (x < PIX_W - 1 && solid[j + 1]) || (y > 0 && solid[j - PIX_W]) || (y < PIX_H - 1 && solid[j + PIX_W]);
            if (n) { const i = j * 4; px[i] = 12; px[i + 1] = 9; px[i + 2] = 22; px[i + 3] = 255; }
          }
          ctx.putImageData(data, 0, 0);
          const url = c.toDataURL('image/png');
          cache.set(key, url); resolve(url);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    }).finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
  }

  DK.sprites = { svg, shade, hueShift, pixel, pixelCached };
})();
