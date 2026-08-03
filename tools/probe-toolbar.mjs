import { findPage, Page, sleep } from './pagecdp.mjs';
import { writeFileSync } from 'node:fs';
const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';
const t = await findPage();
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Runtime.enable');

async function mouse(type, x, y, extra = {}) {
  await p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type.includes('Press')||type.includes('Rele') ? 1 : 0, ...extra });
}
async function hover(x, y) { await mouse('mouseMoved', x, y); await sleep(900); }
async function click(x, y) { await mouse('mouseMoved', x, y); await sleep(120); await mouse('mousePressed', x, y); await sleep(70); await mouse('mouseReleased', x, y); await sleep(800); }

// 捕获浮层（tooltip / dropdown / modal）
async function floats() {
  return await p.eval(`(() => {
    return [...document.querySelectorAll('body *')].filter(e=>{
      const cs=getComputedStyle(e); const b=e.getBoundingClientRect();
      return (cs.position==='fixed'||cs.position==='absolute') && cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0.1 && b.width>40 && b.height>16 && b.top>=0
        && !e.closest('.menu-container') && !e.closest('.d-topbar') && e.innerText.trim().length>0;
    }).map(e=>{const b=e.getBoundingClientRect();return {cls:(typeof e.className==='string'?e.className:'').slice(0,70), r:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)], txt:e.innerText.replace(/\\s+/g,' ').slice(0,180), z:getComputedStyle(e).zIndex};})
      .filter((v,i,a)=>a.findIndex(x=>x.txt===v.txt)===i).slice(0,8);
  })()`);
}
async function bodyHTML() {
  return await p.eval(`document.querySelector('.rich-editor-content')?.innerHTML.slice(0,900)`);
}

const mode = process.argv[2];

if (mode === 'hover') {
  const xs = [724, 764, 813, 853, 893, 933, 973, 1013, 1062, 1102, 1151];
  for (let i = 0; i < xs.length; i++) {
    await hover(xs[i] + 16, 93);
    const f = await floats();
    const tip = f.find(x => x.r[3] < 50 && x.txt.length < 30);
    console.log(`btn[${i}] @${xs[i]} -> ${tip ? '"'+tip.txt+'"' : (f.length? JSON.stringify(f[0].txt.slice(0,60)) : 'no-tip')}`);
  }
} else if (mode === 'click') {
  const idx = parseInt(process.argv[3]);
  const xs = [724, 764, 813, 853, 893, 933, 973, 1013, 1062, 1102, 1151];
  const before = await bodyHTML();
  await click(xs[idx] + 16, 93);
  await sleep(1200);
  const after = await bodyHTML();
  const f = await floats();
  console.log(`\n=== CLICK btn[${idx}] @${xs[idx]} ===`);
  console.log('HTML changed:', before !== after);
  if (before !== after) { console.log('BEFORE:', before?.slice(0,300)); console.log('AFTER :', after?.slice(0,300)); }
  console.log('FLOATS:', JSON.stringify(f, null, 1).slice(0, 1500));
  await p.shot(OUT + '/tb-' + idx + '.png');
} else if (mode === 'floats') {
  console.log(JSON.stringify(await floats(), null, 1));
} else if (mode === 'esc') {
  await p.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await p.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await sleep(500);
  await click(600, 600);
  console.log('escaped');
} else if (mode === 'shot') {
  await p.shot(OUT + '/' + (process.argv[3]||'now') + '.png');
  console.log('ok');
} else if (mode === 'eval') {
  console.log(JSON.stringify(await p.eval(process.argv[3]), null, 1));
}
p.close(); process.exit(0);
