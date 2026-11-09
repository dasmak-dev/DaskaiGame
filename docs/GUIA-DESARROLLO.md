# Guía de desarrollo de Daskai

El juego es HTML + CSS + JavaScript puro: sin dependencias ni compilación. Abre `index.html` con doble clic, o usa `iniciar.bat` / `iniciar.sh` para un servidor local (necesario para instalarlo como app).

Los daskai, ataques, objetos y zonas se editan en **JSON** (carpeta `data/`). Tras editarlos:

```
node tools/data.js
```

Comprueba los datos (dice el archivo, la línea y qué está mal) y genera `js/data/gen/data.js`, que es lo que carga el juego.

Antes de publicar un cambio ejecuta las pruebas:

```
npm test            (la primera vez: npm install && npx playwright install chromium)
```

Pasan `tools/check.js` (sintaxis, datos y que cada texto exista en español e inglés) y las pruebas de `tests/` en Chromium, en escritorio y en móvil. Sin Playwright puedes usar sólo `node tools/check.js`.

---

## 1. Cómo está organizado

### Capas

Cada capa sólo usa las que tiene por encima. El orden de carga está en `index.html`.

| Capa | Carpeta | Qué contiene | ¿Pinta en pantalla? |
|---|---|---|---|
| 1. Núcleo | `js/core/` | Utilidades, idiomas, ajustes, atajos, iconos, componentes de interfaz, navegación, menús, guardado | Sólo piezas genéricas |
| 2. Idiomas | `js/lang/` | Todos los textos (`es.js`, `en.js`) | No |
| 3. Datos | `js/data/` | Especies, ataques, objetos, recetas, zonas, sucesos, reliquias, dificultades, mejoras, reglas numéricas | No |
| 4. Sistemas | `js/systems/` | Reglas del juego: combate, niveles, bolsa, expediciones, reglas de dificultad, progreso | No (salvo avisos) |
| 5. Componentes | `js/components/` | Piezas visuales del juego reutilizables | Sí |
| 6. Pantallas | `js/screens/` | Una pantalla por archivo | Sí |

**Regla de oro:** los datos no tienen lógica, los sistemas no pintan nada y las pantallas no deciden reglas.
- ¿Cambiar un número? → `js/data/` (casi todo en `config.js`).
- ¿Cambiar una regla? → `js/systems/`.
- ¿Cambiar cómo se ve? → `js/components/`, `js/screens/` o `css/`.

### Mapa de archivos

```
index.html                 orden de carga de todo
sw.js                      caché sin conexión (añade aquí cada archivo nuevo y sube CACHE)
package.json               npm test / npm run check / npm run data
data/                      DATOS EDITABLES en JSON (ver «Contenido del juego»)
  species.json             especies (con su evolución: "evolves" / "from")
  moves.json               ataques
  items.json               objetos
  zones.json               zonas, su jefe (con fases) y su jefe oculto
tools/check.js             comprobación de sintaxis, datos y textos
tools/data.js              comprueba data/*.json y genera js/data/gen/data.js
tests/                     pruebas automáticas (npm test): run.js, helpers.js y *.test.js
css/
  base.css                 variables de color, temas, accesibilidad, carcasa
  components.css           botones, tarjetas, barras, modales, tooltips
  screens.css              estilos de cada pantalla (clásicos)
  battle.css               arena, escenarios, efectos y panel de mando del combate
  layout.css               navegación, paneles laterales y pantallas nuevas
  responsive.css           tablet y móvil
  theme.css                estética oscura, tipografía pixel de títulos, pixel art y espaciados
  game.css                 aspecto de juego: HUD, barra de accesos, pausa, campamento, cortinillas (se carga la última)
js/core/
  dk.js                    DK, DK.util (azar, fechas, semillas) y bus de eventos
  i18n.js                  DK.t('clave') y DK.tr(tipo, objeto)
  settings.js              DK.settings (ajustes del jugador y sus valores por defecto)
  keys.js                  DK.keys (atajos por capas)
  icons.js                 DK.icon('nombre')
  ui.js                    DK.ui: h, btn, bar, modal, drawer, toast (agrupados), tabs, select, pointerDrag (arrastrar con el ratón)...
  router.js                DK.screens.register, DK.router.go/replace/reset/back
  menus.js                 DK.menus.add('nav' | 'hub' | 'main', {...})
  store.js                 DK.store (3 ranuras, migraciones, exportar/importar)
  app.js                   carcasa de juego: HUD superior, barra de accesos, menú de pausa, campana de avisos
js/data/
  config.js                TODOS los números del juego (experiencia, daño, expediciones...)
  basics.js                casas, atributos, naturalezas, pasivas, estados, rarezas
  talents.js               talentos (cada 10 niveles se elige 1 de 2)
  mapMods.js               climas del mapa (niebla, tormenta, luna llena, ola de calor, bonanza)
  quests.js                encargos del mapa (objetivo opcional con premio)
  gen/data.js              GENERADO desde data/*.json (no se edita: node tools/data.js)
  species.js / moves.js / items.js / zones.js   cargadores: leen DK.raw y ponen los valores por defecto
  recipes.js / shop.js
  missions.js / achievements.js
  events.js                sucesos de expedición
  relics.js                reliquias de expedición
  difficulties.js          niveles de dificultad
  upgrades.js              mejoras permanentes (pantalla Mejoras)
js/systems/
  daskai.js                DK.daskai (atributos, niveles) y DK.party (equipo, muerte)
  boxes.js                 DK.boxes: cajas donde se guardan los daskai que no están en el equipo
  rules.js                 DK.rules (dificultad), DK.camp (Mejoras), DK.legacy (herencia)
  inventory.js             DK.bag, DK.wallet, DK.shop, DK.crafting (Crafteo), DK.healer
  world.js                 DK.codex, DK.world (zonas, jefes, desbloqueos)
  training.js              DK.training (campo de entrenamiento en tiempo real)
  expedition.js            DK.expedition (expediciones infinitas: zona al azar, mapa, nodos, botín,
                           reclutas, salvaciones, continuar/cobrar) y DK.relics
  battle.js                DK.battle (motor de combate sin interfaz)
  progress.js              misiones, logros y estadísticas
  audio.js / sprites.js    sprites.js: dibujo SVG de cada especie y su versión pixel art (DK.sprites.pixel, ajuste «pixelArt»)
js/components/             camp (escena del campamento y DK.pix), common, daskaiViews (fichas, tarjetas, tablas), daskaiPanel, itemViews,
                           avatar, shareCard, palette (Ctrl+K), guides (ayuda), celebrations, talentViews, todoCard (Qué hacer ahora), fx, scenes
js/screens/                mainMenu, newGame, hub (Campamento), camp (Mejoras), training (Entrenamiento), team, inventory, craft (Crafteo),
                           codex, zones (Batalla: mapa del mundo y preparar la expedición), expPrepare (piezas de la mochila), expedition, expSummary, battle, progress, profile, gameOver, settings
```

---

## 2. Recetas: cómo añadir cosas

Cada receta indica los archivos que hay que tocar. Después, ejecuta `node tools/check.js`.

### Una pantalla nueva (y su entrada en la navegación)

1. Crea `js/screens/mipantalla.js`:

```js
/* =============================================================
 * screens/mipantalla.js — Qué es y para qué sirve.
 * ============================================================= */
(function () {
  const { h, btn } = DK.ui;
  const t = (k, v) => DK.t(k, v);

  // Entrada en la barra de accesos (abajo). En el móvil: si hay más de 5, sólo salen las
  // marcadas con pin: true (Campamento, Equipo, Inventario, Batalla) y el resto va en la hoja «Más»
  DK.menus.add('nav', { id: 'mipantalla', icon: 'star', order: 35, screen: 'mipantalla', label: () => t('nav.mipantalla') });

  DK.screens.register('mipantalla', {
    title: () => t('nav.mipantalla'), icon: 'star',
    section: 'mipantalla',   // qué entrada de la barra se ilumina
    tutorial: 'mipantalla',  // opcional: textos en tut.mipantalla
    render(params) {
      DK.keys.on('1', () => DK.ui.toast(t('mipantalla.hola')));
      return h('div', { class: 'screen' }, h('div', { class: 'card' }, t('mipantalla.hola')));
    },
  });
})();
```

2. Añade `<script src="js/screens/mipantalla.js"></script>` en `index.html` y el archivo en `sw.js`.
3. Añade los textos en `js/lang/es.js` y `en.js`.

Más opciones:
- `nav: false` oculta la navegación.
- `badge: () => '!'` pinta un punto en la entrada.
- Una opción que no abre pantalla usa `action: () => {...}` en vez de `screen`.

### Contenido del juego

| Quiero añadir... | Archivo | Cómo |
|---|---|---|
| Un daskai | `data/species.json` | `"id": { "name", "house", "base": { hp, mp, atk, matk, def, mdef, spd }, "learn": [[nivel, "ataque"], …], "drops", "passives", "sprite", "desc", "role" }`. En `sprite`, además de colores, orejas, cola, ojos y marca: `body` (`round`/`egg`/`block`/`ghost`/`long`), `legs` (`feet`/`none`/`quad`/`tall`) y `extra` (`beak`, `horn`, `shell`, `mane`, `whiskers`, `fangs`, `arms`, `claws`, `cap`, `crown`, `scarf`) en `systems/sprites.js`. Por defecto: `exp` 40, sin botín y **cualquier pasiva** al azar. Para que aparezca, ponlo en `"enemies"` de una zona |
| Una evolución | `data/species.json` | en la especie de origen `"evolves": { "to": "destino", "level": 20 }` y en la nueva `"from": "origen"`: hereda casa, pasivas, ataques (+ `"learnExtra"`) y `exp` + 25 |
| Un ataque | `data/moves.json` | `"id": { "name", "kind": "fisico"\|"magico", "house", "power", "mp", "acc", "effect", "priority", "desc" }` (por defecto `acc` 100, `mp`/`power` 0, sin casa) |
| Un objeto | `data/items.json` + `js/data/shop.js` | `"id": { "name", "category", "rarity", "icon", "color", "use" / "stats", "grants", "desc" }` y su precio. Un tónico es `"use": { "perm": "atributo" }` |
| Una zona | `data/zones.json` | `"id": { "name", "levels", "colors", "scene", "unlock", "enemies": [["especie", peso]], "boss": { …, "phases": [{ "at", "type" }] }, "secretBoss" }` (el orden del archivo es el orden del juego) |
| Un objeto que da un ataque o una pasiva | `data/items.json` + `data/recipes.js` | equipo con `grants: { move: 'ataque' }` o `grants: { passive: 'pasiva' }` y su receta. El daskai que lo lleva lo usa en combate (`DK.daskai.battleMoves`, `DK.daskai.passives`) |
| Una receta | `data/recipes.js` | `def('resultado', cantidad, { ingrediente: n })` (todas se ven en Crafteo desde el principio) |
| Un suceso de expedición | `data/events.js` + `lang → events.<id>` | `{ id, icon, weight, minRow, choices: [{ id, icon, req(ctx), run(ctx) → { key, vars, fight } }] }` |
| Una reliquia | `data/relics.js` | `def(id, nombre, icono, rareza, { type, pct / add, house / stat })` (tipos explicados en el archivo) |
| Una dificultad | `data/difficulties.js` + `lang → difficulty.<id>` | `{ id, icon, permadeath, retreat, fixedRest, enemyMult, revives }` |
| Una mejora permanente | `data/upgrades.js` + `lang → camp.up.<id>` | `{ id, icon, group, levels: [{ cost, value }] }` y lee `DK.camp.value('<id>')` donde se aplique (la lista de dónde se usa cada una está en el archivo) |
| Una misión / un logro | `data/missions.js` / `data/achievements.js` | plantilla + textos en `missions.<id>` / `achievements.<id>`. Un logro puede ser **oculto** (`hidden: true`: se ve «???» hasta conseguirlo) y compartir textos con `text: '<clave>'` + `vars(state)` (así se generan los de cada jefe de zona, `boss_<zona>`). Usa siempre `DK.achievements.name(a)` / `desc(a)` para pintarlos |
| Algo que se desbloquea al avanzar | `systems/progress.js` → `UNLOCKS` + `lang → unlock.<id>` | `{ icon, screen, when(state) }`. Pregunta con `DK.unlocks.has('<id>')` (menú: `visible`, pantalla bloqueada, botones). El aviso sale solo la primera vez (`state.unlocks`) |
| Una pasiva o naturaleza | `data/basics.js` | una línea en `passives` o `natures` (las pasivas también cambian el ritmo de crecimiento, ver «Un daskai») |
| Un encargo de mapa | `data/quests.js` + `lang → quest.<id>.{name,desc}` | `{ icon, weight, track: 'elite'\|'break'\|'strong'\|'capture', target: { small, medium, xl } }` o `{ fail: 'item'\|'rest'\|'faint' }`, más `coins`. Un `track` nuevo necesita su `DK.expedition.questTrack('<track>')` donde ocurra |
| Un clima de mapa | `data/mapMods.js` + `lang → mod.<id>.{name,desc}` | `{ icon, weight, fog, houseDmg: { casa: pct }, weights: { tipoNodo: mult }, levels, coins }` |
| Un talento | `data/talents.js` + `lang → talent.<id>.{name,desc}` | `{ icon, mods: { stat: pct }, regen }` |
| Un tónico (mejora permanente) | `data/items.js` (lista `TON`) | `use: { perm: 'stat' }`, sin precio en la tienda (`noShop`); cuánto da cada uno y el máximo por daskai en `config.tonic` |
| Un marco de perfil | `components/avatar.js` | un objeto en `FRAMES` con `req` y `reqText` |
| Un icono / sonido / música | cualquier archivo | `DK.registerIcon`, `DK.audio.registerSfx`, `DK.audio.registerTrack` |
| Un idioma | `js/lang/xx.js` | `DK.i18n.register('xx', {...})` y añádelo a `index.html` |

### Un tipo de nodo de expedición nuevo

1. `systems/expedition.js` → añade el tipo a `TYPES` (`{ icon, battle: true|false }`).
2. `data/config.js` → dale un peso en `expedition.weights`.
3. `screens/expedition.js` → en `nodePanel()` devuelve su panel (si no es de combate). Llama a `E().completeNode()` al terminar.
4. Textos: `exp.node.<tipo>` y `exp.nodeDesc.<tipo>`.

### Una regla que dependa de la dificultad

Añade el campo en `data/difficulties.js` y una función en `DK.rules` (`systems/rules.js`). En el resto del código pregunta siempre a `DK.rules.miRegla()`, nunca a `state.difficulty` directamente.

### Una mecánica de combate

`systems/battle.js` no pinta nada: recibe una acción y devuelve **eventos**. La pantalla los reproduce con animación y texto.

1. Impleméntala en `DK.battle` y emite `this.push(st, ev, { text, anim: 'miAnim', side })`.
2. En `screens/battle.js`, añade `case 'miAnim'` en `play()` para animarla.

### Equilibrio

Todo está en `data/config.js`. Entre otras cosas:
- experiencia (`expCurve`, `expGain`, `expShare`) y daño entre casas (`house`);
- expediciones (`expedition.rows`, `weights`, `restHeal`, `directToBag`...), profundidad (`depthZoneStep`, `depthLevel`, `depthLevelOver`, `depthCoinBonus`, `expeditionBonus`) y rivales de élite (`elite*`);
- muerte y herencia (`reviveHpPct`, `legacyExp`, `legacyStat`) y economía (`sellRatio`...);
- crecimiento (`maxLevel` = 100, `growth`, `growthBias`, `evolveBonus`), tónicos (`tonic`, `expedition.tonicDrops`), talentos (`talentEvery`) y campo de entrenamiento (`training`).

Los ajustes del jugador (velocidad, automático...) están en `core/settings.js`.

---

## 3. Conceptos clave

### Estado de la partida (`DK.store.state`)

```js
{
  player: { name, avatar, frame, title, motto },
  difficulty: 'normal' | 'dificil' | 'pesadilla',
  party: [daskai], team: [uid],            // colección y equipo (máx. 4)
  bag: { objeto: n }, coins,
  zones, bosses, codex,
  expedition: null | { zone, depth, zones, awaitingChoice, next, map, pos, pending, loot, relics, recruits, revivesUsed, blessed, log, ... },
  nextExpedition: { zone, seed },          // primer mapa de la próxima expedición (vista previa)
  lastExpedition, expHistory: [resumen],   // resúmenes de expediciones
  graveyard: [caído], essences: [esencia], gameOver,
  camp: { mejora: nivel }, favorites,
  training: { slots: [{ uid, start, boost, paid, v: 2 }], level },  // campo de entrenamiento (sólo experiencia)
  missions, achievements, stats: { battles, wins, history, defeatedHouses, bestDepth, ... },
}
```

Si añades un campo, dale un valor por defecto en `store.migrate()` para que las partidas antiguas sigan funcionando.

### Un daskai

```js
{ uid, species, nickname, level, exp, nature, passive,
  growth: {...}, natureGrowth: {...}, legacy: {...},   // crecimiento por nivel, parte de la naturaleza, herencia
  evoBonus: {...}, tonics: { stat: n }, trained: { stat: puntos }, talents: { 10: 'id', 20: 'id' },
  cur: { hp, mp }, moves: [máx. 4], learned: [...], equip: [a, b],
  status, shiny, wild, boss, elite, temp }             // temp = recluta de la expedición en curso
```

**Cada daskai es único:** nace con una pasiva al azar de las de su especie, una naturaleza al azar y unos **genes** (`d.genes`, ±`config.genes` sobre cada atributo base: `DK.daskai.baseOf(d, k)`), y crece de forma aleatoria al subir de nivel. Las partidas antiguas sin genes usan la base de la especie tal cual.

**Caché de atributos:** `DK.daskai.stats(d)` guarda el resultado y sólo lo recalcula si cambia la revisión (la sube `DK.store.save()` y `DK.daskai.touch()`) o algo barato de comparar (nivel, especie, pasiva, equipo, reliquias, dificultad). Las funciones que cambian atributos sin tocar el nivel (tónicos, talentos, entrenamiento, herencia, evolución) ya llaman a `touch()`. **Si cambias a mano** `growth`, `tonics`, `trained`, `legacy`, `talents` o `genes`, llama a `DK.daskai.touch()`. `stats(d, equipo)` con un equipo de prueba no usa la caché.

Atributo final = `(base + crecimiento + equipo + herencia + tónicos + entrenamiento) × (1 + pasivas + talentos) × multiplicadores` → `DK.daskai.stats(d)`.

**Crecimiento al subir de nivel** (`rollGrowth`): cada atributo gana `growth.level` puntos × su **ritmo** (`DK.daskai.growthWeight`): la especie (sus atributos base altos crecen más) y las pasivas/talentos (+% crece más, −% menos), limitado por `growthBias`. Encima, la naturaleza suma o resta puntos. `growthRate(d, k)` lo resume en `high/up/normal/down/low` (▲▲ ▲ ● ▼ ▼▼ en la tabla de atributos y al subir de nivel).

**Evolucionar** cambia a la base de la nueva especie y además suma `evolveBonus` × (1 + nivel/30) a `growth` (guardado aparte en `evoBonus` para el desglose).

**Mejoras permanentes**: tónicos (`DK.daskai.applyTonic`, máximo `config.tonic.cap`; el elixir de olvido los devuelve con `resetTonics`) y puntos del campo de entrenamiento (`d.trained`). `DK.daskai.permBonus(d, k)` los suma.

**Talentos**: en los niveles 10, 20… se elige 1 de 2 (`talentOptions` es fijo para cada daskai). `talentsPending(d)`, `chooseTalent(d, nivel, id)`. Suman como una pasiva en `passiveMods`. La ventana sale sola tras la subida de nivel (`levelUpDialog` → `talentDialog`).

### Campo de entrenamiento (`DK.training`)

Se desbloquea al derrotar al primer jefe (`DK.unlocks.has('training')`): hasta entonces no sale en el menú, el botón del Inicio está bloqueado y la pantalla explica cómo abrirlo.


**Desde la v4.32 sólo da experiencia.** Huecos `config.training.slots` (2) + mejora «Instructor» (4 como mucho). El daskai sale del equipo (`DK.party.canJoin` lo bloquea) y cada minuto gana `pct(nivel actual)` × `expCurve(nivel)` de experiencia × aceleración por tiempo (`ramp(min)` = 1 + `ramp.perHour` × horas, hasta `ramp.max`) × acelerador (`slot.boost`, de `boosts`, pagado al dejarlo con `boostCost(nivel, m)`) × (1 + Instructor `rate`). **No se paga al entrar** (salvo el acelerador): al sacarlo se cobra `fee(nivel)` monedas por minuto × la misma aceleración, − Instructor `discount`. A las `maxHours` deja de ganar y de cobrar.

- `simulate(d, minutos, boost)` integra minuto a minuto (el % cambia al subir de nivel) → `{ level, exp, gained, levels, fee, capped }`. La pantalla lo usa para la previsión a 1/4/8/24 h.
- `progress(slot)` = simulación hasta ahora + `rate` (fracción de nivel/min actual) y `ramp`. `collect(uid, pay)`: `pay=true` cobra y aplica; `pay=false` lo saca gratis **sin** la experiencia (para no quedarte atascado sin monedas).
- Huecos antiguos (sin `v: 2`, de atributos o con pago adelantado): se devuelve lo pagado y empiezan de cero. Los puntos de atributo ya entrenados (`d.trained`) se conservan (`trainedTotal`, `statMax`).

### Expediciones

- **Infinitas:** no se elige zona. `DK.expedition.pickZone(depth)` elige una zona desbloqueada al azar; cuanto mayor es la profundidad, más pesan las zonas difíciles. Si la profundidad supera el número de zonas, los rivales suben de nivel (`levelBonus()`, aplicado en `DK.battle.start`).
- **Tras cada jefe:** `bossCleared()` da sus premios, hace permanentes a los reclutas del mapa, elige la zona siguiente y pone `awaitingChoice`. El jugador decide en el panel final del combate (o en la pantalla del mapa):
  - `continueRun()` → mapa nuevo, más profundo, con una reliquia a elegir;
  - `complete()` → termina y cobra con `bonusMult(mapas)`.
- **Mapa:** se genera por pisos con una semilla y un **tamaño** (`generate(zona, semilla, tamaño)`).
  - Tamaños en `config.expedition.sizes`: `small` (12 pisos con el jefe), `medium` (20) y `xl` (31 = 30 + jefe), cada uno con su peso, cuevas mínimas, atajos y hogueras repartidas. Se elige al azar (`pickSize()`) cada vez que se prepara un mapa: la próxima expedición (`nextExpedition.size`) y el mapa siguiente tras cada jefe (`e.next.size`). Se enseña antes de entrar con `V.sizeChip(size)` (preparar, Batalla, Inicio, elección tras el jefe).
  - Hay hogueras repartidas por el camino (1, 2 o 3 según el tamaño) y al menos `caves` **cuevas**.
  - **Atajos** (nodo `shortcut`, `node.jump`): saltan `shortcutSkip` pisos a cambio de `shortcutHpCost` de vida (`takeShortcut()` → `e.jumpTo`). En el mapa se dibujan con línea discontinua. La Mejora «Atajos» añade más.
  - **Cuevas** (nodo `cave`, `exploreCave()`): guarida del **jefe oculto** de la zona (`D.secretBosses` en `data/zones.js`) o un tesoro. El combate usa `DK.battle.start(zona, uid, { boss: true, secret: true, final: false })`. Vencerlo la primera vez lo **desbloquea** (`DK.world.secret(zona).defeated`): desde entonces el jefe final del mapa puede ser él (`node.secret`, probabilidad `secretFinalChance`).
  - Sucesos con **personajes** (`data/events.js`): viajera, ermitaño (tónicos), herrera (equipo/reliquia), cartógrafo (`revealCave` / `revealShortcut`: convierte un combate de más adelante en cueva o atajo), daskai perdido (`recruit`) y bandidos.
  - **Climas del mapa** (`data/mapMods.js`): cada mapa tiene `config.expedition.modChance` de traer uno (`pickMod()`; va en `nextExpedition.mod` / `e.next.mod` igual que el tamaño). `DK.expedition.mod()` da el del mapa actual.
    - `fog`: la niebla oculta los nodos a más de `fog` pisos de donde estás (salvo el jefe) en `mapView` (`fogged(n)`).
    - `houseDmg`: % de daño por casa (`modHouse(casa)`), aplicado en `factors()` del combate como parte `weather` («Clima»).
    - `weights`: multiplica los pesos de nodos al generar; `levels`: rivales más fuertes (`levelBonus()`); `coins`: % extra de monedas del botín (`addLoot`).
    - Se enseña con `V.modChip(mod)` en Batalla, preparar, cabecera del mapa y elección tras el jefe.
  - **Cronología:** `DK.expedition.logEvent(clave, valor)` guarda momentos en `e.log.timeline` (`{ k, v, d: mapa, f: piso, at }`): salida, mapas, jefes, élites, cuevas, atajos, sucesos, reclutas, reliquias, caídos, hogueras, final. `snapshot()` la copia y `expSummary` la pinta (`timeline()`, iconos en `TL_ICON`, textos `tl.<clave>`). El resumen compara además con la mejor expedición anterior de `expHistory` (`compare()`).
  - **Encargos** (`data/quests.js`): cada mapa trae `e.quest = { id, target, prog, failed, done, claimed, item }` (`pickQuest(tamaño)` en `start()` y `continueRun()`). `questTrack(kind)` suma progreso (élites y reclutas en `battle.rewards`, ruptura en `addBreak`, golpes eficaces en `act`), `questFail(kind)` lo falla (objetos curativos: oyente de `item:used`; descanso: `rest()`; caídos: `battle.resolve`). Al vencer al jefe del mapa, `questClaim()` añade `questReward()` (monedas × tamaño × profundidad, `config.expedition.quest`, y un objeto) al botín y lo apunta en `e.lastQuest` (sale en la elección tras el jefe) y en la cronología. Vistas: `V.questChip`, `V.questCard`, `V.questResult` (en `screens/expedition.js`).
  - **Barra de estado** (`hudBar`): fija y opaca sobre el mapa; cada icono abre su detalle en una ventanita flotante (`.exp-hud-pop`) que no empuja el mapa y se cierra al pulsar fuera o con Esc. La barra y la del equipo se rehacen solas (`redraw`) en vez de repintar la pantalla, para que el mapa no parpadee.
  - **Barra del equipo** (`teamBar` en `screens/expedition.js`, estilos en `css/game.css` §9): siempre `config.maxTeam` huecos (`.tb-slot`) del mismo ancho, como el equipo de Pokémon, así que con uno o dos daskai no se estira nada. Cada ficha (`.tb-card`, con el color de su casa): retrato, nombre y nivel, vida fina con números y maná aún más fino; el que lucha el siguiente combate lleva marco dorado y la cinta «Lucha»; el frasco verde (`.tb-heal`, sólo si está herido y hay objetos que sirvan) cura con `DK.healer.plan([d])`. Los huecos libres llevan a Equipo (con «+» si alguien que va contigo puede entrar). A la derecha, «Curar» a todos (`V.healDialog`). En el móvil las fichas se vuelven verticales (retrato + barras, sin nombre).
  - **Récords por zona:** `bossCleared()` actualiza `DK.world.progress(zona).rec = { maps, best, sizes: { tamaño: n }, fastest: ms }` (el tiempo cuenta desde `e.mapStartedAt`). Se ven en el panel de la zona (`recordsBlock`).
  - `DK.expedition.preview()` enseña el primer mapa de la próxima expedición; `start()` usa esa misma zona, semilla y tamaño.
  - **Dibujar en el mapa** (`screens/expedition.js`): botón «Dibujar» o clic derecho en el mapa. Lápiz de colores, goma, notas de texto, deshacer y borrar. Se guarda por mapa en `e.marks = { lines: [{ c, pts: [[x 0..1, y px]] }], notes: [{ x, y, text, c }] }` (`DK.expedition.addLine/addNote/removeMark/undoMark/clearMarks`) y se ve también en el resumen.
  - Mientras hay un nodo sin combate pendiente o una reliquia por elegir, el mapa se oculta (vista centrada).
- **Preparar (en Batalla):** ya no hay pantalla aparte: en `screens/zones.js` (`prepCard`), bajo el mapa del mundo, salen los datos del primer mapa en chips (tamaño, nivel de los rivales, clima, emblemas por jefe, récord), el **tipo de expedición** en pastillas (el elegido explica qué cambia), tu equipo (retratos con su vida), la mochila (chips de objetos; pulsar uno quita una unidad; «Sugerir», «Repetir» y «Elegir objetos», que abre el editor completo `V.packEditor` de `screens/expPrepare.js` en un panel), avisos en una línea y «Partir» (Enter). Al lado, la ficha de la zona con los récords plegados y el combate libre. La pantalla `expPrepare` sólo redirige a Batalla.
- **Mapa en pantalla:** los nodos se separan hacia los lados al pintarlos (`xOf` en `mapView`) y cada piso mide `ROW_FULL` px (los dibujos se guardan en esos px).
- **Mochila:** antes de salir, `screens/expPrepare.js` elige qué objetos de casa te llevas (`packCapacity()` = `config.expedition.packCapacity` + Mejora «Equipaje»; categorías en `packCategories`). `DK.expedition.start(pack)` los pasa a `e.pack`.
  - Mientras hay expedición, **`DK.bag` trabaja sobre la mochila** (`DK.bag.raw()`); la bolsa de casa es `DK.bag.home()`. Así combate, curar, mercader, sucesos y equipar usan la mochila sin cambios.
  - Al terminar, la mochila y el botín vuelven a casa (`DK.bag.addHome`); si pierdes, la mochila se pierde.
- **Salir:** ya no hay retirada en cualquier momento. Sólo:
  - tras el jefe del mapa → `complete()` (todo + bonificación);
  - en una **hoguera** → `campfireExit()`: te llevas `campfireKeep` (50%) del botín y de lo ganado en la mochila (lo que llevabas al salir vuelve entero) y **todos los reclutas** se quedan. No se puede en Pesadilla (`DK.rules.canRetreat()`). Resultado `'campfire'` en el resumen.
- **Modo expedición:** `DK.router.guard` (en `screens/expedition.js`) sólo deja ir a las pantallas de `EXP_SCREENS`; la navegación muestra sólo las opciones con `expedition: true` (o `'only'`) en `DK.menus.add('nav', ...)` (`DK.app.navItems()`). Si tu pantalla nueva debe verse durante una expedición, añádela a `EXP_SCREENS` y marca su entrada con `expedition: true`. En el equipo sólo pueden entrar los que salieron (`e.members`) y los reclutas (`DK.party.canJoin`).
- **Caer contra el jefe** (`fail({ boss: true })` → `failAtBoss`): sólo se pierde `config.expedition.bossDeathLoss` del botín y la mochila, y la próxima expedición empieza con `config.expedition.consolation` (reliquia rara/épica y pociones).
- **Mini jefes:** cada mapa tiene al menos un nodo élite; al vencerlo se elige una reliquia (`DK.relics.offer`).
- **Pactos** (`data/curses.js`, `systems/curses.js`): al empezar cada mapa se ofrecen `curseChoices` pactos **entre los desbloqueados** (si no hay ninguno, `curseOffer` = null y no se pregunta); los aceptados (`e.curses`) duran ese mapa. Cada sistema pregunta `DK.curses.effect('clave')` (niveles, curación, huida, vínculo, velocidad, fase extra) y las recompensas salen de `coinBonus()` / `relicReward()`.
- **Sin curación gratis** (`config.expedition.noFreeHeal`): en expedición no hay regeneración base por turno y subir de nivel no cura (sólo suma lo que crece el máximo).
- **Botín:** los consumibles (`config.expedition.directToBag`) van directos a la mochila; el resto y las monedas se entregan al terminar.
- **Reclutas:** son temporales (`d.temp`) y se quedan al derrotar al jefe de su mapa o al volver desde una hoguera (`settleRecruits`). Si pierdes, se van los del mapa actual.
- **Emblemas y Mejoras:** cada jefe derrotado en expedición (también los ocultos) da `DK.expedition.bossEmblems()` = `emblemsPerBoss` × `sizes[tamaño].emblems` (pequeño 1, mediano 2, XL 3) (`DK.camp.addEmblems`, en `state.emblems`). Las Mejoras (`data/upgrades.js`) cuestan emblemas y **sólo aparecen al terminar una expedición**: el resumen abre solo el menú (`V.upgradeMenu`, en `screens/camp.js`) la primera vez que se ve (`lastExpedition.shopShown`) y tiene una tarjeta para reabrirlo. No están en la navegación, ni en el Inicio, ni en el buscador; la pantalla `camp` redirige al Inicio.
- **Desbloqueos de reliquias y pactos** (`systems/rules.js` → `DK.camp.unlock(kind, id)`, `isUnlocked`, `unlocked(kind)`, `unlockCost`, `unlockable`; estado `state.vault = { curse: [], relic: [] }`): el menú de Mejoras tiene tres pestañas (`V.upgradeShop`: Mejoras · Reliquias · Pactos, `shopTab`) y en las dos últimas cada reliquia o pacto se desbloquea con emblemas (`config.expedition.unlockCost`: pacto 2; reliquia común 1, rara 2, épica 4). Sólo los desbloqueados se ofrecen **al empezar**: la reliquia inicial (`DK.relics.roll(rarezas, 3, { unlocked: true })`: comunes; raras con el Cartógrafo 1; también épicas y una común gratis con el Cartógrafo 2) y los pactos de cada mapa. Si no hay ninguna desbloqueada, no hay elección. Las reliquias que se encuentran por el camino (élites, cofres, jefes, consuelo, mapas siguientes) salen de todas. `DK.camp.affordable()` cuenta mejoras y desbloqueos que puedes pagar. La cabecera de Preparar enseña cuántas tienes desbloqueadas.
- **Muerte permanente:** se aplica si `DK.rules.permadeath()`.
  - Al acabar un combate, `DK.expedition.trySave(d)` intenta salvarlo: bendición del santuario, pluma de fénix o Altar del fénix (Mejoras).
  - Si no se salva, `DK.party.kill()`: el daskai pasa al cementerio y deja una esencia (`DK.legacy`).
