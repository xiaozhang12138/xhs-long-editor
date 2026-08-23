/** Application stage/page type */
export type AppStage = 'editor' | 'format' | 'publish';

export type CoverLayout = 'knowledge' | 'lifestyle' | 'opinion' | 'business';

/** Decorative accent style applied by a template */
export type DecorativeStyle =
  | 'none'
  | 'underline'
  | 'sidebar'
  | 'block'
  | 'corner'
  | 'dotted'
  | 'gradient';

/** Heading alignment within a template */
export type HeadingAlign = 'left' | 'center';

/**
 * How <strong>/<b> text is emphasized inside a template.
 * 原版实测：每个模板的加粗处理各不相同（至少 4-5 种不同方式）。
 */
export type BoldStyle =
  | 'highlight' // 淡色背景高亮（如「轻感明快」淡蓝高亮）
  | 'underline' // 强调色下划线
  | 'color' // 强调色变色
  | 'scale' // 加粗 + 放大
  | 'serif' // 衬线强调（无衬线正文时用衬线加粗）
  | 'shadow' // 文字阴影
  | 'double' // 双重下划线
  | 'marker' // 记号笔斜角标记
  | 'combo'; // 粗体 + 变色组合

/** Cover title decoration style. */
export type TitleDecoration =
  | 'none'
  | 'quote' // 大引号
  | 'color-block' // 色块包标题
  | 'paper' // 牛皮纸 + 手写体
  | 'line' // 装饰线
  | 'corner' // 角落括号
  | 'frame' // 几何线框
  | 'underline-block' // 下划线 + 色块
  | 'circle' // 涂鸦圆圈
  | 'bracket' // 书名号
  | 'masthead' // 杂志刊头线
  | 'number-block' // 序号色块
  | 'leaf' // 枝叶点缀
  | 'tag' // 旧纸标签
  | 'mosaic' // 拼接色块
  | 'block' // 黑白分割
  | 'rings'; // 拓扑圆环

/** Card background pattern (CSS-drawn, no images). */
export type BackgroundPattern =
  | 'none'
  | 'dots'
  | 'grid'
  | 'lines'
  | 'stripes'
  | 'diagonal'
  | 'paper'
  | 'waves'
  | 'squares'
  | 'polka'
  | 'topo';

/** Card size preset identifier */
export type SizePresetId =
  | 'phone-long'
  | 'square'
  | 'ratio-3-4'
  | 'ratio-4-3'
  | 'ratio-9-16'
  | 'a4-portrait'
  | 'custom';

/** Card size preset definition */
export interface SizePreset {
  id: SizePresetId;
  name: string;
  /** Short ratio label shown on the chip, e.g. "3:5" */
  ratioLabel: string;
  /** Default width in px */
  width: number;
  /** height / width — used to derive height from width */
  aspect: number;
}

/** Resolved card size used for rendering */
export interface ArticleSize {
  presetId: SizePresetId;
  width: number;
  height: number;
}

/** Article data model */
export interface ArticleData {
  title: string;
  content: string;
  contentHtml: string;
  wordCount: number;
  coverImage: string | null;
  /** User-controlled automatic cover composition. */
  coverVariant: number;
  coverKeywords: string[];
  coverKeywordScale: number;
  coverKeywordX: number;
  coverKeywordY: number;
  coverAccentColor: string;
  coverLayout: CoverLayout;
  /** Uploaded-cover crop controls. */
  coverImageScale: number;
  coverImageX: number;
  coverImageY: number;
  /** Stable source block ids that must start a new page. */
  manualPageBreaks: string[];
  description: string;
  tags: string[];
  selectedTemplate: string;
  /** Card size for preview / export. Persisted with the draft. */
  selectedSize: ArticleSize;
  coverColor: string;
  collectionId: string | null;
  isOriginal: boolean;
  location: string;
  groupId: string;
  redSkill: string;
  lastSavedAt: string | null;
}

/** Template definition */
export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  /** CSS class following the `template-<id>` convention */
  themeClass: string;
  fontSize: number;
  lineHeight: number;
  /** Google-font-first stack, e.g. 'Noto Serif SC', 'Songti SC', serif */
  fontFamily: string;
  textColor: string;
  bgColor: string;
  accentColor: string;
  /** Base body font size in px (mirrors fontSize, kept explicit for theming) */
  baseFontSize: number;
  /** Font weight applied to headings (400-900) */
  headingFontWeight: number;
  /** Card corner radius in px */
  cardRadius: number;
  /** Heading text alignment */
  headingAlign: HeadingAlign;
  /** Decorative accent rendered near the heading */
  decorativeStyle: DecorativeStyle;
  /** Letter spacing in em for body text */
  letterSpacing: number;
  /** Inner padding of the card in px */
  padding: number;
  /** Optional final-pixel content insets for templates with fixed app chrome. */
  contentInsets?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Secondary/muted text color */
  mutedColor: string;
  /** How <strong>/<b> is emphasized (原版按模板各异的加粗处理). */
  boldStyle: BoldStyle;
  /** Color used by highlight/marker/underline bold styles (e.g. 淡蓝高亮). */
  boldColor: string;
  /** Cover page title decoration (CSS 绘制装饰). */
  titleDecoration: TitleDecoration;
  /** Background pattern drawn with CSS gradients, no images. */
  backgroundPattern: BackgroundPattern;
  /** Cover page base color (auto-cover block). */
  coverBgColor: string;
}

/** Topic tag for recommendations */
export interface TopicTag {
  id: string;
  label: string;
  hot?: boolean;
}

/** Sidebar menu item */
export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  children?: SidebarMenuItem[];
}
