/* =============================================================
 * data/talents.js — Talentos: cada config.talentEvery niveles (10, 20…)
 * el daskai elige UNO de dos (DK.daskai.talentOptions, fijos para cada
 * daskai). Suman como una pasiva (DK.daskai.passiveMods):
 *   { id: { icon, mods: { stat: pct }, regen } }
 * Textos en lang → talent.<id>.{name,desc} (tools/check.js los revisa).
 * ============================================================= */
(function () {
  DK.data.talents = {
    brazo: { icon: 'swords', mods: { atk: 0.08 } },
    arcano: { icon: 'wand', mods: { matk: 0.08 } },
    roca: { icon: 'shield', mods: { def: 0.08 } },
    temple: { icon: 'shieldStar', mods: { mdef: 0.08 } },
    rafaga: { icon: 'wind', mods: { spd: 0.08 } },
    aguante: { icon: 'heart', mods: { hp: 0.1 } },
    fuente: { icon: 'sparkle', mods: { mp: 0.12 } },
    savia: { icon: 'regen', regen: 1 },
    armonia: { icon: 'star', mods: { hp: 0.03, mp: 0.03, atk: 0.03, matk: 0.03, def: 0.03, mdef: 0.03, spd: 0.03 } },
    berserker: { icon: 'flame', mods: { atk: 0.12, def: -0.04 } },
    erudito: { icon: 'book', mods: { matk: 0.12, mdef: -0.04 } },
    bastion: { icon: 'shield', mods: { def: 0.06, mdef: 0.06, spd: -0.03 } },
  };
})();
