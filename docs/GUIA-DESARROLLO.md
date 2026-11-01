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
                           codex, zones (Batalla), expPrepare (mochila), expedition, expSummary, battle, progress, profile, gameOver, settings
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
| Un daskai | `data/species.json` | `"id": { "name", "house", "base": { hp, mp, atk, matk, def, mdef, spd }, "learn": [[nivel, "ataque"], …], "drops", "passives", "sprite", "desc" }`. Por defecto: `exp` 40, sin botín y **cualquier pasiva** al azar. Para que aparezca, ponlo en `"enemies"` de una zona |
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
  training: { slots: [{ uid, kind: 'exp'|'stat', stat, start, cost, startLevel }] },  // campo de entrenamiento
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


Huecos `config.training.slots` + mejora «Instructor». Al entrar se paga `cost(nivel, tipo)` y el daskai sale del equipo (`DK.party.canJoin` lo bloquea). Gana en tiempo real con rendimiento decreciente (`effHours`: 100% hasta `fullHours`, `halfRate` hasta `halfHours`, luego nada): experiencia (hasta el nivel máximo) o puntos de un atributo (`statHours` por punto, máximo `statMax`). `progress(slot)` calcula sin aplicar y `collect(uid)` aplica y devuelve el daskai.

**Nivel recomendado** (`levelCap()` = nivel más alto − `levelMargin` + Instructor): no bloquea. Por encima, entrenar experiencia tiene una penalización `overMult(d)` = 1 + `overStep` × niveles de más (máx. `overMax`) y el jugador elige el plan: `'coins'` (paga ×mult, ritmo normal) o `'time'` (precio normal, las horas se estiran ×mult). Se guarda en el hueco (`slot.plan`, `slot.mult`) y `progress()` trabaja con horas «normales» (`norm = horas / stretch(slot)`).

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
- **Preparar (briefing):** `screens/expPrepare.js` enseña en la cabecera la zona, el tamaño, el nivel de los rivales, la dificultad, tus emblemas y los emblemas por jefe; debajo, Equipo · Mochila · Bolsa en `.brief-grid`: tres bloques **del mismo tamaño** (540 px de alto en columnas; 440 px apilados en ≤900 px; `css/game.css` §7) con la lista desplazándose por dentro, y los objetivos debajo. Mochila y bolsa son LISTAS (`.pk-row`): − / + por objeto en la mochila, + en la bolsa (Mayús = todas) y arrastrar entre ambas (`DK.ui.pointerDrag`, también con el dedo).
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
  - **Menú de pausa** (`DK.app.openMenu()`; también Esc cuando no hay a dónde volver): perfil, buscar (Ctrl K), ayuda, ajustes, tema, instalar y guardar y salir.
  - **Barra de accesos** abajo (`.game-dock`): las entradas de `DK.menus.add('nav', …)`; Batalla/Mapa destacada.
- **Campamento** (`components/camp.js` + `screens/hub.js`): escena en pixel art con lugares pulsables (`SPOTS`: hoguera → Equipo, tienda → Inventario, yunque → Crafteo, muñeco → Entrenamiento, atril → Códice, tablón → Progreso, cartel → Batalla) y tu equipo junto a la hoguera. El cielo cambia con la hora real (`campTimeOfDay`: día, amanecer, atardecer, noche). Los dibujos se hacen con `DK.pix.canvas(w, h)` (`set`, `rect`, `tri`, `circle`) y `DK.pix.svg(lienzo, escala)`. Para un lugar nuevo: un dibujo en `SPRITES` y una entrada en `SPOTS` (`x, y` en % para escritorio y `xs, ys` para móvil; `unlock` si depende de `DK.unlocks`).
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
