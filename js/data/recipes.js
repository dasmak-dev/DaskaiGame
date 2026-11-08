/* =============================================================
 * data/recipes.js — Recetas de fusión.
 *   def(objetoResultado, cantidad, { ingrediente: cantidad, ... })
 * Un ingrediente puede ser a su vez el resultado de otra receta:
 * la "fusión en cadena" lo fabricará automáticamente si hace falta.
 *
 * Todas las recetas se ven en Crafteo (screens/craft.js). Los ingredientes
 * se consiguen en las expediciones.
 * ============================================================= */
(function () {
  const R = (DK.data.recipes = []);
  const def = (result, qty, ingredients) => R.push({ id: result, result, qty, ingredients });

  // Consumibles
  def('pocion', 2, { pelaje: 1, gota: 1 });
  def('eter', 2, { gota: 2, polvo_brillante: 1 });
  def('antidoto', 2, { hilo: 1, gota: 1 });
  def('balsamo', 2, { gota: 1, coral: 1 });
  def('superpocion', 1, { pocion: 3, polvo_brillante: 1 });
  def('panacea', 1, { antidoto: 1, balsamo: 1, polvo_brillante: 1 });
  def('cristal_vinculo', 1, { piedra_runica: 1, polvo_brillante: 2 });
  def('cristal_mayor', 1, { cristal_vinculo: 2, nucleo_arcano: 1 });
  def('hiperpocion', 1, { superpocion: 2, nucleo_arcano: 1 });
  def('supereter', 1, { eter: 3, polvo_brillante: 1, piedra_runica: 1 });
  def('pluma_fenix', 1, { pluma: 6, brasa: 4, lagrima_estelar: 1 });
  def('elixir', 1, { lagrima_estelar: 1, superpocion: 2 });

  // Mejora (experiencia)
  def('baya_saber', 2, { hilo: 1, polvo_brillante: 1 });
  def('tonico_exp', 1, { baya_saber: 3, gota: 1 });
  def('cristal_sabio', 1, { tonico_exp: 3, nucleo_arcano: 1 });
  def('esencia_ancestral', 1, { cristal_sabio: 2, lagrima_estelar: 1 });

  // Tónicos (mejora permanente): materiales raros + un núcleo arcano
  def('tonico_fuerza', 1, { fragmento_garra: 4, obsidiana: 2, nucleo_arcano: 1 });
  def('tonico_magia', 1, { esencia_sombria: 2, polvo_brillante: 3, nucleo_arcano: 1 });
  def('tonico_hierro', 1, { escama: 4, obsidiana: 2, nucleo_arcano: 1 });
  def('tonico_espiritu', 1, { coral: 4, piedra_runica: 2, nucleo_arcano: 1 });
  def('tonico_viento', 1, { pluma: 4, polvo_brillante: 2, nucleo_arcano: 1 });
  def('tonico_vida', 1, { pelaje: 4, brasa: 2, nucleo_arcano: 1 });
  def('tonico_mana', 1, { gota: 4, piedra_runica: 2, nucleo_arcano: 1 });
  def('elixir_olvido', 1, { gota: 3, esencia_sombria: 1, piedra_runica: 1 });

  // Equipamiento con habilidad (da un ataque extra)
  def('amuleto_curativo', 1, { polvo_brillante: 2, gota: 2, hilo: 1 });
  def('tambor_guerra', 1, { pelaje: 3, fragmento_garra: 1 });
  def('pluma_huracan', 1, { pluma: 3, hilo: 1 });
  def('raiz_maestra', 1, { hilo: 2, piedra_runica: 1, escama: 1 });
  def('colmillo_vampiro', 1, { esencia_sombria: 2, fragmento_garra: 2 });
  def('ascua_eterna', 1, { brasa: 4, nucleo_arcano: 1 });
  def('caracola_marea', 1, { coral: 3, gota: 3, nucleo_arcano: 1 });
  def('prisma_juicio', 1, { polvo_brillante: 3, nucleo_arcano: 1 });
  def('martillo_tierra', 1, { piedra_runica: 2, obsidiana: 2, nucleo_arcano: 1 });

  // Equipamiento con pasiva (da una segunda pasiva)
  def('corazon_musgo', 1, { hilo: 2, gota: 2 });
  def('emblema_furia', 1, { brasa: 2, fragmento_garra: 2 });
  def('caparazon_viejo', 1, { escama: 3, piedra_runica: 1 });
  def('pluma_ligera', 1, { pluma: 3, polvo_brillante: 1 });
  def('cristal_vital', 1, { pelaje: 2, gota: 2, polvo_brillante: 1 });
  def('pendiente_arcano', 1, { polvo_brillante: 2, esencia_sombria: 2, nucleo_arcano: 1 });
  def('sello_equilibrio', 1, { polvo_brillante: 1, esencia_sombria: 1, piedra_runica: 1, obsidiana: 1 });
  def('brasero_vivo', 1, { brasa: 3, esencia_sombria: 1, nucleo_arcano: 1 });

  // Forja (v4.74): piedras para mejorar el equipamiento. Los fragmentos salen al desguazar.
  def('piedra_transmutacion', 1, { fragmento_forja: 3 });
  def('piedra_alteracion', 1, { fragmento_forja: 2, hilo: 1 });
  def('piedra_purga', 1, { fragmento_forja: 2, gota: 1 });
  def('piedra_regia', 1, { fragmento_forja: 8, nucleo_arcano: 1 });
  def('piedra_caos', 1, { fragmento_forja: 8, esencia_sombria: 1, obsidiana: 1 });
  def('piedra_divina', 1, { fragmento_forja: 15, lagrima_estelar: 1 });
  def('piedra_aumento', 1, { fragmento_forja: 3, polvo_brillante: 1 });
  def('piedra_nucleo', 1, { fragmento_forja: 4, polvo_brillante: 1, pelaje: 1 });
  def('piedra_cambio', 1, { fragmento_forja: 5, gota: 1, polvo_brillante: 1 });
  def('piedra_alquimia', 1, { fragmento_forja: 12, nucleo_arcano: 1, polvo_brillante: 2 });
  def('piedra_anulacion', 1, { fragmento_forja: 6, esencia_sombria: 1 });
  def('piedra_templado', 1, { fragmento_forja: 14, obsidiana: 2 });
  def('sello_forja', 1, { fragmento_forja: 10, piedra_runica: 2 });
  def('piedra_exaltacion', 1, { fragmento_forja: 20, lagrima_estelar: 1 });

  // Equipamiento de atributos
  def('garra_afilada', 1, { fragmento_garra: 3, hilo: 1 });
  def('amuleto_arcano', 1, { polvo_brillante: 2, hilo: 1, gota: 1 });
  def('escama_dura', 1, { escama: 3, hilo: 1 });
  def('velo_mistico', 1, { pluma: 2, esencia_sombria: 1, hilo: 1 });
  def('pluma_veloz', 1, { pluma: 3, hilo: 1 });
  def('corazon_roca', 1, { piedra_runica: 2, escama: 2 });
  def('anillo_brasas', 1, { brasa: 3, fragmento_garra: 1 });
  def('perla_marina', 1, { coral: 3, gota: 2 });
  def('colmillo_umbrio', 1, { garra_afilada: 1, esencia_sombria: 3 });
  def('orbe_solar', 1, { amuleto_arcano: 1, polvo_brillante: 3, nucleo_arcano: 1 });
  def('coraza_obsidiana', 1, { escama_dura: 1, obsidiana: 3 });
  def('botas_viento', 1, { pluma_veloz: 1, pluma: 4, nucleo_arcano: 1 });
  def('amuleto_vida', 1, { corazon_roca: 1, nucleo_arcano: 1, gota: 3 });
  def('corona_celeste', 1, { lagrima_estelar: 2, nucleo_arcano: 2, orbe_solar: 1 });
  // Corazón del Vacío (zona secreta final): el mejor equipo del juego
  def('filo_vacio', 1, { fragmento_vacio: 4, colmillo_umbrio: 1, lagrima_estelar: 1 });
  def('egida_vacio', 1, { fragmento_vacio: 4, coraza_obsidiana: 1, lagrima_estelar: 1 });
  def('corona_vacio', 1, { corazon_vacio: 1, fragmento_vacio: 6, corona_celeste: 1 });
  /** Recetas conocidas al empezar. */
  DK.data.starterRecipes = ['pocion', 'eter', 'antidoto', 'balsamo', 'baya_saber'];
})();
