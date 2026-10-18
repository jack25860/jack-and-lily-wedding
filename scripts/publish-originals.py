#!/usr/bin/env python3
"""Copy the retouched originals into stable public asset names.

Bytes are copied with shutil.copyfile - no decode, no re-encode, no resize.
Only the FILENAME changes, so every published asset is bit-identical to the
photographer's deliverable.
"""
import json
import os
import shutil

SRC_ROOT = "/tmp/src"
OUT_DIR = "/tmp/out"

THEMES = {
    "戰國_导出_导出": "warring",
    "唐代_导出_导出": "tang",
    "明朝大婚_导出_导出": "ming",
}


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    mapping = {}
    total = 0

    for root, _dirs, files in os.walk(SRC_ROOT):
        folder = os.path.basename(root)
        slug = THEMES.get(folder)
        if not slug:
            continue
        jpgs = sorted(f for f in files if f.lower().endswith((".jpg", ".jpeg")))
        for idx, name in enumerate(jpgs, 1):
            asset = f"{slug}-{idx:02d}.jpg"
            dst = os.path.join(OUT_DIR, asset)
            shutil.copyfile(os.path.join(root, name), dst)
            mapping[asset] = {"zip_name": name, "theme": folder}
            total += os.path.getsize(dst)
        print(f"{folder}: {len(jpgs)} -> {slug}")

    with open(os.path.join(OUT_DIR, "mapping.json"), "w", encoding="utf-8") as fh:
        json.dump(mapping, fh, ensure_ascii=False, indent=1)

    print(f"TOTAL {len(mapping)} files, {total / 1073741824:.2f} GiB")
    if len(mapping) != 137:
        raise SystemExit(f"expected 137 photos, got {len(mapping)}")


if __name__ == "__main__":
    main()
