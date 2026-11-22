#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assert an MP4 has its moov atom before mdat (i.e. is web-faststart).

Usage: python3 scripts/check_faststart.py videos/trailer-1080p.mp4 [...]
Exits non-zero if any file is not faststart, so the workflow fails loudly.
"""

import os
import struct
import sys


def atom_order(path):
    size = os.path.getsize(path)
    order = []
    with open(path, "rb") as fh:
        off = 0
        while off < size:
            fh.seek(off)
            head = fh.read(8)
            if len(head) < 8:
                break
            length = struct.unpack(">I", head[:4])[0]
            name = head[4:8].decode("latin1")
            if length == 1:
                length = struct.unpack(">Q", fh.read(8))[0]
            elif length == 0:
                length = size - off
            order.append(name)
            if length <= 0:
                break
            off += length
    return order


def main(paths):
    bad = []
    for path in paths:
        order = atom_order(path)
        print("%s atoms: %s" % (path, order))
        if "moov" not in order or "mdat" not in order:
            bad.append("%s: missing moov or mdat" % path)
        elif order.index("moov") > order.index("mdat"):
            bad.append("%s: moov comes after mdat (not faststart)" % path)
        else:
            print("%s: faststart OK" % path)
    if bad:
        sys.stderr.write("\n".join("FAIL " + b for b in bad) + "\n")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
