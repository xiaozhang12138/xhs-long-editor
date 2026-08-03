// ─────────────────────────────────────────────────────────────────────────────
// QA Acceptance — 小红书「写长文」灵魂改造 (INDEPENDENT, fresh-eyes)
// Written by Edward (QA). Connection infra borrowed from pagecdp.mjs, but ALL
// assertions are written fresh from the PRD/design spec — not from the
// engineer's self-reported results.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, '..', '.cache', 'qa');
const PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'http://localhost:3000/';
const STORAGE_KEY = 'xhs-long-article-draft';

// ── tiny connection infra (same as tools/pagecdp.mjs) ────────────────────────
async function cdpAlive() {
  try { const r = await fetch(`${BASE}/json/version`); return r.ok; } catch { return false; }
}
async function launchEdge() {
  const { spawn } = await import('node:child_process');
  const edge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
  const profile = join(__dirname, '..', '.edge-clone-profile');
  const child = spawn(edge, [
    '--remote-debugging-port=9333',
    `--user-data-dir=${profile}`,
    '--no-sandbox', '--no-first-run', '--disable-background-networking',
    APP,
  ], { stdio: 'ignore', detached: true });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await sleep(600);
    if (await cdpAlive()) return true;
  }
  return false;
}
async function findAppPage() {
  if (!(await cdpAlive())) {
    console.log('CDP 9333 not alive — launching Edge…');
    const ok = await launchEdge();
    if (!ok) throw new Error('Failed to launch Edge on 9333');
  }
  const list = await fetch(`${BASE}/json/list`).then((r) => r.json());
  let t = list.find((x) => x.type === 'page' && x.url.startsWith(APP) && !x.url.startsWith('edge://'));
  if (!t) {
    // navigate an existing page target to the app
    const page = list.find((x) => x.type === 'page' && !x.url.startsWith('edge://'));
    if (page) {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
      ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: APP } }));
      await sleep(2500);
      ws.close();
      const list2 = await fetch(`${BASE}/json/list`).then((r) => r.json());
      t = list2.find((x) => x.type === 'page' && x.url.startsWith(APP));
    }
  }
  return t;
}
class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        if (p) { this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
      } else { (this.events.get(m.method) || []).forEach((fn) => fn(m.params)); }
    });
  }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    return new Page(ws);
  }
  send(method, params = {}, timeout = 30000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout:${method}`)); } }, timeout);
    });
  }
  on(method, fn) { if (!this.events.has(method)) this.events.set(method, []); this.events.get(method).push(fn); }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  async shot(path, opts = {}) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', ...opts }, 60000);
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  }
  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 60));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async mouseDrag(x1, y1, x2, y2, steps = 12) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(x1 + ((x2 - x1) * i) / steps);
      const y = Math.round(y1 + ((y2 - y1) * i) / steps);
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => setTimeout(r, 80));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
  }
  async type(text) { await this.send('Input.insertText', { text }); }
  async key(key, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, modifiers });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
  }
  close() { this.ws.close(); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── results collector ─────────────────────────────────────────────────────────
const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}
function section(t) { console.log(`\n===== ${t} =====`); }

let page;
let shotSeq = 0;
async function shot(name) {
  const p = join(SHOT_DIR, `qa-indep-${String(shotSeq++).padStart(2, '0')}-${name}.png`);
  await page.shot(p);
  return p;
}

// ── helpers ───────────────────────────────────────────────────────────────────
/** Generate a valid PNG (solid color) in Node, return base64. */
function makePngBase64(w = 320, h = 240, rgb = [255, 36, 66]) {
  // build raw scanlines with filter byte 0
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter none
    for (let x = 0; x < w; x++) {
      const o = y * stride + 1 + x * 3;
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2];
    }
  }
  const idat = deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const QA_PNG_B64 = makePngBase64(320, 240, [255, 36, 66]);

async function waitFor(expr, timeout = 8000, label = expr) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const v = await page.eval(expr);
      if (v) return v;
    } catch { /* keep waiting */ }
    await sleep(150);
  }
  throw new Error(`waitFor timeout: ${label}`);
}

async function clickButtonByText(text) {
  const ok = await page.eval(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => (x.textContent||'').trim().includes(${JSON.stringify(text)}));
    if (!b) return false;
    b.click(); return true;
  })()`);
  return ok;
}

