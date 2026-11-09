/* =============================================================
 * components/nodeArt.js — v5.7: iconos de los pisos del mapa con volumen,
 * estilo rol clásico (metal, madera, hueso, llamas…), con contorno oscuro.
 *
 *   DK.nodeArt(type)  → <span class="node-art"> con el SVG (32×32)
 * Los degradados se comparten (un único <svg> de definiciones en el documento).
 * ============================================================= */
(function () {
  const O = 'stroke="#1a0f08" stroke-width="1.3" stroke-linejoin="round"';
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="na-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset=".45" stop-color="#cbd5e1"/><stop offset="1" stop-color="#64748b"/></linearGradient>
    <linearGradient id="na-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f6c343"/><stop offset="1" stop-color="#a1620b"/></linearGradient>
    <linearGradient id="na-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c08552"/><stop offset="1" stop-color="#6b3a1c"/></linearGradient>
    <linearGradient id="na-bone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbeb"/><stop offset=".6" stop-color="#e7dcc0"/><stop offset="1" stop-color="#a8977a"/></linearGradient>
    <linearGradient id="na-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b91c1c"/><stop offset=".5" stop-color="#f97316"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
    <linearGradient id="na-crystal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset=".5" stop-color="#38bdf8"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
    <linearGradient id="na-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5d0fe"/><stop offset=".5" stop-color="#a855f7"/><stop offset="1" stop-color="#4c1d95"/></linearGradient>
    <linearGradient id="na-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f99d"/><stop offset="1" stop-color="#4d7c0f"/></linearGradient>
    <linearGradient id="na-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8a29e"/><stop offset="1" stop-color="#44403c"/></linearGradient>
    <linearGradient id="na-cloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6a46b"/><stop offset="1" stop-color="#7a4a22"/></linearGradient>
    <radialGradient id="na-ruby" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fecaca"/><stop offset=".4" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></radialGradient>
  </defs></svg>`;
  const shine = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1" stroke-linecap="round"/>`;
  const ART = {
    fight: `<path d="M5 4 L8 4 L20 16 L18 18 L6 7 Z" fill="url(#na-steel)" ${O}/><path d="M27 4 L24 4 L12 16 L14 18 L26 7 Z" fill="url(#na-steel)" ${O}/>
      <path d="M15 19 L20 14 L22 16 L17 21 Z" fill="url(#na-gold)" ${O}/><path d="M17 19 L12 14 L10 16 L15 21 Z" fill="url(#na-gold)" ${O}/>
      <path d="M19 20 L23 24 L21 26 L17 22 Z" fill="url(#na-wood)" ${O}/><path d="M13 20 L9 24 L11 26 L15 22 Z" fill="url(#na-wood)" ${O}/>
      <circle cx="23.5" cy="26.5" r="2" fill="url(#na-gold)" ${O}/><circle cx="8.5" cy="26.5" r="2" fill="url(#na-gold)" ${O}/>${shine('M7 6 L17 15')}`,
    elite: `<path d="M7 9 Q3 4 4 1 Q8 4 10 8 Z" fill="url(#na-bone)" ${O}/><path d="M25 9 Q29 4 28 1 Q24 4 22 8 Z" fill="url(#na-bone)" ${O}/>
      <path d="M16 5 C8 5 6 11 6 15 C6 19 9 20 10 21 L10 26 L22 26 L22 21 C23 20 26 19 26 15 C26 11 24 5 16 5 Z" fill="url(#na-bone)" ${O}/>
      <ellipse cx="12" cy="15" rx="3" ry="3.3" fill="#2a0a0a"/><ellipse cx="20" cy="15" rx="3" ry="3.3" fill="#2a0a0a"/><circle cx="12" cy="15" r="1.2" fill="#ef4444"/><circle cx="20" cy="15" r="1.2" fill="#ef4444"/>
      <path d="M16 18 L14.6 21 L17.4 21 Z" fill="#2a0a0a"/><path d="M12 26 V23 M14.7 26 V23 M17.3 26 V23 M20 26 V23" stroke="#1a0f08" stroke-width="1"/>${shine('M10 8 Q13 6 16 6')}`,
    boss: `<path d="M4 23 L5 9 L11 15 L16 5 L21 15 L27 9 L28 23 Z" fill="url(#na-gold)" ${O}/><rect x="4" y="22" width="24" height="5" rx="1" fill="url(#na-gold)" ${O}/>
      <circle cx="16" cy="16" r="2.6" fill="url(#na-ruby)" ${O}/><circle cx="9.5" cy="24.5" r="1.6" fill="url(#na-ruby)"/><circle cx="16" cy="24.5" r="1.6" fill="#22d3ee" stroke="#1a0f08" stroke-width=".8"/><circle cx="22.5" cy="24.5" r="1.6" fill="url(#na-ruby)"/>
      <circle cx="5" cy="9" r="1.6" fill="url(#na-gold)" ${O}/><circle cx="16" cy="5" r="1.8" fill="url(#na-gold)" ${O}/><circle cx="27" cy="9" r="1.6" fill="url(#na-gold)" ${O}/>${shine('M7 21 L8 13')}`,
    event: `<path d="M9 4 H23 Q26 4 26 7 V25 Q26 28 23 28 H9 Q6 28 6 25 V7 Q6 4 9 4 Z" fill="url(#na-violet)" ${O}/>
      <path d="M12 12 Q12 8 16 8 Q20 8 20 12 Q20 14.5 17.5 15.5 Q16.5 16 16.5 18 V19" fill="none" stroke="#1a0f08" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M12 12 Q12 8 16 8 Q20 8 20 12 Q20 14.5 17.5 15.5 Q16.5 16 16.5 18 V19" fill="none" stroke="#fdf4ff" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="16.5" cy="23.5" r="2" fill="#fdf4ff" ${O}/>${shine('M8 7 V20')}`,
    shop: `<path d="M10 9 Q8 6 11 5 L21 5 Q24 6 22 9 Z" fill="url(#na-cloth)" ${O}/><path d="M10 9 Q4 14 5 21 Q6 28 16 28 Q26 28 27 21 Q28 14 22 9 Z" fill="url(#na-cloth)" ${O}/>
      <path d="M10 9 H22" stroke="#7c2d12" stroke-width="2.2"/><circle cx="16" cy="19" r="5.5" fill="url(#na-gold)" ${O}/><path d="M16 15.8 V22.2 M14 17.3 Q16 16 18 17.3 Q18 19 16 19 Q14 19 14 20.7 Q16 22 18 20.7" fill="none" stroke="#7c4a03" stroke-width="1.2" stroke-linecap="round"/>${shine('M8 15 Q8 20 10 23')}`,
    rest: `<path d="M5 25 L26 20 L27 23 L6 28 Z" fill="url(#na-wood)" ${O}/><path d="M27 25 L6 20 L5 23 L26 28 Z" fill="url(#na-wood)" ${O}/>
      <path d="M16 3 C18 8 23 10 23 16 C23 20 20 23 16 23 C12 23 9 20 9 16 C9 12 12 11 12 7 C14 9 14 11 15 12 C16 9 15 6 16 3 Z" fill="url(#na-fire)" ${O}/>
      <path d="M16 12 C17 15 19 16 19 18.5 C19 20.5 17.5 21.5 16 21.5 C14.5 21.5 13 20.5 13 18.5 C13 17 14.5 16.5 16 12 Z" fill="#fef3c7"/>`,
    treasure: `<path d="M5 14 Q5 7 16 7 Q27 7 27 14 Z" fill="url(#na-wood)" ${O}/><rect x="5" y="14" width="22" height="13" rx="1.5" fill="url(#na-wood)" ${O}/>
      <path d="M5 14 H27" stroke="#1a0f08" stroke-width="1.3"/><rect x="9" y="7.6" width="3" height="19.4" fill="url(#na-gold)" ${O}/><rect x="20" y="7.6" width="3" height="19.4" fill="url(#na-gold)" ${O}/>
      <rect x="13.5" y="12" width="5" height="6" rx="1" fill="url(#na-gold)" ${O}/><circle cx="16" cy="15" r="1" fill="#1a0f08"/>${shine('M7 11 Q10 8.5 15 8.3')}`,
    recruit: `<ellipse cx="16" cy="21" rx="7" ry="6" fill="url(#na-bone)" ${O}/><ellipse cx="8" cy="13.5" rx="2.8" ry="3.4" fill="url(#na-bone)" ${O}/><ellipse cx="13" cy="9" rx="2.8" ry="3.4" fill="url(#na-bone)" ${O}/>
      <ellipse cx="19" cy="9" rx="2.8" ry="3.4" fill="url(#na-bone)" ${O}/><ellipse cx="24" cy="13.5" rx="2.8" ry="3.4" fill="url(#na-bone)" ${O}/><path d="M13 21 Q16 18.5 19 21" fill="none" stroke="#f472b6" stroke-width="1.6" stroke-linecap="round"/>`,
    shrine: `<path d="M16 2 L23 11 L19 27 L13 27 L9 11 Z" fill="url(#na-crystal)" ${O}/><path d="M16 2 L16 27 M9 11 L23 11" stroke="#1e3a8a" stroke-opacity=".55" stroke-width="1"/>
      <path d="M7 27 H25 L23 30 H9 Z" fill="url(#na-stone)" ${O}/>${shine('M14 6 L11.5 11 L14 22')}<circle cx="24" cy="5" r="1.2" fill="#fff"/><circle cx="7" cy="8" r=".9" fill="#fff"/>`,
    cave: `<path d="M2 28 Q3 10 16 6 Q29 10 30 28 Z" fill="url(#na-stone)" ${O}/><path d="M8 28 Q9 15 16 13 Q23 15 24 28 Z" fill="#0b0605" ${O}/>
      <path d="M11 13 L12.5 17 L14 13.5 M18 13.5 L19.5 17 L21 13" fill="url(#na-bone)" stroke="#1a0f08" stroke-width=".8"/><circle cx="14" cy="22" r="1.1" fill="#facc15"/><circle cx="18" cy="22" r="1.1" fill="#facc15"/>${shine('M5 22 Q6 13 13 9')}`,
    shortcut: `<path d="M5 25 Q6 12 19 10 L19 5 L28 13 L19 21 L19 16 Q11 17 9 25 Z" fill="url(#na-gold)" ${O}/>${shine('M8 21 Q10 14 18 12.5')}`,
    aboss: null, // = jefe con corona violeta
    fog: `<circle cx="16" cy="16" r="11" fill="url(#na-stone)" ${O}/><path d="M12 13 Q12 9 16 9 Q20 9 20 13 Q20 15 17.5 16 Q16.5 16.5 16.5 18.5" fill="none" stroke="#e7e5e4" stroke-width="2.4" stroke-linecap="round"/><circle cx="16.5" cy="22.5" r="1.6" fill="#e7e5e4"/>`,
    check: `<path d="M6 17 L13 24 L27 8" fill="none" stroke="#1a0f08" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 17 L13 24 L27 8" fill="none" stroke="#86efac" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  ART.aboss = ART.boss.replace(/na-gold/g, 'na-violet');
  ART.secret = ART.cave;
  function ensureDefs() {
    if (document.getElementById('na-defs')) return;
    const w = document.createElement('div'); w.id = 'na-defs'; w.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; w.innerHTML = DEFS;
    (document.body || document.documentElement).append(w);
  }
  DK.nodeArt = (type) => {
    ensureDefs();
    const s = document.createElement('span'); s.className = 'node-art na-' + type; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<svg viewBox="0 0 32 32" width="100%" height="100%">${ART[type] || ART.event}</svg>`;
    // v5.9: además el icono de línea, plano: es el que se ve en el estilo Limpio (el dibujo, en Exilio y Clásico)
    const T = DK.expedition && DK.expedition.TYPES, line = { fog: 'question', secret: 'cave', check: 'check' }[type] || (T && T[type] && T[type].icon) || 'question';
    const l = document.createElement('span'); l.className = 'node-line'; l.append(DK.icon(line, 24)); s.append(l);
    return s;
  };
  DK.nodeArt.has = (type) => !!ART[type];
})();
