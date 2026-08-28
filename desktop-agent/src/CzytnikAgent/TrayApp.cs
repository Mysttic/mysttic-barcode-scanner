// Ikona w zasobniku: wlacznik, lista profili, wejscie w tryb nauki.
//
// Tryb nauki uruchamia sie globalnym skrotem (domyslnie Ctrl+Alt+F9), zeby
// dzialal takze wtedy, gdy aplikacja docelowa pracuje w trybie kiosku i nie
// da sie dosiegnac zasobnika.
//
// Konfiguracja jest przeladowywana natychmiast po nauce oraz po kazdej zmianie
// pliku profili - restart agenta nie jest do niczego potrzebny.
using System.IO;

namespace CzytnikAgent;

public class TrayApp : IDisposable
{
    private const int IdSkrotu = 0xBC01;

    private readonly NotifyIcon _ikona;
    private readonly OknoUkryte _okno;
    private readonly Wedge _wedge;
    private readonly string? _sciezkaProfili;
    private Konfiguracja _konfiguracja;
    private OknoNauki? _nauka;
    private FileSystemWatcher? _obserwator;
    private System.Threading.Timer? _debounce;

    public TrayApp(string? sciezkaProfili)
    {
        _sciezkaProfili = sciezkaProfili;
        _konfiguracja = Magazyn.Wczytaj(sciezkaProfili);

        _okno = new OknoUkryte(UruchomNauke);
        _okno.CreateControl();

        _ikona = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Visible = true,
            Text = "Czytnik kodow - agent",
        };
        _ikona.DoubleClick += (_, _) => PokazProfile();
        BudujMenu();

        _wedge = new Wedge(() => _konfiguracja, () => _nauka != null);
        _wedge.Skan += NaSkan;
        _wedge.Diagnostyka += (_, tekst) => Dymek("Czytnik", tekst, ToolTipIcon.Warning);
        _wedge.Start();

        if (!Native.RegisterHotKey(_okno.Handle, IdSkrotu,
                Native.MOD_CONTROL | Native.MOD_ALT | Native.MOD_NOREPEAT, 0x78 /* F9 */))
        {
            Dymek("Czytnik", "nie udalo sie zarejestrowac skrotu Ctrl+Alt+F9", ToolTipIcon.Warning);
        }

        ObserwujPlikProfili();

