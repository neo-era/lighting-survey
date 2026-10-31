"""Trích block đèn/trụ/tủ từ DWG -> thư viện ký hiệu R12 (LINE/ARC/CIRCLE/TEXT/INSERT), toạ độ tương đối base point.
Chạy: python3 -I extract_symlib.py <file.dwg> <out.json>
ELLIPSE -> đoạn thẳng; LWPOLYLINE (bulge) -> LINE/ARC; HATCH -> nét LINE theo pattern, cắt theo biên (even-odd); MTEXT -> TEXT.
"""
import sys, json, math, statistics
from collections import Counter, defaultdict
import aspose.cad as cad, aspose.pycore as pycore
import aspose.cad.fileformats.cad.cadobjects as co
from aspose.cad.fileformats.cad.cadobjects.hatch import CadHatch
from aspose.cad.fileformats.cad import CadImage

WANT = ['Den HPS', 'Den LED', 'Den MH', 'Den trang tri', 'DEN NGAM', 'SPOT LIGHT LED',
        'Tru BTLT', 'Tru STK', 'Tru trang tri',
        'HPS - BETON', 'LED - BETON', 'HPS - STK', 'LED - STK',
        'TTC', 'Tu dk KNTT', 'Tu dieu khien thuong', 'TDK_hienhuu', 'TDK CS']
SEG_FULL = 48  # số đoạn cho 1 vòng elip/cung khi rời rạc hoá


def cls(e):
    return str(e.get_type().full_name).split('.')[-1]


def P(p):
    return (float(p.x), float(p.y))


def arc_pts(cx, cy, r, a1, a2, ccw=True):
    """Điểm trên cung tròn từ a1->a2 (độ)."""
    if not ccw:
        a1, a2 = -a1, -a2
    sweep = (a2 - a1) % 360 or 360
    n = max(4, int(SEG_FULL * sweep / 360))
    pts = []
    for i in range(n + 1):
        a = math.radians(a1 + sweep * i / n)
        a = a if ccw else -a
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ellipse_pts(cx, cy, mx, my, ratio, t1, t2):
    """t1,t2 radian (tham số elip)."""
    sweep = (t2 - t1) % (2 * math.pi) or 2 * math.pi
    n = max(6, int(SEG_FULL * sweep / (2 * math.pi)))
    nx, ny = -my * ratio, mx * ratio  # trục phụ
    return [(cx + mx * math.cos(t1 + sweep * i / n) + nx * math.sin(t1 + sweep * i / n),
             cy + my * math.cos(t1 + sweep * i / n) + ny * math.sin(t1 + sweep * i / n)) for i in range(n + 1)]


def bulge_arc(p1, p2, b):
    """LWPOLYLINE bulge -> (cx,cy,r,a1,a2) cung CCW."""
    x1, y1 = p1; x2, y2 = p2
    th = 4 * math.atan(b)
    d = math.hypot(x2 - x1, y2 - y1)
    if d == 0:
        return None
    r = d / (2 * math.sin(th / 2))
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    h = r * math.cos(th / 2)
    ux, uy = (x2 - x1) / d, (y2 - y1) / d
    cx, cy = mx - uy * h, my + ux * h
    a1 = math.degrees(math.atan2(y1 - cy, x1 - cx))
    a2 = math.degrees(math.atan2(y2 - cy, x2 - cx))
    if b < 0:
        a1, a2 = a2, a1
    return (cx, cy, abs(r), a1, a2)


def bulge_pts(p1, p2, b):
    a = bulge_arc(p1, p2, b)
    if not a:
        return [p1, p2]
    cx, cy, r, a1, a2 = a
    pts = arc_pts(cx, cy, r, a1, a2, True)
    if b < 0:
        pts = pts[::-1]
    return pts


