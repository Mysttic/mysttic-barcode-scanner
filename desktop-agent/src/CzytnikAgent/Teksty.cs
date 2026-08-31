// Teksty interfejsu agenta w dwoch jezykach. Domyslnie angielski; wybor
// uzytkownika siedzi w pliku profili (pole "lang"), zeby przy prowizjonowaniu
// stanowisk szedl razem z konfiguracja.
//
// Log i komunikaty diagnostyczne zostaja po angielsku niezaleznie od wyboru -
// czyta je serwis, nie operator.
namespace CzytnikAgent;

public static class Teksty
{
    private static readonly Dictionary<string, string> En = new()
    {
        ["app.name"] = "Mysttic Barcode Scanner",
        ["tray.tooltip"] = "Mysttic Barcode Scanner - agent",
        ["tray.enabled"] = "Enabled",
        ["tray.learn"] = "Teach a new form\tCtrl+Alt+F9",
        ["tray.profiles"] = "Profiles (manage)...",
        ["tray.reload"] = "Reload the profiles from the file",
        ["tray.openFile"] = "Open the profiles file",
        ["tray.language"] = "Language",
        ["tray.quit"] = "Quit",
        ["tray.hotkeyFailed"] = "could not register the Ctrl+Alt+F9 shortcut",
        ["tray.started"] = "The agent is running. Profiles: {0}. Learning: Ctrl+Alt+F9",
        ["tray.reloaded"] = "Profiles loaded: {0}",
        ["tray.focusFirst"] = "First switch to the window of the application you want to teach.",
        ["tray.profileSaved"] = "Profile saved",
        ["tray.profileSavedBody"] = "\"{0}\" works from now on ({1} steps). You can scan.",
        ["tray.filled"] = "Filled in",
        ["tray.macroError"] = "macro error: {0}",

        ["profiles.title"] = "Profiles - Mysttic Barcode Scanner",
        ["profiles.enabled"] = "profile enabled",
        ["profiles.save"] = "Save",
        ["profiles.delete"] = "Delete",
        ["profiles.openFile"] = "Open file",
        ["profiles.close"] = "Close",
        ["profiles.name"] = "Name",
        ["profiles.process"] = "Process (without .exe)",
        ["profiles.titlePattern"] = "Window title pattern (* = any fragment)",
        ["profiles.steps"] = "Macro steps",
        ["profiles.empty"] = "No profiles.\r\n\r\nOpen a form and press Ctrl+Alt+F9\r\nto teach the agent.",
        ["profiles.fields"] = "fields: {0}",
        ["profiles.prefix"] = "prefix: {0}   separator: {1}",
        ["profiles.none"] = "(none)",
        ["profiles.deleteConfirm"] = "Delete the profile \"{0}\"?",
        ["profiles.dialogTitle"] = "Agent profiles",

        ["learn.title"] = "Learning a profile - Mysttic Barcode Scanner",
        ["learn.profileName"] = "Profile name:",
        ["learn.process"] = "Process:",
        ["learn.titlePattern"] = "Title pattern:",
        ["learn.next"] = "Next",
        ["learn.cancel"] = "Cancel",
        ["learn.record"] = "Record",
        ["learn.stop"] = "Stop",
        ["learn.save"] = "Save",
        ["learn.recording"] = "recording... switch to the application",
        ["learn.step1.head"] = "Step 1 of 4: scan the code",
        ["learn.step1.body"] = "Application: {0} - \"{1}\"\r\nClick the box below and scan the code you will "
            + "be filling this form with. The characters land here, not in the application.",
        ["learn.step2.head"] = "Step 2 of 4: name the segments",
        ["learn.step2.body"] = "The code has been split. Give names to the segments you want to use. "
            + "Type \"_\" next to the segments to skip (a prefix, for example).",
        ["learn.step3.head"] = "Step 3 of 4: record the actions",
        ["learn.step3.body"] = "Click \"Record\", switch to the application and fill the form by hand, "
            + "clicking the boxes and typing the values from the code. Then come back here and click \"Stop\".",
        ["learn.step4.head"] = "Step 4 of 4: save the profile",
        ["learn.step4.body"] = "Check the steps and the window recognition parameters. The profile only works "
            + "when the process matches AND the window title matches the pattern.",
        ["learn.step4.hint"] = "Detected: process \"{0}\", title \"{1}\".\r\n"
            + "An empty pattern means any title (handy when the title changes).",
        ["learn.needScan"] = "scan the code first",
        ["learn.needSegment"] = "name at least one segment",
        ["learn.nothingRecorded"] = "nothing was recorded, try again",
        ["learn.savedTitle"] = "Profile saved",
        ["learn.savedBody"] = "Profile \"{0}\" saved ({1} steps).\n\nThe profile is already active, you can scan.",
        ["learn.fieldPrefix"] = "field",
    };

