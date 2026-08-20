# Budowanie listy akcji wyjsciowych z surowych bajtow skanu.
# Format akcji (wspolny dla calego projektu):
#   {"type": "text", "value": "..."}   - wpisz tekst
#   {"type": "key", "key": "TAB"}      - nacisnij klawisz specjalny
# Etap 3: tryby "passthrough" (1:1) i "split" (pole1, TAB, pole2, ENTER).
# Profile z detekcja/regexem dochodza w Etapie 4.


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

    # Etap 4: najpierw profile (detekcja -> pola -> akcje), fallback nizej.
    import profiles as profiles_mod

    profile, fields = profiles_mod.match_profile(text, config)
    if profile:
        actions = profiles_mod.build_output_actions(profile, fields)
        if actions:
            print("profil:", profile.get("name"), "| pola:", fields)
            return actions

    out = config.get("output", {})
    mode = out.get("mode", "passthrough")
    actions = []

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

    suffix = out.get("suffixKey", "ENTER")
    if suffix:
        actions.append({"type": "key", "key": suffix})
    return actions
