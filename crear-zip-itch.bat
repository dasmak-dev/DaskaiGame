@echo off
REM Crea dist\daskai-itch-vX.Y.Z.zip listo para subir a itch.io
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\zip-itch.ps1"
if errorlevel 1 (
  echo.
  echo No se ha podido crear el zip.
) else (
  start "" "%~dp0dist"
)
pause
