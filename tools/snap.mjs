// 最简采集脚本：新建页面 → 导航 → 截图 → 提取信息 → 关闭
const PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';
import { writeFileSync } from 'node:fs';

async function wsConnect() {
  const r = await fetch(`${BASE}/json/version`);
  const { webSocketDebuggerUrl } = await r.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return ws;
}

function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    setTimeout(() => { ws.removeEventListener('message', handler); reject(new Error(`timeout:${method}`)); }, 30000);
  });
}

async function capture(name, url) {
  const ws = await wsConnect();
  // Create a new tab
  const { targetId } = await cdpSend(ws, 'Target.createTarget', { url: 'about:blank' });
  // Attach to it
  const { sessionId } = await cdpSend(ws, 'Target.attachToTarget', { targetId, flatten: true });
  
  // Navigate
  await cdpSend(ws, 'Page.navigate', { url }, sessionId);
  // Wait for load
  await new Promise((r) => {
    const h = () => { ws.removeEventListener('message', h); r(); };
    const fn = (ev) => { const m=JSON.parse(ev.data); if(m.method==='Page.loadEventFired') h(); };
    ws.addEventListener('message', fn);
    setTimeout(h, 20000);
  });
  await new Promise(r => setTimeout(r, 4000)); // extra wait for SPA rendering
  
  // Screenshot
  const { data: imgData } = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(imgData, 'base64'));
  
  // Extract info
  const info = await cdpSend(ws, 'Runtime.evaluate', {
    expression: `(() => ({
      url: location.href,
      title: document.title,
      textPreview: document.body?.innerText.slice(0, 1500),
      buttons: [...document.querySelectorAll('button,[role="button"]')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,30),
      inputs: [...document.querySelectorAll('input,textarea,[contenteditable]')].map(e=>({tag:e.tagName,type:e.type||e.getAttribute('contenteditable'),ph:e.placeholder})).slice(0,20),
      sidebar: [...document.querySelectorAll('nav,aside,[class*="sidebar"],[class*="menu"],[class*="nav"]')].map(e=>e.innerText.replace(/\\s+/g,' ').trim().slice(0,100)).filter(t=>t.length>2).slice(0,10)
    }))()`,
    returnByValue: true
  }, sessionId);

  console.log(`\n=== ${name}.png saved ===`);
  console.log(JSON.stringify(info.result.value, null, 2));
  
  // Close target
  await cdpSend(ws, 'Target.closeTarget', { targetId }).catch(()=>{});
  ws.close();
}

const TARGET = 'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article';
const step = process.argv[2] || '1';

try {
  if (step === '1') await capture('01-long-article-tab', TARGET);
  else if (step === '2') await capture('02-image-text-tab', TARGET); // will click after
  else if (step === '3') await capture('03-video-tab', TARGET);
  else if (step === '4') await capture('04-editor-view', TARGET);
  else console.log('Usage: node snap.mjs <1-4>');
} catch(e) {
  console.error(`Step ${step} error:`, e.message);
}
process.exit(0);
