// Aplikacja testowa dla agenta desktopowego: dwa ekrany (logowanie i karta
// pracownika) o ukladzie celowo niewygodnym dla samych TAB-ow - pola sa
// w innej kolejnosci niz dane w kodzie, a miedzy nimi siedza pola-pulapki.
//
// Kontrolki maja ustawione Name, wiec UI Automation widzi je jako AutomationId
// (WinForms mapuje Control.Name -> AutomationId) - to pozwala agentowi
// celowac w pola po identyfikatorze, a nie po wspolrzednych.
//
// Uruchomienie w trybie pelnoekranowym (symulacja kiosku):  AplikacjaTestowa.exe --kiosk
using System.Text;

namespace AplikacjaTestowa;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new GlowneOkno(args.Contains("--kiosk")));
    }
}

public class GlowneOkno : Form
{
    private readonly TabControl _zakladki = new() { Name = "zakladki", Dock = DockStyle.Fill };
    private readonly EkranLogowania _logowanie = new();
    private readonly EkranPracownika _pracownik = new();

    public GlowneOkno(bool kiosk)
    {
        Text = "Aplikacja testowa - system kadrowy";
        Name = "oknoGlowne";
        Width = 900;
        Height = 640;
        StartPosition = FormStartPosition.CenterScreen;

        var tabLogowanie = new TabPage("Logowanie") { Name = "tabLogowanie" };
        tabLogowanie.Controls.Add(_logowanie);
        var tabPracownik = new TabPage("Karta pracownika") { Name = "tabPracownik" };
        tabPracownik.Controls.Add(_pracownik);

        _zakladki.TabPages.Add(tabLogowanie);
        _zakladki.TabPages.Add(tabPracownik);
        _zakladki.SelectedIndex = 1; // domyslnie karta pracownika
        // tytul okna zmienia sie wraz z ekranem - agent moze po nim rozpoznac widok
        _zakladki.SelectedIndexChanged += (_, _) => AktualizujTytul();
        Controls.Add(_zakladki);
        AktualizujTytul();

        if (kiosk)
        {
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            TopMost = true;
        }
    }

    private void AktualizujTytul()
    {
        var nazwa = _zakladki.SelectedTab?.Text ?? "";
        Text = $"Aplikacja testowa - {nazwa}";
    }
}

/// <summary>Ekran logowania: login, haslo, oddzial (lista).</summary>
public class EkranPodstawowy : UserControl
{
    protected readonly TextBox Podglad = new()
    {
        Name = "podgladStanu",
        Multiline = true,
        ReadOnly = true,
        ScrollBars = ScrollBars.Vertical,
        Font = new Font("Consolas", 9f),
        Dock = DockStyle.Bottom,
        Height = 150,
        BackColor = Color.FromArgb(15, 23, 42),
        ForeColor = Color.FromArgb(226, 232, 240),
    };

    protected EkranPodstawowy()
    {
        Dock = DockStyle.Fill;
        BackColor = Color.White;
    }

    protected static Label Etykieta(string tekst, int y) => new()
    {
        Text = tekst,
        Left = 24,
        Top = y,
        Width = 260,
        AutoSize = false,
        Height = 20,
    };

    protected static TextBox Pole(string nazwa, int y, string placeholder = "") => new()
    {
        Name = nazwa,
        Left = 24,
        Top = y + 22,
        Width = 420,
        PlaceholderText = placeholder,
        Font = new Font("Segoe UI", 10f),
    };
}

public class EkranLogowania : EkranPodstawowy
{
    private readonly TextBox _login = Pole("txtLogin", 20);
    private readonly TextBox _haslo = Pole("txtHaslo", 80, "hasla agent NIE wypelnia");
    private readonly ComboBox _oddzial = new()
    {
        Name = "cmbOddzial",
        Left = 24,
        Top = 162,
        Width = 420,
        DropDownStyle = ComboBoxStyle.DropDownList,
        Font = new Font("Segoe UI", 10f),
    };

    public EkranLogowania()
    {
        _haslo.UseSystemPasswordChar = true;
        _oddzial.Items.AddRange(new object[] { "", "Centrala", "Magazyn", "Produkcja" });
        _oddzial.SelectedIndex = 0;

        Controls.Add(Etykieta("Login", 20));
        Controls.Add(_login);
        Controls.Add(Etykieta("Haslo (pulapka)", 80));
        Controls.Add(_haslo);
        Controls.Add(Etykieta("Oddzial", 140));
        Controls.Add(_oddzial);

        var zaloguj = new Button
        {
            Name = "btnZaloguj",
            Text = "Zaloguj",
            Left = 24,
            Top = 200,
            Width = 120,
            Height = 32,
        };
        var status = new Label { Name = "lblStatusLogowania", Left = 160, Top = 206, Width = 300, Text = "" };
        zaloguj.Click += (_, _) => status.Text = $"Zalogowano: {_login.Text} / {_oddzial.Text}";
        Controls.Add(zaloguj);
        Controls.Add(status);

        _login.TextChanged += (_, _) => Odswiez();
        _oddzial.SelectedIndexChanged += (_, _) => Odswiez();
        Controls.Add(Podglad);
        Odswiez();
    }

