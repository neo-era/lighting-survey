// Lighting Survey — CadDrawing class (T21 Phase A)
// Self-contained DXF writer — không phụ thuộc dxf-writer lib.
// Xuất format R2018 (AC1032) tương thích AutoCAD 2021.
//
// Public API:
//   new CadDrawing()
//     .addLayer(name, colorAci, lineType)
//     .setHeader(key, value)          — override HEADER var
//     .setInsbase(x, y, z)            — precision offset
//     .addBlockFromDxf(name, rawText) — inject BLOCK definition
//     .registerBlockAttdefs(name, attdefs)  — cho INSERT với ATTRIBUTES
//     .insertBlock(name, x, y, rot, scale, layer)
//     .insertBlockWithAttrs(name, x, y, attrValues, rot, scale, layer)
//     .drawText(x, y, height, text, layer)
//     .drawLine(x1, y1, x2, y2, layer)
//     .drawPolyline(points, closed, layer)
//     .toDxfString()
//     .toBlob()
//
// Namespace: window.__LS.CadDrawing + window.CadDrawing (backward compat)
(function () {
    'use strict';

    // Escape text cho DXF: ký tự Unicode >= U+0080 → \U+XXXX (chuẩn AutoCAD 2018+)
    // Cần thiết cho tiếng Việt: "Nguyễn Văn A" → "Nguy\\U+1EC5n V\\U+0103n A"
    // Không cần escape ASCII (< 0x80).
    function _dxfEscapeText(text) {
        if (text == null) return '';
        const str = String(text);
        let out = '';
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code < 128) {
                out += str[i];
            } else if (code < 0x10000) {
                out += '\\U+' + code.toString(16).toUpperCase().padStart(4, '0');
            } else {
                // Surrogate pair (emoji, code point > U+FFFF) — bỏ qua
                out += '?';
            }
        }
        return out;
    }

    class CadDrawing {
        constructor() {
            this._layers = [];
            this._blocks = {};        // { NAME: rawBlockText }
            this._inserts = [];       // [{name, x, y, rotation, scale, layer, attrs}]
            this._entities = [];      // [{type, ...params}]
            this._blockAttdefs = {};  // { NAME: [{tag, x, y, height}] }
            this._headerVars = {
                INSUNITS: 6,             // meters
                DWGCODEPAGE: 'ANSI_1258' // tiếng Việt
            };
            // INSBASE = (0,0,0) — KHÔNG shift entities. Coord trong DXF = world coord thực.
            // INSBASE trong DXF spec là điểm base để INSERT drawing này vào drawing khác (XREF),
            // KHÔNG ảnh hưởng khi mở standalone.
            // Trước đây (bug): subtract insbase → entities bị shift → mở AutoCAD thấy trống.
            this._insbase = [0, 0, 0];
        }

        setHeader(key, value) { this._headerVars[key] = value; return this; }
        setInsbase(x, y, z = 0) { this._insbase = [x, y, z]; return this; }
        setExtents(minX, minY, maxX, maxY) { this._extents = [minX, minY, maxX, maxY]; return this; }

        addLayer(name, colorAci = 7, lineType = 'CONTINUOUS') {
            this._layers.push({ name, color: colorAci, lineType });
            return this;
        }

        addBlockFromDxf(name, rawBlockText) {
            this._blocks[String(name).toUpperCase()] = rawBlockText;
            return this;
        }

        registerBlockAttdefs(blockName, attdefs) {
            this._blockAttdefs[String(blockName).toUpperCase()] = attdefs;
            return this;
        }

        insertBlock(name, x, y, rotation = 0, scale = 1, layer = '0') {
            this._inserts.push({
                name: String(name).toUpperCase(),
                x: x - this._insbase[0],
                y: y - this._insbase[1],
                rotation, scale, layer,
                attrs: null
            });
            return this;
        }

        insertBlockWithAttrs(name, x, y, attrValues, rotation = 0, scale = 1, layer = 'TITLE_BLOCK') {
            this._inserts.push({
                name: String(name).toUpperCase(),
                x: x - this._insbase[0],
                y: y - this._insbase[1],
                rotation, scale, layer,
                attrs: attrValues || {}
            });
            return this;
        }

        drawText(x, y, height, text, layer = '0') {
            this._entities.push({
                type: 'TEXT',
                x: x - this._insbase[0],
                y: y - this._insbase[1],
                height, text: String(text), layer
            });
            return this;
        }

        drawLine(x1, y1, x2, y2, layer = '0') {
            this._entities.push({
                type: 'LINE',
                x1: x1 - this._insbase[0], y1: y1 - this._insbase[1],
                x2: x2 - this._insbase[0], y2: y2 - this._insbase[1],
                layer
            });
            return this;
        }

        drawPolyline(points, closed = false, layer = '0') {
            this._entities.push({
                type: 'LWPOLYLINE',
                points: points.map(p => [p[0] - this._insbase[0], p[1] - this._insbase[1]]),
                closed, layer
            });
            return this;
        }

        toDxfString() {
            // CRLF line-ending — AutoCAD 2021 chỉ nhận CRLF cho DXF ASCII
            // (createDxfForMarkers cũ dùng CRLF nên mở được, CadDrawing v1 dùng LF nên fail)
            const parts = [
                this._buildHeader(),
                this._buildTables(),
                this._buildBlocks(),
                this._buildEntities(),
                '  0\nEOF'
            ].join('\n') + '\n';
            return parts.replace(/\r?\n/g, '\r\n');
        }

        toBlob() {
            return new Blob([this.toDxfString()], { type: 'application/dxf' });
        }

        _buildHeader() {
            // Minimal HEADER — giống createDxfForMarkers cũ (mở được AutoCAD)
            // KHÔNG include $ACADVER, $INSUNITS, $DWGCODEPAGE, $INSBASE, $EXTMIN, $EXTMAX
            // vì các header vars này có thể conflict với default AutoCAD parser.
            // Nếu cần Unicode text tiếng Việt → dùng _dxfEscapeText (\U+XXXX prefix, universal)
            return '  0\nSECTION\n  2\nHEADER\n  0\nENDSEC';
        }

        _buildTables() {
            const L = [];
            L.push('  0', 'SECTION', '  2', 'TABLES');

            // LTYPE table — AutoCAD strict yêu cầu Layer's lineType phải có định nghĩa
            L.push('  0', 'TABLE', '  2', 'LTYPE', ' 70', '2');
            L.push('  0', 'LTYPE', '  2', 'CONTINUOUS', ' 70', '0',
                '  3', 'Solid line', ' 72', '65', ' 73', '0', ' 40', '0.0');
            L.push('  0', 'LTYPE', '  2', 'DASHED', ' 70', '0',
                '  3', '__ __ __ __ __ __', ' 72', '65', ' 73', '2', ' 40', '0.75',
                ' 49', '0.5', ' 74', '0', ' 49', '-0.25', ' 74', '0');
            L.push('  0', 'ENDTAB');

            // LAYER table
            L.push('  0', 'TABLE', '  2', 'LAYER', ' 70', this._layers.length + 1);
            // Default layer 0
            L.push('  0', 'LAYER', '  2', '0', ' 70', '0', ' 62', '7', '  6', 'CONTINUOUS');
            for (const lyr of this._layers) {
                L.push('  0', 'LAYER', '  2', lyr.name, ' 70', '0',
                    ' 62', lyr.color, '  6', lyr.lineType);
            }
            L.push('  0', 'ENDTAB', '  0', 'ENDSEC');
            return L.join('\n');
        }

        _buildBlocks() {
            const blocks = Object.values(this._blocks);
            if (blocks.length === 0) {
                return '  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC';
            }
            return '  0\nSECTION\n  2\nBLOCKS\n' + blocks.join('\n') + '\n  0\nENDSEC';
        }

        _buildEntities() {
            const L = [];
            L.push('  0', 'SECTION', '  2', 'ENTITIES');
            for (const ent of this._entities) {
                if (ent.type === 'LINE') {
                    L.push('  0', 'LINE', '  8', ent.layer);
                    L.push(' 10', ent.x1, ' 20', ent.y1, ' 30', '0');
                    L.push(' 11', ent.x2, ' 21', ent.y2, ' 31', '0');
                } else if (ent.type === 'TEXT') {
                    L.push('  0', 'TEXT', '  8', ent.layer);
                    L.push(' 10', ent.x, ' 20', ent.y, ' 30', '0');
                    L.push(' 40', ent.height);
                    L.push('  1', _dxfEscapeText(ent.text));  // Unicode → \U+XXXX
                } else if (ent.type === 'LWPOLYLINE') {
                    L.push('  0', 'LWPOLYLINE', '  8', ent.layer);
                    L.push(' 90', ent.points.length);
                    L.push(' 70', ent.closed ? 1 : 0);
                    for (const p of ent.points) {
                        L.push(' 10', p[0], ' 20', p[1]);
                    }
                }
            }
            for (const ins of this._inserts) {
                const hasAttrs = ins.attrs && Object.keys(ins.attrs).length > 0;
                L.push('  0', 'INSERT', '  8', ins.layer, '  2', ins.name);
                if (hasAttrs) L.push(' 66', '1');
                L.push(' 10', ins.x, ' 20', ins.y, ' 30', '0');
                L.push(' 41', ins.scale, ' 42', ins.scale, ' 43', ins.scale);
                L.push(' 50', ins.rotation);
                if (hasAttrs) {
                    const attdefs = (this._blockAttdefs || {})[ins.name] || [];
                    for (const ad of attdefs) {
                        const value = ins.attrs[ad.tag] != null ? String(ins.attrs[ad.tag]) : '';
                        const ax = ins.x + ad.x * ins.scale;
                        const ay = ins.y + ad.y * ins.scale;
                        L.push('  0', 'ATTRIB', '  8', ins.layer);
                        L.push(' 10', ax, ' 20', ay, ' 30', '0');
                        L.push(' 40', ad.height * ins.scale);
                        L.push('  1', _dxfEscapeText(value));   // Unicode → \U+XXXX
                        L.push('  2', ad.tag);
                        L.push(' 70', '0');
                    }
                    L.push('  0', 'SEQEND', '  8', ins.layer);
                }
            }
            L.push('  0', 'ENDSEC');
            return L.join('\n');
        }
    }

    // Expose namespace + backward-compat global
    const ns = window.__LS = window.__LS || {};
    ns.CadDrawing = CadDrawing;
    window.CadDrawing = CadDrawing;
})();