        Log.Pisz($"agent start, profili: {_konfiguracja.Profile.Count}, plik: {sciezkaProfili ?? Magazyn.Sciezka}");
        Dymek("Czytnik kodow", $"Agent dziala. Profili: {_konfiguracja.Profile.Count}. " +
                               "Nauka: Ctrl+Alt+F9", ToolTipIcon.Info);
    }

    private void BudujMenu()
    {
        var menu = new ContextMenuStrip();

        var wlaczony = new ToolStripMenuItem("Wlaczony") { Checked = _konfiguracja.Wlaczony, CheckOnClick = true };
        wlaczony.Click += (_, _) =>
        {
            _konfiguracja.Wlaczony = wlaczony.Checked;
            Magazyn.Zapisz(_konfiguracja, _sciezkaProfili);
        };
        menu.Items.Add(wlaczony);

        menu.Items.Add(new ToolStripSeparator());
        var naukaPozycja = new ToolStripMenuItem("Ucz nowego formularza\tCtrl+Alt+F9");
        naukaPozycja.Click += (_, _) => UruchomNauke();
        menu.Items.Add(naukaPozycja);

        var profilePozycja = new ToolStripMenuItem("Profile (zarzadzaj)...");
        profilePozycja.Click += (_, _) => PokazProfile();
        menu.Items.Add(profilePozycja);

        var przeladuj = new ToolStripMenuItem("Przeladuj profile z pliku");
        przeladuj.Click += (_, _) =>
        {
            Przeladuj("recznie z menu");
            Dymek("Czytnik", $"Wczytano profili: {_konfiguracja.Profile.Count}", ToolTipIcon.Info);
        };
        menu.Items.Add(przeladuj);

        var otworzPlik = new ToolStripMenuItem("Otworz plik profili");
        otworzPlik.Click += (_, _) =>
        {
            var plik = _sciezkaProfili ?? Magazyn.Sciezka;
            if (File.Exists(plik))
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(plik) { UseShellExecute = true });
        };
        menu.Items.Add(otworzPlik);

        menu.Items.Add(new ToolStripSeparator());
        var koniec = new ToolStripMenuItem("Zakoncz");
        koniec.Click += (_, _) => { _ikona.Visible = false; Application.Exit(); };
        menu.Items.Add(koniec);

        _ikona.ContextMenuStrip = menu;
    }

    private OknoProfili? _oknoProfili;

    private void PokazProfile()
    {
        if (_oknoProfili != null && !_oknoProfili.IsDisposed) { _oknoProfili.Activate(); return; }
        _oknoProfili = new OknoProfili(_konfiguracja, _sciezkaProfili, () => Przeladuj("edycja profili"));
        _oknoProfili.FormClosed += (_, _) => { _oknoProfili = null; Przeladuj("zamkniecie okna profili"); };
        _oknoProfili.Show();
    }

    private void UruchomNauke()
    {
        if (_nauka != null) { _nauka.Activate(); return; }

        var okno = Native.GetForegroundWindow();
        if (okno == IntPtr.Zero || okno == _okno.Handle)
        {
            Dymek("Czytnik", "Najpierw przejdz do okna aplikacji, ktorej chcesz nauczyc.", ToolTipIcon.Warning);
            return;
        }

        _nauka = new OknoNauki(_konfiguracja, okno, _sciezkaProfili, PoZapisieProfilu);
        _nauka.FormClosed += (_, _) =>
        {
            _nauka = null;
            Przeladuj("zamkniecie kreatora");
        };
        _nauka.Show();
    }

    /// <summary>Nowy profil ma dzialac natychmiast, bez restartu agenta.</summary>
    private void PoZapisieProfilu(Profil profil)
    {
        Przeladuj($"nauka profilu \"{profil.Nazwa}\"");
        Dymek("Profil zapisany",
            $"\"{profil.Nazwa}\" dziala od zaraz ({profil.Kroki.Count} krokow). Mozesz skanowac.",
            ToolTipIcon.Info);
    }

    private void Przeladuj(string powod)
    {
        _konfiguracja = Magazyn.Wczytaj(_sciezkaProfili);
        Log.Pisz($"przeladowano profile ({powod}): {_konfiguracja.Profile.Count}");
    }

    /// <summary>
    /// Plik profili moze zmienic sie takze poza agentem (edycja recznie,
    /// podmiana przy prowizjonowaniu stanowisk) - wtedy tez przeladowujemy.
    /// </summary>
    private void ObserwujPlikProfili()
    {
        var plik = _sciezkaProfili ?? Magazyn.Sciezka;
        var katalog = Path.GetDirectoryName(Path.GetFullPath(plik));
        if (string.IsNullOrEmpty(katalog)) return;

        try
        {
            Directory.CreateDirectory(katalog);
            _obserwator = new FileSystemWatcher(katalog, Path.GetFileName(plik))
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size,
                EnableRaisingEvents = true,
            };
            FileSystemEventHandler naZmiane = (_, _) =>
            {
                // zapis pliku potrafi wygenerowac kilka zdarzen - scalamy je
                _debounce?.Dispose();
                _debounce = new System.Threading.Timer(_ =>
                {
                    try { Przeladuj("zmiana pliku profili"); }
                    catch (IOException) { /* plik w trakcie zapisu - nastepne zdarzenie zalatwi sprawe */ }
                }, null, 300, Timeout.Infinite);
            };
            _obserwator.Changed += naZmiane;
            _obserwator.Created += naZmiane;
            _obserwator.Renamed += (_, _) => naZmiane(this, null!);
        }
        catch (ArgumentException) { /* nietypowa sciezka - dzialamy bez obserwatora */ }
    }

    private void NaSkan(object? nadawca, ZdarzenieSkanu zdarzenie)
    {
        try
        {
            Log.Pisz($"skan: {zdarzenie.Ramka} -> profil \"{zdarzenie.Profil.Nazwa}\", " +
                     $"pola: {string.Join(", ", zdarzenie.Pola.Select(p => p.Key + "=" + p.Value))}");
            var wynik = Makro.Wykonaj(zdarzenie.Profil, zdarzenie.Pola, zdarzenie.Okno, _konfiguracja.Ustawienia);
            foreach (var krok in wynik.Kroki) Log.Pisz($"  [{(krok.Ok ? "OK" : "BLAD")}] {krok.Opis}");
            var tekst = $"{zdarzenie.Profil.Nazwa}: {wynik.Podsumowanie()}";
            Dymek("Wypelniono", tekst, wynik.Nieudane == 0 ? ToolTipIcon.Info : ToolTipIcon.Warning);
        }
        catch (Exception e)
        {
            // wyjatek w watku puli zabilby caly proces - lapiemy i logujemy
            Log.Pisz("BLAD makra: " + e);
            Dymek("Czytnik", "blad makra: " + e.Message, ToolTipIcon.Error);
        }
    }

    private void Dymek(string tytul, string tekst, ToolTipIcon ikona)
    {
        try
        {
            _ikona.BalloonTipTitle = tytul;
            _ikona.BalloonTipText = tekst.Length > 200 ? tekst[..200] : tekst;
            _ikona.BalloonTipIcon = ikona;
            _ikona.ShowBalloonTip(2500);
        }
        catch (InvalidOperationException) { /* ikona juz usunieta */ }
    }

    public void Dispose()
    {
        Native.UnregisterHotKey(_okno.Handle, IdSkrotu);
        _obserwator?.Dispose();
        _debounce?.Dispose();
        _wedge.Dispose();
        _ikona.Dispose();
        _okno.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>Niewidoczne okno - odbiornik globalnego skrotu klawiszowego.</summary>
    private class OknoUkryte : Form
    {
        private readonly Action _naSkrot;

        public OknoUkryte(Action naSkrot)
        {
            _naSkrot = naSkrot;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            Opacity = 0;
            Size = new Size(1, 1);
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-3000, -3000);
        }

        protected override void SetVisibleCore(bool value) => base.SetVisibleCore(false);

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == Native.WM_HOTKEY) _naSkrot();
            base.WndProc(ref m);
        }
    }
}
