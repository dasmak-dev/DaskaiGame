/* =============================================================
 * data/shop.js — Precios y catálogo de la tienda.
 *
 *  DK.data.prices[objeto]  → precio de compra (la venta es un % en config.sellRatio)
 *  DK.data.shopStock       → objetos que puede ofrecer el mercader de las expediciones
 *  (No hay tienda fuera de las expediciones: los objetos se consiguen jugándolas.)
 * Los objetos sin precio no se pueden vender ni comprar.
 * ============================================================= */
(function () {
  DK.data.prices = {
    // Batalla
    pocion: 40, superpocion: 140, hiperpocion: 420, eter: 50, supereter: 170,
    antidoto: 30, balsamo: 30, panacea: 160, elixir: 1500, cristal_vinculo: 120, cristal_mayor: 450,
    // Mejora
    baya_saber: 60, tonico_exp: 220, cristal_sabio: 800, esencia_ancestral: 2500, pluma_fenix: 1400,
    // Equipamiento (sólo venta, se consiguen fusionando o como botín)
    garra_afilada: 260, colmillo_umbrio: 900, amuleto_arcano: 260, orbe_solar: 900, escama_dura: 260,
    coraza_obsidiana: 900, velo_mistico: 260, pluma_veloz: 260, botas_viento: 900, corazon_roca: 260,
    anillo_brasas: 260, perla_marina: 260, amuleto_vida: 900, corona_celeste: 4000,
    // Equipamiento crafteado (sólo venta)
    amuleto_curativo: 300, tambor_guerra: 260, pluma_huracan: 260, raiz_maestra: 300, colmillo_vampiro: 320,
    ascua_eterna: 900, caracola_marea: 900, prisma_juicio: 900, martillo_tierra: 950,
    corazon_musgo: 280, emblema_furia: 280, caparazon_viejo: 280, pluma_ligera: 280, cristal_vital: 280,
    pendiente_arcano: 900, sello_equilibrio: 900, brasero_vivo: 900,
    // Piezas
    pelaje: 12, fragmento_garra: 12, escama: 12, pluma: 12, hilo: 12, gota: 12, brasa: 12, coral: 12,
    polvo_brillante: 45, esencia_sombria: 45, piedra_runica: 45, obsidiana: 60, nucleo_arcano: 220, lagrima_estelar: 700,
  };

  /** Lo que vende la tienda (el resto sólo se puede vender). */
  DK.data.shopStock = [
    'pocion', 'superpocion', 'hiperpocion', 'eter', 'supereter', 'antidoto', 'balsamo', 'panacea',
    'cristal_vinculo', 'cristal_mayor', 'baya_saber', 'tonico_exp',
    'pelaje', 'gota', 'hilo', 'fragmento_garra', 'escama', 'pluma', 'brasa', 'coral', 'polvo_brillante', 'piedra_runica',
  ];
})();