- **Al terminar:** `DK.expedition.snapshot()` guarda el resumen (`lastExpedition` y `expHistory`) y se abre `expSummary`.

### Códice (`DK.codex`, en `systems/world.js`)

- Daskai: `seen/fought/defeated/captured` por especie. `DK.codex.species(sid)` junta todo para la ficha: estado (`unknown/seen/fought/defeated/captured`), zonas donde aparece, ataques por nivel, botín, el mejor ejemplar tuyo. La ficha se revela poco a poco: silueta → nombre y casa → zonas y ataques → punto débil y botín.
- Objetos: `markItem(id)` se llama solo desde `DK.bag.add/addHome` (`state.codex.itemsSeen`); `itemKnown(id)`.
- `DK.codex.totals()` = descubiertos / total de especies, objetos y jefes (incluidos los ocultos).
- Pantalla `screens/codex.js`: pestañas Daskai · Objetos · Jefes, filtros por casa, zona y estado, cuadrícula con siluetas y ficha lateral (escritorio) o en hoja (móvil).

### Especies: papeles, siluetas y evoluciones

- **Rasgo** (en el código `d.role` / `D.roles`, por daskai, no por especie): cada daskai nace con uno AL AZAR (`DK.daskai.rollRole()`): el 80% no tiene (`equilibrado`, «Sin rasgo») y el `config.roleChance` (20%) restante saca uno de `D.roles` según su `weight`: Coloso, Guardián, Bravo, Arcano, Raudo, Sabio o Temerario. Tener rasgo es una ventaja: `D.roles[x].mods` suma o resta un % al atributo base (`baseOf`), así que cuenta en todo lo que usa `DK.daskai.stats()`: la ficha, la tabla de atributos (el desglose dice «rasgo +20%» y hay una marca junto al atributo) y el combate (daño, defensa, velocidad, vida). Los jefes no tienen. Las partidas antiguas lo sortean la primera vez (`roleOf`). Insignia: `V.roleBadge(d)` en la ficha, las filas, el equipo, los reclutas y el combate (los dos lados).
- **Iniciales con tres evoluciones** (cuatro formas): evolucionan en los niveles 16, 34 y 54 (Lumino → Luminar → Solaris → Astrelion; Umbrix → Umbrakat → Noctyrion → Eclipsar; Pyrex → Pyrosaur → Infernyx → Volcanor; Aquelo → Aqualutra → Tidaleón → Oceanyx; Terrón → Terragor → Gaiadón → Titanterra). La pantalla de elegir inicial enseña la línea completa.
- **Siluetas:** cada especie combina forma del cuerpo, patas y añadidos, así que ya no son todas «bolas con orejas» (fantasmas que flotan, cuadrúpedos, aves con pico y patas, serpientes con segmentos, setas, tortugas con caparazón…).

### Tipos de expedición (`config.expedition.kinds`)

El tipo y el tamaño salen **al azar** al preparar cada expedición (`DK.expedition.pickKind()` según `kindChances()` — el `chance` de cada tipo: normal 50, captura 16, combate 16, tesoro 12, desafío 6 — y `pickSize()`), salvo que el jugador ponga **runas de expedición** (ver más abajo). Quedan guardados en `state.nextExpedition` hasta que salgas; Batalla los enseña (con «Fijado con runa» si hay runa de tipo).

| Tipo | Qué cambia |
|---|---|
| Normal | Mixto, como siempre |
| Captura | Corta, muchos reclutas (varios por piso), +1 candidato, +15% vínculo, −30% monedas |
| Combate | Casi todo peleas y mini jefes, +30% monedas, +25% experiencia |
| Tesoro | Cofres, tiendas, sucesos y cuevas; rivales +1 nivel; +20% monedas |
| Desafío | Corta, mini jefes por todas partes, rivales +3 niveles, +1 emblema por jefe (tras vencer a un jefe) |

**Zona de inicio:** la zona elegida en el mapa del mundo es la del primer mapa (`setStart({ zone })`, marcada «Inicio»; la ficha tiene «Empezar aquí»). Por defecto, la recomendada para tu equipo. Los mapas siguientes avanzan desde ella (`pickZone(depth, evitar, rnd, e.startZone)`).

### Tipografía

Estilo fantasía oscura (variables en `css/theme.css` y `css/base.css`): `--font-title` (Cinzel: títulos h1/h2, cinta de la cabecera, cortinillas, placas del campamento, nombres), `--font-pixel` (Alegreya Sans SC, versalitas: etiquetas, botones, chips, números, h3) y `--font` (Alegreya Sans: textos). Reglas en `css/game.css` §16. Se cargan de Google Fonts en `index.html`.

### Fondo

El fondo de la página es el de `<body>` (`css/theme.css` / `css/game.css` §2). `<html>` no debe tener fondo propio ni `body` una altura fija: si no, el fondo se corta al bajar y se ve el color liso (§11 lo deja con `height: auto`).

### Mapa de la expedición: caminos

`generate()` crea la estructura en **caminos**: 7 carriles (x de 0.2 a 0.8) y 4-5 caminos que salen de 3 entradas (izquierda, centro, derecha) y suben piso a piso; en cada paso siguen recto (60%) o pasan al carril de al lado (20% cada uno). Nunca se cruzan (se prohíbe ir de A a B si otro camino ya va de B a A en ese piso) y juntarse con otro camino es posible pero menos probable, así que de vez en cuando dos se unen en un nodo. Los nodos de cada piso son los carriles por los que pasa algún camino; los tipos se reparten después con las mismas reglas de siempre. El último piso normal se une a la hoguera final y ésta al jefe.

### Estética de fantasía oscura en todo el juego (`css/grim.css`)

Se carga la última y sólo sobrescribe: paleta (piedra oscura, bronce, oro `--gold` y carmesí `--primary`; en el tema claro, pergamino), fondo de la página, tarjetas y paneles de piedra con filo dorado, ventanas y paneles deslizantes, títulos dorados en Cinzel, cabecera y barra de accesos de hierro con la ranura activa carmesí y oro, botones, chips y la arena de combate (viñeta; jefes con marco rojo y el oculto morado). Si quieres volver al aspecto anterior, quita `css/grim.css` de `index.html` y de `sw.js`.

### Fondos de zona y de jefe

- **Expedición:** al entrar en el mapa, el equipo, la mochila o un combate durante una expedición, `#zone-backdrop` (creado en `screens/expedition.js` con `screen:enter`) pinta detrás de todo la escena de la zona actual, oscurecida; `body.in-exp`.
- **Combate:** la arena usa la escena de la zona (`components/scenes.js`, ahora con árboles muertos, ruinas, tumbas, cristales o tentáculos según la zona) y los **jefes tienen su propio fondo**: `DK.scenes.bossScene(zona, secreto)` → `boss_<escena>` (menhires bajo luna roja, bosque muerto, naufragio con tormenta, bosque de cristales, forja de lava, santuario con estatua, fauces del abismo, ruinas entre rayos) y `boss_secret` (cripta) para los jefes ocultos.

### Cambios de la v5.17 — cofre con escenario, música con fundido y electrónica, avisos discretos

- **Combate (fallo que parecía un error)**: se probaron unos 6.600 turnos simulados (todas las especies; oleadas y relevos) y 8 combates jugados por la pantalla sin ningún error. El caso más probable era un ataque que **falla por precisión**: el texto flotante decía «Fallo», que parecía un error del juego.
  - Ahora flota «No acierta».
  - El registro dice `battle.missedAcc`: «{move} no acierta (precisión {acc} %): esta vez no hace daño».
- **Cofre** (`screens/expedition.js`): usa el escenario de los sucesos `stage()`, que acepta ahora `o.art` (dibujo propio en el medallón) y `o.cls`.
  - Muestra el título grande «Cofre», el texto `exp.chestFound` y el botín debajo.
  - El medallón lleva el cofre: con relieve en Clásico y Exilio, icono de línea grande en Limpio (`.chest-stage`).
- **Mercader**: la barra «Seguir el camino» (`.mr-foot`, pegada abajo) se quedaba debajo de la barra de accesos en algunos anchos.
  - `core/app.js` mide la barra con un `ResizeObserver` y define `--dock-h`.
  - La barra del mercader va a `bottom: calc(var(--dock-h) + 8px)`.
- **Avisos más discretos**: pastilla pequeña arriba a la derecha (en el móvil, centrada), del ancho del texto, con icono pequeño y sin brillo. Duran 2,5 s (2 s en el móvil). Están al final de `juice.css`.
- **Música** (`systems/audio.js`):
  - Cada pista suena por su propio bus (`seq.bus`) y se cambia con un **fundido cruzado**: `stopTrack(fade)` apaga la anterior poco a poco.
    - Al salir del combate: 1,6 s de salida y 2,2 s de entrada.
    - Cambios normales: 0,9 s.
    - Dentro del combate (furia, peligro): 0,35 s con un redoble.
  - **Pistas electrónicas nuevas**:
    - `boss_synth` (140 bpm);
    - `boss_synth_rage` (152 bpm);
    - `horde` (136 bpm), para los combates contra varios rivales seguidos (`st.wave` o `p.wave`).
  - Capas nuevas: `arp` (arpegio a semicorcheas), `bass` (bajo en contratiempo), lead `synth` y batería `edm` (bombo a negras, palmas y charles).
  - `battleTrack` usa la versión electrónica para los jefes de volcán, cielo, abismo, glaciar, cueva y templo, y para el abismo.
- Pruebas: v5.17 en `juice.test.js`. Las pruebas del cofre crean un nodo de cofre si el mapa no tiene ninguno.

### Cambios de la v5.16 — cofre al entrar, reclutas con mejora, menos variocolor y arreglos del resumen

- **Cofre** (`screens/expedition.js`, nodo `treasure`): se abre en el mismo pintado en que entras, sin el `setTimeout` de antes.
  - Suena `chestSoft` (`systems/audio.js`): un clic de cerradura y dos notas suaves, más discreto que `chest`.
  - El cofre da un salto (`.chest-big.open.just` y `chestPop`) con un aro de luz, y las tarjetas del botín entran en cascada tras él (retraso de +0,28 s).
- **Candidatos de reclutamiento**:
  - `config.expedition.recruitChoices = 2` y `recruitChoicesMax = 5`.
  - Mejora nueva **`eleccion`** («Ojo de reclutador», `data/upgrades.js`, 3 niveles a 2/4/7 emblemas): +1/+2/+3 candidatos.
  - Las expediciones de captura suman su `recruit: 1` por encima del tope (hasta 6).
  - `reclutador` ya solo da los niveles extra; ya no da un candidato más.
- **Variocolor**:
  - `shinyChance` pasa de 1/200 a 1/450 y `recruitShinyChance` de 0,04 a 0,012.
  - En las expediciones de captura: `kinds.captura.shiny` = 0,035 en los reclutas y `wildShiny` = 0,006 en los combates (`battle.js` lo suma con `kindDef().wildShiny`).
- **Resumen** (`screens/expSummary.js`):
  - El equipo es un `flex` que ocupa todo el ancho (`.sum-team .st-grid`): las fichas se estiran, pero el dibujo mantiene su tamaño.
  - Los rivales son botones: al pulsarlos se abre un modal `.sf-zoom` con el dibujo en grande (280 px), el nivel, cuántas veces apareció y si era jefe, élite o variocolor. No muestra atributos.
- **Tamaño de interfaz** (`uiScale`, zoom en `<html>`): `#bgfx` medía `100vw`/`100vh` y encogía con el zoom, así que el fondo no llegaba al borde. `settings.apply()` define `--uiz` y el lienzo mide `calc(100vw / var(--uiz))`.
- Prueba nueva en `expedition.test.js` (v5.16).

### Cambios de la v5.15 — más alas y piezas, brazos que se mueven y patas bien colocadas

- **Alas** (`epicWingsSvg(kind, P, layer, glow, scale)`):
  - Rediseñadas:
    - **dragón**: membrana con húmero, codo y 4 dedos, borde festoneado entre los dedos (`membrane(elbow, tips, depth, …)`) y garra en el codo;
    - **demonio**: 5 dedos, borde rasgado con pinchos (`jag`), garra curva y agujeros en la membrana.
  - Nuevas:
    - libélula (`dragonfly`);
    - hojas (`leaf`; otoñales en fuego y oscuridad);
    - aleta (`finwing`);
    - fénix (`phoenix`, plumas de fuego curvadas);
    - noche estrellada (`cosmic`);
    - humo (`shadow`).
  - Todas están en `REG.wings` y en los sesgos de cada casa.
  - **Alitas en la 3.ª forma**: `regalia()` añade `wings3` al final del sorteo, sin cambiar lo que ya salía. El 32 % de los que tendrán alas las llevan ya en la 3.ª forma, a escala 0,62.
  - La caja del dibujo crece hasta que caben las alas (`wingTop`): ya no se cortan por arriba.
- **Piezas nuevas** solo para semillas **NEW9** (`0xab`, la que usa `rollLook` desde ahora; `isNew8` incluye NEW9). Los aspectos anteriores no cambian:
  - `EARS9`: penachos de búho, branquias, orejas de antena, orejas gachas, orejas de fuego y orejas de concha;
  - `ARMS9`: guadañas, enredaderas, guanteletes, manos de algodón y garfio;
  - `MARKS9`: moteado, lomo oscuro, antifaz, trazos tribales y calcetines.
  - El sorteo de brazos de siempre usa `ARMS_ROLL`; `ARMS_ALL`, el catálogo completo, incluye los nuevos.
  - Tienen nombre en es/en y sílabas en `names.js`.
- **Brazos que se mueven**: `armSvg` envuelve el brazo (`armShape`) en `<g class="dk-arm dk-arm-near|far">` con `transform-origin` en el hombro.
  - Un tercio de los individuos (`(seed >>> 11) % 3 === 0`) llevan `arm-idle` y los balancean solos.
  - `life.js`: los que tienen brazos pueden hacer `ia-wave`, `ia-cheer` e `ia-flex` (y `ca-wave` y `ca-cheer` en la hoguera).
  - CSS en `juice.css`. Se respeta `data-motion="reduced"`. En pixel art no se mueven, porque el dibujo es una imagen.
- **Patas** (`legsSvg`): `P.bottom = hullBottom(pts)` es el borde de abajo real del cuerpo.
  - Cada pata sale de ese borde en su x (`Yb(x)`), así que no quedan huecos en cuerpos de escudo, cometa o reloj de arena.
  - Si en esa x el cuerpo queda muy alto, la pata se acerca al centro (`LX`).
- Pruebas: v5.15 en `juice.test.js`. La de v5.6 acepta ahora también la marca NEW9.

### Cambios de la v5.14.1 — arreglo: volver a casa desde la hoguera

- **Fallo**: al volver a casa desde la hoguera habiendo perdido equipo raro o legendario, el resumen fallaba al pintarse. El problema estaba en las fichas de botín de la v5.11: `V.gearIcon` recibía la foto de la pieza (`gearSnap`, sin `attrs` ni `nm`) y `DK.gear.name` leía `p.nm[0]`.
  - Como el fallo ocurría a mitad del pintado, el panel de Mejoras (que se abre con un `setTimeout`) sí aparecía, pero la pantalla seguía en la hoguera. La expedición ya había terminado, así que «Volver a casa» no hacía nada y el jugador se quedaba atrapado.
- **Arreglo**:
  - `V.gearIcon` usa `p.name` cuando la pieza no tiene `attrs`.
  - `DK.gear.name` devuelve `p.name` si la pieza no tiene `nm`.
- **Red de seguridad** (`core/router.js`, `render`): si una pantalla lanza un error al pintarse, se registra en consola y se va a un sitio seguro: la expedición si sigue activa y, si no, el campamento (`hub`). También se avisa con `common.screenError`.
- Prueba nueva en `expedition.test.js`.

### Cambios de la v5.14 — más siluetas y cuerpos que cambian al evolucionar

- **12 siluetas nuevas** (`BODIES9`, `PRESET`, `BODY_PATH`): hogaza (`loaf`), jorobado (`hunch`), reloj de arena, cacahuete, escudo, pirámide, hexagonal, rocoso (`crag`), inclinado (`tiltegg`), cometa de cola (`comet`), de dos jorobas (`camel`) y bruto (`brute`).
  - `bodyPath` admite parámetros nuevos:
    - `nb`: exponente distinto en la mitad de abajo (base plana);
    - `hunch`: lomo más alto atrás;
    - `humps`: dos jorobas;
    - `waistX`: estrechez en horizontal;
    - `taper`: la parte de atrás acaba en punta;
    - `tilt`: giro;
    - `poly`, `rot`, `blend`, `jit`, `flatB`: polígono redondeado o facetado.
  - Las siluetas con `hull` usan el borde real (`hullTop`) para colocar orejas, cuernos y piezas del lomo.
  - Tienen nombre en es/en (`look.body.*`) y sílabas en `names.js`.
- **`evolveBody(r, root, sprite)`**, en `ind()`, dentro de `systems/looks.js`:
  - **Firma de la especie**: `hash('sig:' + root)` le da a cada línea evolutiva un cuerpo base y uno maduro propios. Los aspectos nuevos (semillas NEW8) llevan el cuerpo de su especie el 50 % de las veces, y una silueta nueva el 22 %. Así las especies se distinguen más entre sí.
  - **Madurar**: guarda `ind.path`, el cuerpo de cada una de las 4 etapas. En la 3.ª etapa, el 70 % de las veces el cuerpo pasa a uno de `MATURE` (el de la especie o uno al azar). En la 4.ª, el 75 % pasa a uno de `MATURE_LATE` (bruto, jorobado, rocoso, torre…) o mantiene el de la 3.ª. Esto vale para todas las semillas; solo quedan fuera los fantasmas, los alargados y las siluetas fijas.
  - `draw` usa `ind.bodyFixed || ind.path[st] || BODY_PATH`.
  - El nombre automático se calcula con `ind.body0` (el cuerpo de antes del cambio), así que nadie cambia de nombre.
- Prueba nueva en `juice.test.js` (v5.14).

### Cambios de la v5.13 — piezas variadas en las formas 3.ª y 4.ª

- **«Regalía» por individuo** (`systems/looks.js`, `regalia(ind)`, expuesto en `DK.looks.regalia`). Cada daskai tira con su semilla (`ind.seed ^ 0x7e9a11c3`) un juego de piezas, sesgado por su casa (y algo por su segunda casa, `REG_BIAS`). Se guarda en `ind._reg`, así que su 3.ª y su 4.ª forma son coherentes.
  - `back` (rango 3 y 4): púas, placas, cristales, vela, vértebras, llamas, hojas o púas finas (`backSvg`).
  - `head3`: cuernitos, cuerno único, antenas con luz, cresta, gema o cuernos de carnero.
  - `head4`: el 65 % de las veces es la evolución de `head3` (`UPGRADE`); si no, se tira aparte. Opciones: cuernos de dragón, de demonio, halo, corona de llamas, astas, cuerno único dorado, corona de cuernos, tercer ojo o carnero grande (`headSvg`; la gema y el tercer ojo van en la capa `top`, sobre el pelo).
  - `wings` (rango 4): ángel, dragón, demonio, mariposa, cristal, fuego, hueso, cuervo, espectrales o ninguna (`epicWingsSvg`). Sin alas, casi siempre lleva capa.
  - `extra` (rango 4): orbes que flotan, círculo rúnico en el suelo, capa, humo, hombrera o brasas (`extraSvg`, capas `back` y `front`).
  - `pattern`: runas, rayas, escamas o grietas brillantes, dibujadas dentro del recorte del cuerpo. Las runas y las grietas, solo en la 4.ª forma.
  - `glow`: color de los brillos según la casa (`GLOW`). La llama usa el degradado `fw<id>`.
- Reglas: si ya tiene orejas de cuerno, la cabeza lleva algo que flota (gema, antenas, cresta, halo, corona de llamas, tercer ojo). Si lleva sombrero o corona de forma final, no se le pone halo ni corona de llamas. Las siluetas fijas (`arch`) no llevan lomo ni cuernos extra.
- Los jefes usan su aspecto típico, así que cada jefe tiene siempre las mismas piezas.
- Prueba nueva en `juice.test.js` (v5.13: variedad de piezas).

### Cambios de la v5.12 — evoluciones imponentes y emblema del resumen

- **Formas 3.ª y 4.ª más imponentes** (`systems/looks.js`). `lookOf` añade `tot` (formas totales de la línea, `DK.daskai.formsOf`) y `boss`; `tierOf(look, st, fin, g)` decide el rango:
  - **4** = forma final de una línea de 4 formas, o cualquier jefe: alas especiales según la casa (`epicKind`: oscuridad → demonio, luz/agua → ángel, el resto → dragón; `epicWingsSvg`), cuernos grandes o halo (ángel), púas en el lomo y aura radial (`EPIC[kind].aura`).
  - **3** = 3.ª forma de una línea de 4, o la final de una de 3: más grande (×1.12), piel algo más oscura, púas dorsales (`spikesSvg`) y cuernos pequeños (`hornsSvg`).
  - **0** = el resto, sin cambios. Las líneas de 2 formas no cambian.
  - El tamaño crece ×1.2 en rango 4 y los jefes van siempre a tamaño de forma final grande (`boss`: mínimo `1.62 / GROWTH[st]`, caja 150). El `viewBox` crece (+30 / +8) y `extraTop` deja sitio a las alas. La clave del caché de píxeles (`pxKey`) incluye `B` (jefe) y `T<tot>`.
- **Emblema del resultado** (`components/outcomeEmblem.js`, `DK.outcomeEmblem(outcome, cls)`), de nuevo en la cabecera del resumen. Un solo elemento con dos caras, y el CSS (juice.css, «Emblema del resumen») elige cuál se ve:
  - el dibujo con relieve (copa con estrella de rubí, bandera hecha jirones, calavera con huesos cruzados, corona maldita rota, hoguera con llama animada);
  - el icono de línea con laurel.
  Según el estilo:
  - **Clásico**: medalla redonda de colores con rayos que giran y cintas.
  - **Exilio**: placa octogonal con marco de oro viejo y halo que late.
  - **Limpio**, y también Exilio con tema claro: anillo con laurel (dos ramas generadas en un arco), icono de línea y anillo punteado que gira.
  Todas las variantes llevan un brillo que cruza la placa y se respeta `data-motion="reduced"`.
- Prueba nueva en `juice.test.js` (v5.12).

### Cambios de la v5.11 — Resumen más compacto, botín en fichas y más gestos de los daskai

- **Resumen de la expedición** (`screens/expSummary.js`, `juice.css` «v5.11»):
  - Cabecera sin el icono grande del resultado; los datos del mapa (mapa, superados, piso, tiempo, visitados, dificultad, desafío, runas, secretos) en una cuadrícula ordenada de celdas iguales (`.sum-meta`) en vez de píldoras en filas desiguales.
  - «Tu equipo» y «Rivales» sin icono en el título ni el texto de ayuda del equipo; tarjetas más pequeñas (dibujo 84 / 60 px).
  - **Botín en fichas** (`.lt`): una tarjeta por objeto o pieza con icono, nombre, cantidad y qué hace (o su rareza), borde del color de su rareza, ordenadas de legendario a común y agrupadas (entregado al volver, para usar ya, la mochila vuelve, perdido —tachado—); al pasar el ratón o pulsar, la ficha completa (`V.infoProps`). Las monedas, arriba a la derecha. Ocupa todo el ancho, debajo de los rivales.
- **Gestos de los daskai fuera de la hoguera** (`life.js`, `.ia-*`): cada ~2,6 s uno o dos daskai visibles (fichas, resumen, combate, equipo…) miran a un lado, ladean la cabeza, dan un saltito, se contonean, se estiran o se asoman. Van sobre la imagen con propiedades sueltas (`rotate`/`translate`/`scale`) para no pisar la respiración ni las animaciones del combate; en combate no se hacen mientras reciben un golpe, cargan o caen.

### Cambios de la v5.10 — Arreglos: parpadeo en la hoguera (móvil), líder en la expedición, arrastrar daskai y haz legendario

- **Hoguera en el móvil**: al desplazar la pantalla con el dedo por encima de los lugares (hoguera, cofre, tablón…) se les ponía y quitaba enseguida el «hundido» de los botones (`life.js`) → parpadeaban. Ahora, con el dedo, el hundido espera 90 ms y se cancela si el dedo se mueve o la página se desplaza. Además los lugares, la luz de la hoguera, el clima y las luciérnagas van en capas propias (`will-change`, `backface-visibility`), la niebla ya no usa desenfoque animado y en el móvil hay la mitad de gotas/copos.
- **Líder durante la expedición**: si cambias el primero del equipo (Equipo → hacer líder / arrastrar) el siguiente combate lo empieza él (`fighter()` en `screens/expedition.js` adopta el nuevo primero: `e.leaderFirst`). Elegir quién lucha desde la barra del mapa sigue funcionando igual.
- **Arrastrar un daskai** (cajas ↔ equipo): la copia que sigue al dedo/ratón ya no «vuela» desde la esquina de arriba a la izquierda (`pointerDrag`: nace en el sitio del puntero, sin transición ni animación).
- **Haz dorado del botín legendario**: sube, brilla y se va solo a los ~3 s (antes se quedaba latiendo); la tarjeta conserva sólo un borde dorado fino. La ficha de pieza legendaria recién forjada late 2 veces y para.

### Cambios de la v5.9 — Pisos planos en Limpio, paisaje vivo en la expedición y nuevo resumen

- **Pisos en el estilo Limpio**: planos y sutiles como el resto de la interfaz (círculo con borde fino del color del tipo, fondo opaco tenue, icono de línea; disponible = borde vivo y halo suave; hecho = apagado con insignia verde plana; jefe más grande con borde dorado). `DK.nodeArt(tipo)` lleva ahora el dibujo con relieve **y** el icono de línea (`.node-line`): Limpio muestra el de línea; Exilio (oscuro) y Clásico, el dibujo. Igual en la cabecera del piso y la leyenda.
- **Fondo de la pantalla de la expedición** (`#zone-backdrop`): menos oscurecido y con **paisaje animado a los lados** según la zona (`DK.ambient.page(escena)`, tiras SVG a izquierda y derecha en espejo): pinos y robles que se mecen (Pradera, Bosque), palmeras (Costa), estalactitas y cristales que brillan (Cavernas), rocas con grietas de lava (Volcán), columnas (Templo), árboles muertos y juncos (Pantano), tentáculos e islas flotantes (Abismo), agujas de hielo (Glaciar), islas flotantes (Cumbre); con borde de luz de la zona y partículas por toda la pantalla (hojas, ascuas, nieve…). Dentro del mapa, los árboles y rocas (`.exp-deco`) también se mecen.
- **Resumen de la expedición** (`screens/expSummary.js`):
  - Lleva el fondo animado de las pantallas generales (`bgfx`: `expSummary` ya no está en `OFF_SCREENS`).
  - Cifras clave arriba (`.sum-strip`): combates ganados, niveles subidos, monedas, objetos traídos, emblemas y pisos.
  - **Tu equipo** en grande (`.st-card`): cada daskai con su dibujo, «Nv. 8 → 14», «+6 niveles», y si cayó, fue reclutado o acabó debilitado; pulsar abre su ficha.
  - **Rivales** (`.sf-card`): los daskai contra los que luchaste, agrupados por especie (veces, nivel más alto), con jefes (más grandes) y mini jefes marcados, y si los vinculaste o no los venciste.
  - Datos nuevos guardados: `e.log.lvStart` (nivel de todos al salir), `e.log.foes` (cada combate, también cada rival de oleadas/relevos: `battle:end` lleva `foes`), y en el resumen `team` (`DK.expedition.teamSnap`) y `foes`. Los resúmenes antiguos (sin esos datos) no muestran esas secciones.
- Tests: `juice` (+ resumen con equipo, niveles y rivales).

### Cambios de la v5.8 — Pisos del mapa adaptados a cada estilo

- Los medallones de la v5.7 cambian según el estilo (`juice.css`, sección «v5.8»):
  - **Limpio (oscuro)**: medallón redondo con anillo de metal (sin cambios).
  - **Limpio claro** (`[data-theme="light"]`): el mismo medallón sobre pergamino claro, anillo de bronce y sombras suaves; el jefe en rojo.
  - **Exilio** (`[data-skin="exile"]`, sólo oscuro): losa octogonal de piedra con filete dorado (`::before` marco, `::after` fondo, `clip-path` octogonal), iconos algo desaturados y cálidos, brillo dorado cuando se puede ir, insignias en rombo con borde dorado; mismo octógono en la cabecera del piso y la leyenda.
  - **Clásico** (`[data-style="classic"]`): ficha cuadrada de colores vivos del tipo de piso, borde grueso oscuro y sombra 3D (como antes, con los iconos nuevos).

### Cambios de la v5.7 — Mapa de rol clásico, fondos con vida y bajada del mapa sin espera

- **Bajada del mapa al entrar** (`flyIn` en `screens/expedition.js`): empieza en cuanto la cortinilla empieza a abrirse (`.curtain.opening`), sin esperar a que desaparezca ni los 0,9 s de antes (ahora 0,26 s con el jefe resaltado).
- **Pisos del mapa como medallones** (`components/nodeArt.js`, `juice.css`): `DK.nodeArt(tipo)` dibuja cada icono con relieve y contorno (espadas cruzadas de acero, calavera con cuernos, corona con rubíes, pergamino con «?», bolsa de monedas, hoguera, cofre, huella, cristal, cueva, flecha dorada; el jefe del Abismo en violeta). Degradados compartidos en un único `<svg>` de definiciones (`#na-*`). El medallón: anillo de metal según el estado (hierro bloqueado, oro disponible, plata en curso, piedra hecho, rojo perdido), fondo con volumen del color del tipo y brillo arriba; el jefe más grande con anillo de oro y fondo rojo. Ya no son translúcidos (los caminos no se ven a través). Hechos: icono apagado + insignia verde. Mismo estilo en la cabecera de cada piso y en la leyenda.
- **Insignias** (estrella del piso especial, reliquia, hecho) dentro del borde del medallón, del mismo tamaño y con su borde: ya no quedan cortadas ni descuadradas.
- **Fondos con vida** (`components/ambient.js`): `DK.ambient.map(escena, alto)` en el mapa (sombras de nubes que lo cruzan, luz de la zona que se mueve despacio y partículas: luciérnagas, polen y mariposas en la Pradera; hojas en el Bosque; destellos, burbujas y gaviotas en la Costa; polvo, gotas y brillos en las Cavernas; ascuas y ceniza en el Volcán; motas de luz en el Templo; fuegos fatuos en el Pantano; chispas del vacío en el Abismo; nieve en el Glaciar; ráfagas en la Cumbre). `DK.ambient.battle(escena)` en el combate (rayos de sol, reflejos del agua, calor y lava, niebla, aurora, estrellas…).
- **Fondos de combate** (`components/scenes.js` → `DECO`, clases `scn-*`): nubes que pasan y pájaros (Pradera, Costa, Cumbre), flores que se mecen, pinos en capas y setas que brillan (Bosque), sol, mar con olas y un velero (Costa), estalactitas y cristales que laten (Cavernas), volcán con cráter y río de lava que brillan y columna de humo (Volcán), sol con rayos que giran e islas flotantes (Templo, Abismo, Cumbre), fuegos fatuos y bancos de niebla (Pantano), aurora que ondea (Glaciar). Las capas cercanas se mecen un poco.
- Tests: `juice` (+ medallones con icono nuevo, estrella dentro del medallón y fondo animado en el mapa).

### Cambios de la v5.6 — Marcos que encajan, más colores por casa, degradados, ojos y bocas nuevos y 10 especies

- **Marcos de las cajas**: `.pc-slot > .pc-mon` vuelve a ocupar la casilla entera (`position: absolute; inset: 0`; `grim.css` lo dejaba en `relative` y el daskai quedaba más bajo que el hueco). El marco va en la casilla (borde del color + esquina) y el arcoíris del variocolor rodea la casilla entera.
- **Aspectos nuevos** (`looks.js`, marca `NEW8_TAG = 0xaa` en la semilla; los daskai que ya tenías no cambian):
  - `PAL8`: 14 tonos por casa (parecidos pero variados: carmesí, coral, rosa y ámbar en Fuego; marino, turquesa, hielo y verde agua en Agua; añil, ciruela, magenta y lavanda en Oscuridad; oro, crema, melocotón y rosado en Luz; oliva, musgo, terracota, arena y piedra en Tierra). El 70 % de los nacidos usa uno.
  - **Degradado** del cuerpo (`ind.grad = { c, dir, at }`, 60 %): otro tono de su casa o el mismo más claro/oscuro, hacia abajo, hacia arriba, en diagonal o hacia atrás (`<linearGradient id="g8…">` recortado al cuerpo). No se aplica a los de doble casa (ya llevan el degradado de la segunda).
  - Ojos `EYES8`: con estrellitas (`twinkle`), con cejas (`brows`), almendrados (`almond`), adorables (`dewy`). Bocas `MOUTHS8`: un colmillo (`fang1`), punta de lengua (`blep`), «¡oh, no!» (`ohno`), carcajada (`beam`). 22 % cada uno; los ojos nuevos parpadean.
- **10 especies nuevas** (`data/species.json`, en las listas de rivales de `data/zones.json`): Cenicito → Fogarrón (Fuego, Nv. 24), Escarchín → Glaciarón (Agua, Nv. 30), Prismito → Prismalux (Luz, Nv. 32), Nocturín → Penumbrón (Oscuridad, Nv. 28), Guijarrín → Peñascón (Tierra, Nv. 30). Salen en Bosque, Costa, Cavernas, Volcán, Templo, Pantano, Abismo, Glaciar y Cumbre.
- Tests: `juice` (+ aspectos nuevos, especies y marcos que encajan).

