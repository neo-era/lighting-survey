// Marker gốc theo ID / tên trùng + kéo trụ trùng tên chỉ dời đúng 1 dòng (v187). Run: node tests/parent-ref.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
const W = sb.ctx;
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = o => { const r = new Array(30).fill(''); for (const k in o) r[k] = o[k]; return r; };
const c = v => String(v).replace('.', ',');
// 2 trụ tên "A" ở 2 nơi (cách ~1 km), 1 trụ "B" duy nhất
const TU = row({ 0: 'ID_TU', 1: 'TU', 2: c(10.9), 3: c(106.7), 6: 5 });
const A1 = row({ 0: 'ID_A1', 1: 'A', 2: c(10.9), 3: c(106.7003), 6: 1, 14: 'TU', 15: 33 });
const A2 = row({ 0: 'ID_A2', 1: 'A', 2: c(10.91), 3: c(106.7003), 6: 1, 14: 'TU', 15: 1100 });
const C1 = row({ 0: 'ID_C1', 1: 'C1', 2: c(10.9), 3: c(106.7006), 6: 1, 14: 'A', 15: 33 });      // gần A1
const C2 = row({ 0: 'ID_C2', 1: 'C2', 2: c(10.91), 3: c(106.7006), 6: 1, 14: 'A', 15: 33 });     // gần A2
const D = row({ 0: 'ID_D', 1: 'D', 2: c(10.9), 3: c(106.7009), 6: 1, 14: 'ID_A2', 15: 1100 });   // trỏ ID → A2 dù ở gần A1
const B = row({ 0: 'ID_B', 1: 'B', 2: c(10.92), 3: c(106.7), 6: 1, 14: 'B' });                   // trỏ chính nó
const ALL = [TU, A1, A2, C1, C2, D, B];
const idx = W._rowIndex(ALL);

// 1. Đọc Marker gốc
ok('ID → đúng dòng (D trỏ ID_A2)', W._resolveParent(D, idx) === A2);
ok('tên duy nhất → dòng đó (A1 → TU)', W._resolveParent(A1, idx) === TU);
ok('tên trùng → trụ trùng tên GẦN nhất (C1 → A1)', W._resolveParent(C1, idx) === A1);
ok('tên trùng → trụ trùng tên GẦN nhất (C2 → A2)', W._resolveParent(C2, idx) === A2);
ok('trỏ chính nó → không có cha', W._resolveParent(B, idx) === null);
ok('tên không có → null', W._resolveParent(row({ 1: 'X', 14: 'KHONG_CO' }), idx) === null);
ok('Marker gốc trống → null', W._resolveParent(row({ 1: 'X' }), idx) === null);
ok('con không toạ độ + tên trùng → vẫn ra 1 dòng trùng tên', [A1, A2].includes(W._resolveParent(row({ 1: 'X', 14: 'A' }), idx)));

// 2. Ghi Marker gốc
ok('cha tên duy nhất → ghi tên', W._parentRefFor(TU, idx) === 'TU');
ok('cha tên trùng → ghi ID', W._parentRefFor(A1, idx) === 'ID_A1');
const A3 = row({ 1: 'A', 2: c(10.95), 3: c(106.7) });
ok('cha tên trùng nhưng chưa có ID → đành ghi tên', W._parentRefFor(A3, W._rowIndex([...ALL, A3])) === 'A');
ok('hiển thị tên, không lộ ID (D → "A")', W._parentNameOf(D, idx) === 'A');

// 3. Kéo trụ trùng tên — chỉ dời đúng dòng
W.__rows = [new Array(30).fill('h'), ...ALL];
sb.run('loadedData = __rows; newMarkerRows = []; dirtyMovedRows.clear();');
const a1Before = [A1[2], A1[3]];
W._setRowCoordsAndCables(A2, 10.9101, 106.7004);
ok('kéo A2: A2 có toạ độ mới', A2[2] === 10.9101 && A2[3] === 106.7004);
ok('kéo A2: A1 (cùng tên) KHÔNG bị dời', A1[2] === a1Before[0] && A1[3] === a1Before[1]);
const dirty = sb.run('[...dirtyMovedRows]');
ok('kéo A2: A1 không bị đánh dấu đẩy lên sheet', !dirty.includes(A1));
ok('kéo A2: trụ con C2 (trỏ tên trùng) chốt sang ID A2 + cập nhật khoảng cách', C2[14] === 'ID_A2' && dirty.includes(C2) && C2[15] < 30);
ok('kéo A2: trụ con D (trỏ ID) cập nhật khoảng cách', dirty.includes(D) && D[15] > 1000);
ok('kéo A2: C1 (con của A1, trỏ tên trùng) chốt sang ID A1 — vẫn nối A1, giữ số mét', C1[14] === 'ID_A1' && C1[15] === 33);
ok('kéo A2: khoảng cách tới cha TU cập nhật', A2[15] > 1000 && A2[15] !== 1100);

