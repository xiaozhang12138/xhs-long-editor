import React from 'react';
import type { Template } from '../../types';
import { templates as templateData, templateCategories } from '../../data/templates';

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * Template selection panel, grouped by category.
 * Renders all 14 templates in a scrollable 2-column grid.
 */
export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedId,
  onSelect,
}) => {
  // Preserve declared category order, then append any stragglers
  const known = templateCategories.filter((c) =>
    templateData.some((t) => t.category === c)
  );
  const extra = Array.from(new Set(templateData.map((t) => t.category))).filter(
    (c) => !known.includes(c)
  );
  const categories = [...known, ...extra];

  return (
    <div className="pr-0.5">
      {categories.map((category) => {
        const items = templateData.filter((t) => t.category === category);
        const activeHere = items.some((t) => t.id === selectedId);

        return (
          <section key={category} className="mb-6 last:mb-2">
            {/* Category title */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-block rounded-full"
                style={{
                  width: 3,
                  height: 12,
                  backgroundColor: activeHere ? '#FF2442' : '#DDDDDD',
                }}
              />
              <h3 className="text-[13px] font-semibold text-[#333]">{category}</h3>
              <span className="text-[11px] text-[#BBB]">{items.length}</span>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 gap-3">
              {items.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedId === template.id}
                  onClick={() => onSelect(template.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

/** Individual template thumbnail card */
const TemplateCard: React.FC<{
  template: Template;
  isSelected: boolean;
  onClick: () => void;
}> = ({ template: t, isSelected, onClick }) => {
  return (
    <button
      type="button"
      className={`template-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
      title={t.description}
    >
      {/* Miniature render of the template */}
      <div
        className="aspect-[3/4] flex flex-col"
        style={{
          backgroundColor: t.bgColor,
          padding: 12,
          borderLeft:
            t.decorativeStyle === 'sidebar' ? `3px solid ${t.accentColor}` : undefined,
          borderTop:
            t.decorativeStyle === 'corner' ? `2px solid ${t.accentColor}` : undefined,
        }}
      >
        {/* Fake heading */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: t.headingAlign === 'center' ? 'center' : 'flex-start',
          }}
        >
          <span
            style={{
              display: 'block',
              width: t.headingAlign === 'center' ? '70%' : '78%',
              height: Math.max(4, Math.round(t.headingFontWeight / 130)),
              backgroundColor: t.textColor,
              opacity: 0.85,
              borderRadius: 2,
            }}
          />
          {t.decorativeStyle === 'underline' && (
            <span
              style={{
                display: 'block',
                width: 18,
                height: 2,
                marginTop: 4,
                backgroundColor: t.accentColor,
                borderRadius: 2,
              }}
            />
          )}
          {t.decorativeStyle === 'block' && (
            <span
              style={{
                display: 'block',
                width: 12,
                height: 4,
                marginTop: 4,
                backgroundColor: t.accentColor,
              }}
            />
          )}
          {t.decorativeStyle === 'gradient' && (
            <span
              style={{
                display: 'block',
                width: 26,
                height: 3,
                marginTop: 4,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${t.accentColor}, transparent)`,
              }}
            />
          )}
          {t.decorativeStyle === 'dotted' && (
            <span style={{ display: 'flex', gap: 2, marginTop: 4 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 999,
                    backgroundColor: t.accentColor,
                    opacity: 1 - i * 0.28,
                  }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Fake body lines — spacing reflects lineHeight */}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: Math.round(t.lineHeight * 2.6),
          }}
        >
          {[1, 0.92, 0.97, 0.7].map((w, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: `${w * 100}%`,
                height: 2,
                backgroundColor: t.textColor,
                opacity: 0.2,
                borderRadius: 2,
              }}
            />
          ))}
        </div>

        {/* Name plate */}
        <p
          className="mt-auto truncate text-center"
          style={{
            fontSize: 11,
            color: t.textColor,
            opacity: 0.9,
            fontWeight: 500,
            fontFamily: t.fontFamily,
          }}
        >
          {t.name}
        </p>
      </div>
    </button>
  );
};
