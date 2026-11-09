/* =============================================================
 * data/talents.js — Talentos (v4.96): cada config.talentEvery niveles
 * (25, 50, 75 y 100) el daskai elige UNO de TRES (DK.daskai.talentOptions,
 * fijos para cada daskai). Son pocos y por eso fuertes.
 *   { id: { icon, color, mods: { stat: pct }, regen, fx: { efecto: valor }, fit: { rasgo: peso } } }
 *   mods  → % de atributos (como una pasiva, DK.daskai.passiveMods)
 *   regen → % de vida por turno
 *   fx    → efectos de combate (los mismos que los afijos del equipo, DK.gear.fxOf; en tanto por uno)
 *   fit   → a qué tipo de daskai le conviene (DK.daskai.talentFit): phys (pega físico), mag (mágico),
 *           tank (aguanta), frail (frágil), fast (rápido), status (usa estados), all (cualquiera), econ (recursos)
 * Textos en lang → talent.<id>.{name,desc} (tools/check.js los revisa).
 * ============================================================= */
(function () {
  DK.data.talents = {
    verdugo: { icon: 'swords', color: '#ef4444', mods: { atk: 0.18 }, fx: { crit: 0.08 }, fit: { phys: 1 } },
    archimago: { icon: 'wand', color: '#a855f7', mods: { matk: 0.18 }, fx: { magDmg: 0.1 }, fit: { mag: 1 } },
    coloso: { icon: 'heart', color: '#f43f5e', mods: { hp: 0.25, def: 0.1 }, fit: { tank: 1, frail: 0.3 } },
    muralla: { icon: 'shield', color: '#94a3b8', mods: { def: 0.15, mdef: 0.15 }, fit: { tank: 1 } },
    relampago: { icon: 'bolt', color: '#facc15', mods: { spd: 0.2 }, fx: { fastDmg: 0.15 }, fit: { fast: 1 } },
    vampiro: { icon: 'droplet', color: '#be123c', mods: { atk: 0.08, matk: 0.08 }, fx: { leech: 0.12 }, fit: { phys: 0.5, mag: 0.5, frail: 0.5 } },
    fenix: { icon: 'flame', color: '#fb923c', mods: { hp: 0.1 }, regen: 3, fx: { healBoost: 0.25 }, fit: { tank: 0.7, frail: 0.4 } },
    espinas: { icon: 'shieldStar', color: '#65a30d', mods: { def: 0.12 }, fx: { thorns: 0.25 }, fit: { tank: 1 } },
    halcon: { icon: 'target', color: '#f59e0b', fx: { crit: 0.12, critDmg: 0.3, acc: 0.08 }, fit: { phys: 0.7, fast: 0.5 } },
    linaje: { icon: 'crown', color: '#eab308', fx: { stabDmg: 0.2 }, mods: { hp: 0.05 }, fit: { phys: 0.5, mag: 0.5 } },
    cazador: { icon: 'compass', color: '#22c55e', fx: { strongDmg: 0.2, weakDmg: 0.15 }, fit: { phys: 0.5, mag: 0.5 } },
    furia: { icon: 'skull', color: '#dc2626', fx: { rageDmg: 0.3, lastGuard: 0.2 }, fit: { frail: 0.6, phys: 0.4 } },
    pozo: { icon: 'sparkle', color: '#38bdf8', mods: { mp: 0.3 }, fx: { mpCost: 0.15, mana: 0.03 }, fit: { mag: 1 } },
    equilibrio: { icon: 'star', color: '#e2e8f0', mods: { hp: 0.08, mp: 0.08, atk: 0.08, matk: 0.08, def: 0.08, mdef: 0.08, spd: 0.08 }, fit: { all: 1 } },
    tirano: { icon: 'crown', color: '#7c3aed', fx: { bossDmg: 0.25, execute: 0.15 }, fit: { phys: 0.6, mag: 0.4 } },
    inquebrantable: { icon: 'shield', color: '#0ea5e9', mods: { mdef: 0.12 }, fx: { statusRes: 0.5, critGuard: 0.2 }, fit: { tank: 0.8, all: 0.2 } },
    toxina: { icon: 'flask', color: '#84cc16', mods: { matk: 0.06 }, fx: { statusDmg: 0.3 }, fit: { status: 1 } },
    sombra: { icon: 'wind', color: '#64748b', mods: { spd: 0.1 }, fx: { dodge: 0.1, critRes: 0.15 }, fit: { fast: 0.8, frail: 0.4 } },
    emboscada: { icon: 'flee', color: '#14b8a6', fx: { opener: 0.4, freshDmg: 0.2 }, fit: { fast: 0.6, phys: 0.3, mag: 0.3 } },
    fortuna: { icon: 'coin', color: '#fbbf24', mods: { hp: 0.05 }, fx: { goldFind: 0.3, expFind: 0.3 }, fit: { econ: 1 } },
  };
})();
