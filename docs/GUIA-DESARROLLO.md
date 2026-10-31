# Guía de desarrollo de Daskai

El juego es HTML + CSS + JavaScript puro: sin dependencias ni compilación. Abre `index.html` con doble clic, o usa `iniciar.bat` / `iniciar.sh` para un servidor local (necesario para instalarlo como app).

Antes de publicar un cambio ejecuta:

```
node tools/check.js
```

Comprueba la sintaxis de todos los archivos y que cada texto exista en español e inglés.

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
tools/check.js             comprobación de sintaxis y textos
css/
  base.css                 variables de color, temas, accesibilidad, carcasa
  components.css           botones, tarjetas, barras, modales, tooltips
  screens.css              estilos de cada pantalla (clásicos)
  battle.css               arena, escenarios, efectos y panel de mando del combate
  layout.css               navegación, paneles laterales y pantallas nuevas
  responsive.css           tablet y móvil
  theme.css                estética oscura, tipografía pixel de títulos, pixel art y espaciados (se carga la última)
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
  app.js                   barra superior, navegación lateral/inferior, campana de avisos
js/data/
  config.js                TODOS los números del juego (experiencia, daño, expediciones...)
  basics.js                casas, atributos, naturalezas, pasivas, estados, rarezas
  talents.js               talentos (cada 10 niveles se elige 1 de 2)
  species.js / species2.js (ampliación) / evolutions.js / moves.js / items.js / recipes.js / shop.js / zones.js
  missions.js / achievements.js
  events.js                sucesos de expedición
  relics.js                reliquias de expedición
  difficulties.js          niveles de dificultad
  upgrades.js              mejoras permanentes (pantalla Mejoras)
js/systems/
  daskai.js                DK.daskai (atributos, niveles) y DK.party (equipo, muerte)
  rules.js                 DK.rules (dificultad), DK.camp (Mejoras), DK.legacy (herencia)
  inventory.js             DK.bag, DK.wallet, DK.shop, DK.crafting (Crafteo), DK.healer
  world.js                 DK.codex, DK.world (zonas, jefes, desbloqueos)
  training.js              DK.training (campo de entrenamiento en tiempo real)
  expedition.js            DK.expedition (expediciones infinitas: zona al azar, mapa, nodos, botín,
                           reclutas, salvaciones, continuar/cobrar) y DK.relics
  battle.js                DK.battle (motor de combate sin interfaz)
  progress.js              misiones, logros y estadísticas
  audio.js / sprites.js    sprites.js: dibujo SVG de cada especie y su versión pixel art (DK.sprites.pixel, ajuste «pixelArt»)
js/components/             common, daskaiViews (fichas, tarjetas, tablas), daskaiPanel, itemViews,
                           avatar, shareCard, palette (Ctrl+K), guides (ayuda), celebrations, talentViews, todoCard (Qué hacer ahora), fx, scenes
js/screens/                mainMenu, newGame, hub (Inicio), camp (Mejoras), training (Entrenamiento), team, inventory, craft (Crafteo),
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

  // Entrada en la navegación. En el móvil: si hay más de 5, la barra inferior muestra sólo las
  // marcadas con pin: true (Inicio, Equipo, Inventario, Batalla) y el resto va en la hoja «Más»
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
| Un daskai | `data/species.js` | `S('id', 'Nombre', 'casa', [vida, maná, atq, atqM, def, defM, vel], { learn, drops, passives, sprite, desc })` |
| Una evolución | `data/evolutions.js` | `link('origen', nivel, 'destino')` |
| Un ataque | `data/moves.js` | `def('id', { name, kind, house, power, mp, acc, effect, desc })` |
| Un objeto | `data/items.js` + `data/shop.js` | `def('id', { name, category, rarity, icon, color, use / stats, grants, desc })` y su precio |
| Un objeto que da un ataque o una pasiva | `data/items.js` + `data/recipes.js` | equipo con `grants: { move: 'ataque' }` o `grants: { passive: 'pasiva' }` y su receta. El daskai que lo lleva lo usa en combate (`DK.daskai.battleMoves`, `DK.daskai.passives`) |
| Una receta | `data/recipes.js` | `def('resultado', cantidad, { ingrediente: n })` (todas se ven en Crafteo desde el principio) |
| Una zona | `data/zones.js` | `def('id', { name, levels, colors, scene, unlock, enemies, boss })` |
| Un suceso de expedición | `data/events.js` + `lang → events.<id>` | `{ id, icon, weight, minRow, choices: [{ id, icon, req(ctx), run(ctx) → { key, vars, fight } }] }` |
| Una reliquia | `data/relics.js` | `def(id, nombre, icono, rareza, { type, pct / add, house / stat })` (tipos explicados en el archivo) |
| Una dificultad | `data/difficulties.js` + `lang → difficulty.<id>` | `{ id, icon, permadeath, retreat, fixedRest, enemyMult, revives }` |
| Una mejora permanente | `data/upgrades.js` + `lang → camp.up.<id>` | `{ id, icon, group, levels: [{ cost, value }] }` y lee `DK.camp.value('<id>')` donde se aplique (la lista de dónde se usa cada una está en el archivo) |
| Una misión / un logro | `data/missions.js` / `data/achievements.js` | plantilla + textos en `missions.<id>` / `achievements.<id>` |
| Una pasiva o naturaleza | `data/basics.js` | una línea en `passives` o `natures` (las pasivas también cambian el ritmo de crecimiento, ver «Un daskai») |
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

