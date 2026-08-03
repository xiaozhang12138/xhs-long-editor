import { Extension } from '@tiptap/core';

export interface FontSizeOptions {
  /** Node/mark types that carry the fontSize attribute. */
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Set the font size of the current selection, e.g. "18px". */
      setFontSize: (size: string) => ReturnType;
      /** Remove the font size from the current selection. */
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * Custom FontSize extension built on top of TextStyle.
 * Stores `font-size` in the `textStyle` mark and round-trips through
 * `style.fontSize` in the DOM (same mechanism as @tiptap/extension-color).
 */
export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});
