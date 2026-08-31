// Zarzadzanie profilami: wlaczanie, zmiana nazwy i dopasowania, usuwanie.
// Odpowiednik listy profili z opcji wtyczki przegladarkowej.
using System.IO;

namespace CzytnikAgent;

public class OknoProfili : Form
{
    private readonly string? _sciezka;
    private Konfiguracja _konfiguracja;
    private readonly Action _poZmianie;

    private readonly ListBox _lista = new() { Left = 12, Top = 12, Width = 250, Height = 300 };
    private readonly CheckBox _wlaczony = new() { Left = 276, Top = 14, Width = 220, Text = Teksty.T("profiles.enabled") };
    private readonly TextBox _nazwa = new() { Left = 276, Top = 60, Width = 300 };
    private readonly TextBox _proces = new() { Left = 276, Top = 108, Width = 300 };
    private readonly TextBox _tytul = new() { Left = 276, Top = 156, Width = 300 };
    private readonly TextBox _szczegoly = new()
    {
        Left = 276, Top = 196, Width = 300, Height = 116, Multiline = true, ReadOnly = true,
        ScrollBars = ScrollBars.Vertical, Font = new Font("Consolas", 8.5f), BackColor = SystemColors.Control,
    };

    private readonly Button _zapisz = new() { Left = 276, Top = 322, Width = 90, Height = 30, Text = Teksty.T("profiles.save") };
    private readonly Button _usun = new() { Left = 372, Top = 322, Width = 90, Height = 30, Text = Teksty.T("profiles.delete") };
    private readonly Button _plik = new() { Left = 468, Top = 322, Width = 108, Height = 30, Text = Teksty.T("profiles.openFile") };
    private readonly Button _zamknij = new() { Left = 12, Top = 322, Width = 90, Height = 30, Text = Teksty.T("profiles.close") };

    public OknoProfili(Konfiguracja konfiguracja, string? sciezka, Action poZmianie)
    {
        _konfiguracja = konfiguracja;
        _sciezka = sciezka;
        _poZmianie = poZmianie;

        Text = Teksty.T("profiles.title");
        Width = 610;
        Height = 405;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;

        Controls.AddRange(new Control[]
        {
            _lista, _wlaczony,
            Etykieta(Teksty.T("profiles.name"), 44), _nazwa,
            Etykieta(Teksty.T("profiles.process"), 92), _proces,
            Etykieta(Teksty.T("profiles.titlePattern"), 140), _tytul,
            Etykieta(Teksty.T("profiles.steps"), 180), _szczegoly,
            _zapisz, _usun, _plik, _zamknij,
        });

        _lista.SelectedIndexChanged += (_, _) => PokazWybrany();
        _zapisz.Click += (_, _) => ZapiszZmiany();
        _usun.Click += (_, _) => UsunWybrany();
        _plik.Click += (_, _) => OtworzPlik();
        _zamknij.Click += (_, _) => Close();

        Odswiez();
    }

    private static Label Etykieta(string tekst, int top) => new()
    {
        Text = tekst, Left = 276, Top = top, Width = 300, Height = 16,
        Font = new Font("Segoe UI", 8f), ForeColor = Color.DimGray,
    };

    private void Odswiez()
    {
        var wybrany = _lista.SelectedIndex;
        _lista.Items.Clear();
        foreach (var profil in _konfiguracja.Profile)
            _lista.Items.Add($"{(profil.Wlaczony ? "[x]" : "[ ]")} {profil.Nazwa}");
        if (_lista.Items.Count > 0)
            _lista.SelectedIndex = Math.Clamp(wybrany, 0, _lista.Items.Count - 1);
        PokazWybrany();
    }

    private Profil? Wybrany =>
        _lista.SelectedIndex >= 0 && _lista.SelectedIndex < _konfiguracja.Profile.Count
            ? _konfiguracja.Profile[_lista.SelectedIndex]
            : null;

    private void PokazWybrany()
    {
        var profil = Wybrany;
        var jest = profil != null;
        _wlaczony.Enabled = _nazwa.Enabled = _proces.Enabled = _tytul.Enabled = jest;
        _zapisz.Enabled = _usun.Enabled = jest;

        if (profil == null)
        {
            _wlaczony.Checked = false;
            _nazwa.Text = _proces.Text = _tytul.Text = "";
            _szczegoly.Text = _konfiguracja.Profile.Count == 0
                ? Teksty.T("profiles.empty")
                : "";
            return;
        }

        _wlaczony.Checked = profil.Wlaczony;
        _nazwa.Text = profil.Nazwa;
        _proces.Text = profil.Match.Proces;
        _tytul.Text = profil.Match.TytulWzorzec;
        _szczegoly.Text =
            Teksty.T("profiles.fields", string.Join(", ", profil.Parse.Pola.Where(p => p != "_"))) + "\r\n" +
            Teksty.T("profiles.prefix",
                profil.Parse.Prefiks.Length > 0 ? profil.Parse.Prefiks : Teksty.T("profiles.none"),
                profil.Parse.Separator == "\t" ? "TAB" : profil.Parse.Separator) + "\r\n" +
            string.Join("\r\n", profil.Kroki.Select((k, i) => $"{i + 1}. {k.Opis()}"));
    }

    private void ZapiszZmiany()
    {
        var profil = Wybrany;
        if (profil == null) return;

        profil.Wlaczony = _wlaczony.Checked;
        profil.Nazwa = _nazwa.Text.Trim().Length > 0 ? _nazwa.Text.Trim() : profil.Nazwa;
        profil.Match.Proces = _proces.Text.Trim();
        profil.Match.TytulWzorzec = _tytul.Text.Trim();
        Zapisz();
    }

    private void UsunWybrany()
    {
        var profil = Wybrany;
        if (profil == null) return;
        if (MessageBox.Show(Teksty.T("profiles.deleteConfirm", profil.Nazwa), Teksty.T("profiles.dialogTitle"),
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;

        _konfiguracja.Profile.Remove(profil);
        Zapisz();
    }

    private void Zapisz()
    {
        Magazyn.Zapisz(_konfiguracja, _sciezka);
        Log.Pisz($"profiles saved from the management window: {_konfiguracja.Profile.Count}");
        _poZmianie();
        Odswiez();
    }

    private void OtworzPlik()
    {
        var plik = _sciezka ?? Magazyn.Sciezka;
        if (!File.Exists(plik)) return;
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(plik) { UseShellExecute = true });
    }
}