Atributo final = `(base + crecimiento + equipo + herencia + tónicos + entrenamiento) × (1 + pasivas + talentos) × multiplicadores` → `DK.daskai.stats(d)`.

**Crecimiento al subir de nivel** (`rollGrowth`): cada atributo gana `growth.level` puntos × su **ritmo** (`DK.daskai.growthWeight`): la especie (sus atributos base altos crecen más) y las pasivas/talentos (+% crece más, −% menos), limitado por `growthBias`. Encima, la naturaleza suma o resta puntos. `growthRate(d, k)` lo resume en `high/up/normal/down/low` (▲▲ ▲ ● ▼ ▼▼ en la tabla de atributos y al subir de nivel).

**Evolucionar** cambia a la base de la nueva especie y además suma `evolveBonus` × (1 + nivel/30) a `growth` (guardado aparte en `evoBonus` para el desglose).

**Mejoras permanentes**: tónicos (`DK.daskai.applyTonic`, máximo `config.tonic.cap`; el elixir de olvido los devuelve con `resetTonics`) y puntos del campo de entrenamiento (`d.trained`). `DK.daskai.permBonus(d, k)` los suma.

**Talentos**: en los niveles 10, 20… se elige 1 de 2 (`talentOptions` es fijo para cada daskai). `talentsPending(d)`, `chooseTalent(d, nivel, id)`. Suman como una pasiva en `passiveMods`. La ventana sale sola tras la subida de nivel (`levelUpDialog` → `talentDialog`).

### Campo de entrenamiento (`DK.training`)

Huecos `config.training.slots` + mejora «Instructor». Al entrar se paga `cost(nivel, tipo)` y el daskai sale del equipo (`DK.party.canJoin` lo bloquea). Gana en tiempo real con rendimiento decreciente (`effHours`: 100% hasta `fullHours`, `halfRate` hasta `halfHours`, luego nada): experiencia hasta `levelCap()` (nivel más alto − `levelMargin` + Instructor) o puntos de un atributo (`statHours` por punto, máximo `statMax`). `progress(slot)` calcula sin aplicar y `collect(uid)` aplica y devuelve el daskai.

### Expediciones

- **Infinitas:** no se elige zona. `DK.expedition.pickZone(depth)` elige una zona desbloqueada al azar; cuanto mayor es la profundidad, más pesan las zonas difíciles. Si la profundidad supera el número de zonas, los rivales suben de nivel (`levelBonus()`, aplicado en `DK.battle.start`).
- **Tras cada jefe:** `bossCleared()` da sus premios, hace permanentes a los reclutas del mapa, elige la zona siguiente y pone `awaitingChoice`. El jugador decide en el panel final del combate (o en la pantalla del mapa):
  - `continueRun()` → mapa nuevo, más profundo, con una reliquia a elegir;
  - `complete()` → termina y cobra con `bonusMult(mapas)`.
- **Mapa:** se genera por pisos con una semilla (`generate()`): `config.expedition.rows` pisos (10) + hoguera + jefe.
  - Siempre hay una **hoguera a mitad de camino** y al menos `caveMin` **cuevas**.
  - **Atajos** (nodo `shortcut`, `node.jump`): saltan `shortcutSkip` pisos a cambio de `shortcutHpCost` de vida (`takeShortcut()` → `e.jumpTo`). En el mapa se dibujan con línea discontinua. La Mejora «Atajos» añade más.
  - **Cuevas** (nodo `cave`, `exploreCave()`): guarida del **jefe oculto** de la zona (`D.secretBosses` en `data/zones.js`) o un tesoro. El combate usa `DK.battle.start(zona, uid, { boss: true, secret: true, final: false })`. Vencerlo la primera vez lo **desbloquea** (`DK.world.secret(zona).defeated`): desde entonces el jefe final del mapa puede ser él (`node.secret`, probabilidad `secretFinalChance`).
  - Sucesos con **personajes** (`data/events.js`): viajera, ermitaño (tónicos), herrera (equipo/reliquia), cartógrafo (`revealCave` / `revealShortcut`: convierte un combate de más adelante en cueva o atajo), daskai perdido (`recruit`) y bandidos.
  - `DK.expedition.preview()` enseña el primer mapa de la próxima expedición; `start()` usa esa misma zona y semilla.
  - Mientras hay un nodo sin combate pendiente o una reliquia por elegir, el mapa se oculta (vista centrada).
