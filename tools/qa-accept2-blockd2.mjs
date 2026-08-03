// 块D2 复制全文 + 发布精简
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');

const consoleErrors = [];
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push((d.exception?.description || d.text || '').slice(0,200));
});

// 授权剪贴板读写
try { await p.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }); } catch(e) { console.log('grant perms:', e.message); }

await p.goto('http://localhost:3000', 3500);
await sleep(2500);

// ── 复制全文：在编辑器阶段（当前应已恢复草稿A）──
// 先确认标题/正文存在
const editorState = await p.eval(`(()=>{
  const title = document.querySelector('input[placeholder*="标题"]')?.value || '';
  const body = document.querySelector('.prose-editor')?.innerText || '';
  return {title, body, bodyLen: body.length};
})()`);
console.log('EDITOR STATE:', JSON.stringify(editorState));

// 点击「复制全文」
const copyBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='复制全文');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
console.log('COPY BTN:', JSON.stringify(copyBtn));
if (copyBtn) {
  await p.mouseClick(copyBtn.x, copyBtn.y);
  await sleep(1200);
}
// 读剪贴板
let clip = null;
try {
  clip = await p.eval(`navigator.clipboard.readText()`);
} catch(e) {
  console.log('clipboard read error:', e.message?.slice(0,150));
}
console.log('CLIPBOARD:', JSON.stringify(clip));
// 断言：剪贴板 = 标题 + 正文纯文本，无 HTML 标签
const clipNoHtml = clip ? !/<[^>]+>/.test(clip) : false;
const clipHasTitle = clip ? clip.startsWith(editorState.title.trim()) : false;
const clipHasBody = clip ? clip.includes('草稿A的正文') : false;
console.log('CLIP ASSERT:', JSON.stringify({clipNoHtml, clipHasTitle, clipHasBody}));

// ── 进排版页 → 下一步 → 发布页 ──
const fmtBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
if (fmtBtn) { await p.mouseClick(fmtBtn.x, fmtBtn.y); await sleep(4000); }

const nextBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='下一步');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
console.log('NEXT BTN:', JSON.stringify(nextBtn));
if (nextBtn) { await p.mouseClick(nextBtn.x, nextBtn.y); await sleep(3500); }

// ── 发布精简断言 ──
const publishState = await p.eval(`(()=>{
  const text = document.body.innerText;
  const forbidden = ['合集','引用','原创','地点','群聊','Red Skill','带货'].map(k=>{
    // 注意：Red Skill 在侧边栏 sidebar 是合法 UI，这里检查主区 main
    return {k, found: text.includes(k)};
  });
  const main = document.querySelector('main')?.innerText || '';
  const mainForbidden = ['合集','引用','原创','地点','群聊','带货'].filter(k=>main.includes(k));
  const btns = [...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean);
  const asides = [...document.querySelectorAll('aside')];
  const aside = asides[asides.length-1];
  const asideW = aside?.getBoundingClientRect().width || null;
  const mainW = document.querySelector('main')?.getBoundingClientRect().width || null;
  return {mainForbidden, hasPublish: btns.includes('发布'), hasDraftLeave: btns.includes('暂存离开'), asideW, mainW, sidebarHasRedSkill: text.includes('Red Skill')};
})()`);
console.log('PUBLISH STATE:', JSON.stringify(publishState, null, 2));

// 手机预览可折叠：点收起按钮 → 主区变宽
const beforeW = publishState.mainW;
await p.eval(`(()=>{
  const btn=[...document.querySelectorAll('button')].find(b=>/收起手机预览|手机预览/.test(b.title||'') || (b.innerText.includes('手机预览') && b.innerText.includes('收起')));
  if(btn) btn.click();
  return !!btn;
})()`).then(r=>console.log('COLLAPSE CLICK:', r));
await sleep(1200);
const afterCollapse = await p.eval(`(()=>{
  const aside = document.querySelector('aside:last-of-type');
  const mainW = document.querySelector('main')?.getBoundingClientRect().width || null;
  const asideW = aside?.getBoundingClientRect().width || null;
  const text = document.body.innerText;
  return {asideW, mainW, mobilePreviewStillThere: text.includes('手机预览')};
})()`);
console.log('AFTER COLLAPSE:', JSON.stringify(afterCollapse));
await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/d2-publish.png');

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/blockD2-result.json', JSON.stringify({editorState, clip, clipNoHtml, clipHasTitle, clipHasBody, publishState, afterCollapse, consoleErrors}, null, 2));
p.close();
process.exit(0);
