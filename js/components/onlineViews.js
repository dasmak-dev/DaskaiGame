/* =============================================================
 * components/onlineViews.js — v5.33: ventanas del intercambio y de la tabla global.
 *
 *   V.tradeDialog()        → intercambio de daskai con otro jugador (sala con código; systems/trade.js)
 *   V.tradeCard(d)         → ficha compacta de un daskai (el tuyo o el que te ofrecen)
 *   V.pickOwnDaskai(o)     → elige uno de tus daskai, por grupos (equipo y cajas) → Promise<uid|null>
 *   V.leaderboard()        → tabla global del Averno (systems/online.js)
 *   V.publishAsk(onDone)   → tarjeta «¿publicar tu récord?» (resumen del Averno)
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const D = DK.data, V = DK.views;
  /** Como replaceChildren, pero sin pintar «null» cuando un hijo es opcional (v5.41.2). */
  const put = (n, ...k) => n.replaceChildren(...k.flat(9).filter((x) => x != null && x !== false));
  const { t } = DK;

  /** Ficha compacta: dibujo, nombre, especie, nivel, casas, naturaleza, pasiva y atributos. */
  V.tradeCard = (d, { cls = '' } = {}) => {
    if (!d) return null;
    const s = DK.daskai.stats(d, [null, null]), sp = D.species[d.species]; // (sin su equipo: el equipo no viaja)
    const stat = (k) => h('span', { class: 'tc-stat' }, h('small', null, DK.tr('stats', D.stats[k], 'short') || k), h('b', null, s[k]));
    return h('div', { class: 'trade-card ' + cls, style: { '--c': D.houseColor ? D.houseColor(sp.house) : '#888' } },
      h('div', { class: 'tc-head' },
        h('span', { class: 'tc-spr' }, V.dSprite(d, { size: 72 })),
        h('div', { class: 'tc-main' },
          h('b', { class: 'tc-name' }, DK.daskai.name(d), d.shiny ? h('span', { class: 'tc-shiny', tip: t('trade.shiny') }, ' ★') : null),
          h('small', { class: 'muted' }, `${sp.name} · ${t('common.lvl')} ${d.level}` + (d.stars ? ` · ${'✦'.repeat(d.stars)}` : '')),
          h('span', { class: 'tc-tags' }, V.housesBadge(d), V.roleBadge ? V.roleBadge(d) : null))),
      h('div', { class: 'tc-rows' },
        h('span', null, h('small', null, t('trade.nature')), h('b', null, D.natures[d.nature] ? DK.tr('natures', D.natures[d.nature]) : '—')),
        h('span', null, h('small', null, t('trade.passive')), h('b', null, D.passives[d.passive] ? DK.tr('passives', D.passives[d.passive]) : '—'))),
      h('div', { class: 'tc-stats' }, ['hp', 'mp', 'atk', 'matk', 'def', 'mdef', 'spd'].map(stat)),
      h('div', { class: 'tc-moves' }, (d.moves || []).map((m) => (D.moves[m] ? h('span', { class: 'chip sm' }, DK.tr('moves', D.moves[m])) : null))),
      d.ot ? h('small', { class: 'tc-ot muted' }, DK.icon('user', 10), ' ', t('trade.ot'), ': ', h('b', null, d.ot.name), ' #' + d.ot.id) : null);
  };

  /** Elegir uno de tus daskai, por grupos como en las cajas. filter(d) → null (vale) o la clave del motivo. */
  V.pickOwnDaskai = ({ title = t('trade.pickTitle'), filter = () => null } = {}) => {
    const groups = [{ id: 'team', label: t('party.title'), icon: 'users', list: DK.party.active() }];
    if (DK.boxes) DK.boxes.list().forEach((bx, i) => groups.push({ id: 'box' + i, label: DK.boxes.name(i), icon: 'cube', list: bx.slots.filter(Boolean).map((u) => DK.party.get(u)).filter(Boolean) }));
    const inGroups = new Set(groups.flatMap((g) => g.list.map((d) => d.uid)));
    const rest = DK.party.all().filter((d) => !inGroups.has(d.uid));
    if (rest.length) groups.push({ id: 'rest', label: t('trade.others'), icon: 'paw', list: rest });
    const shown = groups.filter((g) => g.list.length);
    let cur = shown[0];
    return DK.ui.modal({
      title, icon: 'paw', cls: 'pick-daskai', closeX: true,
      content: (close) => {
        const holder = h('div', { class: 'stack-s' });
        const draw = () => put(holder, 
          h('div', { class: 'pe-chips pe-groups' }, shown.map((g) => h('button', { class: 'pe-chip' + (g === cur ? ' on' : ''), type: 'button', onClick: () => { cur = g; draw(); } }, DK.icon(g.icon, 14), g.label, h('small', { class: 'muted' }, String(g.list.length))))),
          h('div', { class: 'pd-grid' }, (cur ? cur.list : []).map((d) => {
            const why = filter(d);
            return h('button', { class: 'pd-opt' + (why ? ' off' : ''), type: 'button', disabled: !!why, tip: why ? t(why) : DK.daskai.name(d), onClick: () => close(d.uid) },
              V.dSprite(d, { size: 52 }), h('b', null, DK.daskai.name(d)), h('small', { class: 'muted' }, `${t('common.lvl')} ${d.level}`), why ? h('small', { class: 'pd-why' }, DK.icon('lock', 10), ' ', t(why)) : null);
          })));
        draw();
        return holder;
      },
    }).promise;
  };

  /* ---------------- Intercambio (v5.37: rediseño) ---------------- */
  /** Placa de un jugador: dibujo, nombre e ID de entrenador. */
  const plate = (who, { name, tid, species, avatarOf, on, cls = '' }) => h('div', { class: 'tx-plate ' + who + (on ? ' on' : '') + ' ' + cls },
    h('span', { class: 'tx-ava' }, avatarOf ? V.avatar(avatarOf, { size: 44 }) : species && D.species[species] ? V.sprite(species, { size: 44 }) : h('b', null, (name || '?').charAt(0).toUpperCase())),
    h('span', { class: 'tx-who' }, h('b', null, name || '…'), h('small', null, tid ? '#' + tid : t('trade.waitingPlayer'))));
  /** Pasos: 1 conectar · 2 elegir · 3 aceptar · 4 hecho */
  const steps = (n) => h('ol', { class: 'tx-steps', 'aria-label': t('trade.title') }, ['stepConnect', 'stepPick', 'stepAccept', 'stepDone'].map((k, i) =>
    h('li', { class: i + 1 < n ? 'done' : i + 1 === n ? 'on' : '' }, h('span', null, i + 1 < n ? DK.icon('check', 11) : String(i + 1)), h('small', null, t('trade.' + k)))));
  /** Código de la sala en fichas grandes. */
  const codeTiles = (code) => h('span', { class: 'tx-code', 'aria-label': code }, code.split('').map((c, i) => h('i', { class: i === 3 ? 'gap' : '' }, c)));
  const fmtAgo = (at) => { const m = Math.round((Date.now() - at) / 60000); return m < 60 ? t('trade.agoMin', { n: Math.max(1, m) }) : m < 1440 ? t('trade.agoH', { n: Math.round(m / 60) }) : t('trade.agoD', { n: Math.round(m / 1440) }); };

  V.tradeDialog = () => {
    const T = DK.trade;
    if (!T.available()) { toast(t('trade.why.expedition'), { icon: 'lock', kind: 'bad' }); return null; }
    let off = null;
    const meP = DK.store.state.player || {};
    const m = DK.ui.modal({
      title: t('trade.title'), icon: 'swap', cls: 'trade-modal tx', closeX: true, dismissable: true,
      content: () => {
        const holder = h('div', { class: 'trade-body' });
        const draw = () => put(holder, view());
        off = DK.on('trade:changed', () => draw());
        draw();
        return holder;
      },
    });
    m.promise.then(() => { if (off) off(); if (DK.trade.session) DK.trade.close(true); }); // al cerrar la ventana se cierra la sala

    function view() {
      const s = T.session;
      if (!s) return startView();
      if (s.status === 'error' || s.status === 'closed') {
        return h('div', { class: 'tx-msg' }, h('span', { class: 'tx-msg-ico bad' }, DK.icon(s.status === 'closed' ? 'exit' : 'alert', 30)),
          h('b', null, s.status === 'closed' ? t('trade.closed') : t('trade.err.' + (s.error || 'conn'))),
          s.error === 'notFound' ? h('small', { class: 'muted' }, t('trade.notFoundHelp')) : null,
          btn({ icon: 'refresh', label: t('trade.again'), variant: 'primary', onClick: () => T.close() }));
      }
      if (s.status === 'done') return doneView(s);
      return roomView(s);
    }

    function startView() {
      const input = h('input', { class: 'trade-code-in', type: 'text', maxlength: 7, placeholder: 'ABC123', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': t('trade.codeLabel') });
      const join = () => { if (!T.join(input.value)) { DK.audio.sfx('error'); input.classList.add('bad'); input.focus(); } else DK.audio.sfx('select'); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
      input.addEventListener('input', () => { input.value = T.cleanCode(input.value); input.classList.remove('bad'); });
      const log = (DK.store.state.tradeLog || []).slice(0, 5);
      return h('div', { class: 'stack tx-start' },
        h('div', { class: 'tx-hero' },
          h('div', { class: 'tx-hero-art', 'aria-hidden': 'true' }, h('span', { class: 'tx-orb a' }, V.sprite((DK.party.leader() || {}).species || Object.keys(D.species)[0], { size: 54 })), h('span', { class: 'tx-orb-swap' }, DK.icon('swap', 20)), h('span', { class: 'tx-orb b' }, DK.icon('question', 26))),
          h('div', null, h('b', null, t('trade.heroTitle')), h('p', { class: 'muted small' }, t('trade.intro')),
            h('span', { class: 'chip sm tx-myid', tip: t('trade.yourIdTip') }, DK.icon('user', 11), t('trade.yourId'), ' ', h('b', null, '#' + DK.trainer.id())))),
        h('div', { class: 'tx-choices' },
          h('div', { class: 'tx-choice host' }, h('span', { class: 'tx-choice-ico' }, DK.icon('plus', 22)),
            h('b', null, t('trade.hostTitle')), h('small', { class: 'muted' }, t('trade.hostText')),
            btn({ icon: 'globe', label: t('trade.host'), variant: 'primary', onClick: () => { DK.audio.sfx('select'); T.host(); } })),
          h('div', { class: 'tx-choice join' }, h('span', { class: 'tx-choice-ico' }, DK.icon('users', 22)),
            h('b', null, t('trade.joinTitle')), h('small', { class: 'muted' }, t('trade.joinText')),
            h('div', { class: 'tx-join-row' }, input, btn({ icon: 'next', label: t('trade.join'), variant: 'tone', onClick: join })))),
        log.length ? h('div', { class: 'tx-log' }, h('span', { class: 'tx-sub' }, DK.icon('clock', 12), t('trade.history')),
          log.map((x) => h('div', { class: 'tx-log-row' },
            h('span', { class: 'tx-log-mon' }, V.sprite(x.gave.species, { size: 30, shiny: x.gave.shiny }), h('small', null, x.gave.name)),
            h('span', { class: 'tx-log-arrow' }, DK.icon('swap', 13)),
            h('span', { class: 'tx-log-mon' }, V.sprite(x.got.species, { size: 30, shiny: x.got.shiny }), h('small', null, x.got.name)),
            h('small', { class: 'muted tx-log-with' }, `${x.with}${x.tid ? ' #' + x.tid : ''} · ${fmtAgo(x.at)}`)))) : null,
        h('p', { class: 'muted small trade-note' }, DK.icon('info', 12), ' ', t(DK.online && DK.online.enabled() && T.relayOk !== false ? 'trade.noteRelay' : 'trade.note')));
    }

    function roomView(s) {
      const open = s.status === 'open';
      const mine = s.me.uid ? DK.party.get(s.me.uid) : null;
      const fp = T.fingerprint(), iLock = !!fp && s.me.locked === fp, theyLock = !!fp && s.them.locked === fp;
      const stepN = !open ? 1 : !fp ? 2 : 3;
      const share = async () => {
        const text = t('trade.shareText', { code: s.code });
        try { if (navigator.share) { await navigator.share({ title: t('trade.title'), text }); return; } } catch (e) { /* cancelado */ }
        try { await navigator.clipboard.writeText(s.code); toast(t('trade.copied'), { icon: 'copy' }); } catch (e) { /* */ }
      };
      const head = h('div', { class: 'tx-head' },
        plate('me', { name: meP.name, tid: DK.trainer.id(), avatarOf: meP, on: true }),
        h('span', { class: 'tx-link ' + (open ? 'on' : 'wait') }, h('i'), h('i'), h('i'), DK.icon(open ? 'swap' : 'clock', 16)),
        plate('them', { name: open ? s.them.name : '', tid: open ? s.them.tid : '', species: s.them.av, on: open }));
      const room = h('div', { class: 'tx-room' + (open ? ' small' : '') },
        h('small', { class: 'muted' }, t(s.role === 'host' ? 'trade.yourCode' : open ? 'trade.room' : 'trade.joining')),
        codeTiles(s.code),
        s.role === 'host' && !open ? btn({ icon: navigator.share ? 'share' : 'copy', label: t(navigator.share ? 'trade.share' : 'trade.copy'), size: 'sm', variant: 'tone', onClick: share }) : null);
      if (!open) {
        return h('div', { class: 'stack tx-room-wrap' }, steps(stepN), head, room,
          h('p', { class: 'tx-wait muted small' }, h('span', { class: 'tx-dots' }, h('i'), h('i'), h('i')), ' ', t(s.role === 'host' ? 'trade.waitHelp' : 'trade.connHelp')),
          s.role === 'host' ? h('p', { class: 'muted small' }, DK.icon('info', 12), ' ', t('trade.leaveOk')) : null);
      }
      const pick = async () => { const uid = await V.pickOwnDaskai({ filter: (d) => T.canOffer(d) }); if (uid) { T.offer(uid); DK.audio.sfx('select'); } };
      const side = (who, d, locked, emptyEl, lbl, extra) => h('div', { class: 'tx-side ' + who + (locked ? ' locked' : '') + (d ? ' filled' : '') },
        h('span', { class: 'tx-side-lbl' }, lbl, locked ? h('span', { class: 'tx-ok' }, DK.icon('check', 11), t('trade.ok')) : null),
        d ? V.tradeCard(d) : emptyEl, extra);
      const mySide = side('me', mine, iLock, h('button', { class: 'trade-empty', type: 'button', onClick: pick }, h('span', { class: 'tx-plus' }, DK.icon('plus', 22)), h('b', null, t('trade.pick')), h('small', { class: 'muted' }, t('trade.pickHelp'))),
        t('trade.youGive'), mine && !iLock ? btn({ icon: 'swap', label: t('trade.change'), size: 'sm', variant: 'ghost', onClick: pick }) : null);
      const theirSide = side('them', s.them.d, theyLock, h('div', { class: 'trade-empty wait' }, h('span', { class: 'tx-dots' }, h('i'), h('i'), h('i')), h('small', null, s.them.bad ? t('trade.badOffer') : t('trade.waitOffer', { name: s.them.name || '?' }))),
        t('trade.youGet', { name: s.them.name || '?' }), null);
      const both = iLock && theyLock;
      return h('div', { class: 'stack tx-room-wrap' }, steps(both ? 4 : stepN), head, room,
        s.them.ver && s.them.ver !== DK.version ? h('p', { class: 'small warn-text' }, DK.icon('alert', 12), ' ', t('trade.verWarn', { a: DK.version, b: s.them.ver })) : null,
        h('div', { class: 'trade-sides tx-sides' + (both ? ' swapping' : '') }, mySide, h('span', { class: 'trade-arrow tx-arrow', 'aria-hidden': 'true' }, DK.icon('swap', 22)), theirSide),
        h('div', { class: 'tx-actions' },
          both ? h('b', { class: 'good-text' }, h('span', { class: 'tx-dots' }, h('i'), h('i'), h('i')), ' ', t('trade.swapping'))
            : iLock ? [h('small', { class: 'muted' }, t('trade.waitAccept', { name: s.them.name || '?' })), btn({ icon: 'undo', label: t('trade.undo'), variant: 'ghost', onClick: () => T.unlock() })]
            : [h('small', { class: 'muted' }, fp ? (theyLock ? t('trade.theyAccepted', { name: s.them.name || '?' }) : t('trade.acceptHelp')) : t('trade.needBoth')),
              btn({ icon: 'check', label: t('trade.accept'), variant: 'primary', disabled: !fp, onClick: () => { T.lock(); DK.audio.sfx('select'); } })]));
    }

    function doneView(s) {
      const got = DK.party.get(s.done.got);
      return h('div', { class: 'stack tx-done' }, steps(5),
        h('div', { class: 'tx-burst', 'aria-hidden': 'true' }, Array.from({ length: 12 }, (_, i) => h('i', { style: { '--a': (i * 30) + 'deg', '--d': (i % 3) * 0.08 + 's' } }))),
        h('b', { class: 'tx-done-title' }, DK.icon('checkCircle', 20), ' ', t('trade.doneTitle')),
        h('p', { class: 'muted small' }, t('trade.doneText', { gave: s.done.gave, got: got ? DK.daskai.name(got) : '?', name: s.them.name })),
        got ? V.tradeCard(got, { cls: 'got' }) : null,
        h('div', { class: 'row gap-s wrap tx-done-btns' }, btn({ icon: 'users', label: t('trade.toTeam'), variant: 'primary', onClick: () => { m.close(true); DK.router.reset('team'); } }),
          btn({ icon: 'swap', label: t('trade.another'), variant: 'ghost', onClick: () => T.close() })));
    }
    return m;
  };

  /* ---------------- Tablas globales (v5.39: cinco tablas, perfiles y equipos) ---------------- */
  /** Un daskai de otra partida (instantánea) como objeto dibujable. */
  const pseudoD = (x) => ({ species: x.s, shiny: !!x.sh, look: x.lk || null, house2: x.h2 || undefined, form: x.f || 0, forms: x.fs || 0, level: x.l | 0, nickname: x.n });
  const okSp = (x) => x && D.species[x.s];
  const teamIcons = (team) => h('span', { class: 'lb-team' }, (Array.isArray(team) ? team : []).slice(0, 6).map((x) => (okSp(x) ? h('span', { tip: `${x.n || D.species[x.s].name} · ${t('common.lvl')} ${x.l | 0}` }, V.dSprite(pseudoD(x), { size: 36 })) : null)));
  const statShort = (k) => (D.stats[k] && DK.tr('stats', D.stats[k], 'short')) || k;

  /**
   * v5.41: cómo está montado un equipo, compacto: una fila de fichas (dibujo, nombre y nivel) y, debajo,
   * el detalle del que tengas elegido (atributos, naturaleza, pasiva, ataques, talentos y equipo). Arriba, las reliquias.
   */
  const monDetail = (x) => {
    const d = pseudoD(x), sp = D.species[x.s];
    const tags = [D.natures[x.nat] ? h('span', { class: 'chip sm' }, DK.icon('leaf', 10), DK.tr('natures', D.natures[x.nat])) : null,
      D.passives[x.pas] ? h('span', { class: 'chip sm', tip: DK.tr('passives', D.passives[x.pas], 'desc') }, DK.icon('sparkles', 10), DK.tr('passives', D.passives[x.pas])) : null,
      x.stars ? h('span', { class: 'chip sm bv-stars' }, '✦'.repeat(Math.min(5, x.stars))) : null].filter(Boolean);
    const moves = (x.mv || []).filter((m) => D.moves[m]), tal = D.talents ? (x.tal || []).filter((id) => D.talents[id]) : [], gear = x.gear || [];
    return h('div', { class: 'bv-d', style: { '--c': D.houseColor ? D.houseColor(sp.house) : '#888' } },
      h('div', { class: 'bv-d-head' }, h('span', { class: 'bv-d-spr' }, V.dSprite(d, { size: 64 })),
        h('div', { class: 'bv-d-who' }, h('b', null, x.n || sp.name, x.sh ? h('span', { class: 'tc-shiny' }, ' ★') : null),
          h('small', { class: 'muted' }, `${sp.name} · ${t('common.lvl')} ${x.l | 0}`), tags.length ? h('div', { class: 'bv-tags' }, tags) : null)),
      x.st ? h('div', { class: 'bv-stats' }, ['hp', 'mp', 'atk', 'matk', 'def', 'mdef', 'spd'].map((k) => h('span', null, h('small', null, statShort(k)), h('b', null, x.st[k] | 0)))) : null,
      moves.length ? h('div', { class: 'bv-row' }, h('small', { class: 'bv-lbl' }, t('online.bv.moves')), h('div', { class: 'bv-chips' }, moves.map((m) => h('span', { class: 'chip sm' }, DK.tr('moves', D.moves[m]))))) : null,
      tal.length ? h('div', { class: 'bv-row' }, h('small', { class: 'bv-lbl' }, t('online.bv.talents')), h('div', { class: 'bv-chips' }, tal.map((id) => h('span', { class: 'chip sm tal', tip: V.talentText ? V.talentText(id) : '' }, t('talent.' + id + '.name'))))) : null,
      gear.length ? h('div', { class: 'bv-row' }, h('small', { class: 'bv-lbl' }, t('online.bv.gear')), h('div', { class: 'bv-gear' }, gear.map((g) => h('div', { class: 'bv-g', style: { '--g': (D.gear.rarities[g.r] || {}).color || '#aaa' }, tip: (g.a || []).join('\n') },
        h('b', null, g.n), h('small', null, `${t('gear.rarity.' + g.r)} · ${t('common.lvl')} ${g.i | 0}`), (g.a || []).length ? h('small', { class: 'bv-aff' }, g.a.join(' · ')) : null)))) : null);
  };
  V.buildView = (build) => {
    const team = (build && Array.isArray(build.team) ? build.team : Array.isArray(build) ? build : []).filter(okSp);
    const relics = (build && Array.isArray(build.relics) ? build.relics : []).filter((id) => D.relics[id]);
    if (!team.length) return h('p', { class: 'muted small' }, t('online.noBuild'));
    const detail = h('div', { class: 'bv-detail' }, monDetail(team[0]));
    const tiles = team.length > 1 ? team.map((x, i) => h('button', { class: 'bv-tile' + (i ? '' : ' on'), type: 'button', style: { '--c': D.houseColor ? D.houseColor(D.species[x.s].house) : '#888' },
      onClick: (e) => { tiles.forEach((b) => b.classList.toggle('on', b === e.currentTarget)); put(detail, monDetail(x)); } },
      h('span', { class: 'bv-tspr' }, V.dSprite(pseudoD(x), { size: 44 })), h('b', null, x.n || D.species[x.s].name, x.sh ? h('span', { class: 'tc-shiny' }, '★') : null), h('small', null, `${t('common.lvl')} ${x.l | 0}`))) : null;
    return h('div', { class: 'bv' },
      relics.length ? h('div', { class: 'bv-relics' }, relics.map((id) => h('span', { class: 'chip sm r-' + D.relics[id].rarity, tip: V.relicText ? V.relicText(D.relics[id]) : '' }, DK.icon(D.relics[id].icon, 11), DK.tr('relics', D.relics[id])))) : null,
      tiles ? h('div', { class: 'bv-tiles' }, tiles) : null, detail);
  };

  /**
   * Tabla global (v5.43.1: rediseño). Siempre del mismo tamaño; pestañas, temporada/semana con flechas,
   * podio para los tres primeros y lista; casi sin texto (la explicación va en el icono de información).
   * Cambiar de tabla o de periodo no cierra la ventana: sólo cambia el contenido (y lo ya visto sale al momento).
   */
  const BOARD_IC = { averno: 'flame', depth: 'compass', weekly: 'trophy', abyss: 'moon', shiny: 'sparkles' };
  V.leaderboard = (opts) => {
    const o = typeof opts === 'object' && opts ? opts : { season: opts };
    const O = DK.online;
    const S = { board: O.BOARDS.includes(o.board) ? o.board : 'averno', per: null, cache: {} };
    S.per = o.period || (S.board === 'averno' && o.season) || O.periodOf(S.board);
    const root = h('div', { class: 'lbx' });
    const m = DK.ui.modal({ title: t('online.boardsTitle'), icon: 'trophy', cls: 'lb-modal', closeX: true, size: 'wide', content: () => root });
    const tabs = h('div', { class: 'lbx-tabs', role: 'tablist' });
    const bar = h('div', { class: 'lbx-bar' });
    const body = h('div', { class: 'lbx-body' });
    const foot = h('div', { class: 'lbx-foot' });
    put(root, tabs, bar, body, foot);
    if (!O.enabled()) { put(body, h('div', { class: 'lbx-empty' }, DK.icon('info', 30), h('p', { class: 'muted' }, t('online.off')))); return m; }
    const me = O.me(), myTid = DK.trainer.id();

    const drawTabs = () => put(tabs, O.BOARDS.map((b) => h('button', { class: 'lbx-tab' + (b === S.board ? ' on' : ''), type: 'button', role: 'tab', tip: t('online.board.' + b),
      onClick: () => { if (b === S.board) return; S.board = b; S.per = O.periodOf(b); refresh(); } }, DK.icon(BOARD_IC[b], 15), h('span', { class: 'lbx-tl' }, t('online.board.' + b)))));
    const drawBar = (rows) => {
      const cur = O.periodOf(S.board), isWeek = S.board === 'weekly';
      const mine = rows ? rows.findIndex((r) => r.mine) : -1;
      const nav = (d) => { const n = S.per + d; if (n < 1 || n > cur) return; S.per = n; refresh(); };
      put(bar,
        h('div', { class: 'lbx-per' },
          h('button', { class: 'lbx-arrow', type: 'button', disabled: S.per <= 1, 'aria-label': '‹', onClick: () => nav(-1) }, DK.icon('back', 14)),
          h('b', null, t(isWeek ? 'online.weekN' : 'online.season', { n: S.per })),
          h('button', { class: 'lbx-arrow', type: 'button', disabled: S.per >= cur, 'aria-label': '›', onClick: () => nav(1) }, DK.icon('next', 14)),
          S.per === cur ? h('span', { class: 'lbx-tag live', tip: isWeek ? t('online.weekResets', { n: DK.weekly.daysLeft() }) : t('online.resetIn', { n: O.daysLeft() }) }, DK.icon('clock', 11), `${isWeek ? DK.weekly.daysLeft() : O.daysLeft()} d`)
            : h('span', { class: 'lbx-tag' }, t('online.ended'))),
        h('span', { class: 'grow' }),
        mine >= 0 ? h('span', { class: 'lbx-tag me' }, t('online.myPos', { n: mine + 1 })) : null,
        h('span', { class: 'lbx-info', tip: t('online.help.' + S.board) }, DK.icon('info', 15)));
    };
    const drawFoot = () => {
      if (me.tainted || me.banned) { put(foot, h('small', { class: 'warn-text' }, DK.icon('alert', 12), ' ', t(me.tainted ? 'online.tainted' : 'online.banned'))); return; }
      put(foot, h('span', { class: 'lbx-dot' + (me.publish ? ' on' : '') }),
        h('small', { class: 'muted' }, me.publish ? t('online.pubAs', { name: (DK.store.state.player && DK.store.state.player.name) || '?' }) : t('online.notPub')),
        h('button', { class: 'linkish lbx-link', type: 'button', onClick: async () => { await O.setPublish(!me.publish); S.cache = {}; drawFoot(); refresh(); } }, me.publish ? t('online.pubStop') : t('online.pubStart')));
    };
    const lead = (r) => { const x = Array.isArray(r.team) ? r.team.find(okSp) : null; return x ? V.dSprite(pseudoD(x), { size: 44 }) : DK.icon('user', 22); };
    const open = (r) => { if (r) V.publicProfile(r.tid, { name: r.name, build: r.build, board: S.board, value: r.value }); };
    const unit = () => t('online.value.' + S.board).toLowerCase();
    const podium = (rows) => h('div', { class: 'lbx-podium' }, [1, 0, 2].map((i) => { const r = rows[i];
      return h(r ? 'button' : 'div', { class: `lbx-pod p${i + 1}` + (r ? '' : ' none') + (r && r.mine ? ' me' : ''), type: r ? 'button' : null, onClick: r ? () => open(r) : null },
        h('span', { class: 'lbx-medal' }, String(i + 1)), h('span', { class: 'lbx-pod-spr' }, r ? lead(r) : null),
        h('b', { class: 'lbx-pod-name' }, r ? String(r.name || '?').slice(0, 18) : '—'),
        h('span', { class: 'lbx-pod-val' }, r ? Number(r.value).toLocaleString(DK.i18n.lang) : ''), h('small', null, r ? unit() : '')); }));
    const row = (r, i) => h('button', { class: 'lbx-row' + (r.mine ? ' me' : ''), type: 'button', onClick: () => open(r) },
      h('span', { class: 'lbx-rank' }, String(i + 1)), h('span', { class: 'lbx-spr' }, lead(r)),
      h('span', { class: 'lbx-who' }, h('b', null, String(r.name || '?').slice(0, 20)), r.sub ? h('small', null, r.sub) : null),
      h('span', { class: 'lbx-team' }, (Array.isArray(r.team) ? r.team : []).filter(okSp).slice(1, 6).map((x) => V.dSprite(pseudoD(x), { size: 26 }))),
      h('b', { class: 'lbx-val' }, Number(r.value).toLocaleString(DK.i18n.lang)));
    const show = (rows) => {
      drawBar(rows);
      if (!rows) { put(body, podium([]), h('div', { class: 'lbx-list' }, Array.from({ length: 5 }, () => h('div', { class: 'lbx-row skel' })))); return; }
      put(body, podium(rows), rows.length > 3 ? h('div', { class: 'lbx-list' }, rows.slice(3).map((r, i) => row(r, i + 3)))
        : h('div', { class: 'lbx-empty' }, DK.icon(rows.length ? 'trophy' : BOARD_IC[S.board], 26), h('p', { class: 'muted' }, rows.length ? t('online.fewYet') : t(S.per === O.periodOf(S.board) ? 'online.emptyShort' : 'online.emptyPast'))));
    };
    const fetchRows = (board, per) => (board === 'averno'
      ? O.board(50, per).then((rows) => rows.map((r) => ({ tid: r.trainer_id, name: r.name, value: r.floors, sub: `${r.maps} ${t('online.bosses').toLowerCase()} · ${t('common.lvl')} ${r.level}`, team: r.team, build: { team: r.team, relics: r.relics || [] }, mine: r.player_id === me.id })))
      : O.scoreBoard(board, 50, per).then((rows) => rows.map((r) => ({ tid: r.trainer_id, name: r.name, value: r.value, sub: r.title || '', team: r.build && r.build.team, build: r.build, mine: r.trainer_id === myTid }))));
    let seq = 0;
    async function refresh() {
      drawTabs();
      const key = S.board + ':' + S.per, my = ++seq;
      show(S.cache[key] || null);
      try { const rows = await fetchRows(S.board, S.per); S.cache[key] = rows; if (my === seq) show(rows); }
      catch (e) { if (my === seq && !S.cache[key]) put(body, h('div', { class: 'lbx-empty' }, DK.icon('alert', 26), h('p', { class: 'warn-text' }, t('online.error')))); }
    }
    drawFoot(); refresh();
    return m;
  };

  /** Estado del perfil público: activarlo / desactivarlo (y aviso si la partida no puede publicar). */
  V.publishCard = (after) => {
    const O = DK.online; if (!O.enabled()) return null;
    const me = O.me();
    if (me.tainted) return h('p', { class: 'small warn-text lb-pub' }, DK.icon('alert', 12), ' ', t('online.tainted'));
    if (me.banned) return h('p', { class: 'small warn-text lb-pub' }, DK.icon('lock', 12), ' ', t('online.banned'));
    return h('div', { class: 'lb-pub row gap-s wrap' }, h('small', { class: 'muted' }, me.publish ? t('online.pubOn') : t('online.pubOff')),
      btn({ label: me.publish ? t('online.pubStop') : t('online.pubStart'), size: 'sm', variant: me.publish ? 'ghost' : 'tone', onClick: async () => { await O.setPublish(!me.publish); if (after) after(); } }));
  };

  /* ---------------- Perfil público (v5.41: compacto) ---------------- */
  const REC_MAIN = [['flame', 'averno'], ['compass', 'depth'], ['moon', 'abyss'], ['trophy', 'weekly'], ['sparkles', 'shinies'], ['star', 'maxLv']];
  const REC_MORE = [['swords', 'battles'], ['paw', 'daskai'], ['swap', 'trades'], ['award', 'achievements']];
  const recordGrid = (r) => h('div', { class: 'pp-recs' }, REC_MAIN.concat(REC_MORE).filter(([, k]) => r[k] != null).map(([ic, k]) =>
    h('div', { class: 'pp-rec' + (r[k] ? '' : ' zero') }, h('span', { class: 'pp-rec-ic' }, DK.icon(ic, 13)), h('b', null, Number(r[k] || 0).toLocaleString(DK.i18n.lang)), h('small', null, t('online.rec.' + k)))));
  const segTabs = (items, cur, on) => h('div', { class: 'seg-tabs' }, items.map(([k, label]) => h('button', { class: k === cur ? 'on' : '', type: 'button', onClick: () => on(k) }, label)));

  /** Ficha pública de un jugador (por su ID de entrenador). o.build = equipo del récord que pulsaste en la tabla. */
  V.publicProfile = (tid, o = {}) => {
    const O = DK.online, mine = tid && tid === DK.trainer.id();
    return DK.ui.modal({
      title: t('online.profileTitle'), icon: 'user', cls: 'pp-modal', closeX: true, size: 'wide',
      content: () => {
        const holder = h('div', { class: 'pp-body' }, h('p', { class: 'muted' }, DK.icon('clock', 13), ' ', t('online.loading')));
        let p = null, fr = null, teamTab = o.build ? 'record' : 'current';
        const draw = () => {
          if (!p) {
            put(holder, h('div', { class: 'pp-hero' }, h('div', { class: 'pp-who' }, h('b', { class: 'pp-name' }, o.name || '?'), tid ? h('span', { class: 'chip sm' }, '#' + tid) : null)),
              h('p', { class: 'muted small' }, t('online.noProfile')), o.build ? V.buildView(o.build) : null);
            return;
          }
          const av = p.avatar || {}, fav = p.fav && okSp(p.fav) ? p.fav : null;
          const act = (icon, label, fn, variant = 'ghost') => btn({ icon, label, size: 'sm', variant, onClick: fn });
          const refresh = async () => { try { fr = (await O.friends()).find((f) => f.trainer_id === tid) || null; } catch (e) { /* */ } draw(); };
          const actions = mine ? null : !O.ready() ? V.publishCard(() => { O.friends().then(() => refresh()); })
            : h('div', { class: 'pp-actions' },
              !fr ? act('plus', t('online.addFriend'), () => friendAct('add', tid).then(refresh), 'primary')
                : fr.status === 'incoming' ? [act('check', t('online.accept'), () => friendAct('add', tid).then(refresh), 'primary'), act('x', t('online.reject'), () => friendAct('reject', tid).then(refresh))]
                  : fr.status === 'sent' ? [h('span', { class: 'chip sm' }, DK.icon('clock', 11), t('online.pendingShort')), act('x', t('online.cancelReq'), () => friendAct('remove', tid).then(refresh))]
                    : [h('span', { class: 'chip sm pos' }, DK.icon('users', 11), t('online.mutual')), act('gift', t('online.sendGift'), () => giftTo(tid)), act('edit', t('online.sendMsg'), () => V.composeMessage(tid, p.name)), act('swap', t('online.inviteTrade'), () => inviteTrade(tid)),
                      btn({ icon: 'x', label: t('online.removeFriend'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => friendAct('remove', tid).then(refresh) })],
              btn({ icon: 'alert', label: t('online.report'), iconOnly: true, size: 'sm', variant: 'ghost', onClick: () => reportDialog(tid, p.name) }));
          const tabs = [['current', t('online.currentTeam')]];
          if (o.build) tabs.unshift(['record', t('online.recordTeamShort', { board: t('online.board.' + (o.board || 'averno')) })]);
          const teamBox = h('div', { class: 'pp-team' });
          const showTeam = () => put(teamBox, teamTab === 'record' ? V.buildView(o.build) : V.buildView({ team: p.team || [] }));
          const tabsEl = tabs.length > 1 ? segTabs(tabs, teamTab, (k) => { teamTab = k; tabsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', tabs[i][0] === k)); showTeam(); }) : h('span', { class: 'tx-sub' }, DK.icon('users', 12), tabs[0][1]);
          showTeam();
          put(holder, 
            h('div', { class: 'pp-hero' },
              h('span', { class: 'pp-ava' }, V.avatar({ name: p.name, avatar: av.av || null, frame: av.fr || null }, { size: 64, avatar: av.av || (fav ? { kind: 'daskai', species: fav.s } : null) })),
              h('div', { class: 'pp-who' }, h('b', { class: 'pp-name' }, p.name), p.title ? h('span', { class: 'pp-title' }, p.title) : null,
                h('div', { class: 'pp-meta' }, h('span', { class: 'chip sm' }, '#' + p.trainer_id + (mine ? ' · ' + t('online.you') : '')), h('span', { class: 'chip sm' }, DK.icon('clock', 10), t('online.playtime', { h: Math.floor((p.playtime || 0) / 3600) })))),
              fav ? h('div', { class: 'pp-fav', tip: t('online.favorite') }, V.dSprite(pseudoD(fav), { size: 48 }), h('small', null, DK.icon('heart', 10), fav.n || D.species[fav.s].name), h('small', { class: 'muted' }, `${t('common.lvl')} ${fav.l | 0}`)) : null),
            actions, recordGrid(p.records || {}),
            h('div', { class: 'pp-sec' }, tabsEl, teamBox));
        };
        if (!tid) { draw(); return holder; }
        O.profile(tid).then(async (x) => {
          p = x;
          if (p && O.ready() && !mine) { try { fr = (await O.friends()).find((f) => f.trainer_id === tid) || null; } catch (e) { fr = null; } }
          draw();
        }).catch(() => put(holder, h('p', { class: 'warn-text' }, DK.icon('alert', 13), ' ', t('online.error'))));
        return holder;
      },
    });
  };

  /* ---------------- Amigos y buzón ---------------- */
  /** Añadir (= enviar o aceptar solicitud), rechazar o quitar, con su aviso. */
  async function friendAct(kind, tid) {
    const O = DK.online;
    const r = kind === 'add' ? await O.addFriend(tid) : kind === 'reject' ? await O.rejectFriend(tid) : await O.removeFriend(tid);
    const key = kind === 'add' ? (r === 'ok' ? 'sent' : r) : r === 'ok' ? (kind === 'reject' ? 'rejected' : 'removed') : r;
    const good = ['sent', 'accepted', 'rejected', 'removed', 'pending', 'already'].includes(key);
    toast(t('online.res.' + key), { icon: good ? 'check' : 'alert', kind: good ? 'good' : 'bad' });
    return r;
  }
  async function giftTo(tid) { const r = await DK.online.send(tid, 'gift', {}); toast(t('online.res.' + (r === 'ok' ? 'giftSent' : r)), { icon: r === 'ok' ? 'gift' : 'alert', kind: r === 'ok' ? 'good' : 'bad' }); }
  /** Invitar a intercambiar: abre una sala y le manda el código al buzón. */
  function inviteTrade(tid) {
    const m = V.tradeDialog(); if (!m) return;
    DK.trade.host();
    let sent = false;
    const off = DK.on('trade:changed', async (s) => {
      if (sent || !s || !s.code || s.role !== 'host' || (s.status !== 'waiting' && s.status !== 'open')) return;
      sent = true; off();
      const r = await DK.online.send(tid, 'trade', { code: s.code });
      toast(t('online.res.' + (r === 'ok' ? 'inviteSent' : r)), { icon: r === 'ok' ? 'swap' : 'alert', kind: r === 'ok' ? 'good' : 'bad' });
    });
    m.promise.then(() => off());
  }
  function reportDialog(tid, name) {
    const reasons = ['cheat', 'name', 'msg', 'other'];
    DK.ui.modal({ title: t('online.reportTitle', { name }), icon: 'alert', size: 'sm', content: (close) => h('div', { class: 'stack-s' }, h('p', { class: 'muted small' }, t('online.reportText')),
      reasons.map((r) => btn({ label: t('online.reason.' + r), variant: 'ghost', onClick: async () => { const x = await DK.online.report(tid, r); toast(t(x === 'ok' ? 'online.reported' : 'online.error'), { icon: 'check' }); DK.online.mute(tid, r === 'msg'); close(true); } }))) });
  }
  /** Escribir un mensaje (140 caracteres; se borra a las 24 h). */
  /** v5.42: escribir a un amigo = abrir vuestra conversación en el buzón. */
  V.composeMessage = (tid) => V.mailbox('friends', { fsel: tid });

  /* ---------------- Buzón (v5.41: dos paneles, sin cerrar y abrir la ventana) ---------------- */
  /** Lo que trae un regalo del equipo / de una noticia, en fichas. */
  V.giftChips = (g) => {
    if (!g) return null;
    const out = [];
    Object.entries(g.items || {}).forEach(([id, n]) => { const it = D.items[id]; if (it) out.push(h('span', { class: 'chip mb-gift' }, V.itemIcon(it, 18), `${DK.tr('items', it)} ×${n | 0}`)); });
    if (g.coins) out.push(h('span', { class: 'chip mb-gift' }, DK.icon('coin', 14), Number(g.coins).toLocaleString(DK.i18n.lang)));
    if (g.emblems) out.push(h('span', { class: 'chip mb-gift' }, DK.icon('award', 14), `${g.emblems} ${t('online.emblems')}`));
    return out.length ? h('div', { class: 'mb-gifts' }, out) : null;
  };
  const giftToast = (out) => { if (Array.isArray(out) && out.length) toast(t('online.giftGot'), { icon: 'gift', kind: 'good' }); };
  const agoTxt = (at) => { const m0 = (Date.now() - new Date(at).getTime()) / 60000; if (m0 < 1) return t('online.now'); const m = Math.max(1, Math.round(m0)); return m < 60 ? t('trade.agoMin', { n: m }) : m < 2880 ? t('trade.agoH', { n: Math.round(m / 60) }) : new Date(at).toLocaleDateString(DK.i18n.lang, { day: 'numeric', month: 'short' }); };
  const fullDate = (at) => new Date(at).toLocaleString(DK.i18n.lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  /** Imagen de un mensaje (sólo https). Al pulsarla se abre en grande. */
  V.mailImg = (u, cls = 'mb-img') => (DK.online.imgOk(u) ? h('a', { class: cls, href: u, target: '_blank', rel: 'noopener noreferrer' }, h('img', { src: u, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', decoding: 'async' })) : null);
  const narrow = () => window.matchMedia('(max-width: 700px)').matches; // (una sola columna en el buzón)
  const KIND = { news: ['megaphone', 'news'], msg: ['edit', 'msg'], gift: ['gift', 'gift'], agift: ['gift', 'team'], admin: ['shield', 'team'], friend: ['users', 'friend'], friendok: ['check', 'friend'], trade: ['swap', 'trade'], chat: ['edit', 'chat'] };

  /** Buzón y amigos. tab: inbox · friends · team */
  V.mailbox = (tab = 'inbox', o = {}) => {
    const O = DK.online, me = O.enabled() ? O.me() : {};
    // Si ya está abierto, sólo se cambia de pestaña / conversación
    if (V.mailbox.open) { V.mailbox.open.go(tab, o); return V.mailbox.open.m; }
    // Todo vive en S: cambiar de pestaña, elegir un mensaje o recoger un regalo sólo vuelve a dibujar el contenido
    const S = { tab, sel: null, items: null, friends: null, thread: null, claimed: [], read: new Set(), seen: { inbox: me.inboxSeen || 0, news: me.newsSeen || 0 }, busy: false, fsel: o.fsel || null, timer: null };
    const root = h('div', { class: 'mb' });
    const m = DK.ui.modal({ title: t('online.mailTitle'), icon: 'mail', cls: 'mb-modal', closeX: true, size: 'wide', content: () => root });
    // v5.42: con el buzón abierto se comprueba cada 4 s; lo nuevo aparece sin tener que cerrar y abrir
    const tick = setInterval(() => { if (!document.hidden) O.pollInbox(); }, 4000);
    const offChange = DK.on('online:change', () => { if (S.busy) return;
      if (S.tab === 'inbox') LOAD.inbox().then(() => { if (S.listEl && root.contains(S.listEl)) { const n = inboxList(); S.listEl.replaceWith(n); S.listEl = n; refreshHead(); } else draw(); }).catch(() => {});
      else if (S.tab === 'friends' && S.listEl) LOAD.friends().then(() => { const n = friendsList(); S.listEl.replaceWith(n); S.listEl = n; refreshHead(); }).catch(() => {}); else refreshHead(); });
    const stopChat = () => { if (S.timer) { clearInterval(S.timer); S.timer = null; } };
    V.mailbox.open = { m, go: (tb, oo = {}) => { S.tab = tb; if (oo.fsel) S.fsel = oo.fsel; if ((tb === 'inbox' && !S.items) || (tb === 'friends' && !S.friends) || (tb === 'team' && !S.thread)) reload(tb); else draw(); } };
    m.promise.then(() => { clearInterval(tick); stopChat(); offChange(); V.mailbox.open = null; });

    const loadInbox = async () => {
      const ready = O.ready();
      const [news, list, claimed, chats] = await Promise.all([O.news(), ready ? O.inbox() : Promise.resolve([]), O.newsClaimed(), ready ? O.dmThreads() : Promise.resolve([])]);
      O.markSeen(list, news);
      S.claimed = claimed;
      const myTid = DK.trainer.id();
      const it = news.map((n) => ({ key: 'n' + n.id, kind: 'news', at: n.created_at, pinned: n.pinned, unread: +n.id > S.seen.news, title: n.title, from: t('online.teamName'), text: n.body, img: n.img, gift: n.gift, raw: n }))
        .concat(list.map((x) => { const b = x.body || {}, team = x.from_tid === '@TEAM';
          return { key: 'm' + x.id, kind: x.kind, at: x.created_at, unread: +x.id > S.seen.inbox, team, from: team ? t('online.teamName') : x.from_name, tid: team ? null : x.from_tid,
            title: t('online.k.' + x.kind, { name: team ? t('online.teamName') : x.from_name }), text: b.text || '', img: b.img, gift: x.kind === 'agift' ? b.gift : x.kind === 'gift' ? { items: { pocion: 1 } } : null, code: b.code, raw: x }; }))
        // v5.42: cada conversación con un amigo es una entrada (al pulsarla se abre el chat)
        .concat(chats.map((c) => ({ key: 'c' + c.with_tid, kind: 'chat', at: c.last_at, unread: O.dmUnread(c.with_tid), from: c.name || '#' + c.with_tid, tid: c.with_tid,
          title: c.name || '#' + c.with_tid, text: (c.last_from === myTid ? t('online.you') + ': ' : '') + (c.last_body || ''), raw: c })));
      it.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.at) - new Date(a.at));
      S.items = it;
      if (S.sel && !it.find((x) => x.key === S.sel)) S.sel = null;
      if (!S.sel && it.length && !narrow()) S.sel = it[0].key;
    };
    const loadFriends = async () => { S.friends = await O.friends(); if (S.fsel && !S.friends.find((f) => f.trainer_id === S.fsel)) S.fsel = null; if (!S.fsel && S.friends.length && !narrow()) S.fsel = S.friends[0].trainer_id; };
    const loadThread = async () => { S.thread = await O.supportThread(); };
    const LOAD = { inbox: loadInbox, friends: loadFriends, team: loadThread };
    S.LOAD = LOAD;
    // v5.43.1: al recargar no se borra lo que hay: sólo si no había nada se enseña «Cargando…»; luego se cambia lo justo
    const has = (k) => (k === 'inbox' ? S.items : k === 'friends' ? S.friends : S.thread);
    async function reload(kind = S.tab) {
      const had = has(kind);
      S.busy = true; if (!had) draw();
      try { await LOAD[kind](); S.err = null; } catch (e) { S.err = true; }
      S.busy = false;
      if (kind !== S.tab) return;
      if (had && S.listEl && root.contains(S.listEl) && (kind === 'inbox' || kind === 'friends')) {
        const n = kind === 'inbox' ? inboxList() : friendsList(); S.listEl.replaceWith(n); S.listEl = n;
        if (kind === 'inbox') { const cur = S.items.find((x) => x.key === S.sel); if (!cur) { S.sel = null; root.classList.remove('show-detail'); } stopChat(); put(S.detailEl, cur ? detail(cur) : empty('mail', t('online.pickMsg'))); }
        else { const f = S.friends.find((x) => x.trainer_id === S.fsel); if (!f) { S.fsel = null; root.classList.remove('show-detail'); } stopChat(); put(S.detailEl, f ? (f.status === 'friend' ? friendChat(f) : friendDetail(f)) : empty('users', S.friends.length ? t('online.pickFriend') : t('online.noFriends'))); }
        refreshHead();
      } else draw();
    }
    const run = async (p) => { try { await p; } catch (e) { /* */ } await reload(); };

    function draw() {
      stopChat(); S.listEl = null;
      root.classList.toggle('show-detail', !!((S.tab === 'inbox' && S.sel) || (S.tab === 'friends' && S.fsel)));
      S.headEl = header();
      put(root, S.headEl, h('div', { class: 'mb-main' }, O.enabled() ? (S.tab === 'inbox' ? inboxView() : S.tab === 'friends' ? friendsView() : teamView()) : h('p', { class: 'muted' }, t('online.off'))));
    }
    const refreshHead = () => { if (!S.headEl) return; const n = header(); S.headEl.replaceWith(n); S.headEl = n; };
    function header() {
      const n = S.items ? S.items.filter((x) => x.unread && !S.read.has(x.key)).length : O.unread;
      return h('div', { class: 'mb-top' },
        h('div', { class: 'mb-tabs', role: 'tablist' }, [['inbox', 'mail'], ['friends', 'users'], ['team', 'shield']].map(([k, ic]) => h('button', { class: 'mb-tab' + (k === S.tab ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(k === S.tab),
          onClick: () => { if (k === S.tab) return; S.tab = k; if ((k === 'inbox' && !S.items) || (k === 'friends' && !S.friends) || (k === 'team' && !S.thread)) reload(k); else draw(); } },
          DK.icon(ic, 15), h('span', null, t('online.tab.' + k)), k === 'inbox' && n ? h('i', { class: 'mb-count' }, String(n))
            : k === 'friends' && (O.unreadDm || (S.friends && S.friends.some((f) => f.status === 'incoming'))) ? h('i', { class: 'mb-count' }, String((O.unreadDm | 0) + (S.friends ? S.friends.filter((f) => f.status === 'incoming').length : 0)))
              : k === 'team' && O.unreadSupport ? h('i', { class: 'mb-count' }, '1') : null))),
        h('button', { class: 'mb-id', type: 'button', tip: t('online.copyId'), onClick: () => { navigator.clipboard && navigator.clipboard.writeText(DK.trainer.id()).then(() => toast(t('trade.copied'), { icon: 'copy' }), () => {}); } },
          h('small', null, t('trade.yourId')), h('b', null, '#' + DK.trainer.id()), DK.icon('copy', 13)));
    }
    const needProfile = () => h('div', { class: 'mb-empty' }, DK.icon('user', 34), h('p', null, t('online.needPublic')), V.publishCard(() => { S.items = S.friends = S.thread = null; reload(); }));
    const empty = (ic, txt) => h('div', { class: 'mb-empty' }, DK.icon(ic, 34), h('p', { class: 'muted' }, txt));
    const loadingEl = () => h('div', { class: 'mb-empty' }, h('span', { class: 'mb-spin' }), h('p', { class: 'muted' }, t('online.loading')));
    const back = () => h('button', { class: 'mb-back', type: 'button', onClick: () => { if (S.tab === 'inbox') S.sel = null; else S.fsel = null; draw(); } }, DK.icon('back', 14), t('common.back'));

    /* ----- Buzón ----- */
    function inboxList() {
      const ready = O.ready();
      const list = h('div', { class: 'mb-list' + (S.busy ? ' busy' : '') },
        S.items.length ? S.items.map((x) => { const [ic, tone] = KIND[x.kind] || ['mail', 'msg'];
          return h('button', { class: `mb-item t-${tone}` + (x.key === S.sel ? ' on' : '') + (x.unread && !S.read.has(x.key) ? ' unread' : ''), type: 'button',
            'data-k': x.key, onClick: () => { if (x.kind === 'chat') { V.mailbox.open.go('friends', { fsel: x.tid }); return; } pickInbox(x.key); } },
            h('span', { class: 'mb-ic' }, DK.icon(x.pinned ? 'pin' : ic, 15)),
            h('span', { class: 'mb-it' }, h('span', { class: 'mb-it-top' }, h('b', null, x.kind === 'news' ? x.title : x.from), h('small', null, agoTxt(x.at))),
              h('small', { class: 'mb-snip' }, x.kind === 'news' ? (x.text || '').slice(0, 90) : x.text ? x.text.slice(0, 90) : x.title),
              x.gift || x.img ? h('span', { class: 'mb-flags' }, x.gift ? DK.icon('gift', 11) : null, x.img ? DK.icon('image', 11) : null) : null)); })
          : empty('mail', t('online.inboxEmpty')),
        ready ? null : h('div', { class: 'mb-note' }, h('small', { class: 'muted' }, t('online.needPublicInbox')), V.publishCard(() => { S.items = null; reload(); })));
      return list;
    }
    function inboxView() {
      if (!S.items) return S.err ? empty('alert', t('online.error')) : loadingEl();
      const list = S.listEl = inboxList();
      const cur = S.items.find((x) => x.key === S.sel);
      S.detailEl = h('div', { class: 'mb-detail' }, cur ? detail(cur) : empty('mail', t('online.pickMsg')));
      return h('div', { class: 'mb-split' }, list, S.detailEl);
    }
    /** v5.43.1: elegir un mensaje sólo cambia la parte derecha (la lista no se vuelve a dibujar: no parpadea). */
    function pickInbox(key) {
      S.sel = key; S.read.add(key);
      if (!S.detailEl || !root.contains(S.detailEl)) { draw(); return; }
      stopChat(); root.classList.add('show-detail');
      root.querySelectorAll('.mb-list .mb-item[data-k]').forEach((b) => { const on = b.dataset.k === key; b.classList.toggle('on', on); if (on) b.classList.remove('unread'); });
      const cur = S.items.find((x) => x.key === key);
      put(S.detailEl, cur ? detail(cur) : empty('mail', t('online.pickMsg')));
      refreshHead();
    }
    function pickFriend(tid) {
      S.fsel = tid;
      if (!S.detailEl || !root.contains(S.detailEl) || S.tab !== 'friends') { draw(); return; }
      stopChat(); root.classList.add('show-detail');
      root.querySelectorAll('.mb-list .mb-item[data-tid]').forEach((b) => { const on = b.dataset.tid === tid; b.classList.toggle('on', on); if (on) b.classList.remove('unread'); });
      const f = S.friends.find((x) => x.trainer_id === tid);
      put(S.detailEl, f ? (f.status === 'friend' ? friendChat(f) : friendDetail(f)) : empty('users', t('online.pickFriend')));
    }
    function detail(x) {
      const [ic, tone] = KIND[x.kind] || ['mail', 'msg'];
      const take = (fn) => run(fn());
      let actions = [];
      const del = btn({ icon: 'trash', label: t('online.delete'), size: 'sm', variant: 'ghost', onClick: () => { S.sel = null; take(() => O.take(x.raw.id)); } });
      if (x.kind === 'news') {
        if (x.gift) actions.push(S.claimed.includes(+x.raw.id) ? h('span', { class: 'chip pos' }, DK.icon('check', 12), t('online.claimedShort'))
          : O.ready() ? btn({ icon: 'gift', label: t('online.claim'), variant: 'primary', onClick: () => take(async () => { const r = await O.claimNews(x.raw); if (Array.isArray(r)) giftToast(r); else toast(t('online.gone'), { icon: 'alert', kind: 'bad' }); }) })
            : h('small', { class: 'muted' }, t('online.needPublicShort')));
      } else if (x.kind === 'gift' || x.kind === 'agift') {
        actions.push(btn({ icon: 'gift', label: t('online.claim'), variant: 'primary', onClick: () => { S.sel = null; take(async () => { const r = await O.claimGift(x.raw); if (r === 'claimed') giftToast([1]); else toast(t('online.gone'), { icon: 'alert', kind: 'bad' }); }); } }), del);
      } else if (x.kind === 'friend') {
        actions.push(btn({ icon: 'check', label: t('online.accept'), variant: 'primary', onClick: () => { S.sel = null; S.friends = null; take(() => friendAct('add', x.tid)); } }),
          btn({ icon: 'x', label: t('online.reject'), variant: 'ghost', onClick: () => { S.sel = null; take(() => friendAct('reject', x.tid)); } }));
      } else if (x.kind === 'trade') {
        actions.push(btn({ icon: 'swap', label: t('trade.join'), variant: 'primary', onClick: async () => { await O.take(x.raw.id); m.close(); const d = V.tradeDialog(); if (d) DK.trade.join(x.code); } }), del);
      } else if (x.kind === 'msg') actions.push(btn({ icon: 'edit', label: t('online.reply'), variant: 'primary', onClick: () => V.mailbox.open.go('friends', { fsel: x.tid }) }), del);
      else if (x.kind === 'admin') actions.push(btn({ icon: 'edit', label: t('online.reply'), variant: 'primary', onClick: () => { S.tab = 'team'; reload('team'); } }), del);
      else actions.push(del);
      return h('article', { class: 'mb-read t-' + tone },
        back(),
        h('header', { class: 'mb-read-h' }, h('span', { class: 'mb-ic big' }, DK.icon(x.pinned ? 'pin' : ic, 20)),
          h('div', null, h('h4', null, x.kind === 'news' ? x.title : x.title), h('small', { class: 'muted' },
            x.tid ? h('button', { class: 'linkish', type: 'button', onClick: () => V.publicProfile(x.tid) }, x.from + ' #' + x.tid) : x.from, ' · ', fullDate(x.at)))),
        x.text ? h('p', { class: 'mb-text' }, x.text) : x.kind === 'friend' ? h('p', { class: 'mb-text' }, t('online.reqFrom')) : x.kind === 'friendok' ? h('p', { class: 'mb-text' }, t('online.reqOk'))
          : x.kind === 'trade' ? h('p', { class: 'mb-text' }, t('online.inviteFrom', { code: x.code || '' })) : x.kind === 'gift' ? h('p', { class: 'mb-text' }, t('online.giftFrom')) : null,
        V.mailImg(x.img),
        x.gift ? h('div', { class: 'mb-giftbox' }, h('small', { class: 'bv-lbl' }, DK.icon('gift', 12), t('online.giftIn')), V.giftChips(x.gift)) : null,
        actions.length ? h('div', { class: 'mb-acts' }, actions) : null);
    }

    /* ----- Amigos: lista a la izquierda y vuestra conversación a la derecha ----- */
    function friendsList() {
      const inp = h('input', { class: 'trade-code-in mb-add-in', type: 'text', maxlength: 7, placeholder: 'ABC123', autocapitalize: 'characters', 'aria-label': t('online.friendId') });
      inp.addEventListener('input', () => { inp.value = DK.trade.cleanCode(inp.value); });
      const add = () => { if (inp.value.length === 6) run(friendAct('add', inp.value)); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      const grp = (st, key) => { const l = S.friends.filter((f) => f.status === st); return l.length ? [h('small', { class: 'mb-grp' }, t('online.grp.' + key, { n: l.length })), l.map((f) => { const av = f.avatar || {}, fv = f.fav && okSp(f.fav) ? f.fav : null;
        const unread = st === 'incoming' || (st === 'friend' && O.dmUnread(f.trainer_id) && f.trainer_id !== S.fsel);
        return h('button', { class: 'mb-item mb-friend' + (f.trainer_id === S.fsel ? ' on' : '') + (unread ? ' unread' : ''), type: 'button', 'data-tid': f.trainer_id, onClick: () => pickFriend(f.trainer_id) },
          h('span', { class: 'mb-av' }, V.avatar({ name: f.name, avatar: av.av || null }, { size: 34, avatar: av.av || (fv ? { kind: 'daskai', species: fv.s } : null) })),
          h('span', { class: 'mb-it' }, h('b', null, f.name), h('small', { class: 'mb-snip' }, st === 'friend' && O.dmUnread(f.trainer_id) ? t('online.newMsgs') : '#' + f.trainer_id + (f.title ? ' · ' + f.title : '')))); })] : null; };
      return h('div', { class: 'mb-list' + (S.busy ? ' busy' : '') },
        h('div', { class: 'mb-add' }, inp, btn({ icon: 'plus', label: t('online.addFriend'), size: 'sm', variant: 'tone', onClick: add })),
        S.friends.length ? [grp('incoming', 'incoming'), grp('friend', 'friends'), grp('sent', 'sent')] : h('p', { class: 'muted small mb-pad' }, t('online.friendsHelp')));
    }
    function friendsView() {
      if (!O.ready()) return needProfile();
      if (!S.friends) return S.err ? empty('alert', t('online.error')) : loadingEl();
      S.listEl = friendsList();
      const f = S.friends.find((x) => x.trainer_id === S.fsel);
      S.detailEl = h('div', { class: 'mb-detail' }, f ? (f.status === 'friend' ? friendChat(f) : friendDetail(f)) : empty('users', S.friends.length ? t('online.pickFriend') : t('online.noFriends')));
      return h('div', { class: 'mb-split' }, S.listEl, S.detailEl);
    }
    function friendDetail(f) {
      const av = f.avatar || {}, fv = f.fav && okSp(f.fav) ? f.fav : null, r = f.records || {};
      const acts = f.status === 'incoming' ? [btn({ icon: 'check', label: t('online.accept'), variant: 'primary', onClick: () => { S.items = null; run(friendAct('add', f.trainer_id)); } }), btn({ icon: 'x', label: t('online.reject'), variant: 'ghost', onClick: () => { S.fsel = null; run(friendAct('reject', f.trainer_id)); } })]
        : [h('span', { class: 'chip' }, DK.icon('clock', 12), t('online.pendingShort')), btn({ icon: 'x', label: t('online.cancelReq'), size: 'sm', variant: 'ghost', onClick: () => { S.fsel = null; run(friendAct('remove', f.trainer_id)); } })];
      return h('article', { class: 'mb-read' }, back(),
        h('header', { class: 'mb-read-h' }, h('span', { class: 'mb-av big' }, V.avatar({ name: f.name, avatar: av.av || null }, { size: 56, avatar: av.av || (fv ? { kind: 'daskai', species: fv.s } : null) })),
          h('div', null, h('h4', null, f.name), h('small', { class: 'muted' }, '#' + f.trainer_id + (f.title ? ' · ' + f.title : '')),
            h('div', null, h('span', { class: 'chip sm' }, t('online.st.' + f.status))))),
        recordGrid(r), h('div', { class: 'mb-acts' }, acts, btn({ icon: 'user', label: t('online.seeProfileShort'), size: 'sm', variant: 'ghost', onClick: () => V.publicProfile(f.trainer_id) })));
    }
    /** Un chat que se va completando solo: pide sólo lo nuevo (p_after) cada pocos segundos y añade burbujas sin redibujar. */
    function liveChat({ log, fetch, bubble, onLast, every }) {
      let last = 0, first = true;
      const pull = async () => {
        let list; try { list = await fetch(last); } catch (e) { return; }
        if (first) { log.replaceChildren(); first = false; if (!list.length) log.append(log._empty); }
        if (!list.length) return;
        if (log._empty && log._empty.parentNode) log._empty.remove();
        const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
        list.forEach((x) => { if (+x.id > last) { log.append(bubble(x)); last = +x.id; } });
        if (onLast) onLast(last);
        if (atEnd || list.length) log.scrollTop = log.scrollHeight;
      };
      pull(); stopChat(); S.timer = setInterval(() => { if (!document.hidden) pull(); }, every);
      return pull;
    }
    function friendChat(f) {
      const av = f.avatar || {}, fv = f.fav && okSp(f.fav) ? f.fav : null, myTid = DK.trainer.id();
      const log = h('div', { class: 'mb-chat' }, loadingEl());
      log._empty = empty('edit', t('online.chatEmpty'));
      const ta = h('textarea', { class: 'pm-text', maxlength: 300, rows: 1, placeholder: t('online.chatPlaceholder', { name: f.name }) });
      const pull = liveChat({ log, every: 3000, fetch: (after) => O.dmFetch(f.trainer_id, after), onLast: (id) => { O.markDm(f.trainer_id, id); },
        bubble: (x) => h('div', { class: 'mb-bubble' + (x.from_tid === myTid ? ' me' : ' them') }, h('p', null, x.body), h('small', { class: 'muted' }, agoTxt(x.created_at))) });
      const send = async () => {
        const txt = ta.value.trim(); if (!txt) return;
        ta.value = ''; ta.focus();
        const r = await O.dmSend(f.trainer_id, txt);
        if (r !== 'ok') { ta.value = txt; toast(t('online.res.' + r), { icon: 'alert', kind: 'bad' }); return; }
        pull();
      };
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      const ib = (icon, label, fn) => btn({ icon, label, iconOnly: true, size: 'sm', variant: 'ghost', onClick: fn });
      setTimeout(() => ta.focus(), 50);
      return h('div', { class: 'mb-dm' },
        h('header', { class: 'mb-dm-h' }, back(),
          h('button', { class: 'mb-dm-who linkish', type: 'button', onClick: () => V.publicProfile(f.trainer_id) }, h('span', { class: 'mb-av' }, V.avatar({ name: f.name, avatar: av.av || null }, { size: 36, avatar: av.av || (fv ? { kind: 'daskai', species: fv.s } : null) })),
            h('span', null, h('b', null, f.name), h('small', { class: 'muted' }, '#' + f.trainer_id + (f.title ? ' · ' + f.title : '')))),
          h('span', { class: 'grow' }),
          ib('gift', t('online.sendGift'), () => giftTo(f.trainer_id)), ib('swap', t('online.inviteTrade'), () => { m.close(); inviteTrade(f.trainer_id); }),
          ib('user', t('online.seeProfileShort'), () => V.publicProfile(f.trainer_id)), ib('x', t('online.removeFriend'), () => { S.fsel = null; run(friendAct('remove', f.trainer_id)); })),
        log, h('small', { class: 'muted mb-dm-note' }, t('online.chatNote')),
        h('div', { class: 'mb-compose' }, ta, btn({ icon: 'next', label: t('online.send'), iconOnly: true, variant: 'primary', onClick: send })));
    }

    /* ----- Equipo Daskai (soporte): también en vivo ----- */
    function teamView() {
      if (!O.ready()) return needProfile();
      if (!S.thread) return S.err ? empty('alert', t('online.error')) : loadingEl();
      const ta = h('textarea', { class: 'pm-text', maxlength: 500, rows: 1, placeholder: t('online.teamPlaceholder') });
      const log = h('div', { class: 'mb-chat' }, loadingEl());
      log._empty = empty('shield', t('online.teamEmpty'));
      const pull = liveChat({ log, every: 5000, fetch: async (after) => (await O.supportThread()).filter((x) => +x.id > after),
        onLast: () => { O.markSupport(O.last ? O.last.support | 0 : 0); },
        bubble: (x) => h('div', { class: 'mb-bubble' + (x.from_admin ? ' them' : ' me') },
          x.from_admin ? h('small', { class: 'mb-who' }, DK.icon('shield', 11), t('online.teamName')) : null,
          x.body ? h('p', null, x.body) : null, V.mailImg(x.img, 'mb-img sm'), h('small', { class: 'muted' }, agoTxt(x.created_at))) });
      const send = async () => { const txt = ta.value.trim(); if (!txt) return; ta.value = ''; const r = await O.support(txt); if (r !== 'ok') { ta.value = txt; toast(t('online.res.' + r), { icon: 'alert', kind: 'bad' }); } else pull(); };
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      return h('div', { class: 'mb-team' }, h('p', { class: 'muted small' }, t('online.teamHelp')), log,
        h('div', { class: 'mb-compose' }, ta, btn({ icon: 'next', label: t('online.send'), iconOnly: true, variant: 'primary', onClick: send })));
    }

    draw(); reload();
    return m;
  };
  V.friendsDialog = (tab) => V.mailbox(tab === 'friends' ? 'friends' : tab || 'inbox'); // (nombre antiguo)

  // Aviso cuando llega algo nuevo al buzón (se consulta cada pocos minutos)
  let lastUnread = 0;
  DK.on('online:inbox', (e) => { const n = (e && e.n) | 0; if (n > lastUnread && !V.mailbox.open) toast(t('online.newInbox', { n }), { icon: 'mail', onClick: () => V.mailbox('inbox') }); lastUnread = n; });

  /** Tarjeta para decidir si publicar (sale una vez, tras el primer récord). */
  V.publishAsk = (onDone) => {
    const O = DK.online; if (!O.shouldAsk()) return null;
    const name = (DK.store.state.player && DK.store.state.player.name) || '?';
    const card = h('div', { class: 'card lb-ask' },
      h('b', null, DK.icon('globe', 15), ' ', t('online.askTitle')),
      h('p', { class: 'muted small' }, t('online.askText2', { name, id: DK.trainer.id() })),
      h('div', { class: 'row gap-s wrap' },
        btn({ icon: 'upload', label: t('online.askYes'), variant: 'primary', onClick: async () => { card.remove(); const r = await O.setPublish(true); toast(r === 'error' ? t('online.error') : t('online.sent'), { icon: r === 'error' ? 'alert' : 'trophy', kind: r === 'error' ? 'bad' : 'good' }); if (onDone) onDone(); } }),
        btn({ label: t('online.askNo'), variant: 'ghost', onClick: () => { card.remove(); O.setPublish(false); if (onDone) onDone(); } })));
    return card;
  };
})();
