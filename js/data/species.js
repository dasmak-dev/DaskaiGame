/* =============================================================
 * data/species.js — Especies de daskai.
 *
 *  S(id, nombre, casa, [vida, maná, atq, atq.m, def, def.m, vel], {
 *    desc:     descripción para el códice,
 *    starter:  true si aparece en la elección inicial,
 *    exp:      experiencia base que da al ser derrotado,
 *    passives: pasivas posibles (se elige una al azar al nacer),
 *    learn:    [[nivel, ataque], ...] ataques que aprende al subir de nivel,
 *    drops:    [[objeto, probabilidad 0-1], ...],
 *    sprite:   parámetros del dibujo (ver systems/sprites.js) o { img: 'ruta.png' }
 *  })
 * Las evoluciones se definen en data/evolutions.js.
 * ============================================================= */
(function () {
  const SP = (DK.data.species = {});
  const S = (id, name, house, b, o) => {
    SP[id] = Object.assign({
      id, name, house,
      base: { hp: b[0], mp: b[1], atk: b[2], matk: b[3], def: b[4], mdef: b[5], spd: b[6] },
      exp: 40, drops: [], passives: ['equilibrio'],
    }, o);
  };

  /* ======================= INICIALES ======================= */
  S('lumino', 'Lumino', 'luz', [58, 40, 12, 16, 12, 15, 15], {
    starter: true, exp: 50, passives: ['pozo_mana', 'equilibrio', 'mente_arcana'],
    desc: 'Un zorrito que guarda la luz del amanecer en su cola. Curioso y leal.',
    learn: [[1, 'placaje'], [1, 'destello'], [4, 'concentracion'], [8, 'aranazo'], [12, 'golpe_aureo'], [16, 'curacion'], [21, 'rayo_luz'], [27, 'agilidad'], [34, 'golpe_feroz'], [42, 'juicio'], [55, 'impacto_final'], [68, 'supernova']],
    sprite: { c1: '#ffd65a', c2: '#fff6d5', rx: 30, ry: 26, ears: 'cat', tail: 'orb', eyes: 'big', mark: 'star' },
  });
  S('umbrix', 'Umbrix', 'oscuridad', [55, 35, 16, 14, 11, 12, 17], {
    starter: true, exp: 50, passives: ['pies_ligeros', 'furia', 'instinto'],
    desc: 'Felino de sombra que acecha en silencio. Rápido y astuto.',
    learn: [[1, 'aranazo'], [1, 'sombra_vil'], [4, 'intimidar'], [8, 'mordisco'], [12, 'colmillo_venenoso'], [16, 'garra_umbria'], [21, 'drenaje_vital'], [27, 'pulso_umbrio'], [34, 'agilidad'], [42, 'golpe_feroz'], [55, 'impacto_final'], [68, 'eclipse']],
    sprite: { c1: '#6d4bd8', c2: '#c4b5fd', rx: 29, ry: 25, ears: 'cat', tail: 'curl', eyes: 'sharp', eyeColor: '#facc15', mark: 'moon' },
  });
  S('pyrex', 'Pyrex', 'fuego', [56, 36, 17, 15, 12, 11, 14], {
    starter: true, exp: 50, passives: ['furia', 'sangre_caliente', 'instinto'],
    desc: 'Salamandra temperamental cuya cola arde con más fuerza cuanto más se enfada.',
    learn: [[1, 'aranazo'], [1, 'chispa'], [4, 'rugido'], [8, 'colmillo_ardiente'], [12, 'embestida'], [16, 'puno_igneo'], [21, 'lanzallamas'], [27, 'agilidad'], [34, 'golpe_feroz'], [42, 'llamarada'], [55, 'impacto_final'], [68, 'infierno']],
    sprite: { c1: '#f97316', c2: '#fed7aa', rx: 31, ry: 25, ears: 'crest', tail: 'flame', eyes: 'big', mark: 'stripes' },
  });
  S('aquelo', 'Aquelo', 'agua', [62, 38, 13, 15, 13, 16, 12], {
    starter: true, exp: 50, passives: ['vitalidad', 'espiritu_ferreo', 'regeneracion'],
    desc: 'Nutria juguetona que nada entre corrientes. Muy resistente.',
    learn: [[1, 'placaje'], [1, 'burbuja'], [4, 'coraza'], [8, 'mordisco'], [12, 'acua_cola'], [16, 'aguas_curativas'], [21, 'hidrochorro'], [27, 'concentracion'], [34, 'embestida'], [42, 'maremoto'], [55, 'golpe_feroz'], [68, 'diluvio']],
    sprite: { c1: '#38bdf8', c2: '#e0f2fe', rx: 31, ry: 27, ears: 'fins', tail: 'fin', eyes: 'big', mark: 'spots' },
  });
  S('terron', 'Terrón', 'tierra', [68, 28, 15, 11, 17, 13, 9], {
    starter: true, exp: 50, passives: ['caparazon', 'vitalidad', 'furia'],
    desc: 'Pequeño topo acorazado. Lento, pero casi imposible de derribar.',
    learn: [[1, 'placaje'], [1, 'lodo'], [4, 'coraza'], [8, 'embestida'], [12, 'golpe_roca'], [16, 'raiz_drenante'], [21, 'polen_toxico'], [27, 'rugido'], [34, 'golpe_feroz'], [42, 'terremoto'], [55, 'impacto_final'], [68, 'avalancha']],
    sprite: { c1: '#a16207', c2: '#fde68a', rx: 34, ry: 26, ears: 'horns', tail: 'spike', eyes: 'big', mark: 'gem' },
  });

  /* ======================= PRADERA VERDE (1-5) ======================= */
  S('brotin', 'Brotín', 'tierra', [50, 25, 11, 10, 13, 11, 9], {
    exp: 36, passives: ['vitalidad', 'caparazon'], desc: 'Un brote con patas que duerme al sol.',
    learn: [[1, 'placaje'], [3, 'lodo'], [6, 'raiz_drenante'], [10, 'coraza'], [15, 'golpe_roca'], [22, 'polen_toxico'], [30, 'terremoto']],
    drops: [['hilo', 0.45], ['gota', 0.25], ['pocion', 0.15], ['piedra_runica', 0.05]],
    sprite: { c1: '#84cc16', c2: '#ecfccb', rx: 27, ry: 23, ears: 'leaf', tail: 'none', eyes: 'sleepy' },
  });
  S('chispon', 'Chispón', 'fuego', [46, 28, 13, 12, 10, 9, 13], {
    exp: 38, passives: ['instinto', 'sangre_caliente'], desc: 'Pequeña chispa inquieta que salta de hierba en hierba.',
    learn: [[1, 'aranazo'], [3, 'chispa'], [7, 'colmillo_ardiente'], [12, 'rugido'], [16, 'puno_igneo'], [24, 'lanzallamas'], [36, 'llamarada']],
    drops: [['brasa', 0.45], ['fragmento_garra', 0.3], ['balsamo', 0.12], ['polvo_brillante', 0.05]],
    sprite: { c1: '#fb923c', c2: '#ffedd5', rx: 25, ry: 22, ears: 'flame', tail: 'flame', eyes: 'big' },
  });
  S('gotin', 'Gotín', 'agua', [52, 30, 9, 12, 11, 13, 10], {
    exp: 36, passives: ['regeneracion', 'espiritu_ferreo'], desc: 'Gota viviente que rebota feliz por los charcos.',
    learn: [[1, 'placaje'], [2, 'burbuja'], [6, 'coraza'], [10, 'aguas_curativas'], [14, 'acua_cola'], [22, 'hidrochorro'], [34, 'maremoto']],
    drops: [['gota', 0.5], ['coral', 0.2], ['eter', 0.12], ['perla_marina', 0.02]],
    sprite: { c1: '#7dd3fc', c2: '#f0f9ff', rx: 25, ry: 25, ears: 'none', tail: 'none', eyes: 'big', mark: 'spots' },
  });
  S('plumin', 'Plumín', 'luz', [44, 26, 11, 11, 9, 10, 16], {
    exp: 37, passives: ['pies_ligeros', 'equilibrio'], desc: 'Pajarito dorado que anuncia el amanecer.',
    learn: [[1, 'picotazo'], [3, 'destello'], [7, 'agilidad'], [11, 'ala_cortante'], [15, 'rayo_luz'], [22, 'curacion'], [30, 'juicio']],
    drops: [['pluma', 0.5], ['polvo_brillante', 0.1], ['pocion', 0.15], ['pluma_veloz', 0.02]],
    sprite: { c1: '#fde047', c2: '#fffbeb', rx: 23, ry: 22, ears: 'crest', tail: 'none', eyes: 'big', wings: true },
  });

  /* ======================= BOSQUE SUSURRANTE (5-10) ======================= */
  S('musguin', 'Musguín', 'tierra', [58, 24, 12, 10, 15, 12, 7], {
    exp: 42, passives: ['caparazon', 'vitalidad'], desc: 'Cubierto de musgo, se confunde con las rocas del bosque.',
    learn: [[1, 'placaje'], [5, 'lodo'], [8, 'coraza'], [12, 'golpe_roca'], [16, 'raiz_drenante'], [24, 'terremoto'], [36, 'avalancha']],
    drops: [['hilo', 0.5], ['piedra_runica', 0.1], ['antidoto', 0.15], ['escama_dura', 0.02]],
    sprite: { c1: '#4d7c0f', c2: '#bef264', rx: 32, ry: 22, ears: 'spikes', tail: 'none', eyes: 'sleepy', mark: 'spots' },
  });
  S('sombrilo', 'Sombrilo', 'oscuridad', [48, 30, 12, 14, 10, 11, 15], {
    exp: 44, passives: ['pies_ligeros', 'mente_arcana'], desc: 'Vive en la sombra de los árboles más viejos.',
    learn: [[1, 'aranazo'], [4, 'sombra_vil'], [8, 'colmillo_venenoso'], [12, 'intimidar'], [16, 'drenaje_vital'], [22, 'pulso_umbrio'], [38, 'eclipse']],
    drops: [['esencia_sombria', 0.3], ['pelaje', 0.4], ['antidoto', 0.15], ['velo_mistico', 0.02]],
    sprite: { c1: '#4c1d95', c2: '#a78bfa', rx: 24, ry: 24, ears: 'long', tail: 'curl', eyes: 'glow', eyeColor: '#f0abfc' },
  });
  S('hojaral', 'Hojaral', 'tierra', [54, 30, 10, 14, 12, 13, 11], {
    exp: 43, passives: ['mente_arcana', 'regeneracion'], desc: 'Su cuerpo de hojas suelta un polen adormecedor.',
    learn: [[1, 'placaje'], [4, 'polen_toxico'], [7, 'lodo'], [11, 'raiz_drenante'], [15, 'concentracion'], [22, 'golpe_roca'], [30, 'terremoto']],
    drops: [['hilo', 0.45], ['gota', 0.3], ['antidoto', 0.2], ['amuleto_arcano', 0.02]],
    sprite: { c1: '#22c55e', c2: '#dcfce7', rx: 26, ry: 28, ears: 'leaf', tail: 'leaf', eyes: 'big' },
  });
  S('lucibicho', 'Lucibicho', 'luz', [46, 34, 9, 15, 10, 13, 14], {
    exp: 45, passives: ['pozo_mana', 'mente_arcana'], desc: 'Insecto luminoso que ilumina los senderos nocturnos.',
    learn: [[1, 'picotazo'], [3, 'destello'], [8, 'concentracion'], [12, 'curacion'], [16, 'rayo_luz'], [26, 'juicio'], [40, 'supernova']],
    drops: [['polvo_brillante', 0.25], ['pluma', 0.35], ['eter', 0.15]],
    sprite: { c1: '#facc15', c2: '#fef9c3', rx: 22, ry: 20, ears: 'antenna', tail: 'orb', eyes: 'big', wings: true },
  });

  /* ======================= COSTA MAREA (10-16) ======================= */
  S('coralin', 'Coralín', 'agua', [60, 32, 11, 14, 15, 15, 8], {
    exp: 50, passives: ['espiritu_ferreo', 'caparazon'], desc: 'Arrecife andante que protege a los pequeños peces.',
    learn: [[1, 'burbuja'], [5, 'coraza'], [10, 'acua_cola'], [14, 'aguas_curativas'], [18, 'hidrochorro'], [28, 'maremoto']],
    drops: [['coral', 0.5], ['gota', 0.35], ['perla_marina', 0.03], ['superpocion', 0.05]],
    sprite: { c1: '#fb7185', c2: '#ffe4e6', rx: 28, ry: 24, ears: 'spikes', tail: 'none', eyes: 'big', mark: 'spots' },
  });
  S('cangrejon', 'Cangrejón', 'tierra', [64, 20, 17, 8, 18, 10, 8], {
    exp: 52, passives: ['caparazon', 'furia'], desc: 'Sus pinzas pueden partir rocas.',
    learn: [[1, 'tenaza'], [6, 'coraza'], [8, 'embestida'], [10, 'golpe_roca'], [14, 'rugido'], [22, 'golpe_feroz'], [32, 'avalancha']],
    drops: [['escama', 0.45], ['fragmento_garra', 0.35], ['piedra_runica', 0.1], ['escama_dura', 0.03]],
    sprite: { c1: '#dc2626', c2: '#fecaca', rx: 36, ry: 20, ears: 'antenna', tail: 'none', eyes: 'big' },
  });
  S('salpicon', 'Salpicón', 'agua', [52, 30, 14, 13, 11, 11, 17], {
    exp: 50, passives: ['pies_ligeros', 'instinto'], desc: 'Salta entre las olas a toda velocidad.',
    learn: [[1, 'placaje'], [4, 'burbuja'], [9, 'agilidad'], [12, 'acua_cola'], [16, 'mordisco'], [20, 'hidrochorro'], [30, 'golpe_feroz'], [40, 'maremoto']],
    drops: [['gota', 0.45], ['escama', 0.3], ['eter', 0.15], ['pluma_veloz', 0.03]],
    sprite: { c1: '#0284c7', c2: '#bae6fd', rx: 28, ry: 22, ears: 'fins', tail: 'fin', eyes: 'sharp', eyeColor: '#0f172a' },
  });
  S('gaviolux', 'Gaviolux', 'luz', [50, 30, 15, 12, 11, 11, 18], {
    exp: 52, passives: ['pies_ligeros', 'furia'], desc: 'Ave costera que planea sobre los rayos del sol.',
    learn: [[1, 'picotazo'], [5, 'destello'], [9, 'ala_cortante'], [13, 'agilidad'], [18, 'golpe_aureo'], [24, 'rayo_luz'], [34, 'juicio']],
    drops: [['pluma', 0.5], ['polvo_brillante', 0.2], ['pocion', 0.2], ['pluma_veloz', 0.04]],
    sprite: { c1: '#f8fafc', c2: '#fde68a', rx: 25, ry: 22, ears: 'crest', tail: 'spike', eyes: 'sharp', eyeColor: '#0f172a', wings: true },
  });

  /* ======================= CAVERNAS UMBRÍAS (16-24) ======================= */
  S('murcisombra', 'Murcisombra', 'oscuridad', [54, 32, 15, 14, 11, 12, 19], {
    exp: 60, passives: ['pies_ligeros', 'instinto'], desc: 'Cuelga del techo de las cuevas y caza a ciegas.',
    learn: [[1, 'mordisco'], [8, 'sombra_vil'], [14, 'colmillo_venenoso'], [18, 'drenaje_vital'], [22, 'garra_umbria'], [28, 'pulso_umbrio'], [40, 'eclipse']],
    drops: [['esencia_sombria', 0.4], ['pelaje', 0.3], ['antidoto', 0.2], ['colmillo_umbrio', 0.02]],
    sprite: { c1: '#3b0764', c2: '#c084fc', rx: 24, ry: 21, ears: 'cat', tail: 'none', eyes: 'glow', eyeColor: '#f43f5e', wings: true },
  });
  S('rocadon', 'Rocadón', 'tierra', [72, 20, 18, 9, 22, 12, 6], {
    exp: 64, passives: ['caparazon', 'vitalidad'], desc: 'Gigante de piedra que duerme durante siglos.',
    learn: [[1, 'placaje'], [8, 'golpe_roca'], [14, 'coraza'], [18, 'embestida'], [22, 'terremoto'], [30, 'golpe_feroz'], [40, 'avalancha']],
    drops: [['piedra_runica', 0.3], ['escama', 0.3], ['obsidiana', 0.08], ['corazon_roca', 0.03]],
    sprite: { c1: '#78716c', c2: '#d6d3d1', rx: 36, ry: 28, ears: 'spikes', tail: 'none', eyes: 'sleepy', mark: 'stripes' },
  });
  S('gemolito', 'Gemolito', 'luz', [58, 40, 10, 18, 16, 18, 9], {
    exp: 64, passives: ['espiritu_ferreo', 'pozo_mana'], desc: 'Cristal vivo que refleja la poca luz de la caverna.',
    learn: [[1, 'destello'], [8, 'coraza'], [14, 'rayo_luz'], [18, 'curacion'], [24, 'concentracion'], [30, 'juicio'], [44, 'supernova']],
    drops: [['polvo_brillante', 0.4], ['piedra_runica', 0.2], ['nucleo_arcano', 0.03], ['velo_mistico', 0.03]],
    sprite: { c1: '#67e8f9', c2: '#ecfeff', rx: 26, ry: 28, ears: 'spikes', tail: 'none', eyes: 'cyclops', mark: 'gem' },
  });
  S('lavagusano', 'Lavagusano', 'fuego', [62, 28, 16, 15, 14, 10, 10], {
    exp: 62, passives: ['sangre_caliente', 'vitalidad'], desc: 'Excava túneles fundiendo la roca a su paso.',
    learn: [[1, 'placaje'], [8, 'chispa'], [12, 'colmillo_ardiente'], [17, 'puno_igneo'], [22, 'lanzallamas'], [32, 'llamarada']],
    drops: [['brasa', 0.5], ['obsidiana', 0.06], ['balsamo', 0.2], ['anillo_brasas', 0.03]],
    sprite: { c1: '#b91c1c', c2: '#fdba74', rx: 38, ry: 18, ears: 'none', tail: 'spike', eyes: 'glow', eyeColor: '#fde047', mark: 'stripes' },
  });

  /* ======================= VOLCÁN ÍGNEO (24-34) ======================= */
  S('magmon', 'Magmón', 'fuego', [70, 34, 18, 18, 16, 14, 10], {
    exp: 75, passives: ['sangre_caliente', 'furia'], desc: 'Su cuerpo es roca fundida en constante ebullición.',
    learn: [[1, 'chispa'], [10, 'puno_igneo'], [20, 'lanzallamas'], [26, 'rugido'], [30, 'llamarada'], [44, 'infierno']],
    drops: [['brasa', 0.55], ['obsidiana', 0.2], ['superpocion', 0.08], ['anillo_brasas', 0.04]],
    sprite: { c1: '#ea580c', c2: '#facc15', rx: 34, ry: 28, ears: 'flame', tail: 'flame', eyes: 'glow', eyeColor: '#fef08a' },
  });
  S('cenizon', 'Cenizón', 'oscuridad', [60, 38, 14, 19, 13, 15, 16], {
    exp: 76, passives: ['mente_arcana', 'pozo_mana'], desc: 'Espíritu nacido de la ceniza de las erupciones.',
    learn: [[1, 'sombra_vil'], [10, 'intimidar'], [18, 'drenaje_vital'], [24, 'pulso_umbrio'], [32, 'concentracion'], [46, 'eclipse']],
    drops: [['esencia_sombria', 0.4], ['brasa', 0.3], ['supereter', 0.06], ['velo_mistico', 0.04]],
    sprite: { c1: '#44403c', c2: '#a8a29e', rx: 26, ry: 30, ears: 'horns', tail: 'curl', eyes: 'glow', eyeColor: '#fb923c' },
  });
  S('ignisaurio', 'Ignisaurio', 'fuego', [76, 26, 22, 12, 18, 11, 13], {
    exp: 80, passives: ['furia', 'instinto'], desc: 'Reptil feroz que domina las laderas del volcán.',
    learn: [[1, 'aranazo'], [10, 'colmillo_ardiente'], [18, 'puno_igneo'], [24, 'golpe_feroz'], [30, 'rugido'], [38, 'impacto_final'], [50, 'llamarada']],
    drops: [['fragmento_garra', 0.5], ['brasa', 0.35], ['garra_afilada', 0.05], ['nucleo_arcano', 0.03]],
    sprite: { c1: '#c2410c', c2: '#fed7aa', rx: 34, ry: 26, ears: 'crest', tail: 'spike', eyes: 'sharp', eyeColor: '#facc15', mark: 'stripes' },
  });
  S('obsidiano', 'Obsidiano', 'tierra', [80, 24, 19, 12, 24, 15, 7], {
    exp: 80, passives: ['caparazon', 'espiritu_ferreo'], desc: 'Coloso de cristal volcánico, frío al tacto.',
    learn: [[1, 'golpe_roca'], [12, 'coraza'], [20, 'embestida'], [26, 'terremoto'], [34, 'avalancha']],
    drops: [['obsidiana', 0.4], ['piedra_runica', 0.3], ['coraza_obsidiana', 0.02], ['superpocion', 0.06]],
    sprite: { c1: '#1e293b', c2: '#64748b', rx: 35, ry: 29, ears: 'spikes', tail: 'none', eyes: 'cyclops', mark: 'gem' },
  });

  /* ======================= TEMPLO ÁUREO (34-46) ======================= */
  S('aurelion', 'Áurelion', 'luz', [74, 40, 20, 20, 17, 17, 17], {
    exp: 90, passives: ['equilibrio', 'furia'], desc: 'León dorado que custodia las puertas del templo.',
    learn: [[1, 'golpe_aureo'], [12, 'rayo_luz'], [20, 'rugido'], [30, 'juicio'], [38, 'golpe_feroz'], [50, 'supernova']],
    drops: [['polvo_brillante', 0.45], ['nucleo_arcano', 0.06], ['orbe_solar', 0.02], ['cristal_vinculo', 0.08]],
    sprite: { c1: '#eab308', c2: '#fef3c7', rx: 33, ry: 27, ears: 'cat', tail: 'orb', eyes: 'sharp', eyeColor: '#7c2d12', mark: 'star' },
  });
  S('guardian_solar', 'Guardián Solar', 'luz', [86, 36, 18, 16, 24, 22, 9], {
    exp: 92, passives: ['caparazon', 'vitalidad'], desc: 'Estatua animada por la luz del sol.',
    learn: [[1, 'golpe_aureo'], [10, 'coraza'], [20, 'curacion'], [30, 'juicio'], [40, 'impacto_final']],
    drops: [['piedra_runica', 0.4], ['polvo_brillante', 0.3], ['escama_dura', 0.05], ['amuleto_vida', 0.02]],
    sprite: { c1: '#d4a017', c2: '#fde68a', rx: 32, ry: 32, ears: 'halo', tail: 'none', eyes: 'cyclops', mark: 'gem' },
  });
  S('esfinxa', 'Esfinxa', 'tierra', [72, 44, 15, 22, 16, 20, 15], {
    exp: 90, passives: ['mente_arcana', 'espiritu_ferreo'], desc: 'Plantea acertijos a quien se atreve a entrar.',
    learn: [[1, 'lodo'], [12, 'raiz_drenante'], [20, 'concentracion'], [28, 'terremoto'], [36, 'polen_toxico'], [44, 'avalancha']],
    drops: [['piedra_runica', 0.4], ['hilo', 0.3], ['nucleo_arcano', 0.05], ['supereter', 0.08]],
    sprite: { c1: '#ca8a04', c2: '#fef9c3', rx: 31, ry: 27, ears: 'long', tail: 'curl', eyes: 'sharp', eyeColor: '#0ea5e9', mark: 'gem', wings: true },
  });
  S('llamasanta', 'Llamasanta', 'fuego', [66, 46, 14, 24, 14, 19, 16], {
    exp: 92, passives: ['pozo_mana', 'mente_arcana'], desc: 'Llama eterna que arde en el altar del templo.',
    learn: [[1, 'chispa'], [12, 'lanzallamas'], [20, 'concentracion'], [30, 'curacion'], [36, 'llamarada'], [50, 'infierno']],
    drops: [['brasa', 0.4], ['polvo_brillante', 0.3], ['panacea', 0.08], ['orbe_solar', 0.02]],
    sprite: { c1: '#f59e0b', c2: '#fff7ed', rx: 24, ry: 30, ears: 'flame', tail: 'none', eyes: 'glow', eyeColor: '#ffffff', mark: 'star' },
  });

  /* ======================= ABISMO ETERNO (46-62) ======================= */
  S('abisalto', 'Abisalto', 'agua', [84, 40, 22, 18, 20, 18, 14], {
    exp: 105, passives: ['furia', 'vitalidad'], desc: 'Depredador de las profundidades sin luz.',
    learn: [[1, 'acua_cola'], [16, 'hidrochorro'], [28, 'golpe_feroz'], [40, 'maremoto'], [54, 'impacto_final']],
    drops: [['coral', 0.4], ['gota', 0.4], ['perla_marina', 0.06], ['hiperpocion', 0.04]],
    sprite: { c1: '#1e3a8a', c2: '#60a5fa', rx: 36, ry: 24, ears: 'fins', tail: 'fin', eyes: 'glow', eyeColor: '#67e8f9', mark: 'spots' },
  });
  S('nocturnis', 'Nocturnis', 'oscuridad', [74, 46, 18, 24, 16, 19, 20], {
    exp: 110, passives: ['pies_ligeros', 'mente_arcana'], desc: 'Señor de la noche perpetua del abismo.',
    learn: [[1, 'sombra_vil'], [16, 'pulso_umbrio'], [26, 'drenaje_vital'], [36, 'agilidad'], [48, 'eclipse']],
    drops: [['esencia_sombria', 0.5], ['nucleo_arcano', 0.08], ['colmillo_umbrio', 0.04], ['supereter', 0.1]],
    sprite: { c1: '#1e1b4b', c2: '#818cf8', rx: 28, ry: 28, ears: 'horns', tail: 'curl', eyes: 'sharp', eyeColor: '#f43f5e', wings: true, mark: 'moon' },
  });
  S('espectron', 'Espectrón', 'oscuridad', [68, 52, 12, 27, 14, 24, 18], {
    exp: 110, passives: ['mente_arcana', 'pozo_mana'], desc: 'Un eco de algo que una vez estuvo vivo.',
    learn: [[1, 'sombra_vil'], [14, 'intimidar'], [24, 'pulso_umbrio'], [34, 'drenaje_vital'], [44, 'concentracion'], [52, 'eclipse']],
    drops: [['esencia_sombria', 0.5], ['polvo_brillante', 0.3], ['velo_mistico', 0.06], ['lagrima_estelar', 0.01]],
    sprite: { c1: '#a5b4fc', c2: '#eef2ff', rx: 25, ry: 31, ears: 'none', tail: 'curl', eyes: 'glow', eyeColor: '#312e81' },
  });
  S('leviatan', 'Leviatán', 'agua', [96, 40, 24, 20, 22, 20, 12], {
    exp: 118, passives: ['vitalidad', 'caparazon'], desc: 'Serpiente marina de leyenda.',
    learn: [[1, 'mordisco'], [20, 'hidrochorro'], [30, 'golpe_feroz'], [44, 'maremoto'], [58, 'diluvio']],
    drops: [['escama', 0.5], ['coral', 0.3], ['amuleto_vida', 0.03], ['hiperpocion', 0.06]],
    sprite: { c1: '#0e7490', c2: '#a5f3fc', rx: 38, ry: 26, ears: 'crest', tail: 'fin', eyes: 'sharp', eyeColor: '#fde047', mark: 'stripes' },
  });

  /* ======================= CUMBRE CELESTE (62-90) ======================= */
  S('celestor', 'Celestor', 'luz', [88, 50, 22, 26, 20, 24, 22], {
    exp: 130, passives: ['equilibrio', 'pozo_mana'], desc: 'Ser celestial que sólo aparece entre las nubes.',
    learn: [[1, 'golpe_aureo'], [1, 'rayo_luz'], [30, 'juicio'], [50, 'curacion'], [62, 'supernova']],
    drops: [['lagrima_estelar', 0.04], ['polvo_brillante', 0.5], ['corona_celeste', 0.005], ['elixir', 0.03]],
    sprite: { c1: '#fef08a', c2: '#ffffff', rx: 30, ry: 30, ears: 'halo', tail: 'orb', eyes: 'big', mark: 'star', wings: true },
  });
  S('draconyx', 'Draconyx', 'fuego', [96, 44, 28, 24, 22, 18, 20], {
    exp: 140, passives: ['furia', 'sangre_caliente'], desc: 'Dragón que anida en la cima del mundo.',
    learn: [[1, 'puno_igneo'], [30, 'llamarada'], [50, 'golpe_feroz'], [66, 'infierno'], [72, 'impacto_final']],
    drops: [['brasa', 0.5], ['obsidiana', 0.3], ['lagrima_estelar', 0.03], ['botas_viento', 0.03]],
    sprite: { c1: '#991b1b', c2: '#fca5a5', rx: 36, ry: 30, ears: 'horns', tail: 'flame', eyes: 'sharp', eyeColor: '#fde047', wings: true, mark: 'stripes' },
  });
  S('titanor', 'Titanor', 'tierra', [110, 34, 28, 16, 30, 22, 10], {
    exp: 140, passives: ['caparazon', 'vitalidad'], desc: 'Su paso hace temblar las montañas.',
    learn: [[1, 'golpe_roca'], [30, 'terremoto'], [50, 'coraza'], [64, 'avalancha'], [74, 'impacto_final']],
    drops: [['piedra_runica', 0.5], ['obsidiana', 0.3], ['coraza_obsidiana', 0.04], ['lagrima_estelar', 0.02]],
    sprite: { c1: '#57534e', c2: '#a3e635', rx: 40, ry: 31, ears: 'horns', tail: 'spike', eyes: 'cyclops', mark: 'gem' },
  });
  S('vacuo', 'Vacuo', 'oscuridad', [86, 56, 20, 30, 18, 26, 22], {
    exp: 140, passives: ['mente_arcana', 'pies_ligeros'], desc: 'Un agujero en el cielo con forma de criatura.',
    learn: [[1, 'garra_umbria'], [1, 'pulso_umbrio'], [30, 'drenaje_vital'], [50, 'agilidad'], [66, 'eclipse']],
    drops: [['esencia_sombria', 0.5], ['nucleo_arcano', 0.2], ['lagrima_estelar', 0.04], ['elixir', 0.03]],
    sprite: { c1: '#0f0a1f', c2: '#7c3aed', rx: 30, ry: 30, ears: 'spikes', tail: 'orb', eyes: 'glow', eyeColor: '#22d3ee', mark: 'moon' },
  });
  S('tempestis', 'Tempestis', 'agua', [92, 52, 22, 28, 20, 24, 20], {
    exp: 138, passives: ['regeneracion', 'espiritu_ferreo'], desc: 'Tormenta viviente que descarga sobre la cumbre.',
    learn: [[1, 'acua_cola'], [1, 'hidrochorro'], [30, 'maremoto'], [50, 'aguas_curativas'], [68, 'diluvio']],
    drops: [['gota', 0.5], ['perla_marina', 0.06], ['lagrima_estelar', 0.03], ['hiperpocion', 0.08]],
    sprite: { c1: '#475569', c2: '#bae6fd', rx: 32, ry: 28, ears: 'antenna', tail: 'curl', eyes: 'glow', eyeColor: '#fef08a', wings: true },
  });
})();
