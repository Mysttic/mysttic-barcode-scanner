# Etap 5: petla glowna - skaner + HID + kanal konfiguracyjny CDC (NDJSON).
# Tryby: "hid" (skan -> klawiatura) i "test" (skan -> event JSON po CDC,
# nic nie idzie do klawiatury).
import binascii
import time

import board
import busio
import digitalio
import microcontroller
import usb_cdc

import config_store
import output_hid
import parser
import profiles as profiles_mod
from protocol_cdc import CdcProtocol
from scanner_uart import ScannerUart
from version import FIRMWARE_VERSION

# Factory reset (Etap 4): przycisk na GP2 wcisniety przy starcie ~1 s.
_btn = digitalio.DigitalInOut(board.GP2)
_btn.direction = digitalio.Direction.INPUT
_btn.pull = digitalio.Pull.UP
_skip_config = False
if not _btn.value:
    time.sleep(1.0)
    _skip_config = not _btn.value
_btn.deinit()

config, config_errors = config_store.load(skip_file=_skip_config)
for err in config_errors:
    print(err)

uart = busio.UART(
    tx=board.GP0,
    rx=board.GP1,
    baudrate=config["scanner"]["baudrate"],
    timeout=0.05,
)
scanner = ScannerUart(
    uart,
    terminators=config_store.terminators_as_bytes(config),
    frame_timeout=config["scanner"]["frameTimeoutMs"] / 1000.0,
)
hid = output_hid.HidOutput(
    key_delay_ms=config["device"]["keyDelayMs"],
    action_delay_ms=config["device"].get("actionDelayMs", 30),
)

led = digitalio.DigitalInOut(board.GP6)
led.direction = digitalio.Direction.OUTPUT

mode = "hid"  # "hid" | "test"
_last_frame = None
_last_frame_t = 0.0


def _apply_config(new_config):
    """Aktywuje zwalidowana konfiguracje w RAM (scanner + HID)."""
    global config
    config = new_config
    scanner.reconfigure(
        terminators=config_store.terminators_as_bytes(config),
        frame_timeout=config["scanner"]["frameTimeoutMs"] / 1000.0,
    )
    hid.set_delays(
        key_delay_ms=config["device"]["keyDelayMs"],
        action_delay_ms=config["device"].get("actionDelayMs", 30),
    )


def cmd_get_config(request):
    return {"config": config}


def cmd_set_config(request):
    data = request.get("config")
    if not isinstance(data, dict):
        return {"ok": False, "error": "brak pola config"}
    merged = config_store._merge(config_store.DEFAULTS, data)
    errors = config_store.validate(merged)
    if errors:
        return {"ok": False, "error": "walidacja", "details": errors}
    _apply_config(merged)
    return {"applied": True, "persisted": False}


def cmd_save(request):
    err = config_store.save_to_nvm(config)
    if err:
        return {"ok": False, "error": err}
    return {"persisted": True}


def cmd_reboot(request):
    _deferred["reset"] = True
    return {"rebooting": True}


def cmd_set_mode(request):
    global mode
    wanted = request.get("mode")
    if wanted not in ("hid", "test"):
        return {"ok": False, "error": "mode: dozwolone hid/test"}
    mode = wanted
    return {"mode": mode}


def cmd_factory_reset(request):
    err = config_store.clear_nvm()
    _apply_config(dict(config_store.DEFAULTS))
    if err:
        return {"applied": True, "nvmCleared": False, "error": err, "ok": False}
    return {"applied": True, "nvmCleared": True}


def cmd_reboot_bootloader(request):
    # odpowiedz poleci przed resetem (send jest synchroniczne)
    microcontroller.on_next_reset(microcontroller.RunMode.UF2)
    _deferred["reset"] = True
    return {"rebooting": True}


def cmd_ping(request):
    return {"pong": True, "mode": mode, "version": 1, "fw": FIRMWARE_VERSION}


_deferred = {"reset": False}
protocol = CdcProtocol(
    usb_cdc.data,
    {
        "ping": cmd_ping,
        "getConfig": cmd_get_config,
        "setConfig": cmd_set_config,
        "save": cmd_save,
        "setMode": cmd_set_mode,
        "factoryReset": cmd_factory_reset,
        "reboot": cmd_reboot,
        "rebootBootloader": cmd_reboot_bootloader,
    },
)

print(
    "Czytnik gotowy: fw", FIRMWARE_VERSION, "|", config["scanner"]["baudrate"],
    "bps | tryb:", mode, "| CDC:", "aktywny" if usb_cdc.data else "BRAK",
)

while True:
    protocol.poll()
    if _deferred["reset"]:
        time.sleep(0.2)
        microcontroller.reset()

    frame = scanner.poll()
    if frame:
        # Blokada duplikatow (Etap 9): w trybie induction skaner ponawia
        # odczyt tego samego kodu trzymanego przed okiem.
        now = time.monotonic()
        block_ms = config["scanner"].get("duplicateBlockMs", 0)
        if block_ms and frame == _last_frame and (now - _last_frame_t) * 1000 < block_ms:
            _last_frame_t = now  # kod wciaz przed okiem - odswiez okno blokady
            frame = None
    if frame:
        _last_frame = frame
        _last_frame_t = time.monotonic()
        print("SKAN HEX:", frame.hex())
        if mode == "test":
            text = parser._decode_ascii(frame)
            profile, fields = (None, None)
            if text:
                profile, fields, _ = profiles_mod.match_profile(text, config, raw=frame)
            protocol.send(
                {
                    "event": "scan",
                    "rawBase64": binascii.b2a_base64(frame).decode("ascii").strip(),
                    "hex": frame.hex(),
                    "profile": profile.get("name") if profile else None,
                    "fields": fields or {},
                }
            )
            led.value = not led.value
        else:
            actions = parser.build_actions(frame, config)
            if actions:
                hid.run_actions(actions)
                led.value = not led.value
            else:
                print("Pusta/nie-ASCII ramka - pominieta")
    time.sleep(0.005)
