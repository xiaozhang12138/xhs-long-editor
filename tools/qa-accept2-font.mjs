// 块B 字体验证：动态 import fontCss → 检查 fontEmbedCSS 是否含 base64 woff2 + 网络字体请求
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');
await p.send('Network.enable');

const fontReqs = [];
p.on('Network.requestWillBeSent', (params) => {
  const u = params.request.url || '';
  if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) fontReqs.push(u.slice(0,160));
});

const consoleErrors = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  if (/error|securityerror|inlining|uncaught|失败|超时|字体/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,300)});
});
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push({type:'exception', text: (d.exception?.description || d.text || '').slice(0,300)});
});

await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// 1) 页面内动态 import fontCss，用正文文字生成 fontEmbedCSS
const fontResult = await p.eval(`(async () => {
  const mod = await import('/src/utils/fontCss.ts');
  const text = 'QA验收·长文下载实测标题\\n秋天是一个适合远行的季节，天空高远而澄澈，风里带着干爽的草木气息。沿着山路慢慢向上走，两侧的枫叶已经染上了深浅不一的红色。';
  const css = await mod.getFontEmbedCSS(text);
  const dataUrlCount = (css.match(/data:font\\/woff2;base64/g) || []).length;
  const faceCount = (css.match(/@font-face/g) || []).length;
  const hasNoto = css.includes('Noto Sans SC') || css.includes('Noto Serif SC');
  const hasWenKai = css.includes('LXGW WenKai');
  return {
    cssLength: css.length,
    dataUrlCount,
    faceCount,
    hasNoto,
    hasWenKai,
    sample: css.slice(0, 300),
  };
})()`);
console.log('FONT RESULT:', JSON.stringify(fontResult, null, 2));

// 2) 验证当前页面实际使用的模板字体族
const pageFonts = await p.eval(`(()=>{
  const fams = new Set();
  document.querySelectorAll('.xhs-card, .card-outer-container *').forEach(el=>{
    const f = getComputedStyle(el).fontFamily;
    if (f) fams.add(f);
  });
  return [...fams].slice(0,8);
})()`);
console.log('PAGE FONTS:', JSON.stringify(pageFonts, null, 2));

// 3) 直接尝试读取 Google Fonts cssRules 是否抛 SecurityError（旧 bug 路径）
const cssRulesTest = await p.eval(`(()=>{
  const results = [];
  try {
    for (const sheet of document.styleSheets) {
      try { void sheet.cssRules; results.push({href: sheet.href, ok: true}); }
      catch(e) { results.push({href: sheet.href, ok: false, err: String(e)}); }
    }
  } catch(e) { results.push({err: String(e)}); }
  return results;
})()`);
console.log('CSSRULES TEST:', JSON.stringify(cssRulesTest, null, 2));

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/font-verify.json', JSON.stringify({fontResult, pageFonts, cssRulesTest, fontReqs, consoleErrors}, null, 2));
p.close();
process.exit(0);
