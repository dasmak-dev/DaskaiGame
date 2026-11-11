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
        const draw = () => holder.replaceChildren(
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
        const draw = () => holder.replaceChildren(view());
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

  /* ---------------- Tabla global ---------------- */
  const teamIcons = (team) => h('span', { class: 'lb-team' }, (Array.isArray(team) ? team : []).slice(0, 6).map((x) => (x && D.species[x.s] ? h('span', { tip: `${D.species[x.s].name} · ${t('common.lvl')} ${x.l | 0}` }, V.sprite(x.s, { size: 36, shiny: !!x.sh })) : null)));
  V.leaderboard = (season) => {
    const O = DK.online, cur = O.season(), sea = season || cur;
    return DK.ui.modal({
      title: t('online.boardTitle'), icon: 'trophy', cls: 'lb-modal', closeX: true, size: 'wide',
      content: (close) => {
        const holder = h('div', { class: 'lb-body' }, h('p', { class: 'muted' }, DK.icon('clock', 13), ' ', t('online.loading')));
        if (!O.enabled()) { holder.replaceChildren(h('p', { class: 'muted' }, DK.icon('info', 13), ' ', t('online.off'))); return holder; }
        const me = O.me();
        const pub = h('div', { class: 'lb-pub row gap-s wrap' }, h('small', { class: 'muted' }, me.publish ? t('online.pubOn') : t('online.pubOff')),
          btn({ label: me.publish ? t('online.pubStop') : t('online.pubStart'), size: 'sm', variant: 'ghost', onClick: async () => { await O.setPublish(!me.publish); close(); V.leaderboard(sea); } }));
        // v5.34: una tabla por temporada (la actual se vacía al empezar la siguiente; la anterior se puede consultar)
        const head = h('div', { class: 'lb-season row gap-s wrap' },
          h('span', { class: 'chip' }, DK.icon('flag', 12), t('online.season', { n: sea })),
          sea === cur ? h('small', { class: 'muted' }, t('online.resetIn', { n: O.daysLeft() })) : h('small', { class: 'muted' }, t('online.pastSeason')),
          h('span', { class: 'grow' }),
          cur > 1 ? h('div', { class: 'egx-seg' },
            h('button', { class: sea === cur ? 'on' : '', type: 'button', onClick: () => { if (sea !== cur) { close(); V.leaderboard(cur); } } }, t('online.thisSeason')),
            h('button', { class: sea !== cur ? 'on' : '', type: 'button', onClick: () => { if (sea === cur) { close(); V.leaderboard(cur - 1); } } }, t('online.lastSeason'))) : null);
        O.board(50, sea).then((rows) => {
          if (!rows.length) { holder.replaceChildren(head, h('p', { class: 'muted' }, t(sea === cur ? 'online.empty' : 'online.emptyPast')), pub); return; }
          holder.replaceChildren(head, h('p', { class: 'muted small' }, t('online.boardHelp')),
            h('div', { class: 'lb-table', role: 'table' },
              h('div', { class: 'lb-row head', role: 'row' }, ['#', t('online.player'), t('online.floors'), t('online.bosses'), t('online.foeLv'), t('online.team')].map((x) => h('span', { role: 'columnheader' }, x))),
              rows.map((r, i) => h('div', { class: 'lb-row' + (r.player_id === me.id ? ' me' : '') + (i < 3 ? ' top' + (i + 1) : ''), role: 'row' },
                h('span', { class: 'lb-rank' }, i < 3 ? DK.icon('crown', 14) : null, String(i + 1)),
                h('b', { class: 'lb-name' }, String(r.name || '?').slice(0, 20)),
                h('span', { class: 'lb-floors' }, String(r.floors)), h('span', null, String(r.maps)), h('span', null, `${t('common.lvl')} ${r.level}`),
                teamIcons(r.team)))), pub);
        }).catch(() => holder.replaceChildren(h('p', { class: 'warn-text' }, DK.icon('alert', 13), ' ', t('online.error'))));
        return holder;
      },
      actions: [{ label: t('common.close'), icon: 'x', variant: 'ghost', value: false }],
    });
  };
  /** Tarjeta para decidir si publicar (sale una vez, tras el primer récord del Averno). */
  V.publishAsk = (onDone) => {
    const O = DK.online; if (!O.shouldAsk()) return null;
    const me = O.me(), name = (DK.store.state.player && DK.store.state.player.name) || '?';
    const card = h('div', { class: 'card lb-ask' },
      h('b', null, DK.icon('globe', 15), ' ', t('online.askTitle')),
      h('p', { class: 'muted small' }, t('online.askText', { name, n: me.pending.p_floors })),
      h('div', { class: 'row gap-s wrap' },
        btn({ icon: 'upload', label: t('online.askYes'), variant: 'primary', onClick: async () => { card.remove(); const r = await O.setPublish(true); toast(r === 'error' ? t('online.error') : t('online.sent'), { icon: r === 'error' ? 'alert' : 'trophy', kind: r === 'error' ? 'bad' : 'good' }); if (onDone) onDone(); } }),
        btn({ label: t('online.askNo'), variant: 'ghost', onClick: () => { card.remove(); O.setPublish(false); if (onDone) onDone(); } })));
    return card;
  };
})();
