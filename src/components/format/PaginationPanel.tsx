import React from 'react';
import type { ArticleData } from '../../types';
import { useArticlePages } from '../../hooks/useArticlePages';

interface PaginationPanelProps {
  article: ArticleData;
  onManualPageBreaksChange: (breaks: string[]) => void;
}

export const PaginationPanel: React.FC<PaginationPanelProps> = ({
  article,
  onManualPageBreaksChange,
}) => {
  const { pages, ready } = useArticlePages(article);
  const contentPages = pages.filter((page) => !page.isCover);
  const warningCount = contentPages.reduce((sum, page) => sum + (page.warnings?.length ?? 0), 0);
  return (
    <div className="pagination-panel">
      <div className="pagination-panel-hero">
        <span>LAYOUT QUALITY</span>
        <strong>{ready ? `${contentPages.length} 页正文` : '分析中…'}</strong>
        <p>{warningCount ? `发现 ${warningCount} 项可优化提示` : '分页结构清晰，可以继续编辑。'}</p>
      </div>

      <div className="pagination-rule-list">
        <div><b>✓</b><span>标题与下一段自动绑定</span></div>
        <div><b>✓</b><span>避免下一页只剩一行文字</span></div>
        <div><b>✓</b><span>图片与短说明尽量同页</span></div>
        <div><b>✓</b><span>相邻页面自动平衡留白</span></div>
      </div>

      <div className="pagination-panel-title">
        <span>逐页诊断</span><small>{warningCount} 条提示</small>
      </div>
      <div className="pagination-page-list">
        {contentPages.map((page, index) => (
          <div key={page.pageIndex} className={page.warnings?.length ? 'has-warning' : ''}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <span>{page.warnings?.length ? page.warnings.map((item) => item.message).join(' · ') : '页面状态良好'}</span>
          </div>
        ))}
      </div>

      <div className="pagination-manual-help">
        <strong>手动控制</strong>
        <p>点击正文卡片中的目标段落，顶部会出现“上一页 / 从这里分页 / 下一页”。所有调整都会保存到草稿。</p>
        {!!article.manualPageBreaks.length && (
          <button type="button" onClick={() => onManualPageBreaksChange([])}>
            清除 {article.manualPageBreaks.length} 个手动分页点
          </button>
        )}
      </div>
    </div>
  );
};
