@echo off
REM Inicia un servidor local para jugar a Daskai (necesario para instalarlo como app)
cd /d "%~dp0"
where python >nul 2>nul && (start "" http://localhost:8080 & python -m http.server 8080 & goto :eof)
where py >nul 2>nul && (start "" http://localhost:8080 & py -m http.server 8080 & goto :eof)
where npx >nul 2>nul && (start "" http://localhost:8080 & npx --yes http-server -p 8080 -c-1 & goto :eof)
echo No se ha encontrado Python ni Node.js. Abre index.html directamente con doble clic.
pause
