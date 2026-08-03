// Footer visibility QA — reproduces the user's real-window bug:
// footer (with 一键排版) was pushed to y=4700 while viewport was 664px.
// Asserts footer button rect.y + height < window.innerHeight at 2 sizes.
import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:3000/';
const SHOT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/qa-footer';
mkdirSync(SHOT, { recursive: true });

const { cdp, sessionId } = await openPage(URL);
await sleep(1800);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(1800);

async function setViewport(w, h) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  await sleep(500);
}

async function fillLongArticle() {
  return evaluate(cdp, sessionId, `(() => {
    const pm = document.querySelector('.ProseMirror');
    pm.focus();
    const long = Array.from({length: 60}, (_, i) =>
      '第' + i + '段测试内容这里是足够长的文字用来把编辑器撑高复现用户 bug。'
    ).join('\\n\\n');
    document.execCommand('insertText', false, long);
    return true;
  })()`);
}

async function footerReport(stageName) {
  return evaluate(cdp, sessionId, `(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('一键排版') || b.innerText.includes('下一步'));
    const footer = document.querySelector('.fixed.bottom-0');
    const editorBody = document.querySelector('.overflow-y-auto');
    const r = btn ? btn.getBoundingClientRect() : null;
    const fr = footer ? footer.getBoundingClientRect() : null;
    return {
      stage: ${JSON.stringify(stageName)},
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      bodyScrollHeight: document.body.scrollHeight,
      btnText: btn ? btn.innerText.trim() : null,
      btnY: r ? Math.round(r.y) : null,
      btnBottom: r ? Math.round(r.y + r.height) : null,
      footerTop: fr ? Math.round(fr.y) : null,
      footerBottom: fr ? Math.round(fr.y + fr.height) : null,
      editorScrollable: editorBody ? editorBody.scrollHeight > editorBody.clientHeight : null,
      editorClientH: editorBody ? editorBody.clientHeight : null,
      footerVisible: btn ? (r.y >= 0 && r.y + r.height <= window.innerHeight) : false,
    };
  })()`);
}

const results = [];

// ── small window 1462×664 (user's failing case) ─────────────────────
await setViewport(1462, 664);
await fillLongArticle();
await sleep(700);
const small = await footerReport('editor@1462x664');
results.push(small);
await screenshot(cdp, sessionId, `${SHOT}/01-editor-1462x664.png`);

// go to format stage, footer should be 下一步 at viewport bottom too
await evaluate(cdp, sessionId, `(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('一键排版'));
  b?.click(); return !!b;
})()`);
await sleep(2500);
const smallFmt = await footerReport('format@1462x664');
results.push(smallFmt);
await screenshot(cdp, sessionId, `${SHOT}/02-format-1462x664.png`);

// ── large window 1920×1080 ──────────────────────────────────────────
await setViewport(1920, 1080);
await evaluate(cdp, sessionId, `Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('返回'))?.click(); true`);
await sleep(1500);
const large = await footerReport('editor@1920x1080');
results.push(large);
await screenshot(cdp, sessionId, `${SHOT}/03-editor-1920x1080.png`);

console.log('RESULTS:', JSON.stringify(results, null, 2));

const allVisible = results.every((r) => r.footerVisible === true);
const allAnchored = results.every((r) => r.footerBottom !== null && r.footerBottom <= r.innerHeight + 1);
console.log(allVisible && allAnchored ? 'FOOTER_PASS' : 'FOOTER_FAIL');
cdp.close();
process.exit(allVisible && allAnchored ? 0 : 1);
