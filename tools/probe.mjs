import { openPage, evaluate, screenshot, sleep } from './cdp.mjs';

const URL_TARGET = 'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article';

const { cdp, sessionId } = await openPage(null);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
}, sessionId);
await cdp.send('Page.navigate', { url: URL_TARGET }, sessionId);
await sleep(9000);

const info = await evaluate(cdp, sessionId, `(() => ({
  url: location.href,
  title: document.title,
  bodyLen: document.body ? document.body.innerHTML.length : 0,
  text: document.body ? document.body.innerText.slice(0, 1500) : ''
}))()`);
console.log(JSON.stringify(info, null, 2));

await screenshot(cdp, sessionId, '/Users/zachary/WorkBuddy/2026-08-03-00-40-20/.cache/probe.png');
console.log('screenshot saved');
cdp.close();
process.exit(0);