- **Mochila:** antes de salir, `screens/expPrepare.js` elige qué objetos de casa te llevas (`packCapacity()` = `config.expedition.packCapacity` + Mejora «Equipaje»; categorías en `packCategories`). `DK.expedition.start(pack)` los pasa a `e.pack`.
  - Mientras hay expedición, **`DK.bag` trabaja sobre la mochila** (`DK.bag.raw()`); la bolsa de casa es `DK.bag.home()`. Así combate, curar, mercader, sucesos y equipar usan la mochila sin cambios.
  - Al terminar, la mochila y el botín vuelven a casa (`DK.bag.addHome`); si pierdes, la mochila se pierde.
- **Salir:** ya no hay retirada en cualquier momento. Sólo:
  - tras el jefe del mapa → `complete()` (todo + bonificación);
  - en una **hoguera** → `campfireExit()`: te llevas `campfireKeep` (50%) del botín y de lo ganado en la mochila (lo que llevabas al salir vuelve entero) y **todos los reclutas** se quedan. No se puede en Pesadilla (`DK.rules.canRetreat()`). Resultado `'campfire'` en el resumen.
- **Modo expedición:** `DK.router.guard` (en `screens/expedition.js`) sólo deja ir a las pantallas de `EXP_SCREENS`; la navegación muestra sólo las opciones con `expedition: true` (o `'only'`) en `DK.menus.add('nav', ...)` (`DK.app.navItems()`). Si tu pantalla nueva debe verse durante una expedición, añádela a `EXP_SCREENS` y marca su entrada con `expedition: true`. En el equipo sólo pueden entrar los que salieron (`e.members`) y los reclutas (`DK.party.canJoin`).
- **Caer contra el jefe** (`fail({ boss: true })` → `failAtBoss`): sólo se pierde `config.expedition.bossDeathLoss` del botín y la mochila, y la próxima expedición empieza con `config.expedition.consolation` (reliquia rara/épica y pociones).
- **Mini jefes:** cada mapa tiene al menos un nodo élite; al vencerlo se elige una reliquia (`DK.relics.offer`).
- **Pactos** (`data/curses.js`, `systems/curses.js`): al empezar cada mapa se ofrecen `curseChoices` pactos; los aceptados (`e.curses`) duran ese mapa. Cada sistema pregunta `DK.curses.effect('clave')` (niveles, curación, huida, vínculo, velocidad, fase extra) y las recompensas salen de `coinBonus()` / `relicReward()`.
- **Sin curación gratis** (`config.expedition.noFreeHeal`): en expedición no hay regeneración base por turno y subir de nivel no cura (sólo suma lo que crece el máximo).
- **Botín:** los consumibles (`config.expedition.directToBag`) van directos a la mochila; el resto y las monedas se entregan al terminar.
- **Reclutas:** son temporales (`d.temp`) y se quedan al derrotar al jefe de su mapa o al volver desde una hoguera (`settleRecruits`). Si pierdes, se van los del mapa actual.
- **Emblemas y Mejoras:** cada jefe derrotado en expedición (también los ocultos) da `emblemsPerBoss` emblemas (`DK.camp.addEmblems`, en `state.emblems`). Las Mejoras (`data/upgrades.js`) cuestan emblemas y **se compran en el resumen de la expedición** (`expSummary` → `V.upgradeCard(u, refresh, true)`); la pantalla Mejoras es sólo el catálogo.
- **Muerte permanente:** se aplica si `DK.rules.permadeath()`.
  - Al acabar un combate, `DK.expedition.trySave(d)` intenta salvarlo: bendición del santuario, pluma de fénix o Altar del fénix (Mejoras).
  - Si no se salva, `DK.party.kill()`: el daskai pasa al cementerio y deja una esencia (`DK.legacy`).
- **Al terminar:** `DK.expedition.snapshot()` guarda el resumen (`lastExpedition` y `expHistory`) y se abre `expSummary`.

### Combate: intención, defensa y fases de jefe

