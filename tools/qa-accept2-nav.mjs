// 块B 改版：先 goto → 等 5s → 清 localStorage → reload → 等 5s → 填内容 → 排版
import { Page, sleep } from '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/tools/pagecdp.mjs';
import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json());
const t = list.find(t=>t.type==='page' && !t.url.startsWith('edge://'));
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Page.enable');
await p.send('Runtime.enable');

// 捕获 console
const consoleErrors = [];
const consoleAll = [];
p.on('Runtime.consoleAPICalled', (params) => {
  const txt = (params.args||[]).map(a=>a.value ?? a.description ?? '').join(' ');
  consoleAll.push({type: params.type, text: txt.slice(0,400)});
  if (/error|securityerror|inlining|uncaught/i.test(txt)) consoleErrors.push({type: params.type, text: txt.slice(0,400)});
});
p.on('Runtime.exceptionThrown', (params) => {
  const d = params.exceptionDetails;
  consoleErrors.push({type:'exception', text: (d.exception?.description || d.text || '').slice(0,400)});
});

// goto + 清空 + reload + 长等
await p.goto('http://localhost:3000', 5000);
await sleep(2000);
await p.eval(`localStorage.clear(); true`);
await p.eval(`location.reload(); true`);
await sleep(5000); // 等字体+react 全部初始化

// 健壮 dump with retry
async function dump(label) {
  for (let i=0; i<5; i++) {
    const r = await p.eval(`(()=>{
      const btns=[...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(t=>t);
      const hasTitleInput = !!document.querySelector('.title-input, input[placeholder*="标题"]');
      const hasProse = !!document.querySelector('.prose-editor, .tiptap-editor [contenteditable]');
      const hasFormatBtn = !!btns.find(t=>t==='一键排版');
      return {btns: btns.slice(0,15), hasTitleInput, hasProse, hasFormatBtn};
    })()`);
    if (r.hasFormatBtn && r.hasProse) { console.log(label, JSON.stringify(r)); return r; }
    await sleep(800);
  }
  console.log(label, 'TIMEOUT');
  return null;
}

const init = await dump('INIT:');
if (!init) { p.close(); process.exit(1); }

// 找 TitleInput
const titleRes = await p.eval(`(()=>{
  const el = document.querySelector('.title-input') || document.querySelector('input[placeholder*="标题"]') || document.querySelector('input');
  if(!el) return {ok:false};
  el.focus();
  const r = el.getBoundingClientRect();
  return {ok:true, tag: el.tagName, cls: (el.className||'').toString().slice(0,60), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)};
})()`);
console.log('TITLE EL:', JSON.stringify(titleRes));
if (titleRes.ok) {
  await p.mouseClick(titleRes.x, titleRes.y);
  await sleep(300);
  await p.type('QA验收·长文下载实测标题');
  await sleep(300);
}

