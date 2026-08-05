import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { useArticleStore } from '../src/stores/useArticleStore';

const STORAGE_KEY = 'xhs-long-article-draft';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * T2 - 正文字数统计
 * 规则（useArticleStore.updateContent）：剥离 HTML 标签后，
 * 中文字符数 + 英文单词数 = wordCount
 */
describe('useArticleStore 字数统计', () => {
  it('初始 wordCount 为 0', () => {
    const { result } = renderHook(() => useArticleStore());
    expect(result.current.article.wordCount).toBe(0);
  });

  it('纯中文正文按字符计数（HTML 标签不计入）', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => {
      result.current.updateContent('doc', '<p>你好世界</p>');
    });
    expect(result.current.article.wordCount).toBe(4);
  });

  it('中英混排：中文按字 + 英文按词', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => {
      result.current.updateContent('doc', '<p>你好世界 hello world</p>');
    });
    // 你好世界 = 4 字，hello / world = 2 词
    expect(result.current.article.wordCount).toBe(6);
  });

  it('多段落 + 富文本标签不影响统计', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => {
      result.current.updateContent(
        'doc',
        '<h1>标题</h1><p><strong>加粗</strong>内容</p><ul><li>列表项</li></ul>'
      );
    });
    // 标题(2) + 加粗(2) + 内容(2) + 列表项(3) = 9
    expect(result.current.article.wordCount).toBe(9);
  });

  it('空正文回到 0', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => {
      result.current.updateContent('doc', '<p>测试</p>');
    });
    expect(result.current.article.wordCount).toBe(2);
    act(() => {
      result.current.updateContent('doc', '<p></p>');
    });
    expect(result.current.article.wordCount).toBe(0);
  });

  it('contentHtml 与 content 均被写入 store（供阶段②预览使用）', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => {
      result.current.updateContent('{"type":"doc"}', '<p>预览内容</p>');
    });
    expect(result.current.article.content).toBe('{"type":"doc"}');
    expect(result.current.article.contentHtml).toBe('<p>预览内容</p>');
  });
});

/**
 * T5 - 状态流转 / 自动保存标记
 */
describe('useArticleStore 自动保存与状态流转', () => {
  it('内容变化 3 秒后写入 lastSavedAt 并落盘 localStorage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9, 5, 0));

    const { result } = renderHook(() => useArticleStore());
    expect(result.current.article.lastSavedAt).toBeNull();

    act(() => {
      result.current.updateContent('doc', '<p>自动保存测试</p>');
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.article.lastSavedAt).toBe('09:05');

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw as string);
    expect(saved.contentHtml).toBe('<p>自动保存测试</p>');
    expect(saved.wordCount).toBe(6);
  });

  it('标题变化同样触发自动保存', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 22, 30, 0));

    const { result } = renderHook(() => useArticleStore());
    act(() => {
      result.current.updateTitle('我的第一篇长文');
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.article.lastSavedAt).toBe('22:30');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(saved.title).toBe('我的第一篇长文');
  });

  it('三阶段导航 editor → format → publish → editor 可正常流转', () => {
    const { result } = renderHook(() => useArticleStore());
    expect(result.current.stage).toBe('editor');

    act(() => result.current.goToStage('format'));
    expect(result.current.stage).toBe('format');

    act(() => result.current.goToStage('publish'));
    expect(result.current.stage).toBe('publish');

    act(() => result.current.goToStage('editor'));
    expect(result.current.stage).toBe('editor');
  });

  it('模板选择 / 封面色 / 原创声明 / 描述 / 标签 状态可正确更新', () => {
    const { result } = renderHook(() => useArticleStore());

    act(() => result.current.selectTemplate('shouzhang-shuxie'));
    expect(result.current.article.selectedTemplate).toBe('shouzhang-shuxie');

    act(() => result.current.setCoverColor('beige'));
    expect(result.current.article.coverColor).toBe('beige');

    act(() => result.current.toggleOriginal());
    expect(result.current.article.isOriginal).toBe(true);

    act(() => result.current.updateDescription('这是正文描述'));
    expect(result.current.article.description).toBe('这是正文描述');

    act(() => result.current.addTag('#生活美学'));
    act(() => result.current.addTag('#生活美学')); // 去重
    expect(result.current.article.tags).toEqual(['#生活美学']);

    act(() => result.current.removeTag('#生活美学'));
    expect(result.current.article.tags).toEqual([]);
  });

  it('修改宽度后进入自定义尺寸，并保持当前宽高比', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.selectSizePreset('square'));
    act(() => result.current.setCustomWidth(600));
    expect(result.current.article.selectedSize).toEqual({
      presetId: 'custom',
      width: 600,
      height: 600,
    });
  });

  it('修改高度后进入自定义尺寸，不再错误标记为预设比例', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.setCustomHeight(1200));
    expect(result.current.article.selectedSize).toEqual({
      presetId: 'custom',
      width: 900,
      height: 1200,
    });
  });

  it('草稿可从 localStorage 恢复', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title: '恢复的标题', wordCount: 42 })
    );
    const { result } = renderHook(() => useArticleStore());
    expect(result.current.article.title).toBe('恢复的标题');
    expect(result.current.article.wordCount).toBe(42);
    // 缺失字段回落到默认值
    expect(result.current.article.selectedTemplate).toBe('qinggan-mingkuai');
  });

  it('clearDraft 清空数据并移除本地存储', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.updateTitle('待清空'));
    act(() => result.current.clearDraft());
    expect(result.current.article.title).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  /**
   * 回归用例：自动保存定时器闭包捕获的是「上一次 title/content 变更时」的 article 快照。
   * 若在 3 秒窗口内修改了不在 deps 中的字段（模板/描述/标签/封面色），
   * 定时器触发时会用旧快照整体覆盖 state，导致用户操作被静默回滚。
   */
  it('自动保存窗口期内选择模板，模板不应被回滚', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useArticleStore());

    act(() => {
      result.current.updateContent('doc', '<p>正文</p>');
    });
    // 1 秒后（仍在 3s 自动保存窗口内）用户进入阶段②选择模板
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.selectTemplate('shouzhang-shuxie'));
    expect(result.current.article.selectedTemplate).toBe('shouzhang-shuxie');

    // 自动保存定时器触发
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.article.selectedTemplate).toBe('shouzhang-shuxie');
  });

  it('自动保存窗口期内输入描述，描述不应被回滚', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useArticleStore());

    act(() => {
      result.current.updateContent('doc', '<p>正文</p>');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.updateDescription('发布页描述'));
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.article.description).toBe('发布页描述');
  });
});
