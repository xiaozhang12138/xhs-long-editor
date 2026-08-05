/**
 * 编辑器字号与 900px 宽图片字号之间的统一映射。
 *
 * 编辑区按桌面 CSS 像素书写（默认 16px），导出图会缩放到手机屏幕查看；
 * 若把 16px 原样写进 900px 图片，手机端视觉字号只有约 6–7px。
 * 因此排版阶段统一放大正文、间距，并保留 12–24px 选择之间的相对层级。
 */
export const EDITOR_BASE_FONT_SIZE = 16;
export const CARD_BODY_SCALE = 2.25;
export const CARD_SPACING_SCALE = 1.5;

/** 模板正文基准字号 → 导出图片正文基准字号。 */
export function resolveCardBodyFontSize(templateBaseFontSize: number): number {
  return Math.max(28, Math.round(templateBaseFontSize * CARD_BODY_SCALE));
}

/** 编辑器显式字号 → 当前模板下的图片字号。 */
export function resolveCardFontSize(
  editorFontSize: number | undefined,
  cardBaseFontSize: number
): number {
  if (!editorFontSize || !Number.isFinite(editorFontSize)) return cardBaseFontSize;
  return Math.max(
    20,
    Math.round((editorFontSize / EDITOR_BASE_FONT_SIZE) * cardBaseFontSize)
  );
}

/** 模板内边距 → 图片阅读留白。 */
export function resolveCardPadding(templatePadding: number): number {
  return Math.round(templatePadding * CARD_SPACING_SCALE);
}

/**
 * 封面标题使用内容自适应字号：短标题形成视觉锚点，长标题自动收敛，
 * 避免 64 字标题溢出。
 */
export function resolveCoverTitleFontSize(
  templateBaseFontSize: number,
  title: string
): number {
  const base = resolveCardBodyFontSize(templateBaseFontSize);
  const length = Array.from(title.trim() || '未命名长文').length;
  const multiplier = length <= 10 ? 3.2 : length <= 20 ? 2.8 : length <= 36 ? 2.4 : 2.05;
  return Math.min(116, Math.max(62, Math.round(base * multiplier)));
}

/**
 * Card view stores the original editor px in data-editor-font-size while
 * visually rendering the enlarged export px. Restore that original value
 * before parsing the edited card back into TipTap, preventing repeated edits
 * from multiplying font sizes on every round trip.
 */
export function normalizeCardEditHtml(element: Element): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('[data-editor-font-size]').forEach((node) => {
    const editorSize = Number(node.dataset.editorFontSize);
    if (Number.isFinite(editorSize) && editorSize > 0) {
      node.style.fontSize = `${editorSize}px`;
    }
    delete node.dataset.editorFontSize;
  });
  return clone.innerHTML;
}
