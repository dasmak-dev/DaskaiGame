/* =============================================================
 * data/zones.js — Zonas de batalla.
 *
 *  def(id, {
 *    name, desc, icon,
 *    levels: [min, max],          // nivel de los salvajes
 *    colors: [claro, oscuro],     // degradado de la zona
 *    scene:  'meadow'|'forest'|'beach'|'cave'|'volcano'|'temple'|'abyss'|'sky',
 *    unlock: 'zonaAnterior',      // zona que hay que superar
 *    enemies: [W(especie, peso)], // aparición aleatoria por peso
 *    boss: { species, level, title, coins, drops: [[objeto, prob]] }
 *  })
 * El orden de declaración es el orden en que se muestran.
 * ============================================================= */
(function () {
  const Z = (DK.data.zones = {});
  const def = (id, o) => (Z[id] = Object.assign({ id }, o));
  const W = (species, weight = 1) => ({ species, weight });

  def('pradera', { name: 'Pradera Verde', levels: [1, 5], icon: 'leaf', colors: ['#86efac', '#16a34a'], scene: 'meadow',
    desc: 'Campos abiertos donde los daskai jóvenes juegan al sol.',
    enemies: [W('brotin', 3), W('chispon', 3), W('gotin', 3), W('plumin', 2)],
    boss: { species: 'hojaral', level: 8, title: 'Guardián de la Pradera', coins: 120, drops: [['amuleto_arcano', 1], ['polvo_brillante', 1], ['superpocion', 0.6]] } });

  def('bosque', { name: 'Bosque Susurrante', levels: [5, 10], icon: 'leaf', colors: ['#4ade80', '#14532d'], scene: 'forest', unlock: 'pradera',
    desc: 'Un bosque denso donde los árboles parecen hablar.',
    enemies: [W('musguin', 3), W('sombrilo', 2), W('hojaral', 3), W('lucibicho', 2)],
    boss: { species: 'sombrilo', level: 13, title: 'Sombra del Bosque', coins: 220, drops: [['velo_mistico', 1], ['esencia_sombria', 1], ['cristal_vinculo', 0.6]] } });

  def('costa', { name: 'Costa Marea', levels: [10, 16], icon: 'droplet', colors: ['#7dd3fc', '#0369a1'], scene: 'beach', unlock: 'bosque',
    desc: 'Playas y arrecifes golpeados por las olas.',
    enemies: [W('coralin', 3), W('cangrejon', 2), W('salpicon', 3), W('gaviolux', 2)],
    boss: { species: 'cangrejon', level: 19, title: 'Rey de la Marea', coins: 340, drops: [['escama_dura', 1], ['perla_marina', 0.8], ['superpocion', 1]] } });

  def('cavernas', { name: 'Cavernas Umbrías', levels: [16, 24], icon: 'mountain', colors: ['#a78bfa', '#1e1b4b'], scene: 'cave', unlock: 'costa',
    desc: 'Túneles oscuros iluminados por cristales.',
    enemies: [W('murcisombra', 3), W('rocadon', 2), W('gemolito', 2), W('lavagusano', 3)],
    boss: { species: 'gemolito', level: 27, title: 'Corazón de Cristal', coins: 480, drops: [['nucleo_arcano', 1], ['corazon_roca', 0.8], ['cristal_mayor', 0.4]] } });

  def('volcan', { name: 'Volcán Ígneo', levels: [24, 34], icon: 'flame', colors: ['#fdba74', '#7f1d1d'], scene: 'volcano', unlock: 'cavernas',
    desc: 'Ríos de lava y ceniza ardiente.',
    enemies: [W('magmon', 3), W('cenizon', 2), W('ignisaurio', 3), W('obsidiano', 2)],
    boss: { species: 'ignisaurio', level: 37, title: 'Señor de la Lava', coins: 650, drops: [['anillo_brasas', 1], ['coraza_obsidiana', 0.5], ['nucleo_arcano', 1]] } });

  def('templo', { name: 'Templo Áureo', levels: [34, 46], icon: 'sun', colors: ['#fde68a', '#a16207'], scene: 'temple', unlock: 'volcan',
    desc: 'Ruinas sagradas bañadas en luz dorada.',
    enemies: [W('aurelion', 2), W('guardian_solar', 3), W('esfinxa', 2), W('llamasanta', 3)],
    boss: { species: 'aurelion', level: 49, title: 'León del Sol', coins: 850, drops: [['orbe_solar', 1], ['amuleto_vida', 0.5], ['hiperpocion', 1]] } });

  def('abismo', { name: 'Abismo Eterno', levels: [46, 62], icon: 'moon', colors: ['#6366f1', '#020617'], scene: 'abyss', unlock: 'templo',
    desc: 'Profundidades donde nunca ha llegado la luz.',
    enemies: [W('abisalto', 3), W('nocturnis', 2), W('espectron', 2), W('leviatan', 2)],
    boss: { species: 'leviatan', level: 65, title: 'Leviatán Primordial', coins: 1100, drops: [['colmillo_umbrio', 1], ['lagrima_estelar', 0.6], ['elixir', 0.5]] } });

  def('cumbre', { name: 'Cumbre Celeste', levels: [62, 90], icon: 'star', colors: ['#e0f2fe', '#4338ca'], scene: 'sky', unlock: 'abismo',
    desc: 'La cima del mundo, morada de los daskai legendarios.',
    enemies: [W('celestor', 2), W('draconyx', 2), W('titanor', 2), W('vacuo', 2), W('tempestis', 2)],
    boss: { species: 'draconyx', level: 90, title: 'Dragón de la Cumbre', coins: 2000, drops: [['corona_celeste', 1], ['lagrima_estelar', 1], ['elixir', 1]] } });

  /*
   * Jefes ocultos: viven en las cuevas de cada zona (nodo «cueva» del mapa).
   * La primera vez que se vencen quedan DESBLOQUEADOS: desde entonces pueden
   * ser el jefe final de los mapas de esa zona (config.expedition.secretFinalChance).
   *   { species, level, title, coins, drops, phases }
   */
  DK.data.secretBosses = {
    pradera: { species: 'ratonix', level: 11, title: 'Rey de las Madrigueras', coins: 200, drops: [['tonico_viento', 1], ['amuleto_arcano', 0.6], ['superpocion', 1]], phases: [{ at: 0.6, type: 'frenzy' }, { at: 0.3, type: 'enrage' }] },
    bosque: { species: 'hongoscuro', level: 16, title: 'Seta Ancestral', coins: 340, drops: [['tonico_magia', 1], ['esencia_sombria', 1], ['velo_mistico', 0.5]], phases: [{ at: 0.6, type: 'regen' }, { at: 0.3, type: 'frenzy' }] },
    costa: { species: 'tortumonte', level: 22, title: 'Tortuga Milenaria', coins: 500, drops: [['tonico_mana', 1], ['perla_marina', 1], ['superpocion', 1]], phases: [{ at: 0.66, type: 'shield' }, { at: 0.33, type: 'regen' }] },
    cavernas: { species: 'golemar', level: 30, title: 'Golem de las Profundidades', coins: 700, drops: [['tonico_hierro', 1], ['nucleo_arcano', 1], ['cristal_mayor', 0.6]], phases: [{ at: 0.66, type: 'frenzy' }, { at: 0.33, type: 'shield' }] },
    volcan: { species: 'llamasanta', level: 41, title: 'Llama Sagrada', coins: 950, drops: [['tonico_fuerza', 1], ['anillo_brasas', 1], ['coraza_obsidiana', 0.6]], phases: [{ at: 0.66, type: 'enrage' }, { at: 0.33, type: 'frenzy' }] },
    templo: { species: 'celestor', level: 54, title: 'Celestor Ascendido', coins: 1250, drops: [['tonico_espiritu', 1], ['orbe_solar', 1], ['hiperpocion', 1]], phases: [{ at: 0.7, type: 'shield' }, { at: 0.4, type: 'regen' }, { at: 0.2, type: 'enrage' }] },
    abismo: { species: 'vacuo', level: 70, title: 'El Vacío', coins: 1600, drops: [['tonico_vida', 1], ['lagrima_estelar', 0.8], ['colmillo_umbrio', 0.6]], phases: [{ at: 0.7, type: 'frenzy' }, { at: 0.4, type: 'shield' }, { at: 0.2, type: 'enrage' }] },
    cumbre: { species: 'kraknoir', level: 94, title: 'Kraken de la Tormenta', coins: 2800, drops: [['tonico_fuerza', 1], ['tonico_hierro', 1], ['lagrima_estelar', 1]], phases: [{ at: 0.75, type: 'shield' }, { at: 0.5, type: 'frenzy' }, { at: 0.25, type: 'enrage' }] },
  };
})();