### Cambios de la v5.5.1 — Marcos de las cajas más sutiles

- `V.frameCls(d)` en las cajas va ahora en la **casilla** (`.pc-slot.frame-*`), no en el daskai: el borde de la casilla toma el color (bronce / plata / oro) y lleva una esquina pequeña arriba a la derecha; el variocolor tiene un borde arcoíris fino que gira. En Equipo y en la preparación, un aro fino. Encaja exactamente con el hueco.

### Cambios de la v5.5 — Pisos especiales (oleada, relevo, encuentros, mercaderes), sucesos en escenario, fichas al pasar el ratón y hoguera más viva

- **Fuera**: la pantalla de título de la v5.4 (y sus textos/CSS). El cofre de la expedición vuelve a su animación de antes, pero **se abre solo** al llegar (650 ms, sin botón) y **sin sonido** al mostrar el botín.
- **Hoguera más viva** (`components/life.js`, `juice.css` `.ca-*`): cada ~2 s un daskai (nunca el mismo dos veces) hace algo corto: mirar a los lados, estirarse, saltito (a veces dos a la vez), bailar, acercarse al fuego a calentarse (`--warm-x` hacia la hoguera), girarse, asentir o botar; los dormidos se acurrucan. **Sólo en la hoguera** (`.camp-mon`).
- **Pisos especiales** (`config.expedition.specials`, estrella dorada en el mapa `.exp-node.special`, `n.special`): se reparten con su propio azar (`seed|special`) para no cambiar el resto del mapa.
  - Combate **Oleada** (`chain`): 3 rivales seguidos sin salir del combate. **Relevo** (`swap`): a media vida el rival se retira y entra otro con la vida llena; a media vida de éste vuelve el primero; al caer uno, vuelve el otro hasta vencer a los dos. Recompensa ×2,2 / ×1,8 (`rewardMult`). Motor: `battle.start(..., { wave })` → `st.wave = { kind, total, queue, beaten, all, swapped, mult }`; `resolve()` hace entrar al siguiente (`enemyIn()`, evento `anim:'enemyIn'` con `uid`) o retirarse (`anim:'enemyOut'`). La foto de cada evento lleva `eUid` para que la barra de vida sea la del rival que se ve. Insignia «Oleada 2/3» / «Relevo» en el HUD.
  - **Encuentro especial** (`?` con `special: 'rare'`, `e.event = 'special'`): un personaje misterioso regala uno de 3 objetos especiales (`config.expedition.specialItems`: tónicos, cristal de sabio, esencia ancestral, pluma de fénix, elixir, piedras de forja raras…). `DK.expedition.specialPick(n)`, `takeGift(id)` (una sola vez; `e.giftChoice`/`e.giftTaken`).
  - **Mercader de rarezas** (`curio`): 5 objetos especiales (`specialOffers()`, precio `specialPrice()`) + 2 normales, marcados con ★. **Mercader generoso** (`gift`): regala uno a elegir (mismo panel que el encuentro).
- **Sucesos en escenario** (`stage()` en `screens/expedition.js`, `.ev-*`): escena con los colores de la zona, el personaje grande (o un emblema si no hay personaje), bocadillo con lo que dice y las opciones como tarjetas (icono, texto, tecla). El resultado se muestra en el mismo escenario. **Al pulsar al personaje** (también el medallón del mercader) se abre una ventana con su silueta mucho más grande, **aún oculta** (`npcZoom`).
- **Fichas al pasar el ratón** (`components/infoTips.js`): `h(..., { tipNode: () => nodo })` hace que el tooltip enseñe una ficha (`.tooltip.rich`). `V.infoCard(kind, id)` para 'item' | 'rune' | 'gear' | 'move' | 'passive' | 'status'; `V.infoOpen` la abre en ventana; `V.infoProps(kind, id)` = ficha al pasar + ventana al pulsar. Se usa en el botín tras ganar (objetos, runas, piezas) y en las tarjetas del cofre.
- **Registro de combate** (`V.richLog(text)`): los ataques, objetos, pasivas y estados que aparecen en cada línea se resaltan por colores (`.log-ref.k-*`) y al pasar el ratón o pulsar dicen qué hacen. En la tira de la arena se ven resaltados pero sin ficha (al pulsarla se abre el registro).
- Tests: `juice` (+ pisos especiales, oleada y relevo, regalo, registro con fichas).

### Cambios de la v5.4 — Daskai vivos, combate con impacto, recompensas, mundo, sonido y detalles de «juego de verdad»

- **Daskai vivos** (`components/life.js`, `css/juice.css`): `V.sprite(..., { cls: 'alive' })` respira muy suave (`dkBreathe`, 1–3 %) y parpadea de vez en cuando (un único `setInterval` de 700 ms, como mucho 40 a la vez, sólo los visibles). El parpadeo cambia un instante el dibujo por el mismo con los ojos cerrados (`DK.looks.svg/pixel(..., { blink: true })`, caché con sufijo `~`). Sólo parpadean los ojos abiertos de base (`DK.looks.canBlink`; lista `BLINK` en `looks.js`): los ojos ya cerrados, felices, guiños, gafas… se quedan igual. `DK.life.react(el, 'hop'|'happy')` (saltito al pulsarlo en la hoguera; alegría al subir de nivel) y `DK.life.sleep(el)` (ojos cerrados fijos, respiración lenta y «Zzz»). Se usa en la hoguera, el combate, la ficha rápida, el escaparate, Entrenamiento y la subida de nivel. Todo se apaga con «Reducir movimiento» / «Saltar animaciones».
- **Combate** (`screens/battle.js`, `components/fx.js`, `juice.css`) — sin embestida hacia el rival:
  - Carga mágica con el color de la casa (`.sprite.charge`, `--hc`), destello blanco del atacante, temblor suave en golpes grandes (≥25 % de la vida, `.arena.shake-s`) y el fuerte en críticos, *hit-stop* (60 ms; 110 ms en crítico).
  - Números de crítico dorados que rebotan (`.float-num.crit`); los números seguidos no se pisan.
  - Impacto por casa (`impact()` en `fx.js`): fuego → llamarada; agua → onda; tierra → polvo y temblor (`.arena.quake`); luz → rayo directo (`beam()`) y destello de pantalla; oscuridad → sombra que envuelve. Estela de proyectil más larga.
  - **Jefes**: entrada desde abajo iluminados en rojo + rugido (`sfx('roar')`); al caer, cámara lenta, destello blanco y se deshacen en partículas (`DK.fx.disintegrate`). Los demás caen de lado (`dkFaint`).
  - **Estados nuevos** (`data/basics.js`): **Congelado** (no actúa; se descongela al azar 35 %/turno, a los 3 turnos o con un ataque de fuego), **Paralizado** (30 % de perder el turno y −40 % de velocidad), **Cegado** (precisión ×0,65 durante 3 turnos) y **Dormido** (no actúa; despierta al azar 30 %, a los 3 turnos o al recibir un golpe). `battle.blockedBy()` decide si pierde el turno (evento `anim:'blocked'` con «¡Congelado!/¡Paralizado!/Zzz…» flotando) y `anim:'cured'` al pasarse. Se ven en el propio daskai (`.sprite.st-*`: escarcha, chispas, venda, «z Z», burbujas) y al aplicarse sueltan su rastro (`DK.fx.statusBurst`).
  - Ataques que los causan: destello y supernova (cegado), hidrochorro y maremoto (congelado), terremoto y golpe roca (paralizado), sombra vil y eclipse (dormido), y 4 nuevos: **Aliento helado** (agua), **Nana lunar** (oscuridad), **Polvo paralizante** (tierra) y **Resplandor** (luz), en las listas de 36 especies. Panacea y elixir curan los 6 estados.
- **Subida de nivel**: el «+8» venía de sumar varios niveles a la vez y de los multiplicadores (%), que agrandaban los puntos de crecimiento. Ahora `applyGrowth` recorta lo que **se ve** a +5 por atributo y nivel (`config.growth.max`), `gainExp` guarda lo que dio cada nivel (`res.levels[i].gains`) y la ventana lo desglosa («+3 +4 +5…»). Tope de vida sin equipo para los daskai del jugador: `config.hpCap = { base: 100, perLevel: 5 }` (Nv. 40 → 300; Nv. 100 → 600; se aplica también a los que ya tenías). `growthBias.max` 1,6 → 1,4.
- **Recompensas** (`celebrations.js`, `expedition.js`, `craft.js`, `battle.js`):
  - Subida de nivel: columna de luz detrás del daskai, los atributos suben uno a uno con un «tic» y fanfarria nueva.
  - Evolución: silueta blanca que alterna entre las dos formas cada vez más rápido, destello y revelación.
  - Cofre: tiembla con el brillo de la mejor rareza que lleva, se abre y el botín sale volando (`.chest-panel.fresh`).
  - Botín legendario: haz de luz dorada y sonido propio (`sfx('legend')`), también en las recompensas de combate.
  - Forja: yunque con chispas (`sfx('forge')`) y la pieza aparece girando; si es legendaria, borde dorado que late.
- **Mundo**:
  - Hoguera con día/noche real (ya existía): de noche el fuego alumbra más, hay luciérnagas y la mitad del equipo duerme con «Zzz».
  - Clima (`components/weather.js`, `DK.weather`): Glaciar → nieve; Pantano → niebla (a veces lluvia); Bosque/Pradera/Playa → a veces lluvia; Volcán → ceniza; cuevas, templo, abismo y cielo → despejado. En combate según la zona (cambia cada 2 h); en el campamento, cada 3 h. Sólo CSS y ≤55 partículas.
  - Mapa de expedición: el líder camina de un nodo al siguiente y el camino recorrido se ilumina (`.road-lit`).
- **Sonido** (`systems/audio.js`): música dinámica — `DK.audio.intensity(0–1)` añade capas de percusión según lo herido que esté el jefe o tu daskai, y al pasar a «furia»/«peligro» la música baja un instante y entra con un redoble (sin cortar en seco). Interfaz con más cuerpo: clic con golpecito grave, monedas que tintinean, golpe seco al engarzar una runa o equipar (`sfx('thud')`), cofre, forja, logro.
- **Detalles**:
  - Pantalla de título (una vez por sesión, `mainMenu.js`): el campamento según la hora de fondo, el logo cae letra a letra y brilla, ascuas, cinco daskai y «Pulsa para empezar» (también activa el audio). No sale en las pruebas automáticas (`navigator.webdriver`, salvo `window.__title`).
  - Marcos tipo carta (`V.frameCls(d)`): bronce (1.ª evolución), plata (2.ª), oro (ascendido) y holográfico (variocolor), en Equipo, cajas y la preparación.
  - Contadores que corren (`DK.util.countTo`): monedas y emblemas del HUD (con «+N/−N» que sube) y la experiencia/monedas de las recompensas.
  - Logros: medalla que cae desde arriba (`V.achievementDrop`), en lugar del aviso.
  - Botones que se hunden al pulsar (`.is-pressed`) con una vibración corta en el móvil.
- Tests: `juice` (tope +5 por nivel y de vida, estados nuevos, parpadeo y clima, logro/contador/botón).

### Cambios de la v5.3 — Mejorar runas: reactivos sólo con una runa elegida

- `V.runeBench` (`components/runeBench.js`): sin runa elegida sólo se ve la lista de runas (`.rune-bench.browse.no-sel`); la columna de reactivos aparece al pulsar una. Se quita la nota «Cada reactivo sale explorando su zona…» (y su texto `rune.forge.reagentsHint`).

### Cambios de la v5.2 — Crafteo más claro, ficha de la pieza forjada, nueva ventana de la mochila y runas más compactas

- **Crafteo** (`screens/craft.js`, `grim.css`):
  - El panel de la receta (`.wb-side`) termina por encima de la barra de abajo (`body[data-nav="on"]`: −96 px más) y su pie con «Forjar» va fijo abajo (`position: sticky`), también en la hoja del móvil.
  - Las recetas a las que les falta **algún** material (`.wb-tile.s-missing`) van en gris (escala de grises y menos opacidad); las que se pueden construir llevan brillo verde y una esquina verde.
  - **Tras forjar equipo** (`V.craftedReveal(uids)`): ventana con la ficha completa de la pieza (`V.gearTip`: atributos, prefijos y sufijos con su rango y su nivel N1–N5), un resumen de sus afijos con los niveles y el mejor, y los botones **Guardar**, **Llevar a Mejorar** (abre la pieza en la pestaña Mejorar, `params.fp`) y **Equipar** (`V.equipPicker`). Si forjas varias a la vez, arriba eliges cuál ver (y al equipar una pasa a la siguiente).
- **Mochila** (`V.packModal` en `screens/expPrepare.js`, `.pm-*`): ventana centrada (ya no el panel lateral). Arriba la mochila como una fila de huecos (uno por objeto; pulsar uno lo devuelve) con Sugerir / Repetir / Vaciar; debajo la bolsa en tarjetas con filtros por categoría (sólo las que tienes) y buscador; pulsar = uno más (Mayús = todos los que quepan), la franja dorada de la tarjeta dice cuántos llevas y su «−» lo quita. En el móvil, huecos en filas de 5 y filtros deslizables.
- **Runas de expedición**: sin el texto «Al azar» cuando no hay ninguna puesta; huecos de 38 px (gema 28) con 14 px de separación.
- Tests: `craft` (gris, ventana de la pieza forjada y «Llevar a Mejorar») y `boxes` (nueva ventana de la mochila).

### Cambios de la v5.1 — El Abismo como «boss rush» de cada zona

- **Qué es ahora** (`DK.abyss`, `data/endgame.js → abyss`): el modo extremo de una zona. Se elige en la preparación (Reglas de la aventura → Abismo) para la zona seleccionada; hace falta el Abismo abierto (5 jefes de zona vencidos) **y** haber vencido al jefe de esa zona (`DK.abyss.available(zona)`).
- **Serie de jefes** (`DK.abyss.series(zona)`): los jefes de las 4 zonas anteriores y, al final, el de la zona (máx. `series: 5`). Todos suben al nivel de la serie (`bossLevel(zona, i)` = jefe de la zona + `baseLevel` − (último − i) × `roundLevel`; el último, el más duro).
- **Mapa** (`abyssMap` en `systems/expedition.js`): una fila por jefe y, entre jefe y jefe, una fila con hoguera y mercader (elige uno). Los jefes intermedios son nodos `aboss` (tipo nuevo en `TYPES`, morado, con el dibujo del jefe y su título debajo); el último es el `boss` normal de la zona. Cada jefe se pelea en el fondo de su propia zona (`battle` con `zone: bossZone`, `final: false`, `abyssRound`) y con sus fases.
- **Rondas:** al vencer al último, la decisión de seguir lleva a otra ronda de la **misma zona** sin clima: +`depthLevel` (6) niveles y +`depthStat` (6 %) por ronda (la primera sin extra).
- **Premios:** cada jefe → 1 emblema y monedas (`perBoss`, `DK.abyss.onBoss` desde `battle.finish`); cada ronda → emblemas, 2 runas de tier alto, monedas y fragmento abisal la primera ronda de cada zona y luego cada 3 (`reward`, `onFloor`).
- **Récords** (`state.abyss.zones[zona] = { best, rounds, done }` y `state.abyss.best`): jefes seguidos en una bajada y rondas completas, por zona; se ven en la preparación junto a la serie de jefes (con su nivel).
- Interfaz: sin etiquetas de tamaño ni de tipo en el Abismo (sólo «Abismo · ronda N»); la tarjeta de seguir muestra el nivel de los jefes de la siguiente ronda. Wiki y textos actualizados.
- Test `endgame`: serie hasta el Volcán, mapa jefe/descanso, nivel de los jefes, récord, premios y ronda siguiente.

### Cambios de la v5.0 — 5 runas, selector ancho, Corrupción mínima I, rivales más duros y dos zonas nuevas

- **Runas** (`config.expedition.runes.slots: 5`, antes 4): cinco huecos en la preparación, más pequeños (46 px, gema de 34). El selector (`runePicker`, `.rune-modal`) es más ancho en pantallas ≥ 700 px (hasta 1080 px) y enseña 4 runas por fila.
- **Corrupción**: una vez desbloqueada ya no hay «sin corrupción»: el selector enseña I–V y `DK.expedition.nextStart()` pone el nivel I si no hay ninguno; `DK.corruption.set` no baja de 1. El desafío semanal sigue sin corrupción (`nextExpedition.weekly`).
- **Balance** (medido con `scratch/sim99.js`: duelos 1 contra 1 a nivel de zona, sin y con equipo/talentos/tónicos):
  - `config.enemyScale = { base: 1.03, perLevel: 0.0033 }`: salvajes y jefes ×(1,03 + 0,0033 × nivel) → Nv. 5 ×1,05 · Nv. 30 ×1,13 · Nv. 60 ×1,23 · Nv. 90 ×1,33 (el principio casi igual; lo que más crece es el final, donde se acumulan equipo, talentos y tónicos).
  - Élites: vida ×1,75 (antes 1,6) y atributos ×1,22 (antes 1,2). Jefes: atributos ×1,2 (antes 1,15).
  - Resultado con equipo completo: los combates normales dejan ~65–75 % de vida (antes ~80 %); un solo daskai gana ~40–70 % de las élites y ~10–30 % de los jefes (con 6 en el equipo siguen siendo asequibles).
- **Zonas nuevas** (`data/zones.json`, en orden): **Pantano Brumoso** (Nv. 42–52, tras el Templo; jefe Señor del Fango, Kraknoir Nv. 55) y **Glaciar Eterno** (Nv. 62–76, tras el Abismo; jefe Aurora Helada, Auroris Nv. 79). Se reajustan los niveles: Templo 34–42 (jefe 45), Abismo 52–62, Cumbre 76–90. Escenas `swamp` / `glacier` y de jefe `boss_swamp` / `boss_glacier` (cañas y auroras en `components/scenes.js`), música propia (`audio.js`), hallazgos de exploración (`explore.finds`: sin reactivo; ámbar fósil y lágrima de glaciar, objetos de experiencia nuevos).
- **Partidas antiguas** (`store.migrate`): una zona nueva se abre sola si ya habías vencido al jefe anterior o tenías abierta la siguiente.
- Tests: `data` (zonas nuevas, migración y escalado), `kinds` (5 huecos) y `endgame` (Corrupción sin nivel 0).

### Cambios de la v4.99 — Corro en la hoguera, exploraciones y preparación de la expedición

- **Campamento** (`camp.js`): el equipo se sienta en corro alrededor de la hoguera con seis sitios simétricos (`ring`: dentro, lejos/atrás y delante a cada lado, del centro hacia fuera; en el móvil la fila de «lejos» va detrás de la hoguera). Los de delante tapan a los de atrás (`zIndex` según la fila) y miran hacia la hoguera. Daskai de 84 px (44 en el móvil). Comprobado a 390, 768, 1024, 1366 y 1920 px sin pisar la hoguera, su cartel ni los lugares.
- **Exploraciones** (`screens/training.js`, `.ex-who-*` en `grim.css`):
  - «Quién va» son tres tarjetas grandes (dibujo de 100 px, 70 en el móvil, nombre, nivel y naturaleza) que llenan la zona junto a las zonas; al pulsar una sale su ficha rápida (`V.quickStats`, como en la hoguera); la «×» de la esquina la quita del grupo; los huecos vacíos abren la lista.
  - «Ocultar lista» va dentro del bloque de la lista (barra del buscador); con la lista cerrada, «Elegir daskai (n)» aparece en la cabecera de «Quién va».
  - La duración (30 min / 2 h / 8 h) está al lado de «Mandar (…)».
- **Preparar expedición** (`screens/zones.js` → `prepCard`):
  - **Tu equipo** en dos columnas de tres (`.bt-team6`): dibujo, nombre, barra de vida y «Nv. · vida»; los huecos libres llevan a Equipo; al pulsar uno sale su ficha rápida (antes iba a la pantalla de Equipo).
  - **Mochila** en lista del mismo alto que el equipo (`.pk-list-wrap` con la lista en `position: absolute` para que no estire la fila; scroll si hay muchos): icono, nombre, efecto y «− ×N +» (sumar uno de la bolsa sin abrir el editor); vacía, una zona grande «Elegir objetos» con la capacidad. Sugerir / Repetir / Vaciar siguen debajo.
- Tests: `boxes` (3+3, ficha al pulsar, lista de la mochila) y `shop` («Quién va» con tarjetas y ficha).

### Cambios de la v4.98 — Ojos, boca y pelo al azar en las siluetas

- `harmonize` ya no elige ojos, boca ni pelo según la silueta (se quitan `ARCH_EYES`, `ARCH_MOUTH` y `ARCH_HAIR`): son totalmente aleatorios, para que haya dinosaurios, escorpiones, bestias y conchas muy distintos entre sí. Se mantienen las orejas por silueta (tapaban sus piezas), las reglas de patas y el toque de la casa (`HOUSE7`).

### Cambios de la v4.97 — Criterio al generar daskai (siluetas, patas de raptor, placas)

- **`harmonize(ind)`** (`systems/looks.js`): tras el sorteo de las semillas NEW7 (y siempre en las especies con `sprite.arch`) se arreglan las combinaciones que se veían mal y, a veces, se eligen rasgos que pegan. Usa su propio azar (`seed ^ 0x2f6b8d33`, calentado 5 pasos: semillas parecidas daban lo mismo).
  - **Siempre:** las siluetas llevan orejas de su lista (`ARCH_EARS`: dinosaurio cresta/cuernos/púas…, escorpión antenas, bestia orejas de gato/zorro/oso…, concha antenas/brotes) y pelo compatible (`ARCH_HAIR`); fantasmas y serpientes nunca llevan silueta (salía la cola de dinosaurio en un fantasma); patas de raptor sólo en cuerpos que se sostienen (`RAPTOR_OK`, si no: ave/garras/digitígradas); corazón, estrella y cometa (acaban en punta) sólo con patas que encajan (`BODY_LEGS`).
  - **A veces:** ojos y bocas de la silueta (`ARCH_EYES`/`ARCH_MOUTH`, ~50 %), placas del color de los cuernos de la casa, patas típicas de seta y barril (60 %), brazos cortos con patas de raptor, un toque de la casa (`HOUSE7`, 15 %: agua babosa/tiburón/ventosa, oscuridad ojos de vacío/serpiente, luz gema…), y sombreros con orejas o antenas altas se cambian casi siempre por bufanda, pajarita, aura o melena.
- **Dibujo:** el muslo de delante de las patas de raptor va más atrás y nunca sube por encima de la boca (la tapaba); las placas del dinosaurio sólo en la mitad trasera del lomo, curvadas hacia atrás, del color de la piel con brillo, y bajando por la cola; la cola del dinosaurio se acorta para no salirse del recuadro en los grandes; el caparazón empieza detrás de los ojos y sus placas se escalan con él.
- Probabilidad de silueta al azar 12 % → 10 %.
- Test en `tests/stats.test.js`: 4.000 semillas sin silueta en fantasmas, sin raptor en cuerpos altos, cuerpos en punta con sus patas y orejas válidas en las siluetas.

### Cambios de la v4.96 — Talentos cada 25 niveles, siluetas nuevas de daskai, arcón y códice animado

- **Talentos** (`data/talents.js`, `config.talentEvery: 25`, `talentChoices: 3`): ahora sólo a los niveles **25, 50, 75 y 100**, eligiendo **1 de 3**. Hay **20 talentos fuertes** (verdugo, archimago, coloso, muralla, relámpago, vampiro, fénix, espinas, halcón, linaje, cazador, furia, pozo, equilibrio, tirano, inquebrantable, toxina, sombra, emboscada, fortuna) con `mods` (% de atributos), `regen` (% vida/turno) y `fx` (los mismos efectos de combate que los afijos; `DK.gear.fxOf` los suma antes de aplicar los topes). `talentOptions` excluye los ya elegidos en otros niveles.
- **Recomendación**: `DK.daskai.talentProfile(d)` (físico/mágico por atributos y movimientos, tanque/frágil, rápido, estados) y `talentFit(d, id)` → `{ score, why }`. La ventana (`components/talentViews.js`, `.tl-*` en `grim.css`) muestra el retrato, chips de perfil, la pista 25/50/75/100, tres cartas grandes con estrellas de afinidad, cinta «Recomendado» en la mejor y el motivo, y debajo el comparador de atributos.
- **Por qué a veces no salía la ventana**: sólo se abría desde el diálogo de subida de nivel del daskai que combatía; las subidas por experiencia compartida del banquillo o con objetos desde la Bolsa (modo silencioso) sólo daban un aviso. Ahora `levelUp` apunta en una cola a todo daskai que llega a un nivel de talento y `V.talentFlush()` abre la ventana al volver a una pantalla tranquila (sin ventanas abiertas, fuera del combate y del menú principal; en `screen:enter` y tras `afterLevel`).
- **Partidas antiguas** (`store.migrate`, `talentsV: 2`): los talentos de niveles que no son múltiplo de 25 se devuelven; aviso único `talent.reset`.
- **Aspectos** (`systems/looks.js`, etiqueta `NEW7_TAG = 0xa9`): **siluetas** (`ARCH`: dinosaurio con cola y placas, escorpión con cola segmentada y aguijón, bestia cuadrúpeda con cola peluda, concha hexagonal), 12% de probabilidad sesgada por casa (`ARCH_HOUSE`) o fija con `sprite.arch`; cuerpos `heart, star5, mushroom, barrel, kite`; patas `raptor`, `slime`; ojos `void, gemeye, snake, pixel, sclera`; bocas `shark, sucker, goofy, whiskers, underbite`; tamaños extremos `xxs` (0.6–0.74) y `xxl` (1.26–1.42). Nueva categoría «Silueta» en la colección de rasgos.
- **Especies nuevas** (`data/species.json` + `zones.json`): Raptil → Raptorex (16) → Tiranox (36) (fuego, dino); Escorpix → Aguijonyx (30) (tierra, escorpión); Conchín → Caracolón (28) (agua, concha); Lobrillo → Lobaurum (25) (luz, bestia).
- **Inventario** (`campArt.tent`): **arcón** alargado y robusto (50×32, `base 30`): tapa abombada, tres flejes de hierro remachados, cantoneras, patas de hierro y cerradura dorada; al pasar el ratón la tapa se levanta y sale el brillo.
- **Códice**: al pasar el ratón pasa las páginas más rápido, brilla más, las chispas aceleran y gira un círculo mágico discontinuo bajo el atril (`codexRing`, `motion.css`; respeta movimiento reducido).
- Tests: talentos (3 opciones, recomendación, `fx`, cola) y siluetas en `tests/stats.test.js`.

### Cambios de la v4.95 — Guantelete con volumen, baúl viejo, una sola llama, atril del códice y campamento sin solapes

- **Cursor** (`tools/cursors.js`): guantelete rehecho con volumen: mano derecha vista por el dorso, **índice estirado en tres placas** que se solapan, corazón/anular/meñique **doblados** (se ven sus nudillos), **pulgar recogido** a un lado, placa del dorso con remache-gema y brazal acampanado con remaches. Degradados de metal con luz arriba a la izquierda (`PAL.gold` / `PAL.teal`), reflejos y **sombra proyectada** (`feDropShadow`, también en texto y agarrar).
- **Inventario** (`campArt.tent`): **baúl viejo y cuadrado** (tablones gastados con grietas y nudos, esquina astillada, herrajes oxidados, candado). 3 fotogramas: al pasar el ratón la tapa se levanta un poco y asoma un brillo dorado con monedas y una gema (`.a-tent .fr2` se queda).
- **Hoguera**: **una sola llama** grande en gota: los bordes ondulan hacia arriba, la punta se mece, el cuerpo respira y sube un corazón claro; dos lengüecitas a los lados.
- **Códice**: vuelve el **atril** de madera (tablero, columna torneada y pie) bajo el grimorio (lienzo 40×38, `base 24`).
- **Campamento sin solapes**: en el Inicio la escena usa siempre las posiciones medianas (`mid = … || o.compact`; antes a ≥ 1800 px todo se pisaba y las antorchas quedaban encima del portal y el códice); nuevas posiciones para el equipo junto a la hoguera, la mochila/códice/yunque/exploraciones en el móvil, antorchas del móvil en los bordes y daskai del móvil a 46 px. Comprobado a 390, 768, 1024, 1366 y 1920 px.

### Cambios de la v4.94 — Cursor de guantelete, mochila más pequeña y hoguera más grande

- **Cursor** (`tools/cursors.js` → `css/cursor.css`): la flecha pasa a ser un **guantelete de metal con el índice apuntando** arriba a la izquierda (se dibuja derecho y se gira −38°; punta en 2,2). **Dorado** el normal y **turquesa** sobre lo que se puede pulsar (`--cur-pointer`); ayuda, prohibido, espera y lupa llevan su insignia abajo a la izquierda. Texto (barra dorada) y agarrar (mano) igual.
- **Mochila** del campamento más pequeña (`base 18`).
- **Hoguera** más grande: lengua central de 29 px (antes 22) y laterales de 19–20 (antes 13–14), más anchas; la lengüecita y las chispas suben más.

### Cambios de la v4.93 — Mochila con bolsillos y cursor del juego

- **Inventario en el campamento** (`campArt.js` → `tent`): sólo una **mochila de explorador** (el baúl se quita), más pequeña (`base 25`, lienzo 32×36): saco de dormir arriba, solapa con bolsillo, bolsillo frontal grande, dos laterales y una taza colgando. **No se anima sola**: al pasar el ratón (o con foco / pulsada) recorre los fotogramas 0 → 3 abriendo el bolsillo frontal (poción, pergamino y moneda que brilla) y los laterales, y se queda abierta (`motion.css`: `.a-tent`, `bagFrame` / `bagFrameLast`).
- **Cursor propio** (`css/cursor.css`, generado con `node tools/cursors.js`; se carga el PRIMERO): flecha de metal dorado con contorno oscuro y variantes: **botón/enlace** (gema turquesa y halo), **ayuda** (?), **prohibido**, **espera**, **texto**, **agarrar/agarrando** y **lupa**. Todas las hojas usan `var(--cur-pointer|help|notAllowed|default|grab|grabbing|text|zoom)` en lugar de los cursores del sistema; las reglas base van en `:where()` (especificidad 0). Ajustes → Gráficos → «Cursor del juego» (`settings.customCursor`, `html[data-cursor="native"]` vuelve a los del sistema); en pantallas táctiles (`pointer: coarse`) no se usa.

### Cambios de la v4.92 — Baúl de viaje y hoguera más bonita

- **Inventario en el campamento** (`campArt.js` → `tent`, el id no cambia): la tienda de campaña pasa a ser un **baúl de viaje** con herrajes, cerradura dorada y la tapa entreabierta con brillo, monedas y una gema, y a su lado una **mochila de cuero** con un saco de dormir enrollado. 4 fotogramas (brillo que late, destello que recorre la tapa y una chispa); lienzo 58×42, `base 42`; `.a-tent { --dur: 1.4s }`.
- **Hoguera** (`fire`): llamas más pequeñas y limpias: tres lenguas en forma de gota (la central más alta) que oscilan con suavidad, en capas rojo → naranja → amarillo → corazón claro; una lengüecita que se suelta y menos chispas. Troncos, brasas y piedras igual.

### Cambios de la v4.91 — Cristales de mejora y revisión de código

- **Piedras → cristales de mejora** (sólo los nombres; los ids `piedra_*` no cambian para no romper partidas): Cristal de transmutación, alteración, purga, regio, del caos, divino, alquimia, aumento, exaltación, anulación, templado, cambio y núcleo; «Fragmento de forja» → **Fragmento de cristal**; «Sello de forja» → **Sello de mejora**; «Ceniza de forja» → **Ceniza rúnica**. La categoría `forja` se muestra como «Mejora». Textos de es/en actualizados («cristales de mejora», «Su cristal favorito»…); los recortes de nombre aceptan `^(Piedra|Cristal) (de |del )?`.
- **Revisión de código** (tsc `--checkJs` sobre todo `js/`):
  - `todo.craft` estaba dos veces en el mismo objeto: el botón «Fabricar» del aviso de objetivos mostraba «Puedes fabricar {n} recetas». Ahora el botón usa `todo.craftCta`.
  - `battle.effStrong` / `effWeak` duplicados (se quedaba el último); quitado el primero (sin cambio visible).
  - `CAT_ICON.wings` duplicado en `looks.js`.
  - `DK.runes.forge` / `cannotForge` normalizan el id (`norm`: 'oro:1' → 'oro') para no crear entradas fantasma en el inventario de runas.

### Cambios de la v4.90 — Banco de Mejora único (equipo y runas), runas legendarias y planificador alineado

- **Mejorar** (antes «Forja»; Crafteo → Mejorar): un solo banco con selector **Equipo / Runas** (`params.fkind`, `.ub-kind`); según lo elegido salen las piedras del equipo (`V.forgeBench`) o los reactivos de runas (`V.runeBench`). La pestaña «Runas» y **Fundir** desaparecen (`tab: 'runes'` lleva a Mejorar → Runas; `DK.runes.fuse` se conserva sólo por compatibilidad). Textos renombrados: «Mejorar», «Ir a Mejorar», «Las mejoras se hacen en casa»…
- **Runas**: reactivos agrupados (Rareza · Tier · Volver a tirar · Un modificador) y dos nuevos:
  - **Glifo de ascenso** (`glifo_ascenso`, op `tier`): sube I → II → III (hasta el tier del Taller) por monedas (`tierCost` = 500 / 2000); los valores suben en proporción. Sale en élites (4%), jefes (30%) y exploraciones de zonas de nivel ≥ 13 (`findRates.glyph`).
  - **Corazón rúnico** (`corazon_runico`, op `legend`): rara → **LEGENDARIA** (`rarity 'l'`, `runes.rarities.l`: 3–4 modificadores, valores × 1,3 con `range(k, tier, rr)`, +1 emblema por jefe en `emblemBonus`). Jefes (3%) y exploraciones de zonas ≥ 50 (`findRates.heart`). Gema con halo naranja (`rr-l`).
  - Los reactivos de runas no caen en combate sin el Taller de runas (`battleDrops`).
