import React, { useState, useCallback } from 'react';
import { TopNav } from './components/layout/TopNav';
import { EditorHeader } from './components/layout/EditorHeader';
import { EditorFooter } from './components/layout/EditorFooter';
import { LongArticleEditor } from './components/editor/LongArticleEditor';
import { DraftListPanel } from './components/editor/DraftListPanel';
import { FormatPage } from './components/format/FormatPage';
import { PublishPage } from './components/publish/PublishPage';
import { useArticleStore } from './stores/useArticleStore';
import {
  copyTextToClipboard,
  formatArticlePlainText,
} from './utils/clipboard';

/** Toast notification */
const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] toast-animate">
      <div className="bg-[#333] text-white px-6 py-3 rounded-full shadow-lg text-sm flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#4ADE80" strokeWidth="1.5" fill="none" />
          <path d="M5.5 8l2 2 3-4" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        {message}
      </div>
    </div>
  );
};

/**
 * Root App component.
 * Manages stage transitions between Editor → Format → Publish.
 * Handles confirm dialogs, success toasts, the draft-list panel and the
 * "复制全文" button (editor stage).
 */
function App() {
  const store = useArticleStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  /** Show a temporary toast */
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  /** 草稿会实时自动保存；按钮仅给用户明确的保存反馈。 */
  const handleDraftLeave = useCallback(() => {
    showToast('草稿已保存到当前浏览器');
  }, [showToast]);

  /**
   * 本工具没有接入小红书发布接口，不能伪装成已经发布，也不能删除草稿。
   * 完成页只提示用户下载图片后手动发布。
   */
  const handlePublish = useCallback(() => {
    showToast('内容已保存，请下载图片后手动发布到小红书');
  }, [showToast]);

  /** Copy the whole article (title + body plain text) to the clipboard. */
  const handleCopyFullText = useCallback(async () => {
    try {
      const text = formatArticlePlainText(store.article);
      await copyTextToClipboard(text);
      showToast('已复制标题+全文');
    } catch (err) {
      showToast(`复制失败：${(err as Error).message}`);
    }
  }, [store.article, showToast]);

  /** Navigate to format page */
  const goToFormat = useCallback(() => {
    store.goToStage('format');
  }, [store]);

  /** Navigate to publish page */
  const goToPublish = useCallback(() => {
    store.goToStage('publish');
  }, [store]);

  /** Navigate back to editor */
  const goBackToEditor = useCallback(() => {
    store.goToStage('editor');
  }, [store]);

  /**
   * Navigate back from publish page to format page.
   * Article state lives in the store above the stage switch,
   * so title/content/template/cover selections are preserved.
   */
  const goBackToFormat = useCallback(() => {
    store.goToStage('format');
  }, [store]);

  /** Create a new draft from the draft panel. */
  const handleCreateDraft = useCallback(() => {
    store.createDraft();
    setShowDrafts(false);
    showToast('已新建草稿');
  }, [store, showToast]);

  /** Switch to an existing draft. */
  const handleSwitchDraft = useCallback(
    (id: string) => {
      store.switchDraft(id);
      setShowDrafts(false);
      showToast('已切换草稿');
    },
    [store, showToast]
  );

  /** Delete a draft (two-step confirm handled inside the panel). */
  const handleDeleteDraft = useCallback(
    (id: string) => {
      store.deleteDraft(id);
      showToast('草稿已删除');
    },
    [store, showToast]
  );

  return (
    <div className="h-screen bg-[#F5F5F5] flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <TopNav />

      {/* Main content area */}
      <div className="flex-1 min-h-0 mt-14 mb-14 flex flex-col overflow-hidden">
        {/* Stage 1: Editor */}
        {store.stage === 'editor' && (
          <div key="editor" className="flex-1 min-h-0 flex flex-col page-enter-active bg-white mx-auto w-full max-w-[1200px] my-0 rounded-none shadow-none">
            <EditorHeader
              showToolbar={false}
              editor={null}
              rightActions={
                <button
                  type="button"
                  onClick={() => setShowDrafts(true)}
                  className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#FF2442] cursor-pointer border border-[#E8E8E8] bg-white rounded-full px-3 py-1.5 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="2" y="2" width="10" height="10" rx="2" />
                    <path d="M4 6h6M4 9h4" strokeLinecap="round" />
                  </svg>
                  草稿列表
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#FFF0F2] text-[#FF2442] text-[10px] inline-flex items-center justify-center tabular-nums">
                    {store.drafts.length}
                  </span>
                </button>
              }
            />
            <LongArticleEditor
              title={store.article.title}
              content={store.article.content}
              onTitleChange={store.updateTitle}
              onContentChange={store.updateContent}
            />
            <EditorFooter
              wordCount={store.article.wordCount}
              lastSavedAt={store.article.lastSavedAt}
              onDraftLeave={handleDraftLeave}
              onCopyText={handleCopyFullText}
              primaryAction={{
                label: '一键排版',
                onClick: goToFormat,
                variant: 'primary',
              }}
            />
          </div>
        )}

        {/* Stage 2: Format Page */}
        {store.stage === 'format' && (
          <div key="format" className="flex-1 min-h-0 flex flex-col page-enter-active bg-white mx-auto w-full my-0 overflow-hidden">
            <EditorHeader onBack={goBackToEditor} showToolbar={true} editor={null} />
            <FormatPage
              article={store.article}
              onTemplateSelect={store.selectTemplate}
              onCoverColorChange={store.setCoverColor}
              onCoverChange={store.updateCoverImage}
              onSelectSizePreset={store.selectSizePreset}
              onCustomWidthChange={store.setCustomWidth}
              onCustomHeightChange={store.setCustomHeight}
              onContentChange={store.updateContent}
              onTitleChange={store.updateTitle}
              onToast={showToast}
              onNext={goToPublish}
              onBack={goBackToEditor}
              onDraftLeave={handleDraftLeave}
            />
            <EditorFooter
              wordCount={store.article.wordCount}
              lastSavedAt={store.article.lastSavedAt}
              onDraftLeave={handleDraftLeave}
              primaryAction={{
                label: '下一步',
                onClick: goToPublish,
                variant: 'primary',
              }}
            />
          </div>
        )}

        {/* Stage 3: Publish Page */}
        {store.stage === 'publish' && (
          <div key="publish" className="flex-1 min-h-0 flex flex-col page-enter-active bg-white mx-auto w-full max-w-[1200px] my-0 overflow-hidden">
            <PublishPage
              article={store.article}
              onCoverChange={store.updateCoverImage}
              onDescriptionChange={store.updateDescription}
              onAddTag={store.addTag}
              onRemoveTag={store.removeTag}
              onBack={goBackToFormat}
            />

            {/* Footer for publish page */}
            <div className="h-14 bg-white border-t border-[#E8E8E8] flex items-center justify-between px-6 fixed bottom-0 left-0 right-0 z-40">
              <div /> {/* spacer */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDraftLeave}
                  className="px-5 py-2 text-sm rounded-xhs cursor-pointer border border-[#E8E8E8] bg-white text-[#666] hover:bg-[#FAFAFA] transition-colors"
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="px-8 py-2 text-sm rounded-xhs cursor-pointer border-none bg-[#FF2442] text-white hover:bg-[#E01F3C] transition-colors font-medium"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Draft list panel (P1-3) — editor stage only */}
      {showDrafts && store.stage === 'editor' && (
        <DraftListPanel
          drafts={store.drafts}
          currentId={store.currentDraftId}
          onClose={() => setShowDrafts(false)}
          onCreate={handleCreateDraft}
          onSwitch={handleSwitchDraft}
          onDelete={handleDeleteDraft}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}

export default App;
