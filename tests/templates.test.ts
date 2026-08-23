import { describe, it, expect } from 'vitest';
import {
  templates,
  recommendedTags,
  coverColors,
  xhsEmojis,
  systemEmojis,
  templateCategories,
} from '../src/data/templates';

const BOLD_STYLES = [
  'highlight',
  'underline',
  'color',
  'scale',
  'serif',
  'shadow',
  'double',
  'marker',
  'combo',
];
const TITLE_DECORATIONS = [
  'none',
  'quote',
  'color-block',
  'paper',
  'line',
  'corner',
  'frame',
  'underline-block',
  'circle',
  'bracket',
  'masthead',
  'number-block',
  'leaf',
  'tag',
  'mosaic',
  'block',
  'rings',
];
const BACKGROUND_PATTERNS = [
  'none',
  'dots',
  'grid',
  'lines',
  'stripes',
  'diagonal',
  'paper',
  'waves',
  'squares',
  'polka',
  'topo',
];

/**
 * T3 - 模板数据完整性（22 种精选模板）
 * PRD 要求：阶段②「一键排版」提供 22 种模板样式，默认第一个为「轻感明快」，
 * 每种模板需具备独立字体栈/配色/背景纹理/加粗处理/标题装饰。
 */
describe('templates 数据完整性', () => {
  it('应包含 21 种模板', () => {
    expect(templates).toHaveLength(21);
  });

  it('第一个模板是默认模板「轻感明快」', () => {
    expect(templates[0].name).toBe('轻感明快');
    expect(templates[0].id).toBe('qinggan-mingkuai');
  });

  it('21 个模板名单与产品声明一致', () => {
    const names = templates.map((t) => t.name);
    expect(names).toEqual([
      '轻感明快',
      '素雅底纹',
      '线条复古',
      '灵感备忘',
      '手帐书写',
      '时尚编辑',
      '简约基础',
      '清晰明朗',
      '科学图示',
      '理性现代',
      '瑞士刻板',
      '逻辑结构',
      '文艺清新',
      '札记集尘',
      '杂志先锋',
      '大图纯享',
      '国际主义',
      '黑白极简',
      '平实叙事',
      '交叉拓扑',
      '苹果备忘录',
    ]);
  });

  it('平台拟态模板使用更大的正文基准字号', () => {
    const tpl = templates.find((item) => item.id === 'apple-notes');
    expect(tpl).toBeDefined();
    expect(tpl?.category).toBe('平台拟态');
    expect(tpl?.baseFontSize).toBeGreaterThanOrEqual(18);
    expect(tpl?.fontSize).toBeGreaterThanOrEqual(18);
    expect(tpl?.contentInsets?.top).toBeGreaterThan(0);
    expect(tpl?.contentInsets?.bottom).toBeGreaterThan(0);
  });

  it('包含时尚、科学、瑞士刻板与国际主义四类精选设计', () => {
    const names = new Set(templates.map((t) => t.name));
    for (const name of ['时尚编辑', '科学图示', '瑞士刻板', '国际主义']) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('每个模板的 id 唯一', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(templates.map((t) => [t.id, t] as const))(
    '模板 %s 字段齐全且类型正确',
    (_id, tpl) => {
      // 字符串字段非空
      for (const key of [
        'id',
        'name',
        'category',
        'description',
        'themeClass',
        'fontFamily',
        'textColor',
        'bgColor',
        'accentColor',
        'mutedColor',
        'boldColor',
        'coverBgColor',
        'headingAlign',
        'decorativeStyle',
        'boldStyle',
        'titleDecoration',
        'backgroundPattern',
      ] as const) {
        expect(typeof tpl[key], `${tpl.id}.${key} 应为 string`).toBe('string');
        expect(tpl[key].length, `${tpl.id}.${key} 不应为空`).toBeGreaterThan(0);
      }
      // 数值字段在合理区间
      expect(tpl.fontSize).toBeGreaterThanOrEqual(12);
      expect(tpl.fontSize).toBeLessThanOrEqual(24);
      expect(tpl.lineHeight).toBeGreaterThanOrEqual(1.2);
      expect(tpl.lineHeight).toBeLessThanOrEqual(2.5);
      expect(tpl.baseFontSize).toBeGreaterThanOrEqual(12);
      expect(tpl.baseFontSize).toBeLessThanOrEqual(24);
      expect(tpl.headingFontWeight).toBeGreaterThanOrEqual(100);
      expect(tpl.headingFontWeight).toBeLessThanOrEqual(900);
      expect(tpl.cardRadius).toBeGreaterThanOrEqual(0);
      expect(tpl.padding).toBeGreaterThan(0);
      expect(typeof tpl.letterSpacing).toBe('number');
      // 枚举字段取值合法
      expect(['left', 'center']).toContain(tpl.headingAlign);
      expect([
        'none',
        'underline',
        'sidebar',
        'block',
        'corner',
        'dotted',
        'gradient',
      ]).toContain(tpl.decorativeStyle);
      expect(BOLD_STYLES).toContain(tpl.boldStyle);
      expect(TITLE_DECORATIONS).toContain(tpl.titleDecoration);
      expect(BACKGROUND_PATTERNS).toContain(tpl.backgroundPattern);
      // 颜色必须是合法 hex
      for (const key of [
        'textColor',
        'bgColor',
        'accentColor',
        'mutedColor',
        'boldColor',
        'coverBgColor',
      ] as const) {
        expect(tpl[key], `${tpl.id}.${key} 应为 hex 颜色`).toMatch(
          /^#[0-9A-Fa-f]{6}$/
        );
      }
      // themeClass 必须遵循 template-<id> 约定
      expect(tpl.themeClass).toBe(`template-${tpl.id}`);
    }
  );

  it('默认模板 qinggan-mingkuai 存在（store 默认值必须可解析）', () => {
    expect(templates.find((t) => t.id === 'qinggan-mingkuai')).toBeDefined();
  });

  it('「轻感明快」加粗 = 淡蓝色高亮背景（原版实测）', () => {
    const tpl = templates[0];
    expect(tpl.boldStyle).toBe('highlight');
    expect(tpl.boldColor.toLowerCase()).toBe('#dcebff');
  });

  it('22 种模板的加粗处理至少覆盖 5 种不同方式', () => {
    const distinct = new Set(templates.map((t) => t.boldStyle));
    expect(distinct.size).toBeGreaterThanOrEqual(5);
  });

  it('22 种模板的标题装饰至少覆盖 6 种不同方式', () => {
    const distinct = new Set(templates.map((t) => t.titleDecoration));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });

  it('22 种模板的背景纹理至少覆盖 6 种不同方式', () => {
    const distinct = new Set(templates.map((t) => t.backgroundPattern));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });

  it('模板覆盖基础 + 进阶两类', () => {
    const cats = new Set(templates.map((t) => t.category));
    expect(cats.has('基础风格')).toBe(true);
    expect(cats.has('进阶风格')).toBe(true);
    // 分类声明与数据一致
    for (const c of templateCategories) {
      expect(cats.has(c), `分类 ${c} 应存在数据`).toBe(true);
    }
  });

  it('字体栈引用 Google Fonts 免费字体（不引用小红书私有 CDN）', () => {
    for (const tpl of templates) {
      expect(tpl.fontFamily).toMatch(/Noto Sans SC|Noto Serif SC|LXGW WenKai/);
      expect(tpl.fontFamily).not.toContain('https://');
    }
  });
});

/**
 * T4 - 推荐标签
 * PRD 要求：阶段③发布页展示推荐话题标签，可点击加入。
 */
describe('recommendedTags 推荐标签', () => {
  it('数组非空', () => {
    expect(Array.isArray(recommendedTags)).toBe(true);
    expect(recommendedTags.length).toBeGreaterThan(0);
  });

  it('TopicTags 折叠态展示前 5 个，因此至少需要 5 个标签', () => {
    expect(recommendedTags.length).toBeGreaterThanOrEqual(5);
  });

  it('每个标签 id 唯一、label 以 # 开头且非空', () => {
    const ids = recommendedTags.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const tag of recommendedTags) {
      expect(typeof tag.id).toBe('string');
      expect(tag.id.length).toBeGreaterThan(0);
      expect(tag.label.startsWith('#'), `${tag.label} 应以 # 开头`).toBe(true);
      expect(tag.label.length).toBeGreaterThan(1);
      if (tag.hot !== undefined) {
        expect(typeof tag.hot).toBe('boolean');
      }
    }
  });
});

describe('封面色与表情数据', () => {
  it('coverColors 含 white/black/beige 三色且 hex 合法', () => {
    const ids = coverColors.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['white', 'black', 'beige']));
    for (const c of coverColors) {
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('表情面板数据非空', () => {
    expect(xhsEmojis.length).toBeGreaterThan(0);
    expect(systemEmojis.length).toBeGreaterThan(0);
  });
});