- **Planificador de exploraciones**: rejilla por áreas (`zones who / picker / zone sum`): la ficha de la zona y el riesgo empiezan a la misma altura; en el móvil, zonas → ficha → quién → selector → resumen.
- **Elegir daskai**: selector a lo ancho con **buscador** (nombre, especie, casa o nivel), Todos/Equipo/Cajas, orden (nivel, nombre, casa) y **páginas** (16 en escritorio, 9 en el móvil) (`params.wq`, `wsort`, `wpage`).
- Tests: `gear.test.js` (tier, legendaria y banco único).

### Cambios de la v4.89 — Botín propio por zona, exploraciones más peligrosas, forja de runas y resistencias a casas

- **Botín propio de cada zona** (`config.explore.finds` + `findRates`; `DK.explore.finds(zona)`, `magicChance(lv)`; en `zoneLoot(...).own`):
  - Cada zona tiene un **reactivo de runas** que sólo sale explorándola (≈0,5 / 1,1 / 2,6 por viaje; sólo con el Taller de runas): Pradera → tiza rúnica, Bosque → savia antigua, Costa → perla rúnica, Cavernas → cuarzo del eco, Volcán → ceniza de forja, Templo → tinta sagrada, Abismo → tinta abisal, Cumbre → escarcha celeste, Vacío → polvo del vacío (objetos nuevos, categoría `forja`, `noShop`).
  - Su **piedra favorita** (40% de las piedras que salen), sus **tipos de equipo** (70% del equipo; más mágico cuanto más alta la zona: `loot.magic + lv × magicPerLv`), un **hallazgo raro** (un tónico distinto por zona) y, en zonas de nivel ≥ 13, a veces **una runa**.
  - Diario: `explore.log.reagent` / `rune`. La ventana «Ver todo» abre con la sección «Sólo en esta zona».
- **Riesgo nuevo** (`riskInfo(ds, zona, dur)` → `{ risk, disaster, gap, parts }`; `risk()` sigue devolviendo el número):
  - `base 30% + 3% × niveles por debajo de la zona (−3% por encima)`, después × casa de la zona 0,75 · × 1,15 por cada uno débil contra la casa de la zona · × tamaño (solo 1,3 / dos 1,1 / tres 1) · × Firme 0,8 · × duración (0,8 / 1 / 1,3) · × (1 − Puesto); entre 8% y 92%.
  - **Tres desenlaces**: bien · agotados (mitad de botín y experiencia; fatiga 60/120/240 min) · **desastre** (parte del riesgo: 30% + 4% por nivel por debajo, hasta 70%): pierden TODO el botín (monedas, objetos, equipo, runas), traen el 20% de la experiencia y descansan el doble. `rep.outcome`, `rep.lost`.
- **Pantalla de exploraciones rediseñada** (`screens/training.js`): cabecera limpia (sin «Grupos» ni raciones; las raciones van en el coste y los grupos en «En camino N/M»), grupos en tarjetas compactas, planificador en dos columnas: **zonas en mosaico** (escala a muchas zonas: icono, nombre, nivel con punto de dificultad para tu grupo y el reactivo de la zona) + **ficha de la zona** (casa, descripción, «Sólo en esta zona», materiales); a la derecha quién va, **duración en píldoras discretas**, riesgo con barra doble (agotados / desastre) y «¿Cómo se calcula?» con el desglose, coste, experiencia y botín.
- **Forja de runas** (Crafteo → Runas → **Forjar** / Fundir; `components/runeBench.js`, `DK.runes.forge(id, reactivo, { mod, kind })`, `cannotForge`, `slotsOf`, `kindOf`, `range`, `rollMod`, `modSum`):
  - Los modificadores de runa son ahora **prefijos (mapa)**: élites, tesoros, reclutas, cuevas, **mercaderes**, **santuarios**; y **sufijos (recompensas)**: monedas, experiencia, variocolor, **+% reliquias en cofres**, **+% runas**, **+% piedras de forja**. Mágica 1–2 (1P + 1S), rara 2–4 (2P + 2S) (`runes.rarities`).
  - Reactivos (`runes.reagents`): normal → mágica, re-tirar mágica, añadir (eliges P/S), cambiar uno, mágica → rara, re-tirar valores, re-tirar rara, uno al máximo, quitar uno. Sólo runas sin engastar y fuera de expedición; las ids antiguas siguen valiendo.
- **Resistencias a casas** (`data/gear.js`: `p_res_<casa>` y `s_res_<casa>`, fx `res_<casa>`, tope 50% por casa; en `battle.factors` se suman a `dmgDown` según la casa del ataque):
  - Cuántas caben por tipo (`resMax`): **anillos hasta 3**, escudos/corazas/capas 2, yelmos/amuletos/botas/coronas 1, armas de ataque ninguna. Las **dagas sólo la de su casa** (`resHouse`: colmillo umbrío → Luz, colmillo vampírico → Oscuridad). Nunca dos de la misma casa (`resBlocked`), pesan ×0,45 al tirar y no salen en piezas normales.
- Tests: `gear.test.js` (reglas de resistencias, daño reducido, forja de runas y su pantalla) y `shop.test.js` (desastre y reactivo de zona; selectores nuevos del planificador).

### Cambios de la v4.88 — Música nueva por situación, mapa animado en el campamento y planificador más limpio

- **Música (`systems/audio.js`)**, todo sintetizado como antes:
  - Pistas nuevas: `title` (menú principal: misterio, campanas, coro grave y susurros), `mystery` (sucesos y santuarios de la expedición), `elite` (pulso tenso y metales), `danger` (latido y ostinato cuando tu daskai tiene < 30% de vida) y `boss_rage` (jefe por debajo del 35%).
  - **Variante de combate** de cada zona: `'<escena>:fight'` (`trackOf`): la misma pista un 22% más rápida, con percusión `drive`, más densa y con ostinato.
  - **Las pistas evolucionan** por secciones de 8 compases: A · B (progresión rotada y melodía una octava arriba) · C (calma: menos notas, sin percusión salvo guerra/latido) · D (rotada y más densa).
  - Instrumentos y percusiones nuevos: coro (`choir`), ostinato (`pulse`), lead `pulse`, percusión `drive` y `heart`.
  - Quién elige: `mainMenu` → `title`; `battle` → `battleTrack(st, p)` (zona `:fight`, `elite`, `boss`/`boss_secret`, y en cada actualización de estado `danger` o `boss_rage`); `expedition` → `expTrack()` (`mystery` en sucesos y santuarios sin resolver, si no la de la zona). `DK.audio.current()` y `DK.audio.has(name)` para las pruebas.
- **Campamento**: las Exploraciones son ahora un **mapa de pergamino sobre un atril** (8 fotogramas, `--dur` 3,2 s): un explorador dorado recorre el camino discontinuo hasta la X roja, que late al llegar; mar con olas, montañas, bosquecillo y rosa de los vientos.
- **Planificador**: las zonas son una lista de verdad (un bloque con filas separadas por líneas y la elegida marcada con una barra de su color). Mientras planificas ya no salen debajo los huecos «Mandar un grupo» ni los bloqueados (sólo los grupos que están fuera).
- Test nuevo en `shell.test.js` (pistas, combate normal con variante de zona y latido con poca vida, menú principal).

### Cambios de la v4.87 — Exploraciones, fase 2: encargos, alijos, lista de botín y planificador más cómodo

- **Raciones de viaje**: 6 de regalo al desbloquear las exploraciones (`takeGift`, también a partidas que ya las tenían), caen en combates (`G.drops`: 8% en peleas, 30% en élites), se fabrican (1 fibra + 1 gota → 2), las vende el mercader (20), las traen los exploradores y son premio de los encargos. La descripción del objeto lo explica.
- **Encargos del día** (`requests()`, `requestText`, `requestReward`, `checkRequests`, `claimRequest`; `state.training.req`): 2 al día (3 con el puesto a nivel 2), elegidos con la fecha como semilla: explorar una zona, una exploración larga, ir con un daskai de cierta casa, traer 8+ objetos de una vez, volver sin agotarse de la zona más alta. Se cumplen al recoger y se cobran en la tarjeta «Encargos de hoy» (monedas, raciones, fragmentos y a veces una piedra).
- **Alijo del explorador** (hallazgo exclusivo, `loot.cache` 1% / 3% / 8% × Sabia): 2 piedras (30% de que una sea rara: regia, caos, templado o sello), 3 fragmentos y 2 raciones. Sale en el diario y en el informe.
- **Lo que puede salir** (`zoneLoot(zona, dur, uids)`): objetos de la zona con la probabilidad de traer al menos uno según las tiradas, fragmentos, monedas (rango), raciones, piedra común, equipo y alijo, y un total aproximado (`total`). En el planificador: «Traerán unos N objetos» y el enlace «Ver todo lo que puede salir» (ventana con todo).
- **Planificador**: las zonas son una **lista** (fila con radio, icono, nombre, punto de su casa, 4 objetos y nivel; con scroll si hay muchas). Los elegidos se ven arriba como fichas que se quitan con un toque, y la **lista de daskai se pliega** («Elegir daskai (N)» / «Ocultar lista»): abierta si no hay nadie, se cierra sola al completar el grupo.
- **Campamento**: el muñeco de entrenamiento pasa a ser un **poste de caminos** con tres carteles, banderín que ondea, mochila y saco de dormir (`campArt.js`, `dummy`).
- Test de exploraciones ampliado (lista de botín, lista plegable, encargos y regalo).

### Cambios de la v4.86 — Exploraciones (sustituyen al campo de entrenamiento)

- **`systems/training.js` reescrito** (`DK.training`, alias `DK.explore`; se mantienen la ruta `training`, la clave de desbloqueo y `state.training`). Se manda un **grupo de 1-3 daskai** a una zona desbloqueada con una **duración** (corta 30 min / media 2 h / larga 8 h). Al volver (`collect(id, rnd)`) traen experiencia y botín de esa zona: materiales de sus salvajes (`zoneMats`, por peso de aparición y de botín), fragmentos de forja, monedas, a veces una ración, una piedra común (`loot.stones`) o equipo normal/mágico al nivel de la zona (nunca raro). Devuelve un informe con **diario** (`explore.log.*`).
- **Coste al salir**: monedas (`config.explore.coins(nivelZona, k, n)`) + **raciones de viaje** (`racion_viaje`, nueva, categoría pieza: receta 1 fibra + 1 gota → 2; tienda 20; también la vende el mercader y a veces la traen).
- **Riesgo** (`risk(ds, zona, dur)`): base 18% − 3,5% por nivel medio de diferencia con la zona, ×0,7 si alguno es de la **casa de la zona** (la más común entre sus salvajes), ×0,75 por cada Firme, Valiente cuenta +3 niveles, × la duración y −% del puesto; entre 3% y 80%. Si sale mal vuelven **agotados**: la mitad de botín y experiencia y `d.tired` (no pueden ir de expedición —`DK.party.canJoin`— ni de exploración durante `fatigue` minutos; Serena la mitad).
- **Naturalezas** (`config.explore.natures`): Feroz +20% exp, Astuta +1 material, Sabia +35% de algo raro, Firme menos riesgo, Valiente +3 niveles para el riesgo, Serena se cansa la mitad, Tranquila +25% monedas, Impetuosa viaje 12% más corto, Equilibrada +5% exp y monedas.
- **Experiencia**: `expCurve(nivel) × 0,24 × k`, menos si va más de 4 niveles por encima de la zona.
- **Puesto de exploradores** (`config.explore.post`, antes Instructor; mismos precios en emblemas y monedas): grupos extra, +% botín y experiencia, −% coste y −% riesgo.
- **Partidas antiguas**: los que estaban entrenando vuelven solos con la experiencia que llevaban ganada (sin cobrar) y se avisa al abrir la pantalla (`takeLegacy`).
- **Pantalla** (`screens/training.js`): grupos fuera con barra de tiempo, «Ver qué traen» (informe en ventana con diario, botín y experiencia) y «Hacerlos volver» (sin nada); planificador con zona (nivel y casa), duración, quién va (fichas con el bonus de su naturaleza), y resumen (riesgo con barra y color, coste, experiencia de cada uno, botín posible) y últimas exploraciones. Icono `compass` en vez de `dumbbell`; insignia «Agotado» en las fichas.
- Test nuevo en `shop.test.js` (sustituye al del entrenamiento). Arreglado un test de la estrella de ascensión que fallaba a veces por redondeo.

### Publicar en itch.io

- `crear-zip-itch.bat` (Windows, usa `tools/zip-itch.ps1`) o `crear-zip-itch.sh` (Linux/Mac, Python 3) crean `dist/daskai-itch-vX.Y.Z.zip` con la versión de `package.json`.
- El zip lleva sólo `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/` e `icons/` en la raíz (sin `tests/`, `tools/`, `docs/`, `data/*.json` ni `node_modules/`). Las rutas van con «/» (por eso no se usa `Compress-Archive`, que en Windows PowerShell 5 mete «\» y rompe el juego en itch.io).
- En itch.io: *Kind of project* = HTML, subir el zip y marcar «This file will be played in the browser». `dist/` está en `.gitignore`.

### Cambios de la v4.85 — Normal frente a mágico, piedras más raras, vista previa compacta y calidad explicada

- **Normal ≠ mágico** (`G.rarities`): los normales llevan `basicOnly` (sólo los 16 afijos de `G.basicAffixes`, sin exclusivo), `maxTier: 2` y `power: 0.85` (atributos más bajos); los mágicos, todo el pool de su tipo y `maxTier: 4`; raros y legendarios, hasta N5. `allowedAffixes(base, rarity)`, `maxTierOf(p)` (rareza + nivel de objeto) se usan en `rollAffix`, `rollTier(ilvl, rnd, cap)`, `affixPool`, `tierChances` y `quality`; el templado avisa (`gear.why.rarityTier`) si la rareza no deja subir más.
- **Fabricar mágico** cuesta ahora 12 fragmentos por pieza (`DK.gear.magicCost`).
- **Piedras más raras**: todas las probabilidades de piedras de `G.drops` bajan (peleas ×0,18, élites ×0,24, jefes ×0,42 respecto a la v4.84); los fragmentos no cambian. Unas 2 piedras por expedición de media (antes 6-7). El mercader ofrece 1-2 piedras comunes y la rara con un 20%.
- **Vista previa al fabricar** (`gearPreview(base, rarity)` en `craft.js`): cambia con «Normal / Mágico». Principal con su rango real a su nivel, atributos extra en rejilla de celdas iguales, afijos en dos columnas (prefijos / sufijos) de una línea con el texto entero en el tooltip y los rangos limitados al tier de esa rareza. Sin la línea de pasiva legendaria (lo fabricado no llega a legendario).
- **Calidad**: el tooltip explica qué mide, por qué importa y un consejo según la nota (`gear.qualityAdvice.S…D`).
- **Icono del título de Crafteo**: `forgeRune` (antes `craftCog`), también en la hoja del móvil.

### Cambios de la v4.84 — Forja: confirmar con vista previa, calidad, bloqueo, tirar hasta conseguirlo, desguace en lote, fabricar mágico y equilibrio

- **Confirmar con vista previa**: toda acción de la forja (piedras, añadir afijo, barra del afijo, núcleo) pasa por `ask()` y deja la piedra «armada» (`params.farm`). Se ve un panel fijo (`.fb-confirm`) con lo que hará, lo que puede salir con su probabilidad y Cancelar/Confirmar; en la ficha se resaltan con borde discontinuo las filas que van a cambiar (`gearTip({ will })`). `DK.gear.forgePreview(p, stone, o)` → `{ keys, lines, odds }`. Ajuste `confirmForge` (Ajustes y casilla «No volver a preguntar»).
- **Calidad** `DK.gear.quality(p)` → `{ score 0–100, grade S/A/B/C/D }`: atributos (el principal ×2) y afijos (su tier frente al mejor posible a su nivel ×0.7 + su valor ×0.3). `V.gearQuality(p, { small })` en la ficha y en el selector; orden por calidad.
- **Bloquear** (`p.lk`, `DK.gear.toggleLock`): no se puede desguazar (ni sola ni en lote). Botón en la forja y en la ficha del inventario; candado en la lista.
- **Tirar hasta conseguirlo**: en «Afijos que pueden salir» cada afijo tiene una diana para marcarlo (`params.fwant`); el recuadro `.fb-until` elige cuántas piedras como mucho y tira alteración (mágicas) o caos (raras) hasta que sale uno (`DK.gear.rollUntil(uid, ids, max)`, `rerollerFor(p)`).
- **Desguace en lote** (botón del martillo en la barra del selector): ventana con rarezas (normal y mágico marcadas; raro opcional), sólo piezas sueltas y sin bloquear, con el total de fragmentos (`DK.gear.salvageMany(rarities)`).
- **Fabricar equipo normal o mágico** (nunca raro): en Crafteo → Equipo se elige «Normal / Mágico»; mágico cuesta `DK.gear.magicCost` (4) fragmentos de forja por pieza (`DK.crafting.craft(r, times, { magic })`, `runPlan(plan, o)`). Las piezas fabricadas llevan `cf: 1` y no pueden pasar a rara (alquimia, regia y corazón de jefe lo rechazan). Los raros salen sólo de las expediciones. Los fragmentos sirven para piedras y para el equipo mágico.
- **Forja**: fuera el título «Piedras» y la frase de consejo de la columna de piedras.
- **Equilibrio** (unas 7 peleas, 1,6 élites y 1 jefe por expedición): fragmentos en peleas 0,3 → 0,5 y en élites 0,8 → 1 + 0,5 (≈ 7 por expedición sin contar el desguace); caos 0,015 → 0,03 (peleas) y 0,07 → 0,12 (élites); exaltación en élites 0,015 → 0,03; divina 0,006 → 0,01, templado y sello 0,004 → 0,008 en peleas; corazón de jefe 0,03 → 0,05. Recetas: caos 8 fragmentos + 1 esencia + 1 obsidiana (antes 10 + 2 + 1); exaltación 20 fragmentos + 1 lágrima (antes 30 + 2).
- Test nuevo en `gear.test.js` (escritorio y móvil) para todo lo anterior; los de la forja anteriores desactivan la confirmación.

### Cambios de la v4.83 — Recetas que faltaban y filtros de la forja más modernos

- **Recetas nuevas** (`recipes.js`): `hiperpocion` (2 superpociones + núcleo arcano), `supereter` (3 éteres + polvo brillante + piedra rúnica) y `pluma_fenix` (6 plumas + 4 brasas + lágrima estelar). Ya salen en Crafteo → Consumibles. El `fragmento_abisal` sigue siendo sólo botín del final del juego.
- **Forja, selector**: sin título «Tus piezas» ni aviso «Elige una pieza para empezar». Arriba, una barra (`.fp-bar`): buscador en píldora con el número de piezas en el placeholder (`gear.bench.searchN`) y «x/y» cuando hay filtros, segmento Todas/Sueltas/Equipadas y botón de orden que va rotando (rareza → nivel → nombre). Debajo, una sola tira de píldoras (`.fp-chips`, se desliza en horizontal): rarezas con su nombre y número, separador, atributos principales con su icono y «Limpiar». En la columna estrecha (con pieza elegida) las rarezas son sólo el punto de color, la tira se parte en líneas y el orden es sólo el icono.
- Test: el de la forja v4.79 comprueba que ya no está el aviso y sí el buscador nuevo.

### Cambios de la v4.82 — Icono de runa para Crafteo y diez afijos más

- **Icono de Crafteo**: nuevo `forgeRune` en `icons.js` (gema hexagonal, como las piedras de forja, con una runa de doble flecha). Sustituye al yelmo, que se confundía con la mochila del Inventario.
- **Los atributos se quedan como atributos** (no se pasan a afijos): son la base de la pieza (el principal con su rango y la piedra de núcleo, la divina, `attrValue` según rareza y nivel), y convertirlos rompería el equilibrio y las partidas guardadas.
- **10 afijos nuevos** (47 en total), repartidos entre familias (`G.affixPools`):
  - Prefijos: `p_fast` (+% daño si eres más rápido: `fastDmg`), `p_brave` (rival de más nivel: `underdog`), `p_sure` (+ precisión: `acc`, se suma a `m.acc/100`), `p_weak` (+% al punto débil: `weakDmg`, multiplica junto a `wk`), `p_fresh` (rival con la vida llena: `freshDmg`).
  - Sufijos: `s_critRes` (resta a la prob. de crítico del rival), `s_critGuard` (-% daño de los críticos recibidos, en `damage`), `s_lastGuard` (-% daño recibido con < 50% vida, en `dmgDown`), `s_gold` y `s_exp` (+% monedas / experiencia del combate, en `rewards` con el equipo del daskai que luchó).
  - Topes nuevos en `G.caps` (p. ej. `acc` 0.3, `critRes` 0.3, `critGuard` 0.4).
- Test: el de afijos pide ≥ 47 y comprueba monedas, experiencia, precisión y resistencia a críticos.

### Cambios de la v4.81 — Más afijos, un exclusivo por tipo de objeto y sus efectos en combate

- **37 afijos** (antes 16). Nuevos compartidos (`data/gear.js`): `p_phys` (+% daño físico), `p_mag` (+% daño mágico), `p_pierce` (ignora % de defensa), `p_full` (+% daño con la vida llena), `s_vigor` (% vida), `s_swift` (% velocidad), `s_heal` (+% curación).
- **Familias más grandes y menos solapadas** (`G.affixPools`): 6-7 prefijos y 6 sufijos por atributo principal (antes 4 + 4). Son superconjuntos de las de la v4.78, así que las piezas viejas no cambian.
- **Exclusivo de cada tipo** (`G.typeAffix`, afijos con `only`): garra `s_execute` (rival < 35% vida), daga `p_toxic` (rival con estado), martillo `p_crush` (+% ruptura), espada `p_kin` (ataques de su casa), báculo `s_wisdom` (-% maná), orbe `p_surge` (golpes eficaces), escudo `s_endure` (aguanta un golpe mortal con 1 PV, una vez por combate), coraza `p_plate` (-% daño físico), capa `p_veil` (-% daño mágico), amuleto `s_ward` (evita estados), yelmo `s_rage` (< 50% vida), botas `p_ambush` (primer golpe del combate), anillo `s_feast` (cura al derrotar), corona `p_regal` (jefes y élites). `allowedAffixes(base)` = familia + exclusivo de su tipo; el exclusivo pesa el doble al tirar (`affixWeight`).
- **Combate (`battle.js`)**: `factors` suma los +% de daño condicionales (`dmgUp`) y los -% recibidos (`guard` + `guardPhys`/`guardMag`, tope 80%), y la defensa se multiplica por `1 - pierce`. `breakGain` × (1 + `breakPow`); `mpCost` resta `mpCost` (tope 70% con reliquias); curas × (1 + `healBoost`); `statusRes` puede evitar el estado; `endure` (`st.endured[uid]`), `opener` (`st.opened[side]`) y `killHeal` en `doMove`. Topes nuevos en `G.caps`. Textos de combate: `battle.endure`, `battle.feast`, `battle.warded`.
- **UI**: los exclusivos llevan estrella dorada y texto en oro (ficha, forja, «Afijos que pueden salir» y vista previa de Crafteo), con el tooltip «Exclusivo de {tipo}».
- Test nuevo en `gear.test.js`: cada tipo tiene su exclusivo y ninguno ajeno, al menos 6+6 afijos por base, textos, y efectos (perforar, daño físico/mágico, ruptura, maná).

### Cambios de la v4.80 — Códice pixel art con lomo, piedra de núcleo y forja más legible

- **Códice**: vuelve a ser pixel art por fotogramas como la hoguera (`campArt.js`, `lectern`, 12 fotogramas, `--dur: 3.6s` en motion.css). El libro se ve un poco desde delante: canto de las hojas, tapas con esquinas doradas y el **lomo** redondeado con dos nervios dorados asomando por debajo. Fotogramas 0-6: reposo (la runa de la ilustración late); 7-11: una hoja se levanta desde el lomo (proyección: el borde exterior sube `t·L·K·sin θ`), se pone de canto y cae a la izquierda. Se quitan el vaivén y la hoja 3D por CSS (`codex-float`, `codex-page`, `codex-shadow`); quedan un halo que late a pasos y las chispas.
- **Piedra de núcleo** (`piedra_nucleo`, nueva, rara): vuelve a tirar SÓLO el valor del atributo principal dentro de su rango (puede subir o bajar). Receta: 4 fragmentos + polvo brillante + pelaje; tienda 140; mercaderes y botín de combates y élites. Grupo «Volver a tirar». `DK.gear.attrRange(p, a)` → [mín, máx] a su rareza y nivel.
- **`V.gearTip`**: el atributo principal enseña su rango «(35–59)» y la opción `onMain(a)` pinta un botón en su fila (en la forja: gema de núcleo y cuántas tienes).
- **Forja**: el «último cambio» (cómo estaba antes) ya no va bajo la ficha: es un enlace discreto «Último cambio: X» junto a «Historial (n)» al pie (`params.flast`; se abre uno u otro). Selector con iconos y textos más grandes (filas de 48 px, iconos de 30 px, chips de 30 px).
- Tests: el caso de la forja v4.79 comprueba también el enlace del último cambio y la piedra de núcleo (sólo cambia el principal, dentro de su rango).

### Cambios de la v4.79 — Códice por CSS, icono de yelmo y forja rediseñada

- **Códice del campamento**: el atril (`campArt.js`, `lectern`) es ahora un único fotograma estático (libro abierto) y toda la animación va en CSS (`grim.css`, bloque v4.79): `.codex-float` flota (`codexBob`), `.codex-page` pasa la página en 3D (`codexPage`, rotateY 0 → -180), `.codex-halo` y `.codex-shadow` respiran y las chispas salen del libro. Más pequeño (xs 16 / x 10 en `camp.js`) para que no se salga en el móvil. Respeta el movimiento reducido.
- **Icono de Crafteo**: nuevo icono `helm` (yelmo) en `icons.js`; la barra de acceso rápido lo usa en vez del engranaje.
- **Piedra de cambio** (`piedra_cambio`, nueva, rara): cambia SÓLO el afijo elegido por otro distinto del mismo tipo. Se fabrica (5 fragmentos + gota + polvo brillante), la vende la tienda (160) y los mercaderes, y cae en combates y élites. La **esquirla de jefe** ahora nunca baja el nivel (tier) del afijo.
- **Añadir prefijo o sufijo a elección**: `DK.gear.forge(uid, 'piedra_aumento'|'piedra_exaltacion', { kind: 'prefix'|'suffix' })`; `hasRoom(p, kind)` comprueba el hueco de ese tipo y `adderFor(p)` dice qué piedra añade en esa rareza. Sin `kind` sigue siendo al azar.
- **`V.gearTip`**: opciones nuevas `addSlot(kind, libres)` (fila de hueco libre «+ Añadir prefijo/sufijo» con la piedra y cuántas tienes) y `selBar` (nodo que se pinta bajo el afijo elegido).
- **Forja (`forgeBench.js`)**:
  - Al entrar NO hay pieza elegida: se ve el selector a todo el ancho (cuadrícula) con un aviso «Elige una pieza para empezar». Pulsar la pieza elegida otra vez la suelta.
  - Selector compacto (`.fp-row`, una línea por pieza: icono, nombre en color de rareza, atributo principal · tipo · nivel, huecos P/S en puntitos y quién la lleva). Filtros: rareza (puntos de color con su número), atributo principal (icono con número), Todas/Sueltas/Equipadas, buscador (nombre, base o tipo) y orden (rareza, nivel, nombre). Cada contador tiene en cuenta los demás filtros. Params: `fgr`, `fst`, `floc`, `fq`, `fsort`.
  - En el móvil, con pieza elegida, el selector se cambia por un botón «Cambiar de pieza».
  - Al elegir un afijo aparece debajo una barra (`.fa-bar`) con Cambiar / Esquirla (si tienes) / Templar / Sellar, con su cantidad y el motivo si no se puede.
  - Historial oculto: sólo un enlace discreto «Historial (n)» al pie (`params.fhist`).
- Tests: `gear.test.js` cubre la barra de acciones, el historial oculto y un caso nuevo (sin pieza al entrar, filtro por atributo, añadir sufijo/prefijo elegido y cambiar un solo afijo). 107 tests.

### Cambios de la v4.78 — Campamento más vivo, códice-libro, atributo principal del equipo y Crafteo por secciones

- **Campamento** (`components/camp.js`, `components/campArt.js`, `css/grim.css` y `css/motion.css`):
  - **Códice**: ya sólo es un grimorio que flota y pasa página (`lectern`, 16 fotogramas en lugar de 8, `base` 34).
    - Tiene tapas de cuero con cantoneras doradas y una ilustración que late.
    - La hoja se levanta desde el lomo, se curva al pasar y enseña el dorso.
    - Lleva un marcapáginas que se mece, motas de luz y runas que suben, y la sombra encoge al subir el libro.
    - Encima, `.codex-sparks` añade 10 chispas violetas y doradas y runas en CSS. Hay fotogramas `n16` y el brillo es `codexFloatGlow` (el `lecternGlow` antiguo de motion.css ya no está).
  - **Ambiente**:
    - `.camp-firelight`: luz de la hoguera en el suelo que parpadea de forma irregular (mezcla screen).
    - `.camp-motes`: 14 motas de polvo que flotan despacio.
    - Los daskai respiran (`monBreath`: suben y se estiran un poco) y se paran al pasar el ratón.
    - Las ascuas suben meciéndose.
  - Todo se apaga con «Reducir animaciones».
- **El equipo ya no da ataques ni pasivas**:
  - Se quitó `grants` de las 17 bases que lo tenían (9 ataques y 8 pasivas). Sólo dan atributos, prefijos y sufijos, y la pasiva legendaria si llegan a legendarias.
- **Atributo principal** (`data/gear.js → primary`, `primaryBoost` 1,3):
  - Cada tipo tiene uno y toda pieza lo lleva siempre, el primero y más fuerte:
    - garras, dagas y martillos → ataque;
    - espadas, báculos y orbes → ataque mágico;
    - escudos y corazas → defensa;
    - capas y amuletos → defensa mágica;
    - yelmos → vida; botas → velocidad; anillos y coronas → maná.
  - `DK.gear.primaryOf(base)` lo da. `poolOf` lo pone el primero, `fillAttrs` lo añade si falta y `attrValue` lo multiplica. La ficha lo destaca (`.gt-attr.main`, con estrella).
- **Afijos por familia** (`data/gear.js → affixPools`):
  - Cada atributo principal tiene 4 prefijos y 4 sufijos propios (las dagas, p. ej.: ataque, daño, velocidad y vida; crítico, daño crítico, robo de vida y esquiva).
  - `DK.gear.allowedAffixes(base)`; `rollAffix` y `affixPool` sólo usan esos.
- **Partidas antiguas**: `DK.gear.migrate2` (`gearV` 2) pone el principal el primero (o lo añade, quitando el último si no cabe) y cambia los afijos que no le tocan por otro del mismo tipo de su familia, con el mismo tier y tirada.
- **Crafteo por secciones**:
  - La lista sale agrupada con títulos y los filtros son las secciones (`secOf`, `SEC_ORDER`).
  - **Equipo** va por atributo principal (`stat:<atributo>`), con los tipos debajo del título («Ataque físico · Garras · Dagas · Martillos»).
  - **Consumibles** van por lo que hacen (`use:<qué>`): curar, maná, estados, vínculo, experiencia, tónicos, especiales y forja (`craft.sec`/`secSub`).
  - Cada ficha dice qué hace (`.wb-does` → `V.itemDoes`).
  - El detalle de equipo (`gearPreview`) enseña el principal («siempre»), los atributos que puede tener además y los prefijos y sufijos posibles con su rango, de N1 a N5.
- **Qué hace cada objeto, en todas partes** (`components/itemViews.js`):
  - `V.itemDoes(it)` da en pocas palabras el efecto de uso, el de la piedra, el principal del equipo o «material».
  - `V.itemTipText(it)` → «Poción · Cura 30 PV».
  - Todo `V.itemIcon` lleva ese tooltip (salvo `{ tip: false }`), y las piezas el suyo: nombre y atributos. En el inventario, las piedras dicen lo que hacen.
- **Tests**: nuevo «Cada pieza lleva su atributo principal y sólo afijos de su familia; ningún objeto da ataques ni pasivas», que también arregla una pieza antigua.

### Cambios de la v4.77 — Los 6 junto a la hoguera y fondo que cambia de color

- **Hoguera del campamento** (`components/camp.js`): sólo había sitio para 5 daskai en escritorio y 4 en el móvil, así que con 6 en el equipo faltaban. Ahora `offs` tiene 6 sitios en los dos (dos filas a cada lado del fuego y dos delante), y los sprites son un poco más pequeños (92 px y 58 px en el móvil).
- **Fondo animado** (`core/bgfx.js`): cada `HUE_EVERY` (150 s) el tono de los dos colores vivos (`--bgfx-a` y `--bgfx-b`) gira hacia el siguiente de `HUES` en `HUE_FADE` (45 s), con una transición suave (smoothstep). Se hace con una matriz de giro de tono en RGB. El color oscuro de fondo no cambia, y con «Reducir animaciones» no gira.

### Cambios de la v4.76 — Iconos de equipo y piedras, nombres propios, forja compacta y Equipo por tipo

- **Tipos de objeto** (`data/gear.js`):
  - `G.typeOf` da el tipo de cada base. Hay 14: garra, daga, espada, martillo, báculo, orbe, escudo, coraza, yelmo, capa, botas, anillo, amuleto y corona.
  - `G.types` da su icono. Hay tres iconos nuevos en `core/icons.js`: `helmet`, `boots` y `staff`.
  - El `icon` de cada base en `items.json` es ya el de su tipo.
  - `DK.gear.type(p|base)` y `typeName(p, many)` dan el tipo y su nombre; los textos están en `gear.type.<tipo>.one/many`.
