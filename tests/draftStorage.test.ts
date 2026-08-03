import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { useArticleStore } from '../src/stores/useArticleStore';
import {
  DRAFTS_KEY,
  CURRENT_DRAFT_KEY,
  LEGACY_KEY,
  createDraftRecord,
  draftTitleOf,
  loadDrafts,
  loadCurrentDraftId,
  mostRecentDraft,
  migrateLegacyToDrafts,
  normalizeArticle,
  removeDraft,
  saveCurrentDraftId,
  saveDrafts,
  upsertDraft,
  generateDraftId,
} from '../src/utils/draftStorage';
import type { DraftRecord } from '../src/utils/draftStorage';
import type { ArticleData } from '../src/types';

const sampleArticle = (overrides: Partial<ArticleData> = {}): ArticleData =>
  normalizeArticle({
    title: '测试标题',
    content: 'doc',
    contentHtml: '<p>正文</p>',
    wordCount: 2,
    ...overrides,
  });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('draftStorage 纯函数', () => {
  it('createDraftRecord 生成唯一 id 与标题', () => {
    const a = createDraftRecord(sampleArticle(), 1000);
    const b = createDraftRecord(sampleArticle(), 2000);
    expect(a.id).not.toBe(b.id);
    expect(generateDraftId()).not.toBe(generateDraftId());
    expect(a.title).toBe('测试标题');
    expect(a.updatedAt).toBe(1000);
    expect(draftTitleOf(normalizeArticle({}))).toBe('未命名长文');
  });

  it('upsertDraft 新增 / 覆盖', () => {
    const rec = createDraftRecord(sampleArticle(), 1);
    const one = upsertDraft([], rec);
    expect(one).toHaveLength(1);
    const updated = upsertDraft(one, { ...rec, title: '新标题' });
    expect(updated).toHaveLength(1);
    expect(updated[0].title).toBe('新标题');
  });

  it('removeDraft 按 id 删除', () => {
    const rec = createDraftRecord(sampleArticle(), 1);
    expect(removeDraft([rec], rec.id)).toHaveLength(0);
    expect(removeDraft([rec], 'nope')).toHaveLength(1);
  });

  it('mostRecentDraft 取 updatedAt 最大者', () => {
    const old = createDraftRecord(sampleArticle(), 100);
    const latest = createDraftRecord(sampleArticle({ title: '新' }), 999);
    expect(mostRecentDraft([old, latest])!.id).toBe(latest.id);
    expect(mostRecentDraft([])).toBeNull();
  });

  it('normalizeArticle 补齐缺失字段并守卫 selectedSize', () => {
    const article = normalizeArticle({ title: 'T' });
    expect(article.selectedTemplate).toBe('qinggan-mingkuai');
    expect(article.selectedSize.width).toBe(900);
    expect(article.tags).toEqual([]);
    // 旧数据（无 selectedSize）不崩溃
    const legacy = normalizeArticle({ title: '旧', selectedSize: undefined });
    expect(legacy.selectedSize.height).toBe(1500);
  });

  it('saveDrafts / loadDrafts 往返', () => {
    const rec = createDraftRecord(sampleArticle(), 42);
    saveDrafts([rec]);
    saveCurrentDraftId(rec.id);
    const loaded = loadDrafts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].article.title).toBe('测试标题');
    expect(loadCurrentDraftId()).toBe(rec.id);
  });

  it('migrateLegacyToDrafts 把旧单篇草稿升级为 v2 第一篇', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(sampleArticle({ title: '旧稿' })));
    const result = migrateLegacyToDrafts();
    expect(result).not.toBeNull();
    expect(result!.drafts).toHaveLength(1);
    expect(result!.drafts[0].article.title).toBe('旧稿');
    expect(result!.currentId).toBe(result!.drafts[0].id);
  });

  it('无 legacy 数据时 migrateLegacyToDrafts 返回 null', () => {
    expect(migrateLegacyToDrafts()).toBeNull();
  });
});

