# Parser GS1 (Etap 8): czyta kod od lewej wg tabeli AI.
# Pracuje na SUROWYCH bajtach (separator GS 0x1D musi przetrwac transport).
# Obslugiwane AI:
#   01 - GTIN, dokladnie 14 cyfr
#   17 - data waznosci YYMMDD, dokladnie 6 cyfr (+ pole pochodne expiryISO)
#   10 - number partii, 1-20 znakow, konczy sie GS albo koncem kodu
#   21 - numer seryjny, 1-20 znakow, konczy sie GS albo koncem kodu
# AIM ID (np. "]d2") jest zdejmowany z poczatku i zwracany jako metadana.

GS = 0x1D

_FIXED = {"01": ("gtin", 14, True), "17": ("expiry", 6, True)}
_VARIABLE = {"10": ("batch", 20), "21": ("serial", 20)}

_DAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


def _is_digits(data):
    for b in data:
        if not 0x30 <= b <= 0x39:
            return False
    return True


def date_to_iso(yymmdd):
    """YYMMDD -> YYYY-MM-DD. Dzien 00 = ostatni dzien miesiaca (regula farmaceutyczna)."""
    yy = int(yymmdd[0:2])
    mm = int(yymmdd[2:4])
    dd = int(yymmdd[4:6])
    year = 2000 + yy  # okno GS1: 00-50 -> 20xx (wystarczajace dla dat waznosci)
    if not 1 <= mm <= 12:
        return None
    if dd == 0:
        dd = _DAYS[mm - 1]
        if mm == 2 and (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)):
            dd = 29
    elif dd > 31:
        return None
    return "%04d-%02d-%02d" % (year, mm, dd)


def strip_aim(raw):
    """Zwraca (raw_bez_aim, aim_lub_None). AIM ID = ']' + litera + cyfra."""
    if len(raw) >= 3 and raw[0:1] == b"]":
        try:
            return raw[3:], raw[0:3].decode("ascii")
        except UnicodeError:
            return raw, None
    return raw, None


def parse(raw):
    """Zwraca (fields, aim, error). Przy bledzie fields=None, error=opis."""
    raw, aim = strip_aim(raw)
    fields = {}
    i = 0
    n = len(raw)
    while i < n:
        if raw[i] == GS:
            i += 1
            continue
        if i + 2 > n:
            return None, aim, "urwany AI na pozycji " + str(i)
        try:
            ai = raw[i : i + 2].decode("ascii")
        except UnicodeError:
            return None, aim, "nie-ASCII w AI na pozycji " + str(i)
        i += 2
        if ai in _FIXED:
            name, length, digits = _FIXED[ai]
            value = raw[i : i + length]
            if len(value) < length:
                return None, aim, "AI " + ai + ": oczekiwano " + str(length) + " znakow"
            if digits and not _is_digits(value):
                return None, aim, "AI " + ai + ": oczekiwano samych cyfr"
            i += length
        elif ai in _VARIABLE:
            name, max_len = _VARIABLE[ai]
            j = i
            while j < n and raw[j] != GS:
                j += 1
            value = raw[i:j]
            if not value:
                return None, aim, "AI " + ai + ": puste pole"
            if len(value) > max_len:
                return None, aim, "AI " + ai + ": za dlugie (>" + str(max_len) + ")"
            i = j
        else:
            return None, aim, "nieobslugiwany AI '" + ai + "' na pozycji " + str(i - 2)
        try:
            fields[name] = value.decode("ascii")
        except UnicodeError:
            return None, aim, "AI " + ai + ": znaki spoza ASCII"
        if name in fields and fields.get(name) is None:
            return None, aim, "AI " + ai + " zdublowany"
    if not fields:
        return None, aim, "pusty kod"
    if "expiry" in fields:
        iso = date_to_iso(fields["expiry"])
        if iso:
            fields["expiryISO"] = iso
    return fields, aim, None
