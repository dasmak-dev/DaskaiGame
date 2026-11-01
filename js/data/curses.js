/* =============================================================
 * data/curses.js — Pactos (maldiciones opcionales) de expedición.
 *
 * Al empezar cada mapa se ofrecen 3 al azar entre los DESBLOQUEADOS con
 * emblemas en el menú de Mejoras (DK.camp.unlock; ninguno → no hay pactos). Puedes aceptar los que
 * quieras (o ninguno): te ponen las cosas más difíciles en ese mapa a
 * cambio de una recompensa. Duran sólo ese mapa.
 *
 *   effect  qué cambia (lo leen los sistemas con DK.curses.effect('clave')):
 *     enemyLevels  +N niveles a los rivales          (expedition.levelBonus)
 *     healMult     multiplica la curación de objetos  (bag.potency)
 *     noRest       los descansos pasan a ser combates (curses.accept)
 *     moreElites   probabilidad de que un combate sea élite (curses.accept)
 *     noFlee       no se puede huir                   (battle.fleeChance)
 *     noCapture    no se puede vincular               (battle.cannotCapture)
 *     enemySpd     +N niveles de velocidad al rival   (battle.start)
 *     bossPhase    el jefe tiene una fase más         (battle.bossPhases)
 *   reward  qué ganas:
 *     coins  +% de monedas en ese mapa              (expedition.addLoot)
 *     relic  N reliquias raras/épicas al vencer al jefe (expedition.bossCleared)
 *
 * Textos: lang → curse.<id>.{name,desc}
 * ============================================================= */
(function () {
  DK.data.curses = {
    feroces: { icon: 'skull', effect: { enemyLevels: 2 }, reward: { coins: 0.3 } },
    heridas: { icon: 'heart', effect: { healMult: 0.5 }, reward: { coins: 0.3 } },
    sin_descanso: { icon: 'bed', effect: { noRest: true }, reward: { relic: 1 } },
    elites: { icon: 'crown', effect: { moreElites: 0.4 }, reward: { coins: 0.35 } },
    sin_huida: { icon: 'flee', effect: { noFlee: true }, reward: { coins: 0.15 } },
    sin_vinculo: { icon: 'orb', effect: { noCapture: true }, reward: { coins: 0.2 } },
    frenesi: { icon: 'wind', effect: { enemySpd: 1 }, reward: { coins: 0.2 } },
    jefe_furioso: { icon: 'flame', effect: { bossPhase: true }, reward: { relic: 1 } },
  };
})();
