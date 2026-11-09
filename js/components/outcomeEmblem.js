/* =============================================================
 * components/outcomeEmblem.js — v5.12: emblema del resultado de la
 * expedición (copa, bandera, calavera, corona rota, hoguera).
 *
 *   DK.outcomeEmblem(outcome, cls)  → <div class="sum-emblem">
 *
 * Lleva a la vez el dibujo con relieve (Clásico: medalla de colores con
 * cintas; Exilio: placa octogonal con marco de oro) y el icono de línea con
 * laurel (Limpio). El CSS (juice.css, «Emblema del resumen») elige cuál se ve.
 * ============================================================= */
(function () {
  const O = 'stroke="#1a0f08" stroke-width="2" stroke-linejoin="round"';
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="oe-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset=".3" stop-color="#fcd34d"/><stop offset=".62" stop-color="#d4930f"/><stop offset="1" stop-color="#7a4405"/></linearGradient>
    <linearGradient id="oe-goldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f2b92c"/><stop offset="1" stop-color="#8a4f06"/></linearGradient>
    <linearGradient id="oe-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a2a"/><stop offset="1" stop-color="#2a170a"/></linearGradient>
    <linearGradient id="oe-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b3317"/><stop offset=".45" stop-color="#b57a45"/><stop offset="1" stop-color="#5b3317"/></linearGradient>
    <linearGradient id="oe-cloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdba74"/><stop offset=".55" stop-color="#ea7a1a"/><stop offset="1" stop-color="#8a3a0a"/></linearGradient>
    <linearGradient id="oe-bone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf4"/><stop offset=".55" stop-color="#e8dcbc"/><stop offset="1" stop-color="#94825f"/></linearGradient>
    <linearGradient id="oe-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8a29e"/><stop offset="1" stop-color="#3f3a36"/></linearGradient>
    <linearGradient id="oe-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#9f1239"/><stop offset=".45" stop-color="#f97316"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
    <linearGradient id="oe-cursed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9d5ff"/><stop offset=".35" stop-color="#a78bfa"/><stop offset=".7" stop-color="#6d28d9"/><stop offset="1" stop-color="#2e1065"/></linearGradient>
    <radialGradient id="oe-ruby" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fecaca"/><stop offset=".4" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></radialGradient>
    <radialGradient id="oe-sapph" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#cffafe"/><stop offset=".45" stop-color="#22d3ee"/><stop offset="1" stop-color="#155e75"/></radialGradient>
    <radialGradient id="oe-ember" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient>
  </defs></svg>`;
  const shine = (d, w = 1.6) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="${w}" stroke-linecap="round"/>`;
  const spark = (x, y, r, c = '#fff') => `<path class="oe-spark" d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${c}"/>`;
  // Asas en relieve: trazo oscuro grueso + trazo dorado encima
  const handle = (d) => `<path d="${d}" fill="none" stroke="#1a0f08" stroke-width="6.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#oe-goldV)" stroke-width="3.6" stroke-linecap="round"/>`;

  const ART = {
    completed: `${handle('M15 15 Q4 15 6 24 Q8 31 18 31')}${handle('M49 15 Q60 15 58 24 Q56 31 46 31')}
      <path d="M22 55 H42 L44 60 H20 Z" fill="url(#oe-dark)" ${O}/><rect x="24" y="51" width="16" height="5" rx="1.2" fill="url(#oe-gold)" ${O}/>
      <path d="M29 39 H35 L34.4 46 Q38 47 38 51 H26 Q26 47 29.6 46 Z" fill="url(#oe-gold)" ${O}/>
      <path d="M13 9 H51 Q52 31 32 39 Q12 31 13 9 Z" fill="url(#oe-gold)" ${O}/>
      <path d="M17 13 H47 Q46 28 32 34 Q18 28 17 13 Z" fill="#7a4405" fill-opacity=".22"/>
      <ellipse cx="32" cy="9.4" rx="19" ry="3.2" fill="#fff3b0" ${O}/><ellipse cx="32" cy="9.6" rx="15" ry="1.6" fill="#a8640a" fill-opacity=".55"/>
      <path d="M32 15.5 L34.3 20.2 L39.4 20.9 L35.7 24.4 L36.6 29.5 L32 27.1 L27.4 29.5 L28.3 24.4 L24.6 20.9 L29.7 20.2 Z" fill="url(#oe-ruby)" stroke="#1a0f08" stroke-width="1.4" stroke-linejoin="round"/>
      ${shine('M17 13 Q17.5 24 24 30', 2.2)}${shine('M27 44 Q27.6 42 30 41.6', 1.2)}
      ${spark(8, 6, 3.4)}${spark(56, 40, 2.6)}${spark(53, 5, 2)}`,
    retreat: `<path d="M8 58 Q32 50 56 58 Z" fill="url(#oe-stone)" ${O}/>
      <rect x="15" y="8" width="4.4" height="49" rx="1.6" fill="url(#oe-wood)" ${O}/><circle cx="17.2" cy="7" r="3.6" fill="url(#oe-gold)" ${O}/>
      <path d="M19.4 11 Q30 6 40 11 Q47 14 54 11 L49 20 L55 29 Q47 32 40 29 Q30 25 19.4 30 Z" fill="url(#oe-cloth)" ${O}/>
      <path d="M44 29.6 L46 26 L48 30.6 Z" fill="#1a0f08" fill-opacity=".55"/><path d="M27 27 L28.5 24 L30 27.4 Z" fill="#1a0f08" fill-opacity=".45"/>
      <path d="M31 14.5 L35 18.5 L31 22.5 L27 18.5 Z" fill="url(#oe-gold)" stroke="#1a0f08" stroke-width="1.3" stroke-linejoin="round"/>
      ${shine('M21.5 13 Q30 9.2 38 12.6')}${spark(56, 44, 2.2)}`,
    lost: `<path d="M8 50 L56 30 M8 30 L56 50" stroke="#1a0f08" stroke-width="7.6" stroke-linecap="round"/><path d="M8 50 L56 30 M8 30 L56 50" stroke="url(#oe-bone)" stroke-width="4.6" stroke-linecap="round"/>
      <circle cx="7" cy="28.5" r="3.2" fill="url(#oe-bone)" ${O}/><circle cx="7" cy="51.5" r="3.2" fill="url(#oe-bone)" ${O}/><circle cx="57" cy="28.5" r="3.2" fill="url(#oe-bone)" ${O}/><circle cx="57" cy="51.5" r="3.2" fill="url(#oe-bone)" ${O}/>
      <path d="M32 6 C17 6 13 16 13 25 C13 32 17 35 20 37 L20 46 L44 46 L44 37 C47 35 51 32 51 25 C51 16 47 6 32 6 Z" fill="url(#oe-bone)" ${O}/>
      <path d="M33 6.4 L30 13 L34 17 L31.6 22" fill="none" stroke="#1a0f08" stroke-width="1.4" stroke-linejoin="round"/>
      <ellipse cx="24.5" cy="26" rx="5.6" ry="6.2" fill="#1c0707"/><ellipse cx="39.5" cy="26" rx="5.6" ry="6.2" fill="#1c0707"/>
      <circle class="oe-eye" cx="24.5" cy="26.6" r="2" fill="#ef4444"/><circle class="oe-eye" cx="39.5" cy="26.6" r="2" fill="#ef4444"/>
      <path d="M32 31.5 L29.4 37 L34.6 37 Z" fill="#1c0707"/><path d="M24.6 46 V41.4 M29.6 46 V41 M34.4 46 V41 M39.4 46 V41.4" stroke="#1a0f08" stroke-width="1.6"/>
      ${shine('M18 16 Q22 9.6 30 8.6', 2)}`,
    lostBoss: `<g transform="rotate(-12 32 34)">
      <path d="M9 44 L11 17 L21 28 L32 11 L43 28 L53 17 L55 44 Z" fill="url(#oe-cursed)" ${O}/>
      <rect x="9" y="43" width="46" height="9" rx="2" fill="url(#oe-cursed)" ${O}/>
      <circle cx="11" cy="16" r="3" fill="url(#oe-cursed)" ${O}/><circle cx="32" cy="10" r="3.4" fill="url(#oe-cursed)" ${O}/><circle cx="53" cy="16" r="3" fill="url(#oe-cursed)" ${O}/>
      <circle cx="32" cy="31" r="4.6" fill="url(#oe-ruby)" ${O}/><circle cx="19" cy="47.5" r="2.6" fill="url(#oe-sapph)" stroke="#1a0f08" stroke-width="1.2"/><circle cx="45" cy="47.5" r="2.6" fill="url(#oe-sapph)" stroke="#1a0f08" stroke-width="1.2"/>
      <path d="M36 11 L33 22 L38 27 L34 37 L37 44 L33.6 52" fill="none" stroke="#12051f" stroke-width="2.2" stroke-linejoin="round"/>
      ${shine('M14 40 L15 24', 2)}</g>
      <circle cx="32" cy="58" r="2.6" fill="url(#oe-ruby)" ${O}/><path d="M48 55 L51 52 L54 56 Z" fill="url(#oe-cursed)" stroke="#1a0f08" stroke-width="1.2"/>`,
    campfire: `<ellipse cx="32" cy="56" rx="24" ry="5" fill="#1a0f08" fill-opacity=".35"/>
      <path d="M8 52 L54 41 L56 47 L10 58 Z" fill="url(#oe-wood)" ${O}/><path d="M56 52 L10 41 L8 47 L54 58 Z" fill="url(#oe-wood)" ${O}/>
      <circle cx="9" cy="44" r="3" fill="#7a4a22" ${O}/><circle cx="55" cy="44" r="3" fill="#7a4a22" ${O}/>
      <g class="oe-flame"><path d="M32 4 C36 14 46 18 46 31 C46 40 40 46 32 46 C24 46 18 40 18 31 C18 23 24 21 24 13 C28 17 28 21 30 23 C32 17 30 11 32 4 Z" fill="url(#oe-fire)" ${O}/>
      <path d="M32 21 C34 27 39 29 39 35 C39 40 35.6 42.4 32 42.4 C28.4 42.4 25 40 25 35 C25 31 28.6 29.6 32 21 Z" fill="#fde68a"/>
      <path d="M32 31 C33 34 35 35 35 37.6 C35 39.4 33.6 40.4 32 40.4 C30.4 40.4 29 39.4 29 37.6 C29 35.6 30.6 34.6 32 31 Z" fill="#fff"/></g>
      <circle class="oe-spark" cx="16" cy="12" r="1.6" fill="#fdba74"/><circle class="oe-spark" cx="49" cy="8" r="1.3" fill="#fde68a"/><circle class="oe-spark" cx="44" cy="2.6" r="1" fill="#fdba74"/>`,
  };
  const LINE = { completed: 'trophy', retreat: 'flag', lost: 'skull', lostBoss: 'crown', campfire: 'campfire' };

  // Laurel del estilo Limpio: dos ramas de hojas finas a lo largo de un arco
  function laurel() {
    // Rama izquierda a lo largo de un arco (centro 50,52; r 42) de abajo (≈215°) hacia arriba (≈100°);
    // la derecha es su espejo. En cada nudo, dos hojas (una hacia fuera y otra hacia dentro).
    const R = 42, cx = 50, cy = 52, pt = (deg) => [cx + Math.cos(deg * Math.PI / 180) * R, cy - Math.sin(deg * Math.PI / 180) * R];
    let left = '';
    const N = 7;
    for (let i = 0; i < N; i++) {
      const d0 = 212 - i * 16, [x, y] = pt(d0), [x2, y2] = pt(d0 - 4);
      const dir = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI, size = 1 - i * 0.07;
      for (const k of [-1, 1]) {
        const rot = dir + k * 38, off = 4.2 * size, ox = x + Math.cos(rot * Math.PI / 180) * off, oy = y + Math.sin(rot * Math.PI / 180) * off;
        left += `<ellipse cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" rx="${(5.4 * size).toFixed(1)}" ry="${(2.2 * size).toFixed(1)}" transform="rotate(${rot.toFixed(0)} ${ox.toFixed(1)} ${oy.toFixed(1)})"/>`;
      }
    }
    const [sx, sy] = pt(222), [ex, ey] = pt(104);
    const stem = `M${sx.toFixed(1)} ${sy.toFixed(1)} A${R} ${R} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    return `<svg class="oe-laurel" viewBox="0 0 100 100" aria-hidden="true">
      <g><path class="oe-stem" d="${stem}" fill="none"/><g class="oe-leaves">${left}</g></g>
      <g transform="translate(100 0) scale(-1 1)"><path class="oe-stem" d="${stem}" fill="none"/><g class="oe-leaves">${left}</g></g>
      <path class="oe-knot" d="M43 89 L50 85.5 L57 89 L50 92.5 Z"/>
      <circle class="oe-ring" cx="50" cy="50" r="31"/></svg>`;
  }

  function ensureDefs() {
    if (document.getElementById('oe-defs')) return;
    const w = document.createElement('div'); w.id = 'oe-defs'; w.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; w.innerHTML = DEFS;
    (document.body || document.documentElement).append(w);
  }

  DK.outcomeEmblem = (outcome, cls) => {
    ensureDefs();
    const key = ART[outcome] ? outcome : 'retreat';
    const el = document.createElement('div');
    el.className = `sum-emblem oe-${cls || 'warn'} oe-${key}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span class="oe-rays"></span>${laurel()}<span class="oe-plate"><svg class="oe-art" viewBox="0 0 64 64">${ART[key]}</svg><span class="oe-line"></span></span><span class="oe-ribbon"></span>`;
    el.querySelector('.oe-line').append(DK.icon(LINE[key], 34));
    return el;
  };
})();
