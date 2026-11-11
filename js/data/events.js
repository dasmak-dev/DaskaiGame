/* =============================================================
 * data/events.js — Sucesos de las expediciones (nodos "?").
 *
 *  { id, icon, weight, minRow, choices: [{ id, icon, req(ctx), run(ctx) }] }
 *
 *  req(ctx) → false para desactivar la opción (p. ej. si no tienes el objeto)
 *  run(ctx) → { key, vars, fight }   key = texto del resultado en
 *             lang → events.<id>.results.<key>;  fight: 'fight'|'elite'
 *             para que el suceso termine en un combate.
 *
 *  ctx (systems/expedition.js → ctx()): level, zone, team(), leader(),
 *  hpAll(pct), mpAll(pct), loot(items, coins), randomItem(rareza), has(id),
 *  take(id), coins(), pay(n), exp(d, n), chance(p),
 *  y para los personajes: tonic(), equip(rareza), relic([rarezas]), recruit(),
 *  revealCave(), revealShortcut()
 *
 *  Los textos (título, descripción, opciones, resultados) están en
 *  lang/*.js → events.<id>. Para añadir uno: copia un bloque y sus textos.
 * ============================================================= */
(function () {
  const D = DK.data;
  const name = (id) => D.items[id].name;

  D.events = [
    {
      id: 'altar', icon: 'sparkle', weight: 3, minRow: 1,
      choices: [
        { id: 'offer', icon: 'heart', run: (c) => { c.hpAll(-0.2); const item = c.randomItem('raro'); c.loot([item]); return { key: 'offer', vars: { item: name(item) } }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      id: 'wounded', icon: 'paw', weight: 3,
      choices: [
        { id: 'help', icon: 'flask', req: (c) => c.has('pocion'),
          run: (c) => { c.take('pocion'); const coins = c.level * 5 + 30; const n = c.level * 4; c.loot([], coins); c.team().forEach((d) => c.exp(d, n)); return { key: 'help', vars: { coins, n } }; } },
        { id: 'ignore', icon: 'next', run: () => ({ key: 'ignore' }) },
      ],
    },
    {
      id: 'spring', icon: 'droplet', weight: 3,
      choices: [
        { id: 'drink', icon: 'heart', run: (c) => { c.hpAll(0.35); c.mpAll(0.35); return { key: 'drink' }; } },
        { id: 'bottle', icon: 'flask', run: (c) => { c.loot(['pocion', 'eter']); return { key: 'bottle' }; } },
      ],
    },
    {
      id: 'gamble', icon: 'coin', weight: 2,
      choices: [
        { id: 'bet', icon: 'coin', req: (c) => c.coins() >= 40 + c.level * 2,
          run: (c) => { const n = 40 + c.level * 2; c.pay(n); if (c.chance(0.5)) { c.loot([], n * 3); return { key: 'win', vars: { n: n * 3 } }; } return { key: 'lose', vars: { n } }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      id: 'trainer', icon: 'user', weight: 2, minRow: 1,
      choices: [
        { id: 'train', icon: 'star', run: (c) => { const d = c.leader(); const n = c.level * 12; c.exp(d, n); c.hpAll(-0.15); return { key: 'train', vars: { name: DK.daskai.name(d), n } }; } },
        { id: 'chat', icon: 'coin', run: (c) => { c.loot([], 25); return { key: 'chat' }; } },
      ],
    },
    {
      id: 'cave', icon: 'mountain', weight: 2, minRow: 1,
      choices: [
        { id: 'explore', icon: 'compass',
          run: (c) => { if (c.chance(0.6)) { const items = [c.randomItem(), c.randomItem('raro')]; c.loot(items); return { key: 'found', vars: { items: items.map(name).join(', ') } }; } return { key: 'ambush', fight: 'elite' }; } },
        { id: 'skip', icon: 'next', run: () => ({ key: 'skip' }) },
      ],
    },
    {
      id: 'collector', icon: 'cube', weight: 2,
      choices: [
        { id: 'trade', icon: 'merge', req: () => DK.bag.list('pieza').some((x) => x.qty >= 3),
          run: (c) => { const p = DK.bag.list('pieza').find((x) => x.qty >= 3).item; c.take(p.id, 3); const item = c.randomItem('raro'); c.loot([item]); return { key: 'trade', vars: { piece: p.name, item: name(item) } }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },

    /* ---------- Personajes (NPC) ---------- */
    {
      // Viajera errante: si compartes una poción te da algo bueno
      id: 'traveler', icon: 'user', weight: 3,
      choices: [
        { id: 'share', icon: 'flask', req: (c) => c.has('pocion'),
          run: (c) => { c.take('pocion'); const it = c.chance(0.5) ? c.equip('raro') : c.randomItem('raro'); c.loot([it], c.level * 4); return { key: 'share', vars: { item: name(it), coins: c.level * 4 } }; } },
        { id: 'talk', icon: 'question', run: (c) => { c.loot(['eter']); return { key: 'talk' }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      // Ermitaño: a cambio de monedas, un tónico; o te enseña (experiencia)
      id: 'hermit', icon: 'tome', weight: 2, minRow: 2,
      choices: [
        { id: 'donate', icon: 'coin', req: (c) => c.coins() >= 60 + c.level * 8,
          run: (c) => { c.pay(60 + c.level * 8); const it = c.tonic(); c.loot([it]); return { key: 'donate', vars: { item: name(it) } }; } },
        { id: 'listen', icon: 'star', run: (c) => { const n = c.level * 15; c.team().forEach((d) => c.exp(d, n)); return { key: 'listen', vars: { n } }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      // Herrera ambulante: forja equipo con piezas o vende una reliquia
      id: 'smith', icon: 'anvil', weight: 2, minRow: 1,
      choices: [
        { id: 'forge', icon: 'hammer', req: () => DK.bag.list('pieza').some((x) => x.qty >= 3),
          run: (c) => { const p = DK.bag.list('pieza').find((x) => x.qty >= 3).item; c.take(p.id, 3); const it = c.equip('raro'); c.loot([it]); return { key: 'forge', vars: { piece: p.name, item: name(it) } }; } },
        { id: 'relic', icon: 'amulet', req: (c) => c.coins() >= 80 + c.level * 6,
          run: (c) => { c.pay(80 + c.level * 6); const id = c.relic(['comun', 'raro']); return id ? { key: 'relic', vars: { relic: D.relics[id].name } } : { key: 'norelic' }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      // Cartógrafo perdido: te enseña una cueva (jefe oculto) o un atajo
      id: 'cartographer', icon: 'map', weight: 3,
      choices: [
        { id: 'escort', icon: 'shield', run: (c) => { c.hpAll(-0.1); return c.revealCave() ? { key: 'cave' } : { key: 'nothing' }; } },
        { id: 'buy', icon: 'coin', req: (c) => c.coins() >= 30 + c.level * 4,
          run: (c) => { if (!c.revealShortcut()) return { key: 'nothing' }; c.pay(30 + c.level * 4); return { key: 'shortcut' }; } },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      // Daskai perdido: se une a ti (como temporal, igual que un recluta)
      id: 'lost', icon: 'paw', weight: 2, recruits: true,
      choices: [
        { id: 'adopt', icon: 'heart', run: (c) => ({ key: 'adopt', vars: { name: c.recruit() } }) },
        { id: 'leave', icon: 'next', run: () => ({ key: 'leave' }) },
      ],
    },
    {
      // Bandidos: pagar o luchar contra su campeón (mini jefe)
      id: 'bandits', icon: 'dagger', weight: 2, minRow: 2,
      choices: [
        { id: 'fight', icon: 'swords', run: () => ({ key: 'fight', fight: 'elite' }) },
        { id: 'pay', icon: 'coin', req: (c) => c.coins() >= 40 + c.level * 5, run: (c) => { c.pay(40 + c.level * 5); return { key: 'pay', vars: { n: 40 + c.level * 5 } }; } },
      ],
    },
  ];
})();
