// Model profilu aplikacji i jego magazyn (JSON w %APPDATA%\CzytnikAgent).
//
// Profil jest celowo blizniaczy do profilu wtyczki przegladarkowej:
//   match (gdzie) -> parse (jak rozlozyc kod na pola) -> kroki (co zrobic)
// Roznica: zamiast selektorow CSS mamy cele UI Automation, a zamiast
// wypelniania DOM - makro (klawisze, klikniecia, wpisywanie).
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CzytnikAgent;

public class Dopasowanie
{
    /// <summary>Nazwa procesu bez rozszerzenia, np. "AplikacjaTestowa". Puste = dowolny.</summary>
    public string Proces { get; set; } = "";

    /// <summary>Wzorzec tytulu okna z gwiazdkami, np. "*Karta pracownika*". Puste = dowolny.</summary>
    public string TytulWzorzec { get; set; } = "";

    public bool Pasuje(string proces, string tytul)
    {
        if (!string.IsNullOrEmpty(Proces) &&
            !string.Equals(Proces, proces, StringComparison.OrdinalIgnoreCase)) return false;
        return string.IsNullOrEmpty(TytulWzorzec) || Wzorce.Pasuje(TytulWzorzec, tytul);
    }
}

public class Parsowanie
{
    /// <summary>"delimited" | "regex" | "gs1"</summary>
    public string Typ { get; set; } = "delimited";
    public string Prefiks { get; set; } = "";
    public string Separator { get; set; } = ";";
    /// <summary>Nazwy segmentow po kolei; "_" = segment pomijany.</summary>
    public List<string> Pola { get; set; } = new();
    /// <summary>Dla typu "regex": wzorzec i mapa pole -> numer grupy.</summary>
    public string Wzorzec { get; set; } = "";
    public Dictionary<string, int> Grupy { get; set; } = new();
    /// <summary>Dla "gs1": znak rozdzielajacy pola zmiennej dlugosci, gdy GS nie przechodzi.</summary>
    public string ZnakGs { get; set; } = "";
}

/// <summary>Cel kroku: kontrolka UI Automation albo punkt wzgledem okna.</summary>
public class Cel
{
    public string AutomationId { get; set; } = "";
    public string Nazwa { get; set; } = "";
    public string Typ { get; set; } = "";

    /// <summary>Wspolrzedne wzgledem obszaru klienta okna (fallback, gdy UIA nie znajdzie).</summary>
    public int? X { get; set; }
    public int? Y { get; set; }

    [JsonIgnore] public bool MaUia => !string.IsNullOrEmpty(AutomationId) || !string.IsNullOrEmpty(Nazwa);
    [JsonIgnore] public bool MaPunkt => X.HasValue && Y.HasValue;

    public string Opis()
    {
        if (!string.IsNullOrEmpty(AutomationId)) return $"#{AutomationId}";
        if (!string.IsNullOrEmpty(Nazwa)) return $"\"{Nazwa}\"";
        return MaPunkt ? $"({X},{Y})" : "(brak celu)";
    }
}

/// <summary>Jeden krok makra.</summary>
public class Krok
{
    /// <summary>"pole" | "tekst" | "klawisz" | "klik" | "pauza"</summary>
    public string Akcja { get; set; } = "pole";

    /// <summary>Dla "pole"/"klik": gdzie.</summary>
    public Cel? Cel { get; set; }

    /// <summary>Dla "pole"/"tekst": szablon wartosci, np. "{imie} {nazwisko}".</summary>
    public string Wartosc { get; set; } = "";

    /// <summary>Dla "klawisz": TAB, ENTER, ESC, F1..F12, UP/DOWN/LEFT/RIGHT, BACKSPACE.</summary>
    public string Klawisz { get; set; } = "";

    /// <summary>Dla "pauza": ile milisekund.</summary>
    public int Ms { get; set; }