describe('useArticleStore 草稿列表（P1-3）', () => {
  it('首次打开自动创建一篇空草稿并作为当前草稿', () => {
    const { result } = renderHook(() => useArticleStore());
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.currentDraftId).toBe(result.current.drafts[0].id);
    expect(result.current.article.title).toBe('');
    // 已持久化 v2
    expect(loadDrafts()).toHaveLength(1);
    expect(loadCurrentDraftId()).toBe(result.current.currentDraftId);
  });

  it('createDraft 新增草稿并切换为空文章', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.updateTitle('第一稿'));
    const firstId = result.current.currentDraftId;

    act(() => result.current.createDraft());
    expect(result.current.drafts).toHaveLength(2);
    expect(result.current.currentDraftId).not.toBe(firstId);
    expect(result.current.article.title).toBe('');
    expect(loadDrafts()).toHaveLength(2);
  });

  it('自动保存把内容写入当前草稿记录（v2）并镜像 legacy key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9, 5, 0));
    const { result } = renderHook(() => useArticleStore());
    const draftId = result.current.currentDraftId;

    act(() => result.current.updateContent('doc', '<p>草稿正文</p>'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // v2 当前草稿已更新
    const saved = loadDrafts().find((d) => d.id === draftId)!;
    expect(saved.article.contentHtml).toBe('<p>草稿正文</p>');
    expect(saved.article.lastSavedAt).toBe('09:05');
    expect(saved.title).toBe('未命名长文');
    // legacy 镜像同步
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) as string);
    expect(legacy.contentHtml).toBe('<p>草稿正文</p>');
  });

  it('switchDraft 恢复对应草稿内容', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.updateTitle('草稿A'));
    const idA = result.current.currentDraftId;

    act(() => result.current.createDraft());
    act(() => result.current.updateTitle('草稿B'));

    act(() => result.current.switchDraft(idA));
    expect(result.current.article.title).toBe('草稿A');
    expect(result.current.currentDraftId).toBe(idA);
  });

  it('删除当前草稿回退到最近更新的草稿', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.updateTitle('第一篇'));
    const idA = result.current.currentDraftId;

    act(() => result.current.createDraft());
    act(() => result.current.updateTitle('第二篇'));
    const idB = result.current.currentDraftId;

    act(() => result.current.deleteDraft(idB));
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.currentDraftId).toBe(idA);
    expect(result.current.article.title).toBe('第一篇');
    expect(loadDrafts()).toHaveLength(1);
  });

  it('删除最后一篇草稿自动新建空草稿', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.updateTitle('唯一草稿'));
    const id = result.current.currentDraftId;

    act(() => result.current.deleteDraft(id));
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.drafts[0].id).not.toBe(id);
    expect(result.current.article.title).toBe('');
  });

  it('重新打开恢复最近编辑的草稿（currentDraftId 优先）', () => {
    const { result: first } = renderHook(() => useArticleStore());
    act(() => first.current.updateTitle('最近草稿'));
    const id = first.current.currentDraftId;

    // 模拟“重新打开”：第二个 store 实例从 localStorage 恢复
    const { result: second } = renderHook(() => useArticleStore());
    expect(second.current.currentDraftId).toBe(id);
    expect(second.current.article.title).toBe('最近草稿');
  });

  it('legacy 单篇草稿迁移为 v2 第一篇', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(sampleArticle({ title: '旧稿恢复' })));
    const { result } = renderHook(() => useArticleStore());
    expect(result.current.article.title).toBe('旧稿恢复');
    expect(result.current.drafts).toHaveLength(1);
    expect(loadDrafts()).toHaveLength(1);
  });

  it('clearDraft 清空 legacy 并删除当前草稿，保留其他草稿', () => {
    const { result } = renderHook(() => useArticleStore());
    act(() => result.current.updateTitle('待清空'));
    act(() => result.current.createDraft());
    act(() => result.current.updateTitle('保留的草稿'));

    act(() => result.current.clearDraft());
    // 当前草稿（保留的草稿）被发布清空，回退到剩余草稿
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.drafts[0].title).toBe('待清空');
    expect(result.current.article.title).toBe('待清空');
    expect(result.current.currentDraftId).toBe(result.current.drafts[0].id);
  });
});

/** 防止未使用的类型引用报错（类型仅用于测试意图声明） */
export type { DraftRecord };
