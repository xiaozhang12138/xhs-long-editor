import { describe, it, expect } from 'vitest';
import { parseHtmlToDoc, parseInlineHtml, docToHtml } from '../src/utils/htmlDoc';
import {
  applyBlockEdits,
  applyCardFlowEdits,
  buildBlockRegistry,
  ensureDocumentFlowIds,
  insertImageAfterBlock,
  moveBlockNear,
} from '../src/utils/mergeBack';
import { parseContentToBlocks } from '../src/utils/blockParser';
import type { PageResult } from '../src/utils/pagination';

/** Minimal TipTap doc with a paragraph + a heading. */
const DOC = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '第一段内容' }] },
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '小标题' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: '第三段' }] },
  ],
});

describe('parseInlineHtml 内联富文本解析', () => {
  it('解析 strong/em/mark 为 marks', () => {
    const nodes = parseInlineHtml('<strong>加粗</strong><em>斜体</em><mark style="background-color:#DCEBFF">高亮</mark>');
    expect(nodes[0]).toMatchObject({ type: 'text', text: '加粗', marks: [{ type: 'bold' }] });
    expect(nodes[1]).toMatchObject({ type: 'text', text: '斜体', marks: [{ type: 'italic' }] });
    // jsdom 会把内联颜色规范化为 rgb(...)，浏览器行为一致
    expect(nodes[2]).toMatchObject({
      type: 'text',
      text: '高亮',
      marks: [{ type: 'highlight', attrs: { color: 'rgb(220, 235, 255)' } }],
    });
  });

  it('span 的 color/fontSize 映射为 textStyle mark', () => {
    const nodes = parseInlineHtml('<span style="color:#FF2442;font-size:20px">红字</span>');
    expect(nodes[0].marks).toEqual(
      expect.arrayContaining([
        {
          type: 'textStyle',
          attrs: { color: 'rgb(255, 36, 66)', fontSize: '20px' },
        },
      ])
    );
  });

  it('<br> 映射为 hardBreak', () => {
    const nodes = parseInlineHtml('第一行<br>第二行');
    expect(nodes.map((n) => n.type)).toEqual(['text', 'hardBreak', 'text']);
  });
});

describe('parseHtmlToDoc / docToHtml 块级往返', () => {
  it('段落/标题/列表/引用/图片/分割线均可解析', () => {
    const html =
      '<p>正文</p><h1>标题</h1><ul><li>项目一</li><li>项目二</li></ul><blockquote>引用</blockquote><div><img src="data:image/png;base64,AAA" width="300" /></div><hr />';
    const doc = parseHtmlToDoc(html);
    const types = doc.content.map((n) => n.type);
    expect(types).toEqual([
      'paragraph',
      'heading',
      'bulletList',
      'blockquote',
      'image',
      'horizontalRule',
    ]);
    const img = doc.content[4] as { attrs?: { width?: number } };
    expect(img.attrs?.width).toBe(300);
  });

  it('docToHtml 序列化可被再次解析（往返稳定）', () => {
    const doc = parseHtmlToDoc('<p>你好<strong>世界</strong></p><h2>副标题</h2>');
    const html = docToHtml(doc);
    const doc2 = parseHtmlToDoc(html);
    expect(JSON.stringify(doc2)).toBe(JSON.stringify(doc));
  });

  it('序列化时转义 HTML 特殊字符', () => {
    const doc = parseHtmlToDoc('<p>a &lt; b &amp; c</p>');
    const html = docToHtml(doc);
    expect(html).toContain('&lt;');
  });
});

describe('buildBlockRegistry 与 blockParser 顺序一致', () => {
  it('b0/b1/b2 对应文档顺序节点', () => {
    const doc = JSON.parse(DOC) as Parameters<typeof buildBlockRegistry>[0];
    const registry = buildBlockRegistry(doc);
    expect(registry.get('b0')).toMatchObject({ kind: 'paragraph' });
    expect(registry.get('b1')).toMatchObject({ kind: 'heading', level: 1 });
    expect(registry.get('b2')).toMatchObject({ kind: 'paragraph' });
  });

  it('旧文档首次排版时获得稳定 flowId', () => {
    const normalized = ensureDocumentFlowIds(DOC);
    expect(normalized).not.toBeNull();
    const doc = JSON.parse(normalized!.json) as {
      content: Array<{ attrs?: { flowId?: string } }>;
    };
    expect(doc.content.map((node) => node.attrs?.flowId)).toEqual(['b0', 'b1', 'b2']);
    expect(parseContentToBlocks(normalized!.json).map((block) => block.id)).toEqual([
      'b0', 'b1', 'b2',
    ]);
  });
});

