// 块D1 完整重写：单进程内完成 新建A→填内容→新建B→切回A→两步删除B→刷新恢复
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

await p.goto('http://localhost:3000', 3500);
await sleep(2500);
await p.eval(`localStorage.clear(); location.reload(); true`);
await sleep(4000);

async function waitEditor() {
  for (let i=0;i<12;i++) {
    const ok = await p.eval(`!!document.querySelector('.prose-editor') && [...document.querySelectorAll('button')].some(b=>b.innerText.trim()==='一键排版')`);
    if (ok) return true;
    await sleep(500);
  }
  return false;
}
await waitEditor();

async function setTitle(text) {
  const pos = await p.eval(`(()=>{
    const el = document.querySelector('input[placeholder*="标题"]');
    if(!el) return null;
    const r=el.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  if(!pos) return false;
  await p.mouseClick(pos.x, pos.y);
  await sleep(200);
  await p.key('a', 1); await p.key('Delete');
  await sleep(100);
  await p.type(text);
  await sleep(300);
  return true;
}
async function setBody(text) {
  const pos = await p.eval(`(()=>{
    const el=document.querySelector('.prose-editor');
    if(!el) return null;
    const r=el.getBoundingClientRect();
    return {x:Math.round(r.x+Math.min(150,r.width/2)), y:Math.round(r.y+Math.min(80,r.height/2))};
  })()`);
  if(!pos) return false;
  await p.mouseClick(pos.x, pos.y);
  await sleep(200);
  await p.type(text);
  await sleep(300);
  return true;
}
async function openDraftPanel() {
  await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
    if(b) b.click();
    return true;
  })()`);
  await sleep(700);
}
async function closePanel() {
  await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='关闭');
    if(b) b.click();
    return true;
  })()`);
  await sleep(500);
}
async function draftRows() {
  return await p.eval(`(()=>{
    const rows=[...document.querySelectorAll('button[title="切换到此草稿"]')].map(b=>b.closest('div'));
    return rows.map(row=>{
      const titleBtn = row.querySelector('button[title="切换到此草稿"]');
      const delBtn = [...row.querySelectorAll('button')].find(b=>/删除|确认删除/.test(b.innerText.trim()));
      const dr=delBtn.getBoundingClientRect();
      const tr=titleBtn.getBoundingClientRect();
      return {title:titleBtn.innerText.slice(0,40), delText:delBtn?.innerText.trim(), delX:Math.round(dr.x+dr.width/2), delY:Math.round(dr.y+dr.height/2), titleX:Math.round(tr.x+tr.width/2), titleY:Math.round(tr.y+tr.height/2)};
    });
  })()`);
}

// ── 草稿A ──
await setTitle('草稿A标题');
await setBody('这是草稿A的正文内容，用来验证多草稿切换后内容是否保留。');
await sleep(600);
await openDraftPanel();
const rows0 = await draftRows();
console.log('ROWS after A:', JSON.stringify(rows0));

// 新建草稿B
await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/新建草稿/.test(b.innerText));
  if(b) b.click(); return true;
})()`);
await sleep(1500);
await setTitle('草稿B标题');
await setBody('这是草稿B的正文内容。');
await sleep(600);

// 切回草稿A
await openDraftPanel();
const rows1 = await draftRows();
console.log('ROWS after B:', JSON.stringify(rows1));
const rowA = rows1.find(r=>r.title.includes('草稿A'));
if (rowA) { await p.mouseClick(rowA.titleX, rowA.titleY); await sleep(1500); }
const switched = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  return {title, bodyHasA: body.includes('草稿A的正文')};
})()`);
console.log('SWITCHED TO A:', JSON.stringify(switched));

// 两步删除 B
await openDraftPanel();
const rows2 = await draftRows();
const rowB = rows2.find(r=>r.title.includes('草稿B'));
if (rowB) {
  await p.mouseClick(rowB.delX, rowB.delY); // 第一次点 → 变确认删除?
  await sleep(700);
  const confirmRows = await draftRows();
  const confirmB = confirmRows.find(r=>r.title.includes('草稿B'));
  console.log('AFTER STEP1:', JSON.stringify(confirmB));
  if (confirmB && confirmB.delText === '确认删除?') {
    await p.mouseClick(confirmB.delX, confirmB.delY); // 第二次点 → 删除
    await sleep(1200);
  }
}
await closePanel();
const afterDelete = await p.eval(`(()=>{
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  return {drafts: ls.map(d=>d.title), count: ls.length, currentTitle: title};
})()`);
console.log('AFTER DELETE:', JSON.stringify(afterDelete));

// 刷新恢复
await p.eval(`location.reload(); true`);
await sleep(4000);
const afterRefresh = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  return {title, bodyHasA: body.includes('草稿A的正文'), drafts: ls.map(d=>d.title)};
})()`);
console.log('AFTER REFRESH:', JSON.stringify(afterRefresh));
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/d1-final.png');

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockD1-final.json', JSON.stringify({rows0, rows1, switched, rows2, afterDelete, afterRefresh, consoleErrors}, null, 2));
p.close();
process.exit(0);