def hatch_loops(h):
    loops = []
    for bpc in h.boundary_paths:
        for bp in bpc.boundary_path:
            tn = type(bp).__name__
            pts = []
            if tn == 'CadPolylineBoundaryPath':
                vs = [P(v) for v in bp.vertices]
                bs = list(bp.bugles) if bp.has_bugle else []
                n = len(vs)
                for i in range(n if bp.is_closed else n - 1):
                    a, c = vs[i], vs[(i + 1) % n]
                    b = bs[i] if i < len(bs) else 0
                    seg = bulge_pts(a, c, b) if abs(b) > 1e-9 else [a, c]
                    pts.extend(seg[:-1])
                if not bp.is_closed and vs:
                    pts.append(vs[-1])
            elif tn == 'CadEdgeBoundaryPath':
                for ob in bp.objects:
                    cn = cls(ob)
                    if cn == 'CadBoundaryPathLine':
                        pts.append(P(ob.first_point)); pts.append(P(ob.second_point))
                    elif cn == 'CadBoundaryPathCircularArc':
                        cx, cy = P(ob.center_point)
                        pts.extend(arc_pts(cx, cy, float(ob.radius), float(ob.start_angle), float(ob.end_angle),
                                           str(ob.counter_clockwize) not in ('0', 'False')))
                    elif cn == 'CadBoundaryPathCircularEllipse':
                        cx, cy = P(ob.center_point); mx, my = P(ob.major_end_point)
                        t1, t2 = math.radians(float(ob.start_angle)), math.radians(float(ob.end_angle))
                        ep = ellipse_pts(cx, cy, mx, my, float(ob.axis_ratio), t1, t2)
                        if str(ob.counterclockwise_flag) in ('0', 'False'):
                            ep = ep[::-1]
                        pts.extend(ep)
                    elif cn == 'CadBoundaryPathSpline':
                        pts.extend(P(c) for c in ob.control_points)  # gần đúng
            if len(pts) >= 3:
                loops.append(pts)
    return loops


def _clean(lp):
    out = []
    for p in lp:
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 1e-9:
            out.append(p)
    if len(out) > 1 and math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) <= 1e-9:
        out.pop()
    return out


def _area(lp):
    return sum(lp[i][0] * lp[(i + 1) % len(lp)][1] - lp[(i + 1) % len(lp)][0] * lp[i][1] for i in range(len(lp))) / 2


