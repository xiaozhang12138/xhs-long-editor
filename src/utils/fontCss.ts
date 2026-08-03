/**
 * Google Fonts → base64 `@font-face` CSS builder.
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 * html-to-image clones the target DOM, serializes it into an <svg> and
 * rasterizes it via an <img>. An SVG loaded as an image cannot fetch remote
 * resources, so every font must be embedded as a `data:` URL inside a
 * <style> block. html-to-image tries to build that CSS itself by reading
 * `document.styleSheets[i].cssRules` — but Google Fonts CSS is cross-origin,
 * so that read throws `SecurityError` (the console error seen in QA), the
 * remote font is silently dropped, and the exported PNG falls back to system
 * fonts.
 *
 * The fix: build the embed CSS OURSELVES (fetch the CSS as text — allowed by
 * CORS — parse the `@font-face` rules, fetch only the subsets that cover the
 * characters actually used, base64-encode them) and hand it to html-to-image
 * via the `fontEmbedCSS` option. html-to-image's `embedWebFonts` uses that
 * string directly and never touches `cssRules`, so the SecurityError never
 * happens and the exported text uses the correct Noto Sans SC / Noto Serif SC
 * / LXGW WenKai glyphs.
 *
 * ── Size control ────────────────────────────────────────────────────────
 * Google splits CJK fonts into ~119 `unicode-range` subsets. Fetching all of
 * them would download tens of MB. We therefore only fetch subsets whose range
 * intersects the characters in the article text (plus latin/latin-ext, which
 * is always included for digits / punctuation / the page badges).
 *
 * Every fetched base64 blob is cached in a module-level Map, so re-exporting
 * the same or a similar article costs almost nothing.
 */
import type { ArticleData } from '../types';

export interface UnicodeRange {
  start: number;
  end: number;
}

/** A single parsed `@font-face` rule from the Google Fonts stylesheet. */
export interface FontFaceRule {
  family: string;
  style: string;
  weight: string;
  /** Raw `unicode-range` declaration, preserved for the output CSS. */
  unicodeRangeRaw: string;
  ranges: UnicodeRange[];
  /** Absolute URL of the woff2 file. */
  url: string;
}

/** The three font families used by the 20 templates. */
export const FONT_FAMILIES = [
  'Noto Sans SC',
  'Noto Serif SC',
  'LXGW WenKai',
] as const;

/** The css2 URL used by index.html (explicit weights → static instances). */
export const GOOGLE_FONTS_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@400;600;700;900&family=LXGW+WenKai&display=swap';

/**
 * Characters rendered by the app that are not part of the editor text but must
 * still have their font subset included (template decorations, page badges,
 * cover hints, etc.).
 */
export const ALWAYS_INCLUDE_CHARS =
  '✎手帐札记❀《》「」#MAGAZINE FRAME←左滑阅读→01/';

/* ──────────────────────────────────────────────────────────────────────
 * unicode-range parsing
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Parse a CSS `unicode-range` declaration like
 * `U+4E00-4E5F, U+30??, U+00A0` into explicit {start,end} ranges.
 */
export function parseUnicodeRange(raw: string): UnicodeRange[] {
  const out: UnicodeRange[] = [];
  const re = /U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const a = match[1];
    const b = match[2];
    if (a.includes('?')) {
      // Wildcard form U+30?? → U+3000-U+30FF
      const questionIdx = a.indexOf('?');
      const prefix = a.slice(0, questionIdx);
      const wildcards = a.length - questionIdx;
      const start = parseInt(`${prefix}${'0'.repeat(wildcards)}`, 16);
      const end = parseInt(`${prefix}${'F'.repeat(wildcards)}`, 16);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        out.push({ start, end });
      }
    } else {
      const start = parseInt(a, 16);
      const end = b ? parseInt(b, 16) : start;
      if (Number.isFinite(start) && Number.isFinite(end)) {
        out.push({ start, end });
      }
    }
  }
  return out;
}

