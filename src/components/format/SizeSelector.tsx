import React from 'react';
import type { ArticleSize } from '../../types';
import {
  sizePresets,
  CUSTOM_WIDTH_MIN,
  CUSTOM_WIDTH_MAX,
} from '../../data/templates';

interface SizeSelectorProps {
  size: ArticleSize;
  onSelectPreset: (presetId: string) => void;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
}

/**
 * Card size / aspect-ratio selector for the format page.
 * Offers 6 presets plus a custom width & height entry.
 */
export const SizeSelector: React.FC<SizeSelectorProps> = ({
  size,
  onSelectPreset,
  onWidthChange,
  onHeightChange,
}) => {
  const isCustom = size.presetId === 'custom';

  return (
    <div className="py-1">
      {/* Preset grid */}
      <h3 className="text-[13px] font-semibold text-[#333] mb-3">预设比例</h3>
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {sizePresets.map((preset) => {
          const selected = size.presetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={`size-chip ${selected ? 'selected' : ''}`}
              title={`${preset.name} ${preset.ratioLabel}`}
            >
              {/* Mini ratio diagram */}
              <span className="size-chip__figure">
                <span
                  className="size-chip__box"
                  style={{
                    width: preset.aspect >= 1 ? `${Math.round(26 / preset.aspect)}px` : '26px',
                    height: preset.aspect >= 1 ? '26px' : `${Math.round(26 * preset.aspect)}px`,
                  }}
                />
              </span>
              <span className="size-chip__name">{preset.name}</span>
              <span className="size-chip__ratio">{preset.ratioLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Custom size */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-[#333]">自定义尺寸</h3>
        {isCustom && (
          <span className="text-[11px] text-[#FF2442] bg-[#FFF0F2] px-2 py-0.5 rounded-full">
            自定义中
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Width */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="size-width" className="text-xs text-[#666]">
              宽度
            </label>
            <span className="text-[11px] text-[#BBB]">
              {CUSTOM_WIDTH_MIN}–{CUSTOM_WIDTH_MAX}px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="size-width"
              type="range"
              min={CUSTOM_WIDTH_MIN}
              max={CUSTOM_WIDTH_MAX}
              value={size.width}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="flex-1 xhs-range"
            />
            <input
              type="number"
              min={CUSTOM_WIDTH_MIN}
              max={CUSTOM_WIDTH_MAX}
              value={size.width}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="w-[68px] text-xs text-center border border-[#E8E8E8] rounded-xhs px-2 py-1.5 outline-none focus:border-[#FF2442] transition-colors tabular-nums"
            />
          </div>
        </div>

        {/* Height */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="size-height" className="text-xs text-[#666]">
              高度
            </label>
            <span className="text-[11px] text-[#BBB]">按比例自动计算</span>
          </div>
          <input
            id="size-height"
            type="number"
            min={200}
            max={2000}
            value={size.height}
            onChange={(e) => onHeightChange(Number(e.target.value))}
            className="w-full text-xs border border-[#E8E8E8] rounded-xhs px-3 py-1.5 outline-none focus:border-[#FF2442] transition-colors tabular-nums"
          />
        </div>
      </div>

      {/* Current size readout */}
      <div className="mt-5 flex items-center justify-between rounded-xhsCard bg-[#FAFAFA] border border-[#EFEFEF] px-3 py-2.5">
        <span className="text-xs text-[#999]">当前尺寸</span>
        <span className="text-xs font-medium text-[#333] tabular-nums">
          {size.width} × {size.height} px
        </span>
      </div>

      <p className="text-[11px] text-[#AAA] mt-3 leading-relaxed">
        尺寸会同步应用到左侧预览卡片与发布页的手机预览。
      </p>
    </div>
  );
};
