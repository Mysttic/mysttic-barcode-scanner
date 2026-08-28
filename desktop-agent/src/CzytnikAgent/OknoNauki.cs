// Kreator nauki profilu: skan -> nazwy segmentow -> nagranie makra -> zapis.
// Okno jest zawsze na wierzchu, zeby dzialalo takze nad aplikacjami kioskowymi.
using System.Text;

namespace CzytnikAgent;

public class OknoNauki : Form
{
    private readonly Konfiguracja _konfiguracja;
    private readonly IntPtr _oknoDocelowe;
    private readonly string _proces, _tytul;
    private readonly string? _sciezkaProfili;
    private readonly Action<Profil>? _poZapisie;

    private readonly Label _naglowek = new() { Left = 16, Top = 12, Width = 520, Height = 22, Font = new Font("Segoe UI", 11f, FontStyle.Bold) };
    private readonly Label _opis = new() { Left = 16, Top = 38, Width = 520, Height = 56 };
    private readonly TextBox _ramka = new() { Left = 16, Top = 96, Width = 520, Font = new Font("Consolas", 10f) };
    private readonly Panel _segmenty = new() { Left = 16, Top = 126, Width = 520, Height = 150, AutoScroll = true, Visible = false };
    private readonly ListBox _podglad = new() { Left = 16, Top = 126, Width = 520, Height = 150, Visible = false, Font = new Font("Consolas", 9f) };
    // Parametry rozpoznanego okna - widoczne i edytowalne przed zapisem
    private readonly Label _etNazwa = new() { Left = 16, Top = 282, Width = 120, Height = 18, Visible = false, Text = "Nazwa profilu:" };
    private readonly TextBox _nazwaProfilu = new() { Left = 140, Top = 279, Width = 396, Visible = false };
    private readonly Label _etProces = new() { Left = 16, Top = 310, Width = 120, Height = 18, Visible = false, Text = "Proces:" };
    private readonly TextBox _procesPole = new() { Left = 140, Top = 307, Width = 396, Visible = false };
    private readonly Label _etTytul = new() { Left = 16, Top = 338, Width = 120, Height = 18, Visible = false, Text = "Wzorzec tytułu:" };
    private readonly TextBox _tytulPole = new() { Left = 140, Top = 335, Width = 396, Visible = false };
    private readonly Label _wskazowka = new()
    {
        Left = 16, Top = 360, Width = 520, Height = 30, Visible = false,
        ForeColor = Color.DimGray, Font = new Font("Segoe UI", 8f),
    };
    private readonly Button _dalej = new() { Text = "Dalej", Left = 356, Top = 398, Width = 90, Height = 30 };
    private readonly Button _anuluj = new() { Text = "Anuluj", Left = 452, Top = 398, Width = 84, Height = 30 };
    private readonly Label _stan = new() { Left = 16, Top = 404, Width = 330, Height = 20, ForeColor = Color.DimGray };

    private readonly List<TextBox> _poleNazwy = new();
    private string[] _czesci = Array.Empty<string>();
    private string _separator = ";";
    private Dictionary<string, string> _pola = new();
    private Nagrywarka? _nagrywarka;
    private List<Krok> _kroki = new();
    private int _krok;

    public OknoNauki(Konfiguracja konfiguracja, IntPtr oknoDocelowe,
        string? sciezkaProfili = null, Action<Profil>? poZapisie = null)
    {
        _konfiguracja = konfiguracja;
        _oknoDocelowe = oknoDocelowe;
        _sciezkaProfili = sciezkaProfili;
        _poZapisie = poZapisie;
        _proces = Native.ProcesOkna(oknoDocelowe);
        _tytul = Native.TytulOkna(oknoDocelowe);

        Text = "Nauka profilu - czytnik kodow";
        Width = 570;
        Height = 478;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.Manual;
        TopMost = true;
        ShowInTaskbar = true;

        Controls.AddRange(new Control[]
        {
            _naglowek, _opis, _ramka, _segmenty, _podglad,
            _etNazwa, _nazwaProfilu, _etProces, _procesPole, _etTytul, _tytulPole, _wskazowka,
            _dalej, _anuluj, _stan,
        });
        _dalej.Click += (_, _) => Dalej();
        _anuluj.Click += (_, _) => { _nagrywarka?.Stop(); Close(); };
        PokazKrok();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _nagrywarka?.Dispose();
        base.OnFormClosed(e);
    }

    // ------- sterowanie kreatorem z zewnatrz (tryb generowania zrzutow) -------

    internal void UstawRamkeTestowa(string ramka)
    {
        _ramka.Text = ramka;
        Dalej();
    }

    internal void NazwijSegmenty(IReadOnlyList<string> nazwy)
    {
        for (var i = 0; i < _poleNazwy.Count && i < nazwy.Count; i++)
            _poleNazwy[i].Text = nazwy[i];
    }

