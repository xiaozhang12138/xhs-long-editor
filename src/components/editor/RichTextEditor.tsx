import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import type { EditorView } from '@tiptap/pm/view';
import type { Slice } from '@tiptap/pm/model';
import { FontSize } from './extensions/FontSize';
import { ResizableImage } from './extensions/ResizableImage';
import { ImageResizeHandler } from './ImageResizeHandler';

interface RichTextEditorProps {
  content: string;
  onUpdate: (content: string, html: string) => void;
}

/**
 * Ctrl+V 粘贴插图：从剪贴板 clipboardData.files 提取 image/*，
 * FileReader → base64 → 以图片节点插入光标处（支持截图工具直接粘贴）。
 */
function handlePasteImage(
  view: EditorView,
  event: ClipboardEvent,
  _slice: Slice
): boolean {
  const files = Array.from(event.clipboardData?.files ?? []);
  const imageFile = files.find((f) => f.type.startsWith('image/'));
  if (!imageFile) return false;
  event.preventDefault();
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result as string;
    const { schema } = view.state;
    const node = schema.nodes.image.create({ src });
    const tr = view.state.tr.replaceSelectionWith(node).scrollIntoView();
    view.dispatch(tr);
  };
  reader.readAsDataURL(imageFile);
  return true;
}

/**
 * TipTap rich text editor with full formatting support + image paste +
 * draggable image resize (width recorded in the doc JSON).
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onUpdate,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          style: 'border-radius: 2px; padding: 0 2px;',
        },
      }),
      ResizableImage.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: '开始书写你的长文内容...',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor: e }) => {
      onUpdate(JSON.stringify(e.getJSON()), e.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
      },
      handlePaste: handlePasteImage,
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== JSON.stringify(editor.getJSON())) {
      try {
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        if (parsed && typeof parsed === 'object') {
          editor.commands.setContent(parsed);
        }
      } catch {
        // If content is HTML or plain text
        if (content && !editor.getText()) {
          editor.commands.setContent(content);
        }
      }
    }
  }, [content]);

  return (
    <div className="tiptap-editor rounded-xhsCard border border-[#E8E8E8] bg-white min-h-[400px]">
      <EditorContent editor={editor} />
      <ImageResizeHandler editor={editor} />
    </div>
  );
};

export default RichTextEditor;
