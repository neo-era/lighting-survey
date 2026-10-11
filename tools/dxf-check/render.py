"""Kiểm tra + render DXF ra PNG (không cần AutoCAD). Xem README.md.

python tools/dxf-check/render.py file.dxf out.png [--around "J3.31"] [--radius 40] [--black]
Thoát mã 1 nếu audit có lỗi.
"""
import argparse, sys
sys.stdout.reconfigure(encoding='utf-8')   # console Windows mặc định cp1252 → lỗi khi in tiếng Việt
from ezdxf import recover
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.config import Configuration, BackgroundPolicy, ColorPolicy
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ap = argparse.ArgumentParser()
ap.add_argument('dxf'); ap.add_argument('png')
ap.add_argument('--around', help='tên trụ (TEXT lớp 0) để phóng to quanh đó')
ap.add_argument('--radius', type=float, default=40, help='bán kính khung khi --around (m)')
ap.add_argument('--black', action='store_true', help='vẽ toàn đen (không màu theo lớp)')
a = ap.parse_args()

doc, auditor = recover.readfile(a.dxf)
print('audit errors:', len(auditor.errors))
for e in auditor.errors[:10]:
    print('  ERR', e.message)
print('layers:', ', '.join(l.dxf.name for l in doc.layers))
msp = doc.modelspace()

cfg = Configuration(background_policy=BackgroundPolicy.WHITE,
                    **({'color_policy': ColorPolicy.BLACK} if a.black else {}))
fig = plt.figure(figsize=(14, 10), dpi=100)
ax = fig.add_axes([0, 0, 1, 1])
ctx = RenderContext(doc); ctx.set_current_layout(msp)
Frontend(ctx, MatplotlibBackend(ax), config=cfg).draw_layout(msp)
if a.around:
    hits = [t for t in msp.query('TEXT[layer=="0"]') if t.dxf.text == a.around]
    if not hits:
        print('Không thấy trụ', a.around); sys.exit(2)
    x, y = hits[0].dxf.insert.x - 3, hits[0].dxf.insert.y + 1   # nhãn đặt lệch (+3,-1) so với trụ
    ax.set_xlim(x - a.radius, x + a.radius); ax.set_ylim(y - a.radius * 0.7, y + a.radius * 0.7)
    ax.set_aspect('equal', adjustable='datalim')
fig.savefig(a.png, facecolor='white')
print('saved', a.png)
print('Lưu ý: chữ tiếng Việt có thể hiện ô vuông do máy render thiếu font — kiểm nội dung bằng t.dxf.text, AutoCAD dùng times.ttf.')
sys.exit(1 if auditor.errors else 0)