// 找 .prose-editor
const bodyRes = await p.eval(`(()=>{
  const el = document.querySelector('.prose-editor');
  if(!el) return {ok:false};
  const r = el.getBoundingClientRect();
  el.focus();
  return {ok:true, x: Math.round(r.x+Math.min(200, r.width/2)), y: Math.round(r.y+Math.min(120, r.height/2)), w: r.width, h: r.height};
})()`);
console.log('BODY EL:', JSON.stringify(bodyRes));
if (bodyRes.ok) {
  await p.mouseClick(bodyRes.x, bodyRes.y);
  await sleep(400);
  const sentences = [
    '秋天是一个适合远行的季节，天空高远而澄澈，风里带着干爽的草木气息。',
    '沿着山路慢慢向上走，两侧的枫叶已经染上了深浅不一的红色，像一幅被时间晕染过的画。',
    '我习惯在出发前把路线仔细规划一遍，查好天气，准备好水和干粮，也留出足够的时间用来迷路。',
    '旅行最迷人的部分往往不是到达目的地，而是那些计划之外的瞬间：一只松鼠忽然从树梢跃过，一场细雨把山色洗得更加清透。',
    '傍晚的时候，我在山脚的小镇里找到一家临街的茶馆，老板是个健谈的中年人，一边煮茶一边讲起这座山的故事。',
    '他说这里以前是商队必经的驿站，人来人往，马蹄声和吆喝声从早响到晚。',
    '如今公路修通了，小镇安静下来，只剩下偶尔路过的旅人，像我们一样，为了一杯热茶停下来。',
    '我记下这些片段，用手机拍了几张照片，也把它们写进日记里。',
    '写字的习惯是从大学时候养成的，那时候喜欢在图书馆的角落待到闭馆，把读到的句子抄在本子上。',
    '后来工作忙碌，抄写变成了敲键盘，但那份安静的心情一直没有变。',
    '我想，所谓记录生活，并不是要把每一天都过得轰轰烈烈，而是愿意在平凡的时刻停下脚步，看一看身边的风景。',
    '清晨的露水，午后的阳光，夜晚的灯火，都值得被认真对待。',
    '这趟旅程走了三天，回程的车上我翻看相册，发现拍得最多的并不是风景，而是那些被我忽略的细节。',
    '一只猫蹲在墙角打盹，晾衣绳上挂着的白衬衫随风摆动，旧书店门口的木牌上写着「今日有风」。',
    '这些画面让我想起小时候的夏天，外婆坐在院子里摇着蒲扇，一边赶蚊子一边给我讲她年轻时的故事。',
    '时间过得很快，有些记忆却像河底的石头，水流走了，它们还静静地留在那里。',
    '我把这趟旅行的照片整理成一本小册子，在封面写上日期和地点，也算是对这段时光的一个交代。',
    '朋友问我为什么这么喜欢记录，我想了很久，回答说：因为日子会过去，而文字和照片能留住一部分真实。',
    '哪怕只是一小部分，也足够在多年以后，让我们重新想起那些被风吹过的下午。',
  ];
  let text = '';
  while (text.length < 1700) {
    for (const s of sentences) {
      text += s + '\n';
      if (text.length >= 1750) break;
    }
  }
  await p.type(text);
  await sleep(800);
  console.log('TYPED length:', text.length);
}

// 点一键排版
const fmtBtn = await p.eval(`(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='一键排版');
  if(!b) return null;
  const r=b.getBoundingClientRect();
  return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};
})()`);
console.log('FMT BTN:', JSON.stringify(fmtBtn));
if (fmtBtn) {
  await p.mouseClick(fmtBtn.x, fmtBtn.y);
  await sleep(5000);
}

const fmt = await p.eval(`(()=>{
  const cards = [...document.querySelectorAll('.card-outer-container')].map(c=>{
    const r=c.getBoundingClientRect();
    const inner = c.querySelector('.xhs-card');
    const ir = inner?.getBoundingClientRect();
    return {w:Math.round(r.width), h:Math.round(r.height), innerScale: inner ? Math.round(ir.width/ir.width*1000)/1000 : null};
  });
  const btns=[...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(t=>t);
  const info = document.body.innerText.match(/共\s*(\d+)\s*张[（(]封面\s*([+]?)\s*(\d+)\s*页正文[）)]?/);
  const info2 = document.body.innerText.match(/(\d+)\s*×\s*(\d+)\s*px/);
  return {cardsCount: cards.length, cards: cards.slice(0,3), btns: btns.slice(0,12), pageInfo: info?info[0]:null, sizeInfo: info2?info2[0]:null};
})()`);
console.log('FORMAT:', JSON.stringify(fmt));

await p.shot('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/02-after-format.png');

writeFileSync('/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/zip-accept/console-nav.json', JSON.stringify({errors: consoleErrors, all: consoleAll.slice(0,30)}, null, 2));
console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
p.close();
process.exit(0);
