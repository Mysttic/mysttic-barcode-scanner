// Zrzuty ekranu kreatora nauki do dokumentacji (docs/img/agent-*.png).
//
// Scenariusz jest przechodzony na zywo: prawdziwe okno kreatora, prawdziwa
// aplikacja testowa, prawdziwe UI Automation. Dzieki temu obrazki w instrukcji
// nie rozjezdzaja sie z kodem (tak samo jak "npm run shots" we wtyczce).
using System.Drawing.Imaging;
using System.IO;

namespace CzytnikAgent;

public static class Zrzuty
{
    public static int Wykonaj(string katalogWyjsciowy, string? nazwaProcesu)
    {
        Directory.CreateDirectory(katalogWyjsciowy);

        var oknoAplikacji = ZnajdzOkno(nazwaProcesu ?? "MystticDemoApp");
        if (oknoAplikacji == IntPtr.Zero)
        {
            Console.WriteLine("FAILED: no demo application window found, start it first");
            return 1;
        }

        Native.NaWierzch(oknoAplikacji);
        Thread.Sleep(600);

        var konfiguracja = new Konfiguracja();
        var kreator = new OknoNauki(konfiguracja, oknoAplikacji);
        kreator.Show();
        Application.DoEvents();
        Thread.Sleep(400);

        // Krok 1: kreator czeka na skan
        Zapisz(kreator, katalogWyjsciowy, "agent-learn-1-scan");

        // Krok 2: ramka pocieta na segmenty (wpisujemy ja tak, jak zrobilby czytnik)
        kreator.UstawRamkeTestowa("PRC;JAN;KOWALSKI;12345;IT");
        Application.DoEvents();
        Thread.Sleep(300);
        kreator.NazwijSegmenty(new[] { "_", "firstName", "lastName", "number", "department" });
        Application.DoEvents();
        Thread.Sleep(300);
        Zapisz(kreator, katalogWyjsciowy, "agent-learn-2-segments");

        // Krok 3: lista nagranych czynnosci
        kreator.PokazNagranie(new List<Krok>
        {
            new() { Akcja = "field", Cel = new Cel { AutomationId = "txtFirstName" }, Wartosc = "{firstName}", Tryb = "type" },
            new() { Akcja = "field", Cel = new Cel { AutomationId = "txtLastName" }, Wartosc = "{lastName}", Tryb = "type" },
            new() { Akcja = "field", Cel = new Cel { AutomationId = "txtNumber" }, Wartosc = "{number}", Tryb = "type" },
            new() { Akcja = "field", Cel = new Cel { AutomationId = "cmbDepartment" }, Wartosc = "{department}", Tryb = "select" },
        });
        Application.DoEvents();
        Thread.Sleep(300);
        Zapisz(kreator, katalogWyjsciowy, "agent-learn-3-recording");

        // Krok 4: parametry rozpoznawania okna przed zapisem
        kreator.PokazZapis();
        Application.DoEvents();
        Thread.Sleep(300);
        Zapisz(kreator, katalogWyjsciowy, "agent-learn-4-save");

        kreator.Close();
        Application.DoEvents();

        // Okno zarzadzania profilami z przykladowym profilem
        var zProfilem = new Konfiguracja
        {
            Profile = new List<Profil>
            {
                new()
                {
                    Nazwa = "Employee card (demo)",
                    Match = new Dopasowanie { Proces = "MystticDemoApp", TytulWzorzec = "*Employee card*" },
                    Parse = new Parsowanie
                    {
                        Typ = "delimited", Prefiks = "PRC;", Separator = ";",
                        Pola = new List<string> { "_", "firstName", "lastName", "number", "department" },
                    },
                    Kroki = new List<Krok>
                    {
                        new() { Akcja = "field", Cel = new Cel { AutomationId = "txtFirstName" }, Wartosc = "{firstName}", Tryb = "type" },
                        new() { Akcja = "field", Cel = new Cel { AutomationId = "txtLastName" }, Wartosc = "{lastName}", Tryb = "type" },
                        new() { Akcja = "field", Cel = new Cel { AutomationId = "txtNumber" }, Wartosc = "{number}", Tryb = "type" },
                        new() { Akcja = "field", Cel = new Cel { AutomationId = "cmbDepartment" }, Wartosc = "{department}", Tryb = "select" },
                    },
                },
            },
        };
        var okno = new OknoProfili(zProfilem, Path.Combine(Path.GetTempPath(), "zrzut-profili.json"), () => { });
        okno.Show();
        Application.DoEvents();
        Thread.Sleep(500);
        Zapisz(okno, katalogWyjsciowy, "agent-profiles");
        okno.Close();

        Console.WriteLine($"Screenshots saved in {katalogWyjsciowy}");
        return 0;
    }

    private static IntPtr ZnajdzOkno(string proces)
    {
        foreach (var p in System.Diagnostics.Process.GetProcessesByName(proces))
        {
            using (p)
            {
                if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
            }
        }
        return IntPtr.Zero;
    }

    private static void Zapisz(Form okno, string katalog, string nazwa)
    {
        okno.Refresh();
        Application.DoEvents();
        Thread.Sleep(150);

        var prostokat = okno.Bounds;
        using var bitmapa = new Bitmap(prostokat.Width, prostokat.Height);
        using (var grafika = Graphics.FromImage(bitmapa))
        {
            grafika.CopyFromScreen(prostokat.Location, Point.Empty, prostokat.Size);
        }
        var sciezka = Path.Combine(katalog, nazwa + ".png");
        bitmapa.Save(sciezka, ImageFormat.Png);
        Console.WriteLine("  -> " + sciezka);
    }
}
