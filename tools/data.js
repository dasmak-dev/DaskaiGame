#!/usr/bin/env node
/* =============================================================
 * tools/data.js — Datos del juego en JSON: comprobar y generar.
 *
 * Los daskai, ataques, objetos y zonas se editan en la carpeta data/:
 *     data/species.json   especies (con su evolución: "evolves")
 *     data/moves.json     ataques
 *     data/items.json     objetos
 *     data/zones.json     zonas (con su jefe, sus fases y su jefe oculto)
 *
 * Después de editar, ejecuta (desde la carpeta del juego):
 *     node tools/data.js          comprueba y genera js/data/gen/data.js
 *     node tools/data.js --check  sólo comprueba (y avisa si falta generar)
 *
 * El juego se abre como archivo (file://) y el navegador no deja leer
 * .json así, por eso se genera un .js con los mismos datos. No edites
 * js/data/gen/data.js a mano: se sobrescribe.
 *
 * Si algo está mal (un ataque que no existe, una casa mal escrita, un
 * objeto inexistente en un botín…) dice en qué archivo y dónde, y no genera.
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'js', 'data', 'gen', 'data.js');
const FILES = ['species', 'moves', 'items', 'zones'];

/* ---------- Constantes del juego (casas, pasivas, estados…) desde js/data/basics.js ---------- */
const DK = { data: {}, registerIcon() {}, t: (k) => k, settings: { get: () => false } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/data/basics.js'), 'utf8'), { DK, Object, Array, Math, JSON });
const B = DK.data;
const STATS = B.statKeys || ['hp', 'mp', 'atk', 'matk', 'def', 'mdef', 'spd'];

/* ---------- Lectura ---------- */
const errors = [], warnings = [];
const raw = {}, lines = {};
for (const f of FILES) {
  const file = path.join(DATA, f + '.json');
  try {
    const text = fs.readFileSync(file, 'utf8');
    raw[f] = JSON.parse(text);
    // Línea donde empieza cada entrada (para señalar los errores)
    lines[f] = {};
    text.split('\n').forEach((l, i) => { const m = l.match(/^  "([^"]+)":/); if (m) lines[f][m[1]] = i + 1; });
  } catch (e) {
    errors.push(`data/${f}.json: no es un JSON válido (${e.message})`);
  }
}

/* ---------- Comprobaciones ---------- */
if (!errors.length) {
  const { species: SP, moves: MV, items: IT, zones: ZN } = raw;
  const at = (file, where) => { const ln = lines[file][where.split(/[.[]/)[0]]; return `data/${file}.json${ln ? ':' + ln : ''} → ${where}`; };
  const err = (file, where, msg) => errors.push(`${at(file, where)}: ${msg}`);
  const warn = (file, where, msg) => warnings.push(`${at(file, where)}: ${msg}`);
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const known = (file, where, obj, allowed) => Object.keys(obj).forEach((k) => { if (!allowed.includes(k)) warn(file, where, `campo desconocido «${k}» (¿mal escrito?)`); });
  const drops = (file, where, list) => {
    if (!Array.isArray(list)) return err(file, where, 'debe ser una lista [[objeto, probabilidad], ...]');
    list.forEach((d, i) => {
      if (!Array.isArray(d) || d.length !== 2) return err(file, `${where}[${i}]`, 'debe ser [objeto, probabilidad]');
      if (!IT[d[0]]) err(file, `${where}[${i}]`, `el objeto «${d[0]}» no existe en items.json`);
      if (!isNum(d[1]) || d[1] <= 0 || d[1] > 1) err(file, `${where}[${i}]`, `probabilidad ${d[1]} fuera de rango (0-1]`);
    });
  };
  const EFFECTS = ['status', 'buff', 'debuff', 'heal', 'drain'];

  // Ataques
  for (const [id, m] of Object.entries(MV)) {
    const w = id;
    known('moves', w, m, ['name', 'desc', 'kind', 'house', 'power', 'mp', 'acc', 'effect', 'priority', 'hidden']);
    if (typeof m.name !== 'string') err('moves', w, 'falta "name"');
    if (!['fisico', 'magico'].includes(m.kind)) err('moves', w, `"kind" debe ser "fisico" o "magico" (es «${m.kind}»)`);
    if (m.house != null && !B.houses[m.house]) err('moves', w, `la casa «${m.house}» no existe (${Object.keys(B.houses).join(', ')})`);
    ['power', 'mp'].forEach((k) => { if (m[k] != null && (!isNum(m[k]) || m[k] < 0)) err('moves', w, `"${k}" debe ser un número ≥ 0`); });
    if (m.acc != null && (!isNum(m.acc) || m.acc < 1 || m.acc > 100)) err('moves', w, '"acc" debe estar entre 1 y 100');
    if (m.priority != null && ![-1, 0, 1].includes(m.priority)) err('moves', w, '"priority" debe ser -1, 0 o 1');
    if (m.effect) {
      const e = m.effect;
      if (!EFFECTS.includes(e.type)) err('moves', `${w}.effect`, `tipo «${e.type}» desconocido (${EFFECTS.join(', ')})`);
      if (e.type === 'status' && !B.statuses[e.status]) err('moves', `${w}.effect`, `el estado «${e.status}» no existe`);
      if ((e.type === 'buff' || e.type === 'debuff') && !STATS.includes(e.stat)) err('moves', `${w}.effect`, `el atributo «${e.stat}» no existe`);
      if (e.chance != null && (!isNum(e.chance) || e.chance <= 0 || e.chance > 1)) err('moves', `${w}.effect`, '"chance" debe estar entre 0 y 1');
    }
  }

  // Objetos
  const CATS = Object.keys(B.categories || {});
  for (const [id, it] of Object.entries(IT)) {
    const w = id;
    known('items', w, it, ['name', 'desc', 'category', 'rarity', 'icon', 'color', 'use', 'stats', 'grants', 'noShop', 'battleOnly']);
    if (typeof it.name !== 'string') err('items', w, 'falta "name"');
    if (CATS.length && !CATS.includes(it.category)) err('items', w, `categoría «${it.category}» desconocida (${CATS.join(', ')})`);
    if (!B.rarities[it.rarity]) err('items', w, `rareza «${it.rarity}» desconocida (${Object.keys(B.rarities).join(', ')})`);
    if (it.use && it.use.cure) it.use.cure.forEach((s) => { if (!B.statuses[s]) err('items', `${w}.use.cure`, `el estado «${s}» no existe`); });
    if (it.use && it.use.perm && !STATS.includes(it.use.perm)) err('items', `${w}.use.perm`, `el atributo «${it.use.perm}» no existe`);
    if (it.stats) Object.keys(it.stats).forEach((k) => { if (!STATS.includes(k) && k !== 'regen') err('items', `${w}.stats`, `el atributo «${k}» no existe`); });
    if (it.grants && it.grants.move && !MV[it.grants.move]) err('items', `${w}.grants`, `el ataque «${it.grants.move}» no existe`);
    if (it.grants && it.grants.passive && !B.passives[it.grants.passive]) err('items', `${w}.grants`, `la pasiva «${it.grants.passive}» no existe`);
  }

  // Especies
  for (const [id, s] of Object.entries(SP)) {
    const w = id;
    known('species', w, s, ['name', 'house', 'from', 'base', 'exp', 'passives', 'starter', 'desc', 'learn', 'learnExtra', 'drops', 'sprite', 'evolves']);
    if (typeof s.name !== 'string') err('species', w, 'falta "name"');
    if (s.from && !SP[s.from]) err('species', w, `"from": la especie «${s.from}» no existe`);
    const houseOf = (x, n = 0) => (!x || n > 10 ? null : x.house || houseOf(SP[x.from], n + 1));
    const house = houseOf(s);
    if (!house) err('species', w, 'falta "house"');
    else if (!B.houses[house]) err('species', w, `la casa «${house}» no existe (${Object.keys(B.houses).join(', ')})`);
    if (!s.base || typeof s.base !== 'object') err('species', w, `falta "base" con ${STATS.join(', ')}`);
    else STATS.forEach((k) => { if (!isNum(s.base[k]) || s.base[k] <= 0) err('species', `${w}.base`, `"${k}" debe ser un número > 0`); });
    if (s.passives) s.passives.forEach((p) => { if (!B.passives[p]) err('species', `${w}.passives`, `la pasiva «${p}» no existe (${Object.keys(B.passives).join(', ')})`); });
    ['learn', 'learnExtra'].forEach((k) => (s[k] || []).forEach((l, i) => {
      if (!Array.isArray(l) || !Number.isInteger(l[0]) || l[0] < 1) return err('species', `${w}.${k}[${i}]`, 'debe ser [nivel, ataque]');
      if (!MV[l[1]]) err('species', `${w}.${k}[${i}]`, `el ataque «${l[1]}» no existe en moves.json`);
    }));
    if (!s.from && !(s.learn || []).length) err('species', w, 'necesita al menos un ataque en "learn"');
    if (s.drops) drops('species', `${w}.drops`, s.drops);
    if (s.evolves) {
      if (!SP[s.evolves.to]) err('species', `${w}.evolves`, `la especie «${s.evolves.to}» no existe`);
      else if (SP[s.evolves.to].from !== id) err('species', `${w}.evolves`, `«${s.evolves.to}» debería tener "from": "${id}"`);
      if (!Number.isInteger(s.evolves.level) || s.evolves.level < 2) err('species', `${w}.evolves`, '"level" debe ser un número entero ≥ 2');
    }
    if (s.from && SP[s.from] && (!SP[s.from].evolves || SP[s.from].evolves.to !== id)) warn('species', w, `«${s.from}» no tiene "evolves" hacia «${id}»: nunca evolucionará a esta especie`);
    if (!s.sprite) warn('species', w, 'sin "sprite": se dibujará con valores por defecto');
  }

  // Zonas
  const PH = Object.keys(B.phaseTypes || {});
  const boss = (where, b, secret) => {
    if (!b) return err('zones', where, 'falta el jefe');
    if (!SP[b.species]) err('zones', where, `la especie «${b.species}» no existe`);
    if (!Number.isInteger(b.level) || b.level < 1) err('zones', where, '"level" debe ser un entero ≥ 1');
    if (b.drops) drops('zones', `${where}.drops`, b.drops);
    (b.phases || []).forEach((p, i) => {
      if (PH.length && !PH.includes(p.type)) err('zones', `${where}.phases[${i}]`, `fase «${p.type}» desconocida (${PH.join(', ')})`);
      if (!isNum(p.at) || p.at <= 0 || p.at >= 1) err('zones', `${where}.phases[${i}]`, '"at" debe estar entre 0 y 1 (fracción de vida)');
    });
    if (secret && !(b.phases || []).length) warn('zones', where, 'el jefe oculto no tiene fases');
  };
  for (const [id, z] of Object.entries(ZN)) {
    const w = id;
    known('zones', w, z, ['name', 'desc', 'icon', 'levels', 'colors', 'scene', 'unlock', 'enemies', 'boss', 'secretBoss']);
    if (typeof z.name !== 'string') err('zones', w, 'falta "name"');
    if (!Array.isArray(z.levels) || z.levels.length !== 2 || z.levels[0] > z.levels[1]) err('zones', w, '"levels" debe ser [mínimo, máximo]');
    if (z.unlock && !ZN[z.unlock]) err('zones', w, `"unlock": la zona «${z.unlock}» no existe`);
    if (!Array.isArray(z.enemies) || !z.enemies.length) err('zones', w, '"enemies" no puede estar vacío');
    else z.enemies.forEach((e, i) => {
      if (!SP[e[0]]) err('zones', `${w}.enemies[${i}]`, `la especie «${e[0]}» no existe`);
      if (!isNum(e[1]) || e[1] <= 0) err('zones', `${w}.enemies[${i}]`, 'el peso debe ser un número > 0');
    });
    boss(`${w}.boss`, z.boss);
    if (z.secretBoss) boss(`${w}.secretBoss`, z.secretBoss, true);
  }
  // Cada especie debería aparecer en algún sitio
  const seen = new Set();
  Object.values(ZN).forEach((z) => { (z.enemies || []).forEach((e) => seen.add(e[0])); if (z.boss) seen.add(z.boss.species); if (z.secretBoss) seen.add(z.secretBoss.species); });
  Object.entries(SP).forEach(([id, s]) => { if (!s.starter && !s.from && !seen.has(id)) warn('species', id, 'no aparece en ninguna zona ni es inicial'); });
}

/* ---------- Resultado ---------- */
warnings.forEach((w) => console.log('  ⚠ ' + w));
if (errors.length) {
  errors.forEach((e) => console.log('  ✗ ' + e));
  console.log(`\n✗ ${errors.length} error(es) en los datos. No se ha generado nada.`);
  process.exit(1);
}
const body = `/* GENERADO por tools/data.js a partir de data/*.json — no lo edites a mano.\n * Para cambiar daskai, ataques, objetos o zonas edita data/*.json y ejecuta: node tools/data.js */\nDK.raw = ${JSON.stringify(raw)};\n`;
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const counts = FILES.map((f) => `${Object.keys(raw[f]).length} ${f}`).join(', ');
if (process.argv.includes('--check')) {
  if (current !== body) { console.log('✗ Los datos son correctos pero js/data/gen/data.js está desactualizado: ejecuta  node tools/data.js'); process.exit(1); }
  console.log(`✓ Datos correctos y generados (${counts}).`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  console.log(`✓ Datos correctos (${counts}) → js/data/gen/data.js`);
}
