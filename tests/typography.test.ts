// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  normalizeCardEditHtml,
  resolveCardBodyFontSize,
  resolveCardFontSize,
  resolveCardPadding,
  resolveCoverTitleFontSize,
} from '../src/utils/typography';

describe('图片排版字号映射', () => {
  it('默认 16px 正文在导出图片中提升到手机可读尺寸', () => {
    const base = resolveCardBodyFontSize(16);
    expect(base).toBe(36);
    expect(resolveCardFontSize(undefined, base)).toBe(36);
  });

  it('保留编辑器 12–24px 的相对字号关系', () => {
    const base = resolveCardBodyFontSize(16);
    expect(resolveCardFontSize(12, base)).toBe(27);
    expect(resolveCardFontSize(16, base)).toBe(36);
    expect(resolveCardFontSize(24, base)).toBe(54);
  });

  it('加大图片内留白，避免正文贴边', () => {
    expect(resolveCardPadding(40)).toBe(60);
  });
});

describe('封面标题层级', () => {
  it('短标题更醒目，长标题自动收敛', () => {
    const shortTitle = resolveCoverTitleFontSize(16, '爆款封面指南');
    const longTitle = resolveCoverTitleFontSize(
      16,
      '这是一段非常长的封面标题需要自动缩小避免超出安全区域影响阅读'
    );
    expect(shortTitle).toBeGreaterThanOrEqual(100);
    expect(longTitle).toBeLessThan(shortTitle);
    expect(longTitle).toBeGreaterThanOrEqual(62);
  });
});

describe('排版后编辑字号回写', () => {
  it('把图片字号还原为编辑器字号，避免重复放大', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<p data-block-id="b0"><span style="font-size:54px" data-editor-font-size="24">大字</span></p>';
    const html = normalizeCardEditHtml(root);
    expect(html).toContain('font-size: 24px');
    expect(html).not.toContain('data-editor-font-size');
  });
});
