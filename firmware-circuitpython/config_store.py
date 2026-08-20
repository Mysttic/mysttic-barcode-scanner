# Ladowanie, WALIDACJA (Etap 4) i trwaly zapis konfiguracji w NVM (Etap 6).
# Priorytet zrodel: NVM -> /default_config.json -> DEFAULTS.
# Firmware NIGDY nie zapisuje systemu plikow widocznego dla komputera
# (ochrona FAT) - zapis trwaly idzie do microcontroller.nvm z naglowkiem:
#   magic "BC" (2B) + wersja (1B) + dlugosc (2B) + CRC16 payloadu (2B) + JSON.
# Po zapisie dane sa odczytywane ponownie i weryfikowane.
import json

from keys import KEY_NAMES

CONFIG_PATH = "/default_config.json"
MAX_CONFIG_BYTES = 16 * 1024

NVM_MAGIC = b"BC"
NVM_VERSION = 1
_NVM_HEADER_LEN = 7


def _crc16(data):
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def _default_nvm():
    try:
        import microcontroller

        return microcontroller.nvm
    except (ImportError, AttributeError):
        return None


def save_to_nvm(config, nvm=None):
    """Zapis + weryfikacja. Zwraca None przy sukcesie albo opis bledu."""
    nvm = _default_nvm() if nvm is None else nvm
    if nvm is None:
        return "NVM niedostepny na tej plytce"
    try:
        payload = json.dumps(config).encode("utf-8")
    except (TypeError, ValueError) as e:
        return "konfiguracja nieserializowalna: " + str(e)
    blob = (
        NVM_MAGIC
        + bytes([NVM_VERSION])
        + bytes([(len(payload) >> 8) & 0xFF, len(payload) & 0xFF])
        + bytes([(_crc16(payload) >> 8) & 0xFF, _crc16(payload) & 0xFF])
        + payload
    )
    if len(blob) > len(nvm):
        return "konfiguracja za duza do NVM: " + str(len(blob)) + " > " + str(len(nvm)) + " B"
    nvm[0 : len(blob)] = blob
    if bytes(nvm[0 : len(blob)]) != blob:
        return "weryfikacja zapisu NVM nieudana"
    return None


def load_from_nvm(nvm=None):
    """Zwraca dict konfiguracji z NVM albo None (brak/uszkodzona)."""
    nvm = _default_nvm() if nvm is None else nvm
    if nvm is None or len(nvm) < _NVM_HEADER_LEN:
        return None
    if bytes(nvm[0:2]) != NVM_MAGIC or nvm[2] != NVM_VERSION:
        return None
    length = (nvm[3] << 8) | nvm[4]
    crc = (nvm[5] << 8) | nvm[6]
    if length == 0 or _NVM_HEADER_LEN + length > len(nvm):
        return None
    payload = bytes(nvm[_NVM_HEADER_LEN : _NVM_HEADER_LEN + length])
    if _crc16(payload) != crc:
        return None
    try:
        data = json.loads(payload)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def clear_nvm(nvm=None):
    nvm = _default_nvm() if nvm is None else nvm
    if nvm is None:
        return "NVM niedostepny na tej plytce"
    nvm[0:2] = b"\x00\x00"
    return None

DEFAULTS = {
    "version": 1,
    "device": {"keyboardLayout": "US", "keyDelayMs": 10},
    "scanner": {"baudrate": 9600, "terminators": ["0D", "0A"], "frameTimeoutMs": 250},
    "output": {"mode": "passthrough", "suffixKey": "ENTER"},
    "profiles": [],
}

_ALLOWED_DETECT = ("regex",)
_ALLOWED_PARSE = ("regexGroups",)
_ALLOWED_OUTPUT = ("field", "key", "text")


def _merge(base, override):
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


def _check_pattern(pattern, where, errors):
    if not isinstance(pattern, str) or not pattern:
        errors.append(where + ": brak wzorca regex")
        return
    if "{" in pattern or "}" in pattern:
        errors.append(
            where + ": kwantyfikatory {m,n} nie sa wspierane w CircuitPython re - rozpisz jawnie"
        )
        return
    try:
        import re

        re.compile(pattern)
    except Exception as e:
        errors.append(where + ": bledny regex (" + str(e) + ")")