    internal void PokazNagranie(List<Krok> kroki)
    {
        Dalej();          // krok 2 -> 3 (zapamietuje nazwy segmentow)
        _kroki = kroki;
        _krok = 2;
        PokazKrok();
        OdswiezPodglad();
        _dalej.Text = "Stop";
        _stan.Text = "nagrywanie... przejdz do aplikacji";
    }

    internal void PokazZapis()
    {
        _stan.Text = "";
        _krok = 3;
        PokazKrok();
    }

    /// <summary>
    /// Okno kreatora siada w prawym dolnym rogu ekranu, na ktorym stoi uczona
    /// aplikacja - tam najmniej zaslania formularz. Pozycje ustawiamy dopiero
    /// przy pokazaniu, bo wczesniej rozmiar okna moze byc jeszcze skalowany
    /// przez ustawienia DPI.
    /// </summary>
    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        var ekran = _oknoDocelowe != IntPtr.Zero
            ? Screen.FromHandle(_oknoDocelowe)
            : Screen.PrimaryScreen!;
        var obszar = ekran.WorkingArea;
        Location = new Point(obszar.Right - Width - 24, obszar.Bottom - Height - 24);
    }

    /// <summary>
    /// W kroku 1 czytnik moze wysylac ramke z TAB-ami (sekwencja z profilu
    /// urzadzenia). TAB przeskoczylby fokus, wiec w polu ramki wstawiamy go
    /// jako znak, a ENTER (koniec skanu) przechodzi do nastepnego kroku.
    /// </summary>
    protected override bool ProcessDialogKey(Keys keyData)
    {
        if (_krok == 0 && ActiveControl == _ramka)
        {
            if (keyData == Keys.Tab)
            {
                var pozycja = _ramka.SelectionStart;
                _ramka.Text = _ramka.Text.Insert(pozycja, "\t");
                _ramka.SelectionStart = pozycja + 1;
                return true;
            }
            if (keyData == Keys.Enter)
            {
                Dalej();
                return true;
            }
        }
        return base.ProcessDialogKey(keyData);
    }

    private void PokazKrok()
    {
        _ramka.Visible = _krok == 0;
        _segmenty.Visible = _krok == 1;
        _podglad.Visible = _krok >= 2;
        _etNazwa.Visible = _nazwaProfilu.Visible = _krok == 3;
        _etProces.Visible = _procesPole.Visible = _krok == 3;
        _etTytul.Visible = _tytulPole.Visible = _krok == 3;
        _wskazowka.Visible = _krok == 3;

        switch (_krok)
        {
            case 0:
                _naglowek.Text = "Krok 1 z 4: zeskanuj kod";
                _opis.Text = $"Aplikacja: {_proces} - \"{_tytul}\"\r\n" +
                             "Kliknij w pole ponizej i zeskanuj kod, ktorym bedziesz wypelnial ten formularz " +
                             "(mozesz tez wpisac go recznie).";
                _ramka.Focus();
                _dalej.Text = "Dalej";
                break;

            case 1:
                _naglowek.Text = "Krok 2 z 4: nazwij segmenty";
                _opis.Text = "Kod zostal pociety. Nadaj nazwy segmentom, ktore chcesz wykorzystac. " +
                             "Wpisz \"_\" przy segmentach do pominiecia (np. prefiks).";
                BudujSegmenty();
                _dalej.Text = "Dalej";
                break;

            case 2:
                _naglowek.Text = "Krok 3 z 4: nagraj czynnosci";
                _opis.Text = "Kliknij \"Nagrywaj\", przejdz do aplikacji i wypelnij formularz recznie - " +
                             "klikajac w pola i wpisujac wartosci z kodu. Potem wroc tutaj i kliknij \"Stop\".";
                _dalej.Text = "Nagrywaj";
                OdswiezPodglad();
                break;

            case 3:
                _naglowek.Text = "Krok 4 z 4: zapisz profil";
                _opis.Text = "Sprawdz kroki i parametry rozpoznawania okna. Profil zadziala tylko wtedy, " +
                             "gdy zgadza sie proces ORAZ tytul okna pasuje do wzorca.";
                if (_nazwaProfilu.Text.Length == 0)
                {
                    _nazwaProfilu.Text = string.IsNullOrEmpty(_tytul) ? _proces : _tytul;
                    _procesPole.Text = _proces;
                    _tytulPole.Text = WzorzecTytulu(_tytul);
                }
                _wskazowka.Text = $"Wykryto: proces \"{_proces}\", tytul \"{_tytul}\".\r\n" +
                                  "Wzorzec pusty = dowolny tytul (przydatne, gdy tytul sie zmienia).";
                _dalej.Text = "Zapisz";
                OdswiezPodglad();
                break;
        }
    }

    private void Dalej()
    {
        switch (_krok)
        {
            case 0:
                {
                    var tekst = _ramka.Text.TrimEnd('\r', '\n');
                    if (tekst.Length < 2) { _stan.Text = "najpierw zeskanuj kod"; return; }
                    _separator = WybierzSeparator(tekst);
                    _czesci = tekst.Split(_separator);
                    _krok = 1;
                    break;
                }

            case 1:
                {
                    _pola = new Dictionary<string, string>();
                    for (var i = 0; i < _poleNazwy.Count; i++)
                    {
                        var nazwa = _poleNazwy[i].Text.Trim();
                        if (nazwa.Length == 0 || nazwa == "_") continue;
                        _pola[nazwa] = _czesci[i];
                    }
                    if (_pola.Count == 0) { _stan.Text = "nazwij przynajmniej jeden segment"; return; }
                    _krok = 2;
                    break;
                }

            case 2:
                if (_nagrywarka == null)
                {
                    _nagrywarka = new Nagrywarka(_oknoDocelowe, Handle);
                    _nagrywarka.Zmiana += (_, _) => BeginInvoke(OdswiezPodglad);
                    _nagrywarka.Start();
                    _dalej.Text = "Stop";
                    _stan.Text = "nagrywanie... przejdz do aplikacji";
                    Native.SetForegroundWindow(_oknoDocelowe);
                    return;
                }
                _nagrywarka.Stop();
                _kroki = _nagrywarka.Przetworz(_pola);
                _nagrywarka.Dispose();
                _nagrywarka = null;
                _stan.Text = "";
                if (_kroki.Count == 0) { _stan.Text = "nic nie nagrano - sprobuj ponownie"; _dalej.Text = "Nagrywaj"; return; }
                _krok = 3;
                break;

            case 3:
                Zapisz();
                return;
        }
        PokazKrok();
    }

    private void BudujSegmenty()
    {
        if (_segmenty.Controls.Count > 0) return;
        _poleNazwy.Clear();
        for (var i = 0; i < _czesci.Length; i++)
        {
            var wartosc = new TextBox
            {
                Left = 0,
                Top = i * 28,
                Width = 240,
                ReadOnly = true,
                Text = _czesci[i],
                BackColor = SystemColors.Control,
            };
            var nazwa = new TextBox
            {
                Left = 250,
                Top = i * 28,
                Width = 240,
                // pierwszy segment to zwykle prefiks
                Text = i == 0 && _czesci.Length > 1 ? "_" : "pole" + i,
            };
            _poleNazwy.Add(nazwa);
            _segmenty.Controls.Add(wartosc);
            _segmenty.Controls.Add(nazwa);
        }
    }

    private void OdswiezPodglad()
    {
        _podglad.Items.Clear();
        var zrodlo = _nagrywarka != null ? _nagrywarka.Kroki.ToList() : _kroki;
        foreach (var krok in zrodlo) _podglad.Items.Add(krok.Opis());
        if (_podglad.Items.Count > 0) _podglad.TopIndex = _podglad.Items.Count - 1;
    }

    private void Zapisz()
    {
        var profil = new Profil
        {
            Nazwa = _nazwaProfilu.Text.Trim().Length > 0 ? _nazwaProfilu.Text.Trim() : _proces,
            Wlaczony = true,
            Match = new Dopasowanie
            {
                Proces = _procesPole.Text.Trim(),
                TytulWzorzec = _tytulPole.Text.Trim(),
            },
            Parse = new Parsowanie
            {
                Typ = "delimited",
                Prefiks = _czesci.Length > 1 && _poleNazwy[0].Text.Trim() == "_" ? _czesci[0] + _separator : "",
                Separator = _separator,
                Pola = _poleNazwy.Select(t => t.Text.Trim()).ToList(),
            },
            Kroki = _kroki,
        };
        _konfiguracja.Profile.Add(profil);
        // zapis MUSI trafic do tego samego pliku, z ktorego czyta agent
        Magazyn.Zapisz(_konfiguracja, _sciezkaProfili);
        Log.Pisz($"nauka: zapisano profil \"{profil.Nazwa}\" ({profil.Kroki.Count} krokow)");

        // profil ma dzialac od razu - nie po restarcie agenta
        _poZapisie?.Invoke(profil);

        MessageBox.Show($"Zapisano profil \"{profil.Nazwa}\" ({profil.Kroki.Count} krokow).\n\n" +
                        "Profil jest juz aktywny - mozesz skanowac.",
            "Czytnik kodow", MessageBoxButtons.OK, MessageBoxIcon.Information);
        Close();
    }

    /// <summary>Z tytulu okna robi wzorzec: bierzemy czlon po myslniku, jesli jest.</summary>
    private static string WzorzecTytulu(string tytul)
    {
        if (string.IsNullOrWhiteSpace(tytul)) return "";
        var czesc = tytul.Split(" - ").LastOrDefault()?.Trim();
        return string.IsNullOrEmpty(czesc) ? "" : "*" + czesc + "*";
    }

    private static string WybierzSeparator(string ramka)
    {
        var kandydaci = new[] { ";", "|", "\t", "," };
        var najlepszy = ";";
        var najwiecej = 1;
        foreach (var kandydat in kandydaci)
        {
            var ile = ramka.Split(kandydat).Length;
            if (ile <= najwiecej) continue;
            najwiecej = ile;
            najlepszy = kandydat;
        }
        return najlepszy;
    }
}