// 4. Trụ chồng nhau
const S1 = row({ 1: 'S', 2: c(10.8), 3: c(106.6) }), S2 = row({ 1: 'S', 2: c(10.8), 3: c(106.6) });
const S3 = row({ 1: 'T', 2: c(10.800003), 3: c(106.6) });   // cách ~0,33 m
const S4 = row({ 1: 'U', 2: c(10.80001), 3: c(106.6) });    // cách ~1,1 m
const st = W._findStackedRows([S1, S2, S3, S4], 0.5);
ok('chồng nhau: 3 cặp trong < 0,5 m (S1–S2, S1–S3, S2–S3)', st.length === 3);
ok('chồng nhau: trụ cách 1,1 m không tính', !st.some(p => p.a === S4 || p.b === S4));
ok('chồng nhau: bỏ dòng không toạ độ', W._findStackedRows([row({ 1: 'Q' }), row({ 1: 'Q' })]).length === 0);

// 5. Vòng lặp: tên trùng ở 2 tuyến khác nhau không tạo vòng giả
const T1 = row({ 1: 'T1', 2: c(10.7), 3: c(106.5), 6: 5 }), T2 = row({ 1: 'T2', 2: c(10.75), 3: c(106.5), 6: 5 });
const X1a = row({ 1: 'X_1', 2: c(10.7), 3: c(106.5003), 14: 'T1' });
const X2b = row({ 1: 'X_2', 2: c(10.75), 3: c(106.5003), 14: 'T2' });
const X1b = row({ 1: 'X_1', 2: c(10.75), 3: c(106.5006), 14: 'X_2' });
const X2a = row({ 1: 'X_2', 2: c(10.7), 3: c(106.5006), 14: 'X_1' });
W.__rows = [new Array(30).fill('h'), T1, T2, X1a, X2b, X1b, X2a];
sb.run('loadedData = __rows;');
ok('vòng lặp: 2 tuyến trùng tên trụ → không báo vòng giả', W._detectCableCycle(W.__rows.slice(1)) === null);
const Y1 = row({ 0: 'Y1', 1: 'Y', 2: c(10.6), 3: c(106.4), 14: 'Z' }), Z1 = row({ 0: 'Z1', 1: 'Z', 2: c(10.6), 3: c(106.4003), 14: 'Y' });
W.__rows = [new Array(30).fill('h'), Y1, Z1];
sb.run('loadedData = __rows;');
const cyc = W._detectCableCycle(W.__rows.slice(1));
ok('vòng lặp thật Y ↔ Z vẫn phát hiện', cyc && cyc.rows.has(Y1) && cyc.rows.has(Z1));

// 6. Kiểm tra sơ đồ cáp: không báo cáp dài sai vì nối nhầm trụ trùng tên; có mục Trụ chồng nhau
W.__rows = [new Array(30).fill('h'), TU, A1, A2, C1, C2, S1, S2];
for (const r of [A1, A2, C1, C2]) r[15] = '';
A1[14] = 'TU'; C1[14] = 'A'; C2[14] = 'A';
sb.run('loadedData = __rows;');
const iss = W._getCableIssues({ thresholdLong: 200, ratioHaversine: 2, maxFanout: 99, enabledTypes: {} });
ok('C1, C2 (trỏ tên trùng) không bị báo cáp dài (nối đúng trụ gần)', !iss.some(i => i.type === 'long' && (i.row === C1 || i.row === C2)));
ok('mục Trụ chồng nhau liệt kê cặp S1–S2', iss.some(i => i.type === 'stack' && i.row === S2));
ok('loại "stack" có trong danh mục lỗi', !!sb.run('CABLE_ISSUE_TYPES.stack'));

// 7. MST: tên trùng → khoá node = ID (áp dụng ghi ID, không nhầm dòng)
const M0 = row({ 0: 'M0', 1: 'K', 2: c(10.5), 3: c(106.3), 6: 5, 7: 'K' });
const M1 = row({ 0: 'M1', 1: 'K_1', 2: c(10.5), 3: c(106.3003), 6: 1, 7: 'K' });
const M2 = row({ 0: 'M2', 1: 'K_1', 2: c(10.5), 3: c(106.3006), 6: 1, 7: 'K' });   // trùng tên với M1
const M3 = row({ 0: 'M3', 1: 'K_3', 2: c(10.5), 3: c(106.3009), 6: 1, 7: 'K', 14: 'K_1' });
W.__rows = [new Array(30).fill('h'), M0, M1, M2, M3];
sb.run('loadedData = __rows;');
const nodes = W._mstGetNodesForTu('K');
ok('MST: 4 node, khoá duy nhất', nodes.length === 4 && new Set(nodes.map(n => n.name)).size === 4);
ok('MST: trụ trùng tên dùng ID làm khoá, nhãn vẫn là tên', nodes.find(n => n.row === M2).name === 'M2' && nodes.find(n => n.row === M2).label === 'K_1');
ok('MST: trụ cha hiện tại của K_3 = trụ K_1 gần nhất (M2)', nodes.find(n => n.row === M3).parent === 'M2');
const edges = W._mstPrim(nodes);
ok('MST: cạnh nối tới M2 dùng khoá ID', edges.some(e => e.from === 'M2' || e.to === 'M2'));
const diff = W._mstDiff(edges, 'K');
ok('MST: K_3 ← M2 đã có trong sheet → giữ nguyên', diff.same.some(e => e.to === 'K_3' && e.from === 'M2'));

