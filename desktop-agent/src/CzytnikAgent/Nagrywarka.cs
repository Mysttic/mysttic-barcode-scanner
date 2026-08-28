// Nagrywanie makra: agent obserwuje, jak operator wypelnia formularz recznie,
// i zapisuje jego czynnosci jako kroki profilu.
//
// Nagrywane sa: klikniecia (z kontrolka UI Automation pod kursorem oraz
// wspolrzednymi zapasowymi), klawisze specjalne (TAB/ENTER/F1...) i wpisywany
// tekst. Po zakonczeniu teksty rowne wartosciom ze skanu zamieniane sa na
// {pole}, a para "klik w kontrolke + wpisanie" scala sie w jeden krok "pole"
// z celem UIA - czyli w najtrwalsza forme, niezalezna od wspolrzednych.
using System.Runtime.InteropServices;
using System.Text;

namespace CzytnikAgent;

public class Nagrywarka : IDisposable
{
    private Native.HookProc? _procKlawiatury, _procMyszy;
    private IntPtr _hookKlawiatury = IntPtr.Zero, _hookMyszy = IntPtr.Zero;
    private readonly List<Krok> _kroki = new();
    private readonly StringBuilder _tekst = new();
    private readonly IntPtr _oknoDocelowe;
    private readonly IntPtr _oknoKreatora;

    public IReadOnlyList<Krok> Kroki => _kroki;
    public event EventHandler? Zmiana;

    public Nagrywarka(IntPtr oknoDocelowe, IntPtr oknoKreatora)
    {
        _oknoDocelowe = oknoDocelowe;
        _oknoKreatora = oknoKreatora;
    }

    public void Start()
    {
        var modul = Native.GetModuleHandleW(null);
        _procKlawiatury = ProceduraKlawiatury;
        _procMyszy = ProceduraMyszy;
        _hookKlawiatury = Native.SetWindowsHookExW(Native.WH_KEYBOARD_LL, _procKlawiatury, modul, 0);
        _hookMyszy = Native.SetWindowsHookExW(Native.WH_MOUSE_LL, _procMyszy, modul, 0);
    }

    public void Stop()
    {
        FlushTekst();
        if (_hookKlawiatury != IntPtr.Zero) { Native.UnhookWindowsHookEx(_hookKlawiatury); _hookKlawiatury = IntPtr.Zero; }
        if (_hookMyszy != IntPtr.Zero) { Native.UnhookWindowsHookEx(_hookMyszy); _hookMyszy = IntPtr.Zero; }
        _procKlawiatury = null;
        _procMyszy = null;
    }

    public void Dispose()
    {
        Stop();
        GC.SuppressFinalize(this);
    }

