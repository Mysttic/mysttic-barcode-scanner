# Profile kodow: detekcja -> parsowanie do nazwanych pol -> lista akcji.
# Trzy jawne kroki (Etap 4):
#   1. detect: {"type": "regex", "pattern": "^...$"}
#   2. parse:  {"type": "regexGroups", "pattern": "^(...)(...)$",
#               "fields": {"nazwa": nr_grupy}}
#      (gdy parse nie ma "pattern", uzywany jest wzorzec z detect)
#   3. output: [{"type": "field", "name": "..."}, {"type": "key", "key": "TAB"},
#               {"type": "text", "value": "..."}]
#
# UWAGA na CircuitPython: modul `re` to okrojone ure - BEZ kwantyfikatorow
# {m,n}. Walidator w config_store odrzuca wzorce z klamrami.
import re


def match_profile(text, config):
    """Zwraca (profil, pola) pierwszego pasujacego wlaczonego profilu albo (None, None)."""
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
        fields = _parse_fields(text, profile, detect)
        if fields is None:
            continue
        return profile, fields
    return None, None


def _parse_fields(text, profile, detect):
    parse = profile.get("parse", {})
    if parse.get("type") != "regexGroups":
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
