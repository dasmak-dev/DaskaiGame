/* =============================================================
 * sw.js — Service worker: guarda el juego en caché para jugar sin
 * conexión cuando se instala como app.
 *
 * IMPORTANTE: si añades o renombras archivos, añádelos a FILES y
 * sube el número de CACHE para que los jugadores reciban la versión
 * nueva. (Sólo funciona servido por http/https, no con file://).
 * ============================================================= */
const CACHE = 'daskai-v5.48.1';
const FILES = [
    './',
    './css/cursor.css',
    './css/base.css',
    './css/battle.css',
    './css/components.css',
    './css/layout.css',
    './css/responsive.css',
    './css/screens.css',
    './css/theme.css',
    './css/game.css',
    './css/grim.css',
    './css/clean.css',
    './css/exile.css',
    './css/motion.css',
    './css/juice.css',
    './css/pixel.css',
    './css/war.css',
    './css/community.css',
    './css/expbar.css',
    './css/upgrades.css',
    './css/notify.css',
    // v4.73: «?v=» cambia con cada icono nuevo para que el móvil instalado vea que ha cambiado
    './icons/icon-192.png?v=473',
    './icons/icon-512.png?v=473',
    './icons/icon-maskable-512.png?v=473',
    './icons/apple-touch-icon.png?v=473',
    './icons/icon.svg?v=473',
    './index.html',
    './js/components/celebrations.js',
    './js/components/life.js',
    './js/components/weather.js',
    './js/components/infoTips.js',
    './js/components/nodeArt.js',
    './js/components/outcomeEmblem.js',
    './js/components/ambient.js',
    './js/components/talentViews.js',
    './js/components/todoCard.js',
    './js/components/common.js',
    './js/components/daskaiPanel.js',
    './js/components/daskaiViews.js',
    './js/components/fx.js',
    './js/components/guides.js',
    './js/components/itemViews.js',
    './js/components/gearViews.js',
    './js/components/hoverCard.js',
    './js/components/onlineViews.js',
    './js/components/communityViews.js',
    './js/components/forgeBench.js',
    './js/components/runeBench.js',
    './js/components/palette.js',
    './js/components/avatar.js',
    './js/components/shareCard.js',
    './js/components/camp.js',
    './js/components/campArt.js',
    './js/components/pixelBg.js',
    './js/components/pixelScene.js',
    './js/components/worldArt.js',
    './js/components/scenes.js',
    './js/core/app.js',
    './js/core/bgfx.js',
    './js/core/dk.js',
    './js/core/i18n.js',
    './js/core/icons.js',
    './js/core/keys.js',
    './js/core/menus.js',
    './js/core/router.js',
    './js/core/settings.js',
    './js/core/store.js',
    './js/core/ui.js',
    './js/core/fx.js',
    './js/data/achievements.js',
    './js/data/basics.js',
    './js/data/talents.js',
    './js/data/mapMods.js',
    './js/data/quests.js',
    './js/data/config.js',
    './js/data/events.js',
    './js/data/relics.js',
    './js/data/difficulties.js',
    './js/data/upgrades.js',
    './js/data/curses.js',
    './js/data/hidden.js',
    './js/data/pass.js',
    './js/data/endgame.js',
    './js/data/wiki.js',
    './js/data/items.js',
    './js/data/gear.js',
    './js/data/missions.js',
    './js/data/gen/data.js',
    './js/data/gen/itemsPx.js',
    './js/data/gen/relicsPx.js',
    './icons/relics-px.png?v=546',
    './js/data/gen/iconsPx.js',
    './icons/items-px.png?v=5230',
    './js/data/moves.js',
    './js/data/recipes.js',
    './js/data/shop.js',
    './js/data/species.js',
    './js/data/zones.js',
    './js/lang/en.js',
    './js/lang/es.js',
    './js/main.js',
    './js/screens/battle.js',
    './js/screens/codex.js',
    './js/screens/expedition.js',
    './js/screens/expPrepare.js',
    './js/screens/expSummary.js',
    './js/screens/gameOver.js',
    './js/screens/camp.js',
    './js/screens/training.js',
    './js/screens/hub.js',
    './js/screens/inventory.js',
    './js/screens/craft.js',
    './js/screens/mainMenu.js',
    './js/screens/newGame.js',
    './js/screens/progress.js',
    './js/screens/profile.js',
    './js/screens/settings.js',
    './js/screens/team.js',
    './js/screens/zones.js',
    './js/systems/audio.js',
    './js/systems/battle.js',
    './js/systems/legends.js',
    './js/systems/daskai.js',
    './js/systems/boxes.js',
    './js/systems/rules.js',
    './js/systems/expedition.js',
    './js/systems/runes.js',
    './js/systems/pass.js',
    './js/systems/endgame.js',
    './js/systems/trade.js',
    './js/systems/online.js',
    './js/systems/community.js',
    './js/systems/cloud.js',
    './js/systems/telemetry.js',
    './js/systems/notify.js',
    './js/systems/weekly.js',
    './js/systems/training.js',
    './js/systems/curses.js',
    './js/systems/inventory.js',
    './js/systems/gear.js',
    './js/systems/progress.js',
    './js/systems/sprites.js',
    './js/systems/looks.js',
    './js/systems/names.js',
    './js/systems/world.js',
    './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  // v5.19.1: cache 'reload' = siempre del servidor (si no, la caché HTTP del navegador podía colar archivos de la
  // versión anterior en la caché nueva y el juego quedaba con piezas de dos versiones mezcladas)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// v5.45: al pulsar un aviso del sistema se trae el juego al frente y se le dice qué abrir
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const open = (e.notification.data && e.notification.data.open) || 'mail';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list[0];
    if (c) { c.postMessage({ type: 'dk-open', open }); return c.focus && c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow('./') : null;
  }));
});

// Primero la caché; si no está, red (y se guarda para la próxima vez)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (/\/admin(\.html|\.css)?(\?|$)|\/js\/admin\//.test(new URL(e.request.url).pathname)) return; // v5.40: el panel de admin siempre de la red
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
