// 块D1 补充：基于现有草稿（A + B，当前 B）→ 切回 A 验证内容 → 两步删除 B → 验证 → 刷新恢复
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');

await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// 当前状态 dump
const before = await p.eval(`(()=>{
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  return {drafts: ls.map(d=>({title:d.title, updatedAt:d.updatedAt})), currentTitle: title};
})()`);
console.log('BEFORE:', JSON.stringify(before));

// 打开草稿列表
await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
  if(b) b.click(); return true;
})()`);
await sleep(800);

// 切回草稿A：找 title=切换到此草稿 且文本含 草稿A
const switchA = await p.eval(`(()=>{
  const btns=[...document.querySelectorAll('button[title="切换到此草稿"]')];
  const a = btns.find(b=>b.innerText.includes('草稿A'));
  if(!a) return null;
  const r=a.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), label:a.innerText.slice(0,40)};
})()`);
console.log('SWITCH A BTN:', JSON.stringify(switchA));
if (switchA) { await p.mouseClick(switchA.x, switchA.y); await sleep(1500); }

const afterSwitchA = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  return {title, bodyHasA: body.includes('草稿A的正文')};
})()`);
console.log('AFTER SWITCH A:', JSON.stringify(afterSwitchA));

// 再打开列表，两步删除草稿B
await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/草稿列表/.test(b.innerText));
  if(b) b.click(); return true;
})()`);
await sleep(800);
const delBtns = await p.eval(`(()=>{
  const rows=[...document.querySelectorAll('div')].filter(d=>d.querySelector('button[title="切换到此草稿"]'));
  const res = rows.map(row=>{
    const titleBtn = row.querySelector('button[title="切换到此草稿"]');
    const delBtn = [...row.querySelectorAll('button')].find(b=>b.innerText.trim()==='删除' || b.innerText.trim()==='确认删除?');
    const r=delBtn.getBoundingClientRect();
    return {title:titleBtn?.innerText.slice(0,30), hasDel: !!delBtn, delText: delBtn?.innerText.trim(), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  });
  return res;
})()`);
console.log('DELETE BTNS:', JSON.stringify(delBtns));

// 点草稿B 的删除 → 应变为 确认删除? → 再点
const delB = delBtns.find(d=>d.title.includes('草稿B'));
if (delB) {
  await p.mouseClick(delB.x, delB.y);
  await sleep(800);
  const confirmBtn = await p.eval(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='确认删除?');
    if(!b) return null;
    const r=b.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  })()`);
  console.log('CONFIRM BTN:', JSON.stringify(confirmBtn));
  if (confirmBtn) { await p.mouseClick(confirmBtn.x, confirmBtn.y); await sleep(1200); }
}
const afterDelete = await p.eval(`(()=>{
  const ls = JSON.parse(localStorage.getItem('xhs_drafts_v2')||'[]');
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  return {drafts: ls.map(d=>d.title), currentTitle: title};
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
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/d1b-drafts.png');

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockD1b-result.json', JSON.stringify({before, switchA, afterSwitchA, delBtns, afterDelete, afterRefresh}, null, 2));
p.close();
process.exit(0);
