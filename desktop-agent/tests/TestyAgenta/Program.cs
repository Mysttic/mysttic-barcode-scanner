// Testy jednostkowe agenta desktopowego - bez zaleznosci, w konwencji reszty
// projektu (firmware: test_host.c, wtyczka: test_parse.mjs).
//
// Parser dostaje TE SAME wektory co firmware i wtyczka - to warunek tego, zeby
// profil dzialal tak samo w kazdej warstwie produktu.
using CzytnikAgent;

namespace TestyAgenta;

internal static class Program
{
    private static int _zaliczone;
    private static readonly List<string> Bledy = new();

    private static void Sprawdz(string nazwa, object? otrzymano, object? oczekiwano)
    {
        var a = System.Text.Json.JsonSerializer.Serialize(otrzymano);
        var b = System.Text.Json.JsonSerializer.Serialize(oczekiwano);
        if (a == b) _zaliczone++;
        else Bledy.Add($"{nazwa}\n    oczekiwano: {b}\n    otrzymano:  {a}");
    }

    private static void SprawdzPrawda(string nazwa, bool warunek) => Sprawdz(nazwa, warunek, true);

    private static int Main()
    {
        TestyParsera();
        TestyWzorcow();
        TestyDopasowania();
        TestyNagrywarki();
        TestyPodstawiania();

        if (Bledy.Count > 0)
        {
            Console.Error.WriteLine($"FAIL: {Bledy.Count} z {_zaliczone + Bledy.Count} asercji");
            foreach (var blad in Bledy) Console.Error.WriteLine("  - " + blad);
            return 1;
        }
        Console.WriteLine($"OK: {_zaliczone} asercji");
        return 0;
    }

    private static void TestyParsera()
    {
        var delimited = new Parsowanie
        {
            Typ = "delimited",
            Prefiks = "PRC;",
            Separator = ";",
            Pola = new List<string> { "_", "firstName", "lastName", "number", "department" },
        };
        Sprawdz("delimited: rozklada na pola",
            ParserSkanu.Parsuj("PRC;JAN;KOWALSKI;12345;IT", delimited).Pola,
            new Dictionary<string, string>
            {
                ["firstName"] = "JAN", ["lastName"] = "KOWALSKI", ["number"] = "12345", ["department"] = "IT",
            });
        SprawdzPrawda("delimited: zly prefiks odrzucony",
            ParserSkanu.Parsuj("EMP;ANNA;NOWAK;1;HR", delimited).Pola == null);
        SprawdzPrawda("delimited: za malo segmentow odrzucone",
            ParserSkanu.Parsuj("PRC;JAN;KOWALSKI", delimited).Pola == null);

        // ramka TAB-owa z profilu urzadzenia (bez prefiksu) - jak we wtyczce
        var tabowa = new Parsowanie
        {
            Typ = "delimited",
            Separator = "\t",
            Pola = new List<string> { "firstName", "lastName", "number", "department" },
        };
        Sprawdz("tab-frame: sekwencja urzadzenia na pola",
            ParserSkanu.Parsuj("JAN\tKOWALSKI\t12345\tIT", tabowa).Pola,
            new Dictionary<string, string>
            {
                ["firstName"] = "JAN", ["lastName"] = "KOWALSKI", ["number"] = "12345", ["department"] = "IT",
            });
        SprawdzPrawda("tab-frame: bez prefiksu wymagana dokladna liczba segmentow",
            ParserSkanu.Parsuj("JAN\tKOWALSKI\t12345\tIT\tNADMIAR", tabowa).Pola == null);

        var regexem = new Parsowanie
        {
            Typ = "regex",
            Wzorzec = "^PRC;([^;]+);([^;]+);([^;]+);([^;]+)$",
            Grupy = new Dictionary<string, int> { ["firstName"] = 1, ["lastName"] = 2, ["number"] = 3, ["department"] = 4 },
        };
        Sprawdz("regex: grupy przechwytujace",
            ParserSkanu.Parsuj("PRC;ANNA;NOWAK;67890;HR", regexem).Pola,
            new Dictionary<string, string>
            {
                ["firstName"] = "ANNA", ["lastName"] = "NOWAK", ["number"] = "67890", ["department"] = "HR",
            });

        // GS1 - te same wektory co firmware i wtyczka
        var gs1 = new Parsowanie { Typ = "gs1" };
        var kod = "01059099910551721727100010A23G0521K7L9XW24MQ1R";
        var wynikGs1 = ParserSkanu.Parsuj(kod, gs1).Pola;
        Sprawdz("gs1: gtin", wynikGs1?["gtin"], "05909991055172");
        Sprawdz("gs1: data 271000 -> koniec miesiaca", wynikGs1?["expiryISO"], "2027-10-31");
        Sprawdz("gs1: batch", wynikGs1?["batch"], "A23G05");
        Sprawdz("gs1: numer seryjny", wynikGs1?["serial"], "K7L9XW24MQ1R");
        Sprawdz("gs1: AIM zdejmowany", ParserSkanu.ZdejmijAim("]d201059099910551729").aim, "]d2");
        Sprawdz("gs1: data zwykla", ParserSkanu.DataNaIso("271015"), "2027-10-15");
        Sprawdz("gs1: luty roku przestepnego", ParserSkanu.DataNaIso("280200"), "2028-02-29");
        SprawdzPrawda("gs1: nieznany AI odrzucony",
            ParserSkanu.Parsuj("30012345", gs1).Pola == null);
    }

