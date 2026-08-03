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
// instrument
await evaluate(cdp, sessionId, `(() => {
  window.__md = null; window.__err = null;
  document.addEventListener('mousedown', (e) => {
    const t = e.target;
    window.__md = { x: e.clientX, y: e.clientY, tag: t.tagName, cls: (t.className && t.className.toString().slice(0,60)) || '', inContent: !!(t.closest && t.closest('.xhs-card-content')), inCard: !!(t.closest && t.closest('.card-outer-container')) };
  }, true);
  window.addEventListener('error', (e) => { window.__err = (window.__err || '') + ' | ' + e.message; });
  return true;
})()`);
const pt = await evaluate(cdp, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const content = cards[1].querySelector('.xhs-card-content');
  const r = content.getBoundingClientRect();
  return { x: r.left + r.width * 0.5, y: r.top + Math.min(200, r.height * 0.4), top: r.top, left: r.left };
})()`);
console.log('PT:', JSON.stringify(pt));
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId);
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId);
await sleep(600);
const after = await evaluate(cdp, sessionId, `(() => ({
  md: window.__md, err: window.__err,
  activeCount: document.querySelectorAll('.card-outer-container.active').length,
  activeIndex: (() => { const a = document.querySelector('.card-outer-container.active'); return a ? Array.from(document.querySelectorAll('.card-outer-container')).indexOf(a) : -1; })(),
}))()`);
console.log('AFTER:', JSON.stringify(after, null, 2));
cdp.close(); process.exit(0);
