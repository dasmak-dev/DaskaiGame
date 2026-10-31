#!/usr/bin/env sh
# Inicia un servidor local para jugar a Daskai (necesario para instalarlo como app)
cd "$(dirname "$0")"
URL=http://localhost:8080
( sleep 1; (xdg-open "$URL" || open "$URL") >/dev/null 2>&1 ) &
if command -v python3 >/dev/null; then python3 -m http.server 8080
elif command -v npx >/dev/null; then npx --yes http-server -p 8080 -c-1
else echo "Instala Python 3 o Node.js, o abre index.html directamente."; fi