- **Nombres propios**:
  - Cada pieza guarda `nn`, una semilla. `DK.gear.properName(p)` junta sílabas de `G.syl`; las piezas antiguas usan un hash de su uid.
  - Normal: `gear.normalName` → «Daga de Velmir». Mágica: tipo + prefijo + sufijo («Botas veloz del zorro»). Rara: dos palabras. Legendaria: su pasiva.
  - La base (p. ej. «Colmillo umbrío») sale como subtítulo: «Daga · Colmillo umbrío».
- **Iconos** (`components/itemViews.js`):
  - Las piedras de forja (categoría `forja`) son una gema **hexagonal** oscura con su runa brillante dentro (`STONE_RUNE`), como las runas de la preparación de expediciones. Se ven así en todas partes.
  - `V.gearIcon(p, size)` es el icono del tipo con el aro del color de la rareza de la pieza y tamaño fijo en px; `V.itemIcon` acepta `{ ring }`. Lo usan la cuadrícula, la ficha, «Equipar en…» y el botín.
  - El equipo ya no lleva el aro de rareza de la base.
- **«Equipar en…»**: los iconos de lo equipado ya no se salen de su casilla (`.ep-mini` de 28 px con el icono a 22).
- **Forja más compacta**: cada piedra es una fila (`.fs-row`) con la gema, el nombre corto («Transmutación»), su efecto, cuántas tienes y, en el tooltip, el motivo si no se puede usar. Ocupa una columna en escritorio, una cuadrícula en pantallas medias y 2 columnas en el móvil.
- **Crafteo → Equipo** (icono de espada):
  - Los filtros son por **tipo de objeto**, no por «con ataque/pasiva/atributos» (`sub: 'type:<tipo>'`). En «Todo», la lista sale agrupada por tipo, con su icono y título.
  - Las fichas muestran el tipo.
  - El detalle (`gearPreview`) dice qué pieza saldrá: tipo, Normal y nivel ~el de tu equipo, de 1 a 2 atributos (con los posibles), 1 prefijo o sufijo, la pasiva que tendría de legendaria y la escalera de la Forja.
  - La cabecera ya no enseña la rareza antigua de la base, sino el tipo y cuántas tienes.
- **Materiales**: ya no son una pestaña. Hay un enlace discreto «Ver materiales (n)» al final de las listas y, dentro, «Volver a las recetas»; `{ tab: 'materials' }` sigue funcionando. Los filtros de tipo se desplazan en su fila en el móvil.
- **Tests**:
  - La mesa de trabajo cuenta 3 pestañas, comprueba el orden dentro de cada tipo y pulsa «Forjar» con el propio botón (la hoja del móvil se desplaza con suavidad).
  - La Forja usa `.fs-row`.

### Cambios de la v4.75 — Forja en Crafteo, «Equipar en…» y nivel de objeto por origen

- **Nivel de objeto**:
  - `DK.gear.create` añade ±2 al nivel salvo `jitter: false`.
  - En combate, `addLoot(…, { level })` usa el nivel del rival que lo suelta (`battle.rewards` pasa `e.level`).
  - Si no hay rival (sucesos, cofres…) usa `DK.expedition.lootLevel()`: el nivel medio de la zona más `levelBonus()`. Los jefes suman +3.
  - El equipo fabricado usa el nivel de tu equipo (`DK.gear.defaultIlvl()`) ±2. La ficha de la receta lo avisa (`gear.craftNote`) y lleva a la Forja.
- **Piedras nuevas** (items.json, con recetas y precios):
  - `piedra_alquimia`: normal → raro.
  - `piedra_aumento`: añade un afijo a un mágico con hueco.
  - `piedra_exaltacion`: lo mismo para raro y legendario.
  - `piedra_anulacion`: quita uno al azar, nunca el sellado; exige al menos dos.
  - `piedra_templado`: sube un tier el afijo elegido, si el nivel de objeto lo permite.
  - `sello_forja`: sella el afijo elegido (`a.lock`). Sobrevive a la siguiente alteración, caos o anulación y ahí se gasta.
  - `eco_legendario` (sólo jefes): cambia la pasiva de un legendario por otra legendaria (`p.lp`; `passive()` y `name()` la usan).
  - La purga quita sellos y eco.
- **Rarezas de los drops**:
  - El caos sirve también en legendarios.
  - Los legendarios sólo salen de jefes, un 3 %, y el `corazon_jefe`/`eco_legendario` de un jefe tiene un 3 %.
  - `data/gear.js → drops` está rehecho con todas las piedras.
  - El mercader ofrece siempre una piedra común (transmutación, alteración, aumento, purga o fragmentos) y un 35 % de las veces una regia, de alquimia o de anulación. También están en `shopStock`.
- **`DK.gear`**:
  - `groups` agrupa las piedras: rarity, reroll, affix y legend. `stones` las lista todas.
  - `targeted` son las que necesitan `o.affix` (esquirla, templado y sello); `forge` sin afijo devuelve `gear.why.pickAffix`.
  - `slots(p)` da los huecos de prefijo y sufijo y `hasRoom(p)` si cabe otro.
  - `affixPool(p)` da los afijos que pueden salir, con su probabilidad dentro de su tipo y el rango del mejor tier posible. `tierChances(p)` da la probabilidad de cada tier a su nivel.
  - `p.hist` guarda las últimas 12 forjas: piedra, fecha, nombre antes y después, y rareza.
  - Motivos nuevos en `gear.why`: full, tooFew, locked, maxTier, lowIlvl, needLegend y pickAffix.
- **Crafteo → Forja** (`components/forgeBench.js` → `V.forgeBench`; es la pestaña por defecto si tienes piezas; params `fp`, `fsel`, `fgr`, `fq`):
  - Tres columnas:
    - **Tus piezas**: la armería y lo que llevan tus daskai, con filtro de rareza y buscador si hay más de 6.
    - **Mesa**: quién la lleva; la barra de huecos (P y S con casillas llenas y vacías, total y nivel de objeto con su explicación); la carta con afijos **seleccionables** (`V.gearTip(p, { sel, onSelect })`, con candado si está sellado); el afijo elegido; el «Último cambio» con la carta de antes plegada; «Equipar en…»; los afijos posibles (con sus % y las probabilidades de tier) y el historial.
    - **Piedras**: por grupos, con cantidad y motivo si no se puede (las de un afijo piden elegirlo).
  - En el móvil va todo en una columna: las piezas en una tira horizontal y las piedras justo bajo la pieza.
- **«Equipar en…»** (`V.equipPicker(uid)` en `gearViews.js`): una ventana con buscador y secciones «En tu equipo», «Entrenando» (`DK.training.isTraining`) y una por caja (`DK.boxes`, tras `sync()`), plegadas.
  - Cada fila muestra lo que lleva en cada hueco. Al abrirla se ve, por hueco, qué tiene y cómo cambian los atributos, con «Equipar aquí» o «Cambiar».
  - En una expedición sólo sale el equipo. `V.equipChooser` (tras fabricar) ya usa esta ventana.
- **Inventario → Equipamiento**: la ficha de una pieza ya no forja. Tiene «Equipar en…» (la ventana), «Mejorar en la forja» (`craft`, `{ tab: 'forge', fp }`), quién la lleva y desguazar. La barra de piedras pasa a ser un acceso a la Forja con el total de piedras.
- **Tests**:
  - `gear.test.js`: las piedras nuevas y el nivel de objeto; «Equipar en…» con sus secciones (escritorio y móvil); y la Forja (huecos, afijos posibles, el templado pide afijo y se aplica al elegido, historial).
  - La prueba de la mesa de trabajo cuenta 4 pestañas.

### Cambios de la v4.74 — Equipamiento con rareza, afijos y forja (estilo Path of Exile)

**Idea.** El equipo deja de ser un objeto contado de la bolsa: cada unidad es una **pieza** única. Tiene rareza, atributos, prefijos y sufijos, y se mejora en la forja con piedras. Los objetos «equipo» de `items.json` pasan a ser **bases** que dan el icono, el nombre, el pool de atributos, el ataque o pasiva que conceden (`grants`) y la calidad (`rarity` de la base → `gear.baseTier`).

- **Datos** (`js/data/gear.js` → `D.gear`):
  - **`rarities`**: normal, mágico, raro y legendario. Cada una define:
    - cuántos atributos (`attrs`: 1-2, 2-4, 4-5, 4-5) y cuántos afijos (`affixes`: 1, 1-2, 2-4, 2-4);
    - el tope de prefijos y de sufijos (`maxP`/`maxS`);
    - la potencia (`power`), los fragmentos al desguazar (`salvage`) y el peso al salir de un combate (`drop`: fight, elite o boss). Las legendarias sólo salen de jefes, un 10 %.
  - **Atributos**:
    - `units` es el valor base de cada atributo plano. Se escala con el nivel del objeto: `× (1 + ilvl / ilvlScale)`.
    - El pool de cada base son sus atributos positivos más los afines (`affinity`), hasta `poolSize`, que es 6.
    - La regeneración no escala: da de 1 a 3.
  - **Afijos** (`affixes`), 16 en total, cada uno con 5 tiers. Un tier sólo puede salir si el objeto alcanza su nivel (`tiers.ilvl`: 0/10/25/45/65); los altos son menos probables.
    - Prefijos: % a un atributo (`pct`) y % de daño (`p_dmg`).
    - Sufijos: crítico, daño crítico, robo de vida, reducción de daño, esquiva, espinas, maná al golpear y regeneración (`fx`).
    - `caps` limita la suma de los efectos de combate.
  - **`legendary`**: la pasiva exclusiva de cada una de las 34 bases. Se registra en `D.passives` como `leg_<base>` con `legendary: true`, para que no salga en sorteos ni en filtros. Funciona como una pasiva (`mods`, `regen`, `entry`) y suma `fx` como un sufijo.
  - **`drops`**: piedras de forja al ganar combates de expedición (fight, elite y boss).
- **Objetos nuevos** (categoría `forja`):
  - `fragmento_forja` sale al desguazar y sirve para fabricar las demás.
  - Piedras: `piedra_transmutacion` (normal → mágico), `piedra_alteracion` (re-tira los afijos de un mágico), `piedra_regia` (mágico → raro), `piedra_caos` (re-tira los afijos de un raro), `piedra_divina` (re-tira valores) y `piedra_purga` (vuelve a normal).
  - Exclusivas de jefe: `esquirla_jefe` (re-tira **un** afijo elegido, por otro del mismo tipo) y `corazon_jefe` (raro → legendario).
  - Tienen recetas en `recipes.js`, menos las de jefe, y precios en `shop.js`.
- **Sistema** (`js/systems/gear.js` → `DK.gear`):
  - Una pieza tiene esta forma: `{ uid, base, rarity, ilvl, attrs: [{k, r}], affixes: [{id, t, r}], nm, v }`. Los valores se calculan a partir de la tirada `r`, así que subir la rareza mejora los atributos. `nm` da el nombre de las raras y `v` es la versión, que va en la clave de caché.
  - Para crearlas: `create`, o `gain`, que la guarda en `e.loot.gear` dentro de una expedición y en `st.gear` en casa.
  - Para consultarlas: `list`, `home`, `found`, `equipped` y `find(uid)`.
  - Para equiparlas: `equip`, `unequip` y `preview`.
  - Forja: `forge(uid, piedra, { affix })`, que devuelve `before` para resaltar lo que cambió, y `cannotForge`, que da el motivo de por qué no se puede.
  - Desguace: `salvage` y `salvageValue`.
  - Lo que da una pieza: `flat`, `pct`, `fx` y `fxOf(d)`, este último con los topes aplicados. `passive` da su pasiva y `name` su nombre: mágica = base + prefijo + sufijo; rara = dos palabras de `gear.rareA`/`rareB`; legendaria = el nombre de su pasiva.
  - `migrate(s)` convierte las partidas antiguas: común/raro → normal, épico → mágico, legendario → raro. Cubre la bolsa, `d.equip`, la mochila y el botín de una expedición en curso. Se llama desde `store.migrate` y marca `s.gearV = 1`.
- **Integración**:
  - **Bolsa** (`systems/inventory.js`):
    - `DK.bag.add` y `addHome` con un id de equipo crean una pieza normal. Así funcionan sin tocarlos el crafteo, los sucesos (`c.equip`) y los botines.
    - `count`/`remove` de una base cuentan o quitan piezas normales sin equipar, y la fusión en cadena las usa de ingrediente.
    - `DK.bag.equip`/`unequip` delegan en `DK.gear`.
  - **Atributos** (`systems/daskai.js`):
    - `equipBonus` suma `flat` más la regeneración de los sufijos. `passiveMods` suma los % de los prefijos y `passives` añade la pasiva legendaria.
    - `grantedMoves` y las pasivas concedidas salen de la base de la pieza. `statKey` usa `DK.gear.key`.
  - **Combate** (`systems/battle.js`):
    - En `factors`: daño y reducción de daño (parte «Equipamiento» en el desglose) y probabilidad de crítico. El daño crítico extra se aplica en `damage`.
    - En `act`: esquiva, robo de vida, maná al golpear y espinas. Las espinas nunca dejan a 0. Textos nuevos: `battle.dodged`, `leech`, `thorns` y `dmgGear`.
  - **Expedición**:
    - `addLoot(items, coins, { src })` convierte el equipo en pieza con la rareza de su fuente. El jefe usa `src: 'boss'` y los combates pasan fight, elite o boss.
    - Las recompensas del combate añaden piedras (`battleDrops`) y `out.gear`, que el panel final muestra con el color de su rareza.
    - Lo encontrado va a `e.loot.gear` y se puede **equipar ya**, pero no forjar ni desguazar fuera de casa.
    - Al terminar: cobrar o retirarse → todo a la armería; hoguera → cada pieza se queda con la probabilidad del botín; derrota → se pierde (lo equipado sigue puesto). El resumen lo muestra (`lastExpedition.gear`/`lostGear`).
    - El equipo ya no se mete en la mochila (`packCategories`).
- **Pantallas**:
  - **Inventario** con dos pestañas (`params.tab: 'items' | 'gear'`):
    - En **Objetos**, el grupo «Forja» sustituye al de equipo, y la ficha de una piedra lleva a la forja.
    - **Equipamiento**: barra de piedras (en casa), filtros por rareza, «Sin equipar», orden (rareza, nivel o nombre) y desguazar todas las normales. La cuadrícula usa `V.gearTile`, con el nivel y la cara de quien la lleva.
    - Ficha de una pieza (lateral, o una hoja en el móvil): carta estilo PoE (`V.gearTip`), forja, «Equipar en…», «Equipado» y desguazar.
      - Forja: a la vista, las piedras que valen; plegadas, las demás. La esquirla de jefe pone una diana en cada afijo para elegir cuál re-tirar. Lo que cambia se resalta (`.fresh`).
  - **Ficha del daskai → Equipamiento**: las ranuras muestran la carta compacta y el botón «Forja». El selector lista las piezas, ordenadas por rareza y nivel, con su vista previa.
  - **Crafteo**: nueva sección «Forja» (tipo `forge`). `V.equipChooser` acepta un uid o una base.
  - **Componentes**: `components/gearViews.js` (`V.gearTip`, `V.gearTile`, `V.gearLine` y `V.gearRarity`). Los estilos están al final de `css/grim.css`.
- **Tests**:
  - `tests/gear.test.js`: reglas de cada rareza y base; la escalera de forja, la esquirla, el corazón y el desguace; equipar con sus efectos y la migración; y la pantalla en escritorio y móvil.
  - La prueba de la bolsa usa una piedra en lugar de una garra.

### Cambios de la v4.73 — Iconos de daskai, retrato del líder y tarjeta para compartir

- **Favicon al azar** (`DK.app.favicon()`, al arrancar): en cada visita la pestaña muestra un daskai distinto (especie y aspecto al azar; un 30 % con dos casas). Se pinta en un canvas de 64 px y se pone como PNG. Si falla, queda el fijo `icons/icon.svg`. Safari suele ignorar los favicons cambiados por JS.
- **Icono de la app instalada** (fijo; no puede ser al azar porque el sistema lo guarda al instalar): generado con `node tools/make-icons.js [especie] [semilla] [casa2]` (Playwright). Ahora es Draconyx sobre fondo morado con el resplandor de su casa. Escribe en `icons/`:
  - `icon.svg`, `icon-192.png` e `icon-512.png`;
  - `icon-maskable-512.png` (Android adaptativo; el daskai cabe en la zona segura del 80 %);
  - `apple-touch-icon.png` (180 px, iPhone).
- **Que el móvil vea el icono nuevo**: el manifiesto, `index.html` y la lista de `sw.js` piden los iconos con `?v=473`. Al cambiar la URL, Chrome Android actualiza el icono de la app instalada en su siguiente comprobación del manifiesto (puede tardar un día o pedir confirmación). iOS no actualiza iconos: hay que quitarla y volver a añadirla. **Si regeneras los iconos, sube ese `?v=`** en los tres sitios.
- **`DK.looks.image(sid, look, { shiny, pixel })` y `DK.looks.paint(ctx, pic, x, y, w, h, { foot })`**: el dibujo de un daskai listo para un `<canvas>`.
  - Es igual que en pantalla: pixel art si el ajuste `pixelArt` está activo, o vectorial si no; también se puede forzar.
  - Viene recortado a lo que ocupa de verdad, porque el SVG trae margen para todas sus formas.
  - `paint` lo encaja sin deformar y sin suavizar el pixel art.
- **Foto de perfil = el líder tal cual**:
  - `DK.avatars.subject(av, leader)` decide qué daskai sale. Sin foto (el líder) sale el líder con su aspecto, sus dos casas y su forma; un daskai elegido de la lista sale con la forma típica de su especie, como hasta ahora.
  - `V.avatar` lo usa y admite `leader` para otras ranuras.
  - `DK.store.slotMeta(n).leader = { species, look, shiny }` del primero del equipo de esa ranura. El retrato de las partidas guardadas lo usa: es el mismo daskai que el de tu perfil.
- **Tarjeta para compartir** (`components/shareCard.js`):
  - Los daskai (foto y favorito) se dibujan con `DK.looks.image`, igual que en el juego: con su aspecto, colores y forma, y en pixel art o no según tu ajuste. Antes usaba el sistema de sprites antiguo (`DK.sprites`) y salían distintos.
  - Con doble casa, el fondo de la foto se tiñe también con la segunda casa.
  - Hay una línea discreta bajo el nombre con expediciones, jefes vencidos, especies vistas y golpe máximo; cada dato solo sale si lo tienes. Textos nuevos en `share.expeditions`, `bosses`, `species` y `biggestHit` (es/en).

### Cambios de la v4.72 — Los dos colores también al elegir el inicial

- **Fallo corregido**: en «Elige tu daskai» los iniciales (que siempre son de doble casa) se veían con los colores de una sola casa, tanto el daskai como su línea de evolución. Al elegirlo ya salía bien. La causa era que la pantalla pasaba al dibujo `d.look`, que no lleva la segunda casa. Ahora usa `DK.looks.of(d)`, y en la línea de evolución `{ ...d.look, h2: d.house2 }` (la etapa sale de cada especie).
- **Mismo fallo en los registros guardados**: el cementerio (`daskai.js`), las esencias (`rules.js`) y el historial de combates (`battle.js`, `enemy.look`) guardan ahora `DK.looks.of(d)`, con la segunda casa. Los registros antiguos se siguen viendo como antes.
- **«Fuerte contra» y «Débil contra» del inicial**: cuentan las dos casas con la misma eficacia que en combate (`houseMult` multiplicada) y pueden listar varias casas («Oscuridad · Agua»).
- **Regla para el futuro**: para dibujar un daskai concreto, usa siempre `DK.looks.of(d)` o `V.dSprite(d)` y nunca `d.look` a secas, o se pierde la segunda casa (y la etapa de las formas).

### Cambios de la v4.71 — Daskai de doble casa y más formas (cuerpos, patas, bocas, cuernos)

- **Doble casa** (`d.house2`; la casa principal sigue siendo la de la especie):
  - **API** (`systems/daskai.js`): `DK.daskai.houses(d)` → `[principal, segunda]`, `isDual(d)`, `learnset(d)` (especie + segunda casa), `house2Learn(casa)` y `otherHouse(no, semilla)`. `create(sp, lv, { house2: 'agua' })` fija la segunda casa y `{ dual: true }` la sortea. Los jefes, con `boss`, siempre tienen la misma para cada especie (`hash('boss2:' + especie)`).
  - **Quién la tiene** (`config.dual`): los **iniciales siempre** (`starter` → su casa + otra al azar). Los **jefes** y jefes ocultos siempre (`boss: 1`, `secret: 1`). Los rivales de **élite** el 50 %, los **reclutas** el 15 % y un combate normal el 4 %. En total ≈ 1 de cada 10; el 90 % son de una sola casa. Al vincularlos la conservan, y al evolucionar también.
  - **Combate** (`systems/battle.js`):
    - `houseMult(att, def)` acepta una lista de casas del defensor y multiplica las dos. Si una te favorece y otra te resiste, se compensan (×1,5 × 0,75).
    - `isStab`: «misma casa» con ataques de cualquiera de sus casas.
    - `bestHouseMult(A, B)`: lo mejor de cada uno, usado en «ventaja/desventaja» del banquillo y en la ficha de combate.
    - Las reliquias de daño por casa suman las dos casas. Los botones de ataque calculan la eficacia contra las dos.
  - **Ataques y pasivas**: aprende 5 ataques de su segunda casa a los niveles 1, 9, 17, 27 y 38 (`H2_LEVELS`; los de esa casa por orden de nivel en el que los aprenden sus especies). La pestaña «Aprende» los muestra junto a los de la especie. Nace con una pasiva de la segunda casa la mitad de las veces (`passivesOfHouse`) y la conserva al evolucionar.
  - **Aspecto** (`systems/looks.js`, `withHouse2`; el aspecto lleva `h2`: `lookOf` lo añade, y también va en las claves de caché `ind`/`pxKey`):
    - La mitad trasera del cuerpo pasa en degradado al color de la segunda casa (`skin2`, `split` 0,42–0,62).
    - También toman ese color la cola y los segmentos, los cuernos (`horn` de la segunda casa), las manos y, a menudo, el pelo.
    - A veces llevan las orejas u ojos típicos de la segunda casa (`HOUSE_BIAS`).
    - Los jefes de doble casa usan su aspecto típico con los dos colores (`lookOf` → `{ h2 }`).
  - **Interfaz**: `V.housesBadge(d)`, una insignia partida en dos colores con los dos iconos («Luz · Oscuridad»). Su tip explica las dos casas y la doble casa. Se usa en el detalle, el resumen rápido, filas, equipo, combate (cabecera, ficha y banquillo), reclutas, la vista en grande y el inicial.
- **Más formas** (semilla nueva `NEW6_TAG` 0xa8; los aspectos que ya existían no cambian):
  - **Cuerpos** (`BODIES6`): silla de montar, cápsula, erizado, bellota y patata.
  - **Patas** (`LEGS6`): ruedas, de cangrejo, con botas, aletas planas y de insecto.
  - **Bocas** (`MOUTHS6`): pico de rapaz, trompa, mandíbulas, relamiéndose y hocico de perro.
  - **Cuernos/orejas** (`EARS6`): cuernos curvos, cuernecitos, antenas largas, cresta de abanico y orejas de zorro.
  - Con sus sílabas y finales de nombre y sus textos en es/en.
- **Tests**:
  - Nuevo «Doble casa: iniciales, jefes, eficacia combinada, misma casa y ataques de la segunda».
  - «Un combate completo» usa el primer ataque que hace daño (el inicial ahora puede tener ataques de apoyo de su segunda casa).

### Cambios de la v4.70 — Hoguera rediseñada y «Tu equipo» más grande en la preparación

- **Hoguera de la expedición** (`screens/expedition.js`, rama `rest`; `.rest2`): antes se veía el equipo dos veces (en pequeño en «Descansar» y en una cuadrícula de 4 + 2 en «Entrenar»). Ahora:
  - A la izquierda, el equipo una sola vez, uno debajo de otro (`.rt-row`, `role="radio"`). Cada fila lleva el dibujo, nombre, nivel (con «→ nivel siguiente» en el elegido), la barra de vida con una franja clara que late (lo que curaría descansar), números y «+PV».
  - Pulsar una fila elige a quién entrenar, sin repintar el panel.
  - A la derecha (fija al bajar en PC), dos tarjetas: **Descansar** (% real con Hoguera del campamento y corrupción, y «+N PV para el equipo» o «ya está al máximo») y **Entrenar** (a quién y su nivel siguiente, `.rt-who`).
  - «Volver a casa» sigue abajo. En móvil, una columna: equipo y luego acciones.
  - Funciona igual con 1 a 6 daskai (siempre filas, nada descentrado).
  - Test de la tienda actualizado (`.rt-row`, `.rt-who`). Textos nuevos: `exp.restGain`, `exp.restFull`.
- **Preparación de la expedición, «Tu equipo»** (`screens/zones.js`, `.bt-prep .bt-team`): fichas grandes (dibujo de 56 px, nombre, nivel, barra y números) en una cuadrícula que llena la columna.
  - Con 4 o más, las fichas se estiran a lo alto cuando la mochila crece (`grid-auto-rows: minmax(64px, 1fr)`).
  - Con 1 a 3, altura natural y dibujo más grande (72 px).
  - En PC, una columna (o dos si cabe); en móvil, dos.

### Cambios de la v4.69 — Sin «Luchará», estilo limpio por defecto, crecimiento más contenido y más rasgos

- **Fin del combate libre**: sin el desplegable «Luchará». Sigue luchando el mismo (o el primero en pie) y a la izquierda se ve quién es; para cambiarlo, el banquillo.
- **Estilo limpio por defecto** (`core/settings.js`): `uiStyle: 'clean'`. Migración `styleV: 3`: las partidas que estaban en «Exilio» (era el de por defecto) pasan una vez al limpio; luego se respeta lo que elijas en Ajustes.
- **Crecimiento por nivel** (`config.growth`, `rollGrowth`):
  - Cada subida da entre **0 y 5** puntos por atributo (`min`/`max`), con una media de unos 2 (antes ≈ 2,9 y hasta 8).
  - Fórmula: `azar(level [1, 3]) × ritmo (growthBias: especie 0,7 + pasivas 1,5, entre 0,5 y 1,6) ± naturaleza ([0, 1])`.
  - El 5 sólo sale con un atributo muy favorecido (especie fuerte en él, pasivas y naturaleza a favor): ≈ 0,5 % de las subidas.
  - Los rivales y reclutas se generan con la misma regla (`create` aplica `applyGrowth` nivel a nivel), así que un nivel 50 tiene los atributos que le tocan con esa media, más sus pasivas, rasgo, forma y dificultad.
  - `growthAvg` también se limita a 0–5.
  - **Partidas existentes**: migración `growthV: 2` (`store.migrate`). Lo ganado por nivel de tus daskai se multiplica una vez por 0,72 (la misma proporción) y la vida se ajusta al nuevo máximo. El equipo, los tónicos y la herencia no cambian. Las partidas nuevas nacen con `growthV: 2`.
  - Medido a nivel 50 (60 daskai): ataque ≈ 124 (antes 175), vida ≈ 204 (antes 251).
- **Más rasgos** (`systems/looks.js`, etiqueta de semilla nueva `NEW5_TAG` 0xa7; los aspectos que ya existían no cambian):
  - **Brazos**: 7 nuevos (`ARMS5`): sin brazos, tentáculo, de hoja, aletas de plumas, saludando, garras largas y de cristal (color por casa). Ahora el 85 % de los nuevos daskai lleva un tipo de brazo propio o ninguno; antes la mayoría tenía el brazo corto por defecto con la mano de su casa.
  - **Ojos** (`EYES5`): gafas de sol, monóculo, en equis, en blanco y ojeras.
  - **Bocas** (`MOUTHS5`): hocico, chicle, dientes apretados, máscara y besito.
  - **Accesorios finales** (`FINALS5`): chistera, sombrero de mago, auriculares, pajarita y gorro de lana. El encuadre deja sitio a los sombreros altos (`extraTop`).
  - Nombres: prefijos para los brazos y accesorios nuevos, y sílabas para los ojos y bocas nuevos. Textos en `look.*` (es y en).

### Cambios de la v4.68 — Vida al empezar expedición, el mapa no se mueve, recorrido con la página, fin de combate libre y cofres

- **Vida al empezar una expedición** (era un fallo, no la dificultad): durante la expedición tus daskai tienen bonus de vida máxima (Vigor del campamento y reliquias de PV, `daskai.stats`: `relics.statPct` + `camp.value('vigor')`). El máximo subía, pero la vida actual no, y todos empezaban «heridos» (con Vigor 3, 80/100).
  - Nuevo `DK.daskai.snapPct()` / `applyPct(m)`: guarda el % de vida y maná de la colección y lo vuelve a aplicar con los máximos nuevos.
  - Se usa al empezar la expedición (`expedition.start`), al ganar una reliquia (`relics.give`) y al terminarla (las 4 salidas que ponen `st().expedition = null`), para que el máximo baje sin dejar vida de sobra.
- **El mapa no se mueve al volver de un piso o combate** (`screens/expedition.js`, `mapMem`):
  - Se apunta dónde estabas (caja del mapa, página y `.screen-host`) al entrar en un nodo (`go` → `rememberMap`) y mientras te mueves por el mapa (scroll, con una pausa de 0,5–0,6 s tras pintar para no apuntar el «subir arriba» de la app).
  - Al volver se recupera tal cual, sin recentrar. Se guarda por mapa (`seed|depth`).
- **Recorrido de entrada con la página** (`flyIn`): la página baja a la vez que la caja del mapa y llega al final justo cuando acaba la animación. Busca el elemento que se desplaza (`.screen-host` o el documento). Cualquier rueda, toque o tecla en la ventana lo corta.
- **Fin del combate libre** (`screens/battle.js`): usa la misma barra compacta que la expedición (`.end-exp.free`).
  - A la izquierda, quién luchará: desplegable si hay varios en pie; si no, su miniatura, nombre y % de vida.
  - A la derecha, «Salir» (3), «Curar» (2, con cuántos heridos hay) y «Siguiente combate» (1).
  - En móvil las teclas rápidas no se muestran en esta barra.
- **Botín del cofre** (`.chest-panel .loot-grid`, `--n` = número de tarjetas): flex centrado con columnas según el ancho (5 en PC; 4, 3 o 2 al estrecharse). Nunca queda una tarjeta suelta a la izquierda.
- Prueba interna v1: la cueva se crea si el mapa aleatorio no tenía ninguna libre (antes fallaba con algunos mapas).

### Cambios de la v4.67 — Daskai de la hoguera, avisos arriba, mercader, cabecera del mapa y recorrido de entrada

- **Daskai junto a la hoguera** (`components/camp.js`): pulsarlos abre el mismo resumen rápido que «Tu equipo» (`V.quickStats`), en vez de ir a la pantalla de equipo. `V.campScene({ onChange })` repinta el Inicio si cambias algo desde ahí.
- **Avisos (toasts) arriba** (`core/ui.js` `toast`, `css/grim.css`):
  - Salen bajo la cabecera, en todas las pantallas.
  - Cada aviso tiene una pastilla de icono con el color del tipo (`good`, `bad`, `warn` o el dorado por defecto), un degradado suave de ese color y una barrita inferior que se vacía con el tiempo que le queda (`toastLife`; se reinicia si el aviso se repite).
  - Entran cayendo y salen hacia arriba.
- **Mercader** (`merchantPanel`):
  - Sin el botón «Seguir el camino» de arriba (`.mr-skip`).
  - La bolsa de monedas va en la cabecera, junto al mercader, y la nota de pago al lado de las pestañas.
  - Abajo hay una barra pegada (`.mr-foot`, `position: sticky`, por encima del menú flotante) con el aviso de compra o venta y «Seguir el camino». En móvil, la bolsa ocupa su propia fila y el aviso puede ocupar dos líneas.
  - Test de la tienda actualizado.
- **Cabecera del mapa de expedición**:
  - Título y «Dibujar» en una fila.
  - Debajo, los datos del mapa en una línea uniforme (`.exp-meta`: tipo, tamaño, modificador, corrupción, mapa y piso; todos del mismo tamaño, sin cajas, separados por puntos).
  - Las reliquias, en iconos redondos con el aro del color de su rareza (`relicBar(list, { compact: true, refresh })`). El nombre y el efecto salen en el «tip» y «Ver» las despliega con nombre (`relicsOpen`).
  - La barra del modo foco usa el mismo estilo sutil.
- **Recorrido de entrada del mapa** (`flyIn`): la primera vez que ves un mapa nuevo (sin nodos hechos; se guarda en `e.flyShown`), la vista empieza arriba con el jefe resaltado (`.fly-focus`). Espera a que se vaya la cortinilla y baja suavemente hasta la salida (unos 2 s). Cualquier rueda, toque o tecla lo corta, y con movimiento reducido no se hace.
- Textos nuevos: `exp.shopLeaveHint`, `exp.relicsShort`, `exp.relicsMore`, `exp.relicsLess`.

### Cambios de la v4.66 — Revisión: tests estables, daño blindado, código duplicado y muerto

- **Tests estables**:
  - «El automático cura con un objeto en zona crítica» daba por hecho la Poción; con un inicial de mucha vida la regla (el más barato que cure al menos la mitad de lo que falta) elige la Superpoción. Ahora calcula lo esperado con la vida real.
  - Los combates esperan `.end-panel` **o** `.end-exp` (la barra de fin de combate de la expedición desde la v4.63). Era la causa de que la prueba de expedición fallara en móvil: seguía pulsando «1» tras ganar.
  - Nuevo test «La fórmula de daño es coherente»: sin NaN con ataque/defensa 0, crítico > normal, más defensa = menos daño, la quemadura sólo afecta al físico, defenderse reduce, la estimación [mín, máx] cubre el daño real y un efecto temporal no deja un atributo a 0.
