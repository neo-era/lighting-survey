"""Chuẩn hoá symlib.json: dời gốc mỗi block về điểm neo (tâm trụ / tâm bbox), cập nhật điểm chèn block con.
Ghi symlib_norm.json: {blocks:{name:{prims,anchor,default_scale}}, ...}"""
import json, math, sys

src = json.load(open(sys.argv[1]))
B = src['blocks']
stats = src['insert_stats']
COMBOS = ['HPS - BETON', 'LED - BETON', 'HPS - STK', 'LED - STK']


def bbox(prims):
    xs, ys = [], []
    for p in prims:
        t = p[0]
        if t == 'L': xs += [p[1], p[3]]; ys += [p[2], p[4]]
        elif t in ('C', 'A'): xs += [p[1] - p[3], p[1] + p[3]]; ys += [p[2] - p[3], p[2] + p[3]]
        elif t == 'S': xs += [p[1], p[3], p[5]]; ys += [p[2], p[4], p[6]]
        elif t == 'T': xs += [p[1], p[1] + p[3] * 0.6 * len(p[5])]; ys += [p[2], p[2] + p[3]]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 0, 0)


def anchor(name, prims):
    circ = [p for p in prims if p[0] == 'C']
    if name.startswith('Tru') and circ:
        c = max(circ, key=lambda p: p[3])
        return (c[1], c[2])
    x0, y0, x1, y1 = bbox(prims)
    return ((x0 + x1) / 2, (y0 + y1) / 2)


def shift(prims, cx, cy):
    out = []
    for p in prims:
        t = p[0]
        if t == 'L': out.append(['L', p[1] - cx, p[2] - cy, p[3] - cx, p[4] - cy])
        elif t == 'C': out.append(['C', p[1] - cx, p[2] - cy, p[3]])
        elif t == 'A': out.append(['A', p[1] - cx, p[2] - cy, p[3], p[4], p[5]])
        elif t == 'S': out.append(['S', p[1] - cx, p[2] - cy, p[3] - cx, p[4] - cy, p[5] - cx, p[6] - cy])
        elif t == 'T': out.append(['T', p[1] - cx, p[2] - cy, p[3], p[4], p[5]])
        else: out.append(p)
    return out


R = lambda v: round(v, 4)


def rnd(prims):
    return [[x if isinstance(x, str) else R(x) for x in p] for p in prims]


anc = {}
out = {}
# 1) block lá (không phải combo): dời về neo
for n, prims in B.items():
    if n in COMBOS:
        continue
    cx, cy = anchor(n, prims)
    anc[n] = (cx, cy)
    out[n] = {'prims': rnd(shift(prims, cx, cy))}
# 2) combo: điểm chèn con mới = ins + s*(neo con); rồi dời combo về tâm trụ
for n in COMBOS:
    kids = []
    for p in B[n]:
        if p[0] != 'I':
            continue
        _, cn, ix, iy, sx, sy, rot = p
        ax, ay = anc[cn]
        r = math.radians(rot)
        kx = ix + sx * (ax * math.cos(r) - ay * math.sin(r))
        ky = iy + sy * (ax * math.sin(r) + ay * math.cos(r))
        kids.append(['I', cn, kx, ky, sx, sy, rot])
    pole = next(k for k in kids if k[1].startswith('Tru'))
    px, py = pole[2], pole[3]
    out[n] = {'prims': rnd([['I', k[1], k[2] - px, k[3] - py, k[4], k[5], k[6]] for k in kids])}
# 3) tỉ lệ chèn mặc định = trung vị trong bản vẽ gốc (đơn vị gốc = m @ 1:1000)
for n in out:
    s = stats.get(n, {})
    out[n]['default_scale'] = s.get('scale_median') or 1.0
    out[n]['src_inserts'] = s.get('n', 0)

json.dump({'source': 'Bản vẽ bố trí 2026-2029.QBT.dwg', 'blocks': out}, open(sys.argv[2], 'w'), ensure_ascii=False)
for n, v in out.items():
    print(f"{n:22s} scale={v['default_scale']} n_src={v['src_inserts']} bbox={tuple(R(x) for x in bbox(v['prims']))}")
