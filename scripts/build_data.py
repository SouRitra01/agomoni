#!/usr/bin/env python3
"""Convert the editable CSVs in /data into the JSON the site reads.

Workflow: edit data in Google Sheets -> File > Download > CSV -> replace the
file in /data -> run:  python3 scripts/build_data.py
"""
import csv, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "data", ROOT / "public" / "data"
NUM = {"lat", "lng", "heritage", "theme", "grand", "quiet", "food", "family", "crowd", "seq"}
TYPES = {"sabeki", "theme", "bonedi", "heritage"}
CITIES = {"kolkata", "bengaluru"}


def load(name):
    rows = []
    with open(SRC / f"{name}.csv", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f), start=2):
            r = {k.strip(): (v or "").strip() for k, v in r.items() if k}
            for k in NUM & r.keys():
                if r[k] == "":
                    r[k] = None
                    continue
                try:
                    r[k] = float(r[k]) if k in {"lat", "lng"} or "." in r[k] else int(r[k])
                except ValueError:
                    sys.exit(f"{name}.csv line {i}: '{k}' is not a number: {r[k]!r}")
            if "verified" in r:
                r["verified"] = r["verified"].lower() in {"yes", "y", "true", "1"}
            rows.append(r)
    return rows


def check_pandals(rows):
    seen = set()
    for r in rows:
        pid = r["id"]
        assert pid not in seen, f"duplicate id {pid}"
        seen.add(pid)
        assert r["city"] in CITIES, f"{pid}: city must be one of {CITIES}"
        assert r["type"] in TYPES, f"{pid}: type must be one of {TYPES}"
        assert 1 <= (r["crowd"] or 0) <= 4, f"{pid}: crowd must be 1-4"
        lat, lng = r["lat"], r["lng"]
        box = (22.3, 22.8, 88.2, 88.6) if r["city"] == "kolkata" else (12.7, 13.2, 77.4, 77.9)
        assert box[0] < lat < box[1] and box[2] < lng < box[3], f"{pid}: lat/lng outside {r['city']}"
        for k in ("heritage", "theme", "grand", "quiet", "food", "family"):
            assert 0 <= r[k] <= 1, f"{pid}: {k} must be between 0 and 1"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    pandals, metro, food = load("pandals"), load("metro"), load("food")
    check_pandals(pandals)
    bundle = {"pandals": pandals, "metro": metro, "food": food}
    (OUT / "data.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    by_city = {c: sum(p["city"] == c for p in pandals) for c in CITIES}
    print(f"OK - pandals {by_city}, metro {len(metro)}, food {len(food)} -> public/data/data.json")
