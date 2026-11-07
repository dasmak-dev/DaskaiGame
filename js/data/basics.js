/* =============================================================
 * data/basics.js — Atributos, casas, naturalezas, pasivas,
 * estados alterados y rarezas.
 *
 * Para traducir nombres/descripciones a otro idioma usa el apartado
 * `data` del archivo de idioma (js/lang/en.js); no hace falta tocar aquí.
 * ============================================================= */
(function () {
  const D = DK.data;

  D.statKeys = ['hp', 'mp', 'atk', 'matk', 'def', 'mdef', 'spd'];
  D.stats = {
    hp: { name: 'Vida', short: 'PV', icon: 'heart' },
    mp: { name: 'Maná', short: 'PM', icon: 'sparkle' },
    atk: { name: 'Ataque físico', short: 'ATQ', icon: 'sword' },
    matk: { name: 'Ataque mágico', short: 'ATQ.M', icon: 'wand' },
    def: { name: 'Defensa física', short: 'DEF', icon: 'shield' },
    mdef: { name: 'Defensa mágica', short: 'DEF.M', icon: 'shieldStar' },
    spd: { name: 'Velocidad', short: 'VEL', icon: 'wind' },
    regen: { name: 'Regeneración', short: 'REG', icon: 'regen' },
  };

  /* Cada casa es fuerte contra `strongVs`. Ciclo:
     Luz > Oscuridad > Agua > Fuego > Tierra > Luz */
  D.houses = {
    luz: { id: 'luz', name: 'Luz', color: '#f2b705', cbColor: '#f0e442', icon: 'sun', strongVs: 'oscuridad' },
    oscuridad: { id: 'oscuridad', name: 'Oscuridad', color: '#8b5cf6', cbColor: '#cc79a7', icon: 'moon', strongVs: 'agua' },
    agua: { id: 'agua', name: 'Agua', color: '#0ea5e9', cbColor: '#0072b2', icon: 'droplet', strongVs: 'fuego' },
    fuego: { id: 'fuego', name: 'Fuego', color: '#f97316', cbColor: '#e69f00', icon: 'flame', strongVs: 'tierra' },
    tierra: { id: 'tierra', name: 'Tierra', color: '#65a30d', cbColor: '#7f7f7f', icon: 'mountain', strongVs: 'luz' },
  };

  /* Naturaleza: al subir de nivel cada atributo gana 1-3 puntos "de nivel".
     boost → además +1/+2 puntos por naturaleza (▲)
     lower → la naturaleza le quita 0/1 punto (▼)
     el resto no cambia (=). Ver config.growth. */
  D.natures = {
    tranquila: { name: 'Tranquila', boost: ['hp', 'def'], lower: ['spd'], desc: 'Más vida y defensa física; menos velocidad.' },
    feroz: { name: 'Feroz', boost: ['atk', 'spd'], lower: ['mdef'], desc: 'Más ataque físico y velocidad; menos defensa mágica.' },
    sabia: { name: 'Sabia', boost: ['matk', 'mp'], lower: ['atk'], desc: 'Más ataque mágico y maná; menos ataque físico.' },
    astuta: { name: 'Astuta', boost: ['spd', 'matk'], lower: ['def'], desc: 'Más velocidad y ataque mágico; menos defensa física.' },
    firme: { name: 'Firme', boost: ['def', 'mdef'], lower: ['matk'], desc: 'Más defensa física y mágica; menos ataque mágico.' },
    valiente: { name: 'Valiente', boost: ['atk', 'hp'], lower: ['mp'], desc: 'Más ataque físico y vida; menos maná.' },
    serena: { name: 'Serena', boost: ['mdef', 'mp'], lower: ['spd'], desc: 'Más defensa mágica y maná; menos velocidad.' },
    impetuosa: { name: 'Impetuosa', boost: ['atk', 'matk'], lower: ['hp'], desc: 'Más ataque físico y mágico; menos vida.' },
    equilibrada: { name: 'Equilibrada', boost: [], lower: [], desc: 'Todos los atributos crecen por igual.' },
  };

  /** Efecto de una naturaleza sobre un atributo: 1 (▲), -1 (▼) o 0 (=). */
  D.natureEffect = (natureId, stat) => {
    const n = D.natures[natureId];
    if (!n) return 0;
    if (n.boost.includes(stat)) return 1;
    if ((n.lower || []).includes(stat)) return -1;
    return 0;
  };

  /* Pasivas: modificadores porcentuales de atributos (0.1 = +10%) */
  D.passives = {
    furia: { name: 'Furia contenida', mods: { atk: 0.12, spd: -0.08 }, desc: '+12% ataque físico, -8% velocidad.' },
    instinto: { name: 'Instinto salvaje', mods: { atk: 0.02, spd: -0.02 }, desc: '+2% ataque físico, velocidad ligeramente reducida.' },
    mente_arcana: { name: 'Mente arcana', mods: { matk: 0.2, atk: -0.15 }, desc: '+20% ataque mágico, -15% ataque físico.' },
    caparazon: { name: 'Caparazón', mods: { def: 0.15, spd: -0.1 }, desc: '+15% defensa física, -10% velocidad.' },
    pies_ligeros: { name: 'Pies ligeros', mods: { spd: 0.15, def: -0.1 }, desc: '+15% velocidad, -10% defensa física.' },
    vitalidad: { name: 'Vitalidad', mods: { hp: 0.1 }, regen: 1, desc: '+10% vida y +1% de regeneración.' },
    pozo_mana: { name: 'Pozo de maná', mods: { mp: 0.25, hp: -0.05 }, desc: '+25% maná, -5% vida.' },
    espiritu_ferreo: { name: 'Espíritu férreo', mods: { mdef: 0.15, matk: -0.05 }, desc: '+15% defensa mágica, -5% ataque mágico.' },
    sangre_caliente: { name: 'Sangre caliente', mods: { atk: 0.08, matk: 0.08, def: -0.08, mdef: -0.08 }, desc: '+8% ataques, -8% defensas.' },
    regeneracion: { name: 'Regeneración', mods: { atk: -0.05 }, regen: 2, desc: '+2% de regeneración, -5% ataque físico.' },
    equilibrio: { name: 'Equilibrio', mods: { hp: 0.03, mp: 0.03, atk: 0.03, matk: 0.03, def: 0.03, mdef: 0.03, spd: 0.03 }, desc: '+3% a todos los atributos.' },
    // --- Al entrar en combate (v4.40): efecto temporal durante `turns` turnos (systems/battle.js applyEntry) ---
    mirada_fiera: { name: 'Mirada fiera', entry: { target: 'enemy', stats: ['atk'], pct: -0.15, turns: 3 }, desc: 'Al entrar: el rival -15% ataque físico durante 3 turnos.' },
    niebla_arcana: { name: 'Niebla arcana', entry: { target: 'enemy', stats: ['matk'], pct: -0.15, turns: 3 }, desc: 'Al entrar: el rival -15% ataque mágico durante 3 turnos.' },
    rompecorazas: { name: 'Rompecorazas', entry: { target: 'enemy', stats: ['def'], pct: -0.15, turns: 3 }, desc: 'Al entrar: el rival -15% defensa física durante 3 turnos.' },
    pegajoso: { name: 'Pegajoso', entry: { target: 'enemy', stats: ['spd'], pct: -0.2, turns: 3 }, desc: 'Al entrar: el rival -20% velocidad durante 3 turnos.' },
    arranque: { name: 'Arranque', entry: { target: 'self', stats: ['spd'], pct: 0.25, turns: 3 }, desc: 'Al entrar: +25% velocidad durante 3 turnos.' },
    adrenalina: { name: 'Adrenalina', entry: { target: 'self', stats: ['atk'], pct: 0.2, turns: 3 }, desc: 'Al entrar: +20% ataque físico durante 3 turnos.' },
    foco_arcano: { name: 'Foco arcano', entry: { target: 'self', stats: ['matk'], pct: 0.2, turns: 3 }, desc: 'Al entrar: +20% ataque mágico durante 3 turnos.' },
    guardia_alta: { name: 'Guardia alta', entry: { target: 'self', stats: ['def', 'mdef'], pct: 0.2, turns: 2 }, desc: 'Al entrar: +20% defensas durante 2 turnos.' },
  };

  /* Estados alterados */
  D.statuses = {
    veneno: { name: 'Envenenado', icon: 'poison', color: '#a855f7', dot: 0.06, desc: 'Pierde un 6% de vida por turno.' },
    quemadura: { name: 'Quemado', icon: 'flame', color: '#f97316', dot: 0.05, atkMult: 0.8, desc: 'Pierde un 5% de vida por turno y su ataque físico baja un 20%.' },
  };

  /* RASGOS (en el código, «roles»): cada daskai nace con uno AL AZAR
     (config.roleChance, 20%) o sin rasgo. Tener rasgo es una ventaja: `mods`
     suma o resta un % a su atributo base (systems/daskai.js → baseOf), así
     que cambia lo que se ve en su ficha y lo que pega y aguanta en combate.
     `weight` = rareza relativa. */
  D.roles = {
    equilibrado: { name: 'Sin rasgo', icon: 'scale', mods: {} },
    tanque: { name: 'Coloso', icon: 'shield', weight: 1, mods: { hp: 0.15, def: 0.2, spd: -0.05 } },
    muro: { name: 'Guardián', icon: 'shieldStar', weight: 1, mods: { hp: 0.15, mdef: 0.2, atk: -0.05 } },
    fisico: { name: 'Bravo', icon: 'swords', weight: 1, mods: { atk: 0.2, spd: 0.05, matk: -0.05 } },
    mago: { name: 'Arcano', icon: 'wand', weight: 1, mods: { matk: 0.2, mp: 0.15, atk: -0.05 } },
    veloz: { name: 'Raudo', icon: 'wind', weight: 1, mods: { spd: 0.25, atk: 0.05, def: -0.05 } },
    soporte: { name: 'Sabio', icon: 'heart', weight: 1, mods: { mp: 0.2, hp: 0.1, mdef: 0.1, atk: -0.05 } },
    cristal: { name: 'Temerario', icon: 'flame', weight: 0.6, mods: { atk: 0.12, matk: 0.12, spd: 0.12, def: -0.1, mdef: -0.1 } },
  };

  D.rarities = {
    comun: { name: 'Común', order: 1 },
    raro: { name: 'Raro', order: 2 },
    epico: { name: 'Épico', order: 3 },
    legendario: { name: 'Legendario', order: 4 },
  };

  // Añade `id` a cada entrada para poder traducirlas con DK.tr()
  /* Categorías de objetos (data/items.json → category) */
  D.categories = {
    batalla: { id: 'batalla', name: 'Batalla', icon: 'flask', desc: 'Pociones y objetos para usar en combate.' },
    mejora: { id: 'mejora', name: 'Mejora', icon: 'star', desc: 'Objetos que dan experiencia o mejoran para siempre a tus daskai fuera de combate.' },
    equipo: { id: 'equipo', name: 'Equipamiento', icon: 'gem', desc: 'Objetos que se equipan a los daskai.' },
    pieza: { id: 'pieza', name: 'Piezas', icon: 'cube', desc: 'Materiales para construir objetos en Crafteo.' },
    forja: { id: 'forja', name: 'Forja', icon: 'anvil', desc: 'Piedras para mejorar el equipamiento: subir su rareza y volver a tirar sus afijos.' },
  };

  /* Fases de los jefes (data/zones.json → boss.phases / secretBoss.phases) */
  D.phaseTypes = {
    enrage: { icon: 'flame' }, regen: { icon: 'regen' }, shield: { icon: 'shield' }, frenzy: { icon: 'bolt' },
  };

  [D.stats, D.natures, D.passives, D.statuses, D.rarities, D.roles].forEach((group) => Object.entries(group).forEach(([id, o]) => (o.id = id)));

  /** Color de una casa según el modo daltónico. */
  D.houseColor = (id) => {
    const hs = D.houses[id];
    return DK.settings && DK.settings.get('colorblind') ? hs.cbColor : hs.color;
  };
})();
