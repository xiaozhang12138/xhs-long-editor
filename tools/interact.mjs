import { findPage, Page, sleep } from './pagecdp.mjs';
import { writeFileSync } from 'node:fs';
const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';

const t = await findPage();
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');
await p.send('DOM.enable');

// 真实鼠标点击（基于坐标）
async function clickAt(x, y) {
  await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(60);
  await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(400);
}
// 真实键盘输入
async function typeText(text) {
  for (const ch of text) {
    await p.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
    await p.send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
    await sleep(25);
  }
}
async function pressKey(key, code, keyCode, mods = 0) {
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers: mods });
  await sleep(40);
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers: mods });
  await sleep(200);
}

async function rectOf(sel) {
  return await p.eval(`(() => { const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), w:Math.round(r.width), h:Math.round(r.height), left:Math.round(r.x), top:Math.round(r.y)}; })()`);
}

async function dumpToolbar(tag) {
  const r = await p.eval(`(() => {
    const c = document.querySelector('.menu-items-container');
    if(!c) return {err:'no toolbar'};
    const items = [...c.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0}).map(e=>{
      const b=e.getBoundingClientRect(); const cs=getComputedStyle(e);
      return {tag:e.tagName.toLowerCase(), cls:(typeof e.className==='string'?e.className:'').slice(0,70),
        r:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)],
        t:[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).filter(Boolean).join('')||'',
        title:e.getAttribute('title')||e.getAttribute('aria-label')||''};
    });
    return {count:items.length, html:c.innerHTML.slice(0,3000), items};
  })()`);
  console.log('\n=== TOOLBAR ' + tag + ' ===');
  console.log(JSON.stringify(r, null, 1).slice(0, 4000));
}

const step = process.argv[2];

if (step === 'title') {
  const tr = await rectOf('.rich-editor-title');
  console.log('title rect:', JSON.stringify(tr));
  await clickAt(tr.x, tr.y);
  await typeText('测试标题：长文编辑器复刻');
  await sleep(1200);
  const state = await p.eval(`({ text: document.body.innerText.slice(0,600), titleHTML: document.querySelector('.rich-editor-title')?.innerHTML.slice(0,800) })`);
  console.log(JSON.stringify(state, null, 1));
  await p.shot(OUT + '/i1-title.png');
} else if (step === 'body') {
  const br = await rectOf('.rich-editor-content');
  console.log('body rect:', JSON.stringify(br));
  await clickAt(br.left + 50, br.top + 20);
  await typeText('这是正文第一段，用来测试富文本编辑器的行为。');
  await sleep(1500);
  await dumpToolbar('after-body-input');
  await p.shot(OUT + '/i2-body.png');
} else if (step === 'toolbar') {
  await dumpToolbar('current');
  const html = await p.eval(`document.querySelector('.header')?.outerHTML.slice(0,6000)`);
  writeFileSync(OUT + '/header.html', html || '');
  console.log('header html saved, len=', html?.length);
} else if (step === 'select') {
  // 选中正文文字看是否出现浮动工具栏
  await p.eval(`(() => {
    const c = document.querySelector('.rich-editor-content');
    const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    const n = walker.nextNode();
    if(n){ const r=document.createRange(); r.setStart(n,0); r.setEnd(n,Math.min(6,n.length)); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
    return n?.textContent;
  })()`);
  await sleep(1500);
  await p.shot(OUT + '/i3-select.png');
  const fl = await p.eval(`[...document.querySelectorAll('body > div, [class*="bubble"], [class*="float"], [class*="popup"], [class*="tooltip"]')].filter(e=>{const b=e.getBoundingClientRect();const cs=getComputedStyle(e);return b.width>50&&b.height>10&&cs.display!=='none'&&cs.position==='absolute'||cs.position==='fixed'}).map(e=>({cls:e.className.toString().slice(0,60),r:[Math.round(e.getBoundingClientRect().x),Math.round(e.getBoundingClientRect().y),Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)],txt:e.innerText.slice(0,100)}))`);
  console.log(JSON.stringify(fl, null, 1));
} else if (step === 'shot') {
  await p.shot(OUT + '/' + (process.argv[3] || 'now') + '.png');
  console.log('ok');
} else if (step === 'text') {
  console.log(await p.eval('document.body.innerText'));
} else if (step === 'eval') {
  console.log(JSON.stringify(await p.eval(process.argv[3]), null, 1));
}
p.close();
process.exit(0);
