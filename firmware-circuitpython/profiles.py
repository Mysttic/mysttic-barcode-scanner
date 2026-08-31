# Profile kodow: detekcja -> parsowanie do nazwanych pol -> lista akcji.
# Typy parsowania:
#   regexGroups - wzorzec z grupami, mapa pole->numer grupy
#   gs1         - parser GS1 (AI 01/17/10/21), pola: gtin, expiry,
#                 expiryISO, batch, serial (patrz parser_gs1.py)
# UWAGA na CircuitPython: modul `re` to okrojone ure - BEZ kwantyfikatorow
# {m,n}. Walidator w config_store odrzuca wzorce z klamrami.
import re

import parser_gs1

GS1_FIELD_NAMES = ("gtin", "expiry", "expiryISO", "batch", "serial")


def match_profile(text, config, raw=None):
    """Zwraca (profil, pola, blad_parsowania).
    blad_parsowania=True, gdy jakis wlaczony profil wykryl kod (detect),
    ale nie dal sie sparsowac - o reakcji decyduje output.onError."""
    had_parse_error = False
    for profile in config.get("profiles", []):
        if not profile.get("enabled", False):
            continue
        detect = profile.get("detect", {})
        if detect.get("type") != "regex":
            continue
        try:
            if not re.match(detect.get("pattern", ""), text):
                continue
        except Exception as e:  # zly regex nie moze zawiesic petli
            print("profil", profile.get("name"), "- blad regex detect:", e)
            continue
        fields = _parse_fields(text, profile, detect, raw)
        if fields is None:
            had_parse_error = True
            continue
        return profile, fields, False
    return None, None, had_parse_error


def _parse_fields(text, profile, detect, raw):
    parse = profile.get("parse", {})
    ptype = parse.get("type")
    if ptype == "gs1":
        source = raw if raw is not None else text.encode("ascii")
        fields, aim, error = parser_gs1.parse(source)
        if error:
            print("profil", profile.get("name"), "- GS1:", error)
            return None
        if aim:
            fields["aim"] = aim
        return fields
    if ptype != "regexGroups":
        return {}
    pattern = parse.get("pattern") or detect.get("pattern", "")
    try:
        m = re.match(pattern, text)
    except Exception as e:
        print("profil", profile.get("name"), "- blad regex parse:", e)
        return None
    if not m:
        return None
    fields = {}
    for name, group_no in parse.get("fields", {}).items():
        try:
            fields[name] = m.group(int(group_no))
        except (IndexError, ValueError):
            print("profil", profile.get("name"), "- brak grupy", group_no, "dla pola", name)
            return None
    return fields


def build_output_actions(profile, fields):
    """Buduje liste akcji {"type":"text"/"key"} z definicji output profilu."""
    actions = []
    for item in profile.get("output", []):
        kind = item.get("type")
        if kind == "field":
            value = fields.get(item.get("name", ""))
            if value:
                actions.append({"type": "text", "value": value})
        elif kind == "text":
            actions.append({"type": "text", "value": item.get("value", "")})
        elif kind == "key":
            actions.append({"type": "key", "key": item.get("key", "")})
    return actions
