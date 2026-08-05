/**
 * Click-to-edit merge-back engine.
 *
 * The format page renders the article as paginated cards. Each rendered block
 * carries a stable `data-block-id` (b0, b1, … in document order; split blocks
 * become b5-p0 / b5-p1 …). When the user edits a card's contentEditable DOM,
 * PageCardStream collects the edited `[data-block-id]` elements and calls
 * `applyBlockEdits` here to:
 *
 *   1. parse article.content (TipTap JSON) and build a blockId → source node
 *      registry (matching blockParser's traversal order);
 *   2. replace the source node's content with the parsed edited HTML
 *      (preserving marks via htmlDoc.parseInlineHtml);
 *   3. for blocks split across pages (long paragraphs), rebuild the source
 *      node from all parts — edited parts use the new HTML, untouched parts
 *      keep their current paginated text;
 *   4. return the new JSON string + synced HTML string.
 */
import type { PageResult } from './pagination';
import type { TipTapDoc, TipTapNode } from './htmlDoc';
import { parseHtmlToDoc, parseInlineHtml, docToHtml, blockText } from './htmlDoc';

/** One edited block element collected from the active card's DOM. */
export interface BlockEdit {
  /** data-block-id, e.g. "b7" or "b5-p1". */
  id: string;
  /** innerHTML of the edited block element. */
  html: string;
}

export interface MergeBackResult {
  json: string;
  html: string;
}

/** Where a block lives inside the source TipTap doc. */
interface BlockSourceRef {
  path: number[];
  kind: 'paragraph' | 'heading' | 'blockquote' | 'listItem' | 'image' | 'divider';
  level?: 1 | 2;
}

/**
 * Walk the TipTap doc exactly like blockParser.parseContentToBlocks so the
 * registry keys (b0, b1, …) line up with the rendered data-block-ids.
 */
export function buildBlockRegistry(doc: TipTapDoc): Map<string, BlockSourceRef> {
  const map = new Map<string, BlockSourceRef>();
  let id = 0;

  const walk = (node: TipTapNode, path: number[]): void => {
    switch (node.type) {
      case 'paragraph':
        map.set(`b${id++}`, { path, kind: 'paragraph' });
        break;
      case 'heading':
        map.set(`b${id++}`, {
          path,
          kind: 'heading',
          level: (node.attrs?.level as 1 | 2) ?? 2,
        });
        break;
      case 'blockquote':
        map.set(`b${id++}`, { path, kind: 'blockquote' });
        break;
      case 'bulletList':
      case 'orderedList': {
        // Each list item is its own block (matches blockParser).
        (node.content ?? []).forEach((li, liIdx) => {
          map.set(`b${id++}`, { path: [...path, liIdx], kind: 'listItem' });
        });
        break;
      }
      case 'image':
        map.set(`b${id++}`, { path, kind: 'image' });
        break;
      case 'horizontalRule':
        map.set(`b${id++}`, { path, kind: 'divider' });
        break;
      default:
        (node.content ?? []).forEach((c, i) => walk(c, [...path, i]));
    }
  };

  (doc.content ?? []).forEach((c, i) => walk(c, [i]));
  return map;
}

/** Read a node by its content path. */
function getByPath(doc: TipTapDoc, path: number[]): TipTapNode | undefined {
  let cur: TipTapDoc | TipTapNode | undefined = doc;
  for (const idx of path) {
    if (!cur || !Array.isArray(cur.content) || cur.content[idx] === undefined) {
      return undefined;
    }
    cur = cur.content[idx];
  }
  return cur as TipTapNode | undefined;
}

/** Build the inline content for a source node from edited HTML. */
function contentForKind(ref: BlockSourceRef, html: string): TipTapNode[] {
  if (ref.kind === 'listItem' || ref.kind === 'paragraph' || ref.kind === 'heading' || ref.kind === 'blockquote') {
    const blocks = parseHtmlToDoc(html).content;
    if (
      blocks.length === 1 &&
      blocks[0].type !== 'image' &&
      blocks[0].type !== 'bulletList' &&
      blocks[0].type !== 'orderedList' &&
      blocks[0].type !== 'horizontalRule'
    ) {
      return blocks[0].content ?? [];
    }
    return parseInlineHtml(html);
  }
  return [];
}

/**
 * Apply card edits back into the article document.
 *
 * @param contentJson article.content (TipTap JSON string)
 * @param pages       current pagination result (for split-part texts)
 * @param edits       edited [data-block-id] elements from the active card
 * @returns           new JSON + HTML, or null when nothing can be applied
 */
