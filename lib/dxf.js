// DXF helpers extracted (P37 module extraction)

// DXF ACI color index → hex
const DXF_COLORS = [
    '#000000', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#333333',
    '#808080', '#c0c0c0', '#ff0000', '#ff8080', '#a52a2a', '#a56666', '#7f0000', '#7f4040'
];

export function dxfColorToHex(idx) {
    if (idx == null || idx === 256) return '#333';   // BYLAYER fallback
    if (idx === 0 || idx === 7) return '#333';       // BYBLOCK / white
    return DXF_COLORS[idx] || '#666';
}

// Add N months to ISO date (YYYY-MM-DD)
export function addMonthsIso(isoDate, months) {
    const d = new Date(isoDate);
    d.setMonth(d.getMonth() + parseInt(months, 10));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Parse DXF entities (simplified — LINE, LWPOLYLINE, POLYLINE, CIRCLE, TEXT)
export function parseDxfEntities(dxf, cleanMText) {
    const entities = [];
    (dxf.entities || []).forEach(e => {
        try {
            if (e.type === 'LINE') {
                entities.push({
                    type: 'line', layer: e.layer, color: e.color,
                    points: [
                        { x: e.vertices[0].x, y: e.vertices[0].y },
                        { x: e.vertices[1].x, y: e.vertices[1].y }
                    ]
                });
            } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && Array.isArray(e.vertices)) {
                entities.push({
                    type: 'polyline', layer: e.layer, color: e.color,
                    points: e.vertices.map(v => ({ x: v.x, y: v.y })),
                    closed: !!(e.shape || e.closed)
                });
            } else if (e.type === 'CIRCLE' && e.center) {
                entities.push({
                    type: 'circle', layer: e.layer, color: e.color,
                    center: { x: e.center.x, y: e.center.y },
                    radius: e.radius
                });
            } else if ((e.type === 'TEXT' || e.type === 'MTEXT') && (e.position || e.startPoint)) {
                const pos = e.position || e.startPoint;
                const rawText = (e.text || e.string || '').toString();
                const cleanText = cleanMText ? cleanMText(rawText) : rawText;
                if (!cleanText) return;
                entities.push({
                    type: 'text', layer: e.layer, color: e.color,
                    position: { x: pos.x, y: pos.y },
                    text: cleanText,
                    height: e.textHeight || 2.5
                });
            }
        } catch { /* ignore malformed */ }
    });
    return entities;
}

// Compute bounding box of DXF entities
export function computeDxfBounds(entities) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entities.forEach(e => {
        const pts = e.points ? e.points
            : e.center ? [e.center]
            : e.position ? [e.position]
            : [];
        pts.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
    });
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}
