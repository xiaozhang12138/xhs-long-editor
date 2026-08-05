import { describe, expect, it } from 'vitest';
import { buildCoverVisualData } from '../src/utils/coverVisual';

describe('零成本关键词封面视觉', () => {
  it('优先从标题提取短关键词', () => {
    const result = buildCoverVisualData('科学护肤 入门指南', '<p>正文内容</p>');
    expect(result.keywords.slice(0, 2)).toEqual(['科学护肤', '入门指南']);
  });

  it('相同文章稳定生成相同视觉变体', () => {
    const first = buildCoverVisualData('国际主义设计', '<p>网格与秩序</p>');
    const second = buildCoverVisualData('国际主义设计', '<p>网格与秩序</p>');
    expect(second).toEqual(first);
    expect(first.variant).toBeGreaterThanOrEqual(0);
    expect(first.variant).toBeLessThan(4);
  });

  it('空文章也有默认关键词', () => {
    expect(buildCoverVisualData('', '').keywords).toEqual(['灵感', '记录']);
  });
});
