#!/usr/bin/env python3
# Dựng nền OSM đường DỰNG SẴN cho app (data/osm-roads/*.json.gz) từ bản trích Geofabrik.
# Xem docs/design-osm-prebuilt-hcm.md.
#
# Cập nhật hằng năm (đường thay đổi chậm):
#   1. Tải https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
#   2. pip install pyrosm                 (cần geopandas + shapely, có sẵn wheel)
#   3. python3 tools/build-osm-roads.py  <đường_dẫn_vietnam.osm.pbf>
#   4. git add data/osm-roads && git commit && git push
#      (workflow bump-version tự tăng patch; SW tự cache tile khi dùng)
#
# Kết quả: data/osm-roads/index.json.gz + tile_<col>_<row>.json.gz (lưới 0.1°, ~201 ô).
# Record tile: {h:highway, n:name, w:width, ln:lanes, ly:layer, br:bridge, tn:tunnel,
#               ow:oneway, co:construction, sv:service, rf:ref, c:[[lon,lat],...]}

import sys, os, json, math, gzip, time
from pyrosm import OSM

# bbox TP.HCM mới (gộp Bình Dương + BR-VT, có đệm): minlon, minlat, maxlon, maxlat
BBOX = [106.25, 10.15, 107.65, 11.50]
TILE_DEG = 0.1
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'osm-roads')

# Loại các loại highway KHÔNG phải hẻm/đường (bậc thang, làn xe đạp/bus, đường mòn...).
# Giữ lại: motorway…residential, living_street, service (hẻm), footway/path/pedestrian (hẻm đi bộ).
EXCLUDE_HW = {'steps', 'cycleway', 'bridleway', 'raceway', 'busway', 'track',
              'corridor', 'elevator', 'platform', 'proposed', 'construction', 'bus_stop', 'escape'}

def main(pbf):
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    print('[build] đọc + trích mạng đường (all: gồm hẻm), bbox', BBOX, flush=True)
    osm = OSM(pbf, bounding_box=BBOX)
    # network_type='all' để GỒM cả hẻm (service/footway/path/pedestrian) — 'driving' bỏ sót service+footway
    roads = osm.get_network(network_type='all',
        extra_attributes=['width', 'bridge', 'tunnel', 'layer', 'construction', 'service', 'ref'])
    if roads is None or len(roads) == 0:
        raise SystemExit('Không có đường trong bbox — kiểm tra lại file pbf.')
    if 'highway' in roads.columns:
        roads = roads[~roads['highway'].isin(EXCLUDE_HW)]
    cols = set(roads.columns)
    print('[build] rows=%d (%.1fs)' % (len(roads), time.time() - t0), flush=True)

    def g(r, k):
        v = r.get(k) if k in cols else None
        if v is None:
            return None
        try:
            if isinstance(v, float) and math.isnan(v):
                return None
        except Exception:
            pass
        s = str(v).strip()
        return s if s and s.lower() != 'nan' else None

    rnd = lambda x: round(float(x), 6)
    minlon, minlat = BBOX[0], BBOX[1]
    tkey = lambda lon, lat: '%d_%d' % (int((lon - minlon) // TILE_DEG), int((lat - minlat) // TILE_DEG))
    KEYMAP = [('width', 'w'), ('lanes', 'ln'), ('layer', 'ly'), ('bridge', 'br'),
              ('tunnel', 'tn'), ('oneway', 'ow'), ('construction', 'co'), ('service', 'sv'), ('ref', 'rf')]

    tiles = {}
    n_feat = 0
    for _, r in roads.iterrows():
        geom = r.geometry
        if geom is None:
            continue
        gt = geom.geom_type
        if gt == 'LineString':
            parts = [list(geom.coords)]
        elif gt == 'MultiLineString':
            parts = [list(p.coords) for p in geom.geoms]
        else:
            continue
        tags = {'h': g(r, 'highway')}
        nm = g(r, 'name')
        if nm:
            tags['n'] = nm
        for src, dst in KEYMAP:
            val = g(r, src)
            if val is not None:
                tags[dst] = val
        for coords in parts:
            if len(coords) < 2:
                continue
            pts = [[rnd(x), rnd(y)] for (x, y) in coords]
            mid = pts[len(pts) // 2]
            rec = dict(tags)
            rec['c'] = pts
            tiles.setdefault(tkey(mid[0], mid[1]), []).append(rec)
            n_feat += 1

    index = {'version': 1, 'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
             'source': os.path.basename(pbf), 'network': 'all',
             'bbox': {'minLon': BBOX[0], 'minLat': BBOX[1], 'maxLon': BBOX[2], 'maxLat': BBOX[3]},
             'tileDeg': TILE_DEG, 'tiles': {}}
    total = 0
    for key, recs in tiles.items():
        s = json.dumps(recs, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        with gzip.open(os.path.join(OUT, 'tile_%s.json.gz' % key), 'wb', compresslevel=9) as f:
            f.write(s)
        total += len(s)
        index['tiles'][key] = {'n': len(recs)}
    with gzip.open(os.path.join(OUT, 'index.json.gz'), 'wb', compresslevel=9) as f:
        f.write(json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))

    print('[build] XONG features=%d tiles=%d rawJSON=%.1fMB (%.1fs)'
          % (n_feat, len(tiles), total / 1e6, time.time() - t0), flush=True)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Dùng: python3 tools/build-osm-roads.py <vietnam-latest.osm.pbf>')
    main(sys.argv[1])
