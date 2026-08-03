import { openPage, evaluate, sleep } from './cdp.mjs';
const { cdp, sessionId } = await openPage('http://localhost:3000/');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1720, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
await sleep(1500);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(1500);
await evaluate(cdp, sessionId, `(() => {
  const pm = document.querySelector('.ProseMirror');
  pm.focus();
  const long = Array.from({length: 30}, (_, i) => '第' + i + '段测试内容这里是足够长的文字用来分页。').join('\\n\\n');
  document.execCommand('insertText', false, long);
})()`);
await sleep(500);
await evaluate(cdp, sessionId, `Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('一键排版'))?.click(); true`);
await sleep(3000);
// activate card 1
const pt = await evaluate(cdp, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const content = cards[1].querySelector('.xhs-card-content');
  const r = content.getBoundingClientRect();
  return { x: r.left + r.width * 0.5, y: r.top + Math.min(200, r.height * 0.4) };
})()`);
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId);
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId);
await sleep(600);
// type
const typeInfo = await evaluate(cdp, sessionId, `(async () => {
  const active = document.querySelector('.card-outer-container.active');
  const content = active.querySelector('.xhs-card-content');
  content.focus();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('insertText', false, '【点击编辑成功】');
  await new Promise(r => setTimeout(r, 200));
  const typedVisible = content.textContent.includes('点击编辑成功');
  const blockCount = content.querySelectorAll('[data-block-id]').length;
  return { typedVisible, blockCount, firstBlockId: content.querySelector('[data-block-id]')?.getAttribute('data-block-id') };
})()`);
console.log('TYPE_INFO:', JSON.stringify(typeInfo, null, 2));
// wait for debounce + autosave
await sleep(4500);
const after = await evaluate(cdp, sessionId, `(async () => {
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const otherTexts = cards.slice(2).map(c => (c.textContent || '').includes('点击编辑成功'));
  const activeText = (document.querySelector('.card-outer-container.active')?.textContent || '').includes('点击编辑成功');
  return {
    inLocalStorage: (draft.contentHtml || '').includes('点击编辑成功'),
    otherCardsUpdated: otherTexts.filter(Boolean).length,
    activeCardStillShows: activeText,
    wordCount: draft.wordCount,
  };
})()`);
console.log('AFTER:', JSON.stringify(after, null, 2));
cdp.close(); process.exit(0);
