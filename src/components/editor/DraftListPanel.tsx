import React, { useState } from 'react';
import type { DraftRecord } from '../../utils/draftStorage';
import { Button } from '../shared/Button';

interface DraftListPanelProps {
  drafts: DraftRecord[];
  currentId: string | null;
  onClose: () => void;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Format an epoch-ms timestamp as `MM-DD HH:mm`. */
export function formatDraftTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

/**
 * 草稿列表弹窗（P1-3）：展示所有草稿（标题 + 更新时间），支持
 * 新建草稿 / 切换草稿 / 删除草稿（两步确认）。
 */
export const DraftListPanel: React.FC<DraftListPanelProps> = ({
  drafts,
  currentId,
  onClose,
  onCreate,
  onSwitch,
  onDelete,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (id: string): void => {
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null);
      onDelete(id);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-box max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#333]">草稿列表</h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[#999] hover:text-[#333] p-1 transition-colors"
            aria-label="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px]">
          {drafts.length === 0 && (
            <div className="text-xs text-[#999] py-10 text-center">还没有草稿，点击下方「新建草稿」开始创作</div>
          )}
          {drafts.map((draft) => {
            const isCurrent = draft.id === currentId;
            const confirming = confirmDeleteId === draft.id;
            return (
              <div
                key={draft.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xhs border transition-colors ${
                  isCurrent
                    ? 'bg-[#FFF0F2] border-[#FFC2CC]'
                    : 'bg-white border-[#EEEEEE] hover:border-[#D9D9D9]'
                }`}
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left cursor-pointer border-none bg-transparent"
                  onClick={() => {
                    setConfirmDeleteId(null);
                    onSwitch(draft.id);
                  }}
                  title="切换到此草稿"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#333] font-medium truncate">
                      {draft.title || '未命名长文'}
                    </span>
                    {isCurrent && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF2442] text-white">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#999] mt-0.5 tabular-nums">
                    更新于 {formatDraftTime(draft.updatedAt) || '—'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteClick(draft.id)}
                  className={`shrink-0 px-2.5 py-1 text-[11px] rounded-xhs cursor-pointer border transition-colors ${
                    confirming
                      ? 'bg-[#FF2442] text-white border-[#FF2442]'
                      : 'bg-white text-[#999] border border-[#E8E8E8] hover:border-[#FF2442] hover:text-[#FF2442]'
                  }`}
                >
                  {confirming ? '确认删除?' : '删除'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-[#F0F0F0]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setConfirmDeleteId(null);
              onCreate();
            }}
          >
            + 新建草稿
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DraftListPanel;
