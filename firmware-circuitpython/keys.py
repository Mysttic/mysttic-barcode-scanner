# Klawisze specjalne wspierane w listach akcji - JEDNO zrodlo prawdy.
# Modul bez importow CircuitPythona (uzywany przez walidator i testy hostowe).
# output_hid.py buduje z tej mapy KEYMAP przez getattr(Keycode, attr).

KEY_TO_KEYCODE_ATTR = {
    "TAB": "TAB",
    "ENTER": "ENTER",
    "ESC": "ESCAPE",
    "BACKSPACE": "BACKSPACE",
    "UP": "UP_ARROW",
    "DOWN": "DOWN_ARROW",
    "LEFT": "LEFT_ARROW",
    "RIGHT": "RIGHT_ARROW",
    "F1": "F1",
    "F2": "F2",
    "F3": "F3",
    "F4": "F4",
    "F5": "F5",
    "F6": "F6",
    "F7": "F7",
    "F8": "F8",
    "F9": "F9",
    "F10": "F10",
    "F11": "F11",
    "F12": "F12",
}

KEY_NAMES = tuple(KEY_TO_KEYCODE_ATTR)