- **Daño revisado** (`systems/battle.js`): la fórmula y los multiplicadores (casa, misma casa, punto débil, ruptura, escudo, defenderse, cambio, mapa, reliquias, quemadura y crítico) se aplican bien y una sola vez.
  - Blindajes: `rawDamage` ya no devuelve NaN si ataque y defensa llegan a 0 (mínimo 1).
  - `timedMult` nunca baja de ×0,1, aunque se sumen varios efectos negativos.
- **Código duplicado**:
  - `V.itemGrants(it)` (ataque y pasiva que da un objeto) para el inventario y la forja.
  - `progressChips(e)` (profundidad y piso) para las dos barras de la expedición.
  - `DK.party._drop(uid)` para liberar y quitar temporales.
  - `names.js` usa el generador de `DK.looks.rng` en vez de una copia (es el mismo algoritmo; no cambiarlo o cambiarían todos los nombres y aspectos).
- **Código muerto eliminado**: `V.shopCard`, `V.catButtons` y `V.daskaiTile` (ya no se usaban en ningún sitio).

### Cambios de la v4.65 — Campamento en móvil, dibujo de la ficha en móvil y toque en la vista en grande

- **Campamento en móvil** (`components/camp.js`, `xs/ys` de `SPOTS`): el tablón de misiones (`ys` 37 → 51) y el portal de expediciones (43 → 54) quedaban por encima del horizonte, flotando en el cielo rojo; ahora se apoyan en el suelo. El yunque baja a 74 para dejarle sitio al portal y las antorchas se reubican (`[40, 62]`, `[96, 64]`).
- **Ficha del daskai en móvil** (`css/grim.css`, `.daskai-panel .detail-sprite`): la regla que fijaba el tamaño se aplicaba a todos los hijos y al `svg` del icono de ampliar, que salía de 88 px. Ahora sólo afecta a `.sprite` (118 px, con el dibujo a ×1,18) y el icono de ampliar es una esquinita de 20 px, semitransparente.
- **Vista en grande al tocar** (`V.showcase`): en pantallas táctiles (`hover: none`) el dibujo no lleva «tip» (salía un bocadillo en cada toque), se quita el foco tras tocar y no hay contorno, resaltado de toque ni selección (`-webkit-tap-highlight-color`, `user-select`, `-webkit-touch-callout`).
- Nota de pruebas: «El automático cura con un objeto en zona crítica» puede fallar de vez en cuando por la vida aleatoria del inicial (pasa al repetirlo).

### Cambios de la v4.64 — Botón de expedición más discreto, reclutas con la vida llena y candidatos en filas equilibradas

- **Botón «Empezar expedición» del Inicio** (`css/grim.css`, `.hub-exp .play-btn`): fuera el resplandor que latía (`playGlow`). Se mantiene el brillo que cruza el botón y el icono da un pequeño empujón cada ~5 s (`playNudge`). Con movimiento reducido no se anima.
- **Quien se une llega curado** (`DK.party.add`): al vincular, reclutar o adoptar en un suceso, el daskai entra con el 100 % de vida y maná y sin estados (`fullHeal` tras quitar `wild`).
  - Corregido de paso: la caché de atributos (`statKey`) no tenía en cuenta `wild`, `boss` ni `elite`, así que un daskai recién vinculado seguía con los atributos de salvaje en caché (y la vida «llena» se quedaba por debajo del máximo real).
- **Candidatos a reclutar** (`.recruit-grid`, `--n` = número de candidatos): flex centrado con columnas según el ancho (5 en PC; 4, 3 o 2 según se estrecha). Con 5 en PC salen todos en una fila; si no caben, la última fila queda centrada (3+2, 2+2+1) en vez de quedarse uno suelto a la izquierda.

### Cambios de la v4.63 — Marca del variocolor, «Nuevo» que caduca, fin de combate, personajes, vista al reclutar y nombres de todos

- **Marca del variocolor** (`systems/looks.js`, `shinyMarkSvg`): cada variocolor lleva una marca propia pegada al cuerpo (encima del brazo cercano). Forma (destello, estrella, rombo, luna, corazón, rayo, anillo, constelación, flor, cometa), color, sitio, tamaño y giro salen de su semilla (`seed ^ 0x5b1e7`), así que no hay dos iguales. Lleva un halo suave y un brillo que va y viene (`<animate>`). No sale en los iconos de rasgos (`o.focus`) ni en las siluetas de personaje.
- **«Nuevo» caduca a los 5 minutos** (`DK.daskai.isNew(d)`): `d.isNew` guarda ahora la hora (`Date.now()`); las marcas antiguas (`true`) empiezan a contar al verlas. Todas las vistas (`V.newDot`, `V.extraTags`, ficha, Inicio) usan `isNew`. Abrir la ficha la quita como antes (`seen`).
- **Fin de combate en expedición** (`screens/battle.js`, `.end-exp`): sin el desplegable «Luchará» (se elige en el mapa); una barra compacta con el botín (objetos y monedas) a la izquierda y «Curar» (con cuántos heridos hay) + «Volver al mapa» a la derecha. En móvil, botín arriba y los dos botones en fila. Fuera de expedición sigue igual.
- **Personajes de los sucesos** (`V.npc(key, {color, icon})`, `screens/expedition.js` `head(..., npc)`): viajera, ermitaño, herrera, cartógrafo, bandidos, tramposo, entrenador, coleccionista y el mercader muestran un medallón pequeño con la silueta de un daskai (sombra con contorno de color, respira, rayos que giran y un bocadillo con el icono). La figura sale de `suceso|semilla|nodo`: cada encuentro tiene la suya. Colores en `NPC_COLOR`.
- **Vista en grande al reclutar**: pulsar el dibujo de un candidato abre `V.showcase(c, { bare: true })` (sólo el dibujo y su nombre, sin datos). La vista ganó 6 animaciones (`wiggle`, `bounce3`, `twirl`, `peek`, `stretch`, `nod`) con partículas dibujadas (`showFx`: confeti, burbujas, onda, motas, estrellas fugaces, notas) y un fondo con motas que suben (`.sc-amb`).
- **Nombres para todos**: los rivales (cabecera, ficha de combate, línea de turnos y registro) y los candidatos a reclutar usan `DK.daskai.name` (nombre propio aleatorio); en la tarjeta de recluta sale la especie debajo, en pequeño. Los jefes siguen con su título (`names.of` devuelve null con `d.boss`).
- Textos nuevos: `heal.short`, `battle.hurtTip`, `exp.lootLabel`.

### Cambios de la v4.62 — Más rasgos, brazos, nombres; reglas discretas; punto de «nuevo»; barras que no se llenan

- **Sin las 3 estrellitas del variocolor** (`looks.js`, `draw`): en pixel art parecían puntos flotando. El variocolor se distingue por su color y su etiqueta.
- **Rasgos de la v4.62 (tablas `*4`, marca `NEW4_TAG` = 0xa6 en la semilla).** Los aspectos nuevos (`rollLook`) tienen además los de la v4.56; los ya creados no cambian. Con `NEW4_CHANCE` (35 %):
  - Cuerpos: ancho, torre, cabezón, burbujas, grumoso. Ojos: pupila en cruz, lloroso, de robot, con pestañas, pupila de rombo. Bocas: colmillitos, cremallera, de gato con bigotes, labios, enfurruñada. Patas (`LEGS4`): de palo, palmeadas, muelles, pies grandes, zancos.
  - **Brazos (`ind.arms`, nueva categoría `arms`, la mitad de los nuevos):** cortitos, largos, de fideo, pinzas, manoplas (`armSvg`).
  - **Adornos finales (`FINALS4`):** capa, corona de flores, pañuelo, gafas de aviador, collar de pinchos.
  - El Códice tiene la categoría «Brazos» (10 categorías de rasgos).
- **Nombres (`systems/names.js`).** Más inicios por casa, sílabas de los rasgos nuevos y, con azar aparte (los nombres de antes no cambian), un **sufijo de la casa** a veces («-ix», «-ina», «-ok»…) y un **prefijo** por brazos o adorno pocas veces («Kra-», «Sir-», «Flor-»…).
- **Reglas de la aventura** sin título ni rojo: panel oscuro con un filo dorado a la izquierda (más vivo si hay alguna activa) y la regla activa con borde dorado.
- **«Recién conseguido»:** punto verde que late (`V.newDot(d)`) en las casillas del equipo y de las cajas (también los reclutas de la expedición); se va al abrir su ficha.
- **Barras de atributos (`V.statBar`)** con escala curva: con ~el valor de referencia ocupan ~60 % y nunca pasan del 94 %.
- **Entrenamiento fuera de la barra de abajo** (`dock: false` en su opción de menú; `renderNav` las filtra). Se entra por el muñeco del campamento, «Qué hacer ahora» y la paleta de comandos.

### Cambios de la v4.61 — Reglas de la aventura, mochila más clara, ficha ordenada y tienda sin avisos encima

- **Arreglo:** el bloque de Abismo / Corrupción / Pesadilla se veía roto porque la tabla de subidas de la evolución (v4.59) reutilizaba las clases `.eg-*`. Las de la evolución pasan a `.evg-*`.
- **«Reglas de la aventura» (`endgameBox`, `screens/zones.js`).** Panel de advertencia (rojo oscuro con franjas) con una fila por regla: icono, nombre, qué hace y su control a la derecha (segmentado del Abismo, niveles I–V de Corrupción, interruptor de Pesadilla). La regla activa y el panel brillan; con Corrupción se ve «Más difícil» y «Premios» por separado. Clases `.egx-*`.
- **Mochila en la preparación.** Cada objeto en su ficha (icono, nombre, ×N; «−» para quitar uno) y una ficha «+» que abre el editor (`.pk-tile.add`, sustituye a `.bt-pack-btn`). Debajo, «Sugerir», «Repetir la última» y «Vaciar» con su texto (`.pk-tools`); el contador «6/10» arriba.
- **Ficha del daskai:** el nombre (y la especie) en una fila y nivel, casa + rasgo (juntos en `.dp-kind`, sin separarse) y estados en la siguiente (`.dp-title`, `.dp-badges`).
- **Códice del campamento** un poco más pequeño (base 24).
- **Tienda de la expedición:** comprar o vender ya no saca avisos flotantes: la confirmación sale dentro de la tienda (`.mr-flash`) y la fila comprada parpadea en verde. Además, en la pantalla de la expedición todos los avisos salen arriba, no encima de los botones.

### Cambios de la v4.60 — Botín visual al ganar y paneles de la expedición más sutiles

- **Botín del panel final del combate (`rewardsView(r)`, `screens/battle.js`).** En vez de píldoras: dos casillas grandes (experiencia y monedas —o «monedas al botín» en una expedición—, más emblemas si los hay) y una tarjetita por objeto, runa o reliquia por elegir, con su icono, color de rareza y «×N» si se repite; entran una a una. En el móvil todo se compacta para caber en la arena. Las acciones de después (siguiente combate, curar, salir, continuar/cobrar) ya no se estiran hasta llenar el hueco.
- **Paneles de la expedición (`screens/expedition.js`, `css/grim.css` «v4.60»).** Cabecera con icono pequeño; las opciones van en una fila compacta (`opts(...)` → `.exp-opts`) con su descripción en pequeño (`btn({ showDesc: true })`, nuevo en `DK.ui.btn`), sin botones enormes: atajo, cueva, cueva del jefe oculto y sucesos. El botón de seguir (`cont`, «Combatir», «Abrir el cofre», «Seguir sin…») es normal y va a la derecha (`.exp-cont`).
  - Atajo: coste, pisos que te saltas y adónde llegas en una sola línea (`.exp-facts`); la explicación sale al pasar el ratón.
  - Santuario: fichas pequeñas del equipo (dibujo, nombre, nivel, vida); pulsar una la bendice (`.exp-picks`).
  - Cofre, hoguera y reclutar: iconos y dibujos más pequeños; la leyenda de mochila/botín del cofre, en el tooltip.

### Cambios de la v4.59 — Aprender ataques, subidas al evolucionar, automático tras la cortinilla y niveles del banquillo

- **Aprender un ataque (`V.learnMovePrompt`, `components/daskaiViews.js`).** A la izquierda el ataque nuevo destacado; a la derecha los 4 que conoce en una cuadrícula de 2×2 (una columna en el móvil). Cada uno dice cuánto daño ganas o pierdes si lo cambias (o si es de apoyo). Primero se marca cuál olvidar y luego «Aprender y olvidar X»; «Guardar en reserva» sigue igual. La promesa devuelve lo mismo que antes (true si lo aprendió).
- **Evolución (`V.evolveDialog`, `components/celebrations.js`).** Las subidas salen en una tabla ordenada (icono, atributo, barra con lo que tenía y lo que gana, antes → después, +subida) en dos columnas, fila a fila con animación, y el total arriba.
- **Automático y cortinilla (`screens/battle.js`).** La entrada del combate (animaciones, mensajes y el modo automático) espera a que no quede ninguna `.curtain` (jefe, mini jefe, zona).
- **Niveles del banquillo.** `V.levelFeed(list)` saca tarjetitas (dibujo, nombre, Nv. antes → después y si puede evolucionar) abajo a la izquierda (arriba en el móvil) que se van solas y no se pueden pulsar. El panel final del combate añade la experiencia de cada uno con su barrita (`.team-exp`).

### Cambios de la v4.58 — Resumen rápido, campamento recolocado, esencias cómodas y dibujos centrados

- **Resumen rápido de un daskai (`V.quickStats(d)`, `components/daskaiViews.js`).** Pulsar un daskai en «Tu equipo» del Inicio ya no te lleva al equipo: abre una ventana compacta con su dibujo (pulsarlo = vista en grande), especie, nivel, casa, rasgo, estado, PV/PM/EXP, los 7 atributos, naturaleza y pasiva (descripción al pasar el ratón), ataques y avisos (evolución, talento, entrenando). Abajo, «Hacer líder» y «Ficha completa».
- **Campamento recolocado (`components/camp.js`).** Nuevas posiciones (`x/y`, `xm/ym`, `xs/ys`) para que tienda, tablón, portal, códice, yunque y muñeco no se toquen; la hoguera usa también `xm/ym`. Los daskai junto al fuego son más grandes (96 px; 66 en el móvil) y van más separados.
- **Barra de expedición:** «Empezar expedición» brilla suavemente; «Combate libre» y «Batalla» son botones fantasma pequeños.
- **Esencias de los caídos (modo difícil, `screens/team.js`).** Cada esencia es una tarjeta que se pulsa y abre un selector (`.essence-pick`) con todos tus daskai: ves cuánto sube el atributo («76 → 78») y al elegir se hereda. Ya no hace falta tener un daskai seleccionado (en el móvil la ficha tapaba la lista). Las esencias guardan el aspecto del caído (`look`).
- **«Nuevo» más discreto:** punto verde y texto diminuto, sin relleno.
- **Dibujos centrados (`looks.js`, `draw`).** El encuadre se centra en lo que ocupa el daskai (antes iba pegado abajo y las formas pequeñas se veían bajas). `V.sprite` pone `--feet` (altura de los pies, 0–1) y en combate los dibujos llevan `grounded` para seguir apoyados en la plataforma.

### Cambios de la v4.57 — Calidad de vida: proteger, deshacer, curar todo, «Nuevo», rareza y tamaño de interfaz

- **Proteger un daskai (`d.locked`).** `DK.daskai.setLocked(d, v)`; `DK.party.release` lo rechaza. Botón de candado en la ficha (`.dp-lock`), opción en el menú contextual y etiqueta de candado en filas, tarjetas y cabecera de la ficha.
- **Deshacer al liberar.** `DK.party.release` guarda una copia (`_lastRelease`) y `DK.party.unrelease()` devuelve el daskai a su sitio (y al equipo si cabe) retirando monedas, piezas y lo que llevaba equipado; si ya lo gastaste, no se puede. `DK.ui.toast(text, { action: { label, icon, onClick } })` añade un botón al aviso (y lo deja más tiempo).
- **Curar a todo el equipo** desde «Tu equipo» en el Inicio (`.hs-heal`, sólo si alguien lo necesita): usa `V.healDialog(team)`, que ya elige los objetos justos y los enseña antes.
- **Marca «Nuevo».** `DK.party.add` pone `d.isNew` (menos al primero); se quita al abrir su ficha (`DK.daskai.seen`). Se ve en el Inicio, en las filas y en las tarjetas de las cajas. En el Códice, los rasgos recién descubiertos (`looks.fresh`) brillan y la pestaña «Rasgos» lleva el número hasta que la abres.
- **Ordenar las cajas por rareza** (`DK.looks.rarityScore`: rasgos raros, alas, brillo y variante).
- **Tamaño de la interfaz** (ajuste `uiScale`: 90/100/110/125 %, con `zoom` en `<html>`), además del tamaño del texto que ya había.
- **Vista en grande:** sin botones en el pie; «×» discreto arriba a la derecha (`modal({ closeX: true })`) y una animación nueva cada 2,6–4,2 s mientras está abierta (pulsar el dibujo adelanta la siguiente).
- **Brazo de detrás (`looks.js`, `armSvg`)** sale del borde del cuerpo: en cuerpos grandes la mano ya no queda tapada.
- **Fichas emparejadas del mismo alto** (naturaleza y pasiva al elegir daskai y en la ficha: `.st-traits`, `.info-grid`).

### Cambios de la v4.56 — Corona de líder, vista en grande, nombres en el inicio y 35 rasgos nuevos

- **Líder en un clic (`screens/hub.js`).** Cada fila de «Tu equipo» es un `div.hs-mon` con dos botones: `.hs-open` (abre su ficha; clic derecho / pulsación larga = menú de acciones) y `.hs-star` a la derecha del todo (corona: dorada en el líder, tenue en el resto; pulsarla lo hace líder, con aviso y una pequeña animación `just-lead`).
- **Vista en grande (`V.showcase(d)`, `components/daskaiViews.js`).** Pulsar el dibujo de la ficha (`.detail-sprite.sc-open`) abre un escenario con su luz de casa y una animación al azar de 9 (salto, giro, aplastarse, balanceo, voltereta, temblor, baile, flotar, rugido), con partículas a juego; pulsarlo o «Otra» repite con otra (nunca la misma dos veces seguidas). Respeta «Reducir animaciones».
- **Elegir tu primer daskai (`screens/newGame.js`)** muestra su nombre propio (y la especie en pequeño) en el título, el botón y las miniaturas.
- **35 rasgos nuevos (`systems/looks.js`, tablas `*3`).** Cuerpos: calabaza, rombo, peludo, campana, trébol (`PRESET` admite `waist`). Ojos: con destellos, pupila de luna, apretados, de insecto, hipnóticos. Bocas: cosida, dientes apretados, mellada, babeando, silbando. Cabeza: orejas de hoja, pluma, cuernecillos, lazo, cristales. Marcas: rayo, galones, anillo, flor, tres puntos. Pelo: moño, afro, tupé ladeado, trenzas, copete. Patas (`LEGS3`): pezuñas, ancas de rana, garras de rapaz, raíces, nubecitas (`LIFT` ampliado).
  - **Los daskai que ya tenías no cambian:** sólo los aspectos nuevos llevan la marca `NEW3_TAG` (0xa5) en el byte bajo de la semilla (`rollLook`), y sólo esos sortean (con `NEW3_CHANCE`) los rasgos nuevos con un azar aparte.
  - Nombres en `lang` (`look.*`) y sílabas en `systems/names.js`.

### Cambios de la v4.55 — Etiquetas ligeras, barra igualada y líder desde el Inicio

- **Etiquetas del campamento más ligeras (`css/grim.css`).** Fuera las píldoras: sólo texto en mayúsculas espaciadas con sombra, un icono pequeño y una línea fina dorada que se alarga al pasar el ratón. Expediciones va en dorado-naranja con un brillo que late.
- **Escena redistribuida en PC** (posiciones `xm`/`ym` de `components/camp.js`, que usa el Inicio en columna): tienda más a la izquierda, tablón más arriba y centrado, portal y yunque desplazados, antorchas recolocadas y el equipo junto a la hoguera sin tapar etiquetas. En móvil se ven 4 daskai junto al fuego.
- **Barra de abajo igualada (`core/app.js`, `css/grim.css`).** Todos los botones miden lo mismo (rejilla de columnas iguales) y el principal (Batalla, o Mapa en expedición) se coloca siempre en el centro, también con «Más» en el móvil.
- **Cambiar de líder desde el Inicio (`screens/hub.js`).** Pulsar un daskai de «Tu equipo» abre un menú rápido con «Hacer líder» primero, «Ver ficha» y el resto de acciones. `DK.ui.contextMenu` ya no se cierra por el desplazamiento que hace el navegador justo al abrirlo (350 ms de gracia).
- **Barra de expedición:** los botones bajo «Empezar expedición» (Combate libre y Batalla) van en `.hx-sub`, a partes iguales y con el mismo estilo.

### Cambios de la v4.54 — Inicio en dos columnas, nombres propios y campamento renovado

- **Inicio rediseñado (`screens/hub.js`, `css/grim.css` «v4.54»).** Dos columnas: a la izquierda la escena del campamento y, justo debajo, la **barra de la próxima expedición** (`playBar`: mapa, nombre, chips, avisos en una línea —si alguno se cura con objetos, al pulsarla se abre la cura— y «Empezar expedición»). A la derecha, **Tu equipo** en filas compactas (`teamRow`: dibujo con formas, corona del líder, nombre, nivel, barras de PV/PM y avisos de evolución, talento, entrenamiento, estado o debilitado; clic derecho = menú del daskai), **Qué hacer ahora** (más compacto en `.hub-side`) y las **Misiones de hoy** en una línea cada una (`missionLine`, con «Cobrar»). Por debajo de 1100 px todo va en una columna (lateral en dos columnas); en móvil el equipo va en una cuadrícula de 2.
- **La escena en columna** usa los dibujos y posiciones de pantalla mediana: `V.campScene({ compact: true })`.
- **Nombres propios (`systems/names.js`, `DK.names`).** Cada daskai tiene un nombre sacado de su aspecto: sílaba de su casa + sílaba de un rasgo llamativo (los raros salen siempre) + final de su cuerpo; pequeñitos acaban en «-ín» y enormes en «-ón». Es estable (semilla del aspecto, no cambia al evolucionar) y se guarda en `d.gname`. `DK.daskai.name(d)` = apodo → nombre propio → especie; los jefes siguen con el de su especie. La especie se ve en pequeño junto al nombre (`V.speciesSub` en las filas, en la ficha y al pasar el ratón en las tarjetas).
- **Campamento renovado (`components/campArt.js`, `components/camp.js`):**
  - Hoguera más grande (base 30) con llamas procedurales en 8 fotogramas, troncos cruzados, lecho de brasas, chispas y un resplandor que late en el suelo.
  - Tablón nuevo: tejadillo de tejas con musgo, notas con sello de lacre y mapa, una nota al viento y un farol que se mece y titila (6 fotogramas).
  - Códice nuevo: grimorio que flota sobre un pedestal de runas, pasa página, motas de luz y círculo mágico que gira en el suelo (8 fotogramas).
  - Etiquetas modernas: píldoras de cristal con el icono de su sección (sin marcos de hierro); Expediciones en degradado rojo que late. `motion.css` tiene ya los ciclos `n6` y `n8`.

### Cambios de la v4.53 — Sin descripciones de especie e indicador de formas

- **Descripciones fuera**: el texto de cada especie describía un animal concreto («un zorrito…», «salamandra…») y ya no casa con el aspecto al azar. Se quita de «Elige tu daskai» (`.st-desc`), de la ficha del daskai y de la ficha del Códice. (El texto sigue en `data/species.json` por si se reutiliza.)
- **Indicador de formas** (`V.formPips(d)` en `components/daskaiViews.js`, CSS `.fpips` en `css/grim.css`): puntitos diminutos (uno por forma, rellenos hasta la actual) sobre el dibujo, medio transparentes; con 1 forma, un único rombo lila. Al pasar el ratón: «Forma 2 de 3» o «No evoluciona». Sale en las cajas (arriba a la izquierda de cada casilla), en «Tu equipo», en las tarjetas (`V.daskaiTile`) y en las filas de listas (`V.daskaiRow`). Usa `DK.daskai.formsOf(d)`, así que los daskai antiguos muestran las formas de su línea.

### Cambios de la v4.52 — Comparador de talentos y mucha más variedad de aspectos

- **Elegir talento** (`components/talentViews.js`, `V.talentCompare`): la ventana muestra al daskai (dibujo, nivel, naturaleza) y una tabla con sus atributos **ahora**, **con el talento A** y **con el talento B** (lo que sube en verde, lo que baja en rojo y la mejor opción de cada atributo resaltada). Se calcula con una copia del daskai con el talento puesto. CSS `.tc-*`. Texto `talent.now`.
- **Bug de aspectos** (`systems/looks.js`): en la v4.48 un comentario se tragó `cheeks` y `furAmt`, así que ningún daskai tenía coloretes ni el pelo/textura de su casa (humo, llamas, pelusa…). Por eso se parecían tanto. Arreglado.
- **Rasgos nuevos** (se sortean con un azar aparte, `NEW_CHANCE` = 40 % de cambiar cada rasgo por uno nuevo, así los aspectos ya creados casi no cambian):
  - Cuerpos: nube, pera y montículo (`BODIES2`, con su maduración en `BODY_PATH`).
  - Ojos: mareados, enamorados, guiño, brillantes y enormes, párpado caído.
  - Bocas: sorprendida, dientes de sierra, pompa (rara), bigote, sonrisa enorme.
  - Cabezas: orejas de elfo, de ratón, alitas, tres cuernos, orejas de lince.
  - Marcas: pecas, parche en el ojo, franja, remolino, lucero.
  - **Pelo** (categoría nueva, `hairSvg`): flequillo, rizo, pinchos, coleta, patillas y perilla, con su propio color (`hairColor`).
  - La colección del Códice suma la categoría «Pelo» y los nuevos rasgos (`ALL`, `CATS`). Textos `look.*`.
- Tests: comparador de talentos y 9 categorías en la colección de rasgos.

### Cambios de la v4.51 — Formas: de 1 a 4 por daskai y crecimiento que se nota

- **Crecimiento visible** (`systems/looks.js`): el encuadre de cada etapa crecía casi tanto como el cuerpo, así que las 4 formas se veían del mismo tamaño. Ahora `GROWTH = [0.68, 0.94, 1.17, 1.38]` y `VIEW_SIDE = [112, 118, 126, 136]`; además 3 de cada 4 nacen pequeños en su primera forma (`ind.baby`, con su propio azar: no cambia el resto del aspecto).
- **Formas por daskai** (`config.forms`, `systems/daskai.js`):
  - Al nacer cada daskai sortea cuántas formas tendrá (`d.forms`, pesos 1:18 · 2:27 · 3:30 · 4:25); el inicial siempre 4 (`create(…, { starter: true })`). Jefes y especies sin línea no tienen `d.forms` y siguen como antes; los daskai antiguos también (`formsOf` lo deduce de su línea).
  - `d.form` = forma actual (al crearlo, según su nivel). Niveles para pasar de forma: 2 formas → 30 · 3 → 22, 44 · 4 → 16, 34, 54.
  - **Fuerza**: `formMult(d)` = fuerza de la forma (`config.forms.power`, respecto a la primera de la línea) ÷ fuerza real de su especie. Todas acaban en 1,84; con 1 forma se queda en 1,7 desde el principio, con 2 empieza en 1,32, con 3 en 1,12 y con 4 en 1. Los salvajes lo notan a medias (raíz cuadrada) para no disparar la dificultad; al reclutarlos se ve entero.
  - **Evolución**: `nextForm(d)` → `{ level, into, extra }`. Si su línea de especies tiene siguiente, cambia de especie; si no, es una forma de más con el mismo nombre y número (`d.extra`, `speciesName(d)` → «Hojaral II»). Con menos formas que su línea, se queda en la especie que tenga.
  - **Dibujo**: la etapa sale de la forma (`visual(d)`, `config.forms.vis`); `DK.looks.of(d, forma)` devuelve `{ s, st, fin }` y el pixel art se guarda por etapa.
- **Ficha** (pestaña Ataques): puntitos de formas (`.forms-pips`, «Forma 1 de 3») y avisos de «No evoluciona» (1 forma) o «Forma final».
- Test nuevo de formas en `tests/screens.test.js`.

### Cambios de la v4.50 — Cambios que no llegaban al juego y último desplegable

- **Por qué no se veían las evoluciones secretas**: `js/screens/newGame.js` y los textos (`js/lang/es.js`, `en.js`) de la v4.49 no se llegaron a copiar a la carpeta del juego (se quedó la versión anterior). Se vuelven a copiar y se ha comparado el tamaño de todos los archivos con la copia de trabajo; también `data/zones.json`, que estaba desfasado (el juego usa `js/data/gen/data.js`, que sí estaba bien).
- **Recarga automática con versión nueva** (`js/core/app.js`): el service worker sirve primero lo que tiene en caché, así que tras actualizar había que recargar dos veces. Ahora, al activarse una versión nueva (`controllerchange`), se guarda la partida y la página se recarga sola; además se registra con `updateViaCache: 'none'` y se pide `update()` al entrar.
- **Perfil**: el título era el último `<select>` nativo; ahora es un desplegable propio en versión «en línea» (`.dd.dd-inline`, sin caja). Ya no queda ningún `<select>` en el juego.

### Cambios de la v4.49 — Evoluciones secretas al elegir inicial

- **«Elige tu daskai»** (`screens/newGame.js`): en la línea evolutiva, las 2 últimas evoluciones salen sólo en silueta y con «???» (`.st-line-mon.secret`).
- Al pasar el ratón (o enfocar / tocar) cualquier forma de la línea aparece una vista grande (`.st-line-peek`, sprite de 132 px) con su nombre y nivel; en las secretas, la silueta grande y «Evolución secreta». La primera y la última se anclan al borde para no salirse en el móvil.
- Textos: `newGame.secretEvo`, `newGame.firstForm`. El test de iniciales comprueba las dos siluetas.

### Cambios de la v4.48 — Desplegables nuevos, rasgos sólo en el Códice y más aspectos

- **Desplegables propios** (`DK.ui.select` en `js/core/ui.js`, CSS `.dd*` en `css/grim.css`): sustituyen al `<select>` nativo. Botón con el valor, icono opcional y flecha; lista flotante (`position: fixed`, se abre hacia arriba si no cabe) con iconos, marca en el elegido y resaltado al pasar. Teclado: ↑/↓, Inicio/Fin, Intro, Esc, Tab. Se cierra al hacer clic fuera o si la pantalla se repinta sin él. Opciones `{ value, label, icon?, color? }`; el elemento devuelto tiene `.value`. Ya llevan iconos los filtros del Códice (casa con su color, zona y estado) y la ordenación de las cajas. Estilo propio para Exilio.
- **Rasgos sólo en el Códice**: fuera de la ficha del daskai y de «Elige tu daskai». Ajuste nuevo **«Rasgos en el Códice»** (`settings.showTraits`, **desactivado** por defecto): con él se ven la pestaña «Rasgos» y los rasgos en la ficha de especie. Las variantes vistas se ven siempre.
- **Más aspectos** (`systems/looks.js`):
  - Bocas: sonrisa pícara, nerviosa, hocico gatuno, dientes de sable (rara) y morritos.
  - Cabezas: astas, cuernos de carnero, sombrero de seta (rara), flor y cresta punk.
  - Adornos finales: orbes en órbita, runas flotantes, bufanda y corona de espinas.
  - **Alas**: ahora son un rasgo muy raro (7 %) que sólo aparece en la ÚLTIMA evolución; su tipo depende de la casa (plumas, murciélago, aleta o cristal). En el Códice hay una categoría «Alas» (todas cuentan como raras). Se sigue gastando el mismo azar al sortear, así que los aspectos ya creados no cambian (salvo que pierden las alas si no les toca).
- **Entrenamiento**: sin monedas para sacar con experiencia, «Sacar sin experiencia» va debajo a todo lo ancho (`.tr-actions.stacked`) en vez de aplastar el otro botón.
- Tests: desplegables (abrir, teclado, cerrar al hacer clic fuera) y rasgos ocultos por defecto (`tests/screens.test.js`).

### Cambios de la v4.47 — Cada daskai tiene su propio aspecto

- **Motor nuevo de dibujo** (`js/systems/looks.js`, `DK.looks`), que sustituye al de `systems/sprites.js` para todos los daskai (`sprites.js` sólo queda para especies con `sprite.img`).
  - **Casa** (fija): tono de piel, manos y pelo. Luz: almohadillas + pelusa · Oscuridad: garras de sombra + humo · Fuego: garras de brasa + llamas · Agua: aletas + escamas · Tierra: puños de piedra + musgo.
  - **Especie** (fija): la cola de su `sprite.tail`; las especies con `sprite.body: 'ghost'` siguen siendo fantasmas y las serpientes (`body: 'long'` + `legs: 'none'`) no tienen patas.
  - **Individuo** (al azar, al nacer): tamaño 0,78–1,22×, 11 cuerpos, 8 caminos de patas, 14 ojos, 11 bocas, 13 orejas/cuernos, marcas, alas (y en qué etapa salen) y adorno final. Pesos ≤ 2 = rasgo raro (también los tamaños extremos).
  - **Evolución**: conserva cara y piel; el cuerpo crece y madura (`BODY_PATH`), cambian las patas (`LEG_PATHS`), salen alas y la última forma luce su adorno. La etapa visual sale de la posición en la línea (`stageOf`).
  - Se guarda sólo la semilla: `d.look = { s }` (`DK.daskai.create` → `DK.looks.rollLook`). Los jefes (`boss`) no la tienen: usan la **forma típica**, semilla fija por línea (`hash('typ:' + raíz)`). Partidas antiguas: semilla sacada del `uid` (`DK.looks.of(d)`). Las tumbas y el registro de combates guardan también el `look`.
  - `V.sprite(sid, { look })` y `V.dSprite(d)` lo dibujan; todos los sitios que pintan un daskai concreto pasan su `look`. Pixel art propio (`DK.looks.pixel`, caché por especie+semilla, lienzo 96×64 con margen; CSS `.sprite.pixel img` a 150 % y −25 %).
