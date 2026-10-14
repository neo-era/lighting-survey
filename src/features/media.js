// src/features/media.js - Lib loaders & media: ghi am (voice), quet QR, Chart.js, Mapillary (module hoa dot 4c).
// Classic script toan cuc, nap place: before. Goi global runtime: map, displayError/Info, MAPILLARY_TOKEN, document...
// 13 ham + 10 state. KHONG import/export.

        let _voiceRecorder = null;

        let _voiceChunks = [];

        let _voiceRecordingStart = 0;

        let _voiceTimer = null;

        async function _startVoiceRecord() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                displayError('Trình duyệt không hỗ trợ ghi âm');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                _voiceChunks = [];
                _voiceRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                _voiceRecorder.ondataavailable = (e) => { if (e.data.size) _voiceChunks.push(e.data); };
                _voiceRecorder.onstop = async () => {
                    stream.getTracks().forEach(t => t.stop());
                    if (_voiceTimer) { clearInterval(_voiceTimer); _voiceTimer = null; }
                    const blob = new Blob(_voiceChunks, { type: 'audio/webm' });
                    _voiceRecorder = null;
                    _updateVoiceUI('done', 0);
                    // Convert to base64 dataUrl for preview + upload
                    const reader = new FileReader();
                    reader.onload = () => {
                        _voiceDataUrl = reader.result;
                        _renderVoicePreview();
                    };
                    reader.readAsDataURL(blob);
                };
                _voiceRecorder.start();
                _voiceRecordingStart = Date.now();
                _updateVoiceUI('recording', 0);
                _voiceTimer = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - _voiceRecordingStart) / 1000);
                    _updateVoiceUI('recording', elapsed);
                    if (elapsed >= 60) _stopVoiceRecord(); // Max 60s
                }, 250);
            } catch (err) {
                displayError('Không truy cập được microphone: ' + err.message);
            }
        }

        function _stopVoiceRecord() {
            if (_voiceRecorder && _voiceRecorder.state === 'recording') _voiceRecorder.stop();
        }

        let _voiceDataUrl = '';

        function _clearVoice() {
            _voiceDataUrl = '';
            _renderVoicePreview();
        }

        function _updateVoiceUI(state, seconds) {
            const btn = document.getElementById('voiceRecordBtn');
            if (!btn) return;
            if (state === 'recording') {
                btn.textContent = `⏹ Dừng (${seconds}s / 60s)`;
                btn.style.background = '#dc2626';
                btn.style.color = '#fff';
                btn.onclick = _stopVoiceRecord;
            } else {
                btn.textContent = '🎙 Ghi âm ghi chú';
                btn.style.background = '';
                btn.style.color = '';
                btn.onclick = _startVoiceRecord;
            }
        }

        function _renderVoicePreview() {
            const wrap = document.getElementById('voicePreview');
            if (!wrap) return;
            if (!_voiceDataUrl) { wrap.innerHTML = ''; return; }
            wrap.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;background:#eff6ff;padding:6px 8px;border-radius:6px;margin-top:6px;">
                    <audio controls src="${_voiceDataUrl}" style="flex:1;height:32px;"></audio>
                    <button type="button" onclick="_clearVoice()" style="background:#fee2e2;color:#dc2626;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">✗ Xóa</button>
                </div>`;
        }

        let _qrLibPromise = null;

        function _loadQrLib() {
            if (window.Html5Qrcode) return Promise.resolve();
            if (_qrLibPromise) return _qrLibPromise;
            _qrLibPromise = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
                s.onload = resolve;
                s.onerror = () => { _qrLibPromise = null; reject(new Error('Không tải được html5-qrcode')); };
                document.head.appendChild(s);
            });
            return _qrLibPromise;
        }

        let _qrScanner = null;

        async function _openQrScanner() {
            document.getElementById('qrScannerModal').style.display = 'flex';
            try { await _loadQrLib(); }
            catch (err) { displayError('Lỗi tải QR lib: ' + err.message); _closeQrScanner(); return; }
            try {
                _qrScanner = new Html5Qrcode('qrReader');
                await _qrScanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 240, height: 240 } },
                    (decoded) => {
                        // Success — fill input and close
                        const nameInput = document.getElementById('markerNameInput');
                        if (nameInput) nameInput.value = decoded;
                        _closeQrScanner();
                        displayInfo('📷 Đã scan: ' + decoded);
                        // Trigger baseSelect refresh nếu có
                        if (typeof _fillBaseSelect === 'function') _fillBaseSelect();
                    },
                    () => {} // ignore no-scan frames
                );
            } catch (err) {
                displayError('Camera không truy cập được: ' + err.message);
                _closeQrScanner();
            }
        }

        async function _closeQrScanner() {
            document.getElementById('qrScannerModal').style.display = 'none';
            if (_qrScanner) {
                try { await _qrScanner.stop(); } catch {}
                try { _qrScanner.clear(); } catch {}
                _qrScanner = null;
            }
        }

        let _chartJsPromise = null;

        function _loadChartJs() {
            if (typeof Chart !== 'undefined') return Promise.resolve();
            if (_chartJsPromise) return _chartJsPromise;
            _chartJsPromise = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
                s.onload = resolve;
                s.onerror = () => { _chartJsPromise = null; reject(new Error('Không tải được Chart.js')); };
                document.head.appendChild(s);
            });
            return _chartJsPromise;
        }

        let _mapillaryViewer = null;

        let _mapillaryPromise = null;

        function _loadMapillaryJS() {
            if (typeof mapillary !== 'undefined') return Promise.resolve();
            if (_mapillaryPromise) return _mapillaryPromise;
            _mapillaryPromise = new Promise((resolve, reject) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.css';
                document.head.appendChild(link);
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/mapillary-js@4.1.2/dist/mapillary.js';
                s.onload = resolve;
                s.onerror = () => {
                    // Fallback to unpkg
                    const s2 = document.createElement('script');
                    s2.src = 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.js';
                    s2.onload = resolve;
                    s2.onerror = () => { _mapillaryPromise = null; reject(new Error('Không tải được thư viện Mapillary — kiểm tra kết nối mạng')); };
                    document.head.appendChild(s2);
                };
                document.head.appendChild(s);
            });
            return _mapillaryPromise;
        }

        function _setMapillaryStatus(icon, text, visible) {
            const el = document.getElementById('mapillaryStatus');
            if (!el) return;
            el.style.display = visible ? 'flex' : 'none';
            const iconEl = document.getElementById('mapillaryStatusIcon');
            const textEl = document.getElementById('mapillaryStatusText');
            if (iconEl) iconEl.textContent = icon;
            if (textEl) textEl.textContent = text;
        }

        async function _openMapillaryViewer(lat, lon, tenTru) {
            if (!MAPILLARY_TOKEN) {
                displayError('Chưa cấu hình MAPILLARY_TOKEN. Đăng ký tài khoản tại mapillary.com và điền token vào index.html.');
                return;
            }
            document.getElementById('mapillaryTitle').innerHTML = '<i class="fa fa-street-view"></i> Xem phố' + (tenTru ? ' — ' + tenTru : '');
            _setMapillaryStatus('⏳', 'Đang tải thư viện...', true);
            $('#mapillaryModal').modal('show');

            try {
                await _loadMapillaryJS();
                _setMapillaryStatus('🔍', 'Đang tìm ảnh gần nhất...', true);

                // Mapillary Graph API: closeto = lon,lat (GeoJSON order), dùng Authorization header
                const apiRes = await fetch(
                    `https://graph.mapillary.com/images?fields=id&lat=${lat}&lng=${lon}&radius=50&limit=1`,
                    { headers: { 'Authorization': 'OAuth ' + MAPILLARY_TOKEN } }
                );
                if (!apiRes.ok) {
                    const errBody = await apiRes.text().catch(() => '');
                    const msg = (() => { try { return JSON.parse(errBody).error?.message || errBody; } catch(e) { return errBody; } })();
                    throw new Error('API ' + apiRes.status + (msg ? ': ' + msg.slice(0, 120) : ''));
                }
                const apiData = await apiRes.json();

                if (!apiData.data || apiData.data.length === 0) {
                    _setMapillaryStatus('📷', 'Không có ảnh đường phố tại vị trí này.\nThử tìm kiếm trên mapillary.com', true);
                    return;
                }

                const imageId = apiData.data[0].id;
                _setMapillaryStatus('', '', false);

                const container = document.getElementById('mapillaryViewer');
                if (_mapillaryViewer) {
                    await _mapillaryViewer.moveTo(imageId);
                } else {
                    _mapillaryViewer = new mapillary.Viewer({
                        accessToken: MAPILLARY_TOKEN,
                        container,
                        imageId,
                        component: { cover: false, sequence: { visible: false } }
                    });
                }
            } catch(e) {
                _setMapillaryStatus('⚠️', 'Lỗi: ' + e.message, true);
            }
        }

        function _cleanupMapillary() {
            if (_mapillaryViewer) {
                _mapillaryViewer.remove();
                _mapillaryViewer = null;
            }
        }