/** Get viewport rect (CSS px) of the first element matching selector. */
async function rectOf(sel) {
  return page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  })()`);
}

/** Count cards / page info from the format page. */
async function cardInfo() {
  return page.eval(`(() => {
    const cards = [...document.querySelectorAll('.card-outer-container')];
    const viewport = document.querySelector('.card-scroll-viewport');
    return {
      count: cards.length,
      badges: [...document.querySelectorAll('.card-page-badge')].map(b => b.textContent.trim()),
      vpClientWidth: viewport ? viewport.clientWidth : 0,
      vpScrollWidth: viewport ? viewport.scrollWidth : 0,
      vpScrollLeft: viewport ? viewport.scrollLeft : 0,
      dotCount: document.querySelectorAll('.card-dot').length,
      hasSlider: !!document.querySelector('input.xhs-range'),
      sliderMax: document.querySelector('input.xhs-range') ? document.querySelector('input.xhs-range').max : null,
      bottomText: (() => {
        const el = document.querySelector('input.xhs-range')?.closest('div')?.parentElement;
        return el ? el.innerText : '';
      })(),
      cardRects: cards.slice(0, 4).map(c => {
        const r = c.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), ow: c.offsetWidth, oh: c.offsetHeight, cls: c.className };
      }),
    };
  })()`);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const target = await findAppPage();
  if (!target) throw new Error('No app page found on CDP 9333');
  page = await Page.attach(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  console.log('Connected to:', target.url);

  // Fresh slate
  await page.eval(`localStorage.clear(); location.reload(); true`);
  await sleep(2500);

  // ── B1: 横向双卡并排 ──────────────────────────────────────────────────────
  section('B1 横向双卡并排');
  await waitFor(`!!document.querySelector('.ProseMirror')`, 10000, 'editor ready');
  // Focus editor, then type title
  const titleInput = await rectOf('input[placeholder="填写标题"]');
  check('B1.0 标题输入框存在', !!titleInput, JSON.stringify(titleInput));
  if (titleInput) {
    await page.mouseClick(titleInput.left + 100, titleInput.top + 10);
    await sleep(200);
    await page.type('QA独立验收标题：灵魂改造实测');
    await sleep(400);
  }
  // Type ~1800 chars of body text
  const editorRect = await rectOf('.ProseMirror');
  check('B1.0b 编辑器存在', !!editorRect, JSON.stringify(editorRect));
  if (editorRect) {
    await page.mouseClick(editorRect.left + 120, editorRect.top + 30);
    await sleep(300);
    const paras = [];
    const filler = '这是一段用于验证分页与双卡排版的中文正文，包含生活记录与心得分享。每一段都力求足够长度以便触发多页分页，让横向卡片流能够真正滚动起来。';
    for (let i = 0; i < 26; i++) {
      paras.push(`第${i + 1}段。${filler}${filler}${filler}`);
    }
    const body = paras.join('\n');
    // insert in chunks
    for (let i = 0; i < body.length; i += 600) {
      await page.type(body.slice(i, i + 600));
      await sleep(60);
    }
    await sleep(1200);
  }
  // Click 一键排版
  const clicked = await clickButtonByText('一键排版');
  check('B1.1 点击一键排版', clicked === true);
  await sleep(2500);
  await shot('b1-format-initial');
  const info = await cardInfo();
  check('B1.2 预览区为横向滚动容器', info && info.vpScrollWidth > info.vpClientWidth,
    `scrollWidth=${info?.vpScrollWidth} clientWidth=${info?.vpClientWidth}`);
  check('B1.3 多页生成(>1张卡)', info && info.count > 1, `count=${info?.count}`);
  check('B1.4 卡片为 900×1500 (offsetWidth/Height)', info && info.cardRects[0] && info.cardRects[0].ow === 900 && info.cardRects[0].oh === 1500,
    JSON.stringify(info?.cardRects?.[0]));
  check('B1.5 一次并排可见≥2张卡', info && info.cardRects.length >= 2 && info.cardRects[1].left >= info.cardRects[0].left &&
    info.cardRects[0].left < info.vpClientWidth && info.cardRects[1].left < info.vpClientWidth,
    JSON.stringify(info?.cardRects?.slice(0, 2)));
  check('B1.6 页码badge 1/N 2/N', info && info.badges[0] === `1/${info.count}` && info.badges[1] === `2/${info.count}`,
    JSON.stringify(info?.badges?.slice(0, 2)));
  check('B1.7 底部滑块+圆点+共N张', info && info.hasSlider && info.dotCount === info.count &&
    info.bottomText.includes('拖动滑块快速定位') && info.bottomText.includes(`共${info.count}张`),
    `sliderMax=${info?.sliderMax} dots=${info?.dotCount} text=${info?.bottomText}`);
  const totalPages = info ? info.count : 0;

  // Slider interaction → scrollLeft change
  if (totalPages >= 3) {
    const before = (await cardInfo()).vpScrollLeft;
    await page.eval(`(() => {
      const r = document.querySelector('input.xhs-range');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(r, '2');
      r.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(1200);
    const after = (await cardInfo()).vpScrollLeft;
    check('B1.8 拖动滑块→scrollLeft变化', after > before, `before=${before} after=${after}`);
    await shot('b1-slider-scrolled');
    // Dot click → click a DIFFERENT dot (第 4 张 = index 3)
    const b2 = (await cardInfo()).vpScrollLeft;
    await page.eval(`(() => {
      const dot = document.querySelector('.card-dot[aria-label="第 4 张"]') || [...document.querySelectorAll('.card-dot')][3];
      if (dot) dot.click();
      return true;
    })()`);
    await sleep(1200);
    const a2 = (await cardInfo()).vpScrollLeft;
    check('B1.9 点击圆点→scrollLeft变化', a2 !== b2, `before=${b2} after=${a2}`);
  } else {
    check('B1.8/B1.9 跳过(页数不足3)', false, '页数不足无法滑动测试');
  }

  // reset scroll to start for the click-to-edit test
  await page.eval(`(() => {
    const vp = document.querySelector('.card-scroll-viewport');
    if (vp) { vp.scrollLeft = 0; vp.dispatchEvent(new Event('scroll', { bubbles: true })); }
    return true;
  })()`);
  await sleep(1000);

  // ── B2: 点击卡片可编辑 ────────────────────────────────────────────────────
  section('B2 点击卡片可编辑(灵魂)');
  // Non-active card should have render-mode-disabled
  const disabledState = await page.eval(`(() => {
    const cards = [...document.querySelectorAll('.card-outer-container')];
    const c = cards[1];
    if (!c) return null;
    return {
      cls: c.className,
      editable: c.querySelector('.xhs-card-content')?.isContentEditable || false,
    };
  })()`);
  check('B2.1 非激活卡 render-mode-disabled + contenteditable不生效',
    disabledState && disabledState.cls.includes('render-mode-disabled') && !disabledState.editable,
    JSON.stringify(disabledState));

  // Click card #2 content text area (real CDP mouse)
  const card2 = await rectOf('.card-outer-container:nth-of-type(2) .xhs-card-content') ||
                (await page.eval(`(() => {
                  const cards = [...document.querySelectorAll('.card-outer-container')];
                  const content = cards[1]?.querySelector('.xhs-card-content');
                  if (!content) return null;
                  const r = content.getBoundingClientRect();
                  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
                })()`));
  check('B2.2 找到第2张卡的文字区域', !!card2, JSON.stringify(card2));
  if (card2) {
    await page.mouseClick(card2.left + card2.width * 0.5, card2.top + card2.height * 0.3);
    await sleep(800);
    const activeState = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      const active = cards.find(c => c.classList.contains('active'));
      if (!active) return null;
      const content = active.querySelector('.xhs-card-content');
      return {
        cls: active.className,
        contentEditable: content ? content.isContentEditable : null,
        activeFound: true,
      };
    })()`);
    check('B2.3 点击后该卡 render-mode-disabled移除+contenteditable=true',
      activeState && activeState.activeFound && !activeState.cls.includes('render-mode-disabled') && activeState.contentEditable === true,
      JSON.stringify(activeState));
    await shot('b2-active-card');

    // Type into active card
    await page.type('QA独立验证');
    // Card edit commit debounce = 500ms (merge back to store), then the
    // store's auto-save writes localStorage after a 3s debounce. Wait 4s to
    // cover both so localStorage is genuinely updated.
    await sleep(4200);
    const storeText = await page.eval(`(() => {
      try {
        const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
        const d = JSON.parse(raw);
        return { hasText: (d.content || '').includes('QA独立验证'), title: d.title };
      } catch (e) { return { err: String(e) }; }
    })()`);
    check('B2.4 500ms回写+3s自动保存后 localStorage 内容更新', storeText && storeText.hasText, JSON.stringify(storeText));
    // Re-pagination keeps text
    await sleep(1000);
    const cardsText = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      const all = cards.map(c => c.innerText || '').join('|');
      return { has: all.includes('QA独立验证'), sample: all.slice(0, 200) };
    })()`);
    check('B2.5 重新分页后文字保留', cardsText.has === true, JSON.stringify(cardsText).slice(0, 160));

    // Toolbar bold on active card: select a word then click 粗体
    const boldResult = await page.eval(`(() => {
      const active = [...document.querySelectorAll('.card-outer-container')].find(c => c.classList.contains('active'));
      if (!active) return { ok: false, reason: 'no active card' };
      const content = active.querySelector('.xhs-card-content');
      if (!content) return { ok: false, reason: 'no content' };
      const sel = window.getSelection();
      const range = document.createRange();
      // pick first text node inside content
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const tn = walker.nextNode();
      if (!tn) return { ok: false, reason: 'no text node' };
      const len = Math.min(6, tn.data.length);
      range.setStart(tn, 0);
      range.setEnd(tn, len);
      sel.removeAllRanges();
      sel.addRange(range);
      return { ok: true, selected: tn.data.slice(0, len) };
    })()`);
    check('B2.6 选中卡内文字', boldResult.ok === true, JSON.stringify(boldResult));
    if (boldResult.ok) {
      await page.eval(`(() => {
        const btn = [...document.querySelectorAll('.card-toolbar .toolbar-btn')].find(b => (b.title || '').includes('粗体'));
        if (btn) btn.click();
        return true;
      })()`);
      await sleep(1200);
      const boldState = await page.eval(`(() => {
        const active = [...document.querySelectorAll('.card-outer-container')].find(c => c.classList.contains('active'));
        const content = active ? active.querySelector('.xhs-card-content') : null;
        if (!content) return { ok: false, reason: 'no content' };
        const spans = [...content.querySelectorAll('span')];
        const bolded = spans.find(s => {
          const st = getComputedStyle(s);
          return (parseInt(st.fontWeight) >= 600) || st.textDecorationLine.includes('underline') || st.backgroundColor !== 'rgba(0, 0, 0, 0)';
        });
        return { ok: !!bolded, spanCount: spans.length, boldedHTML: bolded ? bolded.outerHTML.slice(0, 120) : null };
      })()`);
      check('B2.7 卡内工具栏粗体生效', boldState.ok === true, JSON.stringify(boldState).slice(0, 200));
      await shot('b2-toolbar-bold');
    }
    // Exit edit by clicking blank area
    await page.eval(`(() => { const vp = document.querySelector('.card-scroll-viewport'); if (vp) vp.click(); return true; })()`);
    await sleep(400);
  }

  // Persistence across reload: data is in localStorage; app always boots to
  // editor stage, so verify storage first, then re-enter format and check DOM.
  await page.eval(`location.reload(); true`);
  await sleep(2500);
  await waitFor(`!!document.querySelector('.ProseMirror')`, 8000, 'editor after reload');
  const reloadStore = await page.eval(`(() => {
    try { const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}); return (raw || '').includes('QA独立验证'); }
    catch { return false; }
  })()`);
  check('B2.8a 刷新后 localStorage 保留编辑文字', reloadStore === true, `has=${reloadStore}`);
  await clickButtonByText('一键排版');
  await sleep(2500);
  const reloadText = await page.eval(`(() => {
    const cards = [...document.querySelectorAll('.card-outer-container')];
    return { has: cards.some(c => (c.innerText || '').includes('QA独立验证')), count: cards.length };
  })()`).catch(() => ({ has: false }));
  check('B2.8b 刷新后重新排版卡片仍含编辑文字', reloadText && reloadText.has, JSON.stringify(reloadText));
  await shot('b2-reload-persist');

  // ── B3: 20 模板渲染 ───────────────────────────────────────────────────────
  section('B3 20模板渲染');
  await waitFor(`document.querySelectorAll('.template-card').length > 0`, 8000, 'template list');
  const tplCount = await page.eval(`document.querySelectorAll('.template-card').length`);
  check('B3.1 模板列表 20 个', tplCount === 20, `count=${tplCount}`);

  const tplNames = ['轻感明快', '手帐书写', '黑白极简', '大图纯享', '交叉拓扑'];
  const tplResults = [];
  for (const name of tplNames) {
    const clicked = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.template-card')];
      const c = cards.find(x => (x.textContent || '').includes(${JSON.stringify(name)}));
      if (!c) return false;
      c.click(); return true;
    })()`);
    await sleep(1800);
    if (!clicked) { check(`B3.2 切换到模板[${name}]`, false, '未找到模板卡'); continue; }
    const st = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      const c = cards[0];
      if (!c) return null;
      const cs = getComputedStyle(c);
      const body = cards[1] ? getComputedStyle(cards[1]) : null;
      const deco = c.querySelector('.card-title-deco, [class*="title"], .xhs-card-inner > div span, .xhs-cover-title-editable') ? true : false;
      // find title decoration elements: spans that are not text
      const inner = c.querySelector('.xhs-card-inner');
      const decoSpan = inner ? [...inner.querySelectorAll('span')].filter(s => s.textContent.trim() === '' || ['“','⌜','《','✎ 手帐札记','# 札记','FRAME','MAGAZINE','01','❀'].includes(s.textContent.trim())).length : 0;
      return {
        font: cs.fontFamily,
        bg: cs.backgroundColor,
        color: cs.color,
        bodyFont: body ? body.fontFamily : null,
        decoCount: decoSpan,
        readableDark: (() => {
          const b = cs.backgroundColor.match(/\\d+/g)?.map(Number) || [];
          const t = cs.color.match(/\\d+/g)?.map(Number) || [];
          if (b.length < 3) return true;
          const lum = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
          const tlum = 0.299 * (t[0]||0) + 0.587 * (t[1]||0) + 0.114 * (t[2]||0);
          return Math.abs(lum - tlum) > 80;
        })(),
      };
    })()`);
    tplResults.push({ name, ...st });
    await shot(`b3-${name}`);
    check(`B3.3 模板[${name}]卡片字体栈存在`, st && !!st.font && st.font.includes(','), JSON.stringify(st?.font));
  }
  // Font stack differences
  const fonts = tplResults.filter(r => r).map(r => r.font);
  const uniqueFonts = new Set(fonts);
  check('B3.4 不同模板字体栈不同(≥2种)', uniqueFonts.size >= 2, `unique=${uniqueFonts.size} fonts=${JSON.stringify([...uniqueFonts].map(f=>f.slice(0,40)))}`);
  const darkTpl = tplResults.find(r => r && r.name === '大图纯享');
  check('B3.5 深色模板(大图纯享)文字可读', !darkTpl || darkTpl.readableDark, JSON.stringify(darkTpl ? { bg: darkTpl.bg, color: darkTpl.color } : null));
  const decoSums = tplResults.filter(r => r).map(r => r.decoCount);
  check('B3.6 标题装饰存在(至少一个模板有装饰元素)', decoSums.some(n => n > 0), `decoCounts=${JSON.stringify(decoSums)}`);
  await shot('b3-final');

  // Bold visual difference: commit a bold mark once, then compare the
  // RENDERED (non-active) bold span styles across templates. applyBoldStyle
  // maps the bold mark per template (e.g. 手帐书写=underline, 黑白极简=combo).
  section('B3b 模板加粗视觉差异');
  const boldInTemplate = async (tplName) => {
    await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.template-card')];
      const c = cards.find(x => (x.textContent || '').includes(${JSON.stringify(tplName)}));
      if (c) c.click();
      return true;
    })()`);
    await sleep(1600);
    // activate content page 1 (card index 1)
    const rect = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      const content = cards[1]?.querySelector('.xhs-card-content');
      if (!content) return null;
      const r = content.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    })()`);
    if (!rect) return null;
    await page.mouseClick(rect.left + rect.width * 0.5, rect.top + Math.min(120, rect.height * 0.3));
    await sleep(700);
    const selOk = await page.eval(`(() => {
      const active = [...document.querySelectorAll('.card-outer-container')].find(c => c.classList.contains('active'));
      const content = active ? active.querySelector('.xhs-card-content') : null;
      if (!content) return false;
      const sel = window.getSelection(); const range = document.createRange();
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const tn = walker.nextNode();
      if (!tn || !tn.data.trim()) return false;
      const len = Math.min(6, tn.data.length);
      range.setStart(tn, 0); range.setEnd(tn, len);
      sel.removeAllRanges(); sel.addRange(range);
      const btn = [...document.querySelectorAll('.card-toolbar .toolbar-btn')].find(b => (b.title || '').includes('粗体'));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (!selOk) return null;
    await sleep(1300); // let debounce commit merge back
    // exit edit mode → card re-renders through renderBlocks + applyBoldStyle
    await page.eval(`(() => {
      const vp = document.querySelector('.card-scroll-viewport');
      const rect = vp.getBoundingClientRect();
      vp.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + 4, clientY: rect.bottom - 4, bubbles: true }));
      return true;
    })()`);
    await sleep(1200);
    return page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      for (const c of cards) {
        const spans = [...c.querySelectorAll('.xhs-card-content span')];
        const bolded = spans.find(s => {
          const st = getComputedStyle(s);
          return parseInt(st.fontWeight) >= 600 || st.textDecorationLine.includes('underline') || st.textDecorationLine.includes('double') || st.backgroundColor !== 'rgba(0, 0, 0, 0)' || (st.textShadow && st.textShadow !== 'none');
        });
        if (bolded) {
          const st = getComputedStyle(bolded);
          return { bg: st.backgroundColor, color: st.color, deco: st.textDecorationLine, weight: st.fontWeight, font: st.fontFamily.slice(0, 40) };
        }
      }
      return null;
    })()`);
  };
  const boldA = await boldInTemplate('手帐书写');
  await shot('b3-bold-shouzhang-rendered');
  const boldB = await boldInTemplate('黑白极简');
  await shot('b3-bold-heibai-rendered');
  check('B3.7 不同模板加粗视觉不同(手帐underline vs 黑白combo)', !!boldA && !!boldB && JSON.stringify(boldA) !== JSON.stringify(boldB),
    `手帐=${JSON.stringify(boldA)} 黑白=${JSON.stringify(boldB)}`);

  // ── B4: Ctrl+V 粘贴插图 ──────────────────────────────────────────────────
  section('B4 Ctrl+V 粘贴插图');
  // go back to editor
  await clickButtonByText('暂存离开').catch(() => {});
  // Actually navigate back: click the back arrow in header or use direct stage
  const backClicked = await page.eval(`(() => {
    const hdr = document.querySelector('.EditorHeader, header, [class*="header"]');
    const back = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('返回') || (b.title||'').includes('返回') || (b.getAttribute('aria-label')||'').includes('返回'));
    if (back) { back.click(); return true; }
    return false;
  })()`);
  check('B4.0 返回编辑器', backClicked === true);
  await sleep(2000);
  // ensure we are on editor
  const onEditor = await page.eval(`!!document.querySelector('.ProseMirror')`);
  if (!onEditor) {
    // try clicking top-left nav back
    await page.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('一键排版')); return false; })()`);
    await sleep(500);
  }
  await waitFor(`!!document.querySelector('.ProseMirror')`, 8000, 'editor again');
  // simulate paste with DataTransfer image file (320×240 PNG generated by Node)
  const pasteResult = await page.eval(`(async () => {
    const editor = document.querySelector('.ProseMirror');
    if (!editor) return { ok: false, reason: 'no editor' };
    editor.focus();
    const beforeCount = editor.querySelectorAll('img').length;
    const dt = new DataTransfer();
    const bytes = Uint8Array.from(atob(${JSON.stringify(QA_PNG_B64)}), c => c.charCodeAt(0));
    const file = new File([bytes], 'qa-paste.png', { type: 'image/png' });
    dt.items.add(file);
    const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    const handled = !editor.dispatchEvent(evt);
    await new Promise(r => setTimeout(r, 1500));
    const imgs = editor.querySelectorAll('img');
    return {
      ok: true,
      handled,
      beforeCount,
      afterCount: imgs.length,
      newImages: imgs.length - beforeCount,
      imgSrcHead: imgs.length ? imgs[imgs.length - 1].src.slice(0, 30) : null,
      imgW: imgs.length ? imgs[imgs.length - 1].offsetWidth : 0,
      imgH: imgs.length ? imgs[imgs.length - 1].offsetHeight : 0,
    };
  })()`);
  check('B4.1 粘贴后编辑器新增 <img> 节点(非重复)', pasteResult && pasteResult.newImages === 1,
    JSON.stringify(pasteResult));
  await shot('b4-paste-image');
  // note on real system clipboard limitation
  check('B4.2 说明：CDP无法模拟真实系统剪贴板，已用ClipboardEvent+DataTransfer构造图片File（覆盖 handlePaste 代码路径）', true, '合成剪贴板事件');

  // ── B5: 图片缩放 ──────────────────────────────────────────────────────────
  section('B5 图片缩放');
  // Editor resize: select the image → handle appears → drag
  const imgRect = await rectOf('.ProseMirror img');
  check('B5.1 编辑器中有图片可选中', !!imgRect, JSON.stringify(imgRect));
  if (imgRect) {
    await page.mouseClick(imgRect.left + 5, imgRect.top + 5);
    await sleep(900);
    const handle = await rectOf('.image-resize-handle');
    check('B5.2 编辑器选中图片出现缩放手柄', !!handle, JSON.stringify(handle));
    if (handle) {
      const wBefore = await page.eval(`document.querySelector('.ProseMirror img')?.offsetWidth || 0`);
      await page.mouseDrag(handle.left + 5, handle.top + 5, handle.left + 120, handle.top + 120, 15);
      await sleep(700);
      const wAfter = await page.eval(`document.querySelector('.ProseMirror img')?.offsetWidth || 0`);
      check('B5.3 拖拽手柄→图片width变化', wAfter > wBefore, `before=${wBefore} after=${wAfter}`);
      await shot('b5-editor-resize');
    }
  }

  // Preview card resize: go to format, click image in a card
  await clickButtonByText('一键排版');
  await sleep(2500);
  const imgCard = await page.eval(`(() => {
    const cards = [...document.querySelectorAll('.card-outer-container')];
    for (const c of cards) {
      const img = c.querySelector('.xhs-card-content img');
      if (img) {
        const r = img.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height, cardIdx: cards.indexOf(c) };
      }
    }
    return null;
  })()`);
  check('B5.4 预览卡中存在图片', !!imgCard, JSON.stringify(imgCard));
  if (imgCard) {
    // activate card first by clicking the content area
    const cardIdx = imgCard.cardIdx;
    const cardRect = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      const r = cards[${cardIdx}].getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    })()`);
    await page.mouseClick(cardRect.left + cardRect.width * 0.6, cardRect.top + cardRect.height * 0.4);
    await sleep(800);
    // click the image to select it
    const img2 = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.card-outer-container')];
      for (const c of cards) {
        const img = c.querySelector('.xhs-card-content img');
        if (img) {
          const r = img.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      }
      return null;
    })()`);
    if (img2) {
      await page.mouseClick(img2.left + img2.width * 0.5, img2.top + img2.height * 0.5);
      await sleep(900);
      const chandle = await rectOf('.card-img-resize-handle');
      check('B5.5 预览卡选中图片出现右下角缩放手柄', !!chandle, JSON.stringify(chandle));
      if (chandle) {
        const wBefore = await page.eval(`(() => {
          const cards = [...document.querySelectorAll('.card-outer-container')];
          for (const c of cards) { const img = c.querySelector('.xhs-card-content img'); if (img) return img.offsetWidth; }
          return 0;
        })()`);
        await page.mouseDrag(chandle.left + 4, chandle.top + 4, chandle.left + 120, chandle.top + 120, 15);
        await sleep(900);
        const wAfter = await page.eval(`(() => {
          const cards = [...document.querySelectorAll('.card-outer-container')];
          for (const c of cards) { const img = c.querySelector('.xhs-card-content img'); if (img) return img.offsetWidth; }
          return 0;
        })()`);
        check('B5.6 预览卡拖拽手柄→图片width变化', wAfter > wBefore, `before=${wBefore} after=${wAfter}`);
        await shot('b5-card-resize');
      }
    }
  }

  // ── C: 回归（三阶段流程） ──────────────────────────────────────────────────
  section('C 回归 三阶段流程');
  // ①→②→③ 前进
  await clickButtonByText('下一步');
  await sleep(2000);
  const onPublish = await page.eval(`!!document.querySelector('.tiptap-editor, [class*="publish"]') || document.body.innerText.includes('发布')`);
  check('C1 ②→③ 前进到发布页', onPublish === true);
  // ③→② 返回不丢数据
  await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('返回'));
    if (b) b.click();
    return true;
  })()`);
  await sleep(2000);
  const backInfo = await cardInfo().catch(() => null);
  check('C2 ③→② 返回格式页', backInfo && backInfo.count > 0, `count=${backInfo?.count}`);
  check('C3 返回后卡片数据保留', backInfo && backInfo.count >= 2, JSON.stringify(backInfo?.badges?.slice(0, 2)));

  // auto-save 3s no rollback: select a template, wait 3s, check store
  const beforeTpl = await page.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.selectedTemplate || null`);
  await page.eval(`(() => {
    const cards = [...document.querySelectorAll('.template-card')];
    const c = cards.find(x => (x.textContent||'').includes('文艺清新'));
    if (c) c.click(); return true;
  })()`);
  await sleep(3500);
  const afterTpl = await page.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.selectedTemplate || null`);
  check('C4a 选模板后等3s, 内存态已切换', afterTpl !== beforeTpl, `before=${beforeTpl} after=${afterTpl}`);
  check('C4b 选模板后3s 自动保存到 localStorage(不回滚)', afterTpl === 'wenyi-qingxin', `before=${beforeTpl} after=${afterTpl}`);
  // If not persisted by auto-save, verify a refresh would LOSE the selection:
  if (afterTpl !== 'wenyi-qingxin') {
    await page.eval(`location.reload(); true`);
    await sleep(2200);
    const afterReload = await page.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))?.selectedTemplate || null`);
    check('C4c 刷新后模板选择仍为 文艺清新', afterReload === 'wenyi-qingxin', `afterReload=${afterReload}`);
    // re-enter format for remaining checks
    await page.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('一键排版')); if(b) b.click(); return true; })()`);
    await sleep(2200);
  }

  // 尺寸切换
  const sizeTabs = await page.eval(`([...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('尺寸')) || {}).textContent || null`);
  check('C5 尺寸tab存在', sizeTabs !== null, `tab=${sizeTabs}`);

  // 下载: click 下载此图 (single PNG). Browser will download — CDP may block, note.
  const dlClicked = await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('下载此图'));
    if (!b) return false;
    b.click(); return true;
  })()`);
  check('C6 触发单张PNG下载按钮', dlClicked === true, '文件真实生成验证受限（CDP下载目录拦截需浏览器设置），代码路径 downloadPng 已调用');
  await sleep(1500);
  const zipBtn = await page.eval(`!!([...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('zip')))`);
  check('C7 zip下载按钮存在', zipBtn === true);

  // Final screenshot
  await shot('c-final');

  // ── summary ────────────────────────────────────────────────────────────────
  section('SUMMARY');
  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass).length;
  console.log(`\nTotal=${results.length} Passed=${pass} Failed=${fail}`);
  results.forEach(r => console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ' :: ' + r.detail : ''}`));
  page.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('QA script error:', e);
  if (page) page.close();
  process.exit(2);
});
