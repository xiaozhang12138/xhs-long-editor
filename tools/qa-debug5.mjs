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
const s = await evaluate(cdp, sessionId, `(() => ({
  scrollY: window.scrollY, docH: document.documentElement.scrollHeight,
  vpH: Math.round(document.querySelector('.card-scroll-viewport').getBoundingClientRect().height),
  vpW: Math.round(document.querySelector('.card-scroll-viewport').getBoundingClientRect().width),
  card0: (() => { const r = document.querySelector('.card-outer-container').getBoundingClientRect(); return {top:Math.round(r.top), left:Math.round(r.left), w:Math.round(r.width), h:Math.round(r.height)}; })(),
  card1: (() => { const r = document.querySelectorAll('.card-outer-container')[1].getBoundingClientRect(); return {top:Math.round(r.top), left:Math.round(r.left), w:Math.round(r.width)}; })(),
}))()`);
console.log('FORMAT_STATE:', JSON.stringify(s, null, 2));
cdp.close(); process.exit(0);
