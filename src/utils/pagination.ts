/**
 * Fixed-height pagination engine for the XHS long-article card generator.
 *
 * ── Design ────────────────────────────────────────────────────────────
 * The engine is a pure, browser-free module. It estimates the rendered
 * height of every block (paragraph / heading / list / quote / image /
 * divider) from font metrics (CJK glyphs ≈ 1em, Latin ≈ 0.62em) and splits
 * the content into pages of a fixed pixel height:
 *
 *   1. Blocks that fit the remaining space of the current page are appended.
 *   2. A block that does NOT fit is moved to the next page as a whole
 *      (paragraph-level pagination).
 *   3. A single block TALLER than a full page is split at line level so it
 *      never overflows and never clips characters.
 *   4. Images are scaled proportionally to ≤ 85% of the content width
 *      (and additionally capped by the page height).
 *
 * All estimates are deliberately conservative (slightly over-estimated) so
 * the real DOM rendering always fits inside the exported PNG with no
 * clipped characters.
 */
import type { ArticleSize, Template } from '../types';
import {
  resolveCardBodyFontSize,
  resolveCardFontSize,
  resolveCardPadding,
} from './typography';

/* ──────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────── */

export type TextMarkType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'link'
  | 'textStyle';

/** A single rich-text mark attached to a text node (mirrors TipTap JSON). */
export interface TextMark {
  type: TextMarkType;
  attrs?: Record<string, unknown>;
}

/** A run of text with the marks applied to it. */
export interface RichTextNode {
  text: string;
  marks?: TextMark[];
}

/** Common fields shared by every page block. */
interface BaseBlock {
  id: string;
}

/** Paragraph of body text. */
export interface TextBlock extends BaseBlock {
  type: 'text';
  nodes: RichTextNode[];
  /** Effective font size override (px) — from a textStyle mark. */
  fontSize?: number;
}

/** Heading (level 1 or 2). */
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  nodes: RichTextNode[];
  level: 1 | 2;
  fontSize?: number;
}

/** A single list item (bullet or ordered). */
export interface ListBlock extends BaseBlock {
  type: 'list';
  nodes: RichTextNode[];
  listKind: 'bullet' | 'ordered';
  /** 1-based index used for ordered list numbering. */
  index: number;
  fontSize?: number;
}

/** Blockquote. */
export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  nodes: RichTextNode[];
  fontSize?: number;
}

/** Inline image. */
export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  /** User-set explicit display width (px) from the resizable image tooling. */
  width?: number;
  /** Resolved display size in px — set during pagination. */
  displayWidth?: number;
  displayHeight?: number;
}

/** Horizontal rule. */
export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export type PageBlock =
  | TextBlock
  | HeadingBlock
  | ListBlock
  | QuoteBlock
  | ImageBlock
  | DividerBlock;

/** One rendered page of the article. */
export interface PageResult {
  pageIndex: number;
  blocks: PageBlock[];
  isCover?: boolean;
}

/** Options controlling the pagination behaviour. */
export interface PaginationOptions {
  /** Page width in px. */
  width: number;
  /** Page height in px. */
  height: number;
  /** Card inner padding in px (template.padding). */
  padding: number;
  /** Base body font size in px (template.baseFontSize). */
  baseFontSize: number;
  /** Line height multiplier (template.lineHeight). */
  lineHeight: number;
  /** Letter spacing in em (template.letterSpacing). */
  letterSpacing: number;
  /** Heading font weight (template.headingFontWeight) — informational. */
  headingFontWeight: number;
  /** Vertical margin baked into each text-like block (px). */
  blockMargin?: number;
  /** Font size multipliers for heading levels. */
  headingScale?: { 1: number; 2: number };
  /** Max width of an image as a ratio of the content width. */
  imageMaxWidthRatio?: number;
}

/* ──────────────────────────────────────────────────────────────────────
 * Constants — conservative spacing/margins (over-estimate → safe)
 * ────────────────────────────────────────────────────────────────────── */

