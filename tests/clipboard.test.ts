import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  decodeHtmlEntities,
  extractPlainText,
  formatArticlePlainText,
  copyTextToClipboard,
} from '../src/utils/clipboard';

const originalClipboard = (navigator as { clipboard?: unknown }).clipboard;
const originalIsSecureContext = (window as { isSecureContext?: unknown }).isSecureContext;

beforeEach(() => {
  // Restore the real jsdom defaults before each test.
  Object.defineProperty(window, 'isSecureContext', {
    value: false,
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'isSecureContext', {
    value: originalIsSecureContext,
    configurable: true,
  });
  if (originalClipboard !== undefined) {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  }
});

describe('extractPlainText（去 HTML 标签）', () => {
  it('段落之间换行', () => {
    expect(extractPlainText('<p>第一段</p><p>第二段</p>')).toBe('第一段\n第二段');
  });

  it('标题/列表/引用/分割线都产生换行', () => {
    const html =
      '<h1>大标题</h1><p>正文</p><ul><li>条目一</li><li>条目二</li></ul><blockquote>引用</blockquote><hr /><p>结尾</p>';
    expect(extractPlainText(html)).toBe(
      '大标题\n正文\n条目一\n条目二\n引用\n\n结尾'
    );
  });

  it('解码 HTML 实体（&amp; &nbsp; 数字实体）', () => {
    expect(extractPlainText('<p>a&amp;b&nbsp;c&#65;</p>')).toBe('a&b cA');
  });

  it('移除内联标签但保留文本', () => {
    expect(extractPlainText('<p><strong>加粗</strong>和<em>斜体</em></p>')).toBe(
      '加粗和斜体'
    );
  });

  it('空内容返回空字符串', () => {
    expect(extractPlainText('')).toBe('');
    expect(extractPlainText('<p></p>')).toBe('');
  });

  it('decodeHtmlEntities 单独可用', () => {
    expect(decodeHtmlEntities('&lt;div&gt;&quot;q&quot;&#39;s&#39;')).toBe(
      '<div>"q"\'s\''
    );
  });
});

describe('formatArticlePlainText', () => {
  it('标题 + 空行 + 正文', () => {
    expect(
      formatArticlePlainText({ title: '我的标题', contentHtml: '<p>正文内容</p>' })
    ).toBe('我的标题\n\n正文内容');
  });

  it('无正文时只返回标题', () => {
    expect(formatArticlePlainText({ title: '只有标题', contentHtml: '' })).toBe('只有标题');
  });

  it('空标题回退为未命名长文', () => {
    expect(formatArticlePlainText({ title: '  ', contentHtml: '<p>x</p>' })).toBe(
      '未命名长文\n\nx'
    );
  });
});

describe('copyTextToClipboard', () => {
  /** jsdom 不实现 execCommand，测试里手动注入 */
  const mockExecCommand = (result: boolean): ReturnType<typeof vi.fn> => {
    const mock = vi.fn().mockReturnValue(result);
    Object.defineProperty(document, 'execCommand', {
      value: mock,
      configurable: true,
    });
    return mock;
  };

  it('优先使用 navigator.clipboard.writeText（安全上下文）', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    await copyTextToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('clipboard 不可用时回退 execCommand（隐藏 textarea）', async () => {
    const execMock = mockExecCommand(true);
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await copyTextToClipboard('回退复制');

    expect(execMock).toHaveBeenCalledWith('copy');
    // 隐藏 textarea 被创建并移除
    const added = appendSpy.mock.calls[0][0] as HTMLTextAreaElement;
    expect(added.tagName).toBe('TEXTAREA');
    expect(added.value).toBe('回退复制');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('execCommand 返回 false 时抛错', async () => {
    mockExecCommand(false);
    await expect(copyTextToClipboard('x')).rejects.toThrow('复制失败');
  });

  it('clipboard.writeText 抛错时走回退路径', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const execMock = mockExecCommand(true);

    await copyTextToClipboard('兜底');
    expect(execMock).toHaveBeenCalledWith('copy');
  });
});
