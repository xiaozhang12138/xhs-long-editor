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
  return { scrollY: window.scrollY, innerH: window.innerHeight, docH: document.documentElement.scrollHeight };
})()`).then(r => console.log('AFTER_INSERT:', JSON.stringify(r)));
await sleep(500);
await evaluate(cdp, sessionId, `(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const fmt = btns.find(b => b.innerText.includes('一键排版'));
  if (fmt) fmt.click();
  return !!fmt;
})()`);
await sleep(3500);
const s = await evaluate(cdp, sessionId, `(() => ({
  scrollY: window.scrollY, innerH: window.innerHeight, docH: document.documentElement.scrollHeight,
  card0: (() => { const r = document.querySelector('.card-outer-container').getBoundingClientRect(); return {top:Math.round(r.top), left:Math.round(r.left), w:Math.round(r.width), h:Math.round(r.height)}; })(),
  vpH: document.querySelector('.card-scroll-viewport') ? Math.round(document.querySelector('.card-scroll-viewport').getBoundingClientRect().height) : -1,
  footerFixed: !!document.querySelector('.fixed.bottom-0'),
}))()`);
console.log('FORMAT_STATE:', JSON.stringify(s, null, 2));
cdp.close(); process.exit(0);