def validate(config):
    """Zwraca liste bledow (pusta = konfiguracja poprawna)."""
    errors = []
    if not isinstance(config, dict):
        return ["konfiguracja nie jest obiektem JSON"]
    if config.get("version") != 1:
        errors.append("nieobslugiwana wersja konfiguracji: " + str(config.get("version")))

    device = config.get("device", {})
    if not isinstance(device.get("keyDelayMs", 10), int) or not 0 <= device.get("keyDelayMs", 10) <= 500:
        errors.append("device.keyDelayMs: oczekiwane 0-500 ms")

    scanner = config.get("scanner", {})
    if scanner.get("baudrate", 9600) not in (1200, 4800, 9600, 14400, 19200, 38400, 57600, 115200):
        errors.append("scanner.baudrate: niedozwolona wartosc")

    out = config.get("output", {})
    if out.get("mode", "passthrough") not in ("passthrough", "split"):
        errors.append("output.mode: dozwolone passthrough/split")
    if out.get("suffixKey") and out.get("suffixKey") not in KEY_NAMES:
        errors.append("output.suffixKey: nieznany klawisz " + str(out.get("suffixKey")))

    names = []
    profiles = config.get("profiles", [])
    if not isinstance(profiles, list):
        errors.append("profiles: oczekiwana lista")
        profiles = []
    for idx, profile in enumerate(profiles):
        where = "profiles[" + str(idx) + "]"
        if not isinstance(profile, dict):
            errors.append(where + ": oczekiwany obiekt")
            continue
        name = profile.get("name")
        if not name:
            errors.append(where + ": brak nazwy")
        elif name in names:
            errors.append(where + ": zdublowana nazwa '" + str(name) + "'")
        else:
            names.append(name)

        detect = profile.get("detect", {})
        if detect.get("type") not in _ALLOWED_DETECT:
            errors.append(where + ".detect.type: dozwolone " + str(_ALLOWED_DETECT))
        else:
            _check_pattern(detect.get("pattern"), where + ".detect", errors)

        parse = profile.get("parse", {})
        field_names = []
        if parse.get("type") not in _ALLOWED_PARSE:
            errors.append(where + ".parse.type: dozwolone " + str(_ALLOWED_PARSE))
        else:
            if parse.get("pattern"):
                _check_pattern(parse.get("pattern"), where + ".parse", errors)
            fields = parse.get("fields", {})
            if not isinstance(fields, dict) or not fields:
                errors.append(where + ".parse.fields: oczekiwana niepusta mapa pole->grupa")
            else:
                field_names = list(fields.keys())
                for fname, group in fields.items():
                    if not isinstance(group, int) or group < 1:
                        errors.append(where + ".parse.fields." + str(fname) + ": numer grupy >= 1")

        output = profile.get("output", [])
        if not isinstance(output, list) or not output:
            errors.append(where + ".output: oczekiwana niepusta lista akcji")
            output = []
        for aidx, action in enumerate(output):
            awhere = where + ".output[" + str(aidx) + "]"
            kind = action.get("type") if isinstance(action, dict) else None
            if kind not in _ALLOWED_OUTPUT:
                errors.append(awhere + ".type: dozwolone " + str(_ALLOWED_OUTPUT))
            elif kind == "field" and action.get("name") not in field_names:
                errors.append(awhere + ": pole '" + str(action.get("name")) + "' nie istnieje w parse.fields")
            elif kind == "key" and action.get("key") not in KEY_NAMES:
                errors.append(awhere + ": nieznany klawisz " + str(action.get("key")))
    return errors


def load(skip_file=False, nvm=None):
    """Zwraca (config, komunikaty). Priorytet: NVM -> plik -> DEFAULTS.
    Przy bledach dziala na DEFAULTS (nigdy petla restartow)."""
    if skip_file:
        return dict(DEFAULTS), ["factory reset: pominieto NVM i plik konfiguracji"]

    data = load_from_nvm(nvm)
    source = "NVM"
    messages = []
    if data is None:
        source = "plik"
        try:
            with open(CONFIG_PATH) as f:
                raw = f.read(MAX_CONFIG_BYTES + 1)
        except OSError as e:
            return dict(DEFAULTS), ["config: brak NVM i pliku, uzywam domyslnych (" + str(e) + ")"]
        if len(raw) > MAX_CONFIG_BYTES:
            return dict(DEFAULTS), ["config: plik wiekszy niz " + str(MAX_CONFIG_BYTES) + " B"]
        try:
            data = json.loads(raw)
        except ValueError as e:
            return dict(DEFAULTS), ["config: bledny JSON (" + str(e) + ")"]

    merged = _merge(DEFAULTS, data)
    errors = validate(merged)
    if errors:
        return dict(DEFAULTS), ["config: odrzucona (" + source + "), uzywam domyslnych"] + errors
    return merged, messages + ["config: zrodlo=" + source]


def terminators_as_bytes(config):
    vals = []
    for t in config.get("scanner", {}).get("terminators", []):
        try:
            vals.append(int(t, 16))
        except (ValueError, TypeError):
            pass
    return tuple(vals) if vals else (0x0D, 0x0A)