- **Rasgos como iconos** (`V.lookStrip(sid, look, { house })`, `.lk-strip` / `.lk-trait` en `css/grim.css`): cada rasgo es un recorte del propio dibujo (ojos, boca, cabeza, patas, marca, cuerpo, adorno, alas y tamaño, `DK.looks.icon`) y su nombre sale sólo al pasar el ratón (`tip`). Se ve en la ficha del daskai, en «Elige tu daskai» y en el Códice.
- **Códice rediseñado** (`screens/codex.js`):
  - La ficha enseña la **forma típica** (la de los jefes, icono de corona) y la galería **Variantes vistas** de esa línea (`DK.looks.seenOf`, hasta 18); al pulsar una se ve arriba con sus rasgos.
  - Pestaña nueva **Rasgos**: la colección de todos los rasgos por categoría; los no vistos salen en silueta y los raros brillan.
  - Se apunta con `DK.looks.see(d)` al ver un rival en combate, al reclutar y al entrar en tu equipo (`DK.party.add`). Estado: `state.looks = { seen: {raíz: [semillas]}, traits: {cat: {clave: n}} }` (la migración apunta tu equipo actual).
- Iconos nuevos: `maximize`, `footprints`, `smile`, `dna`. Textos: `look.*` (es/en).
- Tests nuevos en `tests/screens.test.js`: el aspecto se conserva al evolucionar, los jefes usan la forma típica, el Códice muestra variantes y la colección de rasgos, y los rasgos son sólo iconos con tooltip.

### Cambios de la v4.46 — Detalle sin parpadeo, pixel art completo e iniciales al azar

- **Sin parpadeo al forjar / usar**: la entrada animada del panel de detalle (`invSideIn`) sólo se pone al abrir OTRO detalle: clase `.fresh` en `.wb-side` (`screens/craft.js`, `params._shown`) y en `.inv-side` (`screens/inventory.js`). El giro de los iconos de cabecera (`headIcon`) sólo se ve al entrar en la pantalla (`.screen.screen-enter`), no en cada repintado.
- **Se deshace lo de la v4.45 que no se pedía**: al usar objetos de experiencia en la Bolsa vuelve a salir la ventana de subida de nivel (y la de evolución); al forjar equipo vuelve a ofrecerse equiparlo. Se mantiene el botón «Equipar» del detalle de Crafteo y la opción `quiet` de `V.afterLevel` (sin uso por ahora).
- **Pixel art completo** (`systems/sprites.js`): colas, alas y llamas que salen del viewBox (`4 -6 112 116`) se cortaban en la versión pixelada (el SVG se ve con `overflow: visible`, la imagen no). Ahora se dibuja con `PAD` = 31,5 unidades a cada lado (lienzo 100×66, misma densidad) y `css/theme.css` ensancha la imagen (`width: 151.52%`, `margin-left: -25.76%`) para que el cuerpo quede donde estaba. 23 especies afectadas (dragones, serpientes, salamandras…).
- **Iniciales al azar** (`screens/newGame.js`): al entrar en «Elige tu daskai» se crea ya cada inicial (`params.rolls`, con genes, naturaleza, pasiva y rasgo al azar) y la ficha enseña ESE daskai: naturaleza, pasiva, rasgo y sus atributos reales con el % sobre lo normal de su especie (`.st-luck`, resaltado `.top` / `.low`). `DK.store.newGame(…, made)` usa ese mismo daskai.
- Tests nuevos: detalle sin `.fresh` tras forjar/usar (`tests/craft.test.js`); iniciales sorteados y cola en el pixel art (`tests/screens.test.js`).

### Cambios de la v4.45 — Campamento retocado y detalle de Crafteo/Bolsa sin ventanas que lo tapen

- **Portal fluido** (`components/campArt.js`): el portal tiene ahora 12 fotogramas que dan media vuelta a las bandas del vórtice (giro continuo) y una capa fija `over()` con el arco de piedra. `DK.pix.animated(name)` devuelve `over` y `animArt` (`components/camp.js`) la pinta encima como `.fr-top`. CSS: `.camp-anim.n12` y `@keyframes cf12` en `css/motion.css`; `.a-portal { --dur: 1.1s }`.
- **Tienda grande y cuadrada**: paredes rectas, tejado a dos aguas con faldón festoneado, solapas recogidas, farolillo y banderín (lienzo 52×42, `base: 38`).
- **Posiciones del campamento** (`SPOTS` en `components/camp.js`): en PC la tienda sube (`x 19, y 61`), el tablón se aparta (`x 40`) y el Códice baja (`y 93`), así ya no se tapan. Nuevas posiciones opcionales `xm`/`ym` para pantallas medianas (< 1100 px, escala 4): yunque y muñeco. Antorchas recolocadas.
- **Sol y luna en el móvil**: `backdrop(tod, narrow)` usa `NARROW_BODY` para ponerlos en la franja del fondo que se ve en pantallas estrechas (arriba a la izquierda, sobre el tablón). `campScene({ tod })` acepta forzar el momento del día (pruebas).
- **Inicio**: el botón «Gestionar» de Tu equipo es sólo el icono del lápiz (`iconOnly`).
- **Crafteo**: al forjar equipo ya no se abre la ventana «¿Equipar ahora?». Si tienes el objeto, el detalle muestra la franja `.wb-equip` con el botón «Equipar» (`.wb-equip-btn`), que abre `V.equipChooser` cuando tú quieras.
- **Bolsa**: usar un objeto de experiencia ya no abre la ventana de subida de nivel ni la de evolución: `V.afterLevel(d, info, { quiet: true })` sólo avisa con un toast; aprender un movimiento sí se pregunta (es una elección).
- **Avisos**: con una hoja o ventana abierta, los toasts no capturan los clics (`css/theme.css`), para que no tapen el botón Cerrar de la hoja en el móvil.
- Test nuevo en `tests/craft.test.js`: forjar equipo y usar un objeto de experiencia no abren ventanas.

### Cambios de la v4.44 — Icono de Crafteo «engranaje con gema» y fondo animado

- **Icono `craftCog`** (`js/core/icons.js`): engranaje grueso de 10 dientes con una gema en el centro, para que no se confunda con «Ajustes». Sustituye a `craftGem` (v4.43) en todos los sitios de Crafteo; se quitan `craftGem` y `craftGear`.
- **Fondo animado** (`js/core/bgfx.js`, `DK.bgfx`): `<canvas id="bgfx">` fijo detrás de todo con un shader WebGL de remolino de pintura, a ¼ de resolución (píxeles gordos, `image-rendering: pixelated`) y a 30 fps.
  - Colores e intensidad desde CSS (`css/motion.css` §6): `--bgfx-a`, `--bgfx-b`, `--bgfx-c` y `--bgfx-op`, distintos en Exilio (brasa y verde azulado), limpio, clásico y tema claro.
  - Sólo fuera de la expedición: se apaga en `DK.bgfx.offScreens` (`expedition`, `battle`, `expSummary`, `gameOver`) y mientras haya una expedición en curso. Se actualiza con `screen:enter`, `settings:changed` y el final de la expedición.
  - Ajuste nuevo **«Fondo animado»** (`settings.bgFx`, por defecto activado; lang `settings.bgFx`/`bgFxDesc`). Con alto contraste no sale; con «Reducir animaciones» queda un fotograma fijo. Se pausa con la pestaña oculta y sin WebGL no hace nada.
- Test nuevo en `tests/craft.test.js`: el fondo sale en Crafteo, se apaga con el ajuste y en la expedición, y la cabecera usa `craftCog`.

### Cambios de la v4.43 — Nuevo icono de Crafteo

- **Icono `craftGem`** (`js/core/icons.js`): gema tallándose con destellos. Sustituye a `anvil` en todo lo que es Crafteo: menú y cabecera (`screens/craft.js`), tarjeta de pendientes (`components/todoCard.js`), paleta de comandos (`components/palette.js`), misiones (`data/missions.js`), logros (`data/achievements.js`), preparar expedición (`screens/expPrepare.js`), perfil (`screens/profile.js`), progreso (`screens/progress.js`), bolsa (`screens/inventory.js`) y wiki (`data/wiki.js`).
- **Alternativa `craftGear`**: engranaje y llave, ya definida en `icons.js`. Para cambiar, basta sustituir `'craftGem'` por `'craftGear'` en esos archivos.
- `anvil` se mantiene para el herrero (`data/events.js`), la entrada de tiers de runas del wiki y el yunque del campamento.

### Cambios de la v4.42 — Iconos de objeto a color, bolsa por usos y crafteo más limpio

- **Iconos de objeto «gema»** (`V.itemIcon` en components/itemViews.js): SVG con la forma de su categoría (batalla = orbe, mejora = rombo, equipo = escudo hexagonal, pieza = losa), rellena con el color del objeto (`it.color`), su símbolo en claro (`DK.icon.raw(name)` da los trazos), brillo y un aro de rareza (raro azul, épico morado, legendario dorado). La caja la sigue poniendo el CSS de cada sitio (`.item-icon`); `.item-icon.ii` quita el fondo antiguo.
- **Bolsa** (screens/inventory.js): pestañas **por uso** (`USE_GROUPS`: Curar, Maná, Estados, Mejorar, Equipo, Otros); los materiales ya no salen (tarjeta «Materiales de crafteo» → Crafteo › Materiales); **buscar y ordenar** son dos botones de icono (la búsqueda se abre al pulsar; ordenar alterna cantidad / nombre / rareza, `params.sort`).
- **Usar en…** con vista previa (`usePreview`): equipo arriba (insignia de equipo) y la reserva en un desplegable; cura/maná con barra y lo que recupera en verde (45 → 75/90 +30), experiencia con los niveles que sube (Nv 5 → 11 +6) y la barra resultante, tónicos (atributo antes → después y tónicos restantes), estados que quita.
- **Crafteo** (screens/craft.js): el detalle ya no se abre solo (pulsar otra vez o la X lo cierra; la lista ocupa todo el ancho), fichas sin la fila de materiales (una barra fina `.wb-prog` con lo que tienes; los materiales en el tooltip y en el detalle), filtros de tipo como iconos en un grupo, «sólo las que puedo» y la búsqueda como botones de icono. CSS §24 en grim.css.

### Cambios de la v4.41 — Taller de runas, tesoro raro, curar pagando y derrota en Normal

- **Taller de runas** (mejora `runas` en data/upgrades.js: 2 / 6 / 12 emblemas): sin ella no hay huecos de runas en la preparación (`DK.runes.enabled()`), no caen runas y las recompensas de runas (Abismo, desafío semanal) no se dan. Nivel 1 = huecos + tier I, 2 = tier II, 3 = tier III (`DK.runes.maxTier()`): `drop`, `roll1` y `canFuse` no pasan de ese tier. Partidas con runas de antes: se les da el nivel de su mejor runa una vez (`state.runesGrandfathered`).
- **Expedición de tesoro**: probabilidad 12 → 1 (≈1%), pero mínimo 5 cofres (`minTreasures`), +100% monedas, +1 emblema por jefe y cofres mejores (`kinds.tesoro.chest`: +2 objetos, 80% de raro extra, +35% de reliquia (también épicas), 50% de runa extra y ×2,5 monedas).
- **Derrota en Normal** (`difficulties.normal.defeatHeal: 0.5`, `DK.rules.defeatHeal()`): `afterEnd({ defeat: true })` deja a todos con al menos el 50% de vida y maná.
- **Curar pagando** antes de salir (Batalla → Tu equipo, botón `.bt-heal-coins`): `DK.expedition.healCost()` = Σ (vida que falta × 3 + maná × 1,5 + 200 si está debilitado + 20 si tiene estado) × (1 + nivel × 3%), redondeado a 10 (`config.expedition.healCoins`); `healPaid()` cobra y cura del todo.
- **Bolsa**: el detalle ya no se abre solo; aparece al pulsar un objeto (pulsar otra vez o la X lo cierra) y la lista ocupa todo el ancho mientras tanto.

### Cambios de la v4.40 — Eficacia clara en combate, pasivas «al entrar» y desafío semanal

- **Botón de ataque v2** (`moveButton` en screens/battle.js, CSS al final de battle.css): 4 capas — nombre + orden (`.bm-order` 1º/2º, con rayo o reloj si tiene prioridad) + tecla · franja de **eficacia** (`.bm-eff` strong/weak/normal con el multiplicador ×1,5 / ×0,75 / ×1; «Casa desconocida» si aún no la conoces; efecto si es de apoyo; «Débil» si golpea su punto débil) · daño previsto, % y «Remata» · coste, poder, precisión (si < 100) y extras (su casa, ruptura). En el móvil la franja muestra sólo icono y multiplicador.
- **Pasivas «al entrar»** (`D.passives[x].entry = { target: 'enemy'|'self', stats, pct, turns }`): Mirada fiera (rival −15% ATQ), Niebla arcana (−15% ATQ.M), Rompecorazas (−15% DEF), Pegajoso (−20% VEL), Arranque (+25% VEL), Adrenalina (+20% ATQ), Foco arcano (+20% ATQ.M), Guardia alta (+20% DEF y DEF.M, 2 turnos). Las tienen en su lista unas 70 especies (también los rivales).
  - Motor (systems/battle.js): `st.timed = { ally, enemy }` con `{ stat, pct, left, src, owner }`; `applyEntry(st, side, ev)` al empezar (texto en `st.entryLog`) y al cambiar (`switchTo`); `tickTimed` al empezar cada turno; `timedMult` entra en `stat()`. Al cambiar, las mejoras propias del que sale se van; lo que le hizo al rival se queda. HUD: `.badge.timed` con el turno que queda.
- **Desafío semanal** (`js/systems/weekly.js`, `DK.weekly`): cada semana (desde el lunes 2026-01-05) un mapa fijo — zona desbloqueada, tamaño mediano o XL, tipo, modificador y 2 pactos obligatorios sacados de la semilla `weekly-wN` — sin runas, corrupción ni pesadilla (no gasta las runas ni cambia la expedición preparada). Puntos = pisos × 100 + emblemas × 150 + monedas / 10 + 1000 si vences al jefe + 500 por mapa extra. Premio la primera vez que vences al jefe en la semana: 3 emblemas y una runa mágica de tier II. `expedition.snapshot()` llama a `DK.weekly.record()`; `state.weekly[id] = { tries, best, rewarded, runs }` (últimas 8 semanas).
  - UI: tarjeta `weeklyCard` en Batalla (columna derecha, `.bt-side`), tabla de récords `weeklyBoard`, chip en la expedición y en el resumen; entrada `weekly` en la guía. CSS §23.

### Cambios de la v4.39 — 20 especies nuevas y evoluciones con sentido (93 especies)

- **Nuevas formas base** (salvajes): Buhíto → Sacerdón (36) · Nubecita → Nubarrón (24) → Tempestis (56) · Cachorrel → Áurelion (40) · Tintillo → Kraknoir (44) · Copito → Nevalis (28) → Auroris (58) · Cuarcito → Gemolito (18) → Topazio (32) · Velita → Llamasanta (36) · Vaporín → Géyserón (30) · Draguijarro → Petrodraco (56) · Escarabito → Esfinxa (44) · Dentolín → Abisalto (54).
- **Nuevas evoluciones** de especies que no evolucionaban o lo hacían raro: Chispón → **Llamarín** (18) → Fuego Fatuo (42) (antes chispa → magma a los 26) · Lavagusano → Magmón (30) · Lucibicho → **Polillux** (20) (antes un insecto se volvía cristal) · Salpicón → **Serpéntola** (26) → Leviatán (48) (antes 46 de golpe) · Hojaral → **Arbolón** (30) · Cangrejón → **Cangrejarca** (32) · Charquito → **Sapolodo** (20) · Arañuria → **Tejenoche** (32). Topazio sube atributos (es ya una tercera fase).
- Especies que ya existían y ahora tienen forma previa llevan `"from"` (conservan su casa, pasivas y ataques propios). Las nuevas intermedias heredan ataques con `learnExtra`.
- **Zonas** (`data/zones.json`): cada una suma 2-4 especies (base nuevas y alguna forma intermedia), todas con al menos 8. Ojo: el % del códice por zona baja al haber más especies.
- Test: `tests/progress.test.js` comprueba que cada evolución apunte a una especie que viene de ella, con más atributos y a más nivel. Formateador de species.json: `scratchpad/spfmt.py`.

### Cambios de la v4.38 — Sin parpadeos en la preparación, menos texto y botones de sólo icono

- **Preparación de la expedición sin parpadeos** (screens/zones.js): `prepCard` va en un contenedor propio (`.bt-prep-host`) que se redibuja solo (`redrawPrep`) al tocar runas, Pesadilla, Corrupción o la mochila; el mapa del mundo y la ficha de la zona ya no se vuelven a pintar.
- **Botones de sólo icono**: `DK.ui.btn({ iconOnly: true })` deja el icono y pasa el texto al tooltip y a `aria-label` (`.btn-icon-only`). Usado en Equipo (buscar, comparar, curar, renombrar y fondo de caja), Inventario (crafteo, curar), mochila (repetir, sugerir, vaciar) y anterior/siguiente de la ficha del daskai.
- **Textos más cortos**: reescritos (es/en) los de mejoras del campamento, cajas, runas, forja, ataques, crafteo, entrenamiento, botín, salvaciones, emblemas, Pesadilla, Corrupción, guía, zonas del códice, reclutas y mochila; la descripción del tipo de expedición pasa a tooltip; los huecos libres del equipo sólo dicen «Hueco libre». Script de ayuda: `scratchpad/short.js <lang.js> <mapa.json>` sustituye valores por clave.
- **Comparar recluta**: la ficha del nuevo queda fija con aire bajo la cabecera (`top: calc(var(--hud-h) + 24px)`), sin pegarse al techo.

### Cambios de la v4.37 — Runas con rareza, pisos por tier, comparar reclutas y retoques

- **Runas con rareza** (`systems/runes.js`): al caer pueden ser normales, **mágicas** (1 modificador) o **raras** (2) — `config.expedition.runes.rarity` (+ `DK.endgame.runeTier()`), `affixes` (élites `elitePct`, `treasures`, `recruits`, `caves` en el mapa; `coins`, `exp`, `shiny` en %) y `tierScale`. Id completo `'base:tier:rareza:k=v,k=v'` (`R.make`, `R.parse` → `{ base, tier, rarity, affixes }`; las normales siguen siendo `'oro'`/`'oro:2'`). `R.roll1(base, tier)` crea una con rareza al azar; `R.affix(id, k)`, `R.key(id)` ('base:tier'), `R.countKey`, `R.idsOfKey`, `R.freeKey`.
  - `R.bonus('coins'|'exp'|'shiny')` suma los modificadores; `R.mapExtra()` devuelve también `rows`, `elitePct`, `treasures`, `recruits` y `generate()` los aplica (combates → élites, tesoros/reclutas extra).
  - **Pisos por tier** de la runa de tamaño: `tierFloors` = pequeño 8/14/18, mediano 14/20/26, XL 20/28/36 (filas = pisos − 2). Sin runa, el tamaño normal.
  - **Fundir**: 3 de la misma runa y tier de cualquier rareza (primero las de menor rareza) → tier siguiente con la rareza más alta de las tres y modificadores nuevos.
  - UI: `V.runeRarity` (`rr-n/m/r`), `V.runeAffixes`, `V.runeTip`; la gema lleva halo azul (mágica) o dorado (rara). El selector de runas va **agrupado por tier** (III → I) con filtro por clase y sólo enseña las que tienes. La forja muestra el desglose por rareza. CSS §22 en grim.css.
- **Equipo completo al reclutar** (`joinCompare` en screens/expedition.js): el nuevo con todos sus atributos (fijo arriba en el móvil) y cada miembro con los suyos, la diferencia ▲/▼, cuántos atributos gana el nuevo y «Sustituir aquí». CSS §21.
- Pesadilla: icono nuevo `demon` (calavera con cuernos) y ya no parpadea al activarla: la entrada animada de pantalla (motion.css) sólo va con `.screen-enter` (al cambiar de pantalla, no al refrescar).
- Campamento: quitado «Curar con objetos» de la tarjeta del equipo (queda «Gestionar»).

### Cambios de la v4.36 — Estilo «Exilio» (tipo Path of Exile 2), colores de atributos y sin onda al pulsar

- **Estilo «Exilio»** (`css/exile.css`, nuevo por defecto): Ajustes → Estilo → Exilio / Limpio / Clásico. Se activa con `<html data-skin="exile">` **encima** del estilo limpio (`data-style="clean"`) y sólo con tema oscuro (con tema claro se ve el limpio). Piedra casi negra con grano (SVG feTurbulence) y viñeta; paneles de metal con borde de bronce y remates dorados en las esquinas (`--ex-corners`, capas de fondo, sin pseudo-elementos); títulos en Cinzel oro viejo con filigranas en la cabecera; botones como placas de hierro biseladas y el principal en lacre granate con filo dorado; pestañas de cuero y bronce; barras enmarcadas; tooltips como fichas de objeto; rarezas con los colores clásicos (normal, mágico azul, raro amarillo, único naranja); logo dorado.
  - Ajustes: `uiStyle` = `'exile' | 'clean' | 'classic'`; `settings.apply()` pone `data-style` y `data-skin`. Las partidas con el estilo limpio por defecto pasan a «Exilio» una vez (`styleV: 2`); el script inicial de `index.html` hace lo mismo para no parpadear.
  - Para tocar el estilo: todas las reglas usan el prefijo `:root[data-skin="exile"]:not([data-theme="light"])[data-skin][data-skin]` (gana al limpio).
- **Atributos con su color** (grim.css §20): cada fila de la tabla (`.st2-row.k-<atributo>`) tiene su color en el icono, el valor y el filo de la barra. Y se arregla que las barras de desglose salieran de un solo color: la regla del selector segmentado de clean.css pisaba `.seg` (que también son los tramos de las barras); ahora es `.seg[role="radiogroup"]`.
- **Sin onda al pulsar**: quitado el `.tap-ring` de `js/core/fx.js` y motion.css (se mantiene el pequeño rebote del icono).
- Barra de dibujo del mapa con botones compactos en el estilo limpio.

### Cambios de la v4.35 — Estilo limpio moderno, campamento animado y microanimaciones

- **Estilo limpio v2** (`css/clean.css` §20, sólo `data-style="clean"`): tipografía sin versalitas (`--font-pixel` → Alegreya Sans), botones finos (36 px, borde de 1 px, iconos de 17 px, elevación al pasar y anillo de foco), tarjetas con esquinas de 14 px y sombras en capas, pestañas grandes (`.inv-tabs`) y `DK.ui.segmented` como control segmentado, chips e insignias en píldora, barras finas, cabecera sin cinta, barra de accesos flotante con subrayado en el activo, cajas del equipo sin relieve. El estilo clásico no cambia.
- **Campamento animado** (`js/components/campArt.js`): los lugares tienen pixel art nuevo con sombreado, contorno (`DK.pix.outline`) y varios fotogramas — tienda (banderín y bajo al viento), hoguera (4), yunque (lingote al rojo y chispas), muñeco (se balancea), atril (vela y runas flotando), tablón (nota que se agita), portal (vórtice que gira) y antorchas. `DK.pix.animated(nombre)` → `{ frames, base }`; `animArt()` en camp.js los apila en `.camp-anim.nN` y `css/motion.css` los alterna (`--dur` por dibujo). Los dibujos sencillos siguen en `DK.pix.sprites` (los usan el mapa del mundo y la expedición).
- **Microanimaciones** (`css/motion.css`, en los dos estilos): destello en monedas/emblemas y salto cuando cambian (`.hud-pill.bump`, app.js `renderRes`), campana que se agita si hay avisos, puntos de aviso que laten, iconos del dock que se mueven al pasar y flotan si están activos, brillo en el botón principal, huecos de entrenamiento listos que brillan, entrada suave de las pantallas y movimientos propios de cada lugar del campamento (tienda, muñeco al pulsar, yunque, tablón, atril).
- **Al pulsar** (`js/core/fx.js`): `.is-pressed` en botones, pestañas, fichas y lugares (el icono rebota; los lugares del campamento se aplastan) y un anillo `.tap-ring` donde pulsas. Todo se apaga con «Reducir animaciones» (`data-motion="reduced"`).

### Cambios de la v4.34 — Códice con zonas y guía; funciones en el perfil

- **Códice → Zonas** (`zonesTab` en screens/codex.js): una tarjeta por zona con su % (`DK.codex.completion`), especies descubiertas/combatidas, jefe vencido y «Pesadilla» al 100% (si ya se ve el final del juego). Pulsar abre Daskai filtrado por esa zona. La pestaña muestra el % medio.
- **Códice → Guía** (`wikiTab`): wiki de lo desbloqueado. Entradas en `js/data/wiki.js` (`DK.data.wiki`, grupos `DK.data.wikiGroups`): `{ id, group, icon, when(), vars(), stat() }`; textos en lang `wiki.e.<id>.{t, b}` (`b` con `\n` = párrafos). Lo no desbloqueado sale como «N por descubrir». Helpers `DK.wiki.known/unlocked/title/body`. `params.wsel` abre y centra una entrada.
- **Perfil → Funciones desbloqueadas** (`featuresCard` en screens/profile.js): las entradas de la guía desbloqueadas con `stat()` (runas, emblemas, entrenamiento, crafteo, Senda, jefes, corrupción, pesadilla, abismo, ascensión, formas, grabados…). Aparecen solas al desbloquearse; pulsar abre la guía. CSS §19 en grim.css.
- Para añadir una entrada: añádela en `data/wiki.js` y escribe `wiki.e.<id>.t` y `.b` en es/en.

### Cambios de la v4.33 — Entrenamiento más lento y mejoras compactas

- Ritmo mucho más lento: `pct(lv)` = 0,008 / (1 + nivel/10) por minuto, `ramp` +12,5%/h hasta ×2, acelerador sólo ×2/×3 (`boostCost` = (m−1)·(60 + 12·nivel)). Sin acelerador, en 24 h un Nv 3 llega a ~14 y un Nv 30 a ~35; con todo al máximo, Nv 3 → ~35.
- Máximo 4 huecos: 2 de base + 2 del Instructor (niveles 1 y 3).
- Las mejoras del campo cuestan **emblemas de jefe + monedas** (3+3.000, 6+10.000, 10+25.000, 15+60.000). `DK.training.cannotBuy()` → `'max' | 'emblems' | 'coins' | null`.
- Panel de mejoras compacto (`.tr-up-head`, 4 segmentos `.tr-step`, precio y botón en una línea, «Siguiente: …» debajo; el detalle de cada nivel en el tooltip).

### Cambios de la v4.32 — Entrenamiento simplificado (`systems/training.js`, `screens/training.js`)

- Sólo experiencia: fuera el entrenamiento de atributos, el nivel recomendado y los planes «pagar más / más tiempo».
- Ritmo por nivel actual (`config.training.pct`), más rápido cuanto más tiempo (`ramp`, hasta ×3 a las 8 h), tope `maxHours` (24 h).
- Se cobra **al sacarlo** (`fee` por minuto × aceleración); acelerador ×2/×3/×5 pagado al dejarlo. Sin monedas: «Sacar sin experiencia».
- Instructor: huecos, +% ritmo y −% cobro (`discount`). CSS `.tr-boost`, `.tr-plan`, `.tr-bill`, `.tr-fee` en grim.css. Test en `tests/shop.test.js`.

### Cambios de la v4.31 — Final del juego (`data/endgame.js`, `systems/endgame.js`)

- **Runas con tier I-III** (`systems/runes.js`): el id lleva el tier (`oro`, `oro:2`, `oro:3`; `DK.runes.parse/withTier/get/roman/mult`). Bonificaciones × `runes.tierMult` [1, 2, 4]; tamaño/tipo de tier II-III dan +(tier−1) emblemas por jefe (`emblemBonus`); XL III añade 2 cuevas (`mapExtra`). Caen de tier mayor según profundidad, Corrupción y jefes ocultos (`DK.endgame.runeTier()`). **Forja rúnica** en Crafteo → Runas: 3 iguales → 1 del tier siguiente (`fuse`, 500/2000 monedas). Runas nuevas de final de juego (`late: true`, se ven con la Corrupción): **campeones** (`elites`: +1 mini jefe por tier) y **botín maldito** (`loot`: +30% monedas por tier y un objeto más en cofres, `noRest`: sin hogueras). `generate(..., extra)` recibe `minElites`, `noRest`, `noShortcuts`, `caves` (`DK.expedition.mapExtra`).
- **Corrupción 1-5** (`DK.corruption`, `state.corruption.max`): oculta hasta vencer al jefe de la 3ª zona (entonces se abre el nivel 1); el nivel n+1 se abre al vencer a un jefe de mapa con el n activo (`onBoss` en `bossCleared`). Cada nivel: rivales +3/6/9/12/15 Nv. y +10-50% atributos; reglas acumuladas: II hogueras a medias, III jefes +30% vida, IV mercaderes al doble, V sin atajos; premios: +1-5 emblemas por jefe, +15-80% monedas, +1-5% variocolor, más runas de tier alto. Se elige en Batalla (`.bt-endgame`), se guarda en `nextExpedition.corruption` → `e.corruption`.
- **El Abismo** (`DK.abyss`, `state.abyss`): tipo especial `abismo` (`kinds.abismo.special`, tamaño `abyss`: 4 pisos + hoguera + jefe). Se abre con 5 jefes de zona vencidos. Cada mapa es un piso: +4 Nv. y +4% por piso; récord y premio cada 5 pisos (emblemas, 2 runas de tier creciente, monedas y fragmento abisal cada 10).
- **Versión pesadilla** (`DK.nightmare`): zona con el códice al 100% → rivales +8 Nv. y +20%, cofres de objetos raros+, +40% monedas, +1 emblema por jefe (sólo en esa zona).
- **Ascensión** (`DK.ascension`, `d.stars`): al nivel máximo vuelve al 1 con una estrella (+6% a todo, máx. 5); conserva ataques, talentos, tónicos y bonus de evolución (`growth` = `evoBonus`).
- **Formas alternativas** (`d.variant`): el objeto `fragmento_abisal` despierta la forma abisal de una forma final (+8% a todo, sprite `.variant-abisal`, insignia). Cae de jefes ocultos (50%), del Devorador (100%), de jefes con Corrupción III+ (25%) y del Abismo.
- **Reliquias grabadas** (`DK.engrave`, `vault.engraved`): las épicas desbloqueadas se graban por 8 emblemas y salen siempre al empezar; 1 hueco (+1 con Corrupción III abierta).
- **Variocolores:** marco por casa (`shiny_<casa>` en `components/avatar.js`) y **rastreo** (`DK.tracking`, `state.tracking`): cada derrota de una especie +0,1% de variocolor para ella (máx. +3%), en salvajes y reclutas.
- **Temporadas de la Senda** (`seasons` en `data/endgame.js`: desde el 2026-11-02, 42 días): al cambiar de temporada se reinician puntos y niveles; los marcos y títulos cobrados se quedan en `state.cosmetics`; cada temporada tiene su terna de marcos (`senda{n}_bronce/plata/oro`) y títulos (`senda{n}_15/30`).
- **Zona secreta final «Corazón del Vacío»** (`zones.json → vacio`, `secretZone: true`, `drops`): no se ve hasta vencer a todos los jefes ocultos (`DK.endgame.checkFinalZone`). Jefe «El Devorador del Vacío», materiales `fragmento_vacio` y `corazon_vacio`, y el mejor equipo: `filo_vacio`, `egida_vacio`, `corona_vacio`.
- Rivales: `DK.daskai.mult` aplica `DK.endgame.enemyStat` y `bossHp`; tus daskai, estrellas y forma. `levelBonus` suma `DK.endgame.levels()`.
- Prueba: `tests/endgame.test.js`.

### Cambios de la v4.30

- **Mochila al caer derrotado** (`difficulties.keepPack`, `DK.rules.keepPack()`, `DK.expedition.packOnDefeat()`): en Normal y Difícil vuelve a la bolsa de casa lo que metiste en la mochila al salir (`e.packed`) y no has gastado: `min(lo que queda, lo que metiste)` por objeto (se gasta primero lo encontrado). En Pesadilla se pierde todo. Lo encontrado por el camino (objetos de más en la mochila y los objetos del botín) se pierde siempre, también al caer ante el jefe (que sigue salvando el 25% de las monedas y da la recompensa de consuelo). Batalla enseña la regla en la preparación (chip «Si pierdes, tu mochila vuelve» / «…pierdes la mochila»); el resumen enseña lo que vuelve y lo que se pierde.
- Prueba: `tests/defeat.test.js`.

### Cambios de la v4.29

- **Senda del aventurero** (`data/pass.js`, `systems/pass.js` → `DK.pass`, `state.pass = { xp, claimed, extra }`): misión diaria cobrada +25, semanal +80, logro +40 (oculto +80) puntos (`DK.data.pass.points`). Nivel n pide `xpFor(n) = 100 + (n-1)·10`. 30 niveles con premio (monedas, objetos, runas, emblemas, marcos `senda_bronce/plata/oro` en los niveles 10/20/30 y títulos `senda15`/`senda30`); después, cada 400 puntos un cofre repetible (500 monedas + runa). Se cobran en Progreso (nodo a nodo o «Cobrar N»); la medalla de Progreso suma los niveles sin cobrar. Las partidas antiguas reciben en `store.migrate()` los puntos de los logros que ya tenían. Marcos en `components/avatar.js` (FRAMES) y títulos `pass:<id>` en `DK.avatars.titles()`.
- **Logros con premio visible y por categorías:** cada logro enseña sus monedas, sus puntos de senda y su título. `a.cat` (combat, collection, expedition, bosses, craft; en `data/pass.js`) con filtros y % por categoría (`DK.achievements.byCat()`). Los ocultos enseñan una pista (`achievements.<id>.hint`, también `bossZone.hint`). Sin vínculo se quitan `firstCapture` y `captures15` (`data/hidden.js`).
- **«Casi lo tienes»** (`DK.achievements.near(3)`): misiones sin terminar y logros visibles ordenados por % con un botón «Ir» a la pantalla donde se avanzan.
- **Cambiar una misión al día** (`DK.missions.canReroll()` / `reroll(m)`, `state.missions.rerollDay`): botón ↻ en las misiones sin terminar de Progreso; la nueva no repite ninguna de las actuales.
- Prueba: `tests/pass.test.js`.