def triangulate(lp):
    """Ear clipping cho đa giác đơn -> list tam giác."""
    pts = _clean(lp)
    if len(pts) < 3:
        return []
    if _area(pts) < 0:
        pts = pts[::-1]
    idx = list(range(len(pts)))
    tris, guard = [], 0

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(p, a, b, c):
        return cross(a, b, p) >= -1e-12 and cross(b, c, p) >= -1e-12 and cross(c, a, p) >= -1e-12

    while len(idx) > 3 and guard < 10000:
        guard += 1
        ear = False
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = pts[i0], pts[i1], pts[i2]
            if cross(a, b, c) <= 1e-12:
                continue
            if any(inside(pts[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((a, b, c)); idx.pop(k); ear = True
            break
        if not ear:  # đa giác suy biến: fan phần còn lại
            break
    if len(idx) >= 3:
        a = pts[idx[0]]
        for k in range(1, len(idx) - 1):
            tris.append((a, pts[idx[k]], pts[idx[k + 1]]))
    return tris


def hatch_solid(h):
    """Hatch tô đặc -> tam giác SOLID. Nhiều loop (lỗ): bỏ qua lỗ, tô loop lớn nhất + loop rời (đơn giản hoá)."""
    out = []
    for lp in hatch_loops(h):
        for (a, b, c) in triangulate(lp):
            out.append(('S', a[0], a[1], b[0], b[1], c[0], c[1]))
    return out


def hatch_lines(h):
    """Sinh nét LINE theo pattern definitions, cắt even-odd theo các loop biên."""
    if int(h.solid_fill_flag or 0) == 1:
        return hatch_solid(h)
    loops = hatch_loops(h)
    if not loops:
        return []
    edges = []
    for lp in loops:
        for i in range(len(lp)):
            a, b = lp[i], lp[(i + 1) % len(lp)]
            if a != b:
                edges.append((a, b))
    allp = [p for lp in loops for p in lp]
    out = []
    for pd in h.pattern_definitions:
        th = math.radians(float(pd.line_angle))
        dx, dy = math.cos(th), math.sin(th)
        nx, ny = -dy, dx
        bx, by = P(pd.line_base_point)
        ox, oy = P(pd.line_offset)
        sp = ox * nx + oy * ny  # khoảng cách vuông góc giữa 2 đường
        shift = ox * dx + oy * dy  # trượt dọc đường mỗi bước
        if abs(sp) < 1e-9:
            continue
        projs = [(p[0] - bx) * nx + (p[1] - by) * ny for p in allp]
        k0, k1 = math.floor(min(projs) / sp), math.ceil(max(projs) / sp)
        if k1 < k0:
            k0, k1 = k1, k0
        if k1 - k0 > 2000:  # chặn bùng nổ khi pattern quá dày so với biên
            continue
        dashes = [float(x) for x in pd.dash_lengths]
        for k in range(k0, k1 + 1):
            px, py = bx + k * ox, by + k * oy  # gốc của đường thứ k
            ts = []
            for (a, b) in edges:
                ex, ey = b[0] - a[0], b[1] - a[1]
                den = dx * ey - dy * ex
                if abs(den) < 1e-12:
                    continue
                wx, wy = a[0] - px, a[1] - py
                t = (wx * ey - wy * ex) / den
                s = (wx * dy - wy * dx) / den
                if 0 <= s < 1:
                    ts.append(t)
            ts.sort()
            for i in range(0, len(ts) - 1, 2):
                t1, t2 = ts[i], ts[i + 1]
                if t2 - t1 < 1e-6:
                    continue
                if not dashes or sum(abs(d) for d in dashes) < 1e-9:
                    out.append(('L', px + dx * t1, py + dy * t1, px + dx * t2, py + dy * t2))
                    continue
                period = sum(abs(d) for d in dashes)
                t = t1
                # căn pha theo gốc đường (t=0 tại gốc)
                start = math.floor(t1 / period) * period
                t = start
                while t < t2:
                    for d in dashes:
                        seg = abs(d)
                        a, b = t, t + (seg if seg > 0 else 0)
                        if d >= 0:
                            lo, hi = max(a, t1), min(b if seg > 0 else a + 1e-6, t2)
                            if hi > lo:
                                out.append(('L', px + dx * lo, py + dy * lo, px + dx * hi, py + dy * hi))
                        t = t + seg
                        if t >= t2:
                            break
    return out


def convert(e):
    """1 entity -> list primitive (toạ độ tuyệt đối trong hệ block)."""
    c = cls(e)
    out = []
    if c == 'CadLine':
        o = pycore.cast(co.CadLine, e)
        a, b = P(o.first_point), P(o.second_point)
        out.append(('L', a[0], a[1], b[0], b[1]))
    elif c == 'CadCircle':
        o = pycore.cast(co.CadCircle, e)
        cx, cy = P(o.center_point)
        out.append(('C', cx, cy, float(o.radius)))
    elif c == 'CadArc':
        o = pycore.cast(co.CadArc, e)
        cx, cy = P(o.center_point)
        out.append(('A', cx, cy, float(o.radius), float(o.start_angle), float(o.end_angle)))
    elif c == 'CadEllipse':
        o = pycore.cast(co.CadEllipse, e)
        cx, cy = P(o.center_point); mx, my = P(o.major_end_point)
        pts = ellipse_pts(cx, cy, mx, my, float(o.axis_ratio), float(o.start_angle), float(o.end_angle))
        out += [('L', pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(len(pts) - 1)]
    elif c == 'CadLwPolyline':
        o = pycore.cast(co.CadLwPolyline, e)
        vs = [P(v) for v in o.coordinates]
        bs = [float(b) for b in o.bugle] if o.bugle is not None else []
        closed = (int(o.flag) & 1) == 1
        n = len(vs)
        for i in range(n if closed else n - 1):
            a, b = vs[i], vs[(i + 1) % n]
            bl = bs[i] if i < len(bs) else 0.0
            if abs(bl) > 1e-9:
                arc = bulge_arc(a, b, bl)
                if arc:
                    out.append(('A',) + arc)
                    continue
            out.append(('L', a[0], a[1], b[0], b[1]))
    elif c == 'CadMText':
        o = pycore.cast(co.CadMText, e)
        x, y = P(o.insertion_point)
        h = float(o.initial_text_height or 1.0)
        txt = str(o.full_clear_text or o.text or '')
        # MTEXT gốc TOP_LEFT -> TEXT gốc baseline-left: hạ xuống ~1 chiều cao chữ
        out.append(('T', x, y - h, h, math.degrees(float(o.rotation_angle_rad or 0)), txt))
    elif c == 'CadText':
        o = pycore.cast(co.CadText, e)
        x, y = P(o.first_alignment)
        out.append(('T', x, y, float(o.default_height or 1.0), float(o.rotation_angle or 0), str(o.default_value or '')))
    elif c == 'CadHatch':
        h = pycore.cast(CadHatch, e)
        out += hatch_lines(h)
    elif c == 'CadInsertObject':
        o = pycore.cast(co.CadInsertObject, e)
        x, y = P(o.insertion_point)
        out.append(('I', str(o.name), x, y, float(o.scale_x or 1), float(o.scale_y or 1), float(o.rotation_angle or 0)))
    else:
        out.append(('?', c))
    return out


def main(dwg, outp):
    ci = pycore.cast(CadImage, cad.Image.load(dwg))
    blocks = {str(b.name): b for b in ci.block_entities.values_typed}
    need, stack = [], list(WANT)
    while stack:
        n = stack.pop(0)
        if n in need or n not in blocks:
            continue
        need.append(n)
        for e in blocks[n].entities:
            if int(e.type_name) == 15:
                stack.append(str(pycore.cast(co.CadInsertObject, e).name))
    lib, skipped = {}, Counter()
    for n in need:
        b = blocks[n]
        bx, by = P(b.base_point)
        prims = []
        for e in b.entities:
            for p in convert(e):
                if p[0] == '?':
                    skipped[(n, p[1])] += 1; continue
                if p[0] == 'L':
                    prims.append(['L', p[1] - bx, p[2] - by, p[3] - bx, p[4] - by])
                elif p[0] == 'C':
                    prims.append(['C', p[1] - bx, p[2] - by, p[3]])
                elif p[0] == 'A':
                    prims.append(['A', p[1] - bx, p[2] - by, p[3], p[4], p[5]])
                elif p[0] == 'T':
                    prims.append(['T', p[1] - bx, p[2] - by, p[3], p[4], p[5]])
                elif p[0] == 'I':
                    prims.append(['I', p[1], p[2] - bx, p[3] - by, p[4], p[5], p[6]])
                elif p[0] == 'S':
                    prims.append(['S', p[1] - bx, p[2] - by, p[3] - bx, p[4] - by, p[5] - bx, p[6] - by])
        lib[n] = prims
    # thống kê tỉ lệ / góc chèn trong bản vẽ gốc (model + lồng)
    sc, rot = defaultdict(list), defaultdict(list)
    def scan(ents):
        for e in ents:
            if int(e.type_name) == 15:
                o = pycore.cast(co.CadInsertObject, e)
                nm = str(o.name)
                if nm in WANT:
                    sc[nm].append(round(float(o.scale_x or 1), 4)); rot[nm].append(round(float(o.rotation_angle or 0), 1))
    scan(ci.entities)
    for b in blocks.values():
        scan(b.entities)
    stats = {n: {'n': len(sc[n]), 'scale_median': statistics.median(sc[n]) if sc[n] else None,
                 'scales': Counter(sc[n]).most_common(4), 'rot_top': Counter(rot[n]).most_common(4)} for n in WANT}
    json.dump({'blocks': lib, 'insert_stats': stats, 'skipped': {f'{k[0]}|{k[1]}': v for k, v in skipped.items()}},
              open(outp, 'w'), ensure_ascii=False)
    print('blocks:', len(lib), '| skipped:', dict(skipped))
    for n in need:
        print(f'  {n:24s} prims={len(lib[n]):4d} {dict(Counter(p[0] for p in lib[n]))}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
