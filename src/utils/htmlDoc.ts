/**
 * HTML ↔ TipTap JSON conversion helpers.
 *
 * The format page's click-to-edit feature lets users type directly inside the
 * paginated cards (contentEditable). When they do, we need to write those DOM
 * changes back into the article's TipTap JSON document (`article.content`),
 * then re-paginate so every other card stays in sync.
 *
 * This module provides:
 *  - parseHtmlToDoc    : HTML fragment → TipTap doc JSON (block level)
 *  - parseInlineHtml   : HTML fragment → inline TipTap content (text + marks)
 *  - docToHtml         : TipTap doc JSON → HTML string (contentHtml sync)
 *
 * Both directions are pure and DOM-free (DOMParser works in jsdom + browser).
 */
import type { PageBlock, RichTextNode } from './pagination';

/* ──────────────────────────────────────────────────────────────────────
 * Types (subset of the TipTap/ProseMirror JSON schema we use)
 * ────────────────────────────────────────────────────────────────────── */

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  /** Present on text nodes only. */
  text?: string;
  /** Present on text nodes only (bold / italic / …). */
  marks?: TipTapMark[];
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

/* ──────────────────────────────────────────────────────────────────────
 * Mark helpers
 * ────────────────────────────────────────────────────────────────────── */

/** Map an inline element's own tag/style to TipTap marks. */
function marksForElement(el: HTMLElement): TipTapMark[] {
  const tag = el.tagName.toLowerCase();
  const marks: TipTapMark[] = [];
  if (tag === 'strong' || tag === 'b') marks.push({ type: 'bold' });
  if (tag === 'em' || tag === 'i') marks.push({ type: 'italic' });
  if (tag === 'u') marks.push({ type: 'underline' });
  if (tag === 's' || tag === 'strike') marks.push({ type: 'strike' });
  if (tag === 'mark') {
    const bg = el.style.backgroundColor;
    marks.push({ type: 'highlight', attrs: { color: bg || '#FEF3C7' } });
  }
  if (tag === 'span') {
    const style = el.style;
    if (style.backgroundColor) {
      marks.push({ type: 'highlight', attrs: { color: style.backgroundColor } });
    }
    const tsa: Record<string, unknown> = {};
    if (style.color) tsa.color = style.color;
    if (style.fontSize) tsa.fontSize = style.fontSize;
    if (Object.keys(tsa).length) marks.push({ type: 'textStyle', attrs: tsa });
  }
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    if (href) marks.push({ type: 'link', attrs: { href } });
  }
  return marks;
}

/** Apply marks to a list of inner inline nodes. */
function applyMarks(inner: TipTapNode[], marks: TipTapMark[]): TipTapNode[] {
  if (!marks.length) return inner;
  return inner.map((n) =>
    n.type === 'text' ? { ...n, marks: [...(n.marks ?? []), ...marks] } : n
  );
}

/** Parse an inline element INCLUDING its own tag marks. */
function parseInlineElement(el: HTMLElement): TipTapNode[] {
  return applyMarks(parseInline(el), marksForElement(el));
}

/* ──────────────────────────────────────────────────────────────────────
 * Inline parsing (text + marks + hardBreak)
 * ────────────────────────────────────────────────────────────────────── */

/** Parse an HTML fragment into inline TipTap content (text nodes + marks). */
export function parseInlineHtml(html: string): TipTapNode[] {
  const doc = new DOMParser().parseFromString(
    `<p id="__xhs_inline">${html}</p>`,
    'text/html'
  );
  const p = doc.getElementById('__xhs_inline');
  if (!p) return [];
  return parseInline(p);
}

/** Walk a container's child nodes and produce text/mark/hardBreak nodes. */
function parseInline(el: Node): TipTapNode[] {
  const out: TipTapNode[] = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const text = node.textContent ?? '';
      if (text) out.push({ type: 'text', text });
      return;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return;
    const elNode = node as HTMLElement;
    const tag = elNode.tagName.toLowerCase();

    if (tag === 'br') {
      out.push({ type: 'hardBreak' });
      return;
    }
    if (tag === 'img') {
      // Inline image: keep it as an image node so it is not silently lost.
      out.push(imgNode(elNode));
      return;
    }

    out.push(...parseInlineElement(elNode));
  });
  return out;
}

