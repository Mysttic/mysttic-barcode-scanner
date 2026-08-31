// Prosty log pracy agenta: %APPDATA%\MystticBarcodeScanner\agent.log
// Sluzy diagnostyce wdrozen ("dlaczego nie wypelnilo?") i testom.
using System.IO;

namespace CzytnikAgent;

public static class Log
{
    private static readonly object Zamek = new();
    private static string? _sciezka;

    public static string Sciezka => _sciezka ??= Path.Combine(Magazyn.Katalog, "agent.log");

    public static void Pisz(string tekst)
    {
        try
        {
            lock (Zamek)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Sciezka)!);
                var plik = new FileInfo(Sciezka);
                if (plik.Exists && plik.Length > 512 * 1024) plik.Delete(); // prosty obrot logu
                File.AppendAllText(Sciezka, $"{DateTime.Now:HH:mm:ss.fff}  {tekst}{Environment.NewLine}");
            }
        }
        catch (IOException) { /* log nie moze przewrocic agenta */ }
        catch (UnauthorizedAccessException) { }
    }
}
