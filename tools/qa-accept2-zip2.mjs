// 块B 第三轮：网络捕获(证明字体内联) + MutationObserver 细粒度进度 + 单张下载实测
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync, readdirSync, statSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DOWN_DIR = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/dl2';
mkdirSync(DOWN_DIR, { recursive: true });
for (const f of readdirSync(DOWN_DIR)) rmSync(DOWN_DIR + '/' + f, { recursive: true, force: true });

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');
await p.send('Network.enable');

// 网络捕获：Google Fonts CSS 与 woff2
const fontRequests = [];
p.on('Network.requestWillBeSent', (params) => {
  const u = params.request.url || '';
  if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) {
    fontRequests.push({url: u.slice(0, 160), ok: null});
  }
});
p.on('Network.responseReceived', (params) => {
  const u = params.response.url || '';
  if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) {
    fontRequests.push({url: u.slice(0, 160), status: params.response.status, mime: params.response.mimeType});
  }
});

const consoleErrors = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  if (/error|securityerror|inlining|uncaught|失败|超时/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,300)});
});
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push({type:'exception', text: (d.exception?.description || d.text || '').slice(0,300)});
});

await p.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWN_DIR, eventsEnabled: true });

await p.goto('http://localhost:3000', 4000);
await sleep(3000);

// 若不在排版页则重建（复用之前的 localStorage 内容应已在排版页）
let onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
if (!onFormat) {
  // 尝试返回编辑器再排版：找到「返回」
  const backBtn = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='返回');
    if(!b) return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  if (backBtn) {
    await p.mouseClick(backBtn.x, backBtn.y);
    await sleep(1500);
  }
  const fmtBtn = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
    if(!b) return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  if (fmtBtn) { await p.mouseClick(fmtBtn.x, fmtBtn.y); await sleep(4000); }
  onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
}
console.log('ON FORMAT:', onFormat);

const before = await p.eval(`(()=>{
  const cards = [...document.querySelectorAll('.card-outer-container')].length;
  const m = document.body.innerText.match(/共\\s*(\\d+)\\s*张/);
  return {cardsCount: cards, pageInfo: m?m[0]:null};
})()`);
console.log('BEFORE:', JSON.stringify(before));

// 在页面里注入 MutationObserver 记录下载按钮文本变化（细粒度）
await p.eval(`(()=>{
  window.__labelLog = [];
  const obs = new MutationObserver(() => {
    const b = [...document.querySelectorAll('button')].find(x=>/一键下载|下载全部|准备|正在生成|打包|完成|失败/.test(x.innerText.trim()));
    if (b) {
      const t = b.innerText.trim();
      if (window.__labelLog[window.__labelLog.length-1] !== t) window.__labelLog.push(t + ' @' + Math.round(performance.now()));
    }
  });
  obs.observe(document.body, {subtree: true, childList: true, characterData: true});
  window.__labelObs = obs;
  true;
})()`);

// 点 zip 下载
const t0 = Date.now();
await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/一键下载|下载全部/.test(b.innerText.trim()));
  b.click();
  return b.innerText.trim();
})()`).then(r => console.log('CLICKED, label:', r));

// 轮询 dl2 目录
let finalFiles = [];
for (let i=0; i<80; i++) {
  await sleep(500);
  const files = readdirSync(DOWN_DIR).filter(f => f.endsWith('.zip') || f.endsWith('.png'));
  if (files.length) { finalFiles = files; console.log(`zip ready after ${(Date.now()-t0)/1000}s: ${files.join(',')}`); break; }
  if (i%6===0) console.log(`  ${i*0.5}s waiting...`);
}
await sleep(1000);
const labels = await p.eval(`window.__labelLog || []`);
console.log('LABEL LOG:', JSON.stringify(labels, null, 2));
console.log('FONT REQUESTS:', JSON.stringify(fontRequests, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));

// 等待文件写完后验证
await sleep(1200);
const zipFile = finalFiles.find(f=>f.endsWith('.zip'));
let zipOk = false;
if (zipFile) {
  const zipPath = DOWN_DIR + '/' + zipFile;
  const st = statSync(zipPath);
  console.log('ZIP:', zipFile, st.size, 'bytes');
  // python unzip + 检查
  try {
    const out = execSync(`python3 -c "
import zipfile, json
zf = zipfile.ZipFile('${zipPath}')
names = zf.namelist()
info = []
for n in names:
    d = zf.read(n)
    w = int.from_bytes(d[16:20],'big') if d[:8]==b'\\x89PNG\\r\\n\\x1a\\n' and len(d)>=24 else -1
    h = int.from_bytes(d[20:24],'big') if d[:8]==b'\\x89PNG\\r\\n\\x1a\\n' and len(d)>=24 else -1
    info.append({'name': n, 'size': len(d), 'w': w, 'h': h})
print(json.dumps(info))
"`).toString();
    console.log('ZIP CONTENT:', out);
    zipOk = true;
  } catch (e) { console.log('unzip check failed:', e.message?.slice(0,200)); }
}

// ── 单张「下载此图」实测 ──
const dlSingleDir = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/dl-single';
mkdirSync(dlSingleDir, { recursive: true });
for (const f of readdirSync(dlSingleDir)) rmSync(dlSingleDir + '/' + f, { force: true });
await p.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlSingleDir, eventsEnabled: true });

// 等 zip 完成 UI 复位
await sleep(1500);
// 点击第一张卡片的「下载此图」（hover 显示，直接用 click 触发）
await p.eval(`(()=>{
  const slot = document.querySelectorAll('.card-display-slot')[0];
  if (!slot) return false;
  const btn = slot.querySelector('button[title="下载此图"]');
  if (!btn) return false;
  btn.click();
  return true;
})()`).then(r => console.log('SINGLE CLICK:', r));

let singleFiles = [];
for (let i=0; i<60; i++) {
  await sleep(500);
  const files = readdirSync(dlSingleDir).filter(f => f.endsWith('.png'));
  if (files.length) { singleFiles = files; console.log(`single png ready after ${(i+1)*0.5}s: ${files.join(',')}`); break; }
}
await sleep(1000);
console.log('SINGLE FILES:', JSON.stringify(singleFiles));
if (singleFiles.length) {
  const f = singleFiles[0];
  const buf = readFileSync(dlSingleDir + '/' + f);
  const w = buf.length >= 24 ? buf.readUInt32BE(16) : -1;
  const h = buf.length >= 24 ? buf.readUInt32BE(20) : -1;
  console.log(`SINGLE PNG: ${buf.length} bytes, ${w}x${h}`);
}

// 截图
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/04-after-single.png');

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/zip-round2-result.json', JSON.stringify({
  before, labels, fontRequests, consoleErrors, zipFile, singleFiles,
  duration: Date.now() - t0
}, null, 2));
console.log('SAVED result json');
p.close();
process.exit(0);