### Cambios de la v4.28

- **Perfil rediseñado** (`screens/profile.js`, grim.css §16): sin lema (tampoco en la tarjeta para compartir; `player.motto` se conserva en la partida pero no se usa). Cabecera con foto redonda y halo del color de la casa del líder, título como desplegable en una píldora, nombre editable sin caja, datos de la partida (tiempo, desde, ranura, dificultad) y a la derecha 4 cifras grandes (% victorias, combates, mayor profundidad, jefes). Debajo, «Avance de la partida» (especies, objetos, zonas, jefes, logros y recetas con barra, n/total y %, más un % global) y una rejilla de 8 cifras con su detalle (racha, mayor golpe, expediciones y mapas XL, daskai, evoluciones y variocolores, crafteos y recetas conocidas, monedas ganadas y actuales, emblemas y runas). El resto (últimos combates, resultados, por casa y zona, favoritos, logros, expediciones y estadísticas detalladas) se mantiene. Sin vínculo, la leyenda no muestra «Vínculo».

### Cambios de la v4.27

- **Crafteo en mesa de trabajo** (`screens/craft.js`, grim.css §15 `.wb-*`):
  - Pestañas Consumibles (consumibles y tónicos) · Equipo (con ataque, con pasiva, de atributos) · Materiales; filtros por tipo, «Objetivos», «Sólo las que puedo» y buscador. `params.tab`: `consum` | `equip` | `materials` (`recipes` se traduce a la pestaña de la receta elegida).
  - Fichas en cuadrícula (`recipeTile`): icono, nombre, estado (`Lista ×n`, `Con pasos`, `Falta 1`, `Faltan N`) y los materiales con tienes/necesitas en verde o rojo. Orden: listas, con pasos, falta 1, el resto (atenuadas).
  - Mesa (`recipeDetail`) a la derecha, siempre con una receta elegida en escritorio (hoja inferior en el móvil): efecto, materiales en huecos con la zona donde cae cada uno (`sourceChips`: las abiertas con «Ir →» → `DK.router.reset('zones', { zone })`, bloqueadas con candado, deshabilitado en expedición), atajo a la receta del material, nota de lo que falta, cantidad y «Forjar».
  - Materiales en fichas con su detalle (dónde se consigue y recetas que lo usan).
- **Estilo limpio / clásico** (`css/clean.css`, ajuste `uiStyle`: `clean` por defecto | `classic`; `<html data-style>`, aplicado también en el script de `index.html` para que no parpadee; Ajustes → Apariencia → Estilo). Todo `clean.css` va bajo `:root[data-style="clean"]` (con `[data-style]` repetido para ganar especificidad a grim.css): tarjetas planas de borde fino, sin remaches, botones sin relieve, pestañas subrayadas, chips discretos, cabecera y dock translúcidos y el menú principal moderno (antes §14 de grim.css). Con `classic` no se aplica nada de ese archivo.
- Prueba: `tests/craft.test.js`.

### Cambios de la v4.26

- **Menú principal más moderno** (grim.css §14, todo bajo `.main-menu` con variables `--mm-*`): tarjetas planas con borde fino y radio pequeño (sin remaches), la última jugada con un filo dorado arriba, retrato redondo, estadísticas sin cajas separadas por líneas finas, botón principal rectangular y sin relieve, opciones como fila de texto con icono (Exportar, Importar, Reiniciar, Borrar) y Ajustes/Ayuda/Salir también planos. Los botones principales ya no llevan descripción salvo «Tu equipo sigue de expedición».
- Propuesta de crafteo (sin implementar): maqueta de «mesa de trabajo» con materiales tienes/necesitas en cada receta y dónde conseguir cada material (`scratch/crm.js`).

### Cambios de la v4.25

- **Cristales de vínculo ocultos** (`js/data/hidden.js`, cargado tras los datos): con `config.captureEnabled = false`, los objetos con `use.capture` quedan en `DK.data.hiddenItems` y se quitan de drops de especies/jefes/jefes ocultos, recetas, `shopStock`, bolsa inicial y misiones (fuera la de vincular; las que daban un cristal dan +50% monedas). `DK.bag.add` los ignora y `DK.bag.list`, el códice, sus totales y la paleta los filtran (`DK.data.isHidden(id)`). Siguen en `data/items.json`: al activar el vínculo vuelven solos.
- **Menú principal** (`screens/mainMenu.js`, grim.css §13): cada ranura con «Ranura N» y «Última jugada», retrato + nombre + fecha, cuadrícula fija de 6 estadísticas (mejor nivel, daskai, tiempo, monedas, zonas, jefes; `store.slotMeta` da también emblemas, expediciones, dificultad y si sigue de expedición), chips de dificultad/caídos/fin, y abajo el botón principal y una fila de 4 opciones iguales (exportar, importar, sobrescribir, borrar). Los botones quedan a la misma altura en las tres ranuras.
- **Iconos de objetos nuevos** (`core/icons.js`): potion, potionLarge, etherBottle, pill, jar, elixir, berry, vial (tónicos, distinguidos por su color), claw, ring, boot, pearl, drum, prism, armor, cloak, earring, brazier, sprout, carapace, dust, starTear. Asignados en `data/items.json` (`node tools/data.js`).
- Prueba: `tests/menu.test.js`.

### Cambios de la v4.24

- **Ficha del daskai más simple** (`components/daskaiPanel.js`, grim.css §12): la acción principal (añadir al equipo / líder / evolucionar / ir al entrenamiento) va con texto y el resto en una barra de iconos con nombre al pasar (`.dp-tools`: quitar del equipo, usar objeto, curar, liberar). El apodo se cambia con el lápiz junto al nombre.
- **Atributos compactos** (`V.statTable`, clases `.st2-*`): cada atributo es un `<details>` con nombre, marcas (naturaleza, ritmo de crecimiento, rasgo), valor y barra por colores; al pulsarlo se ve el desglose en texto. «Ver todo el desglose» los abre todos y la leyenda va plegada. Nada de información se ha quitado, sólo se ha plegado. En móvil la cabecera se reordena y las pestañas caben (icono, nombre y contador apilados).
- **Runas en tema claro:** panel de pergamino con los engastes de piedra.
- Prueba: `tests/detail.test.js`.

### Cambios de la v4.23

- **Runas con 4 huecos** (`config.expedition.runes.slots`): en Batalla, `.bt-runes` es una fila con 4 huecos de piedra; pulsar uno vacío abre el selector (`runePicker`, modal `.rune-modal`) y pulsar uno lleno lo vacía. Se guardan en `nextExpedition.runeSlots` (las partidas con el `runes: {size, kind}` de la v4.22.0 se leen igual).
  - Reglas (`DK.runes.slots()` / `canSocket` / `socket` / `unsocket`): como mucho una de tamaño y una de tipo (otra del mismo grupo la sustituye); las de **bonificación** se repiten.
  - Runas nuevas de bonificación: `oro` (+25% monedas, se suma en `addLoot`) y `saber` (+25% experiencia, en `battle.rewards`), vía `DK.runes.bonus('coins'|'exp')` sobre `expedition.runesUsed`.
  - Aspecto de gema rúnica: `V.runeGem(id, size)` (SVG con glifo brillante, color por runa en `RUNE_LOOK`, `zones.js`) y `V.runeEffect(id)`; también en el cofre y en el cartel del combate.

### Cambios de la v4.22

- **Runas de expedición** (`systems/runes.js`, `config.expedition.runes`): sustituyen a las Mejoras «Rumbo» (las partidas que las tenían recuperan sus emblemas en `store.migrate()`).
  - Caen en cofres (30%), élites (35%), jefes (1 segura) y jefes ocultos (2). Se guardan para siempre en `state.runes = { id: n }` (no se pierden al caer). Salen en las tarjetas del cofre, en el log/cartel del combate y en el resumen (`lastExpedition.runes`).
  - Seis runas: tamaño `small` / `medium` / `xl` y tipo `captura` / `combate` / `desafio` (la de desafío necesita haber vencido a un jefe).
  - En Batalla (`zones.js prepCard → .bt-runes`) se pone una de tamaño y/o una de tipo con un toque (`DK.runes.toggle(id)`); otro toque la quita. `nextExpedition.rolled` guarda lo que salió al azar, así que quitarla vuelve a eso (no sirve para re-sortear). La runa de tamaño gana a los tamaños propios del tipo (captura XL es posible). `DK.runes.apply(n)` calcula tipo/tamaño; `DK.runes.consume(n)` las gasta en `start()` (`expedition.runesUsed`).
- **Campamento con ciclo de día y noche oscuro** (`components/camp.js → GRIM[tod]`): día ceniciento con sol pálido y sin estrellas, amanecer y atardecer con sol de brasas, noche con luna de sangre y estrellas; según la hora real (`timeOfDay`). `DK.views.campBackdrop(tod)` para pruebas. CSS `.camp-scene.grim.tod-*`.
- **Hoguera sin parpadeo:** elegir a quién entrenar sólo cambia clases y el botón (no repinta la pantalla).
- **Mercader:** «Seguir el camino» también arriba (`.mr-top .mr-skip`).
- **Tema claro:** los paneles del campamento y `.camp-screen` sólo son oscuros en tema oscuro; colores legibles para chips de tamaño/modificador, emblemas, monedas, casas, rarezas, pestañas, botín y runas (grim.css §10). El fondo de la expedición ya no se pone negro en claro (era el destello al cambiar de pantalla). Script de contraste: `scratch/lc.js`.

### Cambios de la v4.21

- **Sin vínculo en combate** (`config.captureEnabled: false`): `DK.battle.cannotCapture` lo bloquea, los cristales no salen en la bolsa del combate ni en el mercader ni en la mochila sugerida, y la reliquia de vínculo no se sortea. Los daskai se consiguen en los nodos de reclutas (que ahora cuentan para el encargo «recluta»). Para volver a activarlo basta con poner `captureEnabled: true`.
- **Variocolores en los reclutas:** cada candidato tiene `config.expedition.recruitShinyChance` (4%) de serlo, más el `shiny` del tipo de expedición (captura +4%).
- **Equipo de 6** (`config.maxTeam`); la barra del equipo en expedición tiene 6 huecos.
- **Hoguera:** dos opciones grandes, Descansar (todo el equipo) o Entrenar, en la que eliges a quién con retratos: `DK.expedition.train(uid)` le da justo la experiencia que le falta para **subir 1 nivel**.
- **Cofre:** al abrirlo, cada cosa sale en su tarjeta (con animación): monedas, objetos (con su rareza, qué hacen y si van a la Mochila —ya usables— o al Botín —al volver—), reliquias y recetas.
- **En expedición no se ve el monedero de casa:** la cabecera enseña el botín (con lo que se paga en el mercader) y los emblemas.
- **Mover entre cajas:** clic derecho en un daskai → «Mover a otra caja…» (`V.moveToBox`: cada caja con sus huecos libres, o una caja nueva), o arrastrarlo y soltarlo sobre el número de otra caja.
- **Nada de «null» en pantalla:** `replaceChildren`, `append` y `prepend` ignoran null / undefined / false (core/ui.js), como ya hacía `h()`. Era el «null» bajo la vida del rival en los combates normales (la barra de ruptura sólo existe en jefes y élites).

### Mercader de la expedición

`merchantPanel` (screens/expedition.js) es una lista de filas iguales (icono, nombre, efecto, quedan, precio, cantidad − / + y «Comprar»), con pestañas Comprar · Vender. **Se paga sólo con las monedas del botín** (`DK.expedition.buyOffer` ya no toca el monedero) y lo que se vende en una expedición también va al botín (`DK.shop.sell`). Cambiar la cantidad o comprar redibuja sólo el panel (`draw()`), no la pantalla, así que no parpadea; los contadores del botín de la cabecera se actualizan aparte (`[data-loot-coins]`, `DK.app.renderRes`).

### Campo de entrenamiento

- **Elegir daskai** (`picker` en screens/training.js): cuadrícula de fichas con retrato, nivel, % de nivel por minuto y si está en el equipo; al elegir, acelerador (`.tr-boost` ×1/×2/×3/×5) y previsión (`.tr-plan`); filtros Todos · Equipo · Cajas; los que no pueden entrar, aparte y plegados, con el motivo.
- **Mejoras del campo** (antes la Mejora «Instructor» de emblemas): ahora se compran con **monedas** en el propio campo (`DK.training.buyLevel()`, `level()` en `state.training.level`; las partidas antiguas conservan el nivel que tenían). Niveles en `config.training.instructor`: huecos, +% de ritmo y descuento en el cobro al sacarlo; cuestan emblemas de jefe + monedas (`emblems`, `cost`).

### Crecimiento por nivel

Cada nivel da `config.growth.level` ([2, 3]) × el ritmo del atributo (`growthWeight`: especie y pasiva, entre `growthBias.min` y `max`) + la naturaleza. La flecha (▲▲ ▲ ● ▼ ▼▼, `growthRate`) sale de la **media real** (`DK.daskai.growthAvg`) comparada con la normal, y su tooltip dice cuánto gana de media por nivel. Antes el rango 1-3 era tan amplio y la flecha mezclaba la naturaleza de otra forma, que un ▲▲ podía subir lo mismo que uno normal en una subida concreta.

### Música

`systems/audio.js` compone en tiempo real con capas: dron grave filtrado, pad de coro lento, melodía escasa (`pluck` cuerda, `harp`, `bell` campana, `brass` metal), tambores (`soft` o `war`) y ambiente (`wind`, `waves`, `drip`, `whisper`), sobre escalas menores (eólica, frigia, armónica, dórica). Cada zona tiene su pista (la de su `scene`), el campamento `menu` (guitarra junto al fuego), los jefes `boss` y los ocultos `boss_secret`. En expedición, el mapa, el equipo y la mochila suenan con la pista de la zona (`DK.audio.zoneTrack()`), y cambia al pasar a un mapa nuevo.

### Campamento oscuro

`components/camp.js` pinta un campamento de fantasía oscura: cielo sangriento con luna roja, ruinas de una catedral con ventanas encendidas, montañas afiladas, árboles muertos, tumbas, camino de losas hacia un **portal** de piedra con un vórtice rojo (lleva a Batalla), antorchas, niebla que se desliza y ascuas que suben de la hoguera. Las placas son de hierro con filo dorado y letra Cinzel. Los paneles del Inicio son de piedra oscura con borde dorado y botones carmesí (`css/game.css` §18). La hora real sólo cambia el saludo y algo la luz del cielo.

### Mapa del mundo (pantalla Batalla, `screens/zones.js`)

Tres bloques, de arriba abajo (estilos en `css/game.css` §8):

- **Cartel de la expedición** (`expeditionHero`, `.bt-hero`): la escena de la zona de fondo, una línea de texto, chips (primer mapa, tamaño, clima, récord, modo difícil) y un único botón grande (empezar / ver mapa). Los avisos (equipo herido…) salen debajo sólo si los hay.
- **Mapa del mundo** (`worldMap`, `.wm2-*`): un camino de tierra en pixel art (SVG con curvas entre paradas) sobre franjas de terreno (`DK.pix.terrain` con los colores de cada zona) y adornos (`DK.pix.sprites`). Paradas: las zonas desbloqueadas, la siguiente «???» (con la pista para abrirla en el `tip`) y el resto «+N», con niebla gris. La corona marca el jefe derrotado; «Recomendada» o «En expedición» van encima. Tu líder salta sobre la zona elegida. Las posiciones son relativas al centro (`calc(50% ± px)`), así que el mapa llena la tarjeta con pocas zonas y se desplaza en horizontal con muchas (centrado en la elegida). Constantes: `STEP` (separación), `MAP_H`, `yAt(i)` (zigzag).
- **Ficha de la zona elegida** (`zoneCard`, `.bz-*`): dibujo con sus daskai (siluetas si no están en el códice), nivel, jefe, descripción, una tira de récords (`recordsStrip`: victorias, códice, mapas, profundidad, XL, jefe oculto, mapa más rápido) y el combate libre.

← / → cambian de zona, Enter empieza o continúa la expedición. Ya no hay panel lateral ni hoja en el móvil: la ficha va siempre debajo del mapa (en el móvil se desplaza hasta ella al elegir).

### Combate: intención, defensa y fases de jefe

- **Intención:** el rival elige su acción antes de tu turno (`st.intent`, de `enemyChoice`). `DK.battle.intentInfo(st)` dice el tipo (ataque, golpe fuerte, curación, mejora…) y el daño previsto al aliado actual; la pantalla lo pinta bajo su vida y avisa si es letal.
- **Prioridad:** un ataque puede tener `priority: 1` (rápido) o `-1` (lento) en `data/moves.js`. `DK.battle.orderFor(st, tuAtaque)` decide quién va primero (prioridad y, si empatan, velocidad); la pantalla lo enseña en cada ataque (1º/2º) y en la línea de tiempo.
- **Casas y daño:** la eficacia se calcula con la **casa del ataque** (`moveHouse(d, move)`: la del movimiento o, si no tiene, la del daskai) contra la casa del daskai que recibe (`houseMult`: ×`house.strongDamage` si es fuerte, −`house.weakDefense` si el defensor es fuerte contra ella). Si el ataque es de la misma casa que quien lo lanza suma ×`config.stab` (`isStab`). `effOf(st, moveId)` da la eficacia de un ataque concreto. Todo sale en el desglose (`factors().parts`: `stab`, `house`, `broken`…).
- **Ruptura** (jefes y élites, `config.breakGauge`): `st.breakVal/breakMax`. Cada golpe tuyo suma `breakGain(st, move, r)` (golpe normal + eficaz + punto débil + crítico; un golpe poco eficaz no suma). Al llenarse (`addBreak`), `st.broken` = 1: el rival no actúa (`enemyAct`) hasta el final del turno siguiente, recibe ×`dmg` y la barra vuelve a 0 con un máximo ×`grow`. `intentInfo` devuelve `type: 'stunned'`.
- **Previsión de daño** (`screens/battle.js`, `preview(mid)`): en cada botón de ataque, rango, % de la vida del rival, eficacia, «Su casa», «Remata/Puede rematar» y cuánto llena la ruptura; al pasar el ratón o enfocar, la barra de vida y la de ruptura enseñan el efecto.
- **Automático:** `bestMove(st)` elige el ataque. Si el ajuste «Curar en automático» (`autoHeal`) está activo y el aliado baja de `config.autoHeal.at`, primero usa su ataque de curación y si no tiene, `autoHealItem(st)` (el objeto curativo más barato que recupere al menos la mitad de lo que falta; nunca legendarios), como mucho `autoHeal.max` veces por combate (`st.autoHeals`). Después actúa «Pausar el automático».
- **Cambio táctico:** el daskai que entra al cambiar recibe `config.switchMult` del daño ese turno; el banquillo enseña cuánto le haría la intención del rival (`intentVs`).
- **Punto débil:** cada especie recibe `config.weakMult` más de daño del tipo de ataque de su defensa más baja (`weakness`). Se descubre al golpearle con ese tipo (`state.weakKnown`).
- **Desglose de daño:** `DK.battle.factors(st, lado, ataque)` devuelve todos los multiplicadores; `damage()` los usa y la pantalla los muestra al pasar por un ataque o por la intención.
- **Información progresiva:** `knowledge(st)` = combates contra esa especie en la zona: con 1 ves su casa, con `revealMovesAt` sus ataques y con `revealStatsAt` sus atributos.
- **Defender** (`{type:'guard'}`): actúa primero, recibe `config.guardMult` del daño y recupera `guardMana` de maná.
- **Fases de jefe** (`data/zones.json` → `boss.phases` / `secretBoss.phases`; tipos en `data/basics.js` → `phaseTypes`): `st.phases` se comprueba tras cada golpe (`checkPhase`) y `enterPhase` aplica furia, regeneración, escudo (`st.shield`, lo rompe un ataque eficaz) o frenesí (`st.frenzy`). Para un tipo nuevo: añádelo a `phaseTypes`, impleméntalo en `enterPhase` y escribe `phase.<tipo>`, `phase.name.<tipo>` y `phase.desc.<tipo>`.

### Combate en pantalla

`screens/battle.js` se divide en:
- **Arena:** controles en `drawToolbar()` y últimas líneas del registro en `ticker` (el registro completo se abre con L).
- **Panel de mando:** 4 ataques (`moveButton()`) y acciones.
- **Banquillo:** `renderBench()`, con el informe de ventaja contra el rival de `matchup()`.

El modo automático arranca si el ajuste `autoBattle` está activo y se pausa con poca vida si `autoPause` lo está.

### Bus de eventos

`DK.emit('nombre', datos)` avisa y `DK.on('nombre', fn)` escucha. Misiones, logros y estadísticas (`systems/progress.js`) funcionan así, sin que el combate sepa que existen.

| Evento | Datos | Cuándo |
|---|---|---|
| `battle:start` / `battle:won` / `battle:end` | `{zone, boss, elite}` / `{zone}` / `{outcome, zone, turns, enemy, ally}` | combate |
| `enemy:defeated` / `damage` / `captured` | `{species, house, ...}` / `{side, amount, crit}` / `{d}` | combate |
| `levelUp` / `evolved` | `{d, level}` / `{d, from, to}` | niveles |
| `daskai:died` | `{d, zone}` | muerte permanente |
| `legacy:inherited` | `{d, essence}` | herencia |
| `camp:upgraded` | `{id, level}` | compra en Mejoras |
| `crafted` | `{id, qty, times}` | Crafteo |
| `item:used` / `coins` / `bought` / `sold` | ... | objetos y economía |
| `expedition:complete` / `expedition:continue` / `expedition:end` | `{zone, depth}` | mapa superado / siguiente mapa / expedición cobrada |
| `boss:defeated` / `zone:unlocked` | `{zone}` | progreso |
| `notices:changed` | `{unread}` | avisos |
| `settings:changed` / `screen:enter` / `game:new` / `game:loaded` | ... | sistema |

### Textos

- Nunca escribas texto visible directamente: usa `DK.t('seccion.clave', { variables })` y añade la clave en `es.js` y `en.js`.
- Los datos (casas, atributos, naturalezas...) se traducen con `DK.tr('houses', objeto)`.
- `node tools/check.js` te dice qué textos faltan.

### Interfaz

- **Carcasa de juego** (`core/app.js`, estilos en `css/game.css`): no hay barra lateral ni migas de pan.
  - **HUD superior:** a la izquierda tu perfil (en el campamento), «Volver» si hay pantalla anterior o un atajo al Campamento (al Mapa durante una expedición); en el centro el título como cinta; a la derecha monedas, emblemas (y botín en expedición), avisos y **Menú**.
  - **App instalada (móvil):** `manifest.webmanifest` usa `display: fullscreen` (con `standalone` de respaldo en `display_override`) y `theme_color` / `background_color` del color del fondo; `settings.apply()` pone `<meta name="theme-color">` con el `--bg` del tema activo. Con `viewport-fit=cover` el juego llega hasta los bordes: la cabecera suma `env(safe-area-inset-top)` y el dock `env(safe-area-inset-bottom)` (`css/game.css` §11). Instalada, no se selecciona texto al mantener pulsado.
  - **Sonido sólo con el juego a la vista** (`systems/audio.js`): con `visibilitychange` / `pagehide` / `freeze` se para el secuenciador y se suspende el `AudioContext`; al volver (`pageshow` o visible) se reanuda la misma pista. Mientras está oculto no suenan efectos ni arranca música. `DK.audio.playing()` lo dice (lo usa la prueba de `tests/shell.test.js`).
  - **Menú de pausa** (`DK.app.openMenu()`; también Esc cuando no hay a dónde volver): perfil, buscar (Ctrl K), ayuda, ajustes, tema, instalar y guardar y salir.
  - **Barra de accesos** abajo (`.game-dock`): las entradas de `DK.menus.add('nav', …)`; Batalla/Mapa destacada.
- **Campamento** (`components/camp.js` + `screens/hub.js`): escena en pixel art con lugares pulsables (`SPOTS`: hoguera → Equipo, tienda → Inventario, yunque → Crafteo, muñeco → Entrenamiento, atril → Códice, tablón → Progreso, cartel → Batalla) y tu equipo junto a la hoguera. El cielo cambia con la hora real (`campTimeOfDay`: día, amanecer, atardecer, noche). Los dibujos se hacen con `DK.pix.canvas(w, h)` (`set`, `rect`, `tri`, `circle`) y `DK.pix.svg(lienzo, escala)`. Para un lugar nuevo: un dibujo en `SPRITES` (o animado en `components/campArt.js`) y una entrada en `SPOTS` (`x, y` en % para escritorio y `xs, ys` para móvil; `unlock` si depende de `DK.unlocks`).
- **Cortinillas** (`DK.fx.cover({ title, subtitle, icon, colors, kind }, mid)`): en tres tiempos (las franjas cierran la pantalla, con ella tapada se llama a `mid()` y sale la cinta del título, y se abren). No bloquean los clics. `DK.fx.curtain(o)` es lo mismo sin `mid`. Una pantalla puede tener su propia transición con `transition(params, go)` en `DK.screens.register`: el router la llama en vez de cambiar de pantalla y `go()` hace el cambio. El combate la usa: barrido a rayas en los combates normales y cinta con el título en jefes y mini jefes, con el combate montándose detrás. Al llegar a cada mapa sale la del nombre de la zona (una vez por mapa, `e.introShown`). Se acortan con «Animaciones rápidas» y son un fundido con «Reducir movimiento».
- **Mapa de la expedición** (`mapView` en `screens/expedition.js`, estilos en `css/game.css` §5): terreno en pixel art con los colores de la zona (`DK.pix.terrain(colores)`), árboles, matas y rocas siempre iguales para cada mapa (`mapDecor`, con semilla; nunca encima de un nodo), caminos de tierra (`.road-base` + `.road`: recorridos en dorado, disponibles animados), nodos como fichas con relieve (el jefe, grande con marco dorado), el número de piso a la izquierda y tu líder de pie sobre el nodo en el que estás (`.exp-hero`).
- **Iconos:** se pintan con `DK.icon(nombre, tamaño)`, pero `css/game.css` (§2b) fija tamaños mayores en botones, chips, barra de accesos, HUD y combate. Cambia ahí el tamaño de una zona entera en vez de tocar cada llamada.
- **Estilo de las piezas** (`css/game.css`): botones con relieve que se hunden al pulsar, paneles con marco y sombra sólida, títulos y botones principales en letra pixel (`--font-pixel`), barras de vida y maná con segmentos.

- **Botones:** `DK.ui.btn({ icon, label, onClick, variant, size, hotkey, tip })`.
- **Paneles laterales:** `DK.ui.drawer({...})`. En el móvil (≤ 600 px) los paneles y las ventanas (`modal`) son **hojas inferiores** con asa: se cierran deslizando hacia abajo (`swipeToClose` en `core/ui.js`).
- **Avisos:** `DK.ui.toast(texto, { icon, kind })`. Se agrupan solos; en el móvil sale uno a la vez (el resto en «+N avisos»), encima de la barra inferior, se quitan tocándolos y suben arriba si hay una hoja abierta.
- **Explicaciones (`tip`):** con ratón, al pasar por encima. Con el dedo: tocar algo que no es un botón la muestra; mantener pulsado un botón la muestra **sin pulsarlo** (p. ej. los ataques del combate). Dentro de elementos con menú contextual (`attachContextMenu` → `data-ctx`) no se usa.
- **Arrastrar:** `DK.ui.pointerDrag(el, { zones, onDrop, touch: true })`. Con `touch`, el dedo arrastra tras mantener pulsado ~0,26 s (si se mueve antes, es desplazar la página). Lo usan la mochila y el Equipo.
- **Crafteo** (`screens/craft.js`): barra única (Recetas | Materiales, buscador, tipo, «Sólo fabricables»); recetas en lista por secciones plegables según `kindOf` (equipo con ataque, con pasiva, de atributos, tónicos, consumibles) y arriba los **objetivos**; detalle en tres bloques (qué hace · materiales · fabricar), a la derecha o en hoja inferior en el móvil. Los objetivos son las favoritas de `DK.crafting` (`goals`, `goalsReady`, `goalNeeds`): salen al preparar la expedición, en «Qué hacer ahora» y en el resumen. Al fabricar equipo se abre `V.equipChooser(id)` (a quién ponérselo, con la diferencia de atributos). El aviso del menú cuenta sólo tónicos y equipo nuevo fabricable. Cada material tiene su icono (`data/items.js`).
- **Inventario** (`screens/inventory.js`): filtros por tipo en horizontal (`.inv-tabs`), buscador y lista agrupada por tipo; al pulsar un objeto, su ficha grande con todas las opciones (usar en cada daskai con lo que le hace, equipar en un hueco con la diferencia de atributos, recetas en las que se usa y venta). A la derecha en escritorio; hoja inferior en el móvil.
- **Qué hacer ahora** (Campamento): `components/todoCard.js`. Cada aviso es una función en `SOURCES` que devuelve `{ id, icon, kind, text, cta, run }` o null; los textos en `todo.*` (con variante `…One` para el singular).
- **Equipo y cajas** (`screens/team.js`, `systems/boxes.js`, estilos en `css/game.css` §6): a la derecha tu equipo (hasta `config.maxTeam` = 5, el primero es el líder) y a la izquierda las **cajas**, como el PC de Pokémon: `DK.boxes.SIZE` (30) huecos por caja, hasta `MAX` (16) cajas, cada una con nombre (`rename`) y fondo (`setBg`: los colores de una zona o un tema extra, pintados con `DK.pix.terrain`). Estado en `state.boxes = { cur, list: [{ name, bg, slots }] }`.
  - **Colocación perezosa:** `DK.boxes.sync()` saca de las cajas a quien ya no existe o está en el equipo y guarda a quien no esté en ninguna (en la caja actual si cabe). Se llama antes de pintar; no hace falta tocarlo al reclutar, liberar o morir.
  - **En expedición** las cajas se quedan en el campamento: en lugar de `.pc-box` sale `.pc-away` («Contigo en la expedición»), con los daskai que salieron contigo o reclutaste y no están en el equipo (`DK.party.canJoin`). Es una zona de arrastre `reserve`: soltar ahí saca del equipo (`removeFromTeam`) sin guardar en ninguna caja. No hay pestañas, Q / E ni renombrar.
  - **Mover:** `toTeam(uid, índice)` (si el equipo está lleno, se intercambian), `moveTo(uid, caja, hueco)` (desde el equipo o entre huecos, con intercambio) y `sort(caja, 'level'|'house'|'species'|'name')`. En pantalla se arrastra (ratón o mantener pulsado) entre huecos de la caja y del equipo; Q / E cambian de caja; el buscador resalta en las cajas y marca en qué pestaña hay coincidencias. Pulsar un daskai abre su ficha en un panel deslizante.
- **Elegir el daskai inicial** (`screens/newGame.js` → `renderStarter`, `css/game.css` §12): los iniciales en una fila de retratos redondos (1-5), el elegido en grande sobre un pedestal del color de su casa (flechas, ← / → o deslizar), su descripción, chips de fuerte / débil / evolución y los atributos en fichas con barra comparada con el mejor inicial en ese atributo (el mejor, resaltado). En el móvil el botón de empezar queda fijo abajo.
- **Ficha del daskai:** 3 pestañas (Atributos + talentos · Ataques + aprender/evolución · Equipo). `daskaiPanel(d, { onNav })` añade Anterior/Siguiente y deslizar la cabecera.
- **Atajos:** `DK.keys.on('tecla', fn)`. Duran lo que dure la pantalla.
- Prefiere acciones en línea a ventanas. `DK.ui.modal` / `DK.ui.confirm` sólo para confirmar.

---

## 4. Estilo del código

- Cada archivo empieza con un bloque de comentario: qué hace, cómo se usa y qué datos lee.
- Cada función pública tiene un comentario `/** ... */` con sus parámetros y lo que devuelve.
- Cada archivo va envuelto en `(function () { ... })();`. Lo único global es `DK`.
- Los números configurables van en `data/config.js`; los colores, como variables en `css/base.css`.
- Utilidades comunes en `DK.util` (`core/dk.js`): `pick(arr, rnd)`, `weighted(lista, clave, rnd)`, `weightedKey({ id: peso }, rnd)`, `weightsOf(obj)`, `percent(a, b)`, `seeded(texto)`… Úsalas en vez de repetir el cálculo. Los textos: `const { t } = DK;`.
- **Guardado:** `DK.store.save()` no escribe al momento: agrupa las peticiones de 400 ms en una escritura. Se escribe seguro al cerrar la partida, al salir o al cambiar de pestaña (`DK.store.flush()`). Si necesitas leer la ranura actual de `localStorage`, usa `DK.store.read(slot)` (vacía lo pendiente antes).
- Las reglas de dificultad se consultan siempre con `DK.rules`, y las mejoras con `DK.camp.value()`.

## 5. Comprobar que todo funciona

1. `npm test` (o, sin Playwright, `node tools/check.js`) debe terminar sin fallos. Para una sola parte: `node tests/run.js battle`.
   Para añadir una prueba crea `tests/<tema>.test.js` con `{ name, cases: [{ name, views: ['desktop', 'mobile'], run: (browser, view) => play(browser, view, async (page) => { … check(cond, 'mensaje') }) }] }`.
2. Abre la consola del navegador (F12): no debe haber errores en rojo.
3. Prueba con la ventana estrecha (móvil): todo debe caber sin desplazamiento horizontal.
