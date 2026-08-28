// Odtwarzanie makra: kroki profilu wykonywane w oknie aplikacji.
//
// Strategia trafiania w pole (od najtrwalszej):
//   1. UI Automation po AutomationId/nazwie - odporne na przesuniecie okna,
//   2. klikniecie we wspolrzedne wzgledem obszaru klienta okna (fallback),
//   3. wpisanie w aktualnie aktywne pole (gdy krok nie ma celu).
using System.Text;
using System.Windows.Automation;

namespace CzytnikAgent;

public record WynikKroku(bool Ok, string Opis);

public class WynikMakra
{
    public List<WynikKroku> Kroki { get; } = new();
    public int Udane => Kroki.Count(k => k.Ok);
    public int Nieudane => Kroki.Count(k => !k.Ok);

    public string Podsumowanie()
    {
        var sb = new StringBuilder();
        sb.Append($"kroki: {Udane}/{Kroki.Count}");
        var pierwszyBlad = Kroki.FirstOrDefault(k => !k.Ok);
        if (pierwszyBlad != null) sb.Append($" - {pierwszyBlad.Opis}");
        return sb.ToString();
    }
}

public static class Makro
{
    private static readonly Dictionary<string, ushort> Klawisze = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TAB"] = 0x09, ["ENTER"] = 0x0D, ["ESC"] = 0x1B, ["SPACE"] = 0x20,
        ["BACKSPACE"] = 0x08, ["DELETE"] = 0x2E, ["HOME"] = 0x24, ["END"] = 0x23,
        ["UP"] = 0x26, ["DOWN"] = 0x28, ["LEFT"] = 0x25, ["RIGHT"] = 0x27,
        ["PAGEUP"] = 0x21, ["PAGEDOWN"] = 0x22,
        ["F1"] = 0x70, ["F2"] = 0x71, ["F3"] = 0x72, ["F4"] = 0x73, ["F5"] = 0x74, ["F6"] = 0x75,
        ["F7"] = 0x76, ["F8"] = 0x77, ["F9"] = 0x78, ["F10"] = 0x79, ["F11"] = 0x7A, ["F12"] = 0x7B,
    };

    public static bool ZnanyKlawisz(string nazwa) => Klawisze.ContainsKey(nazwa);

    public static WynikMakra Wykonaj(Profil profil, IReadOnlyDictionary<string, string> pola,
        IntPtr okno, Ustawienia ustawienia)
    {
        var wynik = new WynikMakra();
        var elementOkna = Uia.Z(okno);

        foreach (var krok in profil.Kroki)
        {
            wynik.Kroki.Add(WykonajKrok(krok, pola, okno, elementOkna, ustawienia));
            if (ustawienia.PauzaKrokuMs > 0) Thread.Sleep(ustawienia.PauzaKrokuMs);
        }
        return wynik;
    }

    private static WynikKroku WykonajKrok(Krok krok, IReadOnlyDictionary<string, string> pola,
        IntPtr okno, AutomationElement? elementOkna, Ustawienia ustawienia)
    {
        switch (krok.Akcja)
        {
            case "pauza":
                Thread.Sleep(Math.Clamp(krok.Ms, 0, 10_000));
                return new WynikKroku(true, $"pauza {krok.Ms} ms");

            case "klawisz":
                if (!Klawisze.TryGetValue(krok.Klawisz, out var vk))
                    return new WynikKroku(false, $"nieznany klawisz: {krok.Klawisz}");
                Native.WyslijKlawisz(vk);
                return new WynikKroku(true, $"klawisz {krok.Klawisz}");

            case "tekst":
                {
                    var tekst = ParserSkanu.Podstaw(krok.Wartosc, pola);
                    foreach (var znak in tekst) Native.WyslijZnak(znak);
                    return new WynikKroku(true, $"wpisano \"{tekst}\"");
                }

            case "klik":
                return Klik(krok.Cel, okno, elementOkna);

            case "pole":
                return Pole(krok, pola, okno, elementOkna, ustawienia);

            default:
                return new WynikKroku(false, $"nieznana akcja: {krok.Akcja}");
        }
    }

    private static WynikKroku Klik(Cel? cel, IntPtr okno, AutomationElement? elementOkna)
    {
        if (cel == null) return new WynikKroku(false, "krok klik bez celu");

        if (cel.MaUia && elementOkna != null)
        {
            var element = Uia.Znajdz(elementOkna, cel);
            if (element != null)
            {
                try
                {
                    var prostokat = element.Current.BoundingRectangle;
                    Native.KlikMysza((int)(prostokat.Left + prostokat.Width / 2),
                                     (int)(prostokat.Top + prostokat.Height / 2));
                    return new WynikKroku(true, $"klik {cel.Opis()} (UIA)");
                }
                catch (ElementNotAvailableException) { }
            }
        }

        if (!cel.MaPunkt) return new WynikKroku(false, $"nie znaleziono celu {cel.Opis()}");
        var punkt = new Native.POINT { X = cel.X!.Value, Y = cel.Y!.Value };
        if (!Native.ClientToScreen(okno, ref punkt))
            return new WynikKroku(false, "nie udalo sie przeliczyc wspolrzednych");
        Native.KlikMysza(punkt.X, punkt.Y);
        return new WynikKroku(true, $"klik {cel.Opis()} (wspolrzedne)");
    }

    private static WynikKroku Pole(Krok krok, IReadOnlyDictionary<string, string> pola,
        IntPtr okno, AutomationElement? elementOkna, Ustawienia ustawienia)
    {
        var wartosc = ParserSkanu.Podstaw(krok.Wartosc, pola);
        var cel = krok.Cel;

        // 1. UI Automation
        if (cel != null && cel.MaUia && elementOkna != null)
        {
            var element = Uia.Znajdz(elementOkna, cel);
            if (element != null)
            {
                if (!Uia.Wpisz(element, wartosc, out var blad, krok.Tryb))
                    return new WynikKroku(false, $"{cel.Opis()}: {blad}");

                // Pola z podpowiedziami dopisuja wlasne sugestie, wiec przy
                // trybie "wpisz" nie wymagamy zgodnosci co do znaku.
                if (ustawienia.WeryfikujOdczytem && krok.Tryb != "wpisz")
                {
                    Thread.Sleep(20);
                    if (!Uia.Potwierdza(element, wartosc, out var odczytano))
                        return new WynikKroku(false, $"{cel.Opis()}: wpisano \"{wartosc}\", odczytano {odczytano}");
                }
                return new WynikKroku(true, $"{cel.Opis()} = \"{wartosc}\"");
            }
        }

        // 2. fallback: klikniecie we wspolrzedne i wpisanie z klawiatury
        if (cel != null && cel.MaPunkt)
        {
            var punkt = new Native.POINT { X = cel.X!.Value, Y = cel.Y!.Value };
            if (Native.ClientToScreen(okno, ref punkt))
            {
                Native.KlikMysza(punkt.X, punkt.Y);
                Thread.Sleep(30);
                WyczyscPole();
                foreach (var znak in wartosc) Native.WyslijZnak(znak);
                return new WynikKroku(true, $"({cel.X},{cel.Y}) = \"{wartosc}\" (wspolrzedne)");
            }
        }

        // 3. bez celu: wpisz w aktywne pole
        if (cel == null || (!cel.MaUia && !cel.MaPunkt))
        {
            foreach (var znak in wartosc) Native.WyslijZnak(znak);
            return new WynikKroku(true, $"aktywne pole = \"{wartosc}\"");
        }

        return new WynikKroku(false, $"nie znaleziono celu {cel.Opis()}");
    }

    /// <summary>Ctrl+A, potem Delete - czysci pole przed wpisaniem (wariant wspolrzednych).</summary>
    private static void WyczyscPole()
    {
        const ushort ctrl = 0x11, a = 0x41, del = 0x2E;
        var input = new Native.INPUT[4];
        input[0] = KlawiszInput(ctrl, false);
        input[1] = KlawiszInput(a, false);
        input[2] = KlawiszInput(a, true);
        input[3] = KlawiszInput(ctrl, true);
        Native.SendInput((uint)input.Length, input, System.Runtime.InteropServices.Marshal.SizeOf<Native.INPUT>());
        Thread.Sleep(10);
        Native.WyslijKlawisz(del);
    }

    private static Native.INPUT KlawiszInput(ushort vk, bool wGore) => new()
    {
        type = Native.INPUT_KEYBOARD,
        U = new Native.InputUnion
        {
            ki = new Native.KEYBDINPUT
            {
                wVk = vk,
                dwFlags = wGore ? Native.KEYEVENTF_KEYUP : 0,
                dwExtraInfo = Native.ZnacznikWlasny,
            },
        },
    };
}
