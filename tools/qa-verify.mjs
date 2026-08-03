// Headless QA: verify the reworked XHS long-article format page against the
// original measured specs (horizontal dual cards, click-to-edit, 20 templates).
import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';

const URL = 'http://localhost:3000/';
const SHOT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/qa';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOT, { recursive: true });

const { cdp, sessionId } = await openPage(URL);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1720, height: 1000, deviceScaleFactor: 1, mobile: false,
}, sessionId);
await sleep(2000);
await evaluate(cdp, sessionId, `localStorage.clear(); location.reload(); true`);
await sleep(2500);

const stage1 = await evaluate(cdp, sessionId, `(() => ({
  title: document.title,
  hasEditor: !!document.querySelector('.ProseMirror'),
  hasTitleInput: !!document.querySelector('input[placeholder*="标题"], input, textarea'),
  toolbarBtns: document.querySelectorAll('.toolbar-btn').length,
}))()`);
console.log('STAGE1:', JSON.stringify(stage1));

// ── 2. fill title + long content (→ multiple pages) ─────────────────
await evaluate(cdp, sessionId, `(() => {
  const input = document.querySelector('input, textarea');
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '灵魂改造测试长文：小红书写长文编辑器');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const pm = document.querySelector('.ProseMirror');
  pm.focus();
  const long = Array.from({length: 120}, (_, i) =>
    (i % 10 === 0 ? '## ' : '') + '第' + i + '段测试内容：轻感明快是默认模板，点击卡片可以直接改字，改动实时同步到所有卡片。'
  ).join('\\n\\n');
  document.execCommand('insertText', false, long);
  return document.querySelector('.ProseMirror').innerText.length;
})()`);
await sleep(800);

// ── 3. go to format page ────────────────────────────────────────────
await evaluate(cdp, sessionId, `(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const fmt = btns.find(b => b.innerText.includes('一键排版'));
  if (fmt) fmt.click();
  return !!fmt;
})()`);
await sleep(3500);

const fmt1 = await evaluate(cdp, sessionId, `(() => {
  const wrapper = document.querySelector('.loading-cards-wrapper');
  const vp = document.querySelector('.card-scroll-viewport');
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const first = cards[0];
  return {
    hasWrapper: !!wrapper,
    hasViewport: !!vp,
    cardCount: cards.length,
    firstCardW: first ? first.offsetWidth : 0,
    firstCardH: first ? first.offsetHeight : 0,
    wrapperScrollWidth: wrapper ? wrapper.scrollWidth : 0,
    viewportClientWidth: vp ? vp.clientWidth : 0,
    badges: Array.from(document.querySelectorAll('.card-page-badge')).slice(0, 4).map(b => b.textContent.trim()),
    dots: document.querySelectorAll('.card-dot').length,
    hasSlider: !!document.querySelector('input[type="range"]'),
    totalText: (document.querySelector('.card-dots')?.parentElement?.innerText || ''),
    renderDisabledOnFirst: first ? first.classList.contains('render-mode-disabled') : false,
    templateCards: document.querySelectorAll('.template-card').length,
    firstTemplateName: document.querySelector('.template-card p')?.textContent?.trim(),
    selectedTemplate: document.querySelector('.template-card.selected p')?.textContent?.trim(),
  };
})()`);
console.log('FORMAT1:', JSON.stringify(fmt1, null, 2));
await screenshot(cdp, sessionId, `${SHOT}/01-format-horizontal.png`);

// ── 4. click card → contenteditable activates (real CDP input) ─────
const clickTarget = await evaluate(cdp, sessionId, `(() => {
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  // scroll the first content card fully into view first
  const card = cards[1];
  card.scrollIntoView({ inline: 'center', block: 'nearest' });
  return true;
})()`);
await sleep(500);
const editCheck = await evaluate(cdp, sessionId, `(async () => {
  // Reset any inherited scroll so cards 0+1 are side by side at scrollLeft=0.
  window.scrollTo({ top: 0, behavior: 'instant' });
  const vp = document.querySelector('.card-scroll-viewport');
  vp.style.scrollBehavior = 'auto';
  vp.scrollLeft = 0;
  await new Promise(r => setTimeout(r, 100));
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  const card = cards[1]; // first content page
  const content = card.querySelector('.xhs-card-content');
  // Find a click point inside the visible viewport AND landing on content.
  let pt = null;
  for (const fy of [0.3, 0.5, 0.7]) {
    for (const fx of [0.3, 0.5, 0.7]) {
      const r = content.getBoundingClientRect();
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      if (y < 70 || y > window.innerHeight - 30) continue;
      const el = document.elementFromPoint(x, y);
      if (el && el.closest('.xhs-card-content')) { pt = { x, y }; break; }
    }
    if (pt) break;
  }
  return { pt, rectTop: content.getBoundingClientRect().top, rectLeft: content.getBoundingClientRect().left,
           vpScrollLeft: vp.scrollLeft };
})()`);
console.log('EDIT_TARGET:', JSON.stringify(editCheck, null, 2));
if (!editCheck.pt) { console.log('QA_ABORT: no clickable point'); cdp.close(); process.exit(1); }
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: editCheck.pt.x, y: editCheck.pt.y, button: 'left', clickCount: 1 }, sessionId);
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: editCheck.pt.x, y: editCheck.pt.y, button: 'left', clickCount: 1 }, sessionId);
await sleep(600);
const editState = await evaluate(cdp, sessionId, `(() => {
  const active = document.querySelector('.card-outer-container.active');
  const activeContent = active && active.querySelector('.xhs-card-content');
  return {
    activated: !!active,
    activeIndex: active ? Array.from(document.querySelectorAll('.card-outer-container')).indexOf(active) : -1,
    contentEditable: activeContent ? activeContent.contentEditable : null,
    renderDisabledRemoved: active ? !active.classList.contains('render-mode-disabled') : false,
    toolbarVisible: !!document.querySelector('.card-toolbar'),
    editHint: document.querySelector('.card-edit-hint')?.textContent?.trim() || '',
    focused: activeContent ? document.activeElement === activeContent : false,
  };
})()`);
console.log('EDIT:', JSON.stringify(editState, null, 2));
await screenshot(cdp, sessionId, `${SHOT}/02-card-editing.png`);

