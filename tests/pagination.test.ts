import { describe, it, expect } from 'vitest';
import {
  estimatePageCountForText,
  estimateBlockHeight,
  paginateBlocks,
  splitTextNodesAt,
  nodesToText,
} from '../src/utils/pagination';
import type { PageBlock, PaginationOptions, RichTextNode } from '../src/utils/pagination';

/** Default phone-long-like test options (340×604, clean-bright theme). */
const DEFAULT_OPTS: PaginationOptions = {
  width: 340,
  height: 604,
  padding: 32,
  baseFontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0,
  headingFontWeight: 700,
};

/** Small page used to exercise pagination boundaries deterministically. */
const SMALL_OPTS: PaginationOptions = {
  width: 200,
  height: 200,
  padding: 8,
  baseFontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0,
  headingFontWeight: 400,
};

const TINY_OPTS: PaginationOptions = {
  width: 200,
  height: 100,
  padding: 8,
  baseFontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0,
  headingFontWeight: 400,
};

/** Helper: build a plain text block of N Chinese chars. */
function textBlock(id: string, text: string, fontSize?: number): PageBlock {
  return { id, type: 'text', nodes: [{ text }], fontSize };
}

/** Helper: repeat a Chinese char N times. */
const chars = (n: number): string => '字'.repeat(n);

/**
 * P0-1 分页引擎
 * 验收：2000 字稿件（手机长图 340×604、16px、1.8 行高）→ ≥5 张正文图。
 */
describe('estimatePageCountForText 纯函数页数估算', () => {
  it('2000 个中文字符在手机长图下应生成 ≥5 页', () => {
    const pages = estimatePageCountForText(chars(2000), {
      fontSize: 16,
      lineHeight: 1.8,
      width: 340,
      height: 604,
      padding: 32,
      letterSpacing: 0,
    });
    expect(pages).toBeGreaterThanOrEqual(5);
  });

  it('空文本至少返回 1 页（封面之外的正文占位）', () => {
    expect(
      estimatePageCountForText('', {
        fontSize: 16,
        lineHeight: 1.8,
        width: 340,
        height: 604,
      })
    ).toBe(1);
  });

  it('字号越大 → 每页容纳行数越少 → 页数越多', () => {
    const small = estimatePageCountForText(chars(2000), {
      fontSize: 12,
      lineHeight: 1.8,
      width: 340,
      height: 604,
      padding: 32,
    });
    const big = estimatePageCountForText(chars(2000), {
      fontSize: 24,
      lineHeight: 1.8,
      width: 340,
      height: 604,
      padding: 32,
    });
    expect(big).toBeGreaterThan(small);
  });

  it('页高越大 → 每页容量越大 → 页数越少', () => {
    const short = estimatePageCountForText(chars(2000), {
      fontSize: 16,
      lineHeight: 1.8,
      width: 340,
      height: 400,
      padding: 32,
    });
    const tall = estimatePageCountForText(chars(2000), {
      fontSize: 16,
      lineHeight: 1.8,
      width: 340,
      height: 1000,
      padding: 32,
    });
    expect(short).toBeGreaterThan(tall);
  });
});

/**
 * 段级分页：段落放不下当前页剩余空间 → 整段移至下一页。
 * 页面高 200、padding 8 → 内容高 184；16px/1.8 行高 → 每行 28.8px。
 * A（5 行 + margin 18 = 162）能放入首页；B（同样 5 行 = 162）在 A 之后
 * 放不下剩余空间（162+162 > 184）→ 整段移至第二页。
 */
