# Wysylanie listy akcji jako klawiatura USB HID.
# Uklad: US (mapowania PL/DE dojda po parserze i konfiguratorze - Etap 9).
import time

import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
from adafruit_hid.keycode import Keycode

from keys import KEY_TO_KEYCODE_ATTR

KEYMAP = {name: getattr(Keycode, attr) for name, attr in KEY_TO_KEYCODE_ATTR.items()}


class HidOutput:
    def __init__(self, key_delay_ms=10, action_delay_ms=30):
        self._keyboard = Keyboard(usb_hid.devices)
        self._layout = KeyboardLayoutUS(self._keyboard)
        self._delay = max(0, key_delay_ms) / 1000.0
        self._action_delay = max(0, action_delay_ms) / 1000.0

    def set_delays(self, key_delay_ms=None, action_delay_ms=None):
        if key_delay_ms is not None:
            self._delay = max(0, key_delay_ms) / 1000.0
        if action_delay_ms is not None:
            self._action_delay = max(0, action_delay_ms) / 1000.0

    def set_key_delay(self, key_delay_ms):
        self.set_delays(key_delay_ms=key_delay_ms)

    def type_text(self, text):
        for ch in text:
            try:
                self._layout.write(ch)
            except ValueError:
                # znak bez keycode w ukladzie US - pomin, nie przerywaj
                print("HID: pominiety znak", repr(ch))
            if self._delay:
                time.sleep(self._delay)

    def press_key(self, name):
        code = KEYMAP.get(name)
        if code is None:
            print("HID: nieznany klawisz", name)
            return
        self._keyboard.send(code)
        # dodatkowa pauza po klawiszu akcji (TAB/ENTER/...) - starsze
        # aplikacje potrzebuja czasu na zmiane fokusu / obsluge zdarzenia
        if self._action_delay:
            time.sleep(self._action_delay)
        elif self._delay:
            time.sleep(self._delay)

    def run_actions(self, actions):
        for action in actions:
            kind = action.get("type")
            if kind == "text":
                self.type_text(action.get("value", ""))
            elif kind == "key":
                self.press_key(action.get("key", ""))
            else:
                print("HID: nieznana akcja", kind)