/** Build an image node from an <img> element (reads width/height style+attr). */
function imgNode(el: HTMLElement): TipTapNode {
  const attrs: Record<string, unknown> = {
    src: el.getAttribute('src') ?? '',
    alt: el.getAttribute('alt') ?? '',
  };
  const w = parseFloat(el.style.width || el.getAttribute('width') || '');
  if (Number.isFinite(w) && w > 0) attrs.width = Math.round(w);
  const h = parseFloat(el.style.height || el.getAttribute('height') || '');
  if (Number.isFinite(h) && h > 0) attrs.height = Math.round(h);
  return { type: 'image', attrs };
}

/* ──────────────────────────────────────────────────────────────────────
 * Block-level parsing
 * ────────────────────────────────────────────────────────────────────── */

/** Parse an HTML fragment into a full TipTap doc (block level). */
export function parseHtmlToDoc(html: string): TipTapDoc {
  const doc = new DOMParser().parseFromString(
    `<div id="__xhs_root">${html}</div>`,
    'text/html'
  );
  const root = doc.getElementById('__xhs_root');
  return { type: 'doc', content: root ? parseBlocks(root) : [] };
}

/** Inline tags that can appear directly at block level. */
const INLINE_TAGS = new Set([
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'mark',
  'span',
  'a',
  'br',
]);

/** Map a block-level element tree to TipTap block nodes. */
function parseBlocks(el: HTMLElement): TipTapNode[] {
  const out: TipTapNode[] = [];
  const children = Array.from(el.childNodes).filter(
    (n) => !(n.nodeType === 3 && !(n.textContent ?? '').trim())
  );

  for (const node of children) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const text = (node.textContent ?? '').trim();
      if (text) {
        out.push({ type: 'paragraph', content: [{ type: 'text', text }] });
      }
      continue;
    }
    if (node.nodeType !== 1) continue;
    const elNode = node as HTMLElement;
    const tag = elNode.tagName.toLowerCase();

    if (tag === 'img') {
      out.push(imgNode(elNode));
      continue;
    }
    if (tag === 'hr') {
      out.push({ type: 'horizontalRule' });
      continue;
    }
    // Inline fragment at block level (e.g. <strong>xxx</strong> from a card
    // edit) → wrap it in a paragraph, preserving marks.
    if (INLINE_TAGS.has(tag)) {
      out.push({
        type: 'paragraph',
        content: parseInlineElement(elNode).length
          ? parseInlineElement(elNode)
          : [{ type: 'text', text: '' }],
      });
      continue;
    }
    if (tag === 'p' || tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const level = tag === 'p' ? undefined : parseInt(tag[1], 10);
      const inline = parseInline(elNode);
      if (level !== undefined) {
        out.push({
          type: 'heading',
          attrs: { level: Math.min(2, level) },
          content: inline.length ? inline : [{ type: 'text', text: '' }],
        });
      } else {
        out.push({
          type: 'paragraph',
          content: inline.length ? inline : [{ type: 'text', text: '' }],
        });
      }
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      const listItems = Array.from(elNode.children)
        .filter((c) => c.tagName.toLowerCase() === 'li')
        .map((li) => parseListItem(li as HTMLElement));
      out.push({
        type: tag === 'ul' ? 'bulletList' : 'orderedList',
        content: listItems,
      });
      continue;
    }
    if (tag === 'li') {
      out.push({
        type: 'bulletList',
        content: [parseListItem(elNode)],
      });
      continue;
    }
    if (tag === 'blockquote') {
      const inline = parseInline(elNode);
      out.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: inline.length ? inline : [{ type: 'text', text: '' }],
          },
        ],
      });
      continue;
    }

    // Generic container (e.g. the centering <div> around an image): recurse.
    // A subtree holding a single image is hoisted to a plain image block.
    const sub = parseBlocks(elNode);
    if (sub.length === 1 && sub[0].type === 'image') {
      out.push(sub[0]);
      continue;
    }
    out.push(...sub);
  }
  return out;
}

