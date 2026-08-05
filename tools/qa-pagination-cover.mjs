import { mkdirSync } from 'node:fs';
import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';

const output = '/tmp/xhs-pagination-cover-qa';
mkdirSync(output, { recursive: true });
const { cdp, sessionId } = await openPage('http://127.0.0.1:3000/');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1720, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
await sleep(1200);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(1400);

await evaluate(cdp, sessionId, `(() => {
  const title = document.querySelector('input');
  const titleSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  titleSetter.call(title, '营养科学与生活方式');
  title.dispatchEvent(new Event('input', { bubbles:true }));
  const pm = document.querySelector('.ProseMirror');
  pm.focus();
  const html = Array.from({length:36}, (_, i) =>
    (i % 6 === 0 ? '<h2>第' + (i / 6 + 1) + '章 关键结论</h2>' : '') +
    '<p>第' + i + '段：营养科学需要可靠证据，也需要适合手机阅读的清晰分页和图片说明。</p>'
  ).join('');
  document.execCommand('insertHTML', false, html);
  return true;
})()`);
await sleep(700);
await evaluate(cdp, sessionId, `(() => {
  const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('一键排版'));
  button?.click(); return !!button;
})()`);
await sleep(2200);

const initial = await evaluate(cdp, sessionId, `(() => ({
  pages:document.querySelectorAll('.card-outer-container').length,
  warningChips:document.querySelectorAll('.page-quality-chips span').length,
  orphanHeading:Array.from(document.querySelectorAll('.card-outer-container')).some(card => {
    const blocks = card.querySelectorAll('[data-block-id]');
    return blocks.length && blocks[blocks.length - 1].tagName === 'H2';
  }),
}))()`);

const point = await evaluate(cdp, sessionId, `(() => {
  const content = document.querySelectorAll('.xhs-card-content')[0];
  const blocks = content?.querySelectorAll('[data-block-id]');
  const block = blocks?.[Math.min(3, Math.max(0, blocks.length - 1))];
  const r = block?.getBoundingClientRect();
  return r ? {x:r.left+r.width/2,y:r.top+r.height/2}:null;
})()`);
if (point) {
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:point.x, y:point.y, button:'left', clickCount:1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:point.x, y:point.y, button:'left', clickCount:1 }, sessionId);
}
await sleep(450);
await evaluate(cdp, sessionId, `(() => {
  const button = Array.from(document.querySelectorAll('.pagination-action')).find(b => b.textContent.includes('从这里分页'));
  button?.click(); return !!button;
})()`);
await sleep(1000);
const manual = await evaluate(cdp, sessionId, `(() => {
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(b => b.textContent.trim() === '分页');
  tab?.click();
  return { breakCount:draft.manualPageBreaks?.length || 0, pages:document.querySelectorAll('.card-outer-container').length };
})()`);
await sleep(500);
const panel = await evaluate(cdp, sessionId, `(() => ({
  visible:!!document.querySelector('.pagination-panel'),
  pageRows:document.querySelectorAll('.pagination-page-list > div').length,
  rules:document.querySelectorAll('.pagination-rule-list > div').length,
}))()`);

await evaluate(cdp, sessionId, `(() => {
  const tab = Array.from(document.querySelectorAll('[role="tab"]')).find(b => b.textContent.trim() === '封面设置');
  tab?.click(); return !!tab;
})()`);
await sleep(350);
await evaluate(cdp, sessionId, `(() => {
  document.querySelectorAll('.cover-candidate')[2]?.click();
  const business = Array.from(document.querySelectorAll('.cover-layout-grid button')).find(b => b.textContent.includes('商业分析'));
  business?.click();
  const input = document.querySelector('.cover-keyword-field input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '循证营养');
  input.dispatchEvent(new Event('input', { bubbles:true }));
  const scale = document.querySelector('.cover-slider-row input[type="range"]');
  setter.call(scale, '125');
  scale.dispatchEvent(new Event('input', { bubbles:true }));
  return true;
})()`);
await sleep(700);
const autoCover = await evaluate(cdp, sessionId, `(() => ({
  candidateSelected:document.querySelectorAll('.cover-candidate')[2]?.classList.contains('selected'),
  businessSelected:Array.from(document.querySelectorAll('.cover-layout-grid button')).some(b => b.textContent.includes('商业分析') && b.classList.contains('selected')),
  keywordOnCover:document.querySelector('.keyword-cover-word')?.textContent,
  coverClass:document.querySelector('.keyword-cover-visual')?.className,
}))()`);

await evaluate(cdp, sessionId, `(async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#1457d9"/><circle cx="650" cy="300" r="180" fill="#fff"/></svg>';
  const file = new File([svg], 'cover.svg', { type:'image/svg+xml' });
  const transfer = new DataTransfer(); transfer.items.add(file);
  const input = document.querySelector('input[type="file"]');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles:true }));
  await new Promise(resolve => setTimeout(resolve, 650));
  const rows = document.querySelectorAll('.cover-slider-row input[type="range"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(rows[3], '160'); rows[3].dispatchEvent(new Event('input', { bubbles:true }));
  setter.call(rows[4], '72'); rows[4].dispatchEvent(new Event('input', { bubbles:true }));
  setter.call(rows[5], '28'); rows[5].dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(resolve => setTimeout(resolve, 500));
})()`);
const uploadCover = await evaluate(cdp, sessionId, `(() => {
  const img = document.querySelector('.card-outer-container img[alt="封面"]');
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  return {
    imageVisible:!!img,
    transform:img?.style.transform,
    objectPosition:img?.style.objectPosition,
    saved:[draft.coverImageScale,draft.coverImageX,draft.coverImageY],
  };
})()`);

await screenshot(cdp, sessionId, `${output}/pagination-cover.png`);
console.log(JSON.stringify({ initial, manual, panel, autoCover, uploadCover }, null, 2));
console.log(`${output}/pagination-cover.png`);
cdp.close();
