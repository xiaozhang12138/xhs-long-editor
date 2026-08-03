import { findPage, Page, sleep } from './pagecdp.mjs';
import { writeFileSync } from 'node:fs';
const OUT = '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache';

const t = await findPage();
const p = await Page.attach(t.webSocketDebuggerUrl);

const mode = process.argv[2] || 'struct';

if (mode === 'struct') {
  // 完整可视结构 + 布局盒模型
  const r = await p.eval(`(() => {
    const out = [];
    function walk(el, d) {
      if (d > 16) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
      const b = el.getBoundingClientRect();
      if (b.width < 1 && b.height < 1) return;
      const own = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).filter(Boolean).join('|');
      out.push({
        d, tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0,90),
        r: [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)],
        t: own.slice(0,50) || '',
        ph: el.placeholder || el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || '',
        ce: el.getAttribute('contenteditable') || '',
        bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight, col: cs.color,
        fx: cs.display==='flex' ? cs.flexDirection+'/'+cs.justifyContent+'/'+cs.alignItems+'/'+cs.gap : '',
        pad: cs.padding, br: cs.borderRadius, bd: cs.border !== '0px none rgb(0, 0, 0)' ? cs.border : ''
      });
      [...el.children].forEach(c => walk(c, d+1));
    }
    walk(document.body, 0);
    return out;
  })()`);
  writeFileSync(OUT + '/editor-struct.json', JSON.stringify(r, null, 0));
  console.log('nodes:', r.length);
  // 打印精简树
  r.forEach(n => {
    const ind = '  '.repeat(n.d);
    let line = `${ind}${n.tag}${n.cls ? '.'+n.cls.split(' ').slice(0,3).join('.') : ''} [${n.r.join(',')}]`;
    if (n.t) line += ` "${n.t}"`;
    if (n.ph) line += ` ph="${n.ph}"`;
    if (n.ce) line += ` ce=${n.ce}`;
    console.log(line);
  });
} else if (mode === 'colors') {
  const r = await p.eval(`(() => {
    const bgs = {}, cols = {}, fonts = {}, radii = {};
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgs[cs.backgroundColor] = (bgs[cs.backgroundColor]||0)+1;
      cols[cs.color] = (cols[cs.color]||0)+1;
      fonts[cs.fontSize+'/'+cs.fontWeight] = (fonts[cs.fontSize+'/'+cs.fontWeight]||0)+1;
      if(cs.borderRadius!=='0px') radii[cs.borderRadius]=(radii[cs.borderRadius]||0)+1;
    });
    const top = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,18);
    return { bgs: top(bgs), cols: top(cols), fonts: top(fonts), radii: top(radii), fontFamily: getComputedStyle(document.body).fontFamily };
  })()`);
  console.log(JSON.stringify(r, null, 1));
} else if (mode === 'shot') {
  await p.shot(OUT + '/' + (process.argv[3]||'shot') + '.png');
  console.log('saved');
} else if (mode === 'eval') {
  const r = await p.eval(process.argv[3]);
  console.log(JSON.stringify(r, null, 1));
}
p.close();
process.exit(0);