describe('applyBlockEdits 点击即改回写', () => {
  it('编辑单段文字后回写 JSON 与 HTML', () => {
    const pages: PageResult[] = [
      {
        pageIndex: 1,
        blocks: [
          {
            id: 'b0',
            type: 'text',
            nodes: [{ text: '第一段内容', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    ];
    const result = applyBlockEdits(DOC, pages, [
      { id: 'b0', html: '<strong>改成加粗的新内容</strong>' },
    ]);
    expect(result).not.toBeNull();
    const doc = JSON.parse(result!.json) as { content: Array<{ content: unknown[] }> };
    expect(doc.content[0].content).toEqual([
      { type: 'text', text: '改成加粗的新内容', marks: [{ type: 'bold' }] },
    ]);
    expect(result!.html).toContain('<strong>改成加粗的新内容</strong>');
  });

  it('编辑被拆分的长段落时，未编辑部分保留原文', () => {
    const splitDoc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第一页部分内容' }],
        },
      ],
    });
    // b0 被拆到两页：b0-p0 / b0-p1
    const pages: PageResult[] = [
      {
        pageIndex: 1,
        blocks: [
          { id: 'b0-p0', type: 'text', nodes: [{ text: '第一页部分' }] },
        ],
      },
      {
        pageIndex: 2,
        blocks: [
          { id: 'b0-p1', type: 'text', nodes: [{ text: '内容' }] },
        ],
      },
    ];
    const result = applyBlockEdits(splitDoc, pages, [
      { id: 'b0-p0', html: '修改后的第一页部分' },
    ]);
    expect(result).not.toBeNull();
    const doc = JSON.parse(result!.json) as { content: Array<{ content: Array<{ text?: string }> }> };
    const texts = doc.content[0].content.map((n) => n.text ?? '').join('');
    expect(texts).toBe('修改后的第一页部分内容');
  });

  it('图片节点更新 width 属性', () => {
    const imgDoc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'data:image/png;base64,AAA', width: 400 } },
      ],
    });
    const pages: PageResult[] = [
      {
        pageIndex: 1,
        blocks: [
          { id: 'b0', type: 'image', src: 'data:image/png;base64,AAA' },
        ],
      },
    ];
    const result = applyBlockEdits(imgDoc, pages, [
      { id: 'b0', html: '<div><img src="data:image/png;base64,AAA" width="250" /></div>' },
    ]);
    expect(result).not.toBeNull();
    const doc = JSON.parse(result!.json) as {
      content: Array<{ attrs?: { width?: number } }>;
    };
    expect(doc.content[0].attrs?.width).toBe(250);
  });

  it('空编辑列表返回 null', () => {
    expect(applyBlockEdits(DOC, [], [])).toBeNull();
  });
});

