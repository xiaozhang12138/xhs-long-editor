// 块D1 草稿列表：新建A → 填内容 → 新建B → 切回A 内容保留 → 两步删除 → 刷新恢复最近草稿
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
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push({type:'exception', text: (d.exception?.description || d.text || '').slice(0,200)});
});

await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// 清空存储，全新开始
await p.eval(`localStorage.clear(); location.reload(); true`);
await sleep(4000);

async function typeTitle(text) {
  const pos = await p.eval(`(()=>{
    const el = document.querySelector('input[placeholder*="标题"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)};
  })()`);
  if (!pos) return false;
  await p.mouseClick(pos.x, pos.y);
  await sleep(300);
  // 清空已有
  await p.key('a', 1); // ctrl+a
  await sleep(100);
  await p.key('Delete');
  await sleep(100);
  await p.type(text);
  await sleep(300);
  return true;
}

async function typeBody(text) {
  const pos = await p.eval(`(()=>{
    const el = document.querySelector('.prose-editor');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.x+Math.min(150,r.width/2)), y: Math.round(r.y+Math.min(80,r.height/2))};
  })()`);
  if (!pos) return false;
  await p.mouseClick(pos.x, pos.y);
  await sleep(300);
  await p.type(text);
  await sleep(300);
  return true;
}

// 初始应有 1 个空草稿
const init = await p.eval(`(()=>{
  const n = [...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
  return n ? n.innerText : null;
})()`);
console.log('INIT DRAFT COUNT BTN:', JSON.stringify(init));

// 草稿A：填标题+正文
await typeTitle('草稿A标题');
await typeBody('这是草稿A的正文内容，用来验证多草稿切换后内容是否保留。');
await sleep(500);

// 打开草稿列表 → 新建草稿B
await p.eval(`(()=>{
  const b = [...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
  b.click(); return true;
})()`);
await sleep(800);
const panel = await p.eval(`(()=>{
  const box = document.querySelector('.draft-panel, [class*="draft"]');
  const btns = [...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(t=>t);
  const titles = [...document.querySelectorAll('.draft-item, [class*="draft-item"]')].map(e=>e.innerText).filter(Boolean);
  return {btns: btns.slice(0,15), titles: titles.slice(0,5), hasPanel: !!box};
})()`);
console.log('DRAFT PANEL:', JSON.stringify(panel, null, 2));

// 点「新建草稿」
const created = await p.eval(`(()=>{
  const b = [...document.querySelectorAll('button')].find(b=>/新建草稿/.test(b.innerText));
  if (!b) return false;
  b.click(); return true;
})()`);
console.log('CLICK NEW DRAFT:', created);
await sleep(1500);

// 草稿B：填内容
await typeTitle('草稿B标题');
await typeBody('这是草稿B的正文内容。');
await sleep(800);

// 打开草稿列表 → 切回草稿A
await p.eval(`(()=>{
  const b = [...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
  b.click(); return true;
})()`);
await sleep(800);
const switchOk = await p.eval(`(()=>{
  const items = [...document.querySelectorAll('[class*="draft-item"]')];
  const itemA = items.find(e=>e.innerText.includes('草稿A'));
  if (!itemA) return {ok:false, items: items.map(e=>e.innerText)};
  const btn = itemA.querySelector('button') || itemA;
  const r = btn.getBoundingClientRect();
  return {ok:true, x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)};
})()`);
console.log('SWITCH TO A:', JSON.stringify(switchOk));
if (switchOk.ok) {
  await p.mouseClick(switchOk.x, switchOk.y);
  await sleep(1500);
}
const afterSwitch = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  return {title, bodyHas: body.includes('草稿A的正文')};
})()`);
console.log('AFTER SWITCH TO A:', JSON.stringify(afterSwitch));

// 两步确认删除：打开列表，删除草稿B
await p.eval(`(()=>{
  const b = [...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
  b.click(); return true;
})()`);
await sleep(800);
const delB = await p.eval(`(()=>{
  const items = [...document.querySelectorAll('[class*="draft-item"]')];
  const itemB = items.find(e=>e.innerText.includes('草稿B'));
  if (!itemB) return null;
  const delBtn = [...itemB.querySelectorAll('button')].find(b=>/删除|删/.test(b.innerText));
  const r = (delBtn||itemB).getBoundingClientRect();
  return {x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), hasDelBtn: !!delBtn, label: itemB.innerText.slice(0,40)};
})()`);
console.log('DELETE B STEP1:', JSON.stringify(delB));
if (delB) {
  // 若没有独立删除按钮，点 item 内删除图标；否则点删除按钮
  await p.mouseClick(delB.x, delB.y);
  await sleep(800);
  // 两步确认：查找确认按钮
  const confirmBtn = await p.eval(`(()=>{
    const btns = [...document.querySelectorAll('button')].map(b=>({t:b.innerText.trim(), x:Math.round((b.getBoundingClientRect().x+b.getBoundingClientRect().width/2)), y:Math.round((b.getBoundingClientRect().y+b.getBoundingClientRect().height/2))}));
    const del = btns.find(b=>/确定|确认删除|删除/.test(b.t));
    return del || null;
  })()`);
  console.log('DELETE B STEP2 CONFIRM:', JSON.stringify(confirmBtn));
  if (confirmBtn) {
    await p.mouseClick(confirmBtn.x, confirmBtn.y);
    await sleep(1200);
  }
}
const afterDelete = await p.eval(`(()=>{
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  const titles = ls.map(d=>d.title);
  return {draftTitles: titles, count: ls.length};
})()`);
console.log('AFTER DELETE:', JSON.stringify(afterDelete));

// 刷新 → 恢复最近草稿（应回到草稿A 或最近更新的）
await p.eval(`location.reload(); true`);
await sleep(4000);
const afterRefresh = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  return {title, bodyHasA: body.includes('草稿A的正文'), drafts: ls.map(d=>d.title)};
})()`);
console.log('AFTER REFRESH:', JSON.stringify(afterRefresh));

await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/d1-drafts.png');
writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockD1-result.json', JSON.stringify({init, panel, created, afterSwitch, delB, afterDelete, afterRefresh, consoleErrors}, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
p.close();
process.exit(0);
