/* =============================================================
 * data/items.js — Objetos.
 *
 *  category: 'batalla' | 'mejora' | 'equipo' | 'pieza'
 *  mejora  → use: { exp } o { levels } o { perm: stat } (tónico) o { resetPerm } (se usan fuera de combate)
 *  rarity:   'comun' | 'raro' | 'epico' | 'legendario'
 *  batalla → use: { heal, healPct, mana, manaPct, cure:[estados], capture }
 *  equipo  → stats: bonificación plana de atributos (regen en %)
 *            grants: { move: 'ataque' } da un ataque extra en combate
 *                    { passive: 'pasiva' } da una segunda pasiva (data/basics.js)
 *  Los objetos con `grants` se construyen en Crafteo (data/recipes.js).
 *  Los precios de compra/venta están en data/shop.js
 * ============================================================= */
(function () {
  const I = (DK.data.items = {});
  const def = (id, o) => (I[id] = Object.assign({ id }, o));

  DK.data.categories = {
    batalla: { id: 'batalla', name: 'Batalla', icon: 'flask', desc: 'Pociones y objetos para usar en combate.' },
    mejora: { id: 'mejora', name: 'Mejora', icon: 'star', desc: 'Objetos que dan experiencia o mejoran para siempre a tus daskai fuera de combate.' },
    equipo: { id: 'equipo', name: 'Equipamiento', icon: 'gem', desc: 'Objetos que se equipan a los daskai.' },
    pieza: { id: 'pieza', name: 'Piezas', icon: 'cube', desc: 'Materiales para construir objetos en Crafteo.' },
  };

  // ---------- Batalla ----------
  const B = 'batalla';
  def('pocion', { name: 'Poción', category: B, rarity: 'comun', icon: 'flask', color: '#22c55e', use: { heal: 30 }, desc: 'Restaura 30 PV.' });
  def('superpocion', { name: 'Superpoción', category: B, rarity: 'raro', icon: 'flask', color: '#16a34a', use: { heal: 90 }, desc: 'Restaura 90 PV.' });
  def('hiperpocion', { name: 'Hiperpoción', category: B, rarity: 'epico', icon: 'flask', color: '#15803d', use: { heal: 250 }, desc: 'Restaura 250 PV.' });
  def('eter', { name: 'Éter', category: B, rarity: 'comun', icon: 'sparkle', color: '#3b82f6', use: { mana: 20 }, desc: 'Restaura 20 PM.' });
  def('supereter', { name: 'Superéter', category: B, rarity: 'raro', icon: 'sparkle', color: '#2563eb', use: { mana: 60 }, desc: 'Restaura 60 PM.' });
  def('antidoto', { name: 'Antídoto', category: B, rarity: 'comun', icon: 'poison', color: '#a855f7', use: { cure: ['veneno'] }, desc: 'Cura el envenenamiento.' });
  def('balsamo', { name: 'Bálsamo', category: B, rarity: 'comun', icon: 'droplet', color: '#f97316', use: { cure: ['quemadura'] }, desc: 'Cura las quemaduras.' });
  def('panacea', { name: 'Panacea', category: B, rarity: 'raro', icon: 'sparkles', color: '#ec4899', use: { cure: ['veneno', 'quemadura'], healPct: 0.25 }, desc: 'Cura cualquier estado y restaura un 25% de la vida.' });
  def('elixir', { name: 'Elixir', category: B, rarity: 'legendario', icon: 'star', color: '#f59e0b', use: { healPct: 1, manaPct: 1, cure: ['veneno', 'quemadura'] }, desc: 'Restaura por completo vida y maná.' });
  def('cristal_vinculo', { name: 'Cristal de vínculo', category: B, rarity: 'raro', icon: 'orb', color: '#06b6d4', use: { capture: 0.35 }, battleOnly: true, desc: 'Intenta vincularte a un daskai salvaje para que se una a ti. Funciona mejor si está debilitado.' });
  def('cristal_mayor', { name: 'Cristal mayor', category: B, rarity: 'epico', icon: 'orb', color: '#8b5cf6', use: { capture: 0.6 }, battleOnly: true, desc: 'Cristal de vínculo de gran potencia.' });

  // ---------- Mejora (experiencia) ----------
  const M = 'mejora';
  def('baya_saber', { name: 'Baya del saber', category: M, rarity: 'comun', icon: 'leaf', color: '#84cc16', use: { exp: 80 }, desc: 'Una baya que da 80 puntos de experiencia.' });
  def('tonico_exp', { name: 'Tónico de experiencia', category: M, rarity: 'raro', icon: 'flask', color: '#f59e0b', use: { exp: 300 }, desc: 'Da 300 puntos de experiencia.' });
  def('cristal_sabio', { name: 'Cristal de sabiduría', category: M, rarity: 'epico', icon: 'gem', color: '#a855f7', use: { exp: 1200 }, desc: 'Da 1.200 puntos de experiencia.' });
  def('pluma_fenix', { name: 'Pluma de fénix', category: M, rarity: 'legendario', icon: 'sparkles', color: '#f97316', use: { guardian: true }, desc: 'Se activa sola: si un daskai va a morir en una expedición, lo salva con un 10% de vida (una vez por expedición).' });
  // Tónicos: +puntos PERMANENTES en un atributo (config.tonic). No se venden: salen de
  // cofres profundos, mini jefes y jefes, o se craftean con materiales raros.
  const TON = [['tonico_fuerza', 'atk', 'Tónico de fuerza', 'swords', '#ef4444'], ['tonico_magia', 'matk', 'Tónico de magia', 'wand', '#8b5cf6'],
    ['tonico_hierro', 'def', 'Tónico de hierro', 'shield', '#64748b'], ['tonico_espiritu', 'mdef', 'Tónico de espíritu', 'shieldStar', '#a855f7'],
    ['tonico_viento', 'spd', 'Tónico de viento', 'wind', '#14b8a6'], ['tonico_vida', 'hp', 'Tónico de vida', 'heart', '#e11d48'],
    ['tonico_mana', 'mp', 'Tónico de maná', 'sparkle', '#0ea5e9']];
  DK.data.tonicFor = {};
  TON.forEach(([id, stat, name, icon, color]) => {
    DK.data.tonicFor[stat] = id;
    def(id, { name, category: M, rarity: 'epico', icon, color, use: { perm: stat }, noShop: true,
      desc: `Sube para siempre ${{ atk: 'el ataque', matk: 'la magia', def: 'la defensa', mdef: 'la defensa mágica', spd: 'la velocidad', hp: 'la vida', mp: 'el maná' }[stat]} de un daskai. Cada daskai admite como mucho 15 tónicos.` });
  });
  def('elixir_olvido', { name: 'Elixir de olvido', category: M, rarity: 'raro', icon: 'chalice', color: '#94a3b8', use: { resetPerm: true }, noShop: true, desc: 'Un daskai olvida sus tónicos: vuelven a tu bolsa para dárselos a quien quieras.' });
  def('esencia_ancestral', { name: 'Esencia ancestral', category: M, rarity: 'legendario', icon: 'star', color: '#eab308', use: { levels: 1 }, desc: 'Sube un nivel completo a un daskai.' });

  // ---------- Equipamiento ----------
  const E = 'equipo';
  def('garra_afilada', { name: 'Garra afilada', category: E, rarity: 'raro', icon: 'sword', color: '#ef4444', stats: { atk: 6 }, desc: 'Una garra pulida que aumenta el ataque físico.' });
  def('colmillo_umbrio', { name: 'Colmillo umbrío', category: E, rarity: 'epico', icon: 'sword', color: '#7c3aed', stats: { atk: 12, def: -3 }, desc: 'Colmillo imbuido en sombra. Gran ataque a costa de defensa.' });
  def('amuleto_arcano', { name: 'Amuleto arcano', category: E, rarity: 'raro', icon: 'wand', color: '#6366f1', stats: { matk: 6, mp: 10 }, desc: 'Canaliza la energía mágica.' });
  def('orbe_solar', { name: 'Orbe solar', category: E, rarity: 'epico', icon: 'sun', color: '#f59e0b', stats: { matk: 12, mdef: 4 }, desc: 'Un orbe que arde con luz propia.' });
  def('escama_dura', { name: 'Escama dura', category: E, rarity: 'raro', icon: 'shield', color: '#0ea5e9', stats: { def: 7 }, desc: 'Escama endurecida que protege del daño físico.' });
  def('coraza_obsidiana', { name: 'Coraza de obsidiana', category: E, rarity: 'epico', icon: 'shield', color: '#334155', stats: { def: 14, spd: -4 }, desc: 'Protección enorme pero pesada.' });
  def('velo_mistico', { name: 'Velo místico', category: E, rarity: 'raro', icon: 'shieldStar', color: '#a855f7', stats: { mdef: 7 }, desc: 'Tela encantada contra la magia.' });
  def('pluma_veloz', { name: 'Pluma veloz', category: E, rarity: 'raro', icon: 'wind', color: '#14b8a6', stats: { spd: 6 }, desc: 'Una pluma ligera como el viento.' });
  def('botas_viento', { name: 'Botas de viento', category: E, rarity: 'epico', icon: 'wind', color: '#0d9488', stats: { spd: 12, hp: 10 }, desc: 'Permiten moverse a gran velocidad.' });
  def('corazon_roca', { name: 'Corazón de roca', category: E, rarity: 'raro', icon: 'heart', color: '#78716c', stats: { hp: 25, spd: -2 }, desc: 'Late con la fuerza de la montaña.' });
  def('anillo_brasas', { name: 'Anillo de brasas', category: E, rarity: 'raro', icon: 'flame', color: '#ea580c', stats: { atk: 4, matk: 4 }, desc: 'Un anillo siempre caliente.' });
  def('perla_marina', { name: 'Perla marina', category: E, rarity: 'raro', icon: 'droplet', color: '#0284c7', stats: { mp: 20, mdef: 3 }, desc: 'Perla que guarda la calma del mar.' });
  def('amuleto_vida', { name: 'Amuleto de vida', category: E, rarity: 'epico', icon: 'regen', color: '#22c55e', stats: { hp: 40, regen: 1 }, desc: 'Aumenta la vida y la regeneración.' });
  def('corona_celeste', { name: 'Corona celeste', category: E, rarity: 'legendario', icon: 'crown', color: '#eab308', stats: { hp: 8, mp: 8, atk: 8, matk: 8, def: 8, mdef: 8, spd: 8 }, desc: 'Reliquia de los cielos. Mejora todos los atributos.' });

  // ---------- Equipamiento con habilidad (da un ataque extra) ----------
  def('amuleto_curativo', { name: 'Amuleto curativo', category: E, rarity: 'raro', icon: 'heart', color: '#fde047', stats: { mp: 6 }, grants: { move: 'curacion' }, desc: 'Permite usar Curación en combate.' });
  def('tambor_guerra', { name: 'Tambor de guerra', category: E, rarity: 'raro', icon: 'bolt', color: '#ef4444', stats: { hp: 6 }, grants: { move: 'rugido' }, desc: 'Permite usar Rugido en combate.' });
  def('pluma_huracan', { name: 'Pluma de huracán', category: E, rarity: 'raro', icon: 'wind', color: '#14b8a6', stats: { spd: 2 }, grants: { move: 'agilidad' }, desc: 'Permite usar Agilidad en combate.' });
  def('raiz_maestra', { name: 'Raíz maestra', category: E, rarity: 'raro', icon: 'leaf', color: '#65a30d', stats: { def: 2 }, grants: { move: 'raiz_drenante' }, desc: 'Permite usar Raíz Drenante en combate.' });
  def('colmillo_vampiro', { name: 'Colmillo vampírico', category: E, rarity: 'raro', icon: 'moon', color: '#7c3aed', stats: { matk: 3 }, grants: { move: 'drenaje_vital' }, desc: 'Permite usar Drenaje Vital en combate.' });
  def('ascua_eterna', { name: 'Brasa eterna', category: E, rarity: 'epico', icon: 'flame', color: '#f97316', stats: { matk: 4 }, grants: { move: 'llamarada' }, desc: 'Permite usar Llamarada en combate.' });
  def('caracola_marea', { name: 'Caracola de la marea', category: E, rarity: 'epico', icon: 'droplet', color: '#0ea5e9', stats: { mdef: 4 }, grants: { move: 'maremoto' }, desc: 'Permite usar Maremoto en combate.' });
  def('prisma_juicio', { name: 'Prisma del juicio', category: E, rarity: 'epico', icon: 'sun', color: '#f2b705', stats: { matk: 4 }, grants: { move: 'juicio' }, desc: 'Permite usar Juicio en combate.' });
  def('martillo_tierra', { name: 'Martillo sísmico', category: E, rarity: 'epico', icon: 'mountain', color: '#78716c', stats: { atk: 4 }, grants: { move: 'terremoto' }, desc: 'Permite usar Terremoto en combate.' });

  // ---------- Equipamiento con pasiva (da una segunda pasiva) ----------
  def('corazon_musgo', { name: 'Corazón de musgo', category: E, rarity: 'raro', icon: 'regen', color: '#22c55e', grants: { passive: 'regeneracion' }, desc: 'Da la pasiva Regeneración.' });
  def('emblema_furia', { name: 'Emblema de furia', category: E, rarity: 'raro', icon: 'sword', color: '#dc2626', grants: { passive: 'furia' }, desc: 'Da la pasiva Furia contenida.' });
  def('caparazon_viejo', { name: 'Caparazón ancestral', category: E, rarity: 'raro', icon: 'shield', color: '#0369a1', grants: { passive: 'caparazon' }, desc: 'Da la pasiva Caparazón.' });
  def('pluma_ligera', { name: 'Pluma ligerísima', category: E, rarity: 'raro', icon: 'wind', color: '#5eead4', grants: { passive: 'pies_ligeros' }, desc: 'Da la pasiva Pies ligeros.' });
  def('cristal_vital', { name: 'Cristal vital', category: E, rarity: 'raro', icon: 'heart', color: '#4ade80', grants: { passive: 'vitalidad' }, desc: 'Da la pasiva Vitalidad.' });
  def('pendiente_arcano', { name: 'Pendiente arcano', category: E, rarity: 'epico', icon: 'wand', color: '#8b5cf6', grants: { passive: 'mente_arcana' }, desc: 'Da la pasiva Mente arcana.' });
  def('sello_equilibrio', { name: 'Sello del equilibrio', category: E, rarity: 'epico', icon: 'scale', color: '#eab308', grants: { passive: 'equilibrio' }, desc: 'Da la pasiva Equilibrio.' });
  def('brasero_vivo', { name: 'Brasero vivo', category: E, rarity: 'epico', icon: 'flame', color: '#fb923c', grants: { passive: 'sangre_caliente' }, desc: 'Da la pasiva Sangre caliente.' });

  // ---------- Piezas ----------
  const P = 'pieza';
  def('pelaje', { name: 'Pelaje suave', category: P, rarity: 'comun', icon: 'cube', color: '#d6a36a', desc: 'Pelo suave de un daskai.' });
  def('fragmento_garra', { name: 'Fragmento de garra', category: P, rarity: 'comun', icon: 'cube', color: '#e5e7eb', desc: 'Trozo de garra afilada.' });
  def('escama', { name: 'Escama', category: P, rarity: 'comun', icon: 'cube', color: '#38bdf8', desc: 'Escama resistente.' });
  def('pluma', { name: 'Pluma ligera', category: P, rarity: 'comun', icon: 'cube', color: '#a7f3d0', desc: 'Una pluma casi ingrávida.' });
  def('hilo', { name: 'Fibra resistente', category: P, rarity: 'comun', icon: 'cube', color: '#84cc16', desc: 'Fibra vegetal muy resistente.' });
  def('gota', { name: 'Gota cristalina', category: P, rarity: 'comun', icon: 'cube', color: '#7dd3fc', desc: 'Agua pura condensada.' });
  def('brasa', { name: 'Brasa viva', category: P, rarity: 'comun', icon: 'cube', color: '#fb923c', desc: 'Una brasa que nunca se apaga.' });
  def('coral', { name: 'Fragmento de coral', category: P, rarity: 'comun', icon: 'cube', color: '#fb7185', desc: 'Coral de la costa.' });
  def('polvo_brillante', { name: 'Polvo brillante', category: P, rarity: 'raro', icon: 'cube', color: '#fde047', desc: 'Polvo que emite luz.' });
  def('esencia_sombria', { name: 'Esencia sombría', category: P, rarity: 'raro', icon: 'cube', color: '#7c3aed', desc: 'Sombra solidificada.' });
  def('piedra_runica', { name: 'Piedra rúnica', category: P, rarity: 'raro', icon: 'cube', color: '#94a3b8', desc: 'Piedra grabada con runas antiguas.' });
  def('obsidiana', { name: 'Esquirla de obsidiana', category: P, rarity: 'raro', icon: 'cube', color: '#475569', desc: 'Roca volcánica afilada.' });
  def('nucleo_arcano', { name: 'Núcleo arcano', category: P, rarity: 'epico', icon: 'cube', color: '#c084fc', desc: 'Concentrado de energía pura.' });
  def('lagrima_estelar', { name: 'Lágrima estelar', category: P, rarity: 'legendario', icon: 'cube', color: '#facc15', desc: 'Fragmento caído de una estrella.' });
})();
