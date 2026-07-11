#!/usr/bin/env node
/**
 * Auto-record trailer.html → MP4 dùng Puppeteer + ffmpeg
 *
 * Setup:
 *   npm install puppeteer
 *   Cần ffmpeg trong PATH (winget install ffmpeg / brew install ffmpeg)
 *
 * Chạy:
 *   node record-trailer.js
 *
 * Output:
 *   lighting-survey-trailer.mp4 (1920x1080 30fps, ~10s render, ~30s video)
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TRAILER_URL = 'file://' + path.resolve(__dirname, 'trailer.html');
const OUTPUT = 'lighting-survey-trailer.mp4';
const DURATION_SEC = 31;
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

async function record() {
    console.log('🎬 Bắt đầu record trailer...');
    console.log('   URL:', TRAILER_URL);
    console.log('   Duration:', DURATION_SEC + 's');
    console.log('   Resolution: ' + WIDTH + 'x' + HEIGHT + ' @ ' + FPS + 'fps');

    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: { width: WIDTH, height: HEIGHT },
        args: ['--no-sandbox', '--disable-web-security']
    });
    const page = await browser.newPage();
    await page.goto(TRAILER_URL, { waitUntil: 'networkidle0' });

    // Ẩn controls overlay khi record
    await page.evaluate(() => {
        document.querySelector('.controls').style.display = 'none';
        // Reset stage transform để full 1920x1080
        document.querySelector('.stage').style.transform = 'none';
    });

    // Setup ffmpeg pipe
    const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f', 'image2pipe',
        '-r', String(FPS),
        '-i', '-',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '20',
        '-movflags', '+faststart',
        OUTPUT
    ]);

    ffmpeg.stderr.on('data', (data) => {
        const line = data.toString().trim();
        if (line.includes('frame=') && !line.includes('speed=')) return;
        console.log('[ffmpeg]', line.split('\n').pop());
    });

    const totalFrames = DURATION_SEC * FPS;
    console.log('   Total frames:', totalFrames);

    for (let i = 0; i < totalFrames; i++) {
        const buf = await page.screenshot({ type: 'jpeg', quality: 92, encoding: 'binary' });
        ffmpeg.stdin.write(buf);
        if (i % 30 === 0) {
            const pct = ((i / totalFrames) * 100).toFixed(1);
            process.stdout.write(`   Frame ${i}/${totalFrames} (${pct}%)\r`);
        }
    }
    console.log('\n   Encoding...');
    ffmpeg.stdin.end();
    await new Promise((res) => ffmpeg.on('close', res));
    await browser.close();

    const stats = fs.statSync(OUTPUT);
    console.log('✅ Xong!', OUTPUT, '(' + (stats.size / 1024 / 1024).toFixed(1) + ' MB)');
    console.log('\nBước tiếp:');
    console.log('  1. Upload YouTube: youtube.com/upload → paste ' + OUTPUT);
    console.log('  2. Get video ID → paste vào tutorial.html embedUrl');
    console.log('  3. Push GitHub → GitHub Pages auto deploy');
}

record().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
