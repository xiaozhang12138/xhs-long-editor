/**
 * PNG / ZIP export utilities for the XHS long-article card generator.
 *
 * ── Font fix (P0-1) ────────────────────────────────────────────────────
 * The previous implementation called html-to-image without a prebuilt font
 * CSS. html-to-image then tried to read `document.styleSheets[i].cssRules`
 * to inline the Google Fonts CSS — which is cross-origin, so the read threw
 * `SecurityError` ("Error inlining remote css file"), the remote font was
 * dropped and the PNG fell back to system fonts. Worse, in that path
 * html-to-image attempted to fetch EVERY font subset in the stylesheet,
 * which made exports hang / never finish the zip.
 *
 * Fix: build the `@font-face` CSS ourselves (see utils/fontCss.ts) and pass
 * it via the `fontEmbedCSS` option. html-to-image then uses that string
 * verbatim and never touches `cssRules`, so exports are both fast and
 * correctly typeset. Both single-page and zip downloads go through the same
 * pipeline, so they behave identically.
 *
 * ── Robust zip pipeline ────────────────────────────────────────────────
 * 1. Prepare fonts ("正在准备字体…")
 * 2. Render every page sequentially, each with its own timeout so a stuck
 *    page fails loudly instead of hanging forever.
 * 3. If ANY page fails, throw with the page number — never produce a half
 *    zip silently.
 * 4. Only after all pages succeeded, pack the zip; only after packing, start
 *    the download.
 * 5. Report progress through `onProgress` for the UI progress bar.
 */
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { getFontEmbedCSS } from './fontCss';

export interface RenderOptions {
  /** Output pixel ratio (default 2 → 900×1500 card becomes 1800×3000). */
  scale?: number;
  /** Background color for the exported image (default white). */
  backgroundColor?: string;
}

export type ExportStage = 'fonts' | 'render' | 'pack' | 'done';

export interface ExportProgress {
  stage: ExportStage;
  current: number;
  total: number;
}

export interface ExportOptions extends RenderOptions {
  /**
   * Article text (title + body) used to select the font subsets to inline.
   * When omitted the font stage is skipped and the system font fallback is
   * used (never blocks the download).
   */
  text?: string;
  /** Progress callback for the download button label / progress bar. */
  onProgress?: (progress: ExportProgress) => void;
  /** Per-page render timeout in ms (default 45000). */
  pageTimeoutMs?: number;
}

export interface ExportItem {
  el: HTMLElement;
  name: string;
}

/** Sanitize a string into a safe file name (no path separators). */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || 'note';
}

/** Reject a promise after `ms` with a clear message (prevents infinite hangs). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} 超时（${Math.round(ms / 1000)}s）`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/* ──────────────────────────────────────────────────────────────────────
 * Font embed CSS (memoized per text so repeated exports reuse it)
 * ────────────────────────────────────────────────────────────────────── */

const fontEmbedCssPromises = new Map<string, Promise<string>>();

async function resolveFontEmbedCss(text: string | undefined): Promise<string> {
  if (!text) return '';
  const key = text;
  let promise = fontEmbedCssPromises.get(key);
  if (!promise) {
    promise = getFontEmbedCSS(key);
    // Drop the cached promise on failure so a later retry can succeed.
    fontEmbedCssPromises.set(
      key,
      promise.catch((err) => {
        fontEmbedCssPromises.delete(key);
        throw err;
      })
    );
    promise = fontEmbedCssPromises.get(key) as Promise<string>;
  }
  return promise;
}

/* ──────────────────────────────────────────────────────────────────────
 * Single page render
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Render a single page DOM node into a PNG data URL.
 * The node must be attached to the document (it is part of the preview).
 * `fontEmbedCSS` is passed straight through to html-to-image so the remote
 * `cssRules` path (and its SecurityError) is never triggered.
 */
