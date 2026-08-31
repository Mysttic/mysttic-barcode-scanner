# Mysttic Barcode Scanner - desktop agent installer (Windows).
# Usage: right-click -> "Run with PowerShell"
#        or: powershell -NoProfile -File install-agent.ps1
#
# Copies the agent into the user profile, adds a Start menu shortcut and
# (optionally) starts it with Windows. No administrator rights are needed,
# unless you want to teach an application that itself runs as administrator.
param(
    [switch]$NoAutostart,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$zrodlo = Split-Path -Parent $MyInvocation.MyCommand.Path
$katalog = Join-Path $env:LOCALAPPDATA "MystticBarcodeScanner"
$exe = Join-Path $katalog "MystticBarcodeAgent.exe"
$autostart = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\Mysttic Barcode Agent.lnk"
$menuStart = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Mysttic Barcode Agent.lnk"

function Stop-Agent {
    Get-Process -Name "MystticBarcodeAgent" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Stopping the running agent (PID $($_.Id))..."
        $_.Kill()
        $_.WaitForExit(5000) | Out-Null
    }
}

function New-AgentShortcut($sciezkaSkrotu, $cel) {
    $shell = New-Object -ComObject WScript.Shell
    $skrot = $shell.CreateShortcut($sciezkaSkrotu)
    $skrot.TargetPath = $cel
    $skrot.WorkingDirectory = Split-Path -Parent $cel
    $skrot.Description = "Mysttic Barcode Scanner - form filling agent"
    $skrot.Save()
}

if ($Uninstall) {
    Write-Host "=== Uninstalling the agent ===" -ForegroundColor Cyan
    Stop-Agent
    foreach ($plik in @($autostart, $menuStart)) {
        if (Test-Path $plik) { Remove-Item $plik -Force; Write-Host "Removed shortcut: $plik" }
    }
    if (Test-Path $katalog) { Remove-Item $katalog -Recurse -Force; Write-Host "Removed: $katalog" }
    Write-Host "Your profiles were kept in $env:APPDATA\MystticBarcodeScanner" -ForegroundColor Yellow
    Write-Host "DONE" -ForegroundColor Green
    exit 0
}

Write-Host "=== Desktop agent installer ===" -ForegroundColor Cyan

$plikZrodlowy = Join-Path $zrodlo "MystticBarcodeAgent.exe"
if (-not (Test-Path $plikZrodlowy)) {
    Write-Host "ERROR: MystticBarcodeAgent.exe is missing next to this script." -ForegroundColor Red
    exit 1
}

Stop-Agent
New-Item -ItemType Directory -Force -Path $katalog | Out-Null
Copy-Item $plikZrodlowy $exe -Force
Write-Host "Installed: $exe"

# the example profile is copied only when there is no configuration yet
$konfiguracja = Join-Path $env:APPDATA "MystticBarcodeScanner"
$profilDocelowy = Join-Path $konfiguracja "profile.json"
$profilPrzykladowy = Join-Path $zrodlo "example-profile.json"
if ((Test-Path $profilPrzykladowy) -and -not (Test-Path $profilDocelowy)) {
    New-Item -ItemType Directory -Force -Path $konfiguracja | Out-Null
    Copy-Item $profilPrzykladowy $profilDocelowy
    Write-Host "Copied the example profile to $profilDocelowy"
}

New-AgentShortcut $menuStart $exe
Write-Host "Added a Start menu shortcut"

if (-not $NoAutostart) {
    New-AgentShortcut $autostart $exe
    Write-Host "The agent will start with Windows"
} else {
    if (Test-Path $autostart) { Remove-Item $autostart -Force }
    Write-Host "Autostart skipped (-NoAutostart)"
}

Start-Process $exe
Write-Host ""
Write-Host "DONE - the agent is running in the system tray." -ForegroundColor Green
Write-Host "Teach a new form: press Ctrl+Alt+F9 over the application window." -ForegroundColor Green
Write-Host "Uninstall: .\install-agent.ps1 -Uninstall" -ForegroundColor DarkGray
