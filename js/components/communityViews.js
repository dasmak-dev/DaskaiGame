/* =============================================================
 * components/communityViews.js — v5.45: ventana «Comunidad» (duelos y clan) y resumen del combate.
 *
 *   V.community(tab)            → ventana con las pestañas Duelos y Clan ('duel' | 'clan')
 *   V.battleSummary(st, SUM)    → ventana con quién hizo qué en el combate
 *   V.battleMvp(st, SUM)        → línea corta con el mejor del combate (para el panel final)
 * ============================================================= */
(function () {
  const { h, btn, toast } = DK.ui;
  const V = DK.views, D = DK.data, t = (k, p) => DK.t(k, p);
  const put = (n, ...k) => n.replaceChildren(...k.flat(9).filter((x) => x != null && x !== false));
  const okSp = (x) => x && D.species[x.s];
  const pseudoD = (x) => ({ species: x.s, shiny: !!x.sh, look: x.lk || null, house2: x.h2 || undefined, form: x.f || 0, forms: x.fs || 0, level: x.l | 0, nickname: x.n });
  const teamRow = (team, size = 30) => h('span', { class: 'cm-team' }, (Array.isArray(team) ? team : []).slice(0, 6).map((x) => (okSp(x) ? h('span', { class: 'cm-mon', tip: `${x.n || D.species[x.s].name} · ${t('common.lvl')} ${x.l | 0}` }, V.dSprite(pseudoD(x), { size }), h('i', null, x.l | 0)) : null)));
  const ava = (name, av, size = 36) => { const a = av || {}; return V.avatar({ name, avatar: a.av || null, frame: a.fr || null }, { size, avatar: a.av || null }); };
  const fmt = (n) => (n | 0).toLocaleString(DK.i18n.lang);
  const ago = (at) => { const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000)); return m < 60 ? t('trade.agoMin', { n: m }) : m < 2880 ? t('trade.agoH', { n: Math.round(m / 60) }) : t('trade.agoD', { n: Math.round(m / 1440) }); };
  const spin = () => h('div', { class: 'cm-empty' }, h('span', { class: 'mb-spin' }), h('p', { class: 'muted' }, t('online.loading')));
  const empty = (ic, txt, extra) => h('div', { class: 'cm-empty' }, DK.icon(ic, 32), h('p', { class: 'muted' }, txt), extra || null);

  /* ======================= Ventana «Comunidad» ======================= */
  V.community = (tab = 'duel') => {
    if (V.community.open) { V.community.open.go(tab); return V.community.open.m; }
    const O = DK.online;
    const S = { tab, duel: null, dsub: 'rivals', board: null, clan: null, csub: 'chat', chat: [], chatMax: 0, search: null, q: '' };
    const root = h('div', { class: 'cm' });
    const m = DK.ui.modal({ title: t('cm.title'), icon: 'users', cls: 'cm-modal', closeX: true, size: 'wide', content: () => root });
    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    V.community.open = { m, go: (tb) => { S.tab = tb; draw(); } };
    m.promise.then(() => { stop(); V.community.open = null; });

    const tabs = () => h('div', { class: 'mb-tabs cm-tabs', role: 'tablist' }, [['duel', 'swords'], ['clan', 'flag']].map(([k, ic]) => h('button', { class: 'mb-tab' + (k === S.tab ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(k === S.tab),
      onClick: () => { if (k !== S.tab) { S.tab = k; draw(); } } }, DK.icon(ic, 15), h('span', null, t('cm.tab.' + k)), k === 'clan' && O.unreadClan ? h('i', { class: 'mb-count' }, String(O.unreadClan)) : null)));
    const body = h('div', { class: 'cm-body' });
    function draw() {
      stop();
      put(root, tabs(), body);
      if (!O.enabled()) return put(body, empty('globe', t('online.off')));
      if (DK.online.tainted() || !O.ready()) return put(body, empty('user', t('cm.needPublic'), V.publishCard(() => { S.duel = S.clan = null; draw(); })));
      if (S.tab === 'duel') duelView(); else clanView();
    }

    /* --------------------------- Duelos --------------------------- */
    async function loadDuel() { try { S.duel = await DK.duels.find(); S.derr = !S.duel || !!S.duel.error; } catch (e) { S.derr = true; } }
    async function duelView() {
      if (!S.duel && !S.derr) { put(body, spin()); await loadDuel(); if (S.tab !== 'duel') return; }
      if (S.derr) return put(body, empty('alert', t('cm.error'), btn({ icon: 'refresh', label: t('cm.retry'), size: 'sm', variant: 'ghost', onClick: () => { S.derr = false; S.duel = null; draw(); } })));
      const me = S.duel.me || {}, mine = DK.online.teamSnap(), paid = (() => { const x = DK.duels.stats(); return x.day === new Date().toISOString().slice(0, 10) ? x.paid | 0 : 0; })();
      const head = h('div', { class: 'du-head' },
        h('div', { class: 'du-rating' }, DK.icon('trophy', 22), h('div', null, h('small', null, t('duel.yourRating')), h('b', null, fmt(me.rating || 1000)))),
        h('div', { class: 'du-stats' },
          h('span', { tip: t('duel.recordTip') }, DK.icon('swords', 13), h('b', null, `${me.wins | 0}–${me.losses | 0}`)),
          h('span', { tip: t('duel.defTip') }, DK.icon('shield', 13), h('b', null, `${me.def_wins | 0}–${me.def_losses | 0}`)),
          h('span', { tip: t('duel.todayTip', { n: me.limit || 30 }) }, DK.icon('clock', 13), h('b', null, `${me.today | 0}/${me.limit || 30}`)),
          h('span', { tip: t('duel.coinsTip', { n: DK.duels.DAILY_REWARDS }) }, DK.icon('coin', 13), h('b', null, `${Math.max(0, DK.duels.DAILY_REWARDS - paid)}`))),
        h('div', { class: 'du-mine', tip: t('duel.defenderTip') }, h('small', null, t('duel.defender')), teamRow(mine, 26)));
      const sub = h('div', { class: 'seg-tabs cm-seg' }, [['rivals', t('duel.rivals')], ['board', t('duel.board')]].map(([k, l]) => h('button', { class: k === S.dsub ? 'on' : '', type: 'button', onClick: () => { S.dsub = k; draw(); } }, l)));
      const list = h('div', { class: 'du-list' });
      put(body, head, h('div', { class: 'cm-bar' }, sub, S.dsub === 'rivals' ? btn({ icon: 'refresh', label: t('duel.reroll'), size: 'sm', variant: 'ghost', onClick: () => { S.duel = null; draw(); } }) : null),
        S.dsub === 'rivals' ? h('p', { class: 'muted small cm-help' }, DK.icon('info', 12), ' ', t('duel.help')) : null, list);
      if (S.dsub === 'board') {
        if (!S.board) { put(list, spin()); try { S.board = await DK.duels.board(); } catch (e) { S.board = []; } if (S.dsub !== 'board' || S.tab !== 'duel') return; }
        const my = DK.trainer.id();
        return put(list, S.board.length ? h('ol', { class: 'du-board' }, S.board.map((r, i) => h('li', { class: r.tid === my ? 'mine' : '' },
          h('span', { class: 'du-pos' + (i < 3 ? ' top' + (i + 1) : '') }, i + 1), ava(r.name, r.avatar, 30),
          h('button', { class: 'du-name', type: 'button', onClick: () => V.publicProfile && V.publicProfile(r.tid) }, r.name, h('small', null, '#' + r.tid)),
          h('small', { class: 'muted' }, `${r.wins | 0}–${r.losses | 0}`), h('b', { class: 'du-pts' }, fmt(r.rating))))) : empty('trophy', t('duel.boardEmpty')));
      }
      const rivals = S.duel.rivals || [];
      if (!rivals.length) return put(list, empty('users', t('duel.noRivals')));
      const myPow = mine.reduce((a, x) => a + (x.l | 0), 0) || 1;
      put(list, rivals.map((r) => {
        const pow = (r.team || []).reduce((a, x) => a + (x.l | 0), 0), ratio = pow / myPow;
        const tone = ratio > 1.25 ? 'hard' : ratio < 0.8 ? 'easy' : 'even';
        const go = async (b) => {
          if ((me.today | 0) >= (me.limit || 30)) { toast(t('duel.err.limit'), { icon: 'clock', kind: 'bad' }); return; }
          b.disabled = true;
          const err = await DK.duels.start(r.tid);
          if (err) { b.disabled = false; toast(t('duel.err.' + err) || t('cm.error'), { icon: 'alert', kind: 'bad' }); if (err === 'norival') { S.duel = null; draw(); } return; }
          m.close();
        };
        const fight = btn({ icon: 'swords', label: t('duel.fight'), size: 'sm', variant: 'primary', onClick: () => go(fight) });
        return h('div', { class: 'du-card t-' + tone },
          h('div', { class: 'du-who' }, ava(r.name, r.avatar, 40), h('div', null, h('button', { class: 'du-name', type: 'button', onClick: () => V.publicProfile && V.publicProfile(r.tid) }, r.name), h('small', { class: 'muted' }, '#' + r.tid + (r.title ? ' · ' + r.title : '')))),
          teamRow(r.team, 30),
          h('div', { class: 'du-side' }, h('span', { class: 'du-pts', tip: t('duel.ratingTip') }, DK.icon('trophy', 12), fmt(r.rating)), h('span', { class: 'du-tone ' + tone }, t('duel.tone.' + tone)), fight));
      }));
    }

    /* ---------------------------- Clan ---------------------------- */
    async function loadClan() { try { S.clan = await DK.clans.info(); S.cerr = !S.clan || !!S.clan.error; } catch (e) { S.cerr = true; } }
    async function clanView() {
      if (!S.clan && !S.cerr) { put(body, spin()); await loadClan(); if (S.tab !== 'clan') return; }
      if (S.cerr) return put(body, empty('alert', t('cm.error'), btn({ icon: 'refresh', label: t('cm.retry'), size: 'sm', variant: 'ghost', onClick: () => { S.cerr = false; S.clan = null; draw(); } })));
      if (!S.clan.clan) return noClan();
      const C = S.clan, c = C.clan, lead = C.role === 'leader', staff = C.role !== 'member';
      const head = h('div', { class: 'cl-head', style: { '--cc': c.color || '#b45309' } },
        h('span', { class: 'cl-emb' }, DK.icon(c.icon || 'flag', 26)),
        h('div', { class: 'cl-tt' }, h('b', null, h('span', { class: 'cl-tag' }, c.tag), ' ', c.name), h('small', { class: 'muted' }, c.descr || t('clan.noDescr'))),
        h('div', { class: 'cl-meta' }, h('span', null, DK.icon('users', 13), `${C.members.length}/20`), h('span', null, DK.icon(c.open ? 'check' : 'lock', 13), t(c.open ? 'clan.open' : 'clan.closed')), h('span', { class: 'cl-role r-' + C.role }, t('clan.role.' + C.role))));
      const reqN = (C.requests || []).length;
      const subs = [['chat', 'mail', t('clan.chat')], ['members', 'users', t('clan.members') + (reqN ? ` (${reqN})` : '')], ['contract', 'scroll', t('clan.contract')]].concat(lead ? [['settings', 'settings', t('clan.settings')]] : []);
      const sub = h('div', { class: 'seg-tabs cm-seg' }, subs.map(([k, ic, l]) => h('button', { class: k === S.csub ? 'on' : '', type: 'button', onClick: () => { S.csub = k; draw(); } }, DK.icon(ic, 13), ' ', l)));
      const pane = h('div', { class: 'cl-pane' });
      put(body, head, h('div', { class: 'cm-bar' }, sub), pane);
      if (S.csub === 'chat') chatPane(pane);
      else if (S.csub === 'members') membersPane(pane, C, lead, staff);
      else if (S.csub === 'contract') contractPane(pane, C);
      else editPane(pane, c);
    }
    function noClan() {
      const q = h('input', { class: 'input cl-q', type: 'search', placeholder: t('clan.searchPh'), value: S.q, onInput: (e) => { S.q = e.target.value; clearTimeout(S.qt); S.qt = setTimeout(load, 350); } });
      const list = h('div', { class: 'cl-list' });
      const pending = (S.clan.pending || []).map((p) => p.id);
      async function load() {
        put(list, spin());
        try { S.search = await DK.clans.search(S.q.trim()); } catch (e) { S.search = null; }
        if (!S.search) return put(list, empty('alert', t('cm.error')));
        put(list, S.search.length ? S.search.map((c) => {
          const full = c.members >= 20, asked = pending.includes(c.id);
          const b = btn({ icon: c.open ? 'plus' : 'mail', label: asked ? t('clan.asked') : t(c.open ? 'clan.join' : 'clan.ask'), size: 'sm', variant: c.open ? 'primary' : 'tone', disabled: full || asked,
            onClick: async () => { b.disabled = true; const r = await DK.clans.join(c.id); toast(t('clan.r.' + r) || r, { icon: 'flag', kind: r === 'joined' || r === 'requested' ? 'good' : 'bad' }); S.clan = null; draw(); } });
          return h('div', { class: 'cl-row', style: { '--cc': c.color || '#b45309' } }, h('span', { class: 'cl-emb sm' }, DK.icon(c.icon || 'flag', 18)),
            h('div', { class: 'cl-tt' }, h('b', null, h('span', { class: 'cl-tag' }, c.tag), ' ', c.name), h('small', { class: 'muted' }, c.descr || '')),
            h('span', { class: 'cl-n', tip: t('clan.membersTip') }, DK.icon('users', 12), `${c.members}/20`),
            h('span', { class: 'cl-n', tip: t('clan.weekTip') }, DK.icon('trophy', 12), fmt(c.week)), b);
        }) : empty('flag', S.q ? t('clan.noResults') : t('clan.none')));
      }
      put(body, h('div', { class: 'cl-intro' }, DK.icon('flag', 28), h('div', null, h('b', null, t('clan.introTitle')), h('p', { class: 'muted small' }, t('clan.intro'))),
        btn({ icon: 'plus', label: t('clan.create'), variant: 'primary', onClick: createDialog })),
        (S.clan.pending || []).length ? h('p', { class: 'small cl-pend' }, DK.icon('clock', 12), ' ', t('clan.pending', { list: S.clan.pending.map((p) => `[${p.tag}] ${p.name}`).join(', ') })) : null,
        h('div', { class: 'cm-bar' }, q), list);
      load();
    }
    function clanForm(c, onSave, okLabel) {
      const F = { tag: c.tag || '', name: c.name || '', descr: c.descr || '', icon: c.icon || 'flag', color: c.color || DK.clans.COLORS[0], open: c.open !== false };
      const prev = h('span', { class: 'cl-emb' });
      const paint = () => { prev.style.setProperty('--cc', F.color); put(prev, DK.icon(F.icon, 26)); };
      const icons = h('div', { class: 'cl-pick' }, DK.clans.ICONS.map((ic) => h('button', { class: 'cl-ic' + (ic === F.icon ? ' on' : ''), type: 'button', onClick: (e) => { F.icon = ic; icons.querySelectorAll('.cl-ic').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); paint(); } }, DK.icon(ic, 16))));
      const colors = h('div', { class: 'cl-pick' }, DK.clans.COLORS.map((col) => h('button', { class: 'cl-col' + (col === F.color ? ' on' : ''), type: 'button', style: { background: col }, 'aria-label': col, onClick: (e) => { F.color = col; colors.querySelectorAll('.cl-col').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); paint(); } })));
      const field = (label, el) => h('label', { class: 'cl-f' }, h('small', null, label), el);
      const err = h('small', { class: 'warn-text' });
      paint();
      const open = h('input', { type: 'checkbox', checked: F.open, onChange: (e) => { F.open = e.target.checked; } });
      const save = btn({ icon: 'check', label: okLabel, variant: 'primary', onClick: async () => {
        F.tag = F.tag.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c.tag == null && !/^[A-Z0-9]{2,4}$/.test(F.tag)) { err.textContent = t('clan.badTag'); return; }
        if (F.name.trim().length < 3) { err.textContent = t('clan.badName'); return; }
        save.disabled = true; const r = await onSave(F); save.disabled = false;
        if (r !== 'ok') err.textContent = t('clan.r.' + r) || t('cm.error');
      } });
      return h('div', { class: 'cl-form' },
        h('div', { class: 'cl-form-top' }, prev, h('div', { class: 'cl-form-tt' },
          c.tag == null ? field(t('clan.tag'), h('input', { class: 'input cl-tagin', maxlength: 4, value: F.tag, placeholder: 'DK', onInput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); F.tag = e.target.value; } })) : null,
          field(t('clan.name'), h('input', { class: 'input', maxlength: 24, value: F.name, onInput: (e) => { F.name = e.target.value; } })))),
        field(t('clan.descr'), h('textarea', { class: 'input', maxlength: 160, rows: 2, onInput: (e) => { F.descr = e.target.value; } }, F.descr)),
        field(t('clan.icon'), icons), field(t('clan.color'), colors),
        h('label', { class: 'cl-chk' }, open, h('span', null, t('clan.openLabel')), h('small', { class: 'muted' }, t('clan.openHelp'))),
        err, h('div', { class: 'row gap-s end' }, save));
    }
    function createDialog() {
      const md = DK.ui.modal({ title: t('clan.create'), icon: 'flag', cls: 'cl-modal', closeX: true, content: () => clanForm({}, async (F) => {
        const r = await DK.clans.create(F);
        if (r === 'ok') { md.close(); toast(t('clan.created', { name: F.name }), { icon: 'flag', kind: 'good' }); S.clan = null; S.csub = 'members'; draw(); }
        return r;
      }, t('clan.createBtn')) });
    }
    function editPane(pane, c) {
      put(pane, clanForm(c, async (F) => { const r = await DK.clans.edit(F); if (r === 'ok') { toast(t('clan.saved'), { icon: 'check', kind: 'good' }); S.clan = null; draw(); } return r; }, t('clan.saveBtn')));
    }
    function chatPane(pane) {
      const myTid = DK.trainer.id();
      const list = h('div', { class: 'cl-chat' });
      const msg = (x) => {
        if (x.from_tid === '@SYS') { const [k, name] = String(x.body).split(':'); return h('div', { class: 'cl-sys' }, t('clan.sys.' + k, { name: name || '?' })); }
        const mine = x.from_tid === myTid;
        return h('div', { class: 'cl-msg' + (mine ? ' mine' : '') }, mine ? null : h('button', { class: 'cl-from', type: 'button', onClick: () => V.publicProfile && V.publicProfile(x.from_tid) }, x.name || '#' + x.from_tid),
          h('span', { class: 'cl-txt' }, x.body), h('small', { class: 'cl-at', tip: new Date(x.created_at).toLocaleString(DK.i18n.lang) }, ago(x.created_at)));
      };
      const paint = (scroll) => { const near = list.scrollHeight - list.scrollTop - list.clientHeight < 60; put(list, S.chat.length ? S.chat.map(msg) : h('p', { class: 'muted small cl-sys' }, t('clan.chatEmpty'))); if (scroll || near) list.scrollTop = list.scrollHeight; };
      const input = h('input', { class: 'input', maxlength: 300, placeholder: t('clan.chatPh'), onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } } });
      const sendB = btn({ icon: 'next', label: t('clan.send'), size: 'sm', variant: 'primary', onClick: () => send() });
      async function send() {
        const v = input.value.trim(); if (!v) return;
        input.value = ''; sendB.disabled = true;
        const r = await DK.clans.say(v); sendB.disabled = false;
        if (r !== 'ok') { toast(t('clan.r.' + r) || t('cm.error'), { icon: 'alert', kind: 'bad' }); input.value = v; return; }
        await pull(true); input.focus();
      }
      async function pull(scroll) {
        try {
          const add = await DK.clans.chat(S.chatMax);
          if (add.length) { S.chat = S.chat.concat(add).slice(-200); S.chatMax = Math.max(S.chatMax, ...add.map((x) => +x.id)); DK.clans.markSeen(S.chatMax); }
          if (add.length || scroll) paint(scroll);
        } catch (e) { /* */ }
      }
      put(pane, list, h('div', { class: 'cl-say' }, input, sendB));
      paint(true); pull(true);
      timer = setInterval(() => { if (!document.hidden) pull(false); }, 4000);
    }
    function membersPane(pane, C, lead, staff) {
      const myTid = DK.trainer.id();
      const act = async (a, tid, name) => {
        if ((a === 'kick' || a === 'transfer') && !(await DK.ui.confirm(t('clan.q.' + a, { name }), t('clan.q.' + a + 'Text', { name }), { danger: a === 'kick' }))) return;
        const r = await DK.clans.manage(a, tid); toast(r === 'ok' ? t('clan.done.' + a, { name }) : (t('clan.r.' + r) || r), { icon: 'users', kind: r === 'ok' ? 'good' : 'bad' }); S.clan = null; draw();
      };
      const reqs = (C.requests || []).map((r) => h('div', { class: 'cl-mem req' }, ava(r.name, r.avatar, 32),
        h('div', { class: 'cl-tt' }, h('b', null, r.name), h('small', { class: 'muted' }, t('clan.wants', { ago: ago(r.at) }))),
        h('div', { class: 'cl-acts' }, btn({ icon: 'check', label: t('clan.accept'), size: 'sm', variant: 'primary', onClick: () => act('accept', r.tid, r.name) }), btn({ icon: 'x', size: 'sm', variant: 'ghost', tip: t('clan.reject'), onClick: () => act('reject', r.tid, r.name) }))));
      const rows = C.members.map((x, i) => {
        const me = x.tid === myTid, canKick = !me && (lead || (staff && x.role === 'member'));
        return h('div', { class: 'cl-mem' + (me ? ' me' : '') }, h('span', { class: 'cl-i' }, i + 1), ava(x.name, x.avatar, 32),
          h('div', { class: 'cl-tt' }, h('button', { class: 'cl-from', type: 'button', onClick: () => V.publicProfile && V.publicProfile(x.tid) }, x.name), h('small', { class: 'muted' }, `#${x.tid} · ${t('clan.seen', { ago: ago(x.seen) })}`)),
          h('span', { class: 'cl-role r-' + x.role }, x.role === 'leader' ? DK.icon('crown', 11) : null, t('clan.role.' + x.role)),
          h('span', { class: 'cl-score', tip: t('clan.scoreTip') }, DK.icon('trophy', 12), fmt(x.score)),
          h('div', { class: 'cl-acts' },
            lead && !me && x.role === 'member' ? btn({ icon: 'arrowUp', size: 'sm', variant: 'ghost', tip: t('clan.promote'), onClick: () => act('promote', x.tid, x.name) }) : null,
            lead && !me && x.role === 'officer' ? btn({ icon: 'arrowDown', size: 'sm', variant: 'ghost', tip: t('clan.demote'), onClick: () => act('demote', x.tid, x.name) }) : null,
            lead && !me ? btn({ icon: 'crown', size: 'sm', variant: 'ghost', tip: t('clan.transfer'), onClick: () => act('transfer', x.tid, x.name) }) : null,
            canKick ? btn({ icon: 'exit', size: 'sm', variant: 'ghost', tip: t('clan.kick'), onClick: () => act('kick', x.tid, x.name) }) : null));
      });
      const leave = btn({ icon: 'exit', label: t('clan.leave'), size: 'sm', variant: 'ghost', onClick: async () => {
        if (!(await DK.ui.confirm(t('clan.q.leave'), C.members.length <= 1 ? t('clan.q.leaveLast') : lead ? t('clan.q.leaveLead') : t('clan.q.leaveText'), { danger: true }))) return;
        await DK.clans.leave(); S.clan = null; S.chat = []; S.chatMax = 0; draw();
      } });
      put(pane, reqs.length ? [h('small', { class: 'mb-grp' }, t('clan.requests', { n: reqs.length })), reqs, h('small', { class: 'mb-grp' }, t('clan.members'))] : null, h('div', { class: 'cl-mems' }, rows), h('div', { class: 'row end cl-leave' }, leave));
    }
    function contractPane(pane, C) {
      const tiers = C.tiers || DK.clans.TIERS, top = tiers[tiers.length - 1], total = C.total | 0, claimed = (C.claimed || []).map(Number);
      const pct = (v) => Math.min(100, (v / top) * 100);
      const bar = h('div', { class: 'cl-prog' }, h('i', { style: { width: pct(total) + '%' } }),
        tiers.map((v, i) => h('span', { class: 'cl-mark' + (total >= v ? ' on' : ''), style: { left: pct(v) + '%' } }, h('b', null, ['I', 'II', 'III'][i]))));
      const rewardChips = (g) => h('span', { class: 'cl-rw' }, g.coins ? h('span', { class: 'chip' }, DK.icon('coin', 12), fmt(g.coins)) : null, g.emblems ? h('span', { class: 'chip' }, DK.icon('emblem', 12), '×' + g.emblems) : null,
        Object.entries(g.items || {}).map(([id, n]) => (D.items[id] ? h('span', { class: 'chip' }, V.itemIcon ? V.itemIcon(D.items[id], 14) : DK.icon('gift', 12), `${D.items[id].name} ×${n}`) : null)));
      const rows = tiers.map((v, i) => {
        const tier = i + 1, done = claimed.includes(tier), ready = total >= v;
        const b = btn({ icon: done ? 'check' : 'gift', label: done ? t('clan.claimed') : t('clan.claim'), size: 'sm', variant: ready && !done ? 'primary' : 'ghost', disabled: !ready || done, onClick: async () => {
          b.disabled = true; const r = await DK.clans.claim(tier);
          toast(r === 'ok' ? t('clan.gotReward') : t('clan.r.' + r) || r, { icon: 'gift', kind: r === 'ok' ? 'good' : 'bad' }); S.clan = null; S.csub = 'contract'; draw(); } });
        return h('div', { class: 'cl-tier' + (ready ? ' ready' : '') + (done ? ' done' : '') }, h('span', { class: 'cl-tn' }, ['I', 'II', 'III'][i]),
          h('div', { class: 'cl-tt' }, h('b', null, t('clan.goal', { n: fmt(v) })), rewardChips(DK.clans.reward(tier))), b);
      });
      put(pane, h('div', { class: 'cl-contract' },
        h('div', { class: 'cl-ctop' }, h('div', null, h('small', { class: 'muted' }, t('clan.weekN', { n: C.week, d: DK.weekly ? DK.weekly.daysLeft() : '?' })), h('b', { class: 'cl-total' }, fmt(total), h('small', null, ' / ' + fmt(top)))),
          DK.weekly && DK.weekly.unlocked && DK.weekly.unlocked() ? btn({ icon: 'scroll', label: t('clan.playWeekly'), size: 'sm', variant: 'tone', onClick: () => { m.close(); DK.router.reset('zones'); } }) : null),
        bar, h('p', { class: 'muted small' }, DK.icon('info', 12), ' ', t('clan.contractHelp')), rows));
    }

    draw();
    return m;
  };

  /* ======================= Resumen del combate ======================= */
  const nameOf = (st, side, uid) => {
    if (side === 'a') { const d = DK.party.get(uid) || (st.allyCache && st.allyCache.uid === uid ? st.allyCache : null); return d ? { name: DK.daskai.name(d), d } : null; }
    const all = (st.wave && st.wave.all) || [st.enemy], d = all.find((x) => x.uid === uid);
    return d ? { name: st.boss && st.bossInfo ? st.bossInfo.title : DK.daskai.name(d), d } : null;
  };
  const mvpOf = (SUM) => Object.values(SUM.a).sort((x, y) => (y.dmg + y.kos * 400 + y.heal * 0.5) - (x.dmg + x.kos * 400 + x.heal * 0.5))[0];
  V.battleMvp = (st, SUM) => {
    if (!SUM) return null;
    const mvp = mvpOf(SUM); if (!mvp || !(mvp.dmg || mvp.kos)) return null;
    const who = nameOf(st, 'a', mvp.uid); if (!who) return null;
    return h('button', { class: 'bs-mvp', type: 'button', tip: t('bsum.open'), onClick: () => V.battleSummary(st, SUM) }, DK.icon('crown', 14), h('span', null, t('bsum.mvp')), V.dSprite(who.d, { size: 22 }),
      h('b', null, who.name), h('small', null, t('bsum.mvpLine', { dmg: fmt(mvp.dmg), kos: mvp.kos })));
  };
  V.battleSummary = (st, SUM) => {
    const allies = Object.values(SUM.a).filter((r) => nameOf(st, 'a', r.uid) && (r.dmg || r.taken || r.heal || r.moves));
    const foes = Object.values(SUM.e).filter((r) => nameOf(st, 'e', r.uid));
    const maxD = Math.max(1, ...allies.map((r) => r.dmg), ...foes.map((r) => r.dmg)), maxT = Math.max(1, ...allies.map((r) => r.taken), ...foes.map((r) => r.taken));
    const mvp = mvpOf(SUM);
    const row = (side) => (r) => {
      const who = nameOf(st, side, r.uid);
      return h('div', { class: 'bsm-row ' + side + (side === 'a' && mvp && r.uid === mvp.uid ? ' mvp' : '') + (r.fell ? ' fell' : '') },
        h('span', { class: 'bsm-who' }, V.dSprite(who.d, { size: 30 }), h('span', null, h('b', null, who.name), h('small', { class: 'muted' }, `${t('common.lvl')} ${who.d.level}` + (r.fell ? ' · ' + t('bsum.fell') : '')))),
        h('span', { class: 'bsm-bars' },
          h('span', { class: 'bsm-bar dmg', tip: t('bsum.dmg') }, h('i', { style: { width: (r.dmg / maxD) * 100 + '%' } }), h('em', null, DK.icon('swords', 11), fmt(r.dmg))),
          h('span', { class: 'bsm-bar taken', tip: t('bsum.taken') }, h('i', { style: { width: (r.taken / maxT) * 100 + '%' } }), h('em', null, DK.icon('shield', 11), fmt(r.taken)))),
        h('span', { class: 'bsm-nums' },
          r.heal ? h('span', { tip: t('bsum.heal') }, DK.icon('heart', 11), fmt(r.heal)) : null,
          r.kos ? h('span', { tip: t('bsum.kos') }, DK.icon('skull', 11), r.kos) : null,
          r.crits ? h('span', { tip: t('bsum.crits') }, DK.icon('bolt', 11), r.crits) : null,
          side === 'a' && mvp && r.uid === mvp.uid ? h('span', { class: 'bsm-crown', tip: t('bsum.mvp') }, DK.icon('crown', 12)) : null));
    };
    const topMove = Object.entries(SUM.moves).sort((a, b) => b[1] - a[1])[0];
    const big = SUM.big, bigWho = big && nameOf(st, 'a', big.uid);
    const fact = (ic, label, val) => h('div', { class: 'bsm-fact' }, DK.icon(ic, 16), h('small', null, label), h('b', null, val));
    const totalD = allies.reduce((a, r) => a + r.dmg, 0), totalT = allies.reduce((a, r) => a + r.taken, 0);
    DK.ui.modal({ title: t('bsum.title'), icon: 'chart', cls: 'bsm-modal', closeX: true, content: () => h('div', { class: 'bsm' },
      h('div', { class: 'bsm-facts' },
        fact('clock', t('bsum.turns'), st.turn | 0),
        fact('swords', t('bsum.totalDmg'), fmt(totalD)),
        fact('shield', t('bsum.totalTaken'), fmt(totalT)),
        fact('target', t('bsum.strong'), SUM.strong | 0),
        big && bigWho ? fact('bolt', t('bsum.biggest'), `${fmt(big.n)}${big.crit ? '!' : ''}`) : null),
      big && bigWho ? h('p', { class: 'small bsm-key' }, DK.icon('sparkles', 12), ' ', t('bsum.bigLine', { name: bigWho.name, n: fmt(big.n), move: big.move && D.moves[big.move] ? D.moves[big.move].name : '—' })) : null,
      topMove && D.moves[topMove[0]] ? h('p', { class: 'small bsm-key' }, DK.icon('repeat', 12), ' ', t('bsum.topMove', { move: D.moves[topMove[0]].name, n: topMove[1] })) : null,
      h('small', { class: 'mb-grp' }, t('bsum.yours')), h('div', { class: 'bsm-list' }, allies.length ? allies.sort((x, y) => y.dmg - x.dmg).map(row('a')) : h('p', { class: 'muted small' }, '—')),
      h('small', { class: 'mb-grp' }, st.duel ? t('bsum.theirsDuel', { name: st.duel.name }) : t('bsum.theirs')), h('div', { class: 'bsm-list' }, foes.map(row('e')))) });
  };
})();