/** Extra vertical space baked into a paragraph block (p margin + safety). */
const TEXT_MARGIN = 18;
/** Accent bar + spacing under content headings. */
const HEADING_EXTRA = 16;
/** Heading vertical margins (h1/h2 margin + safety). */
const HEADING_MARGIN = 22;
/** List item vertical margin. */
const LIST_MARGIN = 14;
/** Quote left padding + border width. */
const QUOTE_PAD = 18;
/** Quote vertical margins. */
const QUOTE_MARGIN = 22;
/** Image vertical margin (img margin + safety). */
const IMAGE_MARGIN = 20;
/** Horizontal rule total height. */
const DIVIDER_HEIGHT = 40;

/* ──────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */

/** Concatenated plain text of a list of rich-text nodes. */
export function nodesToText(nodes: RichTextNode[]): string {
  return nodes.map((n) => n.text).join('');
}

/**
 * Approximate width of a single character at a given font size.
 * CJK ideographs / full-width punctuation are 1em wide; Latin ~0.62em
 * (deliberately wider than the real ~0.5em so we over-estimate lines).
 */
export function charWidth(
  ch: string,
  fontSize: number,
  letterSpacing: number
): number {
  const spacing = 1 + letterSpacing;
  if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) {
    return fontSize * spacing;
  }
  if (ch === ' ') {
    return fontSize * 0.35 * spacing;
  }
  return fontSize * 0.62 * spacing;
}

/**
 * Estimate how many rendered lines a piece of text needs inside a given
 * content width. Pure — no DOM required. Handles explicit `\n` (hardBreak)
 * and wraps long runs at the estimated glyph width.
 */
export function estimateLineCount(
  text: string,
  contentWidth: number,
  fontSize: number,
  letterSpacing: number
): number {
  if (!text) return 1;
  // 2% safety margin so rounding never lets a line sneak past the width.
  const safeWidth = Math.max(1, contentWidth * 0.98);
  let lines = 1;
  let width = 0;
  for (const ch of text) {
    if (ch === '\n') {
      lines += 1;
      width = 0;
      continue;
    }
    const w = charWidth(ch, fontSize, letterSpacing);
    if (width + w > safeWidth) {
      lines += 1;
      width = w;
    } else {
      width += w;
    }
  }
  return Math.max(1, lines);
}

/**
 * Headline testable interface: given a plain text (e.g. 2000 chars), a font
 * size, a line height and a page size, compute how many content pages the
 * article would occupy. Used by unit tests and rough word-count previews.
 */
export function estimatePageCountForText(
  text: string,
  opts: {
    fontSize: number;
    lineHeight: number;
    width: number;
    height: number;
    padding?: number;
    letterSpacing?: number;
  }
): number {
  const {
    fontSize,
    lineHeight,
    width,
    height,
    padding = 32,
    letterSpacing = 0,
  } = opts;
  const contentWidth = Math.max(1, width - padding * 2);
  const contentHeight = Math.max(1, height - padding * 2);
  const linesPerPage = Math.max(
    1,
    Math.floor(contentHeight / (fontSize * lineHeight))
  );
  const lines = estimateLineCount(text, contentWidth, fontSize, letterSpacing);
  return Math.max(1, Math.ceil(lines / linesPerPage));
}

/* ──────────────────────────────────────────────────────────────────────
 * Pagination options
 * ────────────────────────────────────────────────────────────────────── */

/** Build pagination options from an article size + template theme. */
export function buildPaginationOptions(
  size: ArticleSize,
  tpl: Template
): PaginationOptions {
  return {
    width: size.width,
    height: size.height,
    padding: resolveCardPadding(tpl.padding),
    baseFontSize: resolveCardBodyFontSize(tpl.baseFontSize),
    lineHeight: tpl.lineHeight,
    letterSpacing: tpl.letterSpacing,
    headingFontWeight: tpl.headingFontWeight,
    blockMargin: 8,
    headingScale: { 1: 1.6, 2: 1.35 },
    imageMaxWidthRatio: 0.85,
  };
}

/** Build the placeholder cover page (rendered from article data, not blocks). */
export function makeCoverPage(): PageResult {
  return { pageIndex: 0, blocks: [], isCover: true };
}

/* ──────────────────────────────────────────────────────────────────────
 * Block height estimation
 * ────────────────────────────────────────────────────────────────────── */

export interface BlockLayoutContext {
  contentWidth: number;
  contentHeight: number;
  opts: PaginationOptions;
}