// ── 5. type in the active card → merge-back updates store + re-paginates ──
const typeCheck = await evaluate(cdp, sessionId, `(async () => {
  const active = document.querySelector('.card-outer-container.active');
  if (!active) return { err: 'no active card' };
  const content = active.querySelector('.xhs-card-content');
  content.focus();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false); // caret at END → typed text overflows into next card
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  // 500 chars forces the merged content to overflow into the next card
  const marker = '【点击编辑成功】';
  document.execCommand('insertText', false, marker + 'X'.repeat(400));
  await new Promise(r => setTimeout(r, 4500)); // debounce (500ms) + autosave (3s)
  const draft = JSON.parse(localStorage.getItem('xhs-long-article-draft') || '{}');
  const updated = (draft.contentHtml || '').includes(marker);
  return { updatedInStore: updated, wordCount: draft.wordCount };
})()`);
console.log('TYPE:', JSON.stringify(typeCheck, null, 2));

// deactivate → cards re-render from the merged store; the marker must survive
// in the freshly rendered (non-active) cards.
const deact = await evaluate(cdp, sessionId, `(async () => {
  const vp = document.querySelector('.card-scroll-viewport');
  const rect = vp.getBoundingClientRect();
  const el = document.elementFromPoint(rect.left + 8, Math.max(60, rect.top + 20));
  if (el && !el.closest('.card-outer-container')) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  } else {
    // click the header area instead (definitely not a card)
    const hint = document.querySelector('.card-edit-hint');
    if (hint) hint.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  }
  await new Promise(r => setTimeout(r, 600));
  const cards = Array.from(document.querySelectorAll('.card-outer-container'));
  return {
    activeCount: document.querySelectorAll('.card-outer-container.active').length,
    disabledCount: document.querySelectorAll('.card-outer-container.render-mode-disabled').length,
    markerSurvivesInCards: cards.some(c => (c.textContent || '').includes('点击编辑成功')),
  };
})()`);
console.log('DEACT:', JSON.stringify(deact, null, 2));

// ── 7. switch template (线条复古) → cards re-theme ──────────────────
const tplCheck = await evaluate(cdp, sessionId, `(async () => {
  const cards = Array.from(document.querySelectorAll('.template-card'));
  const target = cards.find(c => (c.querySelector('p')?.textContent || '').includes('线条复古'));
  if (!target) return { err: 'no 线条复古 template card' };
  target.click();
  await new Promise(r => setTimeout(r, 1500));
  const first = document.querySelector('.card-outer-container');
  return {
    selected: document.querySelector('.template-card.selected p')?.textContent?.trim(),
    firstCardClass: first ? first.className : '',
    fontFamily: first ? getComputedStyle(first).fontFamily.slice(0, 60) : '',
    bgColor: first ? getComputedStyle(first).backgroundColor : '',
  };
})()`);
console.log('TPL:', JSON.stringify(tplCheck, null, 2));
await screenshot(cdp, sessionId, `${SHOT}/03-template-line-retro.png`);

// ── 8. scroll slider → scrollLeft changes ───────────────────────────
const sliderCheck = await evaluate(cdp, sessionId, `(async () => {
  const vp = document.querySelector('.card-scroll-viewport');
  const slider = document.querySelector('input[type="range"]');
  const before = vp.scrollLeft;
  if (slider && Number(slider.max) >= 1) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(slider, '1');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await new Promise(r => setTimeout(r, 2500));
  const after = vp.scrollLeft;
  // click a dot as well (dot index 2)
  const dots = document.querySelectorAll('.card-dot');
  if (dots[2]) dots[2].click();
  await new Promise(r => setTimeout(r, 2500));
  return { before, after, afterDotClick: vp.scrollLeft, max: slider ? slider.max : -1 };
})()`);
console.log('SLIDER:', JSON.stringify(sliderCheck, null, 2));
await screenshot(cdp, sessionId, `${SHOT}/04-slider-scrolled.png`);

await screenshot(cdp, sessionId, `${SHOT}/05-final.png`);
console.log('QA_DONE');
cdp.close();
process.exit(0);