describe('paginateBlocks 段级分页', () => {
  it('放不下的段落整段移至下一页', () => {
    const blockA = textBlock('a', chars(55)); // 5 行 = 162px
    const blockB = textBlock('b', chars(55)); // 5 行 = 162px

    const pages = paginateBlocks([blockA, blockB], SMALL_OPTS);
    expect(pages).toHaveLength(2);
    expect(pages[0].blocks.map((b) => b.id)).toEqual(['a']);
    expect(pages[1].blocks.map((b) => b.id)).toEqual(['b']);
  });

  it('剩余空间充足时多个段落同处一页', () => {
    // 2 行段落（22 字）估算高 76px，两个共 152px ≤ 184 → 一页两段
    const pages = paginateBlocks(
      [textBlock('a', chars(22)), textBlock('b', chars(22))],
      SMALL_OPTS
    );
    expect(pages).toHaveLength(1);
    expect(pages[0].blocks.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('空内容不产生正文页', () => {
    expect(paginateBlocks([], SMALL_OPTS)).toEqual([]);
  });
});

/**
 * 行级拆分：单段超过整页高度 → 按行拆分，保证不溢出、不裁字。
 * 页高 100、padding 8 → 内容高 84；每行 28.8px，去掉 margin 18 → 每页最多 2 行。
 * 110 字 = 10 行 → 拆成 5 个 2 行块 → 5 页。
 */
describe('paginateBlocks 行级拆分', () => {
  it('超页高段落按行拆分且每页不溢出', () => {
    const paragraph = textBlock('long', chars(110));
    const pages = paginateBlocks([paragraph], TINY_OPTS);

    expect(pages.length).toBeGreaterThan(1);
    // 每页所有块的估算高度合计都不超过内容高
    const contentHeight = TINY_OPTS.height - TINY_OPTS.padding * 2;
    for (const page of pages) {
      const sum = page.blocks.reduce(
        (acc, b) =>
          acc +
          estimateBlockHeight(b, {
            contentWidth: TINY_OPTS.width - TINY_OPTS.padding * 2,
            contentHeight,
            opts: TINY_OPTS,
          }),
        0
      );
      expect(sum).toBeLessThanOrEqual(contentHeight + 0.001);
    }
    // 字符总数守恒（不裁字）：所有页文本拼接 == 原文
    const allText = pages
      .flatMap((p) => p.blocks)
      .map((b) => nodesToText((b as { nodes: RichTextNode[] }).nodes))
      .join('');
    expect(allText).toBe(chars(110));
    // 首页第一块就是 2 行（22 字）
    const first = pages[0].blocks[0] as { nodes: RichTextNode[] };
    expect(nodesToText(first.nodes)).toHaveLength(22);
  });

  it('拆分行保留原文顺序', () => {
    const text = '一二三四五六七八九十一二三四五六七八九十';
    const pages = paginateBlocks([textBlock('p', text)], TINY_OPTS);
    const allText = pages
      .flatMap((p) => p.blocks)
      .map((b) => nodesToText((b as { nodes: RichTextNode[] }).nodes))
      .join('');
    expect(allText).toBe(text);
  });
});

/** splitTextNodesAt：按字符偏移拆分并保留 marks。 */
describe('splitTextNodesAt 保留富文本 marks', () => {
  it('在文本节点中间拆分时 marks 各自保留', () => {
    const nodes: RichTextNode[] = [
      { text: '你好', marks: [{ type: 'bold' }] },
      { text: '世界', marks: [{ type: 'italic' }] },
    ];
    const { first, rest } = splitTextNodesAt(nodes, 3);
    expect(nodesToText(first)).toBe('你好世');
    expect(nodesToText(rest)).toBe('界');
    expect(first[0].marks?.[0].type).toBe('bold');
    expect(first[1].marks?.[0].type).toBe('italic');
    expect(rest[0].marks?.[0].type).toBe('italic');
  });
});

/**
 * 图片节点：按等比例缩放至适配宽度（≤85% 页宽），图片自身高度计入占位。
 */
describe('paginateBlocks 图片节点', () => {
  it('宽图缩放到 85% 内容宽并等比计算高度', () => {
    const image: PageBlock = {
      id: 'img',
      type: 'image',
      src: 'data:image/png;base64,xxx',
      naturalWidth: 400,
      naturalHeight: 200,
    };
    const contentWidth = SMALL_OPTS.width - SMALL_OPTS.padding * 2; // 184
    const contentHeight = SMALL_OPTS.height - SMALL_OPTS.padding * 2;
    const h = estimateBlockHeight(image, { contentWidth, contentHeight, opts: SMALL_OPTS });
    const img = image as Extract<PageBlock, { type: 'image' }>;
    expect(img.displayWidth).toBe(Math.floor(184 * 0.85)); // 156
    expect(img.displayHeight).toBe(78); // 156 * (200/400)
    expect(h).toBe(78 + 20); // 高度 + 图片 margin
  });

  it('超高图按页高缩放，保证图片+margin 不溢出整页', () => {
    const image: PageBlock = {
      id: 'img2',
      type: 'image',
      src: 'data:image/png;base64,xxx',
      naturalWidth: 100,
      naturalHeight: 400,
    };
    const pages = paginateBlocks([image], TINY_OPTS);
    const contentHeight = TINY_OPTS.height - TINY_OPTS.padding * 2; // 84
    const img = pages[0].blocks[0] as Extract<PageBlock, { type: 'image' }>;
    expect(img.displayHeight).toBeLessThanOrEqual(contentHeight - 20);
    expect(pages).toHaveLength(1);
  });

  it('未知尺寸图片按正方形 1:1 保守估算', () => {
    const image: PageBlock = { id: 'img3', type: 'image', src: 'data:image/png;base64,xxx' };
    const contentWidth = SMALL_OPTS.width - SMALL_OPTS.padding * 2;
    const contentHeight = SMALL_OPTS.height - SMALL_OPTS.padding * 2;
    const h = estimateBlockHeight(image, { contentWidth, contentHeight, opts: SMALL_OPTS });
    const img = image as Extract<PageBlock, { type: 'image' }>;
    expect(img.displayWidth).toBe(Math.floor(184 * 0.85));
    expect(img.displayHeight).toBe(Math.floor(184 * 0.85));
    expect(h).toBe(img.displayHeight + 20);
  });

  it('显式设置宽度可放大小图，并参与后续分页高度计算', () => {
    const image: PageBlock = {
      id: 'img4',
      type: 'image',
      src: 'data:image/png;base64,xxx',
      naturalWidth: 80,
      naturalHeight: 40,
      width: 160,
    };
    const contentWidth = SMALL_OPTS.width - SMALL_OPTS.padding * 2;
    const contentHeight = SMALL_OPTS.height - SMALL_OPTS.padding * 2;
    const h = estimateBlockHeight(image, { contentWidth, contentHeight, opts: SMALL_OPTS });
    const img = image as Extract<PageBlock, { type: 'image' }>;
    expect(img.displayWidth).toBe(160);
    expect(img.displayHeight).toBe(80);
    expect(h).toBe(100);
  });
});

/** 混合内容：标题 + 正文 + 图片 + 列表顺序保持。 */
describe('paginateBlocks 混合内容顺序', () => {
  it('标题/正文/图片/列表按输入顺序进入页面', () => {
    const blocks: PageBlock[] = [
      { id: 'h', type: 'heading', level: 1, nodes: [{ text: '小标题' }] },
      textBlock('p1', chars(30)),
      {
        id: 'img',
        type: 'image',
        src: 'data:image/png;base64,xxx',
        naturalWidth: 100,
        naturalHeight: 100,
      },
      { id: 'li', type: 'list', listKind: 'bullet', index: 1, nodes: [{ text: '列表项' }] },
      textBlock('p2', chars(30)),
    ];
    const pages = paginateBlocks(blocks, DEFAULT_OPTS);
    expect(pages.length).toBeGreaterThan(0);
    const flat = pages.flatMap((p) => p.blocks);
    expect(flat.map((b) => b.id)).toEqual(['h', 'p1', 'img', 'li', 'p2']);
  });
});
