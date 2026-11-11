/* =============================================================
 * systems/notify.js — v5.45: avisos del sistema (los del móvil o del ordenador).
 *
 * Con el juego abierto pero en segundo plano (otra pestaña, la app minimizada…) se sigue comprobando el
 * buzón cada minuto y, si llega algo, sale un aviso del sistema: mensajes, solicitudes de amistad, regalos,
 * el chat del clan, respuesta del equipo y el contrato semanal a punto de acabar. Al pulsarlo se abre el
 * juego en ese sitio. Con el juego cerrado del todo no hay avisos (eso necesitaría un servidor de «push»).
 *
 *   DK.notify.supported()  · DK.notify.enabled()  · DK.notify.enable() → Promise<boolean>  · DK.notify.disable()
 * ============================================================= */
(function () {
  const t = (k, p) => DK.t(k, p);
  DK.notify = {
    supported() { return typeof Notification !== 'undefined' && 'serviceWorker' in navigator && /^https?:/.test(location.protocol); },
    enabled() { return this.supported() && Notification.permission === 'granted' && !!DK.settings.get('sysNotify'); },
    async enable() {
      if (!this.supported()) return false;
      let p = Notification.permission;
      if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
      DK.settings.set('sysNotify', p === 'granted');
      if (p === 'granted') this.show(t('notify.testTitle'), t('notify.testBody'), { tag: 'dk-test', open: 'mail' });
      return p === 'granted';
    },
    disable() { DK.settings.set('sysNotify', false); },
    async show(title, body, { tag = 'dk', open = 'mail' } = {}) {
      if (!this.supported()) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, tag, renotify: true, icon: 'icons/icon-192.png?v=473', badge: 'icons/icon-192.png?v=473', data: { open } });
      } catch (e) { try { new Notification(title, { body, tag }); } catch (er) { /* */ } }
    },
    /** ¿Conviene avisar? (sólo si no estás mirando el juego) */
    away() { return document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus()); },
  };
  const N = DK.notify;

  // Novedades de la comprobación rápida (online.pollInbox → 'online:change')
  DK.on('online:change', ({ P, prev }) => {
    if (!N.enabled() || !N.away() || !prev || prev.inbox == null) return;
    if ((P.inbox | 0) > (prev.inbox | 0)) N.show(t('notify.inboxTitle'), t('notify.inboxBody'), { tag: 'dk-inbox', open: 'mail' });
    const dmNew = Object.keys(P.dm || {}).filter((k) => (P.dm[k] | 0) > (((prev.dm || {})[k]) | 0));
    if (dmNew.length) N.show(t('notify.dmTitle'), t('notify.dmBody', { n: dmNew.length }), { tag: 'dk-dm', open: 'friends' });
    if ((P.clan | 0) > (prev.clan | 0)) N.show(t('notify.clanTitle'), t('notify.clanBody'), { tag: 'dk-clan', open: 'clan' });
    if ((P.clanReq | 0) > (prev.clanReq | 0)) N.show(t('notify.clanReqTitle'), t('notify.clanReqBody'), { tag: 'dk-clanreq', open: 'clan' });
    if ((P.support | 0) > (prev.support | 0)) N.show(t('notify.supportTitle'), t('notify.supportBody'), { tag: 'dk-support', open: 'team' });
    if ((P.news | 0) > (prev.news | 0)) N.show(t('notify.newsTitle'), t('notify.newsBody'), { tag: 'dk-news', open: 'mail' });
  });
  // En segundo plano se sigue mirando (cada minuto; los navegadores no dejan más a menudo)
  setInterval(() => { if (N.enabled() && document.hidden && DK.online && DK.online.enabled() && DK.store.state) DK.online.pollInbox(); }, 60000);
  // Contrato semanal: un aviso el último día si aún no lo has intentado
  setInterval(() => {
    if (!N.enabled() || !N.away() || !DK.store.state || !DK.weekly || !DK.weekly.unlocked || !DK.weekly.unlocked()) return;
    const me = DK.online && DK.online.me(), wk = DK.weekly.weekNo();
    if (!me || me.weeklyWarned === wk || DK.weekly.daysLeft() > 1 || DK.weekly.tries() > 0) return;
    me.weeklyWarned = wk; DK.store.save();
    N.show(t('notify.weeklyTitle'), t('notify.weeklyBody'), { tag: 'dk-weekly', open: 'zones' });
  }, 5 * 60000);
  // Al pulsar un aviso, el service worker trae el juego al frente y dice qué abrir
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data || {}; if (d.type !== 'dk-open' || !DK.store.state) return;
    const V = DK.views;
    if (d.open === 'clan' && V.community) V.community('clan');
    else if (d.open === 'zones') DK.router.reset('zones');
    else if (V.mailbox) V.mailbox(d.open === 'friends' || d.open === 'team' ? d.open : 'inbox');
  });
})();
