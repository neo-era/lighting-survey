"""Ghi dữ liệu ký hiệu (JSON đã chuẩn hoá) vào src/core/cad-symlib.js giữa 2 mốc DATA.
Chạy: python3 tools/cad-blocks/build-cad-symlib.py <symlib_norm.json>"""
import json, re, sys, pathlib
KEEP = ['HPS - BETON', 'LED - BETON', 'HPS - STK', 'LED - STK', 'Den HPS', 'Den LED', 'Den MH', 'Den trang tri',
        'Tru BTLT', 'Tru STK', 'Tru trang tri', 'TTC', 'Tu dk KNTT', 'Tu dieu khien thuong', 'TDK_hienhuu', 'TDK CS']
src = json.load(open(sys.argv[1]))
blocks = {n: {'default_scale': src['blocks'][n]['default_scale'], 'prims': src['blocks'][n]['prims']} for n in KEEP}
data = 'const CAD_SYMLIB = ' + json.dumps(blocks, ensure_ascii=False, separators=(',', ':')) + ';'
f = pathlib.Path(__file__).resolve().parents[2] / 'src/core/cad-symlib.js'
s = f.read_text(encoding='utf-8')
s2 = re.sub(r'(// @@CADSYMLIB_DATA_START\n).*?(\n\s*// @@CADSYMLIB_DATA_END)', lambda m: m.group(1) + '        ' + data + m.group(2), s, flags=re.S)
assert s2 != s or data in s, 'không thấy mốc DATA'
f.write_text(s2, encoding='utf-8')
print('ghi', len(data), 'ký tự,', len(blocks), 'block')
