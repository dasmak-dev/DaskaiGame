/* =============================================================
 * screens/camp.js — Mejoras: mejoras permanentes (data/upgrades.js, DK.camp).
 *
 * Se pagan con EMBLEMAS (1 por jefe derrotado) y se compran AL TERMINAR
 * cada expedición, en su resumen (screens/expSummary.js usa
 * V.upgradeCard con canBuy). Esta pantalla es el catálogo: lo que tienes,
 * lo que cuesta cada nivel y cuántos emblemas guardas.
 *
 * El menú tiene tres pestañas: Mejoras, Reliquias y Pactos. Las reliquias
 * iniciales y los pactos se DESBLOQUEAN aquí uno a uno (DK.camp.unlock):
 * sólo los desbloqueados se ofrecen al empezar una expedición / un mapa.
 *
 * Cada tarjeta muestra el nivel actual, lo que da el siguiente nivel
 * y su precio. Para añadir una mejora: data/upgrades.js + textos en
 * lang → camp.up.<id> + leer DK.camp.value('<id>') donde se aplique.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const V = DK.views;
  const { t } = DK;


  /** Texto del efecto de una mejora con un valor concreto. */
  /** Texto del efecto con un valor. Si hay un texto propio por nivel (lv1, lv2…) se usa ese. */
  const effectText = (u, value) => {
    const lv = u.levels.findIndex((l) => l.value === value) + 1;
    const own = DK.i18n.lookup(DK.i18n.lang, `camp.up.${u.id}.lv${lv}`);
    return own || t(`camp.up.${u.id}.effect`, { n: value < 1 ? Math.round(value * 100) : value });
  };

  /** Emblemas como «chip» (moneda de las mejoras). */
  V.emblems = (n) => h('span', { class: 'emblems', tip: t('emblem.help') }, DK.icon('emblem', 15), h('b', null, String(n)));

  /**
   * Tarjeta de una mejora.
   * @param {boolean} canBuy  true sólo en el resumen de la expedición (se compra ahí)
   */
  function upgradeCard(u, refresh, canBuy = false) {
    const lv = DK.camp.level(u.id), max = u.levels.length;
    const next = DK.camp.next(u.id);
    const cur = DK.camp.value(u.id);
    const canPay = next && DK.camp.emblems() >= next.cost;
    const buy = () => {
      if (!DK.camp.buy(u.id)) { DK.audio.sfx('error'); DK.ui.toast(t('camp.noEmblems'), { icon: 'emblem', kind: 'bad' }); return; }
      DK.audio.sfx('levelup'); DK.ui.toast(t('camp.bought', { name: t(`camp.up.${u.id}.name`) }), { icon: u.icon, kind: 'good' });
      DK.app.renderNav(); refresh();
    };
    return h('div', { class: 'card camp-card' + (lv ? ' owned' : '') + (!next ? ' maxed' : '') },
      h('div', { class: 'camp-card-head' },
        h('span', { class: 'camp-icon' }, DK.icon(u.icon, 26)),
        h('div', { class: 'grow' }, h('b', null, t(`camp.up.${u.id}.name`)), h('p', { class: 'muted small' }, t(`camp.up.${u.id}.desc`))),
        h('span', { class: 'camp-level', tip: t('camp.levelTip') }, `${lv}/${max}`)),
      h('div', { class: 'camp-pips' }, u.levels.map((_, i) => h('span', { class: 'pip' + (i < lv ? ' on' : '') }))),
      lv ? h('p', { class: 'small' }, DK.icon('check', 13), ' ', t('camp.now'), ' ', h('b', null, effectText(u, cur))) : null,
      next ? h('div', { class: 'camp-buy' },
        h('span', { class: 'small' }, lv ? t('camp.nextLevel') : t('camp.firstLevel'), ' ', h('b', null, effectText(u, next.value))),
        canBuy ? btn({ icon: 'emblem', label: t('camp.buy', { n: next.cost }), variant: canPay ? 'primary' : 'tone', size: 'sm', disabled: !canPay, tip: canPay ? null : t('camp.missing', { n: next.cost - DK.camp.emblems() }), onClick: buy })
          : h('span', { class: 'camp-cost', tip: t('camp.buyAtEnd') }, DK.icon('emblem', 13), ' ', next.cost))
        : h('span', { class: 'badge good' }, DK.icon('crown', 13), t('camp.maxed')));
  }

  V.upgradeCard = upgradeCard;

  /**
   * Las Mejoras NO se ven desde el menú: sólo aparecen al terminar una
   * expedición (V.upgradeMenu, desde screens/expSummary.js). Si algo
   * intenta abrir la pantalla 'camp', se vuelve al Inicio.
   */
  DK.screens.register('camp', {
    title: () => t('nav.camp'), icon: 'star', section: 'home', music: 'menu',
    render() { setTimeout(() => DK.router.reset('hub'), 0); return h('div'); },
  });

  /**
   * Tarjeta de un pacto o una reliquia por desbloquear (pestañas Pactos y
   * Reliquias). Desbloqueados, pueden salir al empezar las expediciones.
   */
  function unlockCard(kind, id, refresh) {
    const D = DK.data;
    const own = DK.camp.isUnlocked(kind, id), cost = DK.camp.unlockCost(kind, id), canPay = DK.camp.emblems() >= cost;
    const r = kind === 'relic' ? D.relics[id] : null, c = kind === 'curse' ? D.curses[id] : null;
    const name = r ? r.name : t('curse.' + id + '.name');
    const buy = () => {
      if (!DK.camp.unlock(kind, id)) { DK.audio.sfx('error'); DK.ui.toast(t('camp.noEmblems'), { icon: 'emblem', kind: 'bad' }); return; }
      DK.audio.sfx('levelup'); DK.ui.toast(t('camp.unlocked', { name }), { icon: r ? r.icon : c.icon, kind: 'good' });
      DK.app.renderNav(); refresh();
    };
    const reward = c ? [c.reward.coins ? t('curse.rewardCoins', { n: Math.round(c.reward.coins * 100) }) : null, c.reward.relic ? t('curse.rewardRelic', { n: c.reward.relic }) : null].filter(Boolean).join(' · ') : '';
    return h('div', { class: 'card unlock-card ' + (r ? 'r-' + r.rarity : 'is-curse') + (own ? ' owned' : ' locked') },
      h('span', { class: 'unlock-icon' }, r ? V.relicIcon(r, 32) : DK.icon(c.icon, 26), own ? null : h('span', { class: 'unlock-lock' }, DK.icon('lock', 11))),
      h('div', { class: 'unlock-body' },
        h('div', { class: 'row gap-s wrap' }, h('b', null, name), r ? V.rarity(r.rarity) : null),
        h('p', { class: 'small' }, r ? DK.views.relicText(r) : t('curse.' + id + '.desc')),
        c ? h('span', { class: 'curse-reward small' }, DK.icon('gift', 13), reward) : null),
      own && r && DK.engrave.can(id) ? engraveCtl(id, refresh)
      : own ? h('span', { class: 'badge good unlock-done' }, DK.icon('check', 13), t('camp.unlockedTag'))
        : btn({ icon: 'emblem', label: t('camp.unlock', { n: cost }), size: 'sm', variant: canPay ? 'primary' : 'tone', disabled: !canPay, tip: canPay ? null : t('camp.missing', { n: cost - DK.camp.emblems() }), onClick: buy }));
  }

  /** Grabar una reliquia épica: sale siempre al empezar la expedición (DK.engrave). */
  function engraveCtl(id, refresh) {
    const E = DK.engrave, cost = DK.data.endgame.engrave.cost;
    if (E.has(id)) return h('div', { class: 'engrave-ctl' }, h('span', { class: 'badge engraved' }, DK.icon('amulet', 12), t('engrave.done')),
      btn({ icon: 'x', label: t('engrave.remove'), size: 'sm', variant: 'ghost', onClick: () => { E.remove(id); DK.audio.sfx('click'); refresh(); } }));
    const full = E.list().length >= E.slots(), pay = DK.camp.emblems() >= cost;
    return h('div', { class: 'engrave-ctl' }, h('span', { class: 'badge good unlock-done' }, DK.icon('check', 13), t('camp.unlockedTag')),
      btn({ icon: 'amulet', label: t('engrave.button', { n: cost }), size: 'sm', variant: pay && !full ? 'primary' : 'tone', disabled: !pay || full,
        tip: full ? t('engrave.full', { n: E.slots() }) : pay ? t('engrave.tip') : t('camp.missing', { n: cost - DK.camp.emblems() }),
        onClick: () => { if (E.engrave(id)) { DK.audio.sfx('levelup'); DK.ui.toast(t('engrave.engraved', { name: DK.data.relics[id].name }), { icon: 'amulet', kind: 'good' }); refresh(); } } }));
  }

  /* ======================================================================
   * v5.46: menú de Mejoras como ventana moderna y concisa (V.upgradeMenu).
   * Cabecera con tus emblemas · pestañas Mejoras / Reliquias / Pactos · tarjetas compactas:
   *   mejora  → icono · nombre · «ahora → siguiente» · pips de nivel · botón con el precio (la descripción, en el tip)
   *   reliquia/pacto → icono · nombre · efecto · estado (desbloquear, desbloqueada, grabar/grabada)
   * Sin avisos emergentes al comprar: la tarjeta brilla un momento (menos ruido).
   * ====================================================================== */
  let shopTab = 'upgrades', relFilter = 'all', onlyLocked = false;
  const flash = (key) => setTimeout(() => { const el = document.querySelector(`[data-um="${key}"]`); if (el) { el.classList.remove('um-flash'); void el.offsetWidth; el.classList.add('um-flash'); } }, 30);

  function upRow(u, refresh) {
    const lv = DK.camp.level(u.id), max = u.levels.length, next = DK.camp.next(u.id), cur = DK.camp.value(u.id);
    const canPay = next && DK.camp.emblems() >= next.cost;
    const buy = () => {
      if (!DK.camp.buy(u.id)) { DK.audio.sfx('error'); return; }
      DK.audio.sfx('levelup'); DK.app.renderNav(); refresh(); flash('u-' + u.id);
    };
    return h('div', { class: 'um-up' + (lv ? ' owned' : '') + (!next ? ' maxed' : '') + (canPay ? ' can' : ''), 'data-um': 'u-' + u.id },
      h('span', { class: 'um-ic' }, DK.icon(u.icon, 22)),
      h('div', { class: 'um-txt' },
        h('b', { tip: t(`camp.up.${u.id}.desc`) }, t(`camp.up.${u.id}.name`)),
        h('small', { class: 'um-eff', tip: t(`camp.up.${u.id}.desc`) }, lv ? h('span', { class: 'um-now' }, effectText(u, cur)) : h('span', { class: 'um-first' }, t('camp.firstShort'), ' ', h('span', { class: 'um-next' }, effectText(u, next.value))),
          next && lv ? h('span', { class: 'um-arrow' }, ' → ', h('span', { class: 'um-next' }, effectText(u, next.value))) : null)),
      h('span', { class: 'um-pips', tip: t('camp.levelTip') }, u.levels.map((_, i) => h('i', { class: i < lv ? 'on' : '' }))),
      next ? h('button', { class: 'um-buy' + (canPay ? ' ok' : ''), type: 'button', disabled: !canPay, tip: canPay ? t('camp.buyTip') : t('camp.missing', { n: next.cost - DK.camp.emblems() }), onClick: buy }, DK.icon('emblem', 14), h('b', null, String(next.cost)))
        : h('span', { class: 'um-max' }, DK.icon('crown', 13), t('camp.maxed')));
  }

  function unlockTile(kind, id, refresh) {
    const D = DK.data, r = kind === 'relic' ? D.relics[id] : null, c = kind === 'curse' ? D.curses[id] : null;
    const own = DK.camp.isUnlocked(kind, id), cost = DK.camp.unlockCost(kind, id), canPay = DK.camp.emblems() >= cost;
    const name = r ? r.name : t('curse.' + id + '.name');
    const key = kind + '-' + id;
    const buy = () => { if (!DK.camp.unlock(kind, id)) { DK.audio.sfx('error'); return; } DK.audio.sfx('levelup'); DK.app.renderNav(); refresh(); flash(key); };
    let act;
    if (!own) act = h('button', { class: 'um-buy sm' + (canPay ? ' ok' : ''), type: 'button', disabled: !canPay, tip: canPay ? t('camp.unlockTip') : t('camp.missing', { n: cost - DK.camp.emblems() }), onClick: buy }, DK.icon('lock', 12), DK.icon('emblem', 13), h('b', null, String(cost)));
    else if (r && DK.engrave.can(id)) {
      const E = DK.engrave, ecost = D.endgame.engrave.cost;
      if (E.has(id)) act = h('button', { class: 'um-eng on', type: 'button', tip: t('engrave.removeTip'), onClick: () => { E.remove(id); DK.audio.sfx('click'); refresh(); } }, DK.icon('amulet', 12), t('engrave.done'), DK.icon('x', 11));
      else { const full = E.list().length >= E.slots(), pay = DK.camp.emblems() >= ecost;
        act = h('button', { class: 'um-eng', type: 'button', disabled: !pay || full, tip: full ? t('engrave.full', { n: E.slots() }) : pay ? t('engrave.tip') : t('camp.missing', { n: ecost - DK.camp.emblems() }),
          onClick: () => { if (E.engrave(id)) { DK.audio.sfx('levelup'); refresh(); flash(key); } } }, DK.icon('amulet', 12), t('engrave.short'), DK.icon('emblem', 11), ecost); }
    } else act = h('span', { class: 'um-own' }, DK.icon('check', 12));
    const reward = c ? [c.reward.coins ? t('curse.rewardCoins', { n: Math.round(c.reward.coins * 100) }) : null, c.reward.relic ? t('curse.rewardRelic', { n: c.reward.relic }) : null].filter(Boolean).join(' · ') : '';
    return h('div', { class: 'um-tile ' + (r ? 'r-' + r.rarity : 'is-curse') + (own ? ' owned' : ' locked') + (r && DK.engrave.has(id) ? ' engraved' : ''), 'data-um': key },
      h('span', { class: 'um-tic' }, r ? V.relicIcon(r, 32) : DK.icon(c.icon, 22)),
      h('div', { class: 'um-txt' }, h('b', null, name), h('small', null, r ? DK.views.relicText(r) : t('curse.' + id + '.desc')),
        c && reward ? h('small', { class: 'um-reward' }, DK.icon('gift', 11), ' ', reward) : null),
      h('div', { class: 'um-act' }, act));
  }

  /** Contenido del menú de Mejoras: pestañas Mejoras · Reliquias · Pactos. */
  V.upgradeShop = (refresh) => {
    const D = DK.data, U = D.upgrades;
    const total = U.reduce((a, u) => a + u.levels.length, 0), have = U.reduce((a, u) => a + DK.camp.level(u.id), 0);
    const upN = U.filter((u) => { const nx = DK.camp.next(u.id); return nx && DK.camp.emblems() >= nx.cost; }).length;
    const relN = DK.camp.unlockable('relic'), curN = DK.camp.unlockable('curse');
    const relics = Object.values(D.relics), curses = Object.keys(D.curses), n = upN + relN + curN;
    const tab = (id, icon, label, count, owned) => h('button', { class: 'um-tab' + (shopTab === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(shopTab === id),
      onClick: () => { if (shopTab !== id) { shopTab = id; DK.audio.sfx('select'); refresh(); } } }, DK.icon(icon, 15), h('span', null, label), h('small', null, owned), count ? h('i', { tip: t('camp.canNow', { n: count }) }, String(count)) : null);
    let body;
    if (shopTab === 'relics') {
      const RAR = ['comun', 'raro', 'epico'];
      const list = relics.filter((r) => (relFilter === 'all' || r.rarity === relFilter) && (!onlyLocked || !DK.camp.isUnlocked('relic', r.id)));
      body = h('div', { class: 'um-body' },
        h('div', { class: 'um-bar' },
          h('div', { class: 'seg-tabs um-seg' }, [['all', t('camp.all')]].concat(RAR.map((r) => [r, DK.tr('rarities', D.rarities[r])])).map(([k, l]) => h('button', { class: k === relFilter ? 'on' : '', type: 'button', onClick: () => { relFilter = k; refresh(); } }, k !== 'all' ? h('i', { class: 'um-dot r-' + k }) : null, l, k !== 'all' ? h('small', null, ' ' + DK.config.expedition.unlockCost[k]) : null))),
          h('label', { class: 'um-chk' }, h('input', { type: 'checkbox', checked: onlyLocked, onChange: (e) => { onlyLocked = e.target.checked; refresh(); } }), t('camp.onlyLocked'))),
        h('p', { class: 'um-note' }, DK.icon('info', 12), ' ', t('camp.relicsText'), ' ', t('engrave.help', { used: DK.engrave.list().length, n: DK.engrave.slots(), cost: D.endgame.engrave.cost })),
        list.length ? h('div', { class: 'um-grid tiles' }, list.sort((a, b) => RAR.indexOf(a.rarity) - RAR.indexOf(b.rarity)).map((r) => unlockTile('relic', r.id, refresh))) : h('p', { class: 'muted small um-none' }, t('camp.allUnlocked')));
    } else if (shopTab === 'curses') {
      body = h('div', { class: 'um-body' }, h('p', { class: 'um-note' }, DK.icon('info', 12), ' ', t('camp.cursesText')),
        h('div', { class: 'um-grid tiles' }, curses.map((id) => unlockTile('curse', id, refresh))));
    } else {
      body = h('div', { class: 'um-body' }, D.upgradeGroups.map((g) => h('section', { class: 'um-group' },
        h('h4', null, t('camp.group.' + g), h('small', null, `${U.filter((u) => u.group === g).reduce((a, u) => a + DK.camp.level(u.id), 0)}/${U.filter((u) => u.group === g).reduce((a, u) => a + u.levels.length, 0)}`)),
        h('div', { class: 'um-grid' }, U.filter((u) => u.group === g).map((u) => upRow(u, refresh))))));
    }
    return h('div', { class: 'um' },
      h('div', { class: 'um-head' },
        h('div', { class: 'um-purse' }, h('span', { class: 'um-purse-ic' }, DK.icon('emblem', 26)), h('div', null, h('b', null, String(DK.camp.emblems())), h('small', null, t('emblem.title')))),
        h('p', { class: 'um-hint' + (n ? ' good' : '') }, n ? t(n === 1 ? 'sum.shopCanOne' : 'sum.shopCan', { n }) : t('camp.howShort'))),
      h('div', { class: 'um-tabs', role: 'tablist' },
        tab('upgrades', 'star', t('camp.tabUpgrades'), upN, `${have}/${total}`),
        tab('relics', 'amulet', t('camp.tabRelics'), relN, `${DK.camp.unlocked('relic').length}/${relics.length}`),
        tab('curses', 'skull', t('camp.tabCurses'), curN, `${DK.camp.unlocked('curse').length}/${curses.length}`)),
      body);
  };

  /** Abre el menú de Mejoras (ventana). onChange tras cada compra. */
  V.upgradeMenu = (onChange = () => {}) => {
    const holder = h('div', { class: 'um-host' });
    const draw = () => { const sc = holder.querySelector('.um-body'), y = sc ? sc.scrollTop : 0; holder.replaceChildren(V.upgradeShop(() => { draw(); onChange(); })); const b = holder.querySelector('.um-body'); if (b) b.scrollTop = y; };
    draw();
    return DK.ui.modal({ title: t('sum.shopTitle'), icon: 'emblem', cls: 'um-modal', size: 'wide', closeX: true, content: () => holder });
  };
})();
