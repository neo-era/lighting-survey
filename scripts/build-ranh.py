#!/usr/bin/env python3
"""
Sinh dữ liệu ranh hành chính phường/xã (admin_level=6) từ OpenStreetMap
→ data/ranh/<slug>.json để app dùng OFFLINE (không gọi Overpass lúc chạy).

Chạy:  python scripts/build-ranh.py
       python scripts/build-ranh.py --tolerance 8      # đơn giản hóa mạnh hơn (m)
       python scripts/build-ranh.py --only hcm

Sau 1/7/2025 VN sáp nhập còn 34 tỉnh; phường/xã map ở admin_level=6.
Chỉ chạy lại khi ranh giới hành chính thay đổi — không phải mỗi lần build app.
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

# Mirror Overpass — server chính (overpass-api.de) hay chặn IP khi query lớn.
MIRRORS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Tỉnh cần sinh dữ liệu. id = OSM relation id của tỉnh (admin_level=4).
PROVINCES = [
    {"slug": "hcm",     "id": 1973756, "label": "TP. Hồ Chí Minh"},
    {"slug": "tayninh", "id": 1898961, "label": "Tây Ninh"},
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "ranh")
COORD_PRECISION = 5          # 5 số lẻ ≈ 1.1m — thừa cho hiển thị bản đồ
DEFAULT_TOLERANCE_M = 5.0    # Douglas-Peucker, mét


def fetch_overpass(query, timeout=300):
    """POST query tới Overpass, tự đổi mirror khi lỗi."""
    body = urllib.parse.urlencode({"data": query}).encode()
    last_err = None
    for mirror in MIRRORS:
        try:
            print(f"    → {mirror.split('/')[2]} ...", end="", flush=True)
            req = urllib.request.Request(mirror, data=body,
                                         headers={"User-Agent": "lighting-survey/build-ranh"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8")
            if not raw.lstrip().startswith("{"):
                raise RuntimeError("không phải JSON (rate limit?)")
            print(" ok")
            return json.loads(raw)
        except Exception as e:
            print(f" lỗi: {e}")
            last_err = e
            time.sleep(3)
    raise RuntimeError(f"Tất cả mirror đều lỗi. Cuối: {last_err}")


def perp_dist(p, a, b):
    """Khoảng cách vuông góc từ p đến đoạn ab (đơn vị độ)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == 0 and dy == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def simplify(pts, tol):
    """Douglas-Peucker khử điểm thừa. Lặp (không đệ quy) để tránh tràn stack."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        dmax, idx = 0.0, i
        for k in range(i + 1, j):
            d = perp_dist(pts[k], pts[i], pts[j])
            if d > dmax:
                dmax, idx = d, k
        if dmax > tol:
            keep[idx] = True
            stack.append((i, idx))
            stack.append((idx, j))
    return [p for p, k in zip(pts, keep) if k]


def build_province(prov, tolerance_m):
    area_id = 3600000000 + prov["id"]
    query = (
        f'[out:json][timeout:300];'
        f'(relation["boundary"="administrative"]["admin_level"="6"](area:{area_id}););'
        f'out geom;'
    )
    print(f"  Tải {prov['label']} (area {area_id})")
    data = fetch_overpass(query)

    # Douglas-Peucker chạy trên toạ độ độ → quy đổi tolerance mét sang độ ở vĩ độ TB
    tol_deg = tolerance_m / 111320.0

    wards, pts_before, pts_after = [], 0, 0
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        segments, sum_lon, sum_lat, n = [], 0.0, 0.0, 0
        for m in el.get("members", []):
            if m.get("type") != "way" or m.get("role") != "outer" or "geometry" not in m:
                continue
            pts = [[g["lon"], g["lat"]] for g in m["geometry"]]
            pts_before += len(pts)
            for lon, lat in pts:
                sum_lon += lon
                sum_lat += lat
                n += 1
            pts = simplify(pts, tol_deg)
            pts_after += len(pts)
            if len(pts) >= 2:
                segments.append([[round(x, COORD_PRECISION), round(y, COORD_PRECISION)]
                                 for x, y in pts])

        if not segments or n == 0:
            continue
        wards.append({
            "n": name,
            "c": [round(sum_lon / n, COORD_PRECISION), round(sum_lat / n, COORD_PRECISION)],
            "g": segments,
        })

    wards.sort(key=lambda w: w["n"])
    out = {
        "province": prov["label"],
        "slug": prov["slug"],
        "level": 6,
        "toleranceM": tolerance_m,
        "generated": time.strftime("%Y-%m-%d"),
        "source": "OpenStreetMap (ODbL)",
        "wards": wards,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{prov['slug']}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    kb = os.path.getsize(path) / 1024
    saved = (1 - pts_after / pts_before) * 100 if pts_before else 0
    print(f"    {len(wards)} phường/xã · {pts_after:,} điểm "
          f"(giảm {saved:.0f}% từ {pts_before:,}) · {kb:.0f} KB → data/ranh/{prov['slug']}.json")
    return {"slug": prov["slug"], "label": prov["label"],
            "wards": len(wards), "sizeKB": round(kb)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tolerance", type=float, default=DEFAULT_TOLERANCE_M,
                    help="Douglas-Peucker tolerance (mét). Lớn hơn = file nhỏ hơn, ranh thô hơn.")
    ap.add_argument("--only", help="Chỉ sinh 1 tỉnh theo slug (vd: hcm)")
    args = ap.parse_args()

    targets = [p for p in PROVINCES if not args.only or p["slug"] == args.only]
    if not targets:
        sys.exit(f"Không có tỉnh nào khớp slug '{args.only}'")

    print(f"Sinh ranh phường/xã — tolerance {args.tolerance}m")
    index = []
    for prov in targets:
        index.append(build_province(prov, args.tolerance))

    # index.json để app biết có sẵn tỉnh nào mà không phải tải hết
    if not args.only:
        idx_path = os.path.join(OUT_DIR, "index.json")
        with open(idx_path, "w", encoding="utf-8") as f:
            json.dump({"generated": time.strftime("%Y-%m-%d"), "provinces": index},
                      f, ensure_ascii=False, indent=1)
        print(f"\n  index.json ← {len(index)} tỉnh")

    total = sum(p["sizeKB"] for p in index)
    print(f"\nXong. Tổng {total} KB.")


if __name__ == "__main__":
    main()
