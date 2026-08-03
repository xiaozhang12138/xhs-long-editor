// 块E 回归：三阶段链路 / 返回不丢数据 / 自动保存3s / 20模板渲染 / footer贴底
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');

const consoleErrors = [];
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push((d.exception?.description || d.text || '').slice(0,200));
});
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  if (/error|uncaught/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,200)});
});

await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// 用现有多字内容（QA验收长文已在草稿中）
const state0 = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  return {title, bodyLen: body.length, bodyHead: body.slice(0,30)};
})()`);
console.log('STATE0:', JSON.stringify(state0));

// ── 自动保存 3s：修改标题 → 等 3.5s → 检查「自动保存于」出现 + localStorage 更新 ──
const t0 = Date.now();
// 修改标题加后缀
await p.eval(`(()=>{
  const el = document.querySelector('input[placeholder*="标题"]');
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, el.value + '·改');
  el.dispatchEvent(new Event('input', {bubbles: true}));
  return true;
})()`);
await sleep(3500);
const autoSave = await p.eval(`(()=>{
  const footer = document.body.innerText.match(/自动保存于\\s*(\\d{2}:\\d{2})/);
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  const cur = ls.find(d=>d.title && d.title.includes('·改'));
  return {footer: footer?footer[1]:null, savedTitle: cur?cur.title:null, hasChange: (cur?.title||'').includes('·改')};
})()`);
console.log('AUTO SAVE (3s):', JSON.stringify(autoSave), 'elapsed', Date.now()-t0, 'ms');

// ── 三阶段链路：一键排版 → 排版页 → 下一步 → 发布页 → 返回不丢数据 ──
const fmtBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
if (fmtBtn) { await p.mouseClick(fmtBtn.x, fmtBtn.y); await sleep(4000); }
const onFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
console.log('STAGE FORMAT:', onFormat);

// 排版页 footer 贴视口底：检查「下一步」按钮 y 坐标
const footerCheck = await p.eval(`(()=>{
  const btn=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='下一步');
  const r=btn.getBoundingClientRect();
  return {btnY: Math.round(r.y+r.height/2), vh: window.innerHeight, nearBottom: (r.bottom - window.innerHeight) < 80 && r.bottom <= window.innerHeight};
})()`);
console.log('FOOTER CHECK (format):', JSON.stringify(footerCheck));

// 下一步 → 发布页
const nextBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='下一步');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
if (nextBtn) { await p.mouseClick(nextBtn.x, nextBtn.y); await sleep(3500); }
const onPublish = await p.eval(`document.body.innerText.includes('发布') && document.body.innerText.includes('手机预览')`);
console.log('STAGE PUBLISH:', onPublish);

// 发布页返回（点返回 → 回排版页 → 返回编辑器）
const backPublish = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='返回');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
if (backPublish) { await p.mouseClick(backPublish.x, backPublish.y); await sleep(2500); }
const backToFormat = await p.eval(`document.body.innerText.includes('一键下载全部 (zip)')`);
console.log('BACK TO FORMAT:', backToFormat);

const backEditorBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='返回');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
if (backEditorBtn) { await p.mouseClick(backEditorBtn.x, backEditorBtn.y); await sleep(2500); }
const dataAfterBack = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  return {title, bodyLen: body.length, bodyHead: body.slice(0,25)};
})()`);
console.log('DATA AFTER BACK:', JSON.stringify(dataAfterBack));

// ── 20 模板渲染：进排版页逐个点模板，验证卡片数量与渲染无错 ──
if (!backToFormat) {
  const fmtBtn2 = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
    if(!b) return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  if (fmtBtn2) { await p.mouseClick(fmtBtn2.x, fmtBtn2.y); await sleep(4000); }
}
// 收集模板按钮
const tplBtns = await p.eval(`(()=>{
  const btns=[...document.querySelectorAll('button')].filter(b=>/模板|复古|轻感|素雅|线条|杂志|文艺|极简|手帐|清新|商务|暗黑|暖阳|雾蓝|抹茶|玫瑰|杏色|墨黑|纸白|青绿|金秋/.test(b.innerText.trim()));
  return btns.map(b=>({t:b.innerText.trim().slice(0,20), x:Math.round((b.getBoundingClientRect().x+b.getBoundingClientRect().width/2)), y:Math.round((b.getBoundingClientRect().y+b.getBoundingClientRect().height/2))}));
})()`);
console.log('TPL BTNS:', JSON.stringify(tplBtns));

