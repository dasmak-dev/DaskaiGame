/* =============================================================
 * data/species2.js — Ampliación: nuevos daskai (v3.4).
 *
 * 16 especies nuevas (2 por zona) y 4 evoluciones, con 6 ataques
 * nuevos que les dan personalidad en combate. Se carga después de
 * data/zones.js porque añade cada especie a la lista de su zona.
 *
 * Para añadir más: S(...) como en data/species.js, link(...) para la
 * evolución y addTo('zona', 'especie', peso) para que aparezca.
 * ============================================================= */
(function () {
  const D = DK.data, SP = D.species, M = D.moves;
  const F = 'fisico', G = 'magico';

  /* ---------- Ataques nuevos ---------- */
  const move = (id, o) => (M[id] = Object.assign({ id, acc: 100, mp: 0, power: 0, house: null }, o));
  move('telarana', { name: 'Telaraña', kind: G, house: 'oscuridad', mp: 5, effect: { type: 'debuff', stat: 'spd', stages: 2 }, desc: 'Atrapa al rival en hilos pegajosos: baja mucho su velocidad.' });
  move('esporas', { name: 'Esporas', kind: G, house: 'oscuridad', power: 35, mp: 7, effect: { type: 'status', status: 'veneno', chance: 0.6 }, desc: 'Nube de esporas que suele envenenar.' });
  move('vapor', { name: 'Chorro de Vapor', kind: G, house: 'agua', power: 55, mp: 9, effect: { type: 'status', status: 'quemadura', chance: 0.3 }, desc: 'Agua hirviendo que puede quemar.' });
  move('muralla', { priority: 1, name: 'Muralla', kind: G, house: 'tierra', mp: 6, effect: { type: 'buff', stat: 'def', stages: 2 }, desc: 'Se encierra en roca: sube mucho su defensa física.' });
  move('velo_aurora', { priority: 1, name: 'Velo Aurora', kind: G, house: 'luz', mp: 6, effect: { type: 'buff', stat: 'mdef', stages: 2 }, desc: 'Un velo de luz que sube mucho su defensa mágica.' });
  move('mordisco_brasa', { name: 'Mordisco Brasa', kind: F, house: 'fuego', power: 70, effect: { type: 'drain', pct: 0.3 }, desc: 'Muerde con dientes ardientes y recupera parte del daño.' });

  /* ---------- Especies ---------- */
  const S = (id, name, house, b, o) => {
    SP[id] = Object.assign({
      id, name, house,
      base: { hp: b[0], mp: b[1], atk: b[2], matk: b[3], def: b[4], mdef: b[5], spd: b[6] },
      exp: 40, drops: [], passives: ['equilibrio'],
    }, o);
  };
  const link = (from, level, into) => { SP[from].evolve = { level, into }; SP[into].evolvedFrom = from; };
  const addTo = (zone, species, weight) => D.zones[zone].enemies.push({ species, weight });

  // Pradera Verde (1-5)
  S('ratonchi', 'Ratonchi', 'luz', [46, 28, 12, 11, 10, 10, 16], {
    exp: 35, passives: ['pies_ligeros', 'instinto'], desc: 'Ratoncito eléctrico que nunca para quieto. Siempre ataca primero.',
    learn: [[1, 'placaje'], [1, 'destello'], [4, 'agilidad'], [8, 'golpe_aureo'], [13, 'velo_aurora'], [18, 'rayo_luz'], [26, 'golpe_feroz']],
    drops: [['pluma', 0.4], ['polvo_brillante', 0.15], ['pocion', 0.15]],
    sprite: { c1: '#fde047', c2: '#fffbeb', rx: 25, ry: 23, ears: 'long', tail: 'curl', eyes: 'big', mark: 'stripes' } });
  S('charquito', 'Charquito', 'agua', [54, 30, 10, 12, 12, 12, 10], {
    exp: 36, passives: ['vitalidad', 'regeneracion'], desc: 'Ranita de charco. Aguanta mucho y se cura cuando puede.',
    learn: [[1, 'placaje'], [1, 'burbuja'], [5, 'aguas_curativas'], [9, 'acua_cola'], [14, 'vapor'], [20, 'hidrochorro'], [30, 'maremoto']],
    drops: [['gota', 0.45], ['hilo', 0.25], ['pocion', 0.15]],
    sprite: { c1: '#4ade80', c2: '#dcfce7', rx: 28, ry: 22, ears: 'none', tail: 'none', eyes: 'big', mark: 'spots' } });
  S('ratonix', 'Ratonix', 'luz', [64, 38, 18, 16, 13, 14, 24], {
    exp: 60, passives: ['pies_ligeros', 'instinto'], desc: 'Sus chispas doradas se ven a kilómetros. Rapidísimo.',
    learn: SP.ratonchi.learn.concat([[34, 'juicio'], [48, 'impacto_final']]),
    drops: [['pluma', 0.4], ['polvo_brillante', 0.3], ['pluma_veloz', 0.04]],
    sprite: { c1: '#facc15', c2: '#fef9c3', rx: 28, ry: 26, ears: 'long', tail: 'orb', eyes: 'sharp', eyeColor: '#b45309', mark: 'stripes' } });
  link('ratonchi', 16, 'ratonix');

  // Bosque Susurrante (5-10)
  S('setabruja', 'Setabruja', 'oscuridad', [54, 36, 10, 15, 12, 15, 10], {
    exp: 42, passives: ['mente_arcana', 'regeneracion'], desc: 'Seta parlanchina que suelta esporas venenosas al reírse.',
    learn: [[1, 'sombra_vil'], [3, 'esporas'], [7, 'intimidar'], [11, 'drenaje_vital'], [16, 'telarana'], [22, 'pulso_umbrio'], [32, 'eclipse']],
    drops: [['esencia_sombria', 0.35], ['hilo', 0.3], ['antidoto', 0.2]],
    sprite: { c1: '#9333ea', c2: '#f5d0fe', rx: 27, ry: 26, ears: 'leaf', tail: 'none', eyes: 'sleepy', mark: 'spots' } });
  S('ardillama', 'Ardillama', 'fuego', [52, 30, 15, 12, 11, 10, 16], {
    exp: 42, passives: ['furia', 'sangre_caliente'], desc: 'Ardilla de cola ardiente. Esconde brasas en lugar de nueces.',
    learn: [[1, 'aranazo'], [1, 'chispa'], [5, 'mordisco'], [9, 'colmillo_ardiente'], [14, 'agilidad'], [19, 'mordisco_brasa'], [26, 'lanzallamas']],
    drops: [['brasa', 0.4], ['pelaje', 0.3], ['balsamo', 0.15]],
    sprite: { c1: '#ea580c', c2: '#ffedd5', rx: 26, ry: 24, ears: 'cat', tail: 'flame', eyes: 'big', mark: 'stripes' } });
  S('hongoscuro', 'Hongoscuro', 'oscuridad', [74, 48, 13, 22, 16, 20, 12], {
    exp: 66, passives: ['mente_arcana', 'regeneracion'], desc: 'Rey de los hongos del bosque. Donde pisa, crece la niebla.',
    learn: SP.setabruja.learn.concat([[40, 'curacion'], [52, 'eclipse']]),
    drops: [['esencia_sombria', 0.5], ['nucleo_arcano', 0.06], ['velo_mistico', 0.03]],
    sprite: { c1: '#6b21a8', c2: '#e9d5ff', rx: 32, ry: 30, ears: 'leaf', tail: 'none', eyes: 'glow', eyeColor: '#a3e635', mark: 'spots' } });
  link('setabruja', 22, 'hongoscuro');
  S('fogardilla', 'Fogardilla', 'fuego', [70, 38, 22, 17, 14, 13, 23], {
    exp: 64, passives: ['furia', 'sangre_caliente'], desc: 'Salta de rama en rama dejando un rastro de fuego.',
    learn: SP.ardillama.learn.concat([[34, 'puno_igneo'], [44, 'llamarada']]),
    drops: [['brasa', 0.5], ['fragmento_garra', 0.3], ['anillo_brasas', 0.03]],
    sprite: { c1: '#dc2626', c2: '#fed7aa', rx: 29, ry: 26, ears: 'flame', tail: 'flame', eyes: 'sharp', eyeColor: '#fde047', mark: 'stripes' } });
  link('ardillama', 20, 'fogardilla');

  // Costa Marea (10-16)
  S('medusina', 'Medusina', 'agua', [56, 46, 9, 18, 10, 17, 13], {
    exp: 48, passives: ['pozo_mana', 'mente_arcana'], desc: 'Medusa luminosa. Frágil, pero su magia escuece.',
    learn: [[1, 'burbuja'], [6, 'vapor'], [10, 'concentracion'], [14, 'hidrochorro'], [20, 'aguas_curativas'], [28, 'maremoto'], [40, 'diluvio']],
    drops: [['gota', 0.5], ['perla_marina', 0.05], ['eter', 0.15]],
    sprite: { c1: '#a78bfa', c2: '#e0f2fe', rx: 25, ry: 28, ears: 'antenna', tail: 'none', eyes: 'glow', eyeColor: '#22d3ee' } });
  S('tortuarena', 'Tortuarena', 'tierra', [74, 24, 13, 9, 21, 15, 6], {
    exp: 48, passives: ['caparazon', 'espiritu_ferreo'], desc: 'Tortuga de playa. Se esconde en su concha cuando la cosa se pone fea.',
    learn: [[1, 'placaje'], [5, 'muralla'], [9, 'golpe_roca'], [14, 'lodo'], [20, 'embestida'], [26, 'raiz_drenante'], [34, 'terremoto']],
    drops: [['escama', 0.45], ['coral', 0.25], ['escama_dura', 0.03]],
    sprite: { c1: '#ca8a04', c2: '#fef3c7', rx: 34, ry: 23, ears: 'none', tail: 'spike', eyes: 'sleepy', mark: 'gem' } });
  S('tortumonte', 'Tortumonte', 'tierra', [100, 30, 20, 12, 30, 22, 7], {
    exp: 80, passives: ['caparazon', 'espiritu_ferreo'], desc: 'Lleva una pequeña montaña a la espalda. Casi indestructible.',
    learn: SP.tortuarena.learn.concat([[44, 'avalancha'], [56, 'impacto_final']]),
    drops: [['piedra_runica', 0.4], ['escama_dura', 0.06], ['corazon_roca', 0.04]],
    sprite: { c1: '#854d0e', c2: '#fde68a', rx: 38, ry: 27, ears: 'horns', tail: 'spike', eyes: 'sharp', eyeColor: '#fbbf24', mark: 'gem' } });
  link('tortuarena', 30, 'tortumonte');

  // Cavernas Umbrías (16-24)
  S('topazio', 'Topazio', 'luz', [62, 42, 12, 19, 16, 19, 12], {
    exp: 56, passives: ['pozo_mana', 'equilibrio'], desc: 'Cristal vivo que guarda la luz de la superficie.',
    learn: [[1, 'destello'], [16, 'velo_aurora'], [19, 'rayo_luz'], [24, 'curacion'], [30, 'concentracion'], [38, 'juicio']],
    drops: [['polvo_brillante', 0.45], ['piedra_runica', 0.2], ['orbe_solar', 0.02]],
    sprite: { c1: '#f0abfc', c2: '#fdf4ff', rx: 27, ry: 30, ears: 'spikes', tail: 'none', eyes: 'cyclops', eyeColor: '#7c3aed', mark: 'gem' } });
  S('aranuria', 'Arañuria', 'oscuridad', [60, 32, 19, 12, 14, 12, 19], {
    exp: 56, passives: ['instinto', 'pies_ligeros'], desc: 'Araña de las grutas. Teje redes para frenar a sus presas.',
    learn: [[1, 'mordisco'], [16, 'telarana'], [18, 'colmillo_venenoso'], [22, 'garra_umbria'], [28, 'agilidad'], [36, 'golpe_feroz']],
    drops: [['hilo', 0.5], ['esencia_sombria', 0.3], ['colmillo_umbrio', 0.02]],
    sprite: { c1: '#1e1b4b', c2: '#c7d2fe', rx: 28, ry: 22, ears: 'antenna', tail: 'spike', eyes: 'sharp', eyeColor: '#ef4444', mark: 'spots' } });

  // Volcán Ígneo (24-34)
  S('salamandrox', 'Salamandrox', 'fuego', [70, 36, 21, 18, 14, 13, 20], {
    exp: 66, passives: ['furia', 'instinto'], desc: 'Salamandra veloz que nada en lava como si fuera agua.',
    learn: [[1, 'colmillo_ardiente'], [24, 'mordisco_brasa'], [28, 'agilidad'], [32, 'lanzallamas'], [40, 'golpe_feroz'], [48, 'llamarada']],
    drops: [['brasa', 0.5], ['obsidiana', 0.25], ['anillo_brasas', 0.03]],
    sprite: { c1: '#ef4444', c2: '#fecaca', rx: 31, ry: 22, ears: 'crest', tail: 'flame', eyes: 'sharp', eyeColor: '#fde047', mark: 'stripes' } });
  S('geyseron', 'Géyserón', 'agua', [78, 42, 14, 20, 17, 19, 12], {
    exp: 66, passives: ['vitalidad', 'espiritu_ferreo'], desc: 'Vive en los géiseres del volcán. El fuego no le asusta.',
    learn: [[1, 'burbuja'], [24, 'vapor'], [28, 'aguas_curativas'], [32, 'hidrochorro'], [40, 'coraza'], [48, 'maremoto']],
    drops: [['gota', 0.5], ['obsidiana', 0.2], ['perla_marina', 0.05]],
    sprite: { c1: '#0ea5e9', c2: '#f0f9ff', rx: 32, ry: 28, ears: 'fins', tail: 'fin', eyes: 'big', mark: 'spots' } });

  // Templo Áureo (34-46)
  S('sacerdon', 'Sacerdón', 'luz', [78, 56, 14, 23, 17, 23, 16], {
    exp: 78, passives: ['pozo_mana', 'mente_arcana'], desc: 'Búho guardián del templo. Cura a sus aliados con cánticos.',
    learn: [[1, 'rayo_luz'], [34, 'curacion'], [38, 'velo_aurora'], [42, 'juicio'], [52, 'concentracion'], [60, 'supernova']],
    drops: [['polvo_brillante', 0.5], ['nucleo_arcano', 0.08], ['orbe_solar', 0.03]],
    sprite: { c1: '#fef3c7', c2: '#ffffff', rx: 29, ry: 30, ears: 'halo', tail: 'none', eyes: 'big', mark: 'star', wings: true } });
  S('golemar', 'Golemar', 'tierra', [96, 26, 23, 10, 27, 18, 7], {
    exp: 80, passives: ['caparazon', 'espiritu_ferreo'], desc: 'Golem de piedra dorada que protege las puertas del templo.',
    learn: [[1, 'golpe_roca'], [34, 'muralla'], [38, 'embestida'], [44, 'avalancha'], [52, 'rugido'], [60, 'impacto_final']],
    drops: [['piedra_runica', 0.5], ['obsidiana', 0.3], ['coraza_obsidiana', 0.03]],
    sprite: { c1: '#a8a29e', c2: '#fde68a', rx: 36, ry: 30, ears: 'spikes', tail: 'none', eyes: 'cyclops', eyeColor: '#f59e0b', mark: 'gem' } });

  // Abismo Eterno (46-62)
  S('kraknoir', 'Kraknoir', 'oscuridad', [88, 44, 25, 20, 19, 18, 18], {
    exp: 96, passives: ['furia', 'instinto'], desc: 'Calamar de las profundidades. Envuelve a sus presas en tinta negra.',
    learn: [[1, 'garra_umbria'], [46, 'telarana'], [50, 'drenaje_vital'], [54, 'golpe_feroz'], [60, 'pulso_umbrio'], [70, 'eclipse']],
    drops: [['esencia_sombria', 0.5], ['perla_marina', 0.1], ['colmillo_umbrio', 0.04]],
    sprite: { c1: '#312e81', c2: '#a5b4fc', rx: 33, ry: 30, ears: 'antenna', tail: 'curl', eyes: 'glow', eyeColor: '#f472b6', mark: 'spots' } });
  S('fuegofatuo', 'Fuego Fatuo', 'fuego', [74, 54, 13, 27, 14, 21, 23], {
    exp: 96, passives: ['mente_arcana', 'pies_ligeros'], desc: 'Llama errante que guía a los perdidos hacia el abismo.',
    learn: [[1, 'lanzallamas'], [46, 'vapor'], [50, 'concentracion'], [54, 'llamarada'], [62, 'agilidad'], [72, 'infierno']],
    drops: [['brasa', 0.5], ['nucleo_arcano', 0.1], ['lagrima_estelar', 0.03]],
    sprite: { c1: '#22d3ee', c2: '#ecfeff', rx: 24, ry: 30, ears: 'flame', tail: 'flame', eyes: 'glow', eyeColor: '#ffffff' } });

  // Cumbre Celeste (62-90)
  S('auroris', 'Auroris', 'agua', [92, 58, 18, 29, 19, 27, 24], {
    exp: 125, passives: ['pozo_mana', 'equilibrio'], desc: 'Ave de las auroras. Su canto hace llover estrellas.',
    learn: [[1, 'hidrochorro'], [62, 'velo_aurora'], [66, 'aguas_curativas'], [70, 'maremoto'], [78, 'concentracion'], [86, 'diluvio']],
    drops: [['gota', 0.5], ['lagrima_estelar', 0.05], ['elixir', 0.03]],
    sprite: { c1: '#67e8f9', c2: '#f0fdfa', rx: 29, ry: 28, ears: 'crest', tail: 'fin', eyes: 'big', mark: 'star', wings: true } });
  S('petrodraco', 'Petrodraco', 'tierra', [104, 34, 29, 18, 27, 20, 18], {
    exp: 130, passives: ['furia', 'caparazon'], desc: 'Dragón de roca que duerme bajo la cumbre desde hace siglos.',
    learn: [[1, 'avalancha'], [62, 'muralla'], [66, 'terremoto'], [72, 'rugido'], [80, 'golpe_feroz'], [88, 'impacto_final']],
    drops: [['piedra_runica', 0.5], ['corazon_roca', 0.05], ['corona_celeste', 0.005]],
    sprite: { c1: '#57534e', c2: '#fbbf24', rx: 37, ry: 30, ears: 'horns', tail: 'spike', eyes: 'sharp', eyeColor: '#f97316', mark: 'gem', wings: true } });

  /* ---------- En qué zona aparecen ---------- */
  addTo('pradera', 'ratonchi', 2); addTo('pradera', 'charquito', 2);
  addTo('bosque', 'setabruja', 2); addTo('bosque', 'ardillama', 2);
  addTo('costa', 'medusina', 2); addTo('costa', 'tortuarena', 2); addTo('costa', 'ratonix', 1);
  addTo('cavernas', 'topazio', 2); addTo('cavernas', 'aranuria', 2); addTo('cavernas', 'hongoscuro', 1);
  addTo('volcan', 'salamandrox', 2); addTo('volcan', 'geyseron', 2); addTo('volcan', 'fogardilla', 1);
  addTo('templo', 'sacerdon', 2); addTo('templo', 'golemar', 2); addTo('templo', 'tortumonte', 1);
  addTo('abismo', 'kraknoir', 2); addTo('abismo', 'fuegofatuo', 2);
  addTo('cumbre', 'auroris', 2); addTo('cumbre', 'petrodraco', 2);
})();
