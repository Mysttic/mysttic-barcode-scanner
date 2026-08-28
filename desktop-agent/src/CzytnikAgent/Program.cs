// Agent desktopowy czytnika kodow: siedzi w zasobniku systemowym, rozpoznaje
// okno aplikacji na wierzchu, przechwytuje skan i odtwarza nauczone makro.
//
// Tryby uruchomienia:
//   CzytnikAgent.exe                     - normalny (ikona w zasobniku)
//   CzytnikAgent.exe --okno              - wypisuje dane okna na wierzchu (diagnostyka)
//   CzytnikAgent.exe --drzewo            - wypisuje kontrolki okna na wierzchu (UIA)
//   CzytnikAgent.exe --symuluj "RAMKA"   - odtwarza makro bez czytnika (testy)
//   CzytnikAgent.exe --profile PLIK      - uzywa wskazanego pliku profili
using System.Text;
using System.Windows.Automation;

namespace CzytnikAgent;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        var sciezkaProfili = Argument(args, "--profile");

        if (args.Contains("--okno")) return WypiszOkno(Argument(args, "--proces"));
        if (args.Contains("--drzewo")) return WypiszDrzewo(Argument(args, "--proces"));
        if (args.Contains("--symuluj"))
            return Symuluj(Argument(args, "--symuluj"), sciezkaProfili,
                Argument(args, "--proces"), Argument(args, "--sprawdz"));
        if (args.Contains("--wyslij"))
            return Wyslij(Argument(args, "--wyslij"), Argument(args, "--proces"), args.Contains("--hid"));
        if (args.Contains("--hook-test")) return HookTest();
        if (args.Contains("--zrzuty"))
        {
            Konsola();
            ApplicationConfiguration.Initialize();
            return Zrzuty.Wykonaj(Argument(args, "--zrzuty") ?? "zrzuty", Argument(args, "--proces"));
        }

        ApplicationConfiguration.Initialize();
        using var app = new TrayApp(sciezkaProfili);
        Application.Run();
        return 0;
    }

    private static string? Argument(string[] args, string nazwa)
    {
        var indeks = Array.IndexOf(args, nazwa);
        return indeks >= 0 && indeks + 1 < args.Length ? args[indeks + 1] : null;
    }

    private static int WypiszOkno(string? nazwaProcesu)
    {
        Konsola();
        var okno = Wskaz(nazwaProcesu);
        Console.WriteLine($"uchwyt : {okno}");
        Console.WriteLine($"proces : {Native.ProcesOkna(okno)}");
        Console.WriteLine($"tytul  : {Native.TytulOkna(okno)}");
        return 0;
    }

    private static int WypiszDrzewo(string? nazwaProcesu)
    {
        Konsola();
        var okno = Wskaz(nazwaProcesu);
        var element = Uia.Z(okno);
        if (element == null) { Console.WriteLine("UIA nie widzi tego okna"); return 1; }

        Console.WriteLine($"okno: {Native.ProcesOkna(okno)} - \"{Native.TytulOkna(okno)}\"");
        var dzieci = element.FindAll(TreeScope.Descendants, Condition.TrueCondition);
        Console.WriteLine($"kontrolek: {dzieci.Count}");
        foreach (AutomationElement dziecko in dzieci)
        {
            try
            {
                var info = dziecko.Current;
                var typ = info.ControlType?.ProgrammaticName?.Replace("ControlType.", "") ?? "?";
                var wartosc = Uia.Odczytaj(dziecko);
                Console.WriteLine($"  [{typ,-12}] id=\"{info.AutomationId}\" nazwa=\"{info.Name}\"" +
                                  (wartosc != null ? $" wartosc=\"{wartosc}\"" : ""));
            }
            catch (ElementNotAvailableException) { }
        }
        return 0;
    }

    /// <summary>Odtwarza makro dla podanej ramki - test bez fizycznego czytnika.</summary>
    private static int Symuluj(string? ramka, string? sciezkaProfili, string? nazwaProcesu = null, string? sprawdz = null)
    {
        Konsola();
        if (string.IsNullOrEmpty(ramka)) { Console.WriteLine("uzycie: --symuluj \"RAMKA\""); return 2; }

        var konfiguracja = Magazyn.Wczytaj(sciezkaProfili);
        Console.WriteLine($"profili: {konfiguracja.Profile.Count} (z {sciezkaProfili ?? Magazyn.Sciezka})");

        if (!string.IsNullOrEmpty(nazwaProcesu))
        {
            var uchwyt = GlowneOknoProcesu(nazwaProcesu);
            if (uchwyt == IntPtr.Zero) { Console.WriteLine($"nie znaleziono okna procesu {nazwaProcesu}"); return 1; }
            Native.NaWierzch(uchwyt);
            Thread.Sleep(700);
        }
        else
        {
            Console.WriteLine("przelacz sie do aplikacji docelowej - start za 3 s...");
            Thread.Sleep(3000);
        }

        var okno = Native.GetForegroundWindow();
        var proces = Native.ProcesOkna(okno);
        var tytul = Native.TytulOkna(okno);
        Console.WriteLine($"okno: {proces} - \"{tytul}\"");

        var profil = Wedge.DopasujProfil(konfiguracja, okno);
        if (profil == null) { Console.WriteLine("BRAK PROFILU dla tego okna"); return 1; }
        Console.WriteLine($"profil: {profil.Nazwa}");

        var wynik = ParserSkanu.Parsuj(ramka.Replace("\\t", "\t"), profil.Parse);
        if (wynik.Pola == null) { Console.WriteLine($"NIE SPARSOWANO: {wynik.Blad}"); return 1; }
        Console.WriteLine("pola: " + string.Join(", ", wynik.Pola.Select(p => $"{p.Key}={p.Value}")));

        var makro = Makro.Wykonaj(profil, wynik.Pola, okno, konfiguracja.Ustawienia);
        foreach (var krok in makro.Kroki)
            Console.WriteLine($"  [{(krok.Ok ? "OK " : "BLAD")}] {krok.Opis}");
        Console.WriteLine(makro.Podsumowanie());

        if (!string.IsNullOrEmpty(sprawdz))
        {
            Thread.Sleep(200);
            var element = Uia.Z(okno);
            var kontrolka = element == null ? null : Uia.Znajdz(element, new Cel { AutomationId = sprawdz });
            Console.WriteLine(kontrolka == null
                ? $"--- kontrolka {sprawdz}: nie znaleziono"
                : $"--- {sprawdz}:\n{Uia.Odczytaj(kontrolka)}");
        }
        return makro.Nieudane == 0 ? 0 : 1;
    }

    /// <summary>Diagnostyka: czy hook klawiatury w ogole dostaje zdarzenia.</summary>
    private static int HookTest()
    {
        Konsola();
        var zliczone = 0;
        var znaki = new StringBuilder();

        Native.HookProc proc = (code, wParam, lParam) =>
        {
            if (code >= 0 && (int)wParam == Native.WM_KEYDOWN)
            {
                var dane = System.Runtime.InteropServices.Marshal
                    .PtrToStructure<Native.KBDLLHOOKSTRUCT>(lParam);
                zliczone++;
                if (znaki.Length < 60)
                    znaki.Append($"[vk={dane.vkCode} scan={dane.scanCode} flags={dane.flags}]");
            }
            return Native.CallNextHookEx(IntPtr.Zero, code, wParam, lParam);
        };

        var hook = Native.SetWindowsHookExW(Native.WH_KEYBOARD_LL, proc, Native.GetModuleHandleW(null), 0);
        Console.WriteLine(hook == IntPtr.Zero
            ? "BLAD: nie udalo sie zalozyc hooka"
            : "hook zalozony, zbieram zdarzenia przez 6 s...");
        if (hook == IntPtr.Zero) return 1;

        ApplicationConfiguration.Initialize();
        var timer = new System.Windows.Forms.Timer { Interval = 6000 };
        timer.Tick += (_, _) => { timer.Stop(); Application.Exit(); };
        timer.Start();
        Application.Run(); // pompa komunikatow - bez niej hook nie dostanie nic

        Native.UnhookWindowsHookEx(hook);
        GC.KeepAlive(proc);
        Console.WriteLine($"zdarzen keydown: {zliczone}");
        Console.WriteLine("probka: " + znaki);
        return zliczone > 0 ? 0 : 1;
    }

    /// <summary>
    /// Udaje czytnik: wysyla znaki w tempie skanera (bez znacznika wlasnego),
    /// zeby dalo sie przetestowac pelna sciezke z hookiem klawiatury.
    /// </summary>
    /// <param name="jakHid">
    /// true = wysylaj kodami klawiszy z Shiftem przy wielkich literach, czyli
    /// dokladnie tak, jak robi to czytnik HID. false = wstrzykiwanie unicode.
    /// </param>
    private static int Wyslij(string? tekst, string? nazwaProcesu, bool jakHid)
    {
        Konsola();
        if (string.IsNullOrEmpty(tekst)) { Console.WriteLine("uzycie: --wyslij \"RAMKA\""); return 2; }

        if (!string.IsNullOrEmpty(nazwaProcesu))
        {
            var uchwyt = GlowneOknoProcesu(nazwaProcesu);
            if (uchwyt == IntPtr.Zero) { Console.WriteLine($"nie znaleziono okna procesu {nazwaProcesu}"); return 1; }
            Native.NaWierzch(uchwyt);
            Thread.Sleep(700);
        }

        const ushort vkShift = 0x10;
        foreach (var znak in tekst.Replace("\\t", "\t"))
        {
            if (znak == '\t') { Native.WyslijKlawisz(0x09, false); Thread.Sleep(5); continue; }

            if (jakHid)
            {
                var kod = Native.VkKeyScanW(znak);
                if (kod != -1)
                {
                    var vk = (ushort)(kod & 0xFF);
                    var zeShiftem = (kod & 0x100) != 0;
                    if (zeShiftem) Native.WyslijKlawiszStan(vkShift, false, false);
                    Native.WyslijKlawisz(vk, false);
                    if (zeShiftem) Native.WyslijKlawiszStan(vkShift, true, false);
                    Thread.Sleep(5);
                    continue;
                }
            }
            Native.WyslijZnak(znak, false);
            Thread.Sleep(5); // tempo czytnika: ~5 ms na znak
        }
        Native.WyslijKlawisz(0x0D, false); // ENTER konczy ramke
        Console.WriteLine($"wyslano {tekst.Length} znakow + ENTER" + (jakHid ? " (jak HID)" : ""));
        return 0;
    }

    /// <summary>Okno wskazanego procesu, a bez podanej nazwy - to na wierzchu (po 2 s zwloki).</summary>
    private static IntPtr Wskaz(string? nazwaProcesu)
    {
        if (string.IsNullOrEmpty(nazwaProcesu))
        {
            Thread.Sleep(2000); // czas na przelaczenie sie do badanej aplikacji
            return Native.GetForegroundWindow();
        }
        var uchwyt = GlowneOknoProcesu(nazwaProcesu);
        if (uchwyt == IntPtr.Zero) Console.WriteLine($"nie znaleziono okna procesu {nazwaProcesu}");
        return uchwyt;
    }

    private static IntPtr GlowneOknoProcesu(string nazwa)
    {
        foreach (var p in System.Diagnostics.Process.GetProcessesByName(nazwa))
        {
            using (p)
            {
                if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
            }
        }
        return IntPtr.Zero;
    }

    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    private static extern bool AttachConsole(int processId);

    private static void Konsola()
    {
        AttachConsole(-1); // podepnij sie do konsoli, z ktorej uruchomiono program
        Console.OutputEncoding = Encoding.UTF8;
    }
}
