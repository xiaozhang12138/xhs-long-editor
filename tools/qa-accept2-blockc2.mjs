// 块C 补充：真实鼠标操作验证 slider / 圆点 / 点击编辑
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');
await p.send('Emulation.setDeviceMetricsOverride', { width: 1462, height: 664, deviceScaleFactor: 1, mobile: false });
await p.goto('http://localhost:3000', 3500);
await sleep(2500);

let onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
if (!onFormat) {
  const fmtBtn = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
    if(!b) return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  if (fmtBtn) { await p.mouseClick(fmtBtn.x, fmtBtn.y); await sleep(4000); }
}
console.log('ON FORMAT:', await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`));

// 1) 真实点击第 3 个圆点（index 2，最后一张）
const dot2 = await p.eval(`(()=>{
  const d = document.querySelectorAll('.card-dot')[2];
  if(!d) return null;
  const r = d.getBoundingClientRect();
  return {x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)};
})()`);
console.log('DOT2 POS:', JSON.stringify(dot2));
if (dot2) {
  await p.mouseClick(dot2.x, dot2.y);
  await sleep(1500);
}
const afterDot = await p.eval(`(()=>{
  const active = [...document.querySelectorAll('.card-dot')].findIndex(d=>d.classList.contains('active'));
  const vp = document.querySelector('.card-scroll-viewport');
  return {activeDot: active, scrollLeft: Math.round(vp?.scrollLeft||0)};
})()`);
console.log('AFTER DOT CLICK:', JSON.stringify(afterDot));

// 2) 拖动滑块到最右（真实 Input 拖动：按住滑块 thumb → 移到轨道右端）
const sliderDrag = await p.eval(`(()=>{
  const range = document.querySelector('input[type="range"]');
  if (!range) return null;
  const r = range.getBoundingClientRect();
  return {x0: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), left: Math.round(r.x), right: Math.round(r.right)};
})()`);
console.log('SLIDER POS:', JSON.stringify(sliderDrag));
if (sliderDrag) {
  // 鼠标按下在滑块中心，然后移动到轨道最右端
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sliderDrag.x0, y: sliderDrag.y });
  await sleep(200);
  await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sliderDrag.x0, y: sliderDrag.y, button: 'left', clickCount: 1 });
  await sleep(200);
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sliderDrag.right - 2, y: sliderDrag.y, button: 'left', buttons: 1 });
  await sleep(200);
  await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sliderDrag.right - 2, y: sliderDrag.y, button: 'left', clickCount: 1 });
  await sleep(1500);
}
const afterSlider = await p.eval(`(()=>{
  const active = [...document.querySelectorAll('.card-dot')].findIndex(d=>d.classList.contains('active'));
  const vp = document.querySelector('.card-scroll-viewport');
  const range = document.querySelector('input[type="range"]');
  return {activeDot: active, scrollLeft: Math.round(vp?.scrollLeft||0), rangeVal: range?.value};
})()`);
console.log('AFTER SLIDER DRAG:', JSON.stringify(afterSlider));

// 3) 真实点击卡片正文 → contenteditable 激活
const cardPos = await p.eval(`(()=>{
  const slot = document.querySelectorAll('.card-display-slot')[1];
  const content = slot?.querySelector('.xhs-card-content');
  if (!content) return null;
  const r = content.getBoundingClientRect();
  return {x: Math.round(r.x + Math.min(80, r.width/2)), y: Math.round(r.y + Math.min(50, r.height/2))};
})()`);
console.log('CARD CONTENT POS:', JSON.stringify(cardPos));
if (cardPos) {
  await p.mouseClick(cardPos.x, cardPos.y);
  await sleep(1200);
}
const editCheck = await p.eval(`(()=>{
  const ce = document.querySelector('.xhs-card-content[contenteditable="true"]');
  const hint = document.body.innerText.includes('编辑中');
  const toolbar = document.body.innerText.includes('退出编辑');
  return {contenteditable: !!ce, hintShown: hint, toolbarShown: toolbar};
})()`);
console.log('EDIT CHECK:', JSON.stringify(editCheck));

// 4) 点击编辑态下输入文字 → merge-back 生效
if (editCheck.contenteditable) {
  // 在活动卡片末尾 append 文字
  await p.eval(`(()=>{
    const ce = document.querySelector('.xhs-card-content[contenteditable="true"]');
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(ce);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    ce.focus();
    return true;
  })()`);
  await p.type('追加测试句');
  await sleep(1500); // 等 debounce merge-back
  const merged = await p.eval(`(()=>{
    const texts = [...document.querySelectorAll('.xhs-card-content')].map(c=>c.innerText).filter(Boolean);
    const hasNew = texts.some(t=>t.includes('追加测试句'));
    const stage = document.body.innerText.includes('一键下载全部 (zip)');
    return {hasNew, sampleCount: texts.length, firstSample: (texts[0]||'').slice(0,50)};
  })()`);
  console.log('MERGE-BACK CHECK:', JSON.stringify(merged));
  await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/c4-edit-merged.png');
} else {
  console.log('SKIP merge-back: edit did not activate');
}

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockC-real-result.json', JSON.stringify({dot2, afterDot, sliderDrag, afterSlider, cardPos, editCheck}, null, 2));
p.close();
process.exit(0);