/** True when a code point falls inside any of the rule's ranges. */
export function ruleIntersectsCode(rule: FontFaceRule, code: number): boolean {
  return rule.ranges.some((r) => code >= r.start && code <= r.end);
}

/**
 * True when the rule covers at least one character in `codes`.
 * Latin/latin-ext (U+0000-00FF) is always considered "needed" because page
 * badges, digits and punctuation must never fall back to a system font.
 */
export function ruleIsNeeded(rule: FontFaceRule, codes: ReadonlySet<number>): boolean {
  for (const code of codes) {
    if (ruleIntersectsCode(rule, code)) return true;
  }
  // latin subset (digits / ASCII punctuation) is mandatory.
  if (rule.ranges.some((r) => r.start <= 0x00ff && r.end >= 0x0020)) {
    return true;
  }
  return false;
}

/* ──────────────────────────────────────────────────────────────────────
 * @font-face block parsing
 * ────────────────────────────────────────────────────────────────────── */

/** Split CSS text into top-level `@font-face { … }` blocks (comments stripped). */
function extractFontFaceBlocks(cssText: string): string[] {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: string[] = [];
  const re = /@font-face\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutComments)) !== null) {
    const start = match.index;
    const braceStart = withoutComments.indexOf('{', start);
    if (braceStart === -1) break;
    // find matching closing brace (no nesting inside @font-face)
    let depth = 1;
    let i = braceStart + 1;
    while (i < withoutComments.length && depth > 0) {
      if (withoutComments[i] === '{') depth += 1;
      else if (withoutComments[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth === 0) {
      blocks.push(withoutComments.slice(start, i));
    }
  }
  return blocks;
}

function extractProperty(block: string, name: string): string {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'i');
  const match = re.exec(block);
  return match ? match[1].trim() : '';
}

/** Parse a raw Google Fonts CSS text into structured font-face rules. */
export function parseFontFaceCss(cssText: string): FontFaceRule[] {
  const rules: FontFaceRule[] = [];
  for (const block of extractFontFaceBlocks(cssText)) {
    const family = extractProperty(block, 'font-family').replace(/['"]/g, '').trim();
    const style = extractProperty(block, 'font-style').trim() || 'normal';
    const weight = extractProperty(block, 'font-weight').trim() || '400';
    const unicodeRangeRaw = extractProperty(block, 'unicode-range');
    const urlMatch = /url\(\s*(['"]?)([^'")]+)\1\s*\)/i.exec(block);
    if (!family || !urlMatch) continue;
    const url = urlMatch[2].trim();
    if (!url.startsWith('http')) continue;
    rules.push({
      family,
      style,
      weight,
      unicodeRangeRaw,
      ranges: parseUnicodeRange(unicodeRangeRaw || 'U+0-10FFFF'),
      url,
    });
  }
  return rules;
}

/* ──────────────────────────────────────────────────────────────────────
 * Character collection
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Collect the code points of every character in the given texts, plus the
 * full latin range (U+0020-U+00FF) so digits / punctuation always have a
 * real font, plus the app-drawn decoration characters.
 */
export function collectUsedChars(...texts: string[]): Set<number> {
  const codes = new Set<number>();
  const addRange = (start: number, end: number): void => {
    for (let c = start; c <= end; c += 1) codes.add(c);
  };
  // ASCII + latin-1: digits, punctuation, currency symbols…
  addRange(0x0020, 0x00ff);
  for (const text of texts) {
    for (const ch of text ?? '') {
      codes.add(ch.codePointAt(0) ?? 0);
    }
  }
  for (const ch of ALWAYS_INCLUDE_CHARS) {
    codes.add(ch.codePointAt(0) ?? 0);
  }
  return codes;
}

/* ──────────────────────────────────────────────────────────────────────
 * Base64 helpers
 * ────────────────────────────────────────────────────────────────────── */

/** Module-level cache: font URL → `data:font/woff2;base64,…` string. */
const base64Cache = new Map<string, string>();

/** Fetch a font file and return it as a base64 data URL (cached). */
export async function fetchBase64DataUrl(url: string): Promise<string> {
  const cached = base64Cache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`字体下载失败（HTTP ${res.status}）: ${url}`);
  }
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const dataUrl = `data:font/woff2;base64,${btoa(binary)}`;
  base64Cache.set(url, dataUrl);
  return dataUrl;
}

/** Fetch a URL as plain text (CORS-readable). */
export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`样式表下载失败（HTTP ${res.status}）: ${url}`);
  }
  return res.text();
}

