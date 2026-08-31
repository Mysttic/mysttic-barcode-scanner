// UI Automation: znajdowanie kontrolek w oknie i wpisywanie do nich wartosci.
//
// To jest desktopowy odpowiednik selektorow CSS z wtyczki: zamiast
// "input[name=firstName]" mamy AutomationId/Name kontrolki. Dzieki temu profil
// przezywa przesuniecie okna, zmiane rozdzielczosci i skalowania DPI -
// w przeciwienstwie do makr opartych na samych wspolrzednych.
using System.Windows.Automation;

namespace CzytnikAgent;

public static class Uia
{
    /// <summary>Element okna na wierzchu (albo null, gdy UIA go nie widzi).</summary>
    public static AutomationElement? OknoNaWierzchu()
    {
        var uchwyt = Native.GetForegroundWindow();
        return uchwyt == IntPtr.Zero ? null : Z(uchwyt);
    }

    public static AutomationElement? Z(IntPtr uchwyt)
    {
        try { return AutomationElement.FromHandle(uchwyt); }
        catch (ElementNotAvailableException) { return null; }
        catch (ArgumentException) { return null; }
    }

    /// <summary>Kontrolka pod kursorem - uzywane w trybie nauki.</summary>
    public static AutomationElement? PodPunktem(int ekranX, int ekranY)
    {
        try { return AutomationElement.FromPoint(new System.Windows.Point(ekranX, ekranY)); }
        catch (ElementNotAvailableException) { return null; }
        catch (ArgumentException) { return null; }
    }

    /// <summary>Buduje cel (selektor) dla wskazanej kontrolki, z fallbackiem na wspolrzedne.</summary>
    public static Cel ZbudujCel(AutomationElement element, IntPtr oknoGlowne)
    {
        var cel = new Cel();
        try
        {
            var info = element.Current;
            cel.AutomationId = info.AutomationId ?? "";
            cel.Nazwa = info.Name ?? "";
            cel.Typ = info.ControlType?.ProgrammaticName?.Replace("ControlType.", "") ?? "";

            // fallback: srodek kontrolki wyrazony wzgledem obszaru klienta okna
            var prostokat = info.BoundingRectangle;
            if (!prostokat.IsEmpty && oknoGlowne != IntPtr.Zero)
            {
                var punkt = new Native.POINT
                {
                    X = (int)(prostokat.Left + prostokat.Width / 2),
                    Y = (int)(prostokat.Top + prostokat.Height / 2),
                };
                if (Native.ScreenToClient(oknoGlowne, ref punkt))
                {
                    cel.X = punkt.X;
                    cel.Y = punkt.Y;
                }
            }
        }
        catch (ElementNotAvailableException) { /* kontrolka zniknela w trakcie */ }
        return cel;
    }

