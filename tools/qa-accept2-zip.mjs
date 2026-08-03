// 块B 第二步：设下载目录 → 点一键下载全部 zip → 轮询 → 解包 → 断言
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync, readdirSync, statSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DOWN_DIR = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/dl';
mkdirSync(DOWN_DIR, { recursive: true });
for (const f of readdirSync(DOWN_DIR)) {
  if (f.endsWith('.zip') || f.endsWith('.png') || f.endsWith('.crdownload')) {
    rmSync(DOWN_DIR + '/' + f, { force: true });
  }
}

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');

const consoleErrors = [];
const consoleAll = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  consoleAll.push({type: params.type, text: txt.slice(0,400)});
  if (/error|security|warn|inlining|timeout|fetch|uncaught/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,400)});
});
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push({type: 'exception', text: (d.exception?.description || d.text || '').slice(0,400)});
});

await p.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWN_DIR, eventsEnabled: true });
console.log('download behavior set ->', DOWN_DIR);

const downloadEvents = [];
p.on('Browser.downloadWillBegin', (params) => downloadEvents.push({type: 'begin', ...params}));
p.on('Browser.downloadProgress', (params) => downloadEvents.push({type: 'progress', ...params}));
p.on('Browser.downloadCompleted', (params) => downloadEvents.push({type: 'completed', ...params}));

await p.goto('http://localhost:3000', 4000);
await sleep(3000);

const stage = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
console.log('on format page:', stage);

if (!stage) {
  await p.eval(`localStorage.clear(); true`);
  await p.eval(`location.reload(); true`);
  await sleep(5000);
  // 健壮等 title input 出现
  let titleRes = null;
  for (let i=0; i<10; i++) {
    titleRes = await p.eval(`(()=>{
      const el = document.querySelector('input[placeholder*="标题"]') || document.querySelector('input[type="text"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return null;
      return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
    })()`);
    if (titleRes) break;
    await sleep(500);
  }
  if (!titleRes) { console.log('TITLE INPUT NOT FOUND'); p.close(); process.exit(2); }
  await p.mouseClick(titleRes.x, titleRes.y);
  await sleep(300);
  await p.type('QA验收·长文下载实测');
  await sleep(300);
  let bodyRes = null;
  for (let i=0; i<10; i++) {
    bodyRes = await p.eval(`(()=>{
      const el = document.querySelector('.prose-editor');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 10) return null;
      return {x:Math.round(r.x+Math.min(200,r.width/2)), y:Math.round(r.y+Math.min(120,r.height/2))};
    })()`);
    if (bodyRes) break;
    await sleep(500);
  }
  if (!bodyRes) { console.log('BODY NOT FOUND'); p.close(); process.exit(2); }
  await p.mouseClick(bodyRes.x, bodyRes.y);
  await sleep(300);
  const sentences = [
    '秋天是一个适合远行的季节，天空高远而澄澈，风里带着干爽的草木气息。',
    '沿着山路慢慢向上走，两侧的枫叶已经染上了深浅不一的红色，像一幅被时间晕染过的画。',
    '我习惯在出发前把路线仔细规划一遍，查好天气，准备好水和干粮，也留出足够的时间用来迷路。',
    '旅行最迷人的部分往往不是到达目的地，而是那些计划之外的瞬间：一只松鼠忽然从树梢跃过，一场细雨把山色洗得更加清透。',
    '傍晚的时候，我在山脚的小镇里找到一家临街的茶馆，老板是个健谈的中年人，一边煮茶一边讲起这座山的故事。',
    '他说这里以前是商队必经的驿站，人来人往，马蹄声和吆喝声从早响到晚。',
    '如今公路修通了，小镇安静下来，只剩下偶尔路过的旅人，像我们一样，为了一杯热茶停下来。',
    '我记下这些片段，用手机拍了几张照片，也把它们写进日记里。',
    '写字的习惯是从大学时候养成的，那时候喜欢在图书馆的角落待到闭馆，把读到的句子抄在本子上。',
    '后来工作忙碌，抄写变成了敲键盘，但那份安静的心情一直没有变。',
    '我想，所谓记录生活，并不是要把每一天都过得轰轰烈烈，而是愿意在平凡的时刻停下脚步，看一看身边的风景。',
    '清晨的露水，午后的阳光，夜晚的灯火，都值得被认真对待。',
    '这趟旅程走了三天，回程的车上我翻看相册，发现拍得最多的并不是风景，而是那些被我忽略的细节。',
    '一只猫蹲在墙角打盹，晾衣绳上挂着的白衬衫随风摆动，旧书店门口的木牌上写着「今日有风」。',
    '这些画面让我想起小时候的夏天，外婆坐在院子里摇着蒲扇，一边赶蚊子一边给我讲她年轻时的故事。',
    '时间过得很快，有些记忆却像河底的石头，水流走了，它们还静静地留在那里。',
    '我把这趟旅行的照片整理成一本小册子，在封面写上日期和地点，也算是对这段时光的一个交代。',
    '朋友问我为什么这么喜欢记录，我想了很久，回答说：因为日子会过去，而文字和照片能留住一部分真实。',
    '哪怕只是一小部分，也足够在多年以后，让我们重新想起那些被风吹过的下午。',
  ];
  let text = '';
  while (text.length < 1700) {
    for (const s of sentences) { text += s + '\n'; if (text.length >= 1750) break; }
  }
  await p.type(text);
  await sleep(800);
  const fmtBtn = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  await p.mouseClick(fmtBtn.x, fmtBtn.y);
  await sleep(5000);
}

