/**
 * TipTap JSON → structured page blocks + image natural-size resolution.
 *
 * The editor stores its document as a TipTap/ProseMirror JSON string
 * (`article.content`). This module parses that JSON into the generic
 * `PageBlock[]` shape consumed by the pagination engine, and resolves the
 * natural dimensions of embedded images so their on-page height can be
 * estimated accurately (base64 data URLs decode in the browser).
 */
import type {
  PageBlock,
  RichTextNode,
  TextMark,
} from './pagination';

/* ──────────────────────────────────────────────────────────────────────
 * Mark normalisation
 * ────────────────────────────────────────────────────────────────────── */

/** Map a TipTap mark object to our compact TextMark shape. */
function normalizeMarks(marks?: unknown[]): TextMark[] | undefined {
  if (!Array.isArray(marks) || marks.length === 0) return undefined;
  const out: TextMark[] = [];
  for (const mark of marks) {
    const type = (mark as { type?: string }).type;
    const attrs = (mark as { attrs?: Record<string, unknown> }).attrs;
    switch (type) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike':
        out.push({ type });
        break;
      case 'highlight':
        out.push({ type: 'highlight', attrs: { color: attrs?.color } });
        break;
      case 'link':
        out.push({ type: 'link', attrs: { href: attrs?.href } });
        break;
      case 'textStyle':
        out.push({
          type: 'textStyle',
          attrs: {
            color: attrs?.color,
            fontSize: attrs?.fontSize,
          },
        });
        break;
      default:
        break;
    }
  }
  return out.length ? out : undefined;
}

/** Extract the max explicit font size (px) declared by textStyle marks. */
function effectiveFontSize(node: { content?: unknown[] }): number | undefined {
  let max: number | undefined;
  for (const child of node.content ?? []) {
    const marks = (child as { marks?: unknown[] }).marks;
    if (!Array.isArray(marks)) continue;
    for (const mark of marks) {
      const m = mark as { type?: string; attrs?: { fontSize?: string } };
      if (m.type === 'textStyle' && m.attrs?.fontSize) {
        const px = parseFloat(m.attrs.fontSize);
        if (!Number.isNaN(px)) max = Math.max(max ?? 0, px);
      }
    }
  }
  return max;
}

/** Extract rich text nodes (text + hardBreak) from a TipTap container node. */
function textNodesFrom(node: { content?: unknown[] }): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  for (const child of node.content ?? []) {
    const c = child as { type?: string; text?: string; marks?: unknown[] };
    if (c.type === 'text') {
      if (c.text) nodes.push({ text: c.text, marks: normalizeMarks(c.marks) });
    } else if (c.type === 'hardBreak') {
      const last = nodes[nodes.length - 1];
      if (last) {
        last.text += '\n';
      } else {
        nodes.push({ text: '\n' });
      }
    }
  }
  return nodes;
}

/* ──────────────────────────────────────────────────────────────────────
 * Parsing
 * ────────────────────────────────────────────────────────────────────── */

let idCounter = 0;
const nextId = (attrs?: Record<string, unknown>): string => {
  const fallback = `b${idCounter++}`;
  return typeof attrs?.flowId === 'string' && attrs.flowId
    ? attrs.flowId
    : fallback;
};

/**
 * Parse the TipTap JSON document string into a flat list of page blocks.
 * Unknown/nested containers are flattened by recursion; list items become
 * individual blocks so pagination can break between items.
 *
 * Legacy documents fall back to deterministic b0/b1 ids. Once formatting is
 * entered, those ids are persisted as attrs.flowId; blocks created later keep
 * their own stable id even when earlier content is inserted or removed. This
 * lets card edits and caret bookmarks survive whole-document re-pagination.
 */
export function parseContentToBlocks(contentJson: string): PageBlock[] {
  if (!contentJson) return [];
  idCounter = 0; // deterministic ids per parse run
  let doc: { type?: string; content?: unknown[] };
  try {
    doc = JSON.parse(contentJson) as { type?: string; content?: unknown[] };
  } catch {
    return [];
  }
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return [];

  const blocks: PageBlock[] = [];

  const collect = (node: {
    type?: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
  }): void => {
    switch (node.type) {
      case 'paragraph':
        blocks.push({
          id: nextId(node.attrs),
          type: 'text',
          nodes: textNodesFrom(node),
          fontSize: effectiveFontSize(node),
        });
        break;
      case 'heading': {
        const level =
          (node.attrs?.level as number) === 1 ? 1 : 2;
        blocks.push({
          id: nextId(node.attrs),
          type: 'heading',
          level,
          nodes: textNodesFrom(node),
          fontSize: effectiveFontSize(node),
        });
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const listKind = node.type === 'bulletList' ? 'bullet' : 'ordered';
        (node.content ?? []).forEach((item, idx) => {
          const li = item as { type?: string; content?: unknown[] };
          const itemNodes: RichTextNode[] = [];
          for (const p of li.content ?? []) {
            itemNodes.push(...textNodesFrom(p as { content?: unknown[] }));
          }
          blocks.push({
            id: nextId((li as { attrs?: Record<string, unknown> }).attrs),
            type: 'list',
            listKind,
            index: idx + 1,
            nodes: itemNodes,
            fontSize: effectiveFontSize(node),
          });
        });
        break;
      }
      case 'blockquote':
        blocks.push({
          id: nextId(node.attrs),
          type: 'quote',
          nodes: textNodesFrom(node),
          fontSize: effectiveFontSize(node),
        });
        break;
      case 'image':
        blocks.push({
          id: nextId(node.attrs),
          type: 'image',
          src: (node.attrs?.src as string) ?? '',
          alt: (node.attrs?.alt as string) ?? '',
          // Explicit user-set width (px) from the resizable image extension.
          width:
            typeof node.attrs?.width === 'number' && node.attrs.width > 0
              ? node.attrs.width
              : undefined,
        });
        break;
      case 'horizontalRule':
        blocks.push({ id: nextId(node.attrs), type: 'divider' });
        break;
      default:
        // Recurse into unknown containers (e.g. nested lists, code blocks
        // flatten into their paragraph children).
        (node.content ?? []).forEach((c) => collect(c as never));
    }
  };

  (doc.content ?? []).forEach((c) => collect(c as never));
  return blocks;
}

/* ──────────────────────────────────────────────────────────────────────
 * Image natural-size resolution (browser only, cached)
 * ────────────────────────────────────────────────────────────────────── */

const sizeCache = new Map<string, { width: number; height: number }>();

/** Load the natural size of an image (works with base64 data URLs). */
export function loadImageSize(
  src: string
): Promise<{ width: number; height: number }> {
  const cached = sizeCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = {
        width: img.naturalWidth || img.width || 1,
        height: img.naturalHeight || img.height || 1,
      };
      sizeCache.set(src, size);
      resolve(size);
    };
    img.onerror = () => {
      const size = { width: 1, height: 1 };
      sizeCache.set(src, size);
      resolve(size);
    };
    img.src = src;
  });
}

/**
 * Resolve natural dimensions for every image block so the pagination engine
 * can compute accurate on-page image heights. Results are cached by src.
 */
export async function resolveImageSizes(
  blocks: PageBlock[]
): Promise<PageBlock[]> {
  const jobs = blocks.map(async (block) => {
    if (block.type !== 'image' || !block.src) return block;
    const size = await loadImageSize(block.src);
    return { ...block, naturalWidth: size.width, naturalHeight: size.height };
  });
  return Promise.all(jobs);
}