/** Parse an <li> element into a TipTap listItem node. */
function parseListItem(li: HTMLElement): TipTapNode {
  const blockTags = ['p', 'h1', 'h2', 'h3'];
  const paragraphEls = Array.from(li.children).filter((c) =>
    blockTags.includes(c.tagName.toLowerCase())
  );
  if (paragraphEls.length) {
    const content = paragraphEls.map((p) => {
      const el = p as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const level = tag === 'p' ? undefined : parseInt(tag[1], 10);
      const inline = parseInline(el);
      return level !== undefined
        ? { type: 'heading' as const, attrs: { level: Math.min(2, level) }, content: inline }
        : { type: 'paragraph' as const, content: inline };
    });
    return { type: 'listItem', content };
  }
  return {
    type: 'listItem',
    content: [{ type: 'paragraph', content: parseInline(li) }],
  };
}

/* ──────────────────────────────────────────────────────────────────────
 * Serialization (doc JSON → HTML)
 * ────────────────────────────────────────────────────────────────────── */

/** Serialize a TipTap doc JSON back to an HTML string. */
export function docToHtml(doc: TipTapDoc): string {
  return (doc.content ?? []).map((n) => nodeToHtml(n)).join('');
}

/** Serialize a single block node to HTML. */
function nodeToHtml(node: TipTapNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${inlineToHtml(node.content)}</p>`;
    case 'heading': {
      const level = Math.min(2, Math.max(1, Number(node.attrs?.level) || 2));
      return `<h${level}>${inlineToHtml(node.content)}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${listItemsToHtml(node.content)}</ul>`;
    case 'orderedList':
      return `<ol>${listItemsToHtml(node.content)}</ol>`;
    case 'blockquote':
      return `<blockquote>${(node.content ?? [])
        .map((n) => (n.type === 'paragraph' ? nodeToHtml(n) : inlineToHtml([n])))
        .join('')}</blockquote>`;
    case 'image':
      return imageToHtml(node.attrs);
    case 'horizontalRule':
      return '<hr />';
    default:
      return inlineToHtml(node.content);
  }
}

/** Serialize listItem nodes inside a list container. */
function listItemsToHtml(content: TipTapNode[] | undefined): string {
  return (content ?? [])
    .map((li) => {
      const inner = (li.content ?? [])
        .map((n) => (n.type === 'paragraph' ? nodeToHtml(n) : inlineToHtml([n])))
        .join('');
      return `<li>${inner}</li>`;
    })
    .join('');
}

/** Serialize an image node. */
function imageToHtml(attrs?: Record<string, unknown>): string {
  const a = attrs ?? {};
  const parts = [`src="${escapeHtml(String(a.src ?? ''))}"`];
  if (a.alt) parts.push(`alt="${escapeHtml(String(a.alt))}"`);
  if (a.width) parts.push(`width="${escapeHtml(String(a.width))}"`);
  if (a.height) parts.push(`height="${escapeHtml(String(a.height))}"`);
  return `<img ${parts.join(' ')} />`;
}

/** Serialize inline content (text + marks + hardBreak). */
function inlineToHtml(content: TipTapNode[] | undefined): string {
  return (content ?? []).map((n) => inlineNodeToHtml(n)).join('');
}

/** Serialize a single inline node, applying marks as nested tags. */
function inlineNodeToHtml(node: TipTapNode): string {
  if (node.type === 'hardBreak') return '<br />';
  if (node.type === 'image') return imageToHtml(node.attrs);
  const text = escapeHtml(node.text ?? '');
  let html = text;
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'highlight': {
        const color = String(mark.attrs?.color ?? '#FEF3C7');
        html = `<mark style="background-color:${escapeHtml(color)}">${html}</mark>`;
        break;
      }
      case 'link': {
        const href = escapeHtml(String(mark.attrs?.href ?? ''));
        html = `<a href="${href}">${html}</a>`;
        break;
      }
      case 'textStyle': {
        const styles: string[] = [];
        if (mark.attrs?.color) styles.push(`color:${escapeHtml(String(mark.attrs.color))}`);
        if (mark.attrs?.fontSize) styles.push(`font-size:${escapeHtml(String(mark.attrs.fontSize))}`);
        html = styles.length ? `<span style="${styles.join(';')}">${html}</span>` : html;
        break;
      }
      default:
        break;
    }
  }
  return html;
}

/** Escape HTML special characters. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convenience: plain text of a page block (for merge-back part texts). */
export function blockText(block: PageBlock): string {
  return (block as { nodes?: RichTextNode[] }).nodes
    ? (block as { nodes: RichTextNode[] }).nodes.map((n) => n.text).join('')
    : '';
}
