import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';

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

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement('span');
      wrapper.className = 'editor-resizable-image';
      wrapper.setAttribute('contenteditable', 'false');
      const image = document.createElement('img');
      const handle = document.createElement('span');
      handle.className = 'editor-inline-resize-handle';
      handle.setAttribute('role', 'button');
      handle.setAttribute('aria-label', '拖动缩放图片');
      wrapper.append(image, handle);

      const sync = (attrs: Record<string, unknown>) => {
        image.src = String(attrs.src ?? '');
        image.alt = String(attrs.alt ?? '');
        image.title = attrs.title ? String(attrs.title) : '';
        image.style.width = attrs.width ? `${Number(attrs.width)}px` : 'auto';
        image.style.height = 'auto';
      };
      sync(node.attrs);

      const selectImage = () => {
        const pos = getPos();
        if (typeof pos !== 'number') return;
        editor.view.dispatch(
          editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))
        );
      };
      image.addEventListener('mousedown', selectImage);

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        selectImage();
        const startX = event.clientX;
        const startWidth = image.offsetWidth;
        const aspect = image.naturalHeight / Math.max(1, image.naturalWidth);
        const maxWidth = wrapper.parentElement?.clientWidth ?? editor.view.dom.clientWidth;

        const onMove = (moveEvent: PointerEvent) => {
          const width = Math.round(
            Math.max(80, Math.min(maxWidth, startWidth + moveEvent.clientX - startX))
          );
          image.style.width = `${width}px`;
          image.style.height = 'auto';
        };
        const onUp = () => {
          const width = Math.round(image.offsetWidth);
          const pos = getPos();
          if (typeof pos === 'number') {
            editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width,
              height: Math.round(width * aspect),
            }));
          }
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointerdown', onPointerDown);

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false;
          node = updatedNode;
          sync(updatedNode.attrs);
          return true;
        },
        selectNode() {
          wrapper.classList.add('is-selected');
        },
        deselectNode() {
          wrapper.classList.remove('is-selected');
        },
        stopEvent(event) {
          return event.target === handle;
        },
        destroy() {
          image.removeEventListener('mousedown', selectImage);
          handle.removeEventListener('pointerdown', onPointerDown);
        },
      };
    };
  },
});

export default ResizableImage;
