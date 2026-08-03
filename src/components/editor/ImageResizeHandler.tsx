import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';

interface ImageResizeHandlerProps {
  editor: Editor | null;
}

interface HandleState {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Adds a bottom-right resize handle to the image currently selected in the
 * TipTap editor. Dragging scales the image proportionally and writes the new
 * width/height into the image node attributes (store 记录每图 width).
 */
export const ImageResizeHandler: React.FC<ImageResizeHandlerProps> = ({
  editor,
}) => {
  const [handle, setHandle] = useState<HandleState | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startW: number; el: HTMLImageElement } | null>(null);
  const editorBoxRef = useRef<HTMLDivElement>(null);

  /** Find the currently selected image node + its DOM element. */
  const updateSelection = useCallback(() => {
    if (!editor) {
      setHandle(null);
      setSrc(null);
      return;
    }
    const { selection } = editor.state;
    const node = selection instanceof NodeSelection ? selection.node : null;
    const isImage =
      (node !== null && node.type.name === 'image') ||
      (selection.$from.parent.type.name === 'image' && !selection.empty);

    if (!isImage) {
      setHandle(null);
      setSrc(null);
      return;
    }

    const imgEl = editor.view.nodeDOM(selection.$from.pos) as
      | HTMLElement
      | null;
    const img = imgEl instanceof HTMLImageElement ? imgEl : imgEl?.querySelector('img');
    if (!(img instanceof HTMLImageElement)) {
      setHandle(null);
      setSrc(null);
      return;
    }
    const box = editorBoxRef.current?.getBoundingClientRect();
    const rect = img.getBoundingClientRect();
    if (!box) {
      setHandle(null);
      setSrc(null);
      return;
    }
    setHandle({
      left: rect.right - box.left,
      top: rect.bottom - box.top,
      width: img.offsetWidth,
      height: img.offsetHeight,
    });
    setSrc(img.src);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    updateSelection();
    editor.on('selectionUpdate', updateSelection);
    editor.on('transaction', updateSelection);
    const ro = new ResizeObserver(updateSelection);
    const dom = editor.view.dom;
    if (dom) ro.observe(dom);
    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('transaction', updateSelection);
      ro.disconnect();
    };
  }, [editor, updateSelection]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editor || !src) return;
      const imgEl = editor.view.dom.querySelector(
        `img[src="${src}"]`
      ) as HTMLImageElement | null;
      if (!imgEl) return;
      dragRef.current = { startX: e.clientX, startW: imgEl.offsetWidth, el: imgEl };

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const newW = Math.max(60, drag.startW + dx);
        const aspect = drag.el.naturalHeight / Math.max(1, drag.el.naturalWidth);
        drag.el.style.width = `${Math.round(newW)}px`;
        drag.el.style.height = 'auto';
        // Persist into the image node attributes.
        editor
          .chain()
          .focus()
          .updateAttributes('image', {
            width: Math.round(newW),
            height: Math.round(newW * aspect),
          })
          .run();
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [editor, src]
  );

  if (!handle || !src) return null;

  return (
    <div
      ref={editorBoxRef}
      className="editor-image-resizer"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}
    >
      <div
        className="image-resize-handle"
        style={{
          position: 'absolute',
          left: handle.left - 6,
          top: handle.top - 6,
        }}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
};

export default ImageResizeHandler;