    private IntPtr ProceduraMyszy(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0 && (int)wParam == Native.WM_LBUTTONDOWN)
        {
            var dane = Marshal.PtrToStructure<Native.MSLLHOOKSTRUCT>(lParam);
            if (dane.dwExtraInfo != Native.ZnacznikWlasny) ZapiszKlik(dane.pt);
        }
        return Native.CallNextHookEx(_hookMyszy, code, wParam, lParam);
    }

    private bool _shift;

    private IntPtr ProceduraKlawiatury(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            var dane = Marshal.PtrToStructure<Native.KBDLLHOOKSTRUCT>(lParam);
            var komunikat = (int)wParam;

            // stan Shift sledzimy sami - inaczej wielkie litery nagraja sie male
            if (dane.vkCode is 0x10 or 0xA0 or 0xA1)
                _shift = komunikat == Native.WM_KEYDOWN || komunikat == Native.WM_SYSKEYDOWN;

            if ((komunikat == Native.WM_KEYDOWN || komunikat == Native.WM_SYSKEYDOWN) &&
                dane.dwExtraInfo != Native.ZnacznikWlasny)
                ZapiszKlawisz(dane);
        }
        return Native.CallNextHookEx(_hookKlawiatury, code, wParam, lParam);
    }

    private void ZapiszKlik(Native.POINT punktEkranu)
    {
        // klikniecia w samego kreatora nie sa czescia makra
        var podKursorem = Native.WindowFromPoint(punktEkranu);
        if (podKursorem != IntPtr.Zero &&
            Native.GetAncestor(podKursorem, Native.GA_ROOT) == _oknoKreatora) return;

        FlushTekst();
        var element = Uia.PodPunktem(punktEkranu.X, punktEkranu.Y);
        var cel = element != null
            ? Uia.ZbudujCel(element, _oknoDocelowe)
            : new Cel();

        if (!cel.MaPunkt)
        {
            var punkt = punktEkranu;
            if (Native.ScreenToClient(_oknoDocelowe, ref punkt)) { cel.X = punkt.X; cel.Y = punkt.Y; }
        }

        Dodaj(new Krok { Akcja = "klik", Cel = cel });
    }

    private void ZapiszKlawisz(Native.KBDLLHOOKSTRUCT dane)
    {
        if (dane.vkCode is 0x10 or 0x11 or 0x12 or 0xA0 or 0xA1 or 0xA2 or 0xA3 or 0xA4 or 0xA5
            or 0x14 or 0x5B or 0x5C) return; // modyfikatory nie sa krokiem makra

        var nazwa = NazwaKlawisza(dane.vkCode);
        if (nazwa != null)
        {
            FlushTekst();
            Dodaj(new Krok { Akcja = "klawisz", Klawisz = nazwa });
            return;
        }

        var znak = Znak(dane, _shift);
        if (znak != '\0') _tekst.Append(znak);
    }

    private void FlushTekst()
    {
        if (_tekst.Length == 0) return;
        Dodaj(new Krok { Akcja = "tekst", Wartosc = _tekst.ToString() });
        _tekst.Clear();
    }

    private void Dodaj(Krok krok)
    {
        _kroki.Add(krok);
        Zmiana?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Zamienia nagrany tekst na odwolania {pole} i scala "klik + wpisanie"
    /// w jeden krok "pole" z celem UIA.
    /// </summary>
    /// <summary>
    /// Nazwa pola, ktorego wartosc odpowiada wpisanemu tekstowi. Porownujemy
    /// bez wzgledu na wielkosc liter i biale znaki: operator uczy wygodnie
    /// ("jan"), a w kodzie moze byc "JAN".
    /// </summary>
    private static string? DopasujPole(IReadOnlyDictionary<string, string> pola, string tekst)
    {
        var szukane = tekst.Trim();
        if (szukane.Length == 0) return null;
        foreach (var (nazwa, wartosc) in pola)
        {
            if (wartosc.Trim().Length > 0 &&
                string.Equals(wartosc.Trim(), szukane, StringComparison.OrdinalIgnoreCase))
                return nazwa;
        }
        return null;
    }

    private static bool ToLista(Cel? cel) => cel != null && (cel.Typ == "ComboBox" || cel.Typ == "List");

    public List<Krok> Przetworz(IReadOnlyDictionary<string, string> pola)
    {
        FlushTekst();
        return Przetworz(_kroki, pola);
    }

    /// <summary>Ta sama logika bez hookow - wolana takze przez testy.</summary>
    public static List<Krok> Przetworz(IEnumerable<Krok> nagrane, IReadOnlyDictionary<string, string> pola)
    {
        var wynik = new List<Krok>();

        foreach (var krok in nagrane)
        {
            // Wybor z listy rozwijanej nagrywa sie jako dwa klikniecia:
            // w liste i w pozycje. Jesli nazwa pozycji odpowiada wartosci ze
            // skanu, scalamy to w krok "pole" - inaczej profil na zawsze
            // wybieralby te sama pozycje, niezaleznie od zeskanowanego kodu.
            if (krok.Akcja == "klik" && krok.Cel?.Typ == "ListItem")
            {
                var nazwaPozycji = krok.Cel.Nazwa ?? "";
                var polePozycji = DopasujPole(pola, nazwaPozycji);
                if (polePozycji != null && wynik.Count > 0 &&
                    wynik[^1].Akcja == "klik" && ToLista(wynik[^1].Cel))
                {
                    var celListy = wynik[^1].Cel!;
                    wynik.RemoveAt(wynik.Count - 1);
                    // operator WYBIERAL z listy - tak samo ma robic agent
                    wynik.Add(new Krok
                    {
                        Akcja = "pole", Cel = celListy,
                        Wartosc = "{" + polePozycji + "}", Tryb = "wybierz",
                    });
                    continue;
                }
            }

            if (krok.Akcja != "tekst")
            {
                wynik.Add(krok);
                continue;
            }

            var wartosc = krok.Wartosc;
            var nazwaPola = DopasujPole(pola, wartosc);
            var szablon = nazwaPola != null ? "{" + nazwaPola + "}" : wartosc;

            // poprzedni krok to klik w kontrolke? -> scal w krok "pole"
            if (wynik.Count > 0 && wynik[^1].Akcja == "klik" && wynik[^1].Cel != null)
            {
                var cel = wynik[^1].Cel!;
                wynik.RemoveAt(wynik.Count - 1);
                // operator WPISAL tekst w to pole - agent ma zrobic to samo,
                // nawet jesli kontrolka wyglada jak lista (pole z podpowiedziami)
                wynik.Add(new Krok { Akcja = "pole", Cel = cel, Wartosc = szablon, Tryb = "wpisz" });
            }
            else
            {
                wynik.Add(new Krok
                {
                    Akcja = nazwaPola != null ? "pole" : "tekst",
                    Wartosc = szablon,
                    Tryb = nazwaPola != null ? "wpisz" : "auto",
                });
            }
        }
        return wynik;
    }

    private static string? NazwaKlawisza(uint vk) => vk switch
    {
        0x09 => "TAB", 0x0D => "ENTER", 0x1B => "ESC", 0x08 => "BACKSPACE",
        0x26 => "UP", 0x28 => "DOWN", 0x25 => "LEFT", 0x27 => "RIGHT",
        0x24 => "HOME", 0x23 => "END", 0x2E => "DELETE",
        >= 0x70 and <= 0x7B => "F" + (vk - 0x6F),
        _ => null,
    };

    private static char Znak(Native.KBDLLHOOKSTRUCT dane, bool shift)
    {
        const uint vkPacket = 0xE7;
        if ((dane.vkCode == vkPacket || dane.vkCode == 0) && dane.scanCode != 0)
        {
            var wstrzykniety = (char)dane.scanCode;
            return char.IsControl(wstrzykniety) ? '\0' : wstrzykniety;
        }

        var stan = new byte[256];
        Native.GetKeyboardState(stan);
        stan[0x10] = stan[0xA0] = shift ? (byte)0x80 : (byte)0x00;
        stan[0x14] = (byte)(Native.GetKeyState(0x14) & 1);
        var bufor = new StringBuilder(8);
        var wynik = Native.ToUnicodeEx(dane.vkCode, dane.scanCode, stan, bufor, bufor.Capacity, 4,
            Native.GetKeyboardLayout(0));
        if (wynik <= 0 || bufor.Length == 0) return '\0';
        return char.IsControl(bufor[0]) ? '\0' : bufor[0];
    }
}
