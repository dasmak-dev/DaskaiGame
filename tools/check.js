#!/usr/bin/env node
/* =============================================================
 * tools/check.js — Comprobaciones rápidas antes de publicar cambios.
 *
 * Uso (desde la carpeta del juego, con Node.js instalado):
 *     node tools/check.js
 *
 * Hace dos cosas:
 *   1. Comprueba que todos los .js de js/ tienen sintaxis válida.
 *   2. Comprueba que todos los textos que usa el código existen en
 *      español (es.js) y en inglés (en.js). Incluye los textos que se
 *      construyen a partir de los datos (sucesos, reliquias, mejoras,
 *      dificultades, tipos de nodo, logros, misiones y tutoriales).
 *
 * Si falta algo, lo lista y termina con código 1.
 * ============================================================= */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const JS = path.join(ROOT, 'js');
let problems = 0;

/** Lista recursiva de archivos .js */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}
const files = walk(JS);

/* ---------- 1. Sintaxis ---------- */
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { problems++; console.log('✗ Sintaxis:', path.relative(ROOT, f), '\n ', String(e.stderr).split('\n').slice(0, 4).join('\n  ')); }
}

/* ---------- 2. Textos ---------- */
// Carga el núcleo de idiomas y los datos en un "navegador" falso
global.window = global;
global.document = { documentElement: {}, createElement: () => ({}) };
global.localStorage = { getItem: () => null, setItem: () => {} };
const load = (rel) => eval(fs.readFileSync(path.join(ROOT, rel), 'utf8')); // eslint-disable-line no-eval
['js/core/dk.js', 'js/core/i18n.js', 'js/lang/es.js', 'js/lang/en.js'].forEach(load);
fs.readdirSync(path.join(JS, 'data')).forEach((f) => { try { load('js/data/' + f); } catch (e) { /* algunos datos necesitan el navegador */ } });
const D = DK.data;

// Claves literales: t('seccion.clave') en el código
const keys = new Set();
for (const f of files) {
  if (f.includes(path.sep + 'lang' + path.sep)) continue;
  // Sin comentarios (los ejemplos de la documentación no cuentan)
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) if (!m[1].endsWith('.')) keys.add(m[1]);
  // Tutoriales: tutorial: 'id' en las pantallas
  for (const m of src.matchAll(/tutorial: '([a-zA-Z]+)'/g)) keys.add('tut.' + m[1]);
}

// Claves que se construyen con datos
const add = (k) => keys.add(k);
['all', 'dmg', 'item', 'reward'].forEach((f) => add('battle.logFilter.' + f));
['level', 'name', 'house', 'hp', 'recent'].forEach((f) => add('team.sortBy.' + f));
(D.achievements || []).forEach((a) => { add(`achievements.${a.id}.name`); add(`achievements.${a.id}.desc`); });
Object.values(D.missions || {}).flat().forEach((m) => m && m.id && add('missions.' + m.id));
Object.keys(D.difficulties || {}).forEach((id) => { add(`difficulty.${id}.name`); add(`difficulty.${id}.desc`); });
(D.upgrades || []).forEach((u) => ['name', 'desc', 'effect'].forEach((x) => add(`camp.up.${u.id}.${x}`)));
['fight', 'elite', 'boss', 'event', 'shop', 'rest', 'treasure', 'recruit', 'shrine', 'cave', 'shortcut'].forEach((n) => { add('exp.node.' + n); add('exp.nodeDesc.' + n); });
new Set(Object.values(D.relics || {}).map((r) => r.effect.type)).forEach((ty) => add('relics.effect.' + ty));
(D.events || []).forEach((ev) => {
  add(`events.${ev.id}.title`); add(`events.${ev.id}.text`);
  ev.choices.forEach((c) => { add(`events.${ev.id}.choices.${c.id}`); add(`events.${ev.id}.desc.${c.id}`); if (c.req) add(`events.${ev.id}.need.${c.id}`); });
});
['blessing', 'feather', 'altar'].forEach((x) => add('battle.savedBy.' + x));
Object.keys(D.curses || {}).forEach((id) => { add(`curse.${id}.name`); add(`curse.${id}.desc`); });
Object.keys(D.phaseTypes || {}).forEach((ty) => { add('phase.' + ty); add('phase.name.' + ty); add('phase.desc.' + ty); });
Object.keys(D.talents || {}).forEach((id) => { add(`talent.${id}.name`); add(`talent.${id}.desc`); });
['trainReady', 'missions', 'fainted', 'hurt', 'tonics', 'upgrades', 'trainFree', 'craft'].forEach((k) => { add('todo.' + k); add('todo.' + k + 'One'); });
['high', 'up', 'normal', 'down', 'low'].forEach((r) => add('stats.rate.' + r));
['evo', 'perm'].forEach((k) => add('stats.legend.' + k));
['attack', 'heavy', 'heal', 'buff', 'debuff', 'status'].forEach((x) => add('intent.' + x));
['completed', 'retreat', 'lost', 'lostBoss', 'campfire'].forEach((x) => { add('sum.out.' + x); add('sum.outText.' + x); });

let missing = 0;
for (const k of keys) for (const lang of ['es', 'en']) {
  if (DK.i18n.lookup(lang, k) == null) { missing++; console.log(`✗ Falta el texto ${lang}: ${k}`); }
}
problems += missing;

console.log(problems ? `\n${problems} problema(s).` : `✓ Todo correcto: ${files.length} archivos y ${keys.size} textos comprobados.`);
process.exit(problems ? 1 : 0);