export async function renderPageToPng(
  el: HTMLElement,
  options: RenderOptions & { fontEmbedCSS?: string } = {}
): Promise<string> {
  const { scale = 2, backgroundColor = '#FFFFFF', fontEmbedCSS } = options;
  const width = Math.max(1, el.offsetWidth);
  const height = Math.max(1, el.offsetHeight);
  return toPng(el, {
    pixelRatio: scale,
    cacheBust: true,
    backgroundColor,
    width,
    height,
    style: { transform: 'none' },
    fontEmbedCSS,
    skipFonts: true,
  });
}

/** Trigger a browser download for a data URL or blob URL. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Render one page and download it as a PNG file.
 * Shares the exact same font-preparation pipeline as the zip download.
 */
export async function downloadPng(
  el: HTMLElement,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  const {
    scale = 2,
    backgroundColor = '#FFFFFF',
    text,
    onProgress,
    pageTimeoutMs = 45000,
  } = options;
  const safeName = filename.endsWith('.png') ? filename : `${filename}.png`;

  onProgress?.({ stage: 'fonts', current: 0, total: 1 });
  const fontEmbedCSS = await resolveFontEmbedCss(text);

  onProgress?.({ stage: 'render', current: 1, total: 1 });
  const dataUrl = await withTimeout(
    renderPageToPng(el, { scale, backgroundColor, fontEmbedCSS }),
    pageTimeoutMs,
    '图片渲染'
  );

  onProgress?.({ stage: 'pack', current: 1, total: 1 });
  downloadUrl(dataUrl, safeName);
  onProgress?.({ stage: 'done', current: 1, total: 1 });
}

/* ──────────────────────────────────────────────────────────────────────
 * Zip download
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Render every page to PNG, pack them into a zip archive and download it.
 *
 * Guarantees:
 * - All pages render first; the zip is only created after every page
 *   succeeded, and the download only starts after the zip finished packing.
 * - A failed page aborts with the page number (visible to the user) instead
 *   of silently shipping a partial zip.
 *
 * @returns the number of packed pages (for the success toast).
 */
export async function downloadAllAsZip(
  items: ExportItem[],
  zipName: string,
  options: ExportOptions = {}
): Promise<{ count: number }> {
  const {
    scale = 2,
    backgroundColor = '#FFFFFF',
    text,
    onProgress,
    pageTimeoutMs = 45000,
  } = options;
  const total = items.length;
  if (!total) {
    throw new Error('没有可导出的页面');
  }

  // Stage 1 — fonts
  onProgress?.({ stage: 'fonts', current: 0, total });
  const fontEmbedCSS = await resolveFontEmbedCss(text);

  // Stage 2 — render every page (sequential, each isolated by try/catch)
  const zip = new JSZip();
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item.el) {
      throw new Error(`第 ${i + 1} 张卡片不可用`);
    }
    onProgress?.({ stage: 'render', current: i + 1, total });
    let dataUrl: string;
    try {
      dataUrl = await withTimeout(
        renderPageToPng(item.el, { scale, backgroundColor, fontEmbedCSS }),
        pageTimeoutMs,
        `第 ${i + 1} 张渲染`
      );
    } catch (err) {
      throw new Error(`第 ${i + 1} 张（${item.name}）生成失败：${(err as Error).message}`);
    }
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) {
      throw new Error(`第 ${i + 1} 张（${item.name}）生成的 PNG 数据为空`);
    }
    zip.file(`${item.name}.png`, base64, { base64: true });
  }

  // Stage 3 — pack (only after ALL pages rendered)
  onProgress?.({ stage: 'pack', current: total, total });
  let blob: Blob;
  try {
    blob = await zip.generateAsync({ type: 'blob' });
  } catch (err) {
    throw new Error(`打包失败：${(err as Error).message}`);
  }

  // Stage 4 — download (only after packing finished)
  const url = URL.createObjectURL(blob);
  const name = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  downloadUrl(url, name);
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  onProgress?.({ stage: 'done', current: total, total });
  return { count: total };
}