/** Estimated rendered height (px) of a single block, including margins. */
export function estimateBlockHeight(
  block: PageBlock,
  ctx: BlockLayoutContext
): number {
  const opts = ctx.opts;
  const cw = ctx.contentWidth;
  switch (block.type) {
    case 'text': {
      const fs = resolveCardFontSize(block.fontSize, opts.baseFontSize);
      const lines = estimateLineCount(
        nodesToText(block.nodes),
        cw,
        fs,
        opts.letterSpacing
      );
      return Math.ceil(lines * fs * opts.lineHeight) + TEXT_MARGIN;
    }
    case 'heading': {
      const scale = opts.headingScale?.[block.level] ?? 1.5;
      const fs = Math.round(resolveCardFontSize(block.fontSize, opts.baseFontSize) * scale);
      const lines = Math.max(
        1,
        estimateLineCount(nodesToText(block.nodes), cw, fs, opts.letterSpacing)
      );
      return Math.ceil(lines * fs * 1.35) + HEADING_EXTRA + HEADING_MARGIN;
    }
    case 'list': {
      const fs = resolveCardFontSize(block.fontSize, opts.baseFontSize);
      const prefix =
        block.listKind === 'bullet'
          ? '• '
          : `${Math.max(1, block.index)}. `;
      const lines = estimateLineCount(
        prefix + nodesToText(block.nodes),
        cw,
        fs,
        opts.letterSpacing
      );
      return Math.ceil(lines * fs * opts.lineHeight) + LIST_MARGIN;
    }
    case 'quote': {
      const fs = resolveCardFontSize(block.fontSize, opts.baseFontSize);
      const lines = estimateLineCount(
        nodesToText(block.nodes),
        Math.max(1, cw - QUOTE_PAD),
        fs,
        opts.letterSpacing
      );
      return Math.ceil(lines * fs * opts.lineHeight) + QUOTE_PAD + QUOTE_MARGIN;
    }
    case 'image': {
      const w =
        block.naturalWidth && block.naturalWidth > 0 ? block.naturalWidth : cw;
      const h =
        block.naturalHeight && block.naturalHeight > 0
          ? block.naturalHeight
          : w;
      // Explicit user width (resize handle) is respected up to the full
      // content width; otherwise fall back to the conservative 85% cap.
      const maxW = Math.floor(cw * (opts.imageMaxWidthRatio ?? 0.85));
      const capW =
        block.width && block.width > 0 ? Math.min(block.width, cw) : maxW;
      // Cap by the content height minus the image margin so the image plus
      // its margin always fits a fresh page.
      const maxH = Math.max(1, ctx.contentHeight - IMAGE_MARGIN);
      // A user-set width is an explicit design decision and may enlarge a
      // small source image. Automatic layout still avoids upscaling by
      // default to protect image quality.
      const scale = block.width && block.width > 0
        ? Math.min(capW / w, maxH / h)
        : Math.min(1, capW / w, maxH / h);
      const dw = Math.max(1, Math.round(w * scale));
      const dh = Math.max(1, Math.round(h * scale));
      // Persist the resolved display size so the renderer stays in sync.
      block.displayWidth = dw;
      block.displayHeight = dh;
      return dh + IMAGE_MARGIN;
    }
    case 'divider':
      return DIVIDER_HEIGHT;
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Line-level splitting (pure)
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Find the character offset at which `text` exceeds `maxLines` rendered
 * lines. Returns `text.length` when everything fits.
 */
function findCutOffset(
  text: string,
  maxLines: number,
  contentWidth: number,
  fontSize: number,
  letterSpacing: number
): number {
  if (text.length === 0) return 0;
  const safeWidth = Math.max(1, contentWidth * 0.98);
  let lines = 1;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      lines += 1;
      width = 0;
      if (lines > maxLines) return i;
      continue;
    }
    const w = charWidth(ch, fontSize, letterSpacing);
    if (width + w > safeWidth) {
      lines += 1;
      width = w;
      if (lines > maxLines) return i;
    } else {
      width += w;
    }
  }
  return text.length;
}

