import { findPage, Page, sleep } from './pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';
const TARGET = 'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article';

const t = await findPage();
const p = await Page.attach(t.webSocketDebuggerUrl);

// 采集函数：完整 DOM 树 + 计算样式
const DUMP = `(() => {
  function walk(el, depth = 0, maxDepth = 14) {
    if (!el || depth > maxDepth) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0 && el.children.length === 0) return null;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
    const node = {
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === 'string') ? el.className : '',
      id: el.id || undefined,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      text: own || undefined,
      ph: el.placeholder || el.getAttribute('data-placeholder') || undefined,
      ce: el.getAttribute('contenteditable') || undefined,
      style: {
        display: cs.display, flexDirection: cs.flexDirection, justifyContent: cs.justifyContent,
        alignItems: cs.alignItems, gap: cs.gap, position: cs.position,
        bg: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        padding: cs.padding, margin: cs.margin, border: cs.border, borderRadius: cs.borderRadius,
        width: cs.width, height: cs.height, boxShadow: cs.boxShadow, overflow: cs.overflow, lineHeight: cs.lineHeight
      },
      children: [...el.children].map(c => walk(c, depth + 1, maxDepth)).filter(Boolean)
    };
    return node;
  }
  return walk(document.body);
})()`;

async function capture(name, note) {
  await sleep(1500);
  await p.shot(OUT + '/' + name + '.png');
  const tree = await p.eval(DUMP);
  writeFileSync(OUT + '/' + name + '.json', JSON.stringify(tree, null, 1));
  const text = await p.eval('document.body.innerText');
  writeFileSync(OUT + '/' + name + '.txt', text);
  console.log('\n[' + name + '] ' + note);
  console.log('--- innerText ---');
  console.log(text.slice(0, 2000));
}

const step = process.argv[2];

if (step === 'a') {
  await p.goto(TARGET, 9000);
  await capture('L1-hub', '长文中心页（新的创作入口）');
} else if (step === 'b') {
  const r = await p.eval(`(() => {
    const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && e.textContent.trim()==='新的创作');
    const el = els[0] || [...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='新的创作');
    if(!el) return 'notfound';
    el.click(); return 'clicked:'+el.tagName+'.'+el.className;
  })()`);
  console.log('click result:', r);
  await sleep(7000);
  await capture('L2-editor', '点击新的创作后的编辑器');
} else if (step === 'c') {
  await capture('L3-current', '当前状态');
}
p.close();
process.exit(0);