    /// <summary>
    /// Jak potraktowac kontrolke przy akcji "pole":
    ///   "wpisz"   - wpisz tekst (tak nauczyl operator: pisal w to pole),
    ///   "wybierz" - wybierz pozycje z listy (operator klikal w liste),
    ///   "auto"    - agent decyduje sam (profile pisane recznie).
    /// Bez tego pola agent musialby zgadywac, a pole wyszukiwania
    /// z podpowiedziami wyglada w UI Automation jak lista wyboru.
    /// </summary>
    public string Tryb { get; set; } = "auto";

    public string Opis() => Akcja switch
    {
        "pole" => $"pole {Cel?.Opis()} = {Wartosc}" +
                  (Tryb == "wybierz" ? " (wybór z listy)" : Tryb == "wpisz" ? " (wpisz)" : ""),
        "tekst" => $"wpisz \"{Wartosc}\"",
        "klawisz" => $"klawisz {Klawisz}",
        "klik" => $"klik {Cel?.Opis()}",
        "pauza" => $"pauza {Ms} ms",
        _ => Akcja,
    };
}

public class Profil
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Nazwa { get; set; } = "Nowy profil";
    public bool Wlaczony { get; set; } = true;
    public Dopasowanie Match { get; set; } = new();
    public Parsowanie Parse { get; set; } = new();
    public List<Krok> Kroki { get; set; } = new();
}

public class Ustawienia
{
    /// <summary>Maksymalna przerwa miedzy znakami uznawana jeszcze za skan (ms).</summary>
    public int OdstepSkanuMs { get; set; } = 60;
    /// <summary>Krotsze ramki ignorujemy.</summary>
    public int MinDlugoscRamki { get; set; } = 3;
    /// <summary>Pauza miedzy krokami makra (ms) - wolne aplikacje potrzebuja wiecej.</summary>
    public int PauzaKrokuMs { get; set; } = 40;
    /// <summary>Czy potwierdzac wypelnienie odczytem zwrotnym z UIA.</summary>
    public bool WeryfikujOdczytem { get; set; } = true;
}

public class Konfiguracja
{
    public int Wersja { get; set; } = 1;
    public bool Wlaczony { get; set; } = true;
    public Ustawienia Ustawienia { get; set; } = new();
    public List<Profil> Profile { get; set; } = new();
}

public static class Magazyn
{
    private static readonly JsonSerializerOptions Opcje = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static string Katalog =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CzytnikAgent");

    public static string Sciezka => Path.Combine(Katalog, "profile.json");

    public static Konfiguracja Wczytaj(string? sciezka = null)
    {
        var plik = sciezka ?? Sciezka;
        if (!File.Exists(plik)) return new Konfiguracja();
        try
        {
            return JsonSerializer.Deserialize<Konfiguracja>(File.ReadAllText(plik), Opcje) ?? new Konfiguracja();
        }
        catch (JsonException)
        {
            return new Konfiguracja();
        }
    }

    public static void Zapisz(Konfiguracja konfiguracja, string? sciezka = null)
    {
        var plik = sciezka ?? Sciezka;
        Directory.CreateDirectory(Path.GetDirectoryName(plik)!);
        File.WriteAllText(plik, JsonSerializer.Serialize(konfiguracja, Opcje));
    }
}

public static class Wzorce
{
    /// <summary>Dopasowanie z gwiazdkami: "*Karta*" pasuje do "Aplikacja - Karta pracownika".</summary>
    public static bool Pasuje(string wzorzec, string tekst)
    {
        if (string.IsNullOrEmpty(wzorzec)) return true;
        var czesci = wzorzec.Split('*');
        var pozycja = 0;
        for (var i = 0; i < czesci.Length; i++)
        {
            var czesc = czesci[i];
            if (czesc.Length == 0) continue;
            var znaleziono = tekst.IndexOf(czesc, pozycja, StringComparison.OrdinalIgnoreCase);
            if (znaleziono < 0) return false;
            if (i == 0 && !wzorzec.StartsWith('*') && znaleziono != 0) return false;
            pozycja = znaleziono + czesc.Length;
        }
        if (!wzorzec.EndsWith('*') && czesci[^1].Length > 0 && pozycja != tekst.Length) return false;
        return true;
    }
}