    private static readonly Dictionary<string, string> Pl = new()
    {
        ["app.name"] = "Mysttic Barcode Scanner",
        ["tray.tooltip"] = "Mysttic Barcode Scanner - agent",
        ["tray.enabled"] = "Włączony",
        ["tray.learn"] = "Ucz nowego formularza\tCtrl+Alt+F9",
        ["tray.profiles"] = "Profile (zarządzaj)...",
        ["tray.reload"] = "Przeładuj profile z pliku",
        ["tray.openFile"] = "Otwórz plik profili",
        ["tray.language"] = "Język",
        ["tray.quit"] = "Zakończ",
        ["tray.hotkeyFailed"] = "nie udało się zarejestrować skrótu Ctrl+Alt+F9",
        ["tray.started"] = "Agent działa. Profili: {0}. Nauka: Ctrl+Alt+F9",
        ["tray.reloaded"] = "Wczytano profili: {0}",
        ["tray.focusFirst"] = "Najpierw przejdź do okna aplikacji, której chcesz nauczyć.",
        ["tray.profileSaved"] = "Profil zapisany",
        ["tray.profileSavedBody"] = "\"{0}\" działa od zaraz ({1} kroków). Możesz skanować.",
        ["tray.filled"] = "Wypełniono",
        ["tray.macroError"] = "błąd makra: {0}",

        ["profiles.title"] = "Profile - Mysttic Barcode Scanner",
        ["profiles.enabled"] = "profil włączony",
        ["profiles.save"] = "Zapisz",
        ["profiles.delete"] = "Usuń",
        ["profiles.openFile"] = "Otwórz plik",
        ["profiles.close"] = "Zamknij",
        ["profiles.name"] = "Nazwa",
        ["profiles.process"] = "Proces (bez .exe)",
        ["profiles.titlePattern"] = "Wzorzec tytułu okna (* = dowolny fragment)",
        ["profiles.steps"] = "Kroki makra",
        ["profiles.empty"] = "Brak profili.\r\n\r\nOtwórz formularz i naciśnij Ctrl+Alt+F9,\r\naby nauczyć agenta.",
        ["profiles.fields"] = "pola: {0}",
        ["profiles.prefix"] = "prefiks: {0}   separator: {1}",
        ["profiles.none"] = "(brak)",
        ["profiles.deleteConfirm"] = "Usunąć profil \"{0}\"?",
        ["profiles.dialogTitle"] = "Profile agenta",

        ["learn.title"] = "Nauka profilu - Mysttic Barcode Scanner",
        ["learn.profileName"] = "Nazwa profilu:",
        ["learn.process"] = "Proces:",
        ["learn.titlePattern"] = "Wzorzec tytułu:",
        ["learn.next"] = "Dalej",
        ["learn.cancel"] = "Anuluj",
        ["learn.record"] = "Nagrywaj",
        ["learn.stop"] = "Stop",
        ["learn.save"] = "Zapisz",
        ["learn.recording"] = "nagrywanie... przejdź do aplikacji",
        ["learn.step1.head"] = "Krok 1 z 4: zeskanuj kod",
        ["learn.step1.body"] = "Aplikacja: {0} - \"{1}\"\r\nKliknij w pole poniżej i zeskanuj kod, którym "
            + "będziesz wypełniał ten formularz. Znaki trafią tutaj, nie do aplikacji.",
        ["learn.step2.head"] = "Krok 2 z 4: nazwij segmenty",
        ["learn.step2.body"] = "Kod został pocięty. Nadaj nazwy segmentom, które chcesz wykorzystać. "
            + "Wpisz \"_\" przy segmentach do pominięcia (np. prefiks).",
        ["learn.step3.head"] = "Krok 3 z 4: nagraj czynności",
        ["learn.step3.body"] = "Kliknij \"Nagrywaj\", przejdź do aplikacji i wypełnij formularz ręcznie, "
            + "klikając w pola i wpisując wartości z kodu. Potem wróć tutaj i kliknij \"Stop\".",
        ["learn.step4.head"] = "Krok 4 z 4: zapisz profil",
        ["learn.step4.body"] = "Sprawdź kroki i parametry rozpoznawania okna. Profil zadziała tylko wtedy, "
            + "gdy zgadza się proces ORAZ tytuł okna pasuje do wzorca.",
        ["learn.step4.hint"] = "Wykryto: proces \"{0}\", tytuł \"{1}\".\r\n"
            + "Wzorzec pusty = dowolny tytuł (przydatne, gdy tytuł się zmienia).",
        ["learn.needScan"] = "najpierw zeskanuj kod",
        ["learn.needSegment"] = "nazwij przynajmniej jeden segment",
        ["learn.nothingRecorded"] = "nic nie nagrano, spróbuj ponownie",
        ["learn.savedTitle"] = "Profil zapisany",
        ["learn.savedBody"] = "Zapisano profil \"{0}\" ({1} kroków).\n\nProfil jest już aktywny, możesz skanować.",
        ["learn.fieldPrefix"] = "pole",
    };

    /// <summary>"en" albo "pl"; ustawiane raz przy starcie z konfiguracji.</summary>
    public static string Jezyk { get; private set; } = "en";

    public static void Ustaw(string? jezyk)
    {
        Jezyk = jezyk == "pl" ? "pl" : "en";
    }

    public static string T(string klucz)
    {
        var slownik = Jezyk == "pl" ? Pl : En;
        return slownik.TryGetValue(klucz, out var tekst) ? tekst : En.GetValueOrDefault(klucz, klucz);
    }

    public static string T(string klucz, params object?[] argumenty) =>
        string.Format(T(klucz), argumenty);
}
