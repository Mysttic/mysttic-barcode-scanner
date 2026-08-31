// Parsowanie ramki ze skanu na nazwane pola.
// Port logiki z browser-extension/src/parse.js i firmware'u - te same reguly,
// te same wektory testowe (delimited / regex / gs1 z AI 01/17/10/21).
using System.Text.RegularExpressions;

namespace CzytnikAgent;

public record WynikParsowania(Dictionary<string, string>? Pola, string? Blad)
{
    public static WynikParsowania Ok(Dictionary<string, string> pola) => new(pola, null);
    public static WynikParsowania Zle(string blad) => new(null, blad);
}

public static class ParserSkanu
{
    private const char Gs = '\u001D';
    private static readonly int[] DniMiesiaca = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };

    /// <summary>YYMMDD -> YYYY-MM-DD; dzien "00" = ostatni dzien miesiaca (regula farmaceutyczna).</summary>
    public static string? DataNaIso(string yymmdd)
    {
        if (yymmdd.Length != 6 || !yymmdd.All(char.IsDigit)) return null;
        var rok = 2000 + int.Parse(yymmdd[..2]);
        var mm = int.Parse(yymmdd.Substring(2, 2));
        var dd = int.Parse(yymmdd.Substring(4, 2));
        if (mm is < 1 or > 12) return null;
        if (dd == 0)
        {
            dd = DniMiesiaca[mm - 1];
            if (mm == 2 && DateTime.IsLeapYear(rok)) dd = 29;
        }
        else if (dd > 31) return null;
        return $"{rok:D4}-{mm:D2}-{dd:D2}";
    }

    /// <summary>AIM ID ("]d2") z poczatku kodu.</summary>
    public static (string tekst, string? aim) ZdejmijAim(string tekst) =>
        tekst.Length >= 3 && tekst[0] == ']' ? (tekst[3..], tekst[..3]) : (tekst, null);

    public static WynikParsowania Parsuj(string ramka, Parsowanie spec)
    {
        if (string.IsNullOrEmpty(ramka)) return WynikParsowania.Zle("empty frame");
        if (!string.IsNullOrEmpty(spec.Prefiks) && !ramka.StartsWith(spec.Prefiks, StringComparison.Ordinal))
            return WynikParsowania.Zle($"the frame does not start with '{spec.Prefiks}'");

        return spec.Typ switch
        {
            "delimited" => Delimited(ramka, spec),
            "regex" => Regexem(ramka, spec),
            "gs1" => Gs1(ramka, spec),
            _ => WynikParsowania.Zle($"unknown parsing type: {spec.Typ}"),
        };
    }

    private static WynikParsowania Delimited(string ramka, Parsowanie spec)
    {
        if (spec.Pola.Count == 0) return WynikParsowania.Zle("the profile has no field list");
        var separator = string.IsNullOrEmpty(spec.Separator) ? ";" : spec.Separator;
        var czesci = ramka.Split(separator);
        if (czesci.Length < spec.Pola.Count)
            return WynikParsowania.Zle($"the code has {czesci.Length} segments, the profile expects {spec.Pola.Count}");
        // Ramka bez prefiksu nie ma znacznika "to nasze" - jedyna kotwica to
        // DOKLADNA liczba segmentow (tak samo jak we wtyczce).
        if (string.IsNullOrEmpty(spec.Prefiks) && czesci.Length != spec.Pola.Count)
            return WynikParsowania.Zle($"the code has {czesci.Length} segments, the profile expects exactly {spec.Pola.Count}");

        var pola = new Dictionary<string, string>();
        for (var i = 0; i < spec.Pola.Count; i++)
        {
            var nazwa = spec.Pola[i];
            if (string.IsNullOrEmpty(nazwa) || nazwa == "_") continue;
            pola[nazwa] = czesci[i];
        }
        return WynikParsowania.Ok(pola);
    }

    private static WynikParsowania Regexem(string ramka, Parsowanie spec)
    {
        Regex re;
        try { re = new Regex(spec.Wzorzec); }
        catch (ArgumentException e) { return WynikParsowania.Zle($"bledny wzorzec: {e.Message}"); }

        var m = re.Match(ramka);
        if (!m.Success) return WynikParsowania.Zle("the code does not match the profile pattern");

        var pola = new Dictionary<string, string>();
        foreach (var (nazwa, grupa) in spec.Grupy)
        {
            if (grupa >= m.Groups.Count) return WynikParsowania.Zle($"brak grupy {grupa} dla pola {nazwa}");
            pola[nazwa] = m.Groups[grupa].Value;
        }
        return WynikParsowania.Ok(pola);
    }

    private static WynikParsowania Gs1(string ramka, Parsowanie spec)
    {
        var separator = string.IsNullOrEmpty(spec.ZnakGs) ? Gs : spec.ZnakGs[0];
        var (tekst, aim) = ZdejmijAim(ramka);
        var pola = new Dictionary<string, string>();
        var i = 0;

        while (i < tekst.Length)
        {
            if (tekst[i] == separator) { i++; continue; }
            if (i + 2 > tekst.Length) return WynikParsowania.Zle($"urwany AI na pozycji {i}");
            var ai = tekst.Substring(i, 2);
            i += 2;

            string nazwa, wartosc;
            switch (ai)
            {
                case "01":
                case "17":
                    var dlugosc = ai == "01" ? 14 : 6;
                    nazwa = ai == "01" ? "gtin" : "expiry";
                    if (i + dlugosc > tekst.Length)
                        return WynikParsowania.Zle($"AI {ai}: oczekiwano {dlugosc} znakow");
                    wartosc = tekst.Substring(i, dlugosc);
                    if (!wartosc.All(char.IsDigit)) return WynikParsowania.Zle($"AI {ai}: oczekiwano cyfr");
                    i += dlugosc;
                    break;
                case "10":
                case "21":
                    nazwa = ai == "10" ? "batch" : "serial";
                    var koniec = tekst.IndexOf(separator, i);
                    if (koniec < 0) koniec = tekst.Length;
                    wartosc = tekst[i..koniec];
                    if (wartosc.Length == 0) return WynikParsowania.Zle($"AI {ai}: empty field");
                    if (wartosc.Length > 20) return WynikParsowania.Zle($"AI {ai}: za dlugie (>20)");
                    i = koniec;
                    break;
                default:
                    return WynikParsowania.Zle($"unsupported AI '{ai}' at position {i - 2}");
            }
            pola[nazwa] = wartosc;
        }

        if (pola.Count == 0) return WynikParsowania.Zle("empty code");
        if (pola.TryGetValue("expiry", out var data))
        {
            var iso = DataNaIso(data);
            if (iso != null) pola["expiryISO"] = iso;
        }
        if (aim != null) pola["aim"] = aim;
        return WynikParsowania.Ok(pola);
    }

    /// <summary>Podstawia {pole} wartosciami; nieznane pola zostawia bez zmian.</summary>
    public static string Podstaw(string szablon, IReadOnlyDictionary<string, string> pola) =>
        Regex.Replace(szablon, @"\{(\w+)\}", m =>
            pola.TryGetValue(m.Groups[1].Value, out var wartosc) ? wartosc : m.Value);
}