export function applyBlockEdits(
  contentJson: string,
  pages: PageResult[],
  edits: BlockEdit[]
): MergeBackResult | null {
  if (!contentJson || !edits.length) return null;

  let doc: TipTapDoc;
  try {
    doc = JSON.parse(contentJson) as TipTapDoc;
  } catch {
    return null;
  }
  if (!doc || doc.type !== 'doc') return null;

  const registry = buildBlockRegistry(doc);

  // Group edits by base id, keyed by part suffix ("full" when not split).
  const grouped = new Map<string, Map<string, string>>();
  for (const edit of edits) {
    const m = /^(.*?)(?:-p(\d+))?$/.exec(edit.id);
    const base = m?.[1] ?? edit.id;
    const suffix = m?.[2] !== undefined ? `p${m[2]}` : 'full';
    if (!grouped.has(base)) grouped.set(base, new Map());
    grouped.get(base)!.set(suffix, edit.html);
  }

  // Record current split-part texts so untouched parts keep their content.
  const partTexts = new Map<string, Map<string, string>>();
  for (const page of pages) {
    for (const block of page.blocks) {
      const m = /^(.*?)(?:-p(\d+))?$/.exec(block.id);
      const base = m?.[1] ?? block.id;
      const suffix = m?.[2] !== undefined ? `p${m[2]}` : 'full';
      if (!partTexts.has(base)) partTexts.set(base, new Map());
      partTexts.get(base)!.set(suffix, blockText(block));
    }
  }

  for (const [base, parts] of grouped) {
    const ref = registry.get(base);
    if (!ref) continue;
    const target = getByPath(doc, ref.path);
    if (!target) continue;

    if (ref.kind === 'image') {
      const html = parts.get('full') ?? [...parts.values()][0] ?? '';
      const imageBlocks = parseHtmlToDoc(html).content.filter(
        (b) => b.type === 'image'
      );
      if (imageBlocks.length) {
        target.attrs = { ...(target.attrs ?? {}), ...(imageBlocks[0].attrs ?? {}) };
      }
      continue;
    }
    if (ref.kind === 'divider') continue;

    // Rebuild the source node's content from all parts in order.
    const partMap = partTexts.get(base) ?? new Map<string, string>();
    const partCount = Math.max(partMap.size, parts.size);
    const ordered: TipTapNode[] = [];
    for (let i = 0; i < partCount; i++) {
      const suffix = partCount === 1 ? 'full' : `p${i}`;
      const html = parts.get(suffix);
      if (html !== undefined) {
        ordered.push(...contentForKind(ref, html));
      } else {
        const text = partMap.get(suffix);
        if (text) ordered.push({ type: 'text', text });
      }
    }
    const fallback: TipTapNode[] = [{ type: 'text', text: '' }];
    if (ref.kind === 'blockquote' || ref.kind === 'listItem') {
      target.content = [
        {
          type: 'paragraph',
          content: ordered.length ? ordered : fallback,
        },
      ];
    } else {
      target.content = ordered.length ? ordered : fallback;
    }
  }

  return { json: JSON.stringify(doc), html: docToHtml(doc) };
}

/**
 * Insert a clipboard/file image as a real top-level TipTap block.
 *
 * Card DOM is only a paginated projection of the source document, so adding
 * an <img> directly to contentEditable would be discarded by merge-back.
 * This helper inserts into the source JSON first, then lets pagination render
 * the new block on whichever page it belongs to.
 */
export function insertImageAfterBlock(
  contentJson: string,
  afterBlockId: string | undefined,
  src: string
): MergeBackResult | null {
  if (!contentJson || !src) return null;

  let doc: TipTapDoc;
  try {
    doc = JSON.parse(contentJson) as TipTapDoc;
  } catch {
    return null;
  }
  if (!doc || doc.type !== 'doc') return null;
  if (!Array.isArray(doc.content)) doc.content = [];

  const image: TipTapNode = { type: 'image', attrs: { src } };
  const baseId = afterBlockId?.replace(/-p\d+$/, '');
  const ref = baseId ? buildBlockRegistry(doc).get(baseId) : undefined;
  const insertAt = ref?.path[0];

  if (insertAt === undefined) doc.content.push(image);
  else doc.content.splice(insertAt + 1, 0, image);

  return { json: JSON.stringify(doc), html: docToHtml(doc) };
}
