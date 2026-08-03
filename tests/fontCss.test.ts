import { describe, it, expect } from 'vitest';
import {
  ALWAYS_INCLUDE_CHARS,
  parseUnicodeRange,
  parseFontFaceCss,
  ruleIntersectsCode,
  ruleIsNeeded,
  collectUsedChars,
  buildFontEmbedCss,
} from '../src/utils/fontCss';

const SAMPLE_CSS = `
/* latin */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosanssc/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* chinese-simplified: U+4E00-4E5F */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosanssc/4e00.woff2) format('woff2');
  unicode-range: U+4E00-4E5F;
}
/* chinese-simplified: U+4E60-4EBF */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosanssc/4e60.woff2) format('woff2');
  unicode-range: U+4E60-4EBF;
}
/* wildcard form used by some families */
@font-face {
  font-family: 'LXGW WenKai';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/lxgw/wild.woff2) format('woff2');
  unicode-range: U+30??;
}
/* an unrelated family must be ignored */
@font-face {
  font-family: 'Comic Sans MS';
  font-style: normal;
  font-weight: 400;
  src: url(https://example.com/comic.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

describe('parseUnicodeRange', () => {
  it('解析单个码点', () => {
    expect(parseUnicodeRange('U+00A0')).toEqual([{ start: 0x00a0, end: 0x00a0 }]);
  });

  it('解析范围', () => {
    expect(parseUnicodeRange('U+4E00-4E5F')).toEqual([{ start: 0x4e00, end: 0x4e5f }]);
  });

  it('解析通配符 U+30?? → U+3000-U+30FF', () => {
    expect(parseUnicodeRange('U+30??')).toEqual([{ start: 0x3000, end: 0x30ff }]);
  });

  it('解析逗号分隔的多段', () => {
    const ranges = parseUnicodeRange('U+0000-00FF, U+0131, U+30??');
    expect(ranges).toContainEqual({ start: 0x0000, end: 0x00ff });
    expect(ranges).toContainEqual({ start: 0x0131, end: 0x0131 });
    expect(ranges).toContainEqual({ start: 0x3000, end: 0x30ff });
  });
});

describe('parseFontFaceCss', () => {
  it('解析出 @font-face 规则并保留家族/字重/unicode-range/URL', () => {
    const rules = parseFontFaceCss(SAMPLE_CSS);
    expect(rules).toHaveLength(5);

    const notoSans400 = rules.find((r) => r.url.includes('latin.woff2'));
    expect(notoSans400).toBeDefined();
    expect(notoSans400!.family).toBe('Noto Sans SC');
    expect(notoSans400!.weight).toBe('400');
    expect(notoSans400!.unicodeRangeRaw).toContain('U+0000-00FF');
    expect(notoSans400!.ranges).toContainEqual({ start: 0x0000, end: 0x00ff });

    const lxgw = rules.find((r) => r.family === 'LXGW WenKai');
    expect(lxgw!.ranges).toContainEqual({ start: 0x3000, end: 0x30ff });
  });

  it('忽略没有 src 或非 http 的规则', () => {
    const css = `@font-face { font-family: 'X'; src: url(/local.woff2); }
                 @font-face { font-family: 'Y'; font-style: normal; font-weight: 400; }`;
    expect(parseFontFaceCss(css)).toHaveLength(0);
  });
});

describe('ruleIsNeeded / collectUsedChars', () => {
  const rules = parseFontFaceCss(SAMPLE_CSS);

  it('latin 子集恒被包含（页码/数字/标点不能回退系统字体）', () => {
    const latin = rules.find((r) => r.url.includes('latin.woff2'))!;
    // 纯中文文章（无 ASCII）也必须包含 latin
    const used = collectUsedChars('你好世界');
    expect(ruleIsNeeded(latin, used)).toBe(true);
  });

  it('按用字命中对应 CJK 子集', () => {
    const used = collectUsedChars('一'); // U+4E00
    const subset4e00 = rules.find((r) => r.url.includes('4e00.woff2'))!;
    const subset4e60 = rules.find((r) => r.url.includes('4e60.woff2'))!;
    expect(ruleIsNeeded(subset4e00, used)).toBe(true);
    expect(ruleIsNeeded(subset4e60, used)).toBe(false);
  });

  it('collectUsedChars 固定包含 ASCII+latin 范围与装饰字符', () => {
    const used = collectUsedChars('');
    expect(used.has(0x21)).toBe(true); // '!'
    expect(used.has(0x30)).toBe(true); // '0'
    expect(used.has(0x2190)).toBe(true); // '←' (ALWAYS_INCLUDE_CHARS)
    for (const ch of ALWAYS_INCLUDE_CHARS) {
      expect(used.has(ch.codePointAt(0)!)).toBe(true);
    }
  });

  it('ruleIntersectsCode 精确判定', () => {
    const subset4e00 = rules.find((r) => r.url.includes('4e00.woff2'))!;
    expect(ruleIntersectsCode(subset4e00, 0x4e00)).toBe(true);
    expect(ruleIntersectsCode(subset4e00, 0x4e5f)).toBe(true);
    expect(ruleIntersectsCode(subset4e00, 0x4e60)).toBe(false);
  });
});

describe('buildFontEmbedCss', () => {
  const toBase64 = async (url: string): Promise<string> => {
    const file = url.split('/').pop() ?? 'unknown';
    return `data:font/woff2;base64,${file}`;
  };

  it('只内联需要的子集，输出 base64 @font-face，忽略无关字体', async () => {
    const used = collectUsedChars('一'); // latin + U+4E00
    const css = await buildFontEmbedCss(SAMPLE_CSS, used, toBase64);

    expect(css).toContain('latin.woff2');
    expect(css).toContain('4e00.woff2');
    expect(css).not.toContain('4e60.woff2'); // 未使用字
    expect(css).not.toContain('comic.woff2'); // 无关字体族
    expect(css).toContain('url(data:font/woff2;base64,4e00.woff2) format(\'woff2\')');
    expect(css).toContain('font-family:Noto Sans SC');
    expect(css).toContain('unicode-range:U+4E00-4E5F');
  });

  it('全部下载失败时抛错（调用方据此回退系统字体）', async () => {
    const used = collectUsedChars('一');
    await expect(
      buildFontEmbedCss(SAMPLE_CSS, used, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('所有字体子集均下载失败');
  });
});