describe('applyCardFlowEdits 结构化连续回流', () => {
  it('回车生成的新段落插入源文档，后续块稳定 ID 不变', () => {
    const normalized = ensureDocumentFlowIds(DOC)!;
    const pages: PageResult[] = [
      {
        pageIndex: 1,
        blocks: [
          { id: 'b0', type: 'text', nodes: [{ text: '第一段内容' }] },
          { id: 'b1', type: 'heading', level: 1, nodes: [{ text: '小标题' }] },
          { id: 'b2', type: 'text', nodes: [{ text: '第三段' }] },
        ],
      },
    ];
    const result = applyCardFlowEdits(normalized.json, pages, [
      {
        id: 'b0',
        html: '第一段内容',
        outerHtml: '<p data-block-id="b0">第一段内容</p>',
      },
      {
        html: '新增段落',
        outerHtml: '<p>新增段落</p>',
        newId: 'n-new-paragraph',
        afterId: 'b0',
        beforeId: 'b1',
      },
      {
        id: 'b1',
        html: '小标题',
        outerHtml: '<h1 data-block-id="b1">小标题</h1>',
      },
      {
        id: 'b2',
        html: '第三段',
        outerHtml: '<p data-block-id="b2">第三段</p>',
      },
    ]);

    expect(result).not.toBeNull();
    const blocks = parseContentToBlocks(result!.json);
    expect(blocks.map((block) => block.id)).toEqual([
      'b0', 'n-new-paragraph', 'b1', 'b2',
    ]);
    expect(blocks.map((block) =>
      'nodes' in block ? block.nodes.map((node) => node.text).join('') : ''
    )).toEqual(['第一段内容', '新增段落', '小标题', '第三段']);
  });

  it('拆分段落之后的新段落仍插入原始段落之后', () => {
    const normalized = ensureDocumentFlowIds(DOC)!;
    const pages: PageResult[] = [
      { pageIndex: 1, blocks: [{ id: 'b0-p0', type: 'text', nodes: [{ text: '第一段' }] }] },
      { pageIndex: 2, blocks: [{ id: 'b0-p1', type: 'text', nodes: [{ text: '内容' }] }] },
    ];
    const result = applyCardFlowEdits(normalized.json, pages, [
      {
        id: 'b0-p1', html: '内容', outerHtml: '<p data-block-id="b0-p1">内容</p>',
      },
      {
        html: '跨页后新段', outerHtml: '<p>跨页后新段</p>',
        newId: 'n-after-split', afterId: 'b0-p1',
      },
    ]);
    expect(parseContentToBlocks(result!.json).map((block) => block.id)).toEqual([
      'b0', 'n-after-split', 'b1', 'b2',
    ]);
  });
});

describe('insertImageAfterBlock 排版后插图', () => {
  it('在光标所在块之后插入真实图片节点', () => {
    const result = insertImageAfterBlock(
      DOC,
      'b0',
      'data:image/png;base64,IMAGE'
    );
    expect(result).not.toBeNull();
    const doc = JSON.parse(result!.json) as {
      content: Array<{ type: string; attrs?: { src?: string } }>;
    };
    expect(doc.content.map((node) => node.type)).toEqual([
      'paragraph',
      'image',
      'heading',
      'paragraph',
    ]);
    expect(doc.content[1].attrs?.src).toBe('data:image/png;base64,IMAGE');
    expect(result!.html).toContain('data:image/png;base64,IMAGE');
  });

  it('拆分页块 ID 仍插在原始段落之后', () => {
    const result = insertImageAfterBlock(DOC, 'b0-p2', 'data:image/png;base64,SPLIT');
    const doc = JSON.parse(result!.json) as { content: Array<{ type: string }> };
    expect(doc.content[1].type).toBe('image');
  });

  it('排版后插图获得新稳定 ID，后续段落 ID 不偏移', () => {
    const normalized = ensureDocumentFlowIds(DOC)!;
    const result = insertImageAfterBlock(
      normalized.json,
      'b0',
      'data:image/png;base64,FLOW'
    )!;
    const ids = parseContentToBlocks(result.json).map((block) => block.id);
    expect(ids[0]).toBe('b0');
    expect(ids[1]).toMatch(/^n-/);
    expect(ids.slice(2)).toEqual(['b1', 'b2']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('空文档直接追加图片', () => {
    const empty = JSON.stringify({ type: 'doc', content: [] });
    const result = insertImageAfterBlock(empty, undefined, 'data:image/png;base64,ONLY');
    const doc = JSON.parse(result!.json) as { content: Array<{ type: string }> };
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('image');
  });
});

describe('moveBlockNear 手动分页顺序调整', () => {
  it('把顶层段落移动到目标段落之后', () => {
    const result = moveBlockNear(DOC, 'b0', 'b2', 'after');
    const doc = JSON.parse(result!.json) as { content: Array<{ content?: Array<{ text?: string }> }> };
    expect(doc.content.map((node) => node.content?.[0]?.text)).toEqual([
      '小标题', '第三段', '第一段内容',
    ]);
  });

  it('列表子项不做危险的跨容器移动', () => {
    const listDoc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '一' }] }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: '二' }] },
      ],
    });
    expect(moveBlockNear(listDoc, 'b0', 'b1', 'after')).toBeNull();
  });
});
