# Budowanie listy akcji wyjsciowych z surowych bajtow skanu.
# Format akcji (wspolny dla calego projektu):
#   {"type": "text", "value": "..."}   - wpisz tekst
#   {"type": "key", "key": "TAB"}      - nacisnij klawisz specjalny
# Kolejnosc: profile (detekcja -> pola -> akcje), potem fallback
# passthrough/split. Przy bledzie parsowania profilu decyduje output.onError:
#   "raw"  - wyslij kod 1:1 (domyslnie)
#   "skip" - pomin skan
import profiles as profiles_mod


def _decode_ascii(raw):
    try:
        text = raw.decode("ascii")
    except UnicodeError:  # CircuitPython nie ma UnicodeDecodeError
        return None
    return "".join(ch for ch in text if 32 <= ord(ch) < 127)


def build_actions(raw, config):
    """raw: surowe bajty ramki (bez terminatora). Zwraca liste akcji albo []."""
    text = _decode_ascii(raw)
    if not text:
        return []

    out = config.get("output", {})

    profile, fields, parse_error = profiles_mod.match_profile(text, config, raw=raw)
    if profile:
        actions = profiles_mod.build_output_actions(profile, fields)
        if actions:
            print("profil:", profile.get("name"), "| pola:", fields)
            return actions
    if parse_error and out.get("onError", "raw") == "skip":
        print("blad parsowania profilu - skan pominiety (onError=skip)")
        return []

    actions = []
    prefix = out.get("prefixText", "")
    if prefix:
        actions.append({"type": "text", "value": prefix})

    mode = out.get("mode", "passthrough")
    if mode == "split":
        pos = int(out.get("splitAt", 0))
        if 0 < pos < len(text):
            actions.append({"type": "text", "value": text[:pos]})
            actions.append({"type": "key", "key": "TAB"})
            actions.append({"type": "text", "value": text[pos:]})
        else:
            actions.append({"type": "text", "value": text})
    else:
        actions.append({"type": "text", "value": text})

    suffix_text = out.get("suffixText", "")
    if suffix_text:
        actions.append({"type": "text", "value": suffix_text})

    suffix = out.get("suffixKey", "ENTER")
    if suffix:
        actions.append({"type": "key", "key": suffix})
    return actions
