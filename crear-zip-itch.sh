#!/usr/bin/env sh
# Crea dist/daskai-itch-vX.Y.Z.zip listo para subir a itch.io (HTML, "played in the browser").
# Solo lleva lo que usa el juego: index.html, sw.js, manifest.webmanifest, css/, js/ e icons/.
cd "$(dirname "$0")" || exit 1
command -v python3 >/dev/null || { echo "Necesitas Python 3."; exit 1; }
python3 - <<'PY'
import json, os, zipfile
for n in ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons', 'js/data/gen/data.js']:
    if not os.path.exists(n): raise SystemExit(f"Falta '{n}'")
ver = json.load(open('package.json'))['version']
os.makedirs('dist', exist_ok=True)
out = f'dist/daskai-itch-v{ver}.zip'
files = ['index.html', 'sw.js', 'manifest.webmanifest']
for d in ['css', 'js', 'icons']:
    for base, _, names in os.walk(d):
        files += [os.path.join(base, n).replace(os.sep, '/') for n in sorted(names)]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in files: z.write(f, f)
print(f"\nListo: {out}\n  {len(files)} archivos, {os.path.getsize(out) // 1024} KB (versión {ver})\n")
print("En itch.io: Kind of project = HTML, sube el zip y marca 'This file will be played in the browser'.")
PY
