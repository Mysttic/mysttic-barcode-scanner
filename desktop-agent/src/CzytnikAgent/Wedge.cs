// Przechwytywanie skanu z klawiatury (czytnik = klawiatura USB).
//
// Zasada jak we wtyczce przegladarkowej: dopoki zaden profil nie pasuje do
// okna na wierzchu, hook NIE dotyka klawiatury. Gdy profil jest aktywny,
// znaki lecace szybciej niz czlowiek trafiaja do bufora ramki; ENTER konczy
// ramke. Jesli ramka sie nie sparsuje - oddajemy znaki aplikacji, tak jakby
// agenta tam nie bylo.
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace CzytnikAgent;

public class ZdarzenieSkanu : EventArgs
{
    public required string Ramka { get; init; }
    public required IntPtr Okno { get; init; }
    public required Profil Profil { get; init; }
    public required Dictionary<string, string> Pola { get; init; }
}

public class Wedge : IDisposable
{
    private readonly Func<Konfiguracja> _konfiguracja;
    private readonly Func<bool> _wstrzymany;
    private Native.HookProc? _uchwytProcedury;
    private IntPtr _hook = IntPtr.Zero;

    private readonly StringBuilder _bufor = new();
    private readonly Stopwatch _zegar = Stopwatch.StartNew();
    private long _ostatniZnakMs;
    private bool _blokowane;
    private IntPtr _oknoRamki = IntPtr.Zero;
    private System.Threading.Timer? _timerPorzucenia;

    public event EventHandler<ZdarzenieSkanu>? Skan;
    public event EventHandler<string>? Diagnostyka;

    public Wedge(Func<Konfiguracja> konfiguracja, Func<bool> wstrzymany)
    {
        _konfiguracja = konfiguracja;
        _wstrzymany = wstrzymany;
    }

    public void Start()
    {
        if (_hook != IntPtr.Zero) return;
        _uchwytProcedury = Procedura; // referencja musi zyc tak dlugo jak hook
        _hook = Native.SetWindowsHookExW(Native.WH_KEYBOARD_LL, _uchwytProcedury,
            Native.GetModuleHandleW(null), 0);
        if (_hook == IntPtr.Zero) throw new InvalidOperationException("could not install the keyboard hook");
    }

    public void Stop()
    {
        if (_hook == IntPtr.Zero) return;
        Native.UnhookWindowsHookEx(_hook);
        _hook = IntPtr.Zero;
        _uchwytProcedury = null;
    }

    public void Dispose()
    {
        Stop();
        _timerPorzucenia?.Dispose();
        GC.SuppressFinalize(this);
    }

    // Klawisze modyfikujace: czytnik wysyla Shift przed KAZDA wielka litera.
    // Nie wolno nimi przerywac ramki ani ich gubic - inaczej stan klawiatury
    // w hooku nie zgadza sie i litery dekoduja sie jako male.
    private static bool ToModyfikator(uint vk) => vk is 0x10 or 0x11 or 0x12 // Shift, Ctrl, Alt
        or 0xA0 or 0xA1 or 0xA2 or 0xA3 or 0xA4 or 0xA5 // lewe/prawe warianty
        or 0x14 or 0x5B or 0x5C; // CapsLock, Win

    private bool _shift;

    private IntPtr Procedura(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code < 0) return Native.CallNextHookEx(_hook, code, wParam, lParam);

        var komunikat = (int)wParam;
        var dane = Marshal.PtrToStructure<Native.KBDLLHOOKSTRUCT>(lParam);

        // stan Shift sledzimy sami: GetKeyboardState w watku hooka go nie widzi
        if (dane.vkCode is 0x10 or 0xA0 or 0xA1)
            _shift = komunikat == Native.WM_KEYDOWN || komunikat == Native.WM_SYSKEYDOWN;

        if (komunikat != Native.WM_KEYDOWN && komunikat != Native.WM_SYSKEYDOWN)
            return Native.CallNextHookEx(_hook, code, wParam, lParam);

