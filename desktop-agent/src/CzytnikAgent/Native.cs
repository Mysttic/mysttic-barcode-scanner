// Cienka warstwa nad Win32: hook klawiatury, wysylanie zdarzen (SendInput),
// informacje o oknie na wierzchu, globalny skrot klawiszowy.
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace CzytnikAgent;

internal static class Native
{
    // ------------------------------------------------------------ okna ----

    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextW(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    internal static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] internal static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
    [DllImport("kernel32.dll")] internal static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] internal static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] internal static extern bool IsIconic(IntPtr hWnd);

    private const int SW_RESTORE = 9;

    /// <summary>
    /// Ustawia okno na wierzchu. Samo SetForegroundWindow czesto nie dziala
    /// (Windows chroni przed kradzieza fokusu), wiec na czas wywolania
    /// podpinamy sie do watku biezacego okna pierwszoplanowego.
    /// </summary>
    internal static void NaWierzch(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero) return;
        if (IsIconic(hWnd)) ShowWindow(hWnd, SW_RESTORE);

        var obecne = GetForegroundWindow();
        var watekObecnego = GetWindowThreadProcessId(obecne, out _);
        var mojWatek = GetCurrentThreadId();
        var podpiete = watekObecnego != 0 && watekObecnego != mojWatek &&
                       AttachThreadInput(mojWatek, watekObecnego, true);
        try
        {
            BringWindowToTop(hWnd);
            SetForegroundWindow(hWnd);
        }
        finally
        {
            if (podpiete) AttachThreadInput(mojWatek, watekObecnego, false);
        }
    }
    [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] internal static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
    [DllImport("user32.dll")] internal static extern bool ScreenToClient(IntPtr hWnd, ref POINT point);
    [DllImport("user32.dll")] internal static extern IntPtr WindowFromPoint(POINT point);
    [DllImport("user32.dll")] internal static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);

    [StructLayout(LayoutKind.Sequential)]
    internal struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    internal struct POINT { public int X, Y; }

    internal const uint GA_ROOT = 2;

    internal static string TytulOkna(IntPtr hWnd)
    {
        var sb = new StringBuilder(512);
        return GetWindowTextW(hWnd, sb, sb.Capacity) > 0 ? sb.ToString() : "";
    }

    internal static string ProcesOkna(IntPtr hWnd)
    {
        GetWindowThreadProcessId(hWnd, out var pid);
        try
        {
            using var p = Process.GetProcessById((int)pid);
            return p.ProcessName;
        }
        catch (ArgumentException) { return ""; }
        catch (InvalidOperationException) { return ""; }
    }

    // -------------------------------------------------- hook klawiatury ----

    internal const int WH_KEYBOARD_LL = 13;
    internal const int WM_KEYDOWN = 0x0100;
    internal const int WM_SYSKEYDOWN = 0x0104;
    internal const int WM_KEYUP = 0x0101;

    internal delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    internal struct KBDLLHOOKSTRUCT
    {
        public uint vkCode, scanCode, flags, time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    internal static extern IntPtr SetWindowsHookExW(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)]
    internal static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    internal static extern IntPtr CallNextHookEx(IntPtr hhk, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    internal static extern IntPtr GetModuleHandleW(string? lpModuleName);

    [DllImport("user32.dll")] internal static extern short GetKeyState(int nVirtKey);
    /// <summary>Znak -> kod klawisza + wymagane modyfikatory (bit 8 = Shift).</summary>
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern short VkKeyScanW(char ch);
    [DllImport("user32.dll")]
    internal static extern int ToUnicodeEx(uint wVirtKey, uint wScanCode, byte[] lpKeyState,
        StringBuilder pwszBuff, int cchBuff, uint wFlags, IntPtr dwhkl);
    [DllImport("user32.dll")] internal static extern IntPtr GetKeyboardLayout(uint idThread);
    [DllImport("user32.dll")] internal static extern bool GetKeyboardState(byte[] lpKeyState);

    // ------------------------------------------------------- SendInput ----

    [StructLayout(LayoutKind.Sequential)]
    internal struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    internal struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct MOUSEINPUT
    {
        public int dx, dy;
        public uint mouseData, dwFlags, time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct KEYBDINPUT
    {
        public ushort wVk, wScan;
        public uint dwFlags, time;
        public IntPtr dwExtraInfo;
    }

    internal const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    internal const uint KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_UNICODE = 0x0004;
    internal const uint MOUSEEVENTF_MOVE = 0x0001, MOUSEEVENTF_ABSOLUTE = 0x8000;
    internal const uint MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004;

    [DllImport("user32.dll", SetLastError = true)]
    internal static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("user32.dll")] internal static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] internal static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] internal static extern int GetSystemMetrics(int index);

    internal const int SM_CXSCREEN = 0, SM_CYSCREEN = 1;

    /// <summary>Znacznik wlasnych zdarzen - zeby hook nie lapal tego, co sam wysylamy.</summary>
    internal static readonly IntPtr ZnacznikWlasny = new(0x42434452); // "BCDR"

    /// <param name="wlasny">
    /// true = zdarzenie oznaczone jako nasze (hook je pomija). false uzywamy
    /// tylko w trybie testowym, gdy udajemy czytnik i chcemy, zeby hook zadzialal.
    /// </param>
    internal static void WyslijZnak(char znak, bool wlasny = true)
    {
        var input = new INPUT[2];
        for (var i = 0; i < 2; i++)
        {
            input[i].type = INPUT_KEYBOARD;
            input[i].U.ki = new KEYBDINPUT
            {
                wVk = 0,
                wScan = znak,
                dwFlags = KEYEVENTF_UNICODE | (i == 1 ? KEYEVENTF_KEYUP : 0),
                dwExtraInfo = wlasny ? ZnacznikWlasny : IntPtr.Zero,
            };
        }
        SendInput(2, input, Marshal.SizeOf<INPUT>());
    }

    internal static void WyslijKlawisz(ushort vk, bool wlasny = true)
    {
        var input = new INPUT[2];
        for (var i = 0; i < 2; i++)
        {
            input[i].type = INPUT_KEYBOARD;
            input[i].U.ki = new KEYBDINPUT
            {
                wVk = vk,
                dwFlags = i == 1 ? KEYEVENTF_KEYUP : 0,
                dwExtraInfo = wlasny ? ZnacznikWlasny : IntPtr.Zero,
            };
        }
        SendInput(2, input, Marshal.SizeOf<INPUT>());
    }

    /// <summary>Ctrl+A, potem Delete - czysci zawartosc aktywnego pola.</summary>
    internal static void WyczyscPole()
    {
        const ushort ctrl = 0x11, a = 0x41, del = 0x2E;
        WyslijKlawiszStan(ctrl, false);
        WyslijKlawisz(a);
        WyslijKlawiszStan(ctrl, true);
        Thread.Sleep(10);
        WyslijKlawisz(del);
        Thread.Sleep(10);
    }

    /// <summary>Pojedyncze zdarzenie klawisza (bez pary down+up) - np. Shift.</summary>
    internal static void WyslijKlawiszStan(ushort vk, bool wGore, bool wlasny = true)
    {
        var input = new INPUT[1];
        input[0].type = INPUT_KEYBOARD;
        input[0].U.ki = new KEYBDINPUT
        {
            wVk = vk,
            dwFlags = wGore ? KEYEVENTF_KEYUP : 0,
            dwExtraInfo = wlasny ? ZnacznikWlasny : IntPtr.Zero,
        };
        SendInput(1, input, Marshal.SizeOf<INPUT>());
    }

    internal static void KlikMysza(int ekranX, int ekranY)
    {
        SetCursorPos(ekranX, ekranY);
        Thread.Sleep(15);
        var szerokosc = GetSystemMetrics(SM_CXSCREEN);
        var wysokosc = GetSystemMetrics(SM_CYSCREEN);
        var input = new INPUT[2];
        for (var i = 0; i < 2; i++)
        {
            input[i].type = INPUT_MOUSE;
            input[i].U.mi = new MOUSEINPUT
            {
                dx = ekranX * 65535 / Math.Max(1, szerokosc),
                dy = ekranY * 65535 / Math.Max(1, wysokosc),
                dwFlags = MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE |
                          (i == 0 ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP),
                dwExtraInfo = ZnacznikWlasny,
            };
        }
        SendInput(2, input, Marshal.SizeOf<INPUT>());
    }

    // -------------------------------------------------- globalny skrot ----

    [DllImport("user32.dll")]
    internal static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")]
    internal static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    internal const uint MOD_ALT = 0x0001, MOD_CONTROL = 0x0002, MOD_SHIFT = 0x0004, MOD_NOREPEAT = 0x4000;
    internal const int WM_HOTKEY = 0x0312;

    // ------------------------------------------------------ mysz: hook ----

    internal const int WH_MOUSE_LL = 14;
    internal const int WM_LBUTTONDOWN = 0x0201;

    [StructLayout(LayoutKind.Sequential)]
    internal struct MSLLHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData, flags, time;
        public IntPtr dwExtraInfo;
    }
}
