import React, { useRef, useCallback, useEffect } from 'react';
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
import { TitleInput } from './TitleInput';
import { Toolbar } from './Toolbar';

interface LongArticleEditorProps {
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string, html: string) => void;
}

/**
 * 将 store 中保存的 TipTap JSON 字符串还原成编辑器内容。
 * 空字符串代表真正的空文档，切换到新草稿时必须同步清空编辑器。
 */
function parseStoredContent(content: string): object | string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as object : '';
  } catch {
    // 兼容早期可能直接保存 HTML 的草稿。
    return content;
  }
}

/**
 * Ctrl+V 粘贴插图：提取 clipboardData.files 中 image/* → base64 → 插入。
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
 * Stage 1: Main long article editor.
 * Combines title input + TipTap rich text editor + toolbar.
 * Supports image paste (Ctrl+V) and draggable image resize.
 */
export const LongArticleEditor: React.FC<LongArticleEditorProps> = ({
  title,
  content,
  onTitleChange,
  onContentChange,
}) => {
  const editorRef = useRef<any>(null);

  // Create TipTap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
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
        placeholder: '',
      }),
    ],
    content: parseStoredContent(content),
    onUpdate: ({ editor: e }) => {
      onContentChange(JSON.stringify(e.getJSON()), e.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
      },
      handlePaste: handlePasteImage,
    },
  });

  // Keep ref in sync
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Sync external content
  useEffect(() => {
    if (!editor) return;
    const parsed = parseStoredContent(content);
    if (parsed === '') {
      // 关键回归：新建/切换到空草稿时，不能残留上一份正文。
      if (!editor.isEmpty) editor.commands.setContent('', false);
      return;
    }
    if (typeof parsed === 'object') {
      const currentJson = JSON.stringify(editor.getJSON());
      if (currentJson !== JSON.stringify(parsed)) {
        editor.commands.setContent(parsed, false);
      }
      return;
    }
    if (editor.getHTML() !== parsed) {
      editor.commands.setContent(parsed, false);
    }
  }, [content, editor]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Editor body — scrolls internally so the footer stays on screen */}
      <div className="flex-1 min-h-0 overflow-y-auto px-10 py-8">
        <div className="max-w-[800px] mx-auto">
          <TitleInput value={title} onChange={onTitleChange} />

          {/* Rich text editor with integrated toolbar */}
          <div>
            {/* Toolbar above editor */}
            {editor && <Toolbar editor={editor} />}

            {/* Editor area */}
            <div className="mt-4 tiptap-editor rounded-xhsCard border border-[#E8E8E8] bg-white min-h-[400px]">
              <EditorContent editor={editor} />
              <ImageResizeHandler editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* Return editor ref for parent use */}
      <input type="hidden" data-editor-ready={editor ? 'true' : 'false'} />
    </div>
  );
};

// Export a hook to get the editor instance
export function useEditorInstance() {
  return useRef<any>(null);
}
