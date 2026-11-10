/* =============================================================
 * components/shareCard.js — Tarjeta del perfil para compartir (v5.20: personalizable).
 *
 *   DK.shareCard.render(opts?) → Promise<HTMLCanvasElement> (1200 × 630 px)
 *   DK.shareCard.open()        → ventana con la vista previa y Descargar · Copiar · Compartir
 *   DK.shareCard.options()     → opciones guardadas (player.card) con sus valores por defecto
 *   DK.shareCard.THEMES / PATTERNS / BORDERS / STATS / SHOW → catálogos para el editor del perfil
 *
 * Diseño en dos columnas:
 *   izquierda  → foto con su marco + vitrina (daskai favorito o el equipo)
 *   derecha    → título, nombre, una línea de datos, 6 estadísticas con icono y victorias por casa
 * Opciones (st.player.card): theme, pattern, border, stats (hasta 6 ids de STATS), show, houses.
 * Los daskai salen como en el juego (DK.looks.image: pixel art o no). Textos en lang → share.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const W = 1200, H = 630;
  const FONT = "'Outfit', system-ui, sans-serif";
  const lang = () => DK.i18n.lang;
  const fmt = (n) => Math.round(n || 0).toLocaleString(lang());

  /* ---------- catálogos ---------- */
  /** Temas: fondo [arriba, abajo], brillo, acento [a, b], texto, texto suave, cajas. `light` = texto oscuro. */
  const THEMES = {
    night: { bg: ['#0b0d1a', '#1d1a45'], glow: 'rgba(109,93,252,.45)', accent: ['#8f84ff', '#22d3ee'] },
    ember: { bg: ['#1a0a05', '#4a1206'], glow: 'rgba(249,115,22,.45)', accent: ['#fdba74', '#ef4444'] },
    forest: { bg: ['#06140c', '#123d24'], glow: 'rgba(74,222,128,.35)', accent: ['#86efac', '#facc15'] },
    ocean: { bg: ['#03131f', '#0c3a5c'], glow: 'rgba(56,189,248,.4)', accent: ['#7dd3fc', '#a78bfa'] },
    royal: { bg: ['#140a1f', '#3b1260'], glow: 'rgba(232,121,249,.38)', accent: ['#f0abfc', '#fde68a'] },
    blood: { bg: ['#0b0807', '#3a0d0b'], glow: 'rgba(179,38,30,.45)', accent: ['#e7c27a', '#e0573f'] },
    gold: { bg: ['#140f05', '#3d2c0a'], glow: 'rgba(250,204,21,.35)', accent: ['#fde68a', '#f59e0b'] },
    parchment: { bg: ['#f6efe0', '#e3d3b2'], glow: 'rgba(180,120,40,.25)', accent: ['#9b1c1c', '#8a5a12'], light: true },
    house: { house: true, accent: ['#ffffff', '#e5e7eb'] }, // colores de la casa de tu líder
  };
  const PATTERNS = ['none', 'dots', 'grid', 'diag', 'stars', 'waves'];
  const BORDERS = ['none', 'line', 'double', 'gold', 'pixel'];
  const SHOW = ['favorite', 'team', 'none'];
  /** Estadísticas que se pueden poner (icono + valor). */
  const STATS = {
    battles: ['swords', (s) => fmt(s.battles)],
    winRate: ['trophy', (s) => { const d = s.wins + s.losses; return (d ? Math.round((s.wins / d) * 100) : 0) + '%'; }],
    bestStreak: ['flame', (s) => fmt(s.bestStreak)],
    captures: ['orb', (s) => fmt(s.captures)],
    achievements: ['award', () => `${DK.achievements.unlockedCount()}/${D.achievements.length}`],
    playTime: ['clock', (s) => DK.util.duration(s.playTime)],
    expeditions: ['compass', (s) => fmt(s.expeditions)],
    bosses: ['crown', (s) => fmt(s.bossesDefeated)],
    bestDepth: ['mountain', (s) => (s.bestDepth ? String(s.bestDepth) : '—')],
    species: ['book', () => `${DK.avatars.knownSpecies().length}/${Object.keys(D.species).length}`],
    biggestHit: ['bolt', (s) => fmt(s.biggestHit)],
    shinies: ['sparkles', (s) => fmt(s.shinies)],
    evolutions: ['evolve', (s) => fmt(s.evolutions)],
    crits: ['target', (s) => fmt(s.crits)],
  };
  const DEFAULTS = { theme: 'night', pattern: 'none', border: 'line', stats: ['battles', 'winRate', 'bestStreak', 'captures', 'achievements', 'playTime'], show: 'favorite', houses: true };

  function options() {
    const p = DK.store.state.player;
    const o = Object.assign({}, DEFAULTS, p.card || {});
    if (!THEMES[o.theme]) o.theme = DEFAULTS.theme;
    o.stats = (o.stats || []).filter((k) => STATS[k]).slice(0, 6);
    if (!o.stats.length) o.stats = DEFAULTS.stats.slice();
    return o;
  }
  /** Colores del tema ya resueltos (el de casa usa la del líder). */
  function themeOf(id) {
    const th = THEMES[id] || THEMES.night;
    if (!th.house) return th;
    const lead = DK.party.leader() || DK.party.all()[0];
    const c = lead ? D.houseColor(DK.daskai.species(lead).house) : '#6d5dfc';
    return { bg: ['#0b0d1a', mix(c, '#0b0d1a', 0.45)], glow: hexA(c, 0.45), accent: [mix(c, '#ffffff', 0.55), '#ffffff'] };
  }
  const rgb = (hx) => { const n = parseInt(String(hx).replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, f) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v * f + B[i] * (1 - f)).toString(16).padStart(2, '0')).join(''); };
  const hexA = (hx, a) => { const [r, g, b] = rgb(hx); return `rgba(${r},${g},${b},${a})`; };

  /* ---------- utilidades de dibujo ---------- */
  function svgImage(svg) {
    return new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  }
  function urlImage(src) {
    return new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; });
  }
  /** SVG de un icono en color sólido. */
  function iconSvg(name, color) {
    const el = DK.icon(name, 24).querySelector('svg');
    if (!el) return null;
    return el.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/currentColor/g, color);
  }
  async function drawIcon(ctx, name, color, x, y, size) {
    const svg = iconSvg(name, color); const img = svg && await svgImage(svg);
    if (img) ctx.drawImage(img, x, y, size, size);
  }
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** Recorta el texto con «…» para que quepa en `max` px. */
  function fit(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let s = text; while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }
  /** Fondo de un color de icono (liso o degradado 'g:#a,#b'). */
  function iconFill(ctx, c, x, y, w, hh) {
    if (!String(c).startsWith('g:')) return c;
    const [a, b] = c.slice(2).split(','); const g = ctx.createLinearGradient(x, y, x + w, y + hh);
    g.addColorStop(0, a); g.addColorStop(1, b); return g;
  }

  /** Dibuja la foto de perfil (círculo de radio r en cx, cy) con su marco. */
  async function drawAvatar(ctx, p, cx, cy, r) {
    ctx.save();
    const f = DK.avatars.frame(p.frame);
    if (f.glow) { ctx.shadowColor = 'rgba(250,204,21,.45)'; ctx.shadowBlur = 30; }
    ctx.beginPath(); ctx.arc(cx, cy, r + 12, 0, Math.PI * 2); ctx.fillStyle = DK.avatars.canvasFill(ctx, f.paint, cx, cy, r + 12); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const av = p.avatar;
    if (av && av.kind === 'image') {
      const img = await urlImage(av.src);
      if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else if (av && av.kind === 'icon') {
      ctx.fillStyle = iconFill(ctx, av.color, cx - r, cy - r, r * 2, r * 2); ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      await drawIcon(ctx, av.icon, '#ffffff', cx - r * 0.5, cy - r * 0.5, r);
    } else {
      // el mismo daskai que la foto del perfil (el líder tal cual o la especie elegida), con el estilo de la partida
      const who = DK.avatars.subject(av);
      const col = who ? D.houseColor(D.species[who.species].house) : '#6d5dfc';
      const g = ctx.createRadialGradient(cx, cy + r * 0.4, 0, cx, cy, r * 1.2);
      g.addColorStop(0, col + 'aa'); g.addColorStop(1, '#1d2240');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (who && who.look && who.look.h2 && D.houses[who.look.h2]) {
        const g2 = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
        g2.addColorStop(0.35, D.houseColor(who.look.h2) + '00'); g2.addColorStop(1, D.houseColor(who.look.h2) + '88');
        ctx.fillStyle = g2; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.imageSmoothingEnabled = DK.settings.get('pixelArt') === false; // pixel art nítido
      if (who) DK.looks.paint(ctx, await DK.looks.image(who.species, who.look, { shiny: who.shiny }), cx - r * 0.62, cy - r * 0.6, r * 1.24, r * 1.24);
    }
    ctx.restore();
  }

  /** Dibujo de fondo (patrón) con el color de texto muy suave. */
  function drawPattern(ctx, id, col) {
    if (id === 'none') return;
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    if (id === 'dots') for (let y = 30; y < H; y += 34) for (let x = 30 + ((y / 34) % 2) * 17; x < W; x += 34) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    if (id === 'grid') { for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
    if (id === 'diag') for (let x = -H; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
    if (id === 'stars') { let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280); for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, k = 1 + r() * 3; ctx.globalAlpha = 0.4 + r() * 0.6; ctx.fillRect(x - k / 2, y - k / 2, k, k); if (k > 3) { ctx.fillRect(x - k * 1.5, y - 0.5, k * 3, 1); ctx.fillRect(x - 0.5, y - k * 1.5, 1, k * 3); } } }
    if (id === 'waves') for (let y = 40; y < H; y += 46) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y + Math.sin(x / 45 + y) * 7); ctx.stroke(); }
    ctx.restore();
  }
  function drawBorder(ctx, id, th) {
    ctx.save();
    const line = th.light ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.1)';
    if (id === 'line') { ctx.strokeStyle = line; ctx.lineWidth = 2; roundRect(ctx, 20, 20, W - 40, H - 40, 28); ctx.stroke(); }
    if (id === 'double') { ctx.strokeStyle = th.accent[0]; ctx.globalAlpha = 0.55; ctx.lineWidth = 3; roundRect(ctx, 16, 16, W - 32, H - 32, 30); ctx.stroke(); ctx.lineWidth = 1.5; roundRect(ctx, 28, 28, W - 56, H - 56, 22); ctx.stroke(); }
    if (id === 'gold') {
      const g = ctx.createLinearGradient(0, 0, W, H); ['#fde68a', '#b45309', '#fde68a', '#d97706'].forEach((c, i) => g.addColorStop(i / 3, c));
      ctx.strokeStyle = g; ctx.lineWidth = 8; roundRect(ctx, 14, 14, W - 28, H - 28, 30); ctx.stroke();
      ctx.fillStyle = '#fde68a'; [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.closePath(); ctx.fill(); });
    }
    if (id === 'pixel') {
      ctx.fillStyle = th.accent[0]; const s = 8;
      for (let x = 24; x < W - 24; x += s * 2) { ctx.fillRect(x, 20, s, s); ctx.fillRect(x + s, H - 20 - s, s, s); }
      for (let y = 24; y < H - 24; y += s * 2) { ctx.fillRect(20, y + s, s, s); ctx.fillRect(W - 20 - s, y, s, s); }
    }
    ctx.restore();
  }

  async function draw(optsIn) {
    const st = DK.store.state, p = st.player, s = st.stats, o = Object.assign(options(), optsIn || {});
    const th = themeOf(o.theme), light = !!th.light;
    const TXT = light ? '#2a1c10' : '#eceefb', SUB = light ? 'rgba(42,28,16,.62)' : 'rgba(236,238,251,.6)', BOX = light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* sin fuentes web */ } }

    // Fondo, brillo detrás de la foto y patrón
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(200, 210, 0, 200, 210, 420); glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    drawPattern(ctx, o.pattern, light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)');
    drawBorder(ctx, o.border, th);

    // Marca y fecha (arriba a la derecha)
    const brand = ctx.createLinearGradient(W - 260, 0, W - 60, 0); brand.addColorStop(0, th.accent[0]); brand.addColorStop(1, th.accent[1]);
    ctx.textAlign = 'right';
    ctx.fillStyle = brand; ctx.font = `800 32px ${FONT}`; ctx.fillText('DASKAI', W - 64, 80);
    ctx.fillStyle = SUB; ctx.font = `500 17px ${FONT}`; ctx.fillText(new Date().toLocaleDateString(lang()), W - 64, 106);
    ctx.textAlign = 'left';

    /* ---- Columna izquierda: foto + vitrina ---- */
    const LX = 64, LW = 272, CX = LX + LW / 2;
    await drawAvatar(ctx, p, CX, 186, 112);
    const team = DK.party.active().slice(0, 6);
    const mu = DK.party.mostUsed(), lead0 = DK.party.leader() || team[0];
    const used = mu && mu.d ? mu : lead0 ? { d: lead0 } : null; // sin combates aún: el líder
    const boxY = 336, boxH = H - 64 - boxY;
    if (o.show !== 'none' && (o.show === 'team' ? team.length : used && used.d)) {
      ctx.fillStyle = BOX; roundRect(ctx, LX, boxY, LW, boxH, 18); ctx.fill();
      ctx.fillStyle = SUB; ctx.font = `700 15px ${FONT}`; ctx.fillText((o.show === 'team' ? t('share.team') : t('share.favorite')).toUpperCase(), LX + 18, boxY + 30);
      if (o.show === 'team') {
        for (let i = 0; i < team.length; i++) {
          const d = team[i], col = i % 3, row = Math.floor(i / 3), sx = LX + 14 + col * 82, sy = boxY + 40 + row * 88;
          DK.looks.paint(ctx, await DK.looks.image(d.species, DK.looks.of(d), { shiny: !!d.shiny }), sx + 4, sy, 74, 66, { foot: true });
          ctx.fillStyle = TXT; ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`${t('common.lvl')} ${d.level}`, sx + 41, sy + 82); ctx.textAlign = 'left';
        }
      } else {
        const d = used.d;
        DK.looks.paint(ctx, await DK.looks.image(d.species, DK.looks.of(d), { shiny: !!d.shiny }), LX + 14, boxY + 44, 120, 120, { foot: true });
        ctx.fillStyle = TXT; ctx.font = `800 24px ${FONT}`; ctx.fillText(fit(ctx, DK.daskai.name(d), LW - 150), LX + 140, boxY + 92);
        ctx.fillStyle = SUB; ctx.font = `600 17px ${FONT}`; ctx.fillText(`${t('common.lvl')} ${d.level}`, LX + 140, boxY + 120);
        const hs = D.houses[DK.daskai.species(d).house];
        if (hs) { ctx.fillStyle = hs.color; roundRect(ctx, LX + 140, boxY + 134, 12, 12, 3); ctx.fill(); ctx.fillStyle = SUB; ctx.font = `600 15px ${FONT}`; ctx.fillText(DK.tr('houses', hs), LX + 158, boxY + 145); }
      }
    }

    /* ---- Columna derecha: identidad, estadísticas y casas ---- */
    const X = 384, RW = W - 64 - X;
    ctx.fillStyle = th.accent[0]; ctx.font = `700 20px ${FONT}`; ctx.fillText(fit(ctx, DK.avatars.titleText(p).toUpperCase(), RW - 200), X, 96);
    ctx.fillStyle = TXT; ctx.font = `800 62px ${FONT}`; ctx.fillText(fit(ctx, p.name, RW - 180), X, 160);
    const extra = [
      s.expeditions ? t('share.expeditions', { n: fmt(s.expeditions) }) : null,
      s.bossesDefeated ? t('share.bosses', { n: fmt(s.bossesDefeated) }) : null,
      t('share.species', { n: DK.avatars.knownSpecies().length, total: Object.keys(D.species).length }),
    ].filter(Boolean);
    ctx.fillStyle = SUB; ctx.font = `500 18px ${FONT}`; ctx.fillText(fit(ctx, extra.join('   ·   '), RW), X, 196);
    if (p.motto) { ctx.fillStyle = TXT; ctx.font = `italic 500 19px ${FONT}`; ctx.fillText(fit(ctx, '«' + p.motto + '»', RW), X, 226); }

    // Estadísticas (3 × 2) con icono
    const top = 246, gap = 14, bw = (RW - gap * 2) / 3, bh = 92;
    for (let i = 0; i < o.stats.length; i++) {
      const k = o.stats[i], [icon, val] = STATS[k];
      const bx = X + (i % 3) * (bw + gap), by = top + Math.floor(i / 3) * (bh + gap);
      ctx.fillStyle = BOX; roundRect(ctx, bx, by, bw, bh, 16); ctx.fill();
      await drawIcon(ctx, icon, th.accent[0], bx + 16, by + 16, 20);
      ctx.fillStyle = SUB; ctx.font = `600 16px ${FONT}`; ctx.fillText(fit(ctx, t('share.stat.' + k), bw - 60), bx + 44, by + 32);
      ctx.fillStyle = TXT; ctx.font = `800 34px ${FONT}`; ctx.fillText(fit(ctx, val(s), bw - 32), bx + 16, by + 74);
    }

    // Victorias por casa (barra apilada con huecos y leyenda)
    if (o.houses) {
      const houses = Object.values(D.houses).map((hs) => [hs, s.defeatedHouses[hs.id] || 0]).filter(([, n]) => n > 0);
      const total = houses.reduce((a, [, n]) => a + n, 0);
      const by = H - 64 - 46;
      ctx.fillStyle = SUB; ctx.font = `700 15px ${FONT}`; ctx.fillText(t('share.byHouse').toUpperCase(), X, by - 12);
      if (total) {
        let x = X;
        houses.forEach(([hs, n]) => { const w = Math.max(6, (n / total) * RW - 3); ctx.fillStyle = hs.color; roundRect(ctx, x, by, w, 16, 4); ctx.fill(); x += w + 3; });
        ctx.font = `600 15px ${FONT}`; let lx = X;
        houses.forEach(([hs, n]) => {
          const label = `${DK.tr('houses', hs)} ${fmt(n)}`;
          if (lx + ctx.measureText(label).width + 18 > X + RW) return;
          ctx.fillStyle = hs.color; roundRect(ctx, lx, by + 30, 12, 12, 3); ctx.fill();
          ctx.fillStyle = TXT; ctx.fillText(label, lx + 18, by + 41); lx += ctx.measureText(label).width + 36;
        });
      } else { ctx.fillStyle = BOX; roundRect(ctx, X, by, RW, 16, 4); ctx.fill(); }
    }
    return c;
  }

  const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));
  const fileName = () => `daskai-${(DK.store.state.player.name || 'perfil').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;

  DK.shareCard = {
    render: draw, options, THEMES, PATTERNS, BORDERS, STATS, SHOW, DEFAULTS,
    /** Colores del tema para las muestras del editor: [arriba, abajo, acento]. */
    swatch(id) { const th = themeOf(id); return [th.bg[0], th.bg[1], th.accent[0]]; },

    /** Ventana con la vista previa y las opciones para compartir. */
    async open() {
      const preview = h('div', { class: 'share-preview' }, h('div', { class: 'waiting' }, DK.icon('image', 18), h('span', null, t('share.drawing'))));
      const actions = h('div', { class: 'row gap-s wrap share-actions' });
      const m = DK.ui.modal({ title: t('share.title'), icon: 'share', size: 'wide', content: h('div', { class: 'stack-s' }, preview, h('p', { class: 'muted small' }, t('share.hint')), actions),
        actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost' }] });
      let canvas;
      try { canvas = await draw(); } catch (e) { preview.replaceChildren(DK.ui.empty('x', t('share.error'), '')); return; }
      const blob = await toBlob(canvas);
      const url = URL.createObjectURL(blob);
      preview.replaceChildren(h('img', { src: url, alt: t('share.title'), class: 'share-img' }));
      const file = new File([blob], fileName(), { type: 'image/png' });
      const download = () => { const a = h('a', { href: url, download: fileName() }); document.body.append(a); a.click(); a.remove(); DK.ui.toast(t('share.downloaded'), { icon: 'download', kind: 'good' }); };
      const copy = async () => {
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); DK.ui.toast(t('share.copied'), { icon: 'copy', kind: 'good' }); }
        catch (e) { DK.ui.toast(t('share.copyError'), { icon: 'x', kind: 'bad' }); }
      };
      const canShare = navigator.canShare && navigator.canShare({ files: [file] });
      const share = async () => { try { await navigator.share({ files: [file], title: 'Daskai', text: t('share.text', { name: DK.store.state.player.name }) }); } catch (e) { /* cancelado */ } };
      // v5.20: ir a personalizar la tarjeta desde aquí
      const custom = DK.router.current().id === 'profile' ? null : btn({ icon: 'edit', label: t('share.customize'), variant: 'ghost', onClick: () => { if (m && m.close) m.close(); DK.router.go('profile', { edit: true, edTab: 'card' }); } });
      actions.replaceChildren(...[
        btn({ icon: 'download', label: t('share.download'), variant: 'primary', onClick: download }),
        window.ClipboardItem && navigator.clipboard ? btn({ icon: 'copy', label: t('share.copy'), variant: 'tone', onClick: copy }) : null,
        canShare ? btn({ icon: 'share', label: t('share.share'), variant: 'tone', onClick: share }) : null, custom].filter(Boolean));
    },
  };
})();