    private void Odswiez() =>
        Podglad.Text = "stan ekranu logowania:\r\n" +
                       $"  login   = \"{_login.Text}\"\r\n" +
                       $"  oddzial = \"{_oddzial.Text}\"\r\n" +
                       $"  haslo   = {(_haslo.Text.Length > 0 ? "(cos wpisano!)" : "(puste - poprawnie)")}";
}

/// <summary>Karta pracownika: pola w innej kolejnosci niz dane w kodzie.</summary>
public class EkranPracownika : EkranPodstawowy
{
    private readonly ComboBox _dzial = new()
    {
        Name = "cmbDzial",
        Left = 24,
        Top = 42,
        Width = 420,
        DropDownStyle = ComboBoxStyle.DropDownList,
        Font = new Font("Segoe UI", 10f),
    };
    private readonly TextBox _email = Pole("txtEmail", 80, "pulapka - skan tego nie dotyczy");
    private readonly TextBox _numer = Pole("txtNumer", 140);
    private readonly TextBox _imie = Pole("txtImie", 200);
    private readonly TextBox _telefon = Pole("txtTelefon", 260, "pulapka - skan tego nie dotyczy");
    private readonly TextBox _nazwisko = Pole("txtNazwisko", 320);
    // Pole z podpowiedziami: UI Automation raportuje je jako ComboBox, ale nie
    // jest lista wyboru - mozna wpisac dowolny tekst (tak dziala np. pole
    // wyszukiwania w aplikacjach Electron).
    private readonly ComboBox _stanowisko = new()
    {
        Name = "cmbStanowisko",
        Left = 24,
        Top = 402,
        Width = 420,
        DropDownStyle = ComboBoxStyle.DropDown,
        Font = new Font("Segoe UI", 10f),
    };
    private readonly Label _status = new() { Name = "lblStatus", Left = 24, Top = 452, Width = 420, Text = "" };

    public EkranPracownika()
    {
        _dzial.Items.AddRange(new object[] { "", "HR", "IT", "FIN" });
        _dzial.SelectedIndex = 0;

        Controls.Add(Etykieta("Dzial", 20));
        Controls.Add(_dzial);
        Controls.Add(Etykieta("Adres e-mail (pulapka)", 80));
        Controls.Add(_email);
        Controls.Add(Etykieta("Numer pracownika", 140));
        Controls.Add(_numer);
        Controls.Add(Etykieta("Imie", 200));
        Controls.Add(_imie);
        Controls.Add(Etykieta("Telefon (pulapka)", 260));
        Controls.Add(_telefon);
        Controls.Add(Etykieta("Nazwisko", 320));
        Controls.Add(_nazwisko);

        _stanowisko.Items.AddRange(new object[] { "Specjalista", "Kierownik" });
        Controls.Add(Etykieta("Stanowisko (pole z podpowiedziami)", 380));
        Controls.Add(_stanowisko);

        var zapisz = new Button
        {
            Name = "btnZapisz",
            Text = "Zapisz",
            Left = 24,
            Top = 420,
            Width = 120,
            Height = 30,
        };
        zapisz.Click += (_, _) => _status.Text = "Zapisano karte pracownika";
        Controls.Add(zapisz);
        Controls.Add(_status);

        foreach (var pole in new[] { _imie, _nazwisko, _numer, _email, _telefon })
            pole.TextChanged += (_, _) => Odswiez();
        _dzial.SelectedIndexChanged += (_, _) => Odswiez();
        _stanowisko.TextChanged += (_, _) => Odswiez();

        Controls.Add(Podglad);
        Odswiez();
    }

    private void Odswiez()
    {
        var wypelnione = new[] { _imie.Text, _nazwisko.Text, _numer.Text, _dzial.Text }.Count(t => t.Length > 0);
        var sb = new StringBuilder();
        sb.AppendLine("stan aplikacji (to trafiloby do bazy):");
        sb.AppendLine($"  imie     = \"{_imie.Text}\"");
        sb.AppendLine($"  nazwisko = \"{_nazwisko.Text}\"");
        sb.AppendLine($"  numer    = \"{_numer.Text}\"");
        sb.AppendLine($"  dzial    = \"{_dzial.Text}\"");
        sb.AppendLine($"  stanowisko = \"{_stanowisko.Text}\"");
        sb.AppendLine();
        sb.AppendLine(wypelnione == 4
            ? "OK: aplikacja zobaczyla wszystkie 4 wartosci"
            : $"wypelnione: {wypelnione}/4");
        if (_email.Text.Length > 0 || _telefon.Text.Length > 0)
            sb.AppendLine("UWAGA: pole-pulapka nie jest puste!");
        Podglad.Text = sb.ToString();
    }
}
