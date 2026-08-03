import Image from '@tiptap/extension-image';

/**
 * ResizableImage — @tiptap/extension-image extended with `width` / `height`
 * attributes so the editor can record per-image display sizes (store 记录每图
 * width). The pagination engine reads `width` when it renders pages.
 *
 * Default: no width → images render at their natural size (capped by the
 * pagination engine). After the user drags the resize handle, `width` (px) is
 * persisted in the TipTap document JSON.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute('width') || element.style.width;
          const px = parseFloat(w || '');
          return Number.isFinite(px) && px > 0 ? Math.round(px) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const h = element.getAttribute('height') || element.style.height;
          const px = parseFloat(h || '');
          return Number.isFinite(px) && px > 0 ? Math.round(px) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },
});

export default ResizableImage;
