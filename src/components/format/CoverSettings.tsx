import React, { useMemo, useRef } from 'react';
import type { ArticleData, CoverLayout } from '../../types';
import { coverColors } from '../../data/templates';
import { buildCoverVisualData } from '../../utils/coverVisual';

interface CoverSettingsProps {
  article: ArticleData;
  onColorChange: (color: string) => void;
  onCoverChange: (image: string | null) => void;
  onSettingsChange: (patch: Partial<ArticleData>) => void;
}

const LAYOUTS: Array<{ id: CoverLayout; label: string; code: string }> = [
  { id: 'knowledge', label: '知识科普', code: 'KNOW' },
  { id: 'lifestyle', label: '生活方式', code: 'LIFE' },
  { id: 'opinion', label: '人物观点', code: 'VOICE' },
  { id: 'business', label: '商业分析', code: 'BIZ' },
];

/** Full cover studio: candidates, keyword controls and uploaded-image crop. */
export const CoverSettings: React.FC<CoverSettingsProps> = ({
  article,
  onColorChange,
  onCoverChange,
  onSettingsChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const generated = useMemo(
    () => buildCoverVisualData(article.title, article.contentHtml),
    [article.title, article.contentHtml]
  );
  const keywords = article.coverKeywords.length
    ? article.coverKeywords.slice(0, 3)
    : generated.keywords.slice(0, 3);

  const updateKeyword = (index: number, value: string) => {
    const next = [...keywords];
    while (next.length < 3) next.push('');
    next[index] = value.slice(0, 12);
    onSettingsChange({ coverKeywords: next });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCoverChange(reader.result as string);
      onSettingsChange({ coverImageScale: 1, coverImageX: 50, coverImageY: 50 });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="cover-studio pb-8">
      <div className="cover-studio-heading">
        <span>AUTO COVER STUDIO</span>
        <strong>封面工作台</strong>
        <p>从文章关键词生成候选，也可以精调自己的图片。</p>
      </div>

      <section className="cover-control-section">
        <div className="cover-section-title"><b>01</b><span>选择候选</span></div>
        <div className="cover-candidate-grid">
          {[0, 1, 2, 3].map((variant) => (
            <button
              key={variant}
              type="button"
              className={`cover-candidate cover-candidate--${variant} ${article.coverVariant === variant ? 'selected' : ''}`}
              style={{ '--candidate-accent': article.coverAccentColor } as React.CSSProperties}
              onClick={() => {
                onCoverChange(null);
                onSettingsChange({ coverVariant: variant });
              }}
              aria-label={`自动封面候选 ${variant + 1}`}
            >
              <i />
              <strong>{keywords[0] || '灵感'}</strong>
              <small>0{variant + 1} / AUTO</small>
            </button>
          ))}
        </div>
      </section>

      <section className="cover-control-section">
        <div className="cover-section-title"><b>02</b><span>内容与结构</span></div>
        <div className="cover-layout-grid">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              className={article.coverLayout === layout.id ? 'selected' : ''}
              onClick={() => onSettingsChange({ coverLayout: layout.id })}
            >
              <small>{layout.code}</small><span>{layout.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((index) => (
            <label key={index} className="cover-keyword-field">
              <span>关键词 {index + 1}</span>
              <input
                value={keywords[index] ?? ''}
                placeholder="输入关键词"
                onChange={(event) => updateKeyword(index, event.target.value)}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="cover-text-action"
          onClick={() => onSettingsChange({ coverKeywords: generated.keywords.slice(0, 3) })}
        >
          重新从文章提取关键词
        </button>
      </section>

      <section className="cover-control-section">
        <div className="cover-section-title"><b>03</b><span>视觉微调</span></div>
        <label className="cover-slider-row">
          <span>关键词大小</span>
          <input type="range" min="70" max="145" value={Math.round(article.coverKeywordScale * 100)} onChange={(e) => onSettingsChange({ coverKeywordScale: Number(e.target.value) / 100 })} />
          <output>{Math.round(article.coverKeywordScale * 100)}%</output>
        </label>
        <label className="cover-slider-row">
          <span>水平位置</span>
          <input type="range" min="15" max="85" value={article.coverKeywordX} onChange={(e) => onSettingsChange({ coverKeywordX: Number(e.target.value) })} />
          <output>{article.coverKeywordX}</output>
        </label>
        <label className="cover-slider-row">
          <span>垂直位置</span>
          <input type="range" min="20" max="80" value={article.coverKeywordY} onChange={(e) => onSettingsChange({ coverKeywordY: Number(e.target.value) })} />
          <output>{article.coverKeywordY}</output>
        </label>
        <div className="cover-color-row">
          <span>强调色</span>
          <input type="color" value={article.coverAccentColor} onChange={(e) => onSettingsChange({ coverAccentColor: e.target.value })} />
          {coverColors.map((color) => (
            <button key={color.id} type="button" style={{ background: color.color }} onClick={() => onColorChange(color.id)} title={color.label} />
          ))}
        </div>
      </section>

      <section className="cover-control-section">
        <div className="cover-section-title"><b>04</b><span>上传与裁剪</span></div>
        {article.coverImage ? (
          <>
            <div className="cover-crop-preview">
              <img
                src={article.coverImage}
                alt="封面裁剪预览"
                style={{
                  objectPosition: `${article.coverImageX}% ${article.coverImageY}%`,
                  transform: `scale(${article.coverImageScale})`,
                  transformOrigin: `${article.coverImageX}% ${article.coverImageY}%`,
                }}
              />
              <span>安全裁剪区</span>
            </div>
            <label className="cover-slider-row"><span>图片缩放</span><input type="range" min="100" max="260" value={Math.round(article.coverImageScale * 100)} onChange={(e) => onSettingsChange({ coverImageScale: Number(e.target.value) / 100 })} /><output>{Math.round(article.coverImageScale * 100)}%</output></label>
            <label className="cover-slider-row"><span>水平焦点</span><input type="range" min="0" max="100" value={article.coverImageX} onChange={(e) => onSettingsChange({ coverImageX: Number(e.target.value) })} /><output>{article.coverImageX}</output></label>
            <label className="cover-slider-row"><span>垂直焦点</span><input type="range" min="0" max="100" value={article.coverImageY} onChange={(e) => onSettingsChange({ coverImageY: Number(e.target.value) })} /><output>{article.coverImageY}</output></label>
            <div className="flex gap-2 mt-3">
              <button type="button" className="cover-text-action" onClick={() => inputRef.current?.click()}>更换图片</button>
              <button type="button" className="cover-text-action danger" onClick={() => onCoverChange(null)}>使用自动封面</button>
            </div>
          </>
        ) : (
          <button type="button" className="cover-upload-button" onClick={() => inputRef.current?.click()}>
            <b>＋</b><span>上传图片并调整裁剪焦点</span>
          </button>
        )}
      </section>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
};

export default CoverSettings;
