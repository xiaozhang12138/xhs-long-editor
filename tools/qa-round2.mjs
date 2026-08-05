import { mkdirSync } from 'node:fs';
import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';

const output = '/tmp/xhs-round2-qa';
mkdirSync(output, { recursive: true });
const { cdp, sessionId } = await openPage('http://127.0.0.1:3000/');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1720, height: 1000, deviceScaleFactor: 1, mobile: false,
}, sessionId);
await sleep(1200);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(1500);

await evaluate(cdp, sessionId, `(async () => {
  const pm = document.querySelector('.ProseMirror');
  pm.focus();
  document.execCommand('insertText', false, Array.from({length: 24}, (_, i) =>
    '第' + i + '段 科学设计与时尚趋势需要清晰的视觉层级和稳定的图片尺寸。'
  ).join('\\n\\n'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#1457d9"/><circle cx="70" cy="60" r="38" fill="#fff"/><text x="125" y="68" fill="#fff" font-size="24">VISUAL</text></svg>';
  const file = new File([svg], 'visual.svg', { type: 'image/svg+xml' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  pm.dispatchEvent(new ClipboardEvent('paste', { bubbles:true, cancelable:true, clipboardData:transfer }));
  await new Promise(r => setTimeout(r, 600));
  return true;
})()`);

await evaluate(cdp, sessionId, `(() => {
  const img = document.querySelector('.ProseMirror img');
  img?.scrollIntoView({ block: 'center', behavior:'instant' });
  return !!img;
})()`);
await sleep(350);
const editorImagePoint = await evaluate(cdp, sessionId, `(() => {
  const img = document.querySelector('.ProseMirror img');
  const r = img.getBoundingClientRect();
  return { x:r.left+r.width/2, y:r.top+r.height/2, width:r.width };
})()`);
await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:editorImagePoint.x, y:editorImagePoint.y, button:'left', clickCount:1 }, sessionId);
await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:editorImagePoint.x, y:editorImagePoint.y, button:'left', clickCount:1 }, sessionId);
await sleep(600);
const editorHandle = await evaluate(cdp, sessionId, `(() => {
  const h = document.querySelector('.editor-inline-resize-handle');
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return { x:r.left+r.width/2, y:r.top+r.height/2 };
})()`);
if (editorHandle) {
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:editorHandle.x, y:editorHandle.y, button:'left', clickCount:1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:editorHandle.x+150, y:editorHandle.y, button:'left' }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:editorHandle.x+150, y:editorHandle.y, button:'left', clickCount:1 }, sessionId);
}
await sleep(700);
const beforeFormat = await evaluate(cdp, sessionId, `(() => {
  const img = document.querySelector('.ProseMirror img');
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  const hit = document.elementFromPoint(${editorImagePoint.x}, ${editorImagePoint.y});
  return { point:${JSON.stringify(editorImagePoint)}, hit:hit?.tagName, selected:!!document.querySelector('.editor-resizable-image.is-selected'), handleVisible: !!document.querySelector('.editor-inline-resize-handle'), imageWidth:img?.offsetWidth, jsonHasWidth:(draft.content || '').includes('"width":390') };
})()`);

await evaluate(cdp, sessionId, `(() => {
  const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('一键排版'));
  button?.click(); return !!button;
})()`);
await sleep(2200);
await evaluate(cdp, sessionId, `(() => {
  const img = document.querySelectorAll('.xhs-card-content img')[0];
  img?.scrollIntoView({ inline:'center', block:'nearest', behavior:'instant' });
  return !!img;
})()`);
await sleep(500);
const preActivate = await evaluate(cdp, sessionId, `(() => {
  const slot = document.querySelectorAll('.card-display-slot')[1];
  const visual = document.querySelector('.keyword-cover-visual');
  const img = document.querySelectorAll('.xhs-card-content img')[0];
  const r = img?.getBoundingClientRect();
  return { slotWidth:slot?.getBoundingClientRect().width, pages:document.querySelectorAll('.card-outer-container').length, coverVisual:!!visual, imageWidth:r?.width, point:r ? {x:r.left+r.width/2,y:r.top+r.height/2}:null };
})()`);
if (preActivate.point) {
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:preActivate.point.x, y:preActivate.point.y, button:'left', clickCount:1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:preActivate.point.x, y:preActivate.point.y, button:'left', clickCount:1 }, sessionId);
}
await sleep(500);
const afterActivate = await evaluate(cdp, sessionId, `(() => {
  const slot = document.querySelectorAll('.card-display-slot')[1];
  const img = document.querySelector('.card-outer-container.active img');
  const r = img?.getBoundingClientRect();
  return { slotWidth:slot?.getBoundingClientRect().width, overlay:!!document.querySelector('.card-edit-toolbar-overlay'), point:r ? {x:r.left+r.width/2,y:r.top+r.height/2}:null };
})()`);
if (afterActivate.point) {
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:afterActivate.point.x, y:afterActivate.point.y, button:'left', clickCount:1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:afterActivate.point.x, y:afterActivate.point.y, button:'left', clickCount:1 }, sessionId);
}
await sleep(250);
const cardHandle = await evaluate(cdp, sessionId, `(() => {
  const h = document.querySelector('.card-img-resize-handle');
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return { x:r.left+r.width/2, y:r.top+r.height/2 };
})()`);
if (cardHandle) {
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:cardHandle.x, y:cardHandle.y, button:'left', clickCount:1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:cardHandle.x+60, y:cardHandle.y, button:'left' }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:cardHandle.x+60, y:cardHandle.y, button:'left', clickCount:1 }, sessionId);
}
await sleep(1400);
const afterResize = await evaluate(cdp, sessionId, `(() => {
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  const parsed = JSON.parse(draft.content || '{"content":[]}');
  const image = parsed.content.find(n => n.type === 'image');
  return { handleVisible:!!cardHandle, storedWidth:image?.attrs?.width, pages:document.querySelectorAll('.card-outer-container').length };
})()`.replace('!!cardHandle', cardHandle ? 'true' : 'false'));
const templateChecks = await evaluate(cdp, sessionId, `(async () => {
  const results = [];
  for (const name of ['时尚编辑', '科学图示', '瑞士刻板', '国际主义']) {
    const card = Array.from(document.querySelectorAll('.template-card')).find(button => button.textContent.includes(name));
    card?.click();
    await new Promise(resolve => setTimeout(resolve, 180));
    results.push({ name, found:!!card, selected:card?.classList.contains('selected') });
  }
  const swiss = Array.from(document.querySelectorAll('.template-card')).find(button => button.textContent.includes('瑞士刻板'));
  swiss?.click();
  const viewport = document.querySelector('.card-scroll-viewport');
  if (viewport) viewport.scrollLeft = 0;
  await new Promise(resolve => setTimeout(resolve, 500));
  return results;
})()`);
await screenshot(cdp, sessionId, `${output}/round2.png`);
console.log(JSON.stringify({ beforeFormat, preActivate, afterActivate, cardHandle:!!cardHandle, afterResize, templateChecks }, null, 2));
console.log(`${output}/round2.png`);
cdp.close();
