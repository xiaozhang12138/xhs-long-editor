// 块C 预览缩放：1462x664 视口 → 双卡一屏可见；滑块/圆点；点击编辑；resize 实时重算
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');

const consoleErrors = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  if (/error|uncaught|security/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,200)});
});

// 设置视口 1462x664
await p.send('Emulation.setDeviceMetricsOverride', { width: 1462, height: 664, deviceScaleFactor: 1, mobile: false });
await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// 确保在排版页
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
onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
console.log('ON FORMAT:', onFormat);

// 断言1：双卡 rect ≤ 视口，一屏完整可见
const vpCheck = await p.eval(`(()=>{
  const vp = document.querySelector('.card-scroll-viewport');
  const vpr = vp.getBoundingClientRect();
  const slots = [...document.querySelectorAll('.card-display-slot')];
  const slotRects = slots.map(s=>{
    const r = s.getBoundingClientRect();
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom)};
  });
  const cards = [...document.querySelectorAll('.card-outer-container')];
  const cardRects = cards.map(c=>{
    const r = c.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height)};
  });
  const scaleText = document.body.innerText.match(/预览缩放\\s*(\\d+)%/);
  const vw = window.innerWidth, vh = window.innerHeight;
  // 可见性：前两张卡（0 和 1）是否完整在视口内
  const visible = slotRects.slice(0,2).map(r=>{
    return {fullyVisible: r.x >= 0 && r.y >= 0 && r.right <= vw && r.bottom <= vh,
            inViewportX: r.x >= 0 && r.right <= vw,
            inViewportY: r.y >= 0 && r.bottom <= vh};
  });
  return {viewport: {w: vw, h: vh}, slotRects: slotRects.slice(0,3), cardRects: cardRects.slice(0,3),
          scaleText: scaleText ? scaleText[1]+'%' : null, visible, totalCards: cards.length};
})()`);
console.log('VP CHECK:', JSON.stringify(vpCheck, null, 2));

// 截图
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/c1-viewport-1462x664.png');

// 断言2：拖动滑块到最后一卡
await p.eval(`(()=>{
  const range = document.querySelector('input[type="range"]');
  if (range) {
    range.value = range.max;
    range.dispatchEvent(new Event('change', {bubbles: true}));
    // React onChange 用 input 事件
    range.dispatchEvent(new Event('input', {bubbles: true}));
  }
  return true;
})()`);
await sleep(1200);
const sliderCheck = await p.eval(`(()=>{
  const dots = [...document.querySelectorAll('.card-dot')];
  const active = dots.findIndex(d=>d.classList.contains('active'));
  const range = document.querySelector('input[type="range"]');
  const scrolled = document.querySelector('.card-scroll-viewport');
  return {activeDot: active, rangeMax: range?.max, rangeVal: range?.value, scrollLeft: Math.round(scrolled?.scrollLeft||0)};
})()`);
console.log('SLIDER CHECK:', JSON.stringify(sliderCheck));

// 断言3：点圆点回第 0 张
await p.eval(`(()=>{
  const dot = document.querySelectorAll('.card-dot')[0];
  if (dot) dot.click();
  return true;
})()`);
await sleep(1200);
const dotCheck = await p.eval(`(()=>{
  const active = [...document.querySelectorAll('.card-dot')].findIndex(d=>d.classList.contains('active'));
  return {activeDot: active};
})()`);
console.log('DOT CHECK:', JSON.stringify(dotCheck));

// 断言4：点击卡片文字 → contenteditable 激活
await p.eval(`(()=>{
  const slot = document.querySelectorAll('.card-display-slot')[1];
  const content = slot?.querySelector('.xhs-card-content');
  const r = content?.getBoundingClientRect();
  if (!r) return false;
  const x = Math.round(r.x + Math.min(80, r.width/2));
  const y = Math.round(r.y + Math.min(60, r.height/2));
  const ev = new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: x, clientY: y});
  slot.dispatchEvent(ev);
  return true;
})()`);
await sleep(800);
const editCheck = await p.eval(`(()=>{
  const active = [...document.querySelectorAll('.card-display-slot')].findIndex(s=>s.querySelector('.xhs-card-content[contenteditable="true"]'));
  const ce = document.querySelector('.xhs-card-content[contenteditable="true"]');
  const hint = document.body.innerText.includes('编辑中');
  return {activeIndex: active, contenteditable: !!ce, hintShown: hint};
})()`);
console.log('EDIT CHECK:', JSON.stringify(editCheck));
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/c2-edit-mode.png');

// 断言5：resize 到 1920x1080 → scale 变化、卡片仍可见
await p.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await sleep(2000);
const resizeCheck = await p.eval(`(()=>{
  const vp = document.querySelector('.card-scroll-viewport');
  const vpr = vp.getBoundingClientRect();
  const slots = [...document.querySelectorAll('.card-display-slot')];
  const slotRects = slots.slice(0,2).map(s=>{
    const r = s.getBoundingClientRect();
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom)};
  });
  const scaleText = document.body.innerText.match(/预览缩放\\s*(\\d+)%/);
  const vw = window.innerWidth, vh = window.innerHeight;
  const visible = slotRects.map(r=> r.x >= 0 && r.y >= 0 && r.right <= vw && r.bottom <= vh);
  return {viewport: {w: vw, h: vh}, scaleText: scaleText?scaleText[1]+'%':null, slotRects, allFullyVisible: visible.every(Boolean)};
})()`);
console.log('RESIZE CHECK:', JSON.stringify(resizeCheck, null, 2));
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/c3-resize-1920x1080.png');

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockC-result.json', JSON.stringify({vpCheck, sliderCheck, dotCheck, editCheck, resizeCheck, consoleErrors}, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
p.close();
process.exit(0);