    private static void TestyWzorcow()
    {
        SprawdzPrawda("wzorzec: gwiazdki po obu stronach", Wzorce.Pasuje("*card*", "Demo application - Employee card"));
        SprawdzPrawda("wzorzec: bez gwiazdki to rownosc", Wzorce.Pasuje("Notepad", "Notepad"));
        SprawdzPrawda("wzorzec: niepasujacy", !Wzorce.Pasuje("*Invoice*", "Demo application - Employee card"));
        SprawdzPrawda("wzorzec: pusty pasuje do wszystkiego", Wzorce.Pasuje("", "anything"));
    }

    private static void TestyDopasowania()
    {
        var dopasowanie = new Dopasowanie { Proces = "AplikacjaTestowa", TytulWzorzec = "*Employee card*" };
        SprawdzPrawda("okno: proces i tytul pasuja",
            dopasowanie.Pasuje("AplikacjaTestowa", "Demo application - Employee card"));
        SprawdzPrawda("okno: inny widok tej samej aplikacji nie pasuje",
            !dopasowanie.Pasuje("AplikacjaTestowa", "Demo application - Sign in"));
        SprawdzPrawda("okno: inny proces nie pasuje",
            !dopasowanie.Pasuje("notepad", "Demo application - Employee card"));
    }

    private static void TestyNagrywarki()
    {
        var pola = new Dictionary<string, string>
        {
            ["firstName"] = "JAN", ["lastName"] = "KOWALSKI", ["number"] = "12345", ["department"] = "IT",
        };

        // nagranie: klik w pole + wpisanie wartosci ze skanu -> jeden krok "field"
        var wynik = Nagrywarka.Przetworz(new List<Krok>
        {
            new() { Akcja = "click", Cel = new Cel { AutomationId = "txtFirstName", Typ = "Edit" } },
            new() { Akcja = "text", Wartosc = "JAN" },
            new() { Akcja = "key", Klawisz = "TAB" },
            new() { Akcja = "text", Wartosc = "recznie dopisane" },
        }, pola);

        Sprawdz("nagrywarka: klik + wpisanie scalone w krok pole",
            new[] { wynik[0].Akcja, wynik[0].Cel?.AutomationId, wynik[0].Wartosc },
            new[] { "field", "txtFirstName", "{firstName}" });
        Sprawdz("nagrywarka: klawisz zachowany", wynik[1].Klawisz, "TAB");
        Sprawdz("nagrywarka: obcy tekst zostaje tekstem",
            new[] { wynik[2].Akcja, wynik[2].Wartosc },
            new[] { "text", "recznie dopisane" });

        // operator uczy wygodnie ("jan"), kod ma "JAN" - to musi sie dopasowac
        var maleLitery = Nagrywarka.Przetworz(new List<Krok>
        {
            new() { Akcja = "click", Cel = new Cel { AutomationId = "txtFirstName", Typ = "Edit" } },
            new() { Akcja = "text", Wartosc = "jan" },
        }, pola);
        Sprawdz("nagrywarka: wielkosc liter nie psuje dopasowania",
            new[] { maleLitery[0].Akcja, maleLitery[0].Wartosc }, new[] { "field", "{firstName}" });

        // wybor z listy = klik w liste + klik w pozycje; profil nie moze na stale
        // zapamietac wybranej pozycji, tylko odwolanie do pola
        var lista = Nagrywarka.Przetworz(new List<Krok>
        {
            new() { Akcja = "click", Cel = new Cel { AutomationId = "cmbDepartment", Typ = "ComboBox" } },
            new() { Akcja = "click", Cel = new Cel { Nazwa = "IT", Typ = "ListItem" } },
        }, pola);
        Sprawdz("nagrywarka: wybor z listy scalony w krok pole",
            new object?[] { lista.Count, lista[0].Akcja, lista[0].Cel?.AutomationId, lista[0].Wartosc },
            new object?[] { 1, "field", "cmbDepartment", "{department}" });

        // tryb zapisany przy nauce decyduje, co agent zrobi z kontrolka
        Sprawdz("nagrywarka: wpisanie tekstu daje tryb \"wpisz\"", wynik[0].Tryb, "type");
        Sprawdz("nagrywarka: wybor z listy daje tryb \"wybierz\"", lista[0].Tryb, "select");

        // pozycja listy spoza skanu (np. staly wybor) zostaje zwyklym klikiem
        var obcaPozycja = Nagrywarka.Przetworz(new List<Krok>
        {
            new() { Akcja = "click", Cel = new Cel { AutomationId = "cmbDepartment", Typ = "ComboBox" } },
            new() { Akcja = "click", Cel = new Cel { Nazwa = "Centrala", Typ = "ListItem" } },
        }, pola);
        Sprawdz("nagrywarka: pozycja spoza skanu zostaje klikiem",
            new object?[] { obcaPozycja.Count, obcaPozycja[1].Akcja }, new object?[] { 2, "click" });
    }

    private static void TestyPodstawiania()
    {
        var pola = new Dictionary<string, string> { ["firstName"] = "JAN", ["lastName"] = "KOWALSKI" };
        Sprawdz("podstawianie: dwa pola i tekst",
            ParserSkanu.Podstaw("{firstName} {lastName} (kadry)", pola), "JAN KOWALSKI (kadry)");
        Sprawdz("podstawianie: nieznane pole zostaje",
            ParserSkanu.Podstaw("{firstName}/{brak}", pola), "JAN/{brak}");
        SprawdzPrawda("klawisze: TAB znany", Makro.ZnanyKlawisz("TAB"));
        SprawdzPrawda("klawisze: F7 znany", Makro.ZnanyKlawisz("F7"));
        SprawdzPrawda("klawisze: bzdura nieznana", !Makro.ZnanyKlawisz("KLAWISZ"));
    }
}
