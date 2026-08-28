# Instalator agenta desktopowego czytnika kodow (Windows).
# Uzycie: kliknij prawym -> "Uruchom w programie PowerShell"
#         albo: powershell -NoProfile -File zainstaluj-agenta.ps1
#
# Kopiuje agenta do profilu uzytkownika, dodaje skrot w menu Start i (opcjonalnie)
# uruchamianie przy starcie systemu. Nie wymaga uprawnien administratora,
# dopoki nie uczysz aplikacji dzialajacej jako administrator.
param(
    [switch]$BezAutostartu,
    [switch]$Odinstaluj
)

$ErrorActionPreference = "Stop"
$zrodlo = Split-Path -Parent $MyInvocation.MyCommand.Path
$katalog = Join-Path $env:LOCALAPPDATA "CzytnikAgent"
$exe = Join-Path $katalog "CzytnikAgent.exe"
$autostart = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\Czytnik - agent.lnk"
$menuStart = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Czytnik - agent.lnk"

function Zatrzymaj-Agenta {
    Get-Process -Name "CzytnikAgent" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Zatrzymuje dzialajacego agenta (PID $($_.Id))..."
        $_.Kill()
        $_.WaitForExit(5000) | Out-Null
    }
}

function Utworz-Skrot($sciezkaSkrotu, $cel) {
    $shell = New-Object -ComObject WScript.Shell
    $skrot = $shell.CreateShortcut($sciezkaSkrotu)
    $skrot.TargetPath = $cel
    $skrot.WorkingDirectory = Split-Path -Parent $cel
    $skrot.Description = "Czytnik kodow - agent wypelniania formularzy"
    $skrot.Save()
}

if ($Odinstaluj) {
    Write-Host "=== Odinstalowanie agenta ===" -ForegroundColor Cyan
    Zatrzymaj-Agenta
    foreach ($plik in @($autostart, $menuStart)) {
        if (Test-Path $plik) { Remove-Item $plik -Force; Write-Host "Usunieto skrot: $plik" }
    }
    if (Test-Path $katalog) { Remove-Item $katalog -Recurse -Force; Write-Host "Usunieto: $katalog" }
    Write-Host "Profile zostaly zachowane w $env:APPDATA\CzytnikAgent" -ForegroundColor Yellow
    Write-Host "GOTOWE" -ForegroundColor Green
    exit 0
}

Write-Host "=== Instalator agenta desktopowego ===" -ForegroundColor Cyan

$plikZrodlowy = Join-Path $zrodlo "CzytnikAgent.exe"
if (-not (Test-Path $plikZrodlowy)) {
    Write-Host "BLAD: brak CzytnikAgent.exe obok skryptu." -ForegroundColor Red
    exit 1
}

Zatrzymaj-Agenta
New-Item -ItemType Directory -Force -Path $katalog | Out-Null
Copy-Item $plikZrodlowy $exe -Force
Write-Host "Zainstalowano: $exe"

# przykladowy profil trafia do konfiguracji tylko wtedy, gdy jej jeszcze nie ma
$konfiguracja = Join-Path $env:APPDATA "CzytnikAgent"
$profilDocelowy = Join-Path $konfiguracja "profile.json"
$profilPrzykladowy = Join-Path $zrodlo "profil-przykladowy.json"
if ((Test-Path $profilPrzykladowy) -and -not (Test-Path $profilDocelowy)) {
    New-Item -ItemType Directory -Force -Path $konfiguracja | Out-Null
    Copy-Item $profilPrzykladowy $profilDocelowy
    Write-Host "Skopiowano przykladowy profil do $profilDocelowy"
}

Utworz-Skrot $menuStart $exe
Write-Host "Dodano skrot w menu Start"

if (-not $BezAutostartu) {
    Utworz-Skrot $autostart $exe
    Write-Host "Agent bedzie uruchamiany przy starcie systemu"
} else {
    if (Test-Path $autostart) { Remove-Item $autostart -Force }
    Write-Host "Autostart pominiety (parametr -BezAutostartu)"
}

Start-Process $exe
Write-Host ""
Write-Host "GOTOWE - agent dziala w zasobniku systemowym." -ForegroundColor Green
Write-Host "Nauka nowego formularza: Ctrl+Alt+F9 na oknie aplikacji." -ForegroundColor Green
Write-Host "Odinstalowanie: .\zainstaluj-agenta.ps1 -Odinstaluj" -ForegroundColor DarkGray
