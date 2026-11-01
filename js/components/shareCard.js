/* =============================================================
 * components/shareCard.js — Tarjeta del perfil para compartir.
 *
 *   DK.shareCard.render()  → Promise<HTMLCanvasElement> (1200 × 630 px)
 *   DK.shareCard.open()    → ventana con la vista previa y los botones
 *                            Descargar · Copiar imagen · Compartir
 *
 * Se dibuja en un <canvas> (sin librerías): foto con su marco, nombre,
 * título, lema, 6 estadísticas, daskai favorito y victorias por casa.
 * Para cambiar el diseño edita draw(); los textos están en lang → share.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const W = 1200, H = 630;
  const FONT = "'Outfit', system-ui, sans-serif";

  /** Carga un SVG (texto) como imagen para dibujarla en el canvas. */
  function svgImage(svg) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
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
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** Relleno del marco: color de casa, degradado dorado o arcoíris. */
  function frameFill(ctx, id, cx, cy, r) {
    const f = DK.avatars.frame(id);
    if (f.house) return D.houses[f.house].color;
    if (id === 'gold') { const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); ['#fde68a', '#f59e0b', '#b45309', '#fde68a'].forEach((c, i) => g.addColorStop(i / 3, c)); return g; }
    if ((id === 'shiny' || id === 'legend') && ctx.createConicGradient) {
      const g = ctx.createConicGradient(0, cx, cy);
      const cs = id === 'shiny' ? ['#f472b6', '#facc15', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'] : ['#6d5dfc', '#22d3ee', '#6d5dfc', '#f472b6', '#6d5dfc'];
      cs.forEach((c, i) => g.addColorStop(i / (cs.length - 1), c));
      return g;
    }
    return 'rgba(255,255,255,.25)';
  }

  /** Dibuja la foto de perfil (círculo de radio r en cx, cy). */
  async function drawAvatar(ctx, p, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fillStyle = frameFill(ctx, p.frame, cx, cy, r); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const av = p.avatar;
    if (av && av.kind === 'image') {
      const img = await urlImage(av.src);
      if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else if (av && av.kind === 'icon') {
      ctx.fillStyle = av.color; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const img = await svgImage(iconSvg(av.icon, '#ffffff'));
      if (img) ctx.drawImage(img, cx - r * 0.5, cy - r * 0.5, r, r);
    } else {
      const leader = DK.party.leader() || DK.party.all()[0];
      const sp = av && av.kind === 'daskai' ? av.species : leader && leader.species;
      const col = sp ? D.houses[D.species[sp].house].color : '#6d5dfc';
      const g = ctx.createRadialGradient(cx, cy + r * 0.4, 0, cx, cy, r * 1.2);
      g.addColorStop(0, col + 'aa'); g.addColorStop(1, '#1d2240');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (sp) { const img = await svgImage(DK.sprites.svg(D.species[sp], { shiny: !!(av && av.shiny) })); if (img) ctx.drawImage(img, cx - r * 0.85, cy - r * 0.7, r * 1.7, r * 1.7); }
    }
    ctx.restore();
  }

  async function draw() {
    const st = DK.store.state, p = st.player, s = st.stats;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* sin fuentes web */ } }

    // Fondo
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b0d1a'); bg.addColorStop(1, '#1d1a45');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(230, 260, 0, 230, 260, 420);
    glow.addColorStop(0, 'rgba(109,93,252,.45)'); glow.addColorStop(1, 'rgba(109,93,252,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; roundRect(ctx, 20, 20, W - 40, H - 40, 28); ctx.stroke();

    // Marca
    const brand = ctx.createLinearGradient(W - 260, 0, W - 60, 0); brand.addColorStop(0, '#8f84ff'); brand.addColorStop(1, '#22d3ee');
    ctx.fillStyle = brand; ctx.font = `800 34px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('DASKAI', W - 60, 78);
    ctx.fillStyle = 'rgba(236,238,251,.55)'; ctx.font = `500 18px ${FONT}`; ctx.fillText(new Date().toLocaleDateString(DK.i18n.lang), W - 60, 106);
    ctx.textAlign = 'left';

    // Foto
    await drawAvatar(ctx, p, 230, 250, 130);

    // Nombre, título y lema
    const X = 430;
    ctx.fillStyle = '#a5b4fc'; ctx.font = `600 22px ${FONT}`; ctx.fillText(DK.avatars.titleText(p).toUpperCase(), X, 140);
    ctx.fillStyle = '#eceefb'; ctx.font = `800 64px ${FONT}`; ctx.fillText(p.name, X, 205);
    if (p.motto) { ctx.fillStyle = 'rgba(236,238,251,.7)'; ctx.font = `italic 400 24px ${FONT}`; ctx.fillText(`«${p.motto}»`.slice(0, 60), X, 245); }

    // Estadísticas (3 × 2)
    const decided = s.wins + s.losses;
    const stats = [
      [t('share.battles'), s.battles.toLocaleString(DK.i18n.lang)],
      [t('share.winRate'), (decided ? Math.round((s.wins / decided) * 100) : 0) + '%'],
      [t('share.bestStreak'), String(s.bestStreak || 0)],
      [t('share.captures'), String(s.captures)],
      [t('share.achievements'), `${DK.achievements.unlockedCount()}/${D.achievements.length}`],
      [t('share.playTime'), DK.util.duration(s.playTime)],
    ];
    stats.forEach(([label, val], i) => {
      const bx = X + (i % 3) * 230, by = 280 + Math.floor(i / 3) * 110;
      ctx.fillStyle = 'rgba(255,255,255,.06)'; roundRect(ctx, bx, by, 214, 94, 16); ctx.fill();
      ctx.fillStyle = 'rgba(236,238,251,.6)'; ctx.font = `600 17px ${FONT}`; ctx.fillText(label, bx + 18, by + 32);
      ctx.fillStyle = '#ffffff'; ctx.font = `800 36px ${FONT}`; ctx.fillText(val, bx + 18, by + 74);
    });

    // Favorito
    const used = DK.party.mostUsed();
    if (used && used.d) {
      const img = await svgImage(DK.sprites.svg(D.species[used.d.species], { shiny: !!used.d.shiny }));
      if (img) ctx.drawImage(img, 70, 455, 110, 110);
      ctx.fillStyle = 'rgba(236,238,251,.6)'; ctx.font = `600 17px ${FONT}`; ctx.fillText(t('share.favorite'), 190, 495);
      ctx.fillStyle = '#ffffff'; ctx.font = `700 28px ${FONT}`; ctx.fillText(`${DK.daskai.name(used.d)} · ${t('common.lvl')} ${used.d.level}`, 190, 530);
    }

    // Victorias por casa (barra apilada con huecos)
    const houses = Object.values(D.houses).map((hs) => [hs, s.defeatedHouses[hs.id] || 0]).filter(([, n]) => n > 0);
    const total = houses.reduce((a, [, n]) => a + n, 0);
    const bx = X, by = 520, bw = 690;
    ctx.fillStyle = 'rgba(236,238,251,.6)'; ctx.font = `600 17px ${FONT}`; ctx.fillText(t('share.byHouse'), bx, by - 14);
    if (total) {
      let x = bx;
      houses.forEach(([hs, n]) => {
        const w = Math.max(6, (n / total) * bw - 3);
        ctx.fillStyle = hs.color; roundRect(ctx, x, by, w, 18, 4); ctx.fill();
        x += w + 3;
      });
      ctx.font = `600 16px ${FONT}`;
      let lx = bx;
      houses.forEach(([hs, n]) => {
        ctx.fillStyle = hs.color; roundRect(ctx, lx, by + 34, 12, 12, 3); ctx.fill();
        ctx.fillStyle = 'rgba(236,238,251,.85)';
        const label = `${DK.tr('houses', hs)} ${n}`;
        ctx.fillText(label, lx + 18, by + 45);
        lx += ctx.measureText(label).width + 40;
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.08)'; roundRect(ctx, bx, by, bw, 18, 4); ctx.fill();
    }
    return c;
  }

  const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));
  const fileName = () => `daskai-${(DK.store.state.player.name || 'perfil').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;

  DK.shareCard = {
    render: draw,

    /** Ventana con la vista previa y las opciones para compartir. */
    async open() {
      const preview = h('div', { class: 'share-preview' }, h('div', { class: 'waiting' }, DK.icon('image', 18), h('span', null, t('share.drawing'))));
      const actions = h('div', { class: 'row gap-s wrap share-actions' });
      DK.ui.modal({ title: t('share.title'), icon: 'share', size: 'wide', content: h('div', { class: 'stack-s' }, preview, h('p', { class: 'muted small' }, t('share.hint')), actions),
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
      actions.replaceChildren(...[
        btn({ icon: 'download', label: t('share.download'), variant: 'primary', onClick: download }),
        window.ClipboardItem && navigator.clipboard ? btn({ icon: 'copy', label: t('share.copy'), variant: 'tone', onClick: copy }) : null,
        canShare ? btn({ icon: 'share', label: t('share.share'), variant: 'tone', onClick: share }) : null].filter(Boolean));
    },
  };
})();
