import { findPage, Page, sleep } from './pagecdp.mjs';
const t = await findPage();
const p = await Page.attach(t.webSocketDebuggerUrl);
await p.send('Runtime.enable');
async function mv(x,y){await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});}
const xs = [724,764,813,853,893,933,973,1013,1062,1102,1151];
for (let i=0;i<xs.length;i++){
  await mv(400,600); await sleep(300);
  await mv(xs[i]+16, 93); await sleep(1100);
  const tip = await p.eval(`document.querySelector('.menu-tooltip')?.innerText || document.querySelector('[class*="tooltip"]')?.innerText || ''`);
  const dis = await p.eval(`[...document.querySelectorAll('.menu-items-container > button')][${i}]?.className.includes('disabled')`);
  console.log(`btn[${i}] @${xs[i]}  tip="${tip}"  disabled=${dis}`);
}
p.close(); process.exit(0);
