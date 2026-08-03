/**
 * Clipboard helpers for the "复制全文" button (P1-4).
 *
 * - extractPlainText       : article HTML → readable plain text (blocks
 *                            become newlines, tags stripped, entities decoded)
 * - formatArticlePlainText : title + body plain text (what gets copied)
 * - copyTextToClipboard    : navigator.clipboard.writeText with an
 *                            execCommand('copy') fallback for non-secure
 *                            contexts / older browsers.
 */
import type { ArticleData } from '../types';

/** Decode the HTML entities that can appear in TipTap content. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * Convert article HTML (from the TipTap editor) into readable plain text.
 * Block-level elements and <br> become line breaks; everything else is
 * stripped; entities are decoded; 3+ consecutive newlines collapse to 2.
 */
export function extractPlainText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html ?? '';
  // Newline after block containers.
  container
    .querySelectorAll('p, h1, h2, h3, li, blockquote, div, hr, figure, pre')
    .forEach((el) => el.insertAdjacentText('afterend', '\n'));
  // Newline after hard breaks.
  container.querySelectorAll('br').forEach((el) => el.insertAdjacentText('afterend', '\n'));
  const text = container.textContent ?? '';
  return decodeHtmlEntities(text)
    .replace(/\u00A0/g, ' ') // &nbsp; parses to the literal NBSP char
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Title + body plain text for the "复制全文" button. */
export function formatArticlePlainText(article: Pick<ArticleData, 'title' | 'contentHtml'>): string {
  const title = article.title?.trim() || '未命名长文';
  const body = extractPlainText(article.contentHtml ?? '');
  return body ? `${title}\n\n${body}` : title;
}

/**
 * Copy `text` to the clipboard.
 * Prefers the modern async API; falls back to a hidden textarea +
 * `document.execCommand('copy')` when unavailable (non-secure context,
 * jsdom, older browsers).
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to the execCommand fallback
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  // execCommand is deprecated but still the only fallback in some contexts;
  // it may not exist at all in jsdom / newer headless environments.
  const exec = (document as { execCommand?: (cmd: string) => boolean }).execCommand;
  if (typeof exec === 'function') {
    try {
      ok = exec('copy');
    } catch {
      ok = false;
    }
  }
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error('复制失败：浏览器不允许自动复制');
  }
}
