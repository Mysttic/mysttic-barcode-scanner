#!/usr/bin/env python3
"""Generator obrazu dysku FAT12 wbudowywanego w firmware C (USB MSC, tylko-do-odczytu).

Uzycie:
  python make_msc_image.py --out msc_image.c --label CZYTNIK \
      --file konfigurator.html=../configurator/dist/index.html \
      --file INSTRUKCJA.md=../firmware-pico-sdk/msc_files/INSTRUKCJA.md

Obraz jest deterministyczny (stale znaczniki czasu) - ta sama zawartosc wejsciowa
daje identyczny bajt w bajt wynik. Po zbudowaniu obraz jest parsowany z powrotem
i pliki porownywane bajt w bajt (samotest); przy niezgodnosci skrypt konczy sie bledem.
"""
import argparse
import struct
import sys

SECTOR = 512
SECTORS_PER_CLUSTER = 1
RESERVED_SECTORS = 1
NUM_FATS = 2
ROOT_ENTRIES = 128          # 128 * 32 B = 8 sektorow
TOTAL_SECTORS = 512         # 256 KB
FAT_SECTORS = 2             # (klastry+2)*1.5 B ~= 752 B -> 2 sektory
ROOT_SECTORS = ROOT_ENTRIES * 32 // SECTOR
DATA_START = RESERVED_SECTORS + NUM_FATS * FAT_SECTORS + ROOT_SECTORS
DATA_CLUSTERS = TOTAL_SECTORS - DATA_START
# staly znacznik czasu (deterministyczny build): 2026-01-01 12:00:00
DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
DOS_TIME = (12 << 11) | (0 << 5) | 0


def boot_sector(label):
    bs = bytearray(SECTOR)
    bs[0:3] = b"\xEB\x3C\x90"                       # jmp
    bs[3:11] = b"MSWIN4.1"                           # OEM
    struct.pack_into("<H", bs, 11, SECTOR)           # bajty/sektor
    bs[13] = SECTORS_PER_CLUSTER
    struct.pack_into("<H", bs, 14, RESERVED_SECTORS)
    bs[16] = NUM_FATS
    struct.pack_into("<H", bs, 17, ROOT_ENTRIES)
    struct.pack_into("<H", bs, 19, TOTAL_SECTORS)    # <65536 -> pole 16-bit
    bs[21] = 0xF8                                    # media: dysk staly
    struct.pack_into("<H", bs, 22, FAT_SECTORS)
    struct.pack_into("<H", bs, 24, 32)               # sektory/sciezke (dowolne)
    struct.pack_into("<H", bs, 26, 2)                # glowice (dowolne)
    bs[38] = 0x29                                    # rozszerzony boot signature
    struct.pack_into("<I", bs, 39, 0x20260101)       # numer seryjny woluminu (staly)
    bs[43:54] = label.ljust(11)[:11].encode("ascii")
    bs[54:62] = b"FAT12   "
    bs[510:512] = b"\x55\xAA"
    return bytes(bs)


def short_name_for(name, taken):
    """8.3 dla wpisu katalogu; ~N gdy nazwa nie miesci sie w 8.3."""
    if "." in name:
        base, _, ext = name.rpartition(".")
    else:
        base, ext = name, ""
    base_c = "".join(c for c in base.upper() if c.isalnum() or c in "_-")[:8] or "PLIK"
    ext_c = "".join(c for c in ext.upper() if c.isalnum())[:3]
    fits = (base_c == base.upper() and ext_c == ext.upper() and len(base) <= 8 and len(ext) <= 3)
    if fits and (base_c, ext_c) not in taken:
        taken.add((base_c, ext_c))
        return base_c, ext_c, False
    for i in range(1, 100):
        suf = "~" + str(i)
        cand = (base_c[: 8 - len(suf)] + suf, ext_c)
        if cand not in taken:
            taken.add(cand)
            return cand[0], cand[1], True
    raise SystemExit("za duzo kolizji nazw 8.3")


def sfn_bytes(base, ext):
    return (base.ljust(8) + ext.ljust(3)).encode("ascii")


def lfn_checksum(sfn11):
    s = 0
    for b in sfn11:
        s = (((s & 1) << 7) + (s >> 1) + b) & 0xFF
    return s


def lfn_entries(name, sfn11):
    """Wpisy Long File Name (od ostatniego do pierwszego), 13 znakow UTF-16 kazdy."""
    units = list(name.encode("utf-16-le"))
    units += [0x00, 0x00]                            # terminator NUL
    while len(units) % 26:
        units += [0xFF]                              # dopelnienie
    chunks = [bytes(units[i:i + 26]) for i in range(0, len(units), 26)]
    csum = lfn_checksum(sfn11)
    out = []
    for idx in range(len(chunks), 0, -1):
        ch = chunks[idx - 1]
        seq = idx | (0x40 if idx == len(chunks) else 0)
        e = bytearray(32)
        e[0] = seq
        e[1:11] = ch[0:10]
        e[11] = 0x0F                                 # atrybut LFN
        e[13] = csum
        e[14:26] = ch[10:22]
        e[28:32] = ch[22:26]
        out.append(bytes(e))
    return out


