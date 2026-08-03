// 回原版网站实测 5 个交互点
// usage: node tools/reprobe.mjs <step>
// step: fill | format | template | paste | resize
import { findPage, anyPage, Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/reprobe';
mkdirSync(OUT, { recursive: true });

const step = process.argv[2] || 'fill';

// 智能选 page：列出所有 page target，逐个尝试 attach 直到能 eval 成功
async function pickPage() {
  const list = await fetch('http://127.0.0.1:9333/json/list').then(r => r.json());
  const pages = list.filter(t => t.type === 'page' && !t.url.startsWith('edge://') && !t.url.startsWith('devtools://'));
  for (const t of pages) {
    try {
      const p = await Page.attach(t.webSocketDebuggerUrl);
      await p.send('Page.enable');
      const info = await p.eval(`({u:location.href,l:document.body.innerHTML.length})`);
      console.log('PICKED:', info.u.slice(0, 70), 'len=' + info.l);
      // 如果是上传视频 tab，导航到写长文
      if (!info.u.includes('target=article')) {
        await p.goto('https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article', 5000);
        await sleep(2000);
      }
      return p;
    } catch (e) {
      console.log('SKIP:', t.url.slice(0, 50), '->', e.message.slice(0, 50));
    }
  }
  throw new Error('NO_PAGE');
}

const p = await pickPage();

async function shot(name) {
  try { await p.shot(`${OUT}/${name}.png`, { full: true }); console.log(`[shot] ${name}`); }
  catch(e) { console.log('SHOT_FAIL:', e.message); }
}

if (step === 'fill') {
  // 检测是否在编辑器（有暂存离开）
  let inEditor = await p.eval(`(()=>!![...document.querySelectorAll('button')].find(b=>b.innerText.includes('暂存离开')))()`);
  console.log('IN_EDITOR:', inEditor);
  if (!inEditor) {
    const newBtn = await p.eval(`(()=>{
      const all=[...document.querySelectorAll('button, [role=button], a')];
      const b=all.find(e=>(e.innerText||'').trim()==='新的创作');
      if(!b) return null;
      const r=b.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
    })()`);
    console.log('NEW BTN:', JSON.stringify(newBtn));
    if (newBtn) { await p.mouseClick(newBtn.x, newBtn.y); await sleep(4000); }
    inEditor = await p.eval(`(()=>!![...document.querySelectorAll('button')].find(b=>b.innerText.includes('暂存离开')))()`);
  }
  console.log('IN_EDITOR_AFTER:', inEditor);
  if (!inEditor) { console.log('STILL_NOT_IN_EDITOR'); await shot('debug'); p.close(); process.exit(1); }
  // 清空标题再输入
  const title = await p.eval(`(()=>{
    const el=[...document.querySelectorAll('input, textarea, [contenteditable=true]')].find(e=>{const r=e.getBoundingClientRect();return r.width>200 && r.height<60 && e.offsetParent});
    if(!el) return null;
    el.focus();
    const r=el.getBoundingClientRect();
    return {x:Math.round(r.x+10),y:Math.round(r.y+10),cur:el.innerText||el.value||''};
  })()`);
  console.log('TITLE:', JSON.stringify(title));
  if (title) {
    await p.mouseClick(title.x, title.y); await sleep(300);
    await p.selectAll(); await sleep(150); await p.deleteSel(); await sleep(200);
    await p.type('排版复测：加粗与模板联动测试'); await sleep(500);
  }
  // 点击正文（fallback 坐标 600,250）
  const body = await p.eval(`(()=>{
    const c=[...document.querySelectorAll('[contenteditable=true]')].find(e=>{const r=e.getBoundingClientRect();return r.width>400 && r.height>=80});
    if(!c) return null;
    const r=c.getBoundingClientRect();
    return {x:Math.round(r.x+30),y:Math.round(r.y+30)};
  })()`);
  if (body) await p.mouseClick(body.x, body.y); else await p.mouseClick(600, 250);
  await sleep(400);
  await p.type('这是一段用于测试排版模板的正文内容。小红书长文支持多种排版模板，每个模板对加粗文字的处理方式都不相同。');
  await sleep(400);
  // 用 ctrl+a 选中这段文字加粗，再 type 加粗后的延伸
  await p.key('Home'); await p.key('Shift+End');
  await p.key('b'); // 触发加粗快捷键（Ctrl+B）
  // 实际上简单点：先 type 内容，再用 JS 在最后给一段设加粗
  await p.type('\n\n这是第二段，用于测试加粗效果。');
  await sleep(800);
  // 给第二段整段加粗：通过点击工具栏的粗体按钮（先选中第二段）
  await shot('filled');
  const btns = await p.eval(`(()=>{
    const all=[...document.querySelectorAll('button, [role=button]')];
    return all.filter(e=>(e.innerText||'').match(/一键排版|暂存离开/)).map(e=>{const r=e.getBoundingClientRect();return{t:(e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,20),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}});
  })()`);
  console.log('BTNS:', JSON.stringify(btns));
} else if (step === 'format') {
  const btns = await p.eval(`(()=>{
    const all=[...document.querySelectorAll('button, [role=button]')];
    return all.filter(e=>(e.innerText||'').match(/一键排版/)).map(e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}});
  })()`);
  if (btns.length) { await p.mouseClick(btns[0].x, btns[0].y); await sleep(4000); }
  const info = await p.eval(`({url:location.href, title:document.title})`);
  console.log('AFTER:', JSON.stringify(info));
  const layout = await p.eval(`(()=>{
    const scrollers = [...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return (s.overflowX==='auto'||s.overflowX==='scroll'||s.scrollSnapType!=='none') && e.scrollWidth>e.clientWidth+50});
    const cards = [...document.querySelectorAll('[class*=card],[class*=preview-card],[class*=page-card]')].filter(e=>e.offsetWidth>80);
    return {scrollerCount:scrollers.length, scrollerSamples:scrollers.slice(0,5).map(e=>({cls:e.className.toString().slice(0,50),w:e.clientWidth,sw:e.scrollWidth,snap:getComputedStyle(e).scrollSnapType||'none',ow:e.offsetWidth,oh:e.offsetHeight})), cardCount:cards.length, cardSample:cards.slice(0,8).map(e=>({cls:e.className.toString().slice(0,40),w:e.offsetWidth,h:e.offsetHeight}))};
  })()`);
  console.log('LAYOUT:', JSON.stringify(layout, null, 1));
  // 寻找编辑入口
  const edit = await p.eval(`(()=>{
    const all=[...document.querySelectorAll('button, [role=button], span, div')];
    return all.filter(e=>(e.innerText||'').match(/编辑|修改|返回|下一步|保存/)).filter(e=>{const r=e.getBoundingClientRect();return r.width>20 && r.height>10 && r.width<300}).slice(0,12).map(e=>({t:(e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,20),tag:e.tagName,cls:e.className.toString().slice(0,40),x:Math.round(e.getBoundingClientRect().x)}));
  })()`);
  console.log('EDIT:', JSON.stringify(edit, null, 1));
  await shot('format');
} else if (step === 'template') {
  const tmpl = await p.eval(`(()=>{
    const list=[...document.querySelectorAll('[class*=template]')].filter(e=>e.offsetWidth>40 && e.offsetHeight>40);
    return list.slice(0,15).map(e=>({cls:e.className.toString().slice(0,50),t:(e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,15),x:Math.round(e.getBoundingClientRect().x),y:Math.round(e.getBoundingClientRect().y),w:Math.round(e.offsetWidth)}));
  })()`);
  console.log('TMPL:', JSON.stringify(tmpl, null, 1));
  await shot('template-list');
  // 取加粗文本样式（如果页面有 b/strong）
  const bold = await p.eval(`(()=>{
    const all=[...document.querySelectorAll('b,strong')].filter(e=>e.offsetParent);
    return all.slice(0,5).map(e=>{const s=getComputedStyle(e);return{t:e.innerText.slice(0,20),fontWeight:s.fontWeight,color:s.color,bg:s.backgroundColor,fontFamily:s.fontFamily.slice(0,40)}});
  })()`);
  console.log('BOLD:', JSON.stringify(bold, null, 1));
} else if (step === 'paste') {
  const result = await p.eval(`(async ()=>{
    try {
      // 找正文编辑器
      const editor = [...document.querySelectorAll('[contenteditable=true]')].find(e=>{const r=e.getBoundingClientRect();return r.width>400 && r.height>=80});
      if(!editor) return 'NO_EDITOR';
      editor.focus();
      // 构造图片数据 (1x1 红色 png)
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA20lEQVR42u3RAQ0AAAjDMO5fGiBy0sLNxQEESB7g/I95AAAAAElFTkSuQmCC';
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'paste.png', {type:'image/png'});
      const dt = new DataTransfer();
      dt.items.add(file);
      const evt = new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true});
      const ok = editor.dispatchEvent(evt);
      await new Promise(r=>setTimeout(r,2000));
      const imgs = editor.querySelectorAll('img');
      const all = [...document.querySelectorAll('img')].filter(i=>i.offsetParent);
      return {dispatched:ok, editorImgs:imgs.length, allImgs:all.length, srcs:[...all].slice(0,3).map(i=>i.src.slice(0,50))};
    } catch(e) { return 'ERR:'+e.message; }
  })()`);
  console.log('PASTE:', JSON.stringify(result));
  await shot('paste');
} else if (step === 'resize') {
  // 测试图片缩放：检查图片元素是否有拖拽手柄/resize handle
  const info = await p.eval(`(()=>{
    const img = [...document.querySelectorAll('img')].find(i=>i.offsetWidth>50);
    if(!img) return 'NO_IMG';
    const r=img.getBoundingClientRect();
    return {curW:Math.round(r.width),curH:Math.round(r.height),wrap:img.parentElement?.className?.toString().slice(0,50),draggable:img.draggable,resizable:getComputedStyle(img).resize};
  })()`);
  console.log('IMG:', JSON.stringify(info));
  await shot('resize');
}

p.close();
process.exit(0);