# Instalator czytnika kodow (Windows).
# Uzycie: kliknij prawym -> "Uruchom w programie PowerShell"
#         albo: powershell -NoProfile -File install.ps1
# Prowizjonuje nowa plytke RP2040: CircuitPython (UF2) + firmware + konfigurator.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Get-Volume nie widzi dysku bootloadera RPI-RP2 - wykrywamy po plikach.
function Find-DriveWith($marker) {
  foreach ($letter in [char]'D'..[char]'Z') {
    $path = "$([char]$letter):\$marker"
    try { if (Test-Path $path) { return "$([char]$letter):" } } catch {}
  }
  return $null
}

function Wait-DriveWith($marker, $timeoutSec, $prompt) {
  $t0 = Get-Date
  $shown = $false
  while (((Get-Date) - $t0).TotalSeconds -lt $timeoutSec) {
    $d = Find-DriveWith $marker
    if ($d) { return $d }
    if (-not $shown) { Write-Host $prompt -ForegroundColor Yellow; $shown = $true }
    Start-Sleep -Seconds 2
  }
  return $null
}

Write-Host "=== Instalator czytnika kodow ===" -ForegroundColor Cyan

$circuitpy = Find-DriveWith "boot_out.txt"
if (-not $circuitpy) {
  $uf2 = Get-ChildItem (Join-Path $root "flash") -Filter *.uf2 | Select-Object -First 1
  if (-not $uf2) { Write-Host "BLAD: brak pliku .uf2 w katalogu flash\" -ForegroundColor Red; exit 1 }
  $rp2 = Wait-DriveWith "INFO_UF2.TXT" 300 "Przytrzymaj BOOT na plytce i wcisnij RST (albo podlacz USB trzymajac BOOT). Czekam na dysk RPI-RP2..."
  if (-not $rp2) { Write-Host "BLAD: dysk RPI-RP2 nie pojawil sie w 5 minut" -ForegroundColor Red; exit 1 }
  Write-Host "RPI-RP2 = $rp2 - wgrywam CircuitPython ($($uf2.Name))..."
  try { Copy-Item $uf2.FullName "$rp2\" } catch { <# plytka restartuje sie w trakcie - to normalne #> }
  $circuitpy = Wait-DriveWith "boot_out.txt" 120 "Czekam na dysk CIRCUITPY..."
  if (-not $circuitpy) { Write-Host "BLAD: CIRCUITPY nie pojawil sie - sprobuj ponownie" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "CIRCUITPY juz obecny ($circuitpy) - pomijam wgrywanie CircuitPythona."
}

Write-Host "CIRCUITPY = $circuitpy - kopiuje firmware i konfigurator..."
Copy-Item -Recurse -Force (Join-Path $root "device\*") "$circuitpy\"

Write-Host ""
Get-Content "$circuitpy\boot_out.txt" | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "GOTOWE. Odlacz i podlacz USB (aktywacja klawiatury USB)." -ForegroundColor Green
Write-Host "Nastepnie otworz $circuitpy\konfigurator.html w Chrome/Edge i kliknij Polacz."
Write-Host "Pelna instrukcja: INSTALL.md w tej paczce."
