import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { LongArticleEditor } from '../src/components/editor/LongArticleEditor';

afterEach(cleanup);

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterAll(() => vi.unstubAllGlobals());

const FILLED_DOC = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '上一份草稿正文' }],
    },
  ],
});

describe('LongArticleEditor 外部草稿同步', () => {
  it('切换到空草稿时清空上一份草稿正文', async () => {
    const view = render(
      <LongArticleEditor
        title="旧草稿"
        content={FILLED_DOC}
        onTitleChange={vi.fn()}
        onContentChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.container.querySelector('.ProseMirror')?.textContent).toContain('上一份草稿正文');
    });

    view.rerender(
      <LongArticleEditor
        title=""
        content=""
        onTitleChange={vi.fn()}
        onContentChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.container.querySelector('.ProseMirror')?.textContent).toBe('');
    });
  });
});