    /// <summary>Szuka kontrolki w oknie: najpierw po AutomationId, potem po nazwie.</summary>
    public static AutomationElement? Znajdz(AutomationElement okno, Cel cel)
    {
        try
        {
            if (!string.IsNullOrEmpty(cel.AutomationId))
            {
                var znaleziony = okno.FindFirst(TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.AutomationIdProperty, cel.AutomationId));
                if (znaleziony != null) return znaleziony;
            }
            if (!string.IsNullOrEmpty(cel.Nazwa))
            {
                return okno.FindFirst(TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.NameProperty, cel.Nazwa));
            }
        }
        catch (ElementNotAvailableException) { }
        return null;
    }

    /// <summary>Czy to pole hasla - takich nigdy nie wypelniamy.</summary>
    public static bool ToHaslo(AutomationElement element)
    {
        try { return element.Current.IsPassword; }
        catch (ElementNotAvailableException) { return false; }
    }

    /// <summary>
    /// Wpisuje wartosc do kontrolki. Najpierw ValuePattern (natychmiastowe,
    /// bez symulowania klawiatury), w razie potrzeby lista rozwijana, a gdy
    /// kontrolka nie wspiera wzorcow - fokus i wpisanie znakow.
    /// </summary>
    /// <param name="tryb">"type" | "select" | "auto" - patrz Krok.Tryb.</param>
    public static bool Wpisz(AutomationElement element, string wartosc, out string blad, string tryb = "auto")
    {
        blad = "";
        if (ToHaslo(element)) { blad = "password box, skipping"; return false; }

        try
        {
            // Operator uczyl WPISYWANIEM - nie probujemy wybierac z listy.
            // Pole wyszukiwania z podpowiedziami wyglada w UI Automation jak
            // lista wyboru, a jest zwyklym polem tekstowym.
            if (tryb == "type")
            {
                var poleTekstowe = ZnajdzEdytor(element) ?? element;
                return WpiszZKlawiatury(poleTekstowe, wartosc, out blad);
            }

            // Listy obslugujemy WYBOREM pozycji, nie wpisaniem tekstu:
            // ValuePattern.SetValue na ComboBox podmienia tylko widoczny tekst,
            // a aplikacja nie dostaje zdarzenia zmiany i zapisuje puste pole.
            var typ = element.Current.ControlType;
            if (typ == ControlType.ComboBox || typ == ControlType.List || tryb == "select")
            {
                var wynikListy = WybierzZListy(element, wartosc);
                if (wynikListy == WyborZListy.Wybrano) return true;

                // Nie udalo sie wybrac pozycji. Kontrolka przyjmujaca tekst
                // (lista edytowalna, wyszukiwarka z podpowiedziami) dostaje go
                // Z KLAWIATURY: ustawienie wartosci wzorcem nie wywoluje zdarzen
                // i aplikacja nic nie widzi.
                if (tryb == "select")
                {
                    blad = $"brak pozycji \"{wartosc}\" na liscie";
                    return false;
                }

                var edytor = ZnajdzEdytor(element);
                if (edytor != null) return WpiszZKlawiatury(edytor, wartosc, out blad);

                // Brak pozycji do wyboru = to wcale nie jest lista wyboru,
                // tylko pole tekstowe udajace ComboBox (typowe w aplikacjach
                // webowych i Electron, np. pole wyszukiwania).
                if (wynikListy == WyborZListy.ToNieLista)
                    return WpiszZKlawiatury(element, wartosc, out blad);

                blad = $"brak pozycji \"{wartosc}\" na liscie";
                return false;
            }

            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var wzorzec) &&
                !((ValuePattern)wzorzec).Current.IsReadOnly)
            {
                ((ValuePattern)wzorzec).SetValue(wartosc);
                // Sprawdzamy od razu: gdy kontrolka przyjela wartosc tylko
                // pozornie (bez zdarzen), wpisujemy ja z klawiatury.
                Thread.Sleep(15);
                var potwierdzenie = ((ValuePattern)wzorzec).Current.Value;
                if (string.Equals(potwierdzenie, wartosc, StringComparison.Ordinal)) return true;
            }

            if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out _))
            {
                if (WybierzZListy(element, wartosc) == WyborZListy.Wybrano) return true;
                blad = $"brak pozycji \"{wartosc}\" na liscie";
                return false;
            }

            // ostatecznosc: fokus i wpisanie z klawiatury
            return WpiszZKlawiatury(element, wartosc, out blad);
        }
        catch (ElementNotAvailableException) { blad = "kontrolka zniknela"; return false; }
        catch (InvalidOperationException e) { blad = e.Message; return false; }
    }

    /// <summary>
    /// Wpisanie nieodroznialne od pracy czlowieka: fokus, wyczyszczenie pola
    /// i znaki z klawiatury. Wolniejsze od ValuePattern, ale gwarantuje, ze
    /// aplikacja dostanie wszystkie zdarzenia.
    /// </summary>
    private static bool WpiszZKlawiatury(AutomationElement element, string wartosc, out string blad)
    {
        blad = "";
        try
        {
            element.SetFocus();
        }
        catch (InvalidOperationException) { /* niektore kontrolki nie przyjmuja fokusu wprost */ }
        catch (ElementNotAvailableException) { blad = "kontrolka zniknela"; return false; }

        Thread.Sleep(40);
        Native.WyczyscPole();
        foreach (var znak in wartosc) Native.WyslijZnak(znak);
        Thread.Sleep(30);
        return true;
    }

    private enum WyborZListy
    {
        Wybrano,
        /// <summary>Lista ma pozycje, ale zadna nie pasuje.</summary>
        BrakPozycji,
        /// <summary>Brak pozycji do wyboru.</summary>
        ToNieLista,
    }

    /// <summary>
    /// Czy kontrolka ma wlasne pole edycyjne. To odroznia zamknieta liste
    /// wyboru (tylko pozycje) od listy edytowalnej i pola z podpowiedziami,
    /// gdzie wolno wpisac dowolny tekst.
    /// </summary>
    /// <summary>Pole edycyjne wewnatrz kontrolki (edytowalna lista, wyszukiwarka).</summary>
    private static AutomationElement? ZnajdzEdytor(AutomationElement element)
    {
        try
        {
            return element.FindFirst(TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
        }
        catch (ElementNotAvailableException) { return null; }
    }

    /// <summary>
    /// Czy kontrolka potwierdza, ze ma wpisana wartosc. Pytamy o wybrana
    /// pozycje ORAZ o tekst - listy raportuja jedno, pola tekstowe drugie,
    /// a kontrolki webowe udajace liste potrafia raportowac oba.
    /// </summary>
    public static bool Potwierdza(AutomationElement element, string wartosc, out string odczytano)
    {
        var kandydaci = new List<string>();
        try
        {
            if (element.TryGetCurrentPattern(SelectionPattern.Pattern, out var wybor))
            {
                var wybrane = ((SelectionPattern)wybor).Current.GetSelection();
                kandydaci.Add(wybrane.Length > 0 ? wybrane[0].Current.Name ?? "" : "");
            }
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var wzorzec))
                kandydaci.Add(((ValuePattern)wzorzec).Current.Value ?? "");
        }
        catch (ElementNotAvailableException) { }
        catch (InvalidOperationException) { }

        odczytano = kandydaci.Count > 0 ? string.Join(" / ", kandydaci.Select(k => $"\"{k}\"")) : "";
        if (kandydaci.Count == 0) return true; // nie da sie zweryfikowac - nie zglaszamy bledu
        return kandydaci.Any(k => string.Equals(k, wartosc, StringComparison.Ordinal));
    }

    private static WyborZListy WybierzZListy(AutomationElement lista, string wartosc)
    {
        var bylyPozycje = false;
        try
        {
            // Lista rozwijana tworzy pozycje dopiero po rozwinieciu - musimy ja
            // otworzyc, zeby w ogole zobaczyc elementy w drzewie UIA.
            ExpandCollapsePattern? rozwijanie = null;
            if (lista.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var wzorzecRozwijania))
            {
                rozwijanie = (ExpandCollapsePattern)wzorzecRozwijania;
                if (rozwijanie.Current.ExpandCollapseState == ExpandCollapseState.Collapsed)
                {
                    rozwijanie.Expand();
                    Thread.Sleep(60);
                }
            }

            try
            {
                var pozycje = lista.FindAll(TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem));
                bylyPozycje = pozycje.Count > 0;
                foreach (AutomationElement pozycja in pozycje)
                {
                    var nazwa = pozycja.Current.Name ?? "";
                    if (!string.Equals(nazwa, wartosc, StringComparison.OrdinalIgnoreCase)) continue;
                    if (!pozycja.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var wzorzec)) continue;
                    ((SelectionItemPattern)wzorzec).Select();
                    return WyborZListy.Wybrano;
                }
            }
            finally
            {
                rozwijanie?.Collapse();
            }
        }
        catch (ElementNotAvailableException) { }
        catch (InvalidOperationException) { }
        return bylyPozycje ? WyborZListy.BrakPozycji : WyborZListy.ToNieLista;
    }

    /// <summary>
    /// Odczyt zwrotny - potwierdza, ze aplikacja faktycznie przyjela wartosc.
    /// Dla list pytamy o WYBRANA pozycje, nie o tekst: ValuePattern potrafi
    /// zwrocic wartosc, ktorej aplikacja nigdy nie zobaczyla.
    /// </summary>
    public static string? Odczytaj(AutomationElement element)
    {
        try
        {
            if (element.TryGetCurrentPattern(SelectionPattern.Pattern, out var wybor))
            {
                var wybrane = ((SelectionPattern)wybor).Current.GetSelection();
                return wybrane.Length > 0 ? wybrane[0].Current.Name : "";
            }
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var wzorzec))
                return ((ValuePattern)wzorzec).Current.Value;
        }
        catch (ElementNotAvailableException) { }
        catch (InvalidOperationException) { }
        return null;
    }
}
