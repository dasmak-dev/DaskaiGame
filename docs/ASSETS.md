# Recursos gráficos de terceros

## Iconos de objetos y de la interfaz en pixel art (v5.21–v5.22)

- **Archivos:**
  - `icons/items-px.png`: hoja de 16 × 8 iconos de 16 × 16 px, uno por objeto de `data/items.json` (color, modo pixel art).
  - `icons/ui-px.png`: 116 iconos de la interfaz en tonos de un solo color. Va también incrustada en `js/data/gen/iconsPx.js` como máscara, porque las máscaras CSS de otro archivo se bloquean al abrir el juego como archivo local.
  - Siluetas vectoriales (estilo limpio) de todos ellos, en `js/data/gen/itemsPx.js` y `iconsPx.js` (`glyphs`).
- **Origen:** dataset [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) en Hugging Face, los 15 archivos `train-000…014.parquet` (1.405.308 iconos; descargados el 10/11/2026).
- **Licencia indicada en la ficha:** **CC0 1.0** (dominio público): uso comercial permitido, sin atribución obligatoria y con permiso para modificar.
- **Naturaleza:** la ficha los etiqueta como *synthetic / ai-generated* (generados por IA). No dice con qué modelo ni con qué datos se entrenó.
- **Procedencia de cada icono:** `docs/assets/items-px.json` (objetos) y `docs/assets/icons-px.json` (interfaz) guardan, para cada objeto, el archivo, el `row_id`, la descripción original (`subject` y `caption`) y un resumen SHA-1 de la imagen. Si algún día alguien pregunta de dónde sale un icono, ahí está la respuesta.
- **Criterio de elección:** sólo objetos genéricos (pociones, gemas, armas, armaduras, materiales…). Se descartó cualquier cosa que recordara a una marca, un personaje o un juego conocido.

### Si vas a comercializar el juego

- La licencia CC0 lo permite. El riesgo que queda es que no se sabe cómo se generaron las imágenes. Con iconos genéricos de 16 × 16 ese riesgo es muy bajo, pero no es cero.
- Al ser generados por IA, no puedes registrar estos iconos como tuyos tal cual: otros podrían reutilizarlos. Si los retocas a mano (paleta propia, contornos, detalles), esa parte sí es obra tuya.
- Algunas tiendas (por ejemplo, Steam) piden declarar el contenido generado por IA. Estos iconos entrarían en esa declaración.
- Están aislados en dos hojas (`icons/items-px.png`, `icons/ui-px.png`) y dos archivos generados. Para cambiarlos por arte encargado basta con sustituirlos manteniendo la misma cuadrícula y regenerar las siluetas. Las siluetas del estilo limpio se calculan a partir del sprite, así que también derivan de estos iconos.
- (Esto es orientación, no asesoramiento legal.)

### ¿Se puede borrar `_dataset/`?

Sí. El juego no lo lee: todo lo que usa ya está generado en `icons/items-px.png`, `icons/ui-px.png`, `js/data/gen/itemsPx.js`, `js/data/gen/iconsPx.js`. La procedencia queda en `docs/assets/*.json`. Sólo hace falta si quieres volver a elegir o cambiar iconos con `tools/atlas`: en ese caso, vuelve a descargar los `.parquet` desde Hugging Face. Los `row_id` guardados permiten encontrar exactamente los mismos iconos.

### Regenerar o cambiar iconos

1. Deja los `.parquet` del dataset en `_dataset/` (carpeta fuera de git y del zip de itch.io).
2. Edita las búsquedas en `tools/atlas/queries.py` (objetos) o en `tools/atlas/uiqueries.py` (interfaz).
   - Para elegir otro candidato, cambia el índice en `P` (objetos) o en `UP` (interfaz) dentro de `tools/atlas/final.py`. El índice es la posición entre los candidatos ordenados por puntuación: tema, parecido de color con el objeto y limpieza del dibujo.
   - `CLEAN_SKIP` lista los iconos cuya silueta no se lee bien: en el estilo limpio conservan su dibujo de trazo.
   - Para ver candidatos: `python3 tools/atlas/isheet.py N` (objetos) o `python3 tools/atlas/uisheet.py N` / `uisheet2.py nombre,nombre` (interfaz).
3. Ejecuta `python3 tools/atlas/final.py` (unos 40 s). Genera las dos hojas, los dos `.json` de procedencia y los dos `js/data/gen/*Px.js` con las siluetas (`tools/atlas/trace.py`). Sólo necesita Python 3, Pillow y `libzstd` (el lector de parquet es propio y no usa pyarrow).
4. Sube `?v=` en `js/data/gen/itemsPx.js` y en `sw.js` si cambias la imagen.

Los objetos nuevos que no estén en la hoja, y los iconos de interfaz que no estén en `UP` (flechas, cerrar, aceptar, play…), siguen usando el icono vectorial de siempre.
