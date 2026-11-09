/* =============================================================
 * components/infoTips.js — v5.5: fichas al pasar el ratón (o al pulsar).
 *
 *   V.infoCard(kind, id)         → ficha pequeña: 'item' | 'rune' | 'gear' | 'move' | 'passive' | 'status'
 *   V.infoOpen(kind, id)         → la misma ficha en una ventana (móvil / clic)
 *   V.richLog(text)              → nodos del texto del registro con los ataques, objetos, pasivas y
 *                                  estados resaltados (al pasar el ratón o pulsar: qué hacen)
 * Para usarlo en cualquier elemento: h('span', { tipNode: () => V.infoCard('item', id) }).
 * ============================================================= */
(function () {
  const { h } = DK.ui;
  const D = DK.data;
  const { t } = DK;
  const V = DK.views;

  const head = (icon, name, sub) => h('div', { class: 'ic-head' }, h('span', { class: 'ic-ico' }, icon), h('div', { class: 'ic-title' }, h('b', null, name), sub ? h('div', { class: 'ic-sub' }, sub) : null));
  const line = (label, value) => (value ? h('div', { class: 'ic-row' }, h('span', null, label), h('b', null, value)) : null);

  const CARDS = {
    item(id) {
      const it = D.items[id]; if (!it) return null;
      const cat = D.categories[it.category];
      const does = V.itemDoes(it);
      const dest = DK.expedition && DK.expedition.active() ? (DK.expedition.toBag(id) ? t('info.toBag') : t('info.toLoot')) : null;
      return h('div', { class: 'info-card r-' + it.rarity },
        head(V.itemIcon(it, 30, { tip: false }), it.name, h('span', { class: 'ic-tags' }, V.rarity(it.rarity), cat ? h('span', { class: 'ic-cat' }, DK.tr('categories', cat)) : null)),
        it.desc ? h('p', { class: 'ic-desc' }, it.desc) : null,
        does && does !== it.desc ? line(t('info.does'), does) : null,
        it.stats ? h('div', { class: 'ic-row' }, h('span', null, t('item.bonus')), V.statChips(it.stats)) : null,
        line(t('info.where'), dest),
        line(t('info.have'), DK.store.state ? String(DK.bag.count(id)) : null));
    },
    rune(id) {
      if (!DK.runes || !DK.runes.get(id)) return null;
      return h('div', { class: 'info-card rune' },
        head(V.runeGem(id, 34), V.runeName(id), h('span', { class: 'ic-cat' }, t('info.rune'))),
        h('p', { class: 'ic-desc' }, V.runeEffect(id)),
        ...V.runeAffixes(id).map((x) => h('div', { class: 'ic-aff' }, DK.icon('sparkles', 11), x)),
        h('p', { class: 'ic-foot' }, t('info.runeHow')));
    },
    gear(p) { return p && p.base ? h('div', { class: 'info-card gear' }, V.gearTip(p, { compact: true })) : null; },
    move(id) { return D.moves[id] ? h('div', { class: 'info-card move' }, V.moveCard(id)) : null; },
    passive(id) {
      const P = D.passives[id]; if (!P) return null;
      return h('div', { class: 'info-card passive' }, head(DK.icon('sparkles', 22), DK.tr('passives', P), h('span', { class: 'ic-cat' }, t('common.passive'))), h('p', { class: 'ic-desc' }, DK.tr('passives', P, 'desc')));
    },
    status(id) {
      const S = D.statuses[id]; if (!S) return null;
      return h('div', { class: 'info-card status', style: { '--sc': S.color } }, head(DK.icon(S.icon, 22), DK.tr('statuses', S), h('span', { class: 'ic-cat' }, t('info.status'))), h('p', { class: 'ic-desc' }, DK.tr('statuses', S, 'desc') || S.desc));
    },
  };
  V.infoCard = (kind, id) => (CARDS[kind] ? CARDS[kind](id) : null);
  V.infoOpen = (kind, id) => {
    const card = V.infoCard(kind, id); if (!card) return;
    DK.ui.modal({ title: card.querySelector('.ic-title b, .move-name, .gt-name') ? card.querySelector('.ic-title b, .move-name, .gt-name').textContent : '', icon: 'info', cls: 'info-modal', size: 'sm', content: card, actions: [{ label: t('common.close'), variant: 'primary', value: true }] });
  };
  /** Props para que un elemento enseñe la ficha al pasar el ratón y la abra al pulsarlo. */
  V.infoProps = (kind, id) => ({ tipNode: () => V.infoCard(kind, id), onClick: (ev) => { ev.stopPropagation(); V.infoOpen(kind, id); }, class: 'has-info' });

  /* ---------- Registro de combate con referencias ---------- */
  let index = null, indexLang = null;
  function buildIndex() {
    const map = new Map();
    const add = (name, kind, id) => { if (name && name.length > 2 && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), { kind, id }); };
    Object.entries(D.moves).forEach(([id, m]) => add(m.name, 'move', id));
    Object.entries(D.items).forEach(([id, it]) => { if (it.category !== 'equipo') add(it.name, 'item', id); });
    Object.entries(D.passives).forEach(([id, P]) => add(DK.tr('passives', P), 'passive', id));
    Object.entries(D.statuses).forEach(([id, S]) => { add(DK.tr('statuses', S), 'status', id); add(DK.tr('statuses', S).toLowerCase(), 'status', id); });
    const names = [...map.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // límites de palabra que entienden acentos y ñ
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${names.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
    return { map, re };
  }
  V.richLog = (text) => {
    if (!text || typeof text !== 'string') return [text];
    if (!index || indexLang !== DK.i18n.lang) { index = buildIndex(); indexLang = DK.i18n.lang; }
    const out = []; let last = 0, m;
    index.re.lastIndex = 0;
    while ((m = index.re.exec(text))) {
      const start = m.index + m[1].length, word = m[2], ref = index.map.get(word.toLowerCase());
      if (!ref) continue;
      if (start > last) out.push(text.slice(last, start));
      out.push(h('span', Object.assign({ role: 'button', tabindex: '0' }, V.infoProps(ref.kind, ref.id), { class: 'log-ref k-' + ref.kind }), word));
      last = start + word.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };
})();