        // nasze wlasne zdarzenia (makro, replay) ignorujemy
        if (dane.dwExtraInfo == Native.ZnacznikWlasny)
            return Native.CallNextHookEx(_hook, code, wParam, lParam);

        // modyfikator sam w sobie nie jest znakiem i NIE przerywa ramki
        if (ToModyfikator(dane.vkCode))
            return Native.CallNextHookEx(_hook, code, wParam, lParam);

        try
        {
            if (Obsluz(dane)) return 1; // znak przechwycony - nie idzie do aplikacji
        }
        catch (Exception e)
        {
            Diagnostyka?.Invoke(this, "hook error: " + e.Message);
            Porzuc(false);
        }
        return Native.CallNextHookEx(_hook, code, wParam, lParam);
    }

    /// <summary>Zwraca true, gdy klawisz ma zostac przechwycony (nie trafic do aplikacji).</summary>
    private bool Obsluz(Native.KBDLLHOOKSTRUCT dane)
    {
        var konfiguracja = _konfiguracja();
        if (!konfiguracja.Wlaczony || _wstrzymany())
        {
            Porzuc(false);
            return false;
        }

        var okno = Native.GetForegroundWindow();
        var profil = DopasujProfil(konfiguracja, okno);
        if (profil == null)
        {
            Porzuc(false); // brak profilu = agent jest bierny
            return false;
        }

        var teraz = _zegar.ElapsedMilliseconds;
        var przerwa = teraz - _ostatniZnakMs;
        var szybko = przerwa <= konfiguracja.Ustawienia.OdstepSkanuMs;

        // ENTER konczy ramke
        if (dane.vkCode == 0x0D)
        {
            if (_bufor.Length == 0) return false;
            var ramka = _bufor.ToString();
            var blokowane = _blokowane;
            var oknoRamki = _oknoRamki;
            Wyczysc();

            if (ramka.Length < konfiguracja.Ustawienia.MinDlugoscRamki) return blokowane;

            var wynik = ParserSkanu.Parsuj(ramka, profil.Parse);
            Log.Pisz($"frame \"{ramka}\" profile={profil.Nazwa} result={(wynik.Pola != null ? "OK" : wynik.Blad)}");
            if (wynik.Pola != null)
            {
                var zdarzenie = new ZdarzenieSkanu
                {
                    Ramka = ramka,
                    Okno = oknoRamki != IntPtr.Zero ? oknoRamki : okno,
                    Profil = profil,
                    Pola = wynik.Pola,
                };
                // makro wykonujemy POZA watkiem hooka - inaczej zablokowalibysmy klawiature
                ThreadPool.QueueUserWorkItem(_ => Skan?.Invoke(this, zdarzenie));
                return true; // ENTER tez zjadamy
            }

            Diagnostyka?.Invoke(this, $"unrecognised frame: {wynik.Blad}");
            if (blokowane) OddajStronie(ramka + "\r");
            return blokowane;
        }

        // TAB w ramce: przy profilach bez prefiksu jest czescia sekwencji z czytnika
        var toTab = dane.vkCode == 0x09;
        var znak = toTab ? '\t' : NaZnak(dane, _shift);
        if (znak == '\0')
        {
            Porzuc(true); // klawisz sterujacy przerywa ramke
            return false;
        }

        if (!szybko)
        {
            // nowa seria: to moze byc czlowiek albo poczatek skanu
            Porzuc(true);
        }

        if (toTab && _bufor.Length == 0) return false; // samotny TAB czlowieka

        _ostatniZnakMs = teraz;
        if (_bufor.Length == 0) _oknoRamki = okno;
        _bufor.Append(znak);

        var prefiks = profil.Parse.Prefiks;
        var kandydat = _bufor.ToString();
        var blokuj = string.IsNullOrEmpty(prefiks)
            // ramka bez prefiksu (np. sekwencja TAB-owa): blokujemy od drugiego
            // znaku szybkiej serii - pierwszy moze pochodzic od czlowieka
            ? _bufor.Length > 1 && szybko
            : prefiks.StartsWith(kandydat, StringComparison.Ordinal) ||
              kandydat.StartsWith(prefiks, StringComparison.Ordinal);

        if (blokuj) _blokowane = true;
        UstawTimerPorzucenia();
        return blokuj;
    }

    /// <summary>Skan bez ENTER-a na koncu nie moze zjesc znakow na zawsze.</summary>
    private void UstawTimerPorzucenia()
    {
        _timerPorzucenia?.Dispose();
        _timerPorzucenia = new System.Threading.Timer(_ =>
        {
            if (_bufor.Length == 0) return;
            var ramka = _bufor.ToString();
            var blokowane = _blokowane;
            Wyczysc();
            if (blokowane)
            {
                Diagnostyka?.Invoke(this, "frame with no ENTER, handing the characters back to the application");
                OddajStronie(ramka);
            }
        }, null, 400, Timeout.Infinite);
    }

    private void Porzuc(bool oddaj)
    {
        if (_bufor.Length == 0) { Wyczysc(); return; }
        var ramka = _bufor.ToString();
        var blokowane = _blokowane;
        Wyczysc();
        if (oddaj && blokowane) OddajStronie(ramka);
    }

    private void Wyczysc()
    {
        _bufor.Clear();
        _blokowane = false;
        _oknoRamki = IntPtr.Zero;
        _timerPorzucenia?.Dispose();
        _timerPorzucenia = null;
    }

    /// <summary>Zwraca aplikacji znaki, ktore przechwycilismy niepotrzebnie.</summary>
    private static void OddajStronie(string tekst)
    {
        ThreadPool.QueueUserWorkItem(_ =>
        {
            foreach (var znak in tekst)
            {
                if (znak == '\t') Native.WyslijKlawisz(0x09);
                else if (znak == '\r') Native.WyslijKlawisz(0x0D);
                else Native.WyslijZnak(znak);
                Thread.Sleep(2);
            }
        });
    }

    public static Profil? DopasujProfil(Konfiguracja konfiguracja, IntPtr okno)
    {
        if (okno == IntPtr.Zero) return null;
        var proces = Native.ProcesOkna(okno);
        var tytul = Native.TytulOkna(okno);
        return konfiguracja.Profile.FirstOrDefault(p => p.Wlaczony && p.Match.Pasuje(proces, tytul));
    }

    /// <summary>Kod klawisza -> znak, wg biezacego ukladu klawiatury.</summary>
    private static char NaZnak(Native.KBDLLHOOKSTRUCT dane, bool shift)
    {
        // Zdarzenia wstrzykiwane jako UNICODE (KEYEVENTF_UNICODE) przychodza
        // z kodem VK_PACKET (0xE7) i znakiem w polu scanCode. Tak pracuja
        // emulatory klawiatur, oprogramowanie "wpisz tekst" i nasz tryb testowy.
        const uint vkPacket = 0xE7;
        if ((dane.vkCode == vkPacket || dane.vkCode == 0) && dane.scanCode != 0)
        {
            var wstrzykniety = (char)dane.scanCode;
            return char.IsControl(wstrzykniety) ? '\0' : wstrzykniety;
        }

        // Stan budujemy sami: w watku hooka GetKeyboardState nie widzi Shifta
        // wcisnietego przez czytnik, wiec wielkie litery wychodzilyby male.
        var stan = new byte[256];
        Native.GetKeyboardState(stan);
        stan[0x10] = stan[0xA0] = shift ? (byte)0x80 : (byte)0x00;
        stan[0x14] = (byte)(Native.GetKeyState(0x14) & 1); // CapsLock

        var bufor = new StringBuilder(8);
        // wFlags = 4: nie modyfikuj stanu klawiatury (bezpieczne w hooku)
        var wynik = Native.ToUnicodeEx(dane.vkCode, dane.scanCode, stan, bufor, bufor.Capacity, 4,
            Native.GetKeyboardLayout(0));
        if (wynik <= 0 || bufor.Length == 0) return '\0';
        var znak = bufor[0];
        return char.IsControl(znak) ? '\0' : znak;
    }
}
