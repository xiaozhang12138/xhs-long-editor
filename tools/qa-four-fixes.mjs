import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';

const out = '/tmp/xhs-four-fixes-qa';
mkdirSync(out, { recursive: true });
const { cdp, sessionId } = await openPage('http://127.0.0.1:3000/');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1720,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
}, sessionId);
await sleep(1200);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(1600);

const sticky = await evaluate(cdp, sessionId, `(async () => {
  const pm = document.querySelector('.ProseMirror');
  pm.focus();
  document.execCommand('insertText', false, Array.from({length: 100}, (_, i) =>
    '第' + i + '段：这是一段用于验证长文滚动工具栏固定效果的小红书正文。'
  ).join('\\n\\n'));
  await new Promise(r => setTimeout(r, 300));
  const toolbar = document.querySelector('.editor-toolbar-sticky');
  const scroller = toolbar.closest('.overflow-y-auto');
  const before = toolbar.getBoundingClientRect().top;
  scroller.scrollTop = 1600;
  await new Promise(r => setTimeout(r, 150));
  return {
    before,
    after: toolbar.getBoundingClientRect().top,
    scrollerTop: scroller.getBoundingClientRect().top,
    scrollTop: scroller.scrollTop,
    position: getComputedStyle(toolbar).position,
  };
})()`);

await evaluate(cdp, sessionId, `(() => {
  const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('一键排版'));
  button?.click();
  return !!button;
})()`);
await sleep(2200);

const beforePaste = await evaluate(cdp, sessionId, `(() => {
  const coverTitle = document.querySelector('.xhs-cover-title-editable');
  const bodyText = document.querySelectorAll('.xhs-card-content [data-block-id]')[0];
  return {
    pages: document.querySelectorAll('.card-outer-container').length,
    coverFont: coverTitle ? parseFloat(getComputedStyle(coverTitle).fontSize) : 0,
    bodyFont: bodyText ? parseFloat(getComputedStyle(bodyText).fontSize) : 0,
    imageCount: document.querySelectorAll('.xhs-card-content img').length,
  };
})()`);

const cardPoint = await evaluate(cdp, sessionId, `(() => {
  const content = document.querySelectorAll('.xhs-card-content')[1] || document.querySelector('.xhs-card-content');
  const rect = content.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + Math.min(80, rect.height / 2) };
})()`);
await cdp.send('Input.dispatchMouseEvent', {
  type: 'mousePressed', x: cardPoint.x, y: cardPoint.y, button: 'left', clickCount: 1,
}, sessionId);
await cdp.send('Input.dispatchMouseEvent', {
  type: 'mouseReleased', x: cardPoint.x, y: cardPoint.y, button: 'left', clickCount: 1,
}, sessionId);
await sleep(500);

const paste = await evaluate(cdp, sessionId, `(async () => {
  const target = document.querySelector('.card-outer-container.active .xhs-card-content');
  if (!target) return { dispatched: false, reason: 'no active card' };
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const file = new File([bytes], 'paste.png', { type: 'image/png' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  target.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true, cancelable: true, clipboardData: transfer,
  }));
  await new Promise(r => setTimeout(r, 1400));
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  return {
    dispatched: true,
    imageInJson: (draft.content || '').includes('data:image/png;base64'),
    imageInHtml: (draft.contentHtml || '').includes('data:image/png;base64'),
    imageCount: document.querySelectorAll('.xhs-card-content img').length,
    editExited: !document.querySelector('.card-outer-container.active'),
  };
})()`);

await screenshot(cdp, sessionId, `${out}/four-fixes.png`);
console.log(JSON.stringify({ sticky, beforePaste, paste }, null, 2));
console.log(`${out}/four-fixes.png`);
cdp.close();
