import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';

const BASE = 'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article';
const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';
const { cdp, sessionId } = await openPage(null);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
}, sessionId);

// Helper: screenshot + extract DOM structure
async function snap(name) {
  const p = `${OUT}/${name}.png`;
  await screenshot(cdp, sessionId, p);
  console.log(`\n=== ${name} ===`);
  // Extract layout skeleton: top-level sections + key interactive elements
  const info = await evaluate(cdp, sessionId, `(() => {
    const els = document.querySelectorAll('[class]');
    const classes = new Map();
    els.forEach(el => el.classList.forEach(c => { if(!classes.has(c)) classes.set(c, el.tagName); }));
    return {
      url: location.href,
      title: document.title,
      bodyLen: document.body?.innerHTML.length || 0,
      textPreview: document.body?.innerText.slice(0, 800),
      uniqueClassesCount: classes.size,
      sidebarItems: [...document.querySelectorAll('nav [class], aside [class]')].map(e => e.innerText.trim()).filter(Boolean).slice(0, 20),
      buttons: [...document.querySelectorAll('button, [role="button"], .btn')].map(e => ({text:e.innerText.trim(),tag:e.tagName})).slice(0,30),
      inputs: [...document.querySelectorAll('input, textarea, [contenteditable]')].map(e => ({type:e.type||e.getAttribute('contenteditable'),placeholder:e.placeholder||'',tag:e.tagName})).slice(0,20),
      images: [...document.querySelectorAll('img')].map(e=>({src:e.src.slice(0,120),alt:e.alt,w:e.naturalWidth,h:e.naturalHeight})).slice(0,15)
    };
  })()`);
  console.log(JSON.stringify(info, null, 2));
}

// Step 1: Current state (写长文 tab)
await cdp.send('Page.navigate', { url: BASE }, sessionId);
await sleep(8000);
await snap('01-long-article-tab');

// Step 2: Click 上传图文 tab
await evaluate(cdp, sessionId, `(() => {
  const tabs = [...document.querySelectorAll('*')].filter(el => el.textContent.trim() === '上传图文');
  if(tabs[0]) tabs[0].click();
  return !!tabs[0];
})()`);
await sleep(5000);
await snap('02-image-text-tab');

// Step 3: Click 上传视频 tab
await evaluate(cdp, sessionId, `(() => {
  const tabs = [...document.querySelectorAll('*')].filter(el => el.textContent.trim() === '上传视频');
  if(tabs[0]) tabs[0].click();
  return !!tabs[0];
})()`);
await sleep(5000);
await snap('03-video-tab');

// Step 4: Go back to 写长文 and click "新的创作"
await cdp.send('Page.navigate', { url: BASE }, sessionId);
await sleep(6000);
const clicked = await evaluate(cdp, sessionId, `(() => {
  const btns = [...document.querySelectorAll('*')].filter(el => el.textContent.trim() === '新的创作' || el.textContent.includes('新的创作'));
  if(btns[0]){btns[0].click();return true;}
  return false;
})()`);
console.log('\nClicked 新的创作:', clicked);
await sleep(5000);
await snap('04-editor-view');

// Step 5: Try to scroll down in editor to see more fields
await evaluate(cdp, sessionId, `window.scrollTo(0, 300); window.scrollBy(0, 400);`);
await sleep(2000);
await snap('05-editor-scrolled');

cdp.close();
process.exit(0);