- **Intención:** el rival elige su acción antes de tu turno (`st.intent`, de `enemyChoice`). `DK.battle.intentInfo(st)` dice el tipo (ataque, golpe fuerte, curación, mejora…) y el daño previsto al aliado actual; la pantalla lo pinta bajo su vida y avisa si es letal.
- **Prioridad:** un ataque puede tener `priority: 1` (rápido) o `-1` (lento) en `data/moves.js`. `DK.battle.orderFor(st, tuAtaque)` decide quién va primero (prioridad y, si empatan, velocidad); la pantalla lo enseña en cada ataque (1º/2º) y en la línea de tiempo.
- **Cambio táctico:** el daskai que entra al cambiar recibe `config.switchMult` del daño ese turno; el banquillo enseña cuánto le haría la intención del rival (`intentVs`).
- **Punto débil:** cada especie recibe `config.weakMult` más de daño del tipo de ataque de su defensa más baja (`weakness`). Se descubre al golpearle con ese tipo (`state.weakKnown`).
- **Desglose de daño:** `DK.battle.factors(st, lado, ataque)` devuelve todos los multiplicadores; `damage()` los usa y la pantalla los muestra al pasar por un ataque o por la intención.
- **Información progresiva:** `knowledge(st)` = combates contra esa especie en la zona: con 1 ves su casa, con `revealMovesAt` sus ataques y con `revealStatsAt` sus atributos.
- **Defender** (`{type:'guard'}`): actúa primero, recibe `config.guardMult` del daño y recupera `guardMana` de maná.
- **Fases de jefe** (`data/bossPhases.js`): `st.phases` se comprueba tras cada golpe (`checkPhase`) y `enterPhase` aplica furia, regeneración, escudo (`st.shield`, lo rompe un ataque eficaz) o frenesí (`st.frenzy`). Para un tipo nuevo: añádelo a `phaseTypes`, impleméntalo en `enterPhase` y escribe `phase.<tipo>`, `phase.name.<tipo>` y `phase.desc.<tipo>`.

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

- **Botones:** `DK.ui.btn({ icon, label, onClick, variant, size, hotkey, tip })`.
- **Paneles laterales:** `DK.ui.drawer({...})`. En el móvil (≤ 600 px) los paneles y las ventanas (`modal`) son **hojas inferiores** con asa: se cierran deslizando hacia abajo (`swipeToClose` en `core/ui.js`).
- **Avisos:** `DK.ui.toast(texto, { icon, kind })`. Se agrupan solos; en el móvil sale uno a la vez (el resto en «+N avisos»), encima de la barra inferior, se quitan tocándolos y suben arriba si hay una hoja abierta.
- **Explicaciones (`tip`):** con ratón, al pasar por encima. Con el dedo: tocar algo que no es un botón la muestra; mantener pulsado un botón la muestra **sin pulsarlo** (p. ej. los ataques del combate). Dentro de elementos con menú contextual (`attachContextMenu` → `data-ctx`) no se usa.
- **Arrastrar:** `DK.ui.pointerDrag(el, { zones, onDrop, touch: true })`. Con `touch`, el dedo arrastra tras mantener pulsado ~0,26 s (si se mueve antes, es desplazar la página). Lo usan la mochila y el Equipo.
- **Qué hacer ahora** (Inicio): `components/todoCard.js`. Cada aviso es una función en `SOURCES` que devuelve `{ id, icon, kind, text, cta, run }` o null; los textos en `todo.*` (con variante `…One` para el singular).
- **Ficha del daskai:** 3 pestañas (Atributos + talentos · Ataques + aprender/evolución · Equipo). `daskaiPanel(d, { onNav })` añade Anterior/Siguiente y deslizar la cabecera.
- **Atajos:** `DK.keys.on('tecla', fn)`. Duran lo que dure la pantalla.
- Prefiere acciones en línea a ventanas. `DK.ui.modal` / `DK.ui.confirm` sólo para confirmar.

---

## 4. Estilo del código

- Cada archivo empieza con un bloque de comentario: qué hace, cómo se usa y qué datos lee.
- Cada función pública tiene un comentario `/** ... */` con sus parámetros y lo que devuelve.
- Cada archivo va envuelto en `(function () { ... })();`. Lo único global es `DK`.
- Los números configurables van en `data/config.js`; los colores, como variables en `css/base.css`.
- Las reglas de dificultad se consultan siempre con `DK.rules`, y las mejoras con `DK.camp.value()`.

## 5. Comprobar que todo funciona

1. `node tools/check.js` debe terminar con «Todo correcto».
2. Abre la consola del navegador (F12): no debe haber errores en rojo.
3. Prueba con la ventana estrecha (móvil): todo debe caber sin desplazamiento horizontal.