/** Split a rich-text node array at a character offset, preserving marks. */
export function splitTextNodesAt(
  nodes: RichTextNode[],
  offset: number
): { first: RichTextNode[]; rest: RichTextNode[] } {
  const first: RichTextNode[] = [];
  const rest: RichTextNode[] = [];
  let remaining = Math.max(0, offset);
  for (const node of nodes) {
    if (remaining <= 0) {
      rest.push(node);
      continue;
    }
    if (node.text.length <= remaining) {
      first.push(node);
      remaining -= node.text.length;
    } else {
      first.push({ text: node.text.slice(0, remaining), marks: node.marks });
      rest.push({ text: node.text.slice(remaining), marks: node.marks });
      remaining = 0;
    }
  }
  return { first, rest };
}

/** Split a text-like block into chunks of at most `maxLines` lines each. */
function splitBlockByLines(
  block: TextBlock | HeadingBlock | ListBlock | QuoteBlock,
  maxLines: number,
  ctx: BlockLayoutContext
): PageBlock[] {
  const fs = resolveCardFontSize(block.fontSize, ctx.opts.baseFontSize);
  const parts: PageBlock[] = [];
  let rest = block.nodes;
  let guard = 0;
  while (nodesToText(rest).length > 0 && guard < 1000) {
    guard += 1;
    const total = nodesToText(rest);
    const offset = findCutOffset(
      total,
      maxLines,
      ctx.contentWidth,
      fs,
      ctx.opts.letterSpacing
    );
    if (offset <= 0) break; // safety: no progress possible
    const { first, rest: remaining } = splitTextNodesAt(rest, offset);
    if (!first.length) break;
    parts.push({
      ...block,
      id: `${block.id}-p${parts.length}`,
      nodes: first,
    });
    rest = remaining;
  }
  return parts.length ? parts : [block];
}

/**
 * Split a single block that is taller than a whole page into chunks that
 * each fit a fresh page (line-level splitting for text-like blocks).
 */
function splitTallBlock(block: PageBlock, ctx: BlockLayoutContext): PageBlock[] {
  if (
    block.type !== 'text' &&
    block.type !== 'heading' &&
    block.type !== 'list' &&
    block.type !== 'quote'
  ) {
    // Images: scale to fit the page height.
    const estimated = estimateBlockHeight(block, ctx);
    if (block.type === 'image') {
      // estimateBlockHeight already capped the height; return as-is.
      return [block];
    }
    return [block];
  }
  const fs = resolveCardFontSize(block.fontSize, ctx.opts.baseFontSize);
  const lineHeightPx = fs * ctx.opts.lineHeight;
  const maxLines = Math.max(
    1,
    Math.floor((ctx.contentHeight - TEXT_MARGIN) / lineHeightPx)
  );
  return splitBlockByLines(block, maxLines, ctx);
}

/* ──────────────────────────────────────────────────────────────────────
 * Main pagination entry point
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Fixed-height pagination over structured blocks.
 *
 * @param blocks  parsed content blocks (see blockParser.ts)
 * @param opts    pagination options derived from size + template
 * @returns       content pages (cover page is added separately)
 */
export function paginateBlocks(
  blocks: PageBlock[],
  opts: PaginationOptions
): PageResult[] {
  const contentWidth = Math.max(1, opts.width - opts.padding * 2);
  const contentHeight = Math.max(1, opts.height - opts.padding * 2);
  const ctx: BlockLayoutContext = { contentWidth, contentHeight, opts };

  const results: PageResult[] = [];
  let current: PageBlock[] = [];
  let used = 0;

  const flush = (): void => {
    if (current.length) {
      results.push({ pageIndex: results.length, blocks: current });
      current = [];
      used = 0;
    }
  };

  for (const block of blocks) {
    const h = estimateBlockHeight(block, ctx);
    if (h <= ctx.contentHeight) {
      // Normal block: move to next page as a whole when it does not fit.
      if (used + h > ctx.contentHeight && current.length) flush();
      current.push(block);
      used += h;
    } else {
      // Block taller than a whole page → line-level split.
      const parts = splitTallBlock(block, ctx);
      for (const part of parts) {
        const ph = estimateBlockHeight(part, ctx);
        if (used + ph > ctx.contentHeight && current.length) flush();
        current.push(part);
        used += ph;
      }
    }
  }
  flush();
  return results;
}