def dir_entry(sfn11, attr, first_cluster, size):
    e = bytearray(32)
    e[0:11] = sfn11
    e[11] = attr
    struct.pack_into("<H", e, 14, DOS_TIME)          # czas utworzenia
    struct.pack_into("<H", e, 16, DOS_DATE)
    struct.pack_into("<H", e, 18, DOS_DATE)          # ostatni dostep
    struct.pack_into("<H", e, 22, DOS_TIME)          # czas zapisu
    struct.pack_into("<H", e, 24, DOS_DATE)
    struct.pack_into("<H", e, 26, first_cluster)
    struct.pack_into("<I", e, 28, size)
    return bytes(e)


def build(files, label):
    fat = [0] * (DATA_CLUSTERS + 2)
    fat[0] = 0xF8 | 0xF00                            # media w FAT[0]
    fat[1] = 0xFFF
    data = bytearray(DATA_CLUSTERS * SECTOR * SECTORS_PER_CLUSTER)
    root = [dir_entry(label.ljust(11)[:11].encode("ascii"), 0x08, 0, 0)]
    state = {"next": 2}

    def alloc_chain(blob):
        clusters_needed = max(1, (len(blob) + SECTOR - 1) // SECTOR)
        first = state["next"]
        if first + clusters_needed - 2 > DATA_CLUSTERS:
            raise SystemExit("obraz za maly")
        for i in range(clusters_needed):
            cl = first + i
            fat[cl] = (cl + 1) if i < clusters_needed - 1 else 0xFFF
            off = (cl - 2) * SECTOR
            data[off:off + SECTOR] = blob[i * SECTOR:(i + 1) * SECTOR].ljust(SECTOR, b"\x00")
        state["next"] = first + clusters_needed
        return first

    def entries_for(name, sfn, attr, first, size, taken):
        out = []
        base, ext, needs_lfn = sfn
        raw = sfn_bytes(base, ext)
        plain = base + ("." + ext if ext else "")
        if needs_lfn or name not in (plain, plain.lower()):
            out += lfn_entries(name, raw)
        out.append(dir_entry(raw, attr, first, size))
        return out

    # pogrupuj wpisy: pliki w korzeniu i pliki w podkatalogach (jeden poziom)
    tree = {}
    for name, blob in files:
        if "/" in name:
            dirname, _, fname = name.partition("/")
            tree.setdefault(dirname, []).append((fname, blob))
        else:
            tree.setdefault(None, []).append((name, blob))

    taken_root = set()
    # najpierw podkatalogi (żeby znać ich klastry przed wpisem w korzeniu)
    for dirname in sorted(k for k in tree if k is not None):
        taken_sub = set()
        sub_entries = []
        # zawartość katalogu: pliki
        pending = []
        for fname, blob in tree[dirname]:
            first = alloc_chain(blob)
            pending.append((fname, short_name_for(fname, taken_sub), first, len(blob)))
        # katalog = łańcuch klastrów z wpisami "." ".." + pliki
        for fname, sfn, first, size in pending:
            sub_entries += entries_for(fname, sfn, 0x01 | 0x20, first, size, taken_sub)
        # rozmiar katalogu w klastrach (2 wpisy kropkowe + reszta)
        raw_entries = b"".join(sub_entries)
        dir_size = 64 + len(raw_entries)             # "." + ".." po 32 B
        dir_blob = bytearray(((dir_size + SECTOR - 1) // SECTOR) * SECTOR)
        dir_first = alloc_chain(bytes(dir_blob))
        dot = dir_entry(b".          ", 0x10, dir_first, 0)
        dotdot = dir_entry(b"..         ", 0x10, 0, 0)   # 0 = korzeń
        payload = dot + dotdot + raw_entries
        # wpisz zawartość katalogu do jego klastrów
        cl = dir_first
        off = 0
        while off < len(payload):
            chunk = payload[off:off + SECTOR]
            data[(cl - 2) * SECTOR:(cl - 2) * SECTOR + len(chunk)] = chunk
            off += SECTOR
            if off < len(payload):
                cl = fat[cl]
        root += entries_for(dirname, short_name_for(dirname, taken_root), 0x10, dir_first, 0, taken_root)

    for name, blob in tree.get(None, []):
        first = alloc_chain(blob)
        root += entries_for(name, short_name_for(name, taken_root), 0x01 | 0x20, first, len(blob), taken_root)

    if len(root) > ROOT_ENTRIES:
        raise SystemExit("za duzo wpisow w katalogu glownym")

    fat_raw = bytearray(FAT_SECTORS * SECTOR)
    for i in range(0, len(fat), 2):
        a = fat[i]
        b = fat[i + 1] if i + 1 < len(fat) else 0
        off = i * 3 // 2
        fat_raw[off] = a & 0xFF
        fat_raw[off + 1] = ((a >> 8) & 0x0F) | ((b & 0x0F) << 4)
        fat_raw[off + 2] = (b >> 4) & 0xFF

    root_raw = b"".join(root).ljust(ROOT_SECTORS * SECTOR, b"\x00")
    img = boot_sector(label) + bytes(fat_raw) * NUM_FATS + root_raw + bytes(data)
    assert len(img) == TOTAL_SECTORS * SECTOR
    return img


def parse_back(img):
    """Samotest: odczytaj pliki z obrazu wlasnym, niezaleznym parserem."""
    fat_off = RESERVED_SECTORS * SECTOR
    root_off = fat_off + NUM_FATS * FAT_SECTORS * SECTOR
    data_off = root_off + ROOT_SECTORS * SECTOR

    def fat_entry(n):
        off = fat_off + n * 3 // 2
        if n % 2 == 0:
            return img[off] | ((img[off + 1] & 0x0F) << 8)
        return (img[off] >> 4) | (img[off + 1] << 4)

    def read_chain(cl):
        blob = b""
        while 2 <= cl < 0xFF8:
            off = data_off + (cl - 2) * SECTOR
            blob += img[off:off + SECTOR]
            cl = fat_entry(cl)
        return blob

    def scan_entries(raw_entries, prefix, out):
        lfn_parts = {}
        for i in range(0, len(raw_entries), 32):
            e = raw_entries[i:i + 32]
            if len(e) < 32 or e[0] == 0x00:
                break
            if e[0] == 0xE5:
                lfn_parts = {}
                continue
            if e[11] == 0x0F:                        # wpis LFN
                lfn_parts[e[0] & 0x1F] = (e[1:11] + e[14:26] + e[28:32])
                continue
            if e[11] & 0x08:                         # etykieta woluminu
                lfn_parts = {}
                continue
            base = e[0:8].decode("ascii", "replace").rstrip()
            ext = e[8:11].decode("ascii", "replace").rstrip()
            if base in (".", ".."):
                lfn_parts = {}
                continue
            if lfn_parts:
                raw = b"".join(lfn_parts[k] for k in sorted(lfn_parts))
                name = raw.decode("utf-16-le").split("\x00")[0]
                lfn_parts = {}
            else:
                name = base + ("." + ext if ext else "")
            size = struct.unpack_from("<I", e, 28)[0]
            cl = struct.unpack_from("<H", e, 26)[0]
            if e[11] & 0x10:                         # podkatalog
                scan_entries(read_chain(cl), prefix + name + "/", out)
            else:
                out[prefix + name] = read_chain(cl)[:size]

    out = {}
    scan_entries(img[root_off:root_off + ROOT_ENTRIES * 32], "", out)
    return out


def emit_c(img, path):
    lines = [
        "// Plik generowany przez tools/make_msc_image.py - NIE edytowac recznie.",
        "// Obraz dysku FAT12 (tylko-do-odczytu) serwowany przez USB MSC.",
        "#include <stdint.h>",
        f"const uint32_t msc_image_size = {len(img)}u;",
        "const uint8_t msc_image[] __attribute__((aligned(4))) = {",
    ]
    for i in range(0, len(img), 16):
        chunk = img[i:i + 16]
        lines.append("  " + "".join(f"0x{b:02x}," for b in chunk))
    lines.append("};")
    with open(path, "w", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--label", default="CZYTNIK")
    ap.add_argument("--file", action="append", required=True,
                    help="nazwa_na_dysku=sciezka_zrodlowa")
    args = ap.parse_args()

    files = []
    for spec in args.file:
        name, _, src = spec.partition("=")
        with open(src, "rb") as f:
            files.append((name, f.read()))

    img = build(files, args.label)

    read_back = parse_back(img)
    for name, blob in files:
        if read_back.get(name) != blob:
            sys.exit(f"SAMOTEST NIE PRZESZEDL: {name} rozni sie po odczycie zwrotnym")

    emit_c(img, args.out)
    used = sum(len(b) for _, b in files)
    print(f"msc_image: {len(img)} B ({len(img)//1024} KB), pliki: {len(files)}, "
          f"dane: {used} B, wolne: ~{DATA_CLUSTERS*SECTOR - used} B, samotest OK")


if __name__ == "__main__":
    main()