const before = await p.eval(`(()=>{
  const m = document.body.innerText.match(/共\\s*(\\d+)\\s*张/);
  const cards = [...document.querySelectorAll('.card-outer-container')].length;
  return {pageInfo: m?m[0]:null, cardsCount: cards};
})()`);
console.log('BEFORE CLICK:', JSON.stringify(before));

const liveBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/一键下载|下载全部|打包|zip|准备|生成|完成/.test(b.innerText.trim()));
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {label: b.innerText.trim(), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
console.log('LIVE BTN:', JSON.stringify(liveBtn));

const labels = [];
const t0 = Date.now();
await p.mouseClick(liveBtn.x, liveBtn.y);
console.log('clicked at', t0);

const pollLabels = async () => {
  for (let i=0; i<60; i++) {
    await sleep(500);
    const lbl = await p.eval(`(()=>{
      const b=[...document.querySelectorAll('button')].find(b=>/一键下载|下载全部|打包|zip|准备|生成|完成|失败/.test(b.innerText.trim()));
      return b?.innerText.trim() || null;
    })()`);
    if (lbl && labels[labels.length-1] !== lbl) labels.push(lbl);
    const files = readdirSync(DOWN_DIR).filter(f => f.endsWith('.zip') || f.endsWith('.png') || f.endsWith('.crdownload'));
    if (files.length > 0) {
      console.log(`after ${(Date.now()-t0)/1000}s: files=${files.join(',')}`);
      return files;
    }
    if (i>10 && i%10===0) console.log(`  ${i*0.5}s: label=${lbl}`);
  }
  return readdirSync(DOWN_DIR).filter(f => f.endsWith('.zip') || f.endsWith('.png'));
};
const finalFiles = await pollLabels();
console.log('FINAL FILES:', JSON.stringify(finalFiles));
console.log('DURATION LABELS:', JSON.stringify(labels));

await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/03-after-zip.png');

await sleep(1500);

const zipFile = finalFiles.find(f => f.endsWith('.zip'));
console.log('ZIP FILE:', zipFile);
if (!zipFile) {
  console.log('NO ZIP FOUND! contents:', readdirSync(DOWN_DIR));
  writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/console-zip.json', JSON.stringify({errors: consoleErrors, all: consoleAll.slice(0,30), events: downloadEvents, labels}, null, 2));
  p.close(); process.exit(1);
}

const zipPath = DOWN_DIR + '/' + zipFile;
const zipStat = statSync(zipPath);
console.log('ZIP SIZE:', zipStat.size, 'bytes');

const unzipDir = DOWN_DIR + '/unzipped';
rmSync(unzipDir, { recursive: true, force: true });
mkdirSync(unzipDir, { recursive: true });
try {
  execSync(`unzip -o -q "${zipPath}" -d "${unzipDir}"`, { stdio: 'pipe' });
} catch (e) {
  console.log('unzip failed:', e.message?.slice(0, 200));
}

const unzipped = readdirSync(unzipDir);
console.log('UNZIPPED FILES:', JSON.stringify(unzipped));

const pngs = unzipped.filter(f => f.endsWith('.png'));
console.log('PNG COUNT:', pngs.length, 'expected >=', before.cardsCount);

const pngInfo = pngs.map(f => {
  const buf = readFileSync(unzipDir + '/' + f);
  const size = buf.length;
  if (buf.length < 24) return {f, size, err: 'too small'};
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return {f, size, w, h};
});
console.log('PNG INFO:', JSON.stringify(pngInfo, null, 2));

const first = pngInfo[0];
console.log('FIRST PNG:', first && `${first.size} bytes, ${first.w}x${first.h}`);

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/zip-result.json', JSON.stringify({
  before, liveBtn, finalFiles, zipFile, zipSize: zipStat.size,
  pngCount: pngs.length, expectedCount: before.cardsCount,
  pngInfo, consoleErrors, downloadEvents,
  labels, duration: Date.now() - t0
}, null, 2));

console.log('DONE. console errors:', JSON.stringify(consoleErrors, null, 2));
p.close();
process.exit(0);
