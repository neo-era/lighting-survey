// Đợt 5: CSS nội tuyến tách ra src/styles/app.css, link trong <head>, precache SW.
// Kiểm: không còn <style> trong index.html; có <link app.css>; app.css tồn tại & gộp đủ CSS; precache có.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(REPO,'index.html'),'utf8');
const sw = fs.readFileSync(path.join(REPO,'sw.js'),'utf8');
let pass=0, fail=0; const ok=(n,c)=>{c?pass++:fail++;console.log((c?'✓ ':'✗ ')+n);};
ok('index.html KHÔNG còn khối <style> nội tuyến', !/<style[\s>]/.test(html));
ok('index.html có <link ... src/styles/app.css>', /<link[^>]+href="src\/styles\/app\.css"/.test(html));
const cssPath = path.join(REPO,'src/styles/app.css');
ok('src/styles/app.css tồn tại', fs.existsSync(cssPath));
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath,'utf8');
  ok('app.css không rỗng (>5KB)', css.length>5000);
  ok('app.css giữ CSS updateBanner (#updateBanner)', /#updateBanner/.test(css));
}
ok('sw.js precache có src/styles/app.css', sw.includes("'src/styles/app.css'"));
console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail>0?1:0);
