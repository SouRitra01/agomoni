#!/usr/bin/env python3
"""Build a self-contained preview copy (schematic map, no external map tiles) into ./preview."""
import pathlib, re, shutil
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "public", ROOT / "preview"
shutil.rmtree(OUT, ignore_errors=True); shutil.copytree(SRC, OUT)
h = (SRC / "index.html").read_text(encoding="utf-8")
h = re.sub(r"<!--LEAFLET_CSS-->.*?<!--/LEAFLET_CSS-->\n?", "", h, flags=re.S)
h = re.sub(r'<script src="https://cdnjs[^"]*leaflet[^"]*" defer></script>\n?', "", h)
h = h.replace('<script src="js/config.js" defer></script>', '<script src="js/config.js" defer></script>\n<script src="js/preview.js" defer></script>')
h = re.sub(r"<!doctype html>\s*<html[^>]*>\s*<head>\s*", "", h, flags=re.I)
h = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', "", h)
h = re.sub(r"</head>\s*<body>\s*", "", h); h = re.sub(r"</body>\s*</html>\s*$", "", h)
(OUT / "index.html").write_text(h, encoding="utf-8")
(OUT / "js" / "preview.js").write_text("window.SITE.schematicMap = true;\n", encoding="utf-8")
print("preview ->", OUT)
