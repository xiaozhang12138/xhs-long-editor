// 直连 page 级 WebSocket，无需 sessionId，最稳
import { writeFileSync } from 'node:fs';
const PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;

export async function findPage(urlMatch = 'creator.xiaohongshu.com') {
  const list = await fetch(`${BASE}/json/list`).then(r => r.json());
  return list.find(t => t.type === 'page' && t.url.includes(urlMatch));
}

export async function anyPage() {
  const list = await fetch(`${BASE}/json/list`).then(r => r.json());
  return list.find(t => t.type === 'page' && !t.url.startsWith('edge://'));
}

export class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        if (p) { this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
      } else { (this.events.get(m.method) || []).forEach(fn => fn(m.params)); }
    });
  }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, {once:true}); ws.addEventListener('error', rej, {once:true}); });
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
  async goto(url, wait = 6000) {
    await this.send('Page.enable');
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, wait));
  }
  async shot(path, opts = {}) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', ...opts }, 60000);
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  }
  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 50));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async type(text) {
    // 直接 insertText，对 contenteditable 友好（不会触发 IME）
    await this.send('Input.insertText', { text });
  }
  async key(key, modifiers = 0) {
    // 单键，支持 modifiers（如 Ctrl+A = 1）
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, modifiers });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
  }
  async selectAll() {
    // Ctrl+A 全选（modifiers=1 = ctrl）
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', modifiers: 1 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', modifiers: 1 });
  }
  async deleteSel() {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete' });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete' });
  }
  close() { this.ws.close(); }
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