/* ──────────────────────────────────────────────────────────────────────
 * Orchestration
 * ────────────────────────────────────────────────────────────────────── */

/** Module-level cache for the raw Google Fonts CSS text (fetched once). */
let cssTextCache: string | null = null;

/** Cache of built embed CSS keyed by the source text. */
const embedCssCache = new Map<string, string>();

/**
 * Build the `fontEmbedCSS` string for html-to-image.
 *
 * @param text   Article text (title + body) used to pick the needed subsets.
 * @returns      A CSS string of `@font-face` rules with base64 data URLs.
 *               Returns '' when the font CSS cannot be fetched (offline etc.)
 *               so callers can still export with system-font fallback.
 */
export async function buildFontEmbedCss(
  cssText: string,
  usedCodes: ReadonlySet<number>,
  toBase64: (url: string) => Promise<string>
): Promise<string> {
  const rules = parseFontFaceCss(cssText);
  const needed = rules.filter(
    (r) => FONT_FAMILIES.includes(r.family as (typeof FONT_FAMILIES)[number]) && ruleIsNeeded(r, usedCodes)
  );

  const results: string[] = [];
  let failures = 0;
  // Fetch in small batches to stay polite to fonts.gstatic.com.
  for (let i = 0; i < needed.length; i += 8) {
    const batch = needed.slice(i, i + 8);
    const settled = await Promise.allSettled(
      batch.map(async (rule) => {
        const dataUrl = await toBase64(rule.url);
        const src = dataUrl.startsWith('data:')
          ? `url(${dataUrl}) format('woff2')`
          : `url(${dataUrl}) format('woff2')`;
        return (
          `@font-face{font-family:${rule.family};font-style:${rule.style};` +
          `font-weight:${rule.weight};unicode-range:${rule.unicodeRangeRaw};` +
          `src:${src};}`
        );
      })
    );
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        results.push(item.value);
      } else {
        failures += 1;
        console.warn('fontCss: 单个字体内联失败，已跳过', item.reason);
      }
    }
  }
  if (!results.length && failures > 0) {
    throw new Error('字体准备失败：所有字体子集均下载失败');
  }
  return results.join('\n');
}

/** Convenience: full pipeline — fetch CSS, filter, base64, build CSS. */
export async function getFontEmbedCSS(text: string): Promise<string> {
  const cacheKey = text ?? '';
  const cached = embedCssCache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (!cssTextCache) {
    try {
      cssTextCache = await fetchText(GOOGLE_FONTS_CSS_URL);
    } catch (err) {
      console.warn('fontCss: 无法获取 Google Fonts 样式表，导出将回退系统字体', err);
      return '';
    }
  }
  const usedCodes = collectUsedChars(text);
  let result = '';
  try {
    result = await buildFontEmbedCss(cssTextCache, usedCodes, fetchBase64DataUrl);
  } catch (err) {
    console.warn('fontCss: 字体内联失败，导出将回退系统字体', err);
    return '';
  }
  embedCssCache.set(cacheKey, result);
  return result;
}

/** Plain text used to select font subsets for an article export. */
export function articleFontText(article: ArticleData): string {
  return `${article.title ?? ''}\n${article.contentHtml ?? ''}`;
}
