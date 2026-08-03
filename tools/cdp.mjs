// 轻量 CDP 客户端：直连本地 Edge 调试端口，无外部依赖（Node 22 原生 WebSocket）
const PORT = process.env.CDP_PORT || 9333;
const BASE = `http://127.0.0.1:${PORT}`;

export class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        }
      } else {
        const arr = this.listeners.get(msg.method) || [];
        arr.forEach((fn) => fn(msg.params));
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 60000);
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  close() { this.ws.close(); }
}

export async function browserWs() {
  const r = await fetch(`${BASE}/json/version`);
  return (await r.json()).webSocketDebuggerUrl;
}

export async function listTargets() {
  const r = await fetch(`${BASE}/json/list`);
  return await r.json();
}

// 打开（或复用）一个页面并返回 { cdp, sessionId, targetId }
export async function openPage(url, { reuse = true } = {}) {
  const cdp = await CDP.connect(await browserWs());
  let targetId;
  if (reuse) {
    const targets = (await cdp.send('Target.getTargets')).targetInfos
      .filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
    const hit = targets.find((t) => t.url !== 'about:blank');
    if (hit) targetId = hit.targetId;
    else if (targets.length) targetId = targets[0].targetId;
  }
  if (!targetId) targetId = (await cdp.send('Target.createTarget', { url: 'about:blank' })).targetId;

  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  if (url) {
    await cdp.send('Page.navigate', { url }, sessionId);
    await waitLoad(cdp, sessionId);
  }
  return { cdp, sessionId, targetId };
}

export function waitLoad(cdp, sessionId, timeout = 30000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    cdp.on('Page.loadEventFired', finish);
    setTimeout(finish, timeout);
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function evaluate(cdp, sessionId, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId);
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}

export async function screenshot(cdp, sessionId, path, { fullPage = false } = {}) {
  const fs = await import('node:fs/promises');
  const params = { format: 'png', captureBeyondViewport: fullPage };
  const { data } = await cdp.send('Page.captureScreenshot', params, sessionId);
  await fs.writeFile(path, Buffer.from(data, 'base64'));
  return path;
}
