# Daskai

Roguelike difícil (muerte permanente) de combates por turnos al estilo de los Pokémon clásicos, con criaturas de cinco casas (Luz, Oscuridad, Agua, Fuego y Tierra). HTML + CSS + JavaScript puro, sin dependencias.

## Cómo jugar

- **Rápido:** abre `index.html` con doble clic.
- **Como app instalable / sin conexión:** ejecuta `iniciar.bat` (Windows) o `iniciar.sh` (Mac/Linux). Se abre en `http://localhost:8080` y desde Ajustes puedes instalarlo. Necesita Python o Node.js.

La partida se guarda automáticamente en el navegador (3 ranuras). Desde el menú principal puedes exportarla a un archivo como copia de seguridad o importarla en otro equipo.

## Qué incluye

**Juego:** 48 especies (5 iniciales con 2 evoluciones cada una), 47 ataques, 39 objetos, 44 recetas de Crafteo (equipo que enseña ataques nuevos o da pasivas extra), 8 zonas con jefe, expediciones roguelike infinitas (zona al azar, continuar o cobrar tras cada jefe), mejoras permanentes, daskai variocolor, tienda con oferta diaria, misiones diarias y semanales, 20 logros y estadísticas del jugador.

**Comodidades:** atajos de teclado en todo el juego, velocidad de combate x1/x2/x4, combate automático, repetir último ataque, vista previa del daño en la barra enemiga, indicador de eficacia y de orden de turno, cambiar de daskai en combate, arrastrar y soltar en el equipo, filtros y comparador, vista previa de cambios al equipar, curar con objetos en un clic, crafteo en cadena y recetas favoritas, apodos, liberar daskai, tutorial guiado, ayuda con el ciclo de casas, tooltips y avisos antes de combatir.

**Interfaz:** navegación siempre visible (barra lateral o inferior), Inicio con botón «Jugar», secciones con lista y ficha a la vez, paneles laterales en lugar de ventanas, acciones rápidas con clic derecho o pulsación larga, arrastrar objetos sobre daskai, buscador con Ctrl+K y combate con los ataques siempre a la vista.

**Sensación moderna:** música y efectos sintetizados (sin archivos), partículas por casa, escenarios animados por zona, pantalla de subida de nivel y de evolución, transiciones entre pantallas y vibración en móvil.

**Accesibilidad e idiomas:** tema claro/oscuro, 4 tamaños de texto, alto contraste, modo daltónico, reducir movimiento, español e inglés.

## Para desarrolladores

Lee **[docs/GUIA-DESARROLLO.md](docs/GUIA-DESARROLLO.md)** y ejecuta `node tools/check.js` antes de publicar cambios: arquitectura por capas, mapa de archivos y recetas para añadir pantallas, menús, daskai, zonas, misiones, logros, idiomas, sonidos o escenarios.

Resumen: los **datos** están en `js/data/`, las **reglas** en `js/systems/`, lo **visual** en `js/components/` y `js/screens/`, y los **textos** en `js/lang/`.
