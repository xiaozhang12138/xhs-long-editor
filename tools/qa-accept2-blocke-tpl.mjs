// 块E 补测：20 模板逐个渲染
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

// 进排版页
const fmtBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
if (fmtBtn) { await p.mouseClick(fmtBtn.x, fmtBtn.y); await sleep(4000); }

// 确保「选择模板」tab 激活
await p.eval(`(()=>{
  const tabs=[...document.querySelectorAll('button[role="tab"]')];
  const tab=tabs.find(b=>b.innerText.includes('选择模板'));
  if (tab && !tab.getAttribute('aria-selected')) tab.click();
  return true;
})()`);
await sleep(1000);

// 收集模板卡片
const cards = await p.eval(`(()=>{
  const cards=[...document.querySelectorAll('button.template-card')];
  return cards.map(c=>{
    const r=c.getBoundingClientRect();
    return {name:(c.innerText||'').trim(), title:c.title, x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
  });
})()`);
console.log('TEMPLATE CARDS:', JSON.stringify(cards.map(c=>({name:c.name, title:c.title.slice(0,30)})), null, 2));

const results = [];
for (let i=0; i<cards.length; i++) {
  const c = cards[i];
  await p.mouseClick(c.x, c.y);
  await sleep(700);
  const r = await p.eval(`(()=>{
    const cards=[...document.querySelectorAll('.card-outer-container')].length;
    const scaleText = document.body.innerText.match(/预览缩放\\s*(\\d+)%/);
    return {cards, scale: scaleText?scaleText[1]+'%':null};
  })()`);
  results.push({i, name: c.name, title: c.title.slice(0,40), ...r});
}
console.log('RESULTS:', JSON.stringify(results, null, 2));
const ok = results.length >= 20 && results.every(r=>r.cards >= 1);
console.log('ALL TEMPLATES OK:', ok, 'count:', results.length);

await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/e2-templates.png');
writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockE-tpl-result.json', JSON.stringify({cards, results, ok, consoleErrors}, null, 2));
p.close();
process.exit(0);
