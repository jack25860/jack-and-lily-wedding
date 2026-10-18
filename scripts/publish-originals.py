#!/usr/bin/env python3
"""Publish the retouched originals into stable public asset names.

Reads the archive DIRECTLY with zipfile (shell `unzip` mangles the UTF-8
Chinese folder names on the runner), and streams each member to disk unchanged.

Bytes are copied as-is: no decode, no re-encode, no resize. Only the FILENAME
changes, so every published asset is bit-identical to the deliverable.

Usage: publish-originals.py <archive.zip> [out_dir]
"""
import json
import os
import shutil
import sys
import zipfile

THEMES = {
    "戰國_导出_导出": "warring",
    "唐代_导出_导出": "tang",
    "明朝大婚_导出_导出": "ming",
}


def theme_of(path: str) -> str:
    for part in path.split("/"):
        slug = THEMES.get(part)
        if slug:
            return slug
    return ""


def main() -> None:
    archive = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "/tmp/out"
    os.makedirs(out_dir, exist_ok=True)

    groups = {}
    with zipfile.ZipFile(archive) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            if not name.lower().endswith((".jpg", ".jpeg")):
                continue
            slug = theme_of(name)
            if not slug:
                continue
            groups.setdefault(slug, []).append((os.path.basename(name), info))

        mapping = {}
        total = 0
        for slug, items in groups.items():
            items.sort(key=lambda x: x[0])
            for idx, (orig, info) in enumerate(items, 1):
                asset = f"{slug}-{idx:02d}.jpg"
                dst = os.path.join(out_dir, asset)
                with zf.open(info) as src, open(dst, "wb") as fh:
                    shutil.copyfileobj(src, fh, length=1024 * 1024)
                mapping[asset] = {
                    "zip_name": orig,
                    "theme": slug,
                    "bytes": os.path.getsize(dst),
                }
                total += os.path.getsize(dst)
            print(f"{slug}: {len(items)} photos")

    with open(os.path.join(out_dir, "mapping.json"), "w", encoding="utf-8") as fh:
        json.dump(mapping, fh, ensure_ascii=False, indent=1)

    print(f"TOTAL {len(mapping)} files, {total / 1073741824:.2f} GiB")
    if len(mapping) != 137:
        raise SystemExit(f"expected 137 photos, got {len(mapping)}")


if __name__ == "__main__":
    main()