// 8. Kéo 1 trụ trùng tên lại gần trụ con của trụ cùng tên kia → trụ con KHÔNG bị đổi cha ngầm
{
    const P1 = row({ 0: 'P1', 1: 'P', 2: c(10.4), 3: c(106.2), 6: 1 });
    const P2 = row({ 0: 'P2', 1: 'P', 2: c(10.41), 3: c(106.2), 6: 1 });
    const X = row({ 0: 'IX', 1: 'X', 2: c(10.41), 3: c(106.2003), 6: 1, 14: 'P', 15: 33 });   // gần P2
    W.__rows = [new Array(30).fill('h'), P1, P2, X];
    sb.run('loadedData = __rows; newMarkerRows = []; dirtyMovedRows.clear();');
    const aff = W._rowsAffectedByMove([P1]);
    W._setRowCoordsAndCables(P1, 10.41, 106.2004);              // P1 dời sát X (gần hơn P2)
    const i2 = W._rowIndex(W.__rows.slice(1));
    ok('kéo P1 sát X: X vẫn nối P2 (đã chốt sang ID)', X[14] === 'P2' && W._resolveParent(X, i2) === P2);
    ok('X được đánh dấu đẩy lên sheet + nằm trong snapshot hoàn tác', sb.run('dirtyMovedRows.has(__rows[3])') && aff.has(X));
    ok('X giữ nguyên số mét (cha không dời)', X[15] === 33);
}
// 9. Dời nhiều trụ 1 lượt (căn thẳng tuyến): quan hệ chốt trước, không trôi theo trụ đã dời
{
    const Q1 = row({ 0: 'Q1', 1: 'Q', 2: c(10.3), 3: c(106.1), 6: 1 });
    const Q2 = row({ 0: 'Q2', 1: 'Q', 2: c(10.31), 3: c(106.1), 6: 1 });
    const Y = row({ 0: 'IY', 1: 'Y', 2: c(10.31), 3: c(106.1003), 6: 1, 14: 'Q' });   // con của Q2
    W.__rows = [new Array(30).fill('h'), Q1, Q2, Y];
    sb.run('loadedData = __rows; newMarkerRows = []; dirtyMovedRows.clear();');
    W._moveRowsAndCables([{ row: Q1, lat: 10.31, lon: 106.1004 }, { row: Y, lat: 10.3101, lon: 106.1003 }]);
    ok('dời Q1 + Y cùng lượt: Y vẫn nối Q2', W._resolveParent(Y, W._rowIndex(W.__rows.slice(1))) === Q2 && Y[14] === 'Q2');
}
// 10. MST: 2 dòng trùng tên CHƯA có ID → khoá node không gộp; áp dụng ghi tên (không ghi khoá "#2")
{
    const N0 = row({ 1: 'N', 2: c(10.2), 3: c(106.0), 6: 5, 7: 'N' });
    const Na = row({ 1: 'N_1', 2: c(10.2), 3: c(106.0003), 6: 1, 7: 'N' });
    const Nb = row({ 1: 'N_1', 2: c(10.2), 3: c(106.0006), 6: 1, 7: 'N' });
    W.__rows = [new Array(30).fill('h'), N0, Na, Nb];
    sb.run('loadedData = __rows;');
    const ns = W._mstGetNodesForTu('N');
    ok('MST không ID: 3 node khoá khác nhau', new Set(ns.map(n => n.name)).size === 3);
    ok('MST không ID: Prim nối đủ 2 cạnh', W._mstPrim(ns).length === 2);
}
// 11. Trỏ chính tên mình khi tên bị trùng → không nối sang trụ trùng tên
{
    const S = row({ 0: 'S1', 1: 'SS', 2: c(10.1), 3: c(106), 14: 'SS' }), S2b = row({ 0: 'S2', 1: 'SS', 2: c(10.1), 3: c(106.0003) });
    ok('tự trỏ tên mình (tên trùng) → null', W._resolveParent(S, W._rowIndex([S, S2b])) === null);
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
