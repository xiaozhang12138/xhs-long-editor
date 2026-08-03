import { openPage, evaluate, sleep } from './cdp.mjs';
const { cdp, sessionId } = await openPage('http://localhost:3000/');
await sleep(4000);
const info = await evaluate(cdp, sessionId, `(() => ({
  rootLen: document.getElementById('root')?.innerHTML.length,
  bodyText: document.body.innerText.slice(0, 300),
}))()`);
console.log(JSON.stringify(info, null, 2));
cdp.close(); process.exit(0);
