import { openPage, evaluate, sleep } from './cdp.mjs';
const { cdp, sessionId } = await openPage('http://localhost:3000/');
await sleep(1500);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(1500);
// fill content
await evaluate(cdp, sessionId, `(() => {
  const pm = document.querySelector('.ProseMirror');
  pm.focus();
  const long = Array.from({length: 30}, (_, i) => '第' + i + '段测试内容这里是足够长的文字用来分页。').join('\\n\\n');
  document.execCommand('insertText', false, long);
  return document.querySelector('.ProseMirror').innerText.length;
})()`);
await sleep(600);
await evaluate(cdp, sessionId, `(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const fmt = btns.find(b => b.innerText.includes('一键排版'));
  if (fmt) fmt.click();
  return !!fmt;
})()`);
await sleep(3000);
// capture errors
await cdp.on && null;
const state = await evaluate(cdp, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const vp = document.querySelector('.card-scroll-viewport');
  vp.scrollLeft = 0; window.scrollTo(0,0);
  return {
    pageIndexes: cards.map(c => { const el = c.querySelector('.xhs-card-content'); return el ? el.getAttribute('data-page-index') : 'cover'; }),
    count: cards.length,
  };
})()`);
console.log('STATE:', JSON.stringify(state));
// click card 1 content center via CDP input
const pt = await evaluate(cdp, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const content = cards[1].querySelector('.xhs-card-content');
  const r = content.getBoundingClientRect();
  return { x: r.left + r.width * 0.5, y: r.top + Math.min(200, r.height * 0.4) };
})()`);
console.log('PT:', JSON.stringify(pt));
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId);
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId);
await sleep(600);
const after = await evaluate(cdp, sessionId, `(() => {
  const act = document.querySelector('.card-outer-container.active');
  return {
    activeIndex: act ? Array.from(document.querySelectorAll('.card-outer-container')).indexOf(act) : -1,
    activeCount: document.querySelectorAll('.card-outer-container.active').length,
    ce: act ? act.querySelector('.xhs-card-content')?.contentEditable : null,
  };
})()`);
console.log('AFTER:', JSON.stringify(after));
cdp.close(); process.exit(0);
