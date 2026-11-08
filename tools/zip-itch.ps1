# Crea dist/daskai-itch-vX.Y.Z.zip listo para subir a itch.io (HTML, "played in the browser").
# Solo lleva lo que usa el juego: index.html, sw.js, manifest.webmanifest, css/, js/ e icons/.
# Las rutas dentro del zip usan "/" (Compress-Archive de Windows PowerShell 5 usa "\" y eso
# rompe el juego en itch.io), por eso se crea con System.IO.Compression.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$need = @('index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons', 'js/data/gen/data.js')
foreach ($n in $need) { if (-not (Test-Path $n)) { throw "Falta '$n' en $root" } }

$ver = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zip = Join-Path $dist "daskai-itch-v$ver.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

$files = @()
$files += Get-Item 'index.html', 'sw.js', 'manifest.webmanifest'
$files += Get-ChildItem -Path 'css', 'js', 'icons' -Recurse -File

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
$za = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($za, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $za.Dispose(); $fs.Dispose() }

$kb = [math]::Round((Get-Item $zip).Length / 1KB)
Write-Host ""
Write-Host "Listo: $zip"
Write-Host "  $($files.Count) archivos, $kb KB (version $ver)"
Write-Host ""
Write-Host "En itch.io: Kind of project = HTML, sube el zip y marca"
Write-Host "'This file will be played in the browser'."