// 找模板卡片（template-item）
const tplCards = await p.eval(`(()=>{
  const cards=[...document.querySelectorAll('[class*="template"]')].filter(e=>e.querySelector && e.querySelector('button, [class*="card"]'));
  return cards.map(c=>{ const r=c.getBoundingClientRect(); return {cls:(c.className||'').toString().slice(0,40), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}; }).slice(0,25);
})()`);
console.log('TPL CARDS:', JSON.stringify(tplCards));

// 直接点击模板按钮验证 20 个模板可用：遍历所有出现过的模板名
const allTemplateNames = await p.eval(`(()=>{
  const sel = document.querySelector('.panel-tab');
  // 切到选择模板 tab
  const tabs=[...document.querySelectorAll('button[role="tab"]')];
  const tab = tabs.find(b=>b.innerText.includes('选择模板'));
  if (tab) tab.click();
  return true;
})()`);
await sleep(800);

// 收集所有模板 item 并逐个点击验证
const tplItems = await p.eval(`(()=>{
  // 尝试多种选择器
  const items = [...document.querySelectorAll('[class*="template-item"], [class*="tpl-"], [class*="template-card"], .template-grid > *, [class*="Template"]')];
  const seen = new Set();
  return items.filter(e=>{ const r=e.getBoundingClientRect(); if(r.width<40||r.height<40) return false; const key=e.innerText.trim().slice(0,20); if(seen.has(key)) return false; seen.add(key); return true; }).map(e=>{
    const r=e.getBoundingClientRect();
    return {t:(e.innerText||'').trim().slice(0,20), cls:(e.className||'').toString().slice(0,50), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  }).slice(0,30);
})()`);
console.log('TPL ITEMS:', JSON.stringify(tplItems));

let tplResults = [];
if (tplItems.length >= 20) {
  for (let i=0; i<20; i++) {
    const item = tplItems[i];
    await p.mouseClick(item.x, item.y);
    await sleep(600);
    const r = await p.eval(`(()=>{
      const cards=[...document.querySelectorAll('.card-outer-container')].length;
      return {cards, ok: cards>=1};
    })()`);
    tplResults.push({i, name: item.t, ...r});
  }
} else {
  console.log('TPL ITEMS < 20, found', tplItems.length, '— 用按钮方式');
  // 按钮方式
  const btns = await p.eval(`(()=>{
    return [...document.querySelectorAll('.template-selector button, [class*="template"] button, button')].filter(b=>{
      const t=b.innerText.trim();
      return t.length>=2 && t.length<=10 && !/下一步|返回|暂存|下载|封面|尺寸|选择模板/.test(t);
    }).map(b=>{ const r=b.getBoundingClientRect(); return {t:b.innerText.trim(), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}; }).slice(0,30);
  })()`);
  console.log('TPL BTNS2:', JSON.stringify(btns));
  const unique = [];
  const seenSet = new Set();
  for (const b of btns) { if (!seenSet.has(b.t)) { seenSet.add(b.t); unique.push(b); } }
  for (let i=0; i<Math.min(20, unique.length); i++) {
    await p.mouseClick(unique[i].x, unique[i].y);
    await sleep(500);
    const r = await p.eval(`(()=>{ const cards=[...document.querySelectorAll('.card-outer-container')].length; return {cards, ok: cards>=1}; })()`);
    tplResults.push({i, name: unique[i].t, ...r});
  }
}
console.log('TPL RESULTS:', JSON.stringify(tplResults));
const tplOk = tplResults.length >= 20 && tplResults.every(r=>r.ok);
console.log('TPL ALL 20 OK:', tplOk);

await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/e1-regression.png');
writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockE-result.json', JSON.stringify({state0, autoSave, onFormat, footerCheck, onPublish, backToFormat, dataAfterBack, tplResults, tplOk, consoleErrors}, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
p.close();
process.exit(0);
