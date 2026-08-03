import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppStage, ArticleData, ArticleSize } from '../types';
import { defaultArticleSize, resolveSize, sizePresets } from '../data/templates';
import {
  createDraftRecord,
  draftTitleOf,
  loadCurrentDraftId,
  loadDrafts,
  migrateLegacyToDrafts,
  mostRecentDraft,
  normalizeArticle,
  removeDraft,
  removeLegacyDraft,
  saveCurrentDraftId,
  saveDrafts,
  saveLegacyDraft,
  upsertDraft,
} from '../utils/draftStorage';
import type { DraftRecord } from '../utils/draftStorage';

/** Default article data */
const defaultArticle: ArticleData = {
  title: '',
  content: '',
  contentHtml: '',
  wordCount: 0,
  coverImage: null,
  description: '',
  tags: [],
  selectedTemplate: 'qinggan-mingkuai',
  selectedSize: defaultArticleSize,
  coverColor: 'white',
  collectionId: null,
  isOriginal: false,
  location: '',
  groupId: '',
  redSkill: '',
  lastSavedAt: null,
};

interface InitialDraftState {
  drafts: DraftRecord[];
  currentDraftId: string;
  article: ArticleData;
}

/**
 * Resolve the initial draft state:
 * 1. v2 draft list present        → restore the persisted current draft
 *    (or the most recently edited one when the id is stale).
 * 2. legacy single draft present  → migrate it into the v2 list (first draft).
 * 3. nothing                      → create one fresh empty draft.
 */
function initDraftState(): InitialDraftState {
  const v2 = loadDrafts();
  if (v2.length) {
    const persistedId = loadCurrentDraftId();
    const current =
      v2.find((d) => d.id === persistedId) ?? mostRecentDraft(v2) ?? v2[0];
    return {
      drafts: v2,
      currentDraftId: current.id,
      article: normalizeArticle(current.article),
    };
  }
  const migrated = migrateLegacyToDrafts();
  if (migrated) {
    saveDrafts(migrated.drafts);
    saveCurrentDraftId(migrated.currentId);
    const record = migrated.drafts[0];
    return {
      drafts: migrated.drafts,
      currentDraftId: migrated.currentId,
      article: normalizeArticle(record.article),
    };
  }
  const fresh = createDraftRecord(defaultArticle);
  saveDrafts([fresh]);
  saveCurrentDraftId(fresh.id);
  return { drafts: [fresh], currentDraftId: fresh.id, article: { ...defaultArticle } };
}

/**
 * Global article store using React Context + useReducer pattern.
 * Manages the entire long-article lifecycle across 3 stages, plus a
 * multi-draft list persisted to localStorage (`xhs_drafts_v2`).
 */
export function useArticleStore() {
  const [stage, setStage] = useState<AppStage>('editor');

  // Draft state is initialized once (lazily) so all three states share the
  // exact same initial snapshot.
  const initialRef = useRef<InitialDraftState | null>(null);
  if (initialRef.current === null) {
    initialRef.current = initDraftState();
  }
  const [article, setArticle] = useState<ArticleData>(() => initialRef.current!.article);
  const [drafts, setDrafts] = useState<DraftRecord[]>(() => initialRef.current!.drafts);
  const [currentDraftId, setCurrentDraftId] = useState<string>(() => initialRef.current!.currentDraftId);

  // Refs keep the persist/autosave effects free of stale closures.
  const draftsRef = useRef<DraftRecord[]>(drafts);
  draftsRef.current = drafts;
  const currentDraftIdRef = useRef<string>(currentDraftId);
  currentDraftIdRef.current = currentDraftId;
  // One-shot flag: clearDraft() removes the legacy key and the immediately
  // following persist effect must not write it back.
  const suppressLegacyRef = useRef(false);

  // Auto-save the "last saved at" marker (debounced via useEffect).
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      // Functional update: `prev` is always the latest state at flush time.
      setArticle((prev) => {
        const updated = { ...prev, lastSavedAt: `${hh}:${mm}` };
        return updated;
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [article.title, article.content, article.contentHtml]);

  // Persist every article change: mirror to the legacy single-draft key AND
  // upsert the current draft in the v2 list (immediate, not debounced).
  // The legacy mirror is skipped when the article is fully empty so that
  // clearDraft() can remove it and keep it removed.
  useEffect(() => {
    const id = currentDraftIdRef.current;
    if (!id) return;
    const suppress = suppressLegacyRef.current;
    suppressLegacyRef.current = false;
    const isEmpty = !article.title && !article.content && !article.contentHtml;
    if (!suppress && !isEmpty) saveLegacyDraft(article);
    const next = upsertDraft(draftsRef.current, {
      id,
      title: draftTitleOf(article),
      updatedAt: Date.now(),
      article,
    });
    draftsRef.current = next;
    setDrafts(next);
    saveDrafts(next);
  }, [article]);

  /** Update title */
  const updateTitle = useCallback((title: string) => {
    setArticle((prev) => ({
      ...prev,
      title,
      wordCount: prev.wordCount,
    }));
  }, []);

  /** Update editor content (JSON + HTML) */
  const updateContent = useCallback((content: string, contentHtml: string) => {
    // Count words (Chinese chars + English words)
    const textContent = contentHtml.replace(/<[^>]+>/g, '');
    const chineseChars = (textContent.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (textContent.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    setArticle((prev) => ({
      ...prev,
      content,
      contentHtml,
      wordCount,
    }));
  }, []);

  /** Navigate to a stage */
  const goToStage = useCallback((s: AppStage) => {
    setStage(s);
  }, []);

  /** Update cover image */
  const updateCoverImage = useCallback((image: string | null) => {
    setArticle((prev) => ({ ...prev, coverImage: image }));
  }, []);

  /** Update description */
  const updateDescription = useCallback((description: string) => {
    setArticle((prev) => ({ ...prev, description }));
  }, []);

  /** Add / remove tag */
  const addTag = useCallback((tag: string) => {
    if (tag) {
      setArticle((prev) =>
        prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] }
      );
    }
  }, []);

  const removeTag = useCallback((tag: string) => {
    setArticle((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  /** Select template */
  const selectTemplate = useCallback((templateId: string) => {
    setArticle((prev) => ({ ...prev, selectedTemplate: templateId }));
  }, []);

  /** Select a size preset, deriving height from the preset aspect ratio */
  const selectSizePreset = useCallback((presetId: string) => {
    setArticle((prev) => {
      const preset = sizePresets.find((p) => p.id === presetId);
      // A preset carries its own recommended width; "custom" keeps the
      // width the user already dialled in.
      const width = preset ? preset.width : prev.selectedSize.width;
      return { ...prev, selectedSize: resolveSize(presetId, width) };
    });
  }, []);

  /** Set a custom width (clamped 240–1200), height follows current aspect */
  const setCustomWidth = useCallback((width: number) => {
    setArticle((prev) => ({
      ...prev,
      selectedSize: resolveSize(prev.selectedSize.presetId, width),
    }));
  }, []);

  /** Set an explicit height, switching the size to custom */
  const setCustomHeight = useCallback((height: number) => {
    setArticle((prev) => ({
      ...prev,
      selectedSize: {
        ...prev.selectedSize,
        height: Math.min(2000, Math.max(200, Math.round(height) || 200)),
      },
    }));
  }, []);

  /** Set cover color */
  const setCoverColor = useCallback((color: string) => {
    setArticle((prev) => ({ ...prev, coverColor: color }));
  }, []);

  /** Toggle original declaration */
  const toggleOriginal = useCallback(() => {
    setArticle((prev) => ({ ...prev, isOriginal: !prev.isOriginal }));
  }, []);

  /** Set location */
  const setLocation = useCallback((location: string) => {
    setArticle((prev) => ({ ...prev, location }));
  }, []);

  /** Set group chat */
  const setGroupId = useCallback((groupId: string) => {
    setArticle((prev) => ({ ...prev, groupId }));
  }, []);

  /** Set Red Skill */
  const setRedSkill = useCallback((redSkill: string) => {
    setArticle((prev) => ({ ...prev, redSkill }));
  }, []);

  /* ── Draft list management (P1-3) ─────────────────────────────────── */

  /** Create a brand-new empty draft and switch to it. */
  const createDraft = useCallback(() => {
    const fresh: ArticleData = { ...defaultArticle };
    const record = createDraftRecord(fresh);
    const next = [...draftsRef.current, record];
    draftsRef.current = next;
    setDrafts(next);
    setCurrentDraftId(record.id);
    saveCurrentDraftId(record.id);
    saveDrafts(next);
    setArticle(fresh);
  }, []);

  /** Switch to an existing draft by id (no-op when the id is unknown). */
  const switchDraft = useCallback((id: string) => {
    const record = draftsRef.current.find((d) => d.id === id);
    if (!record) return;
    setCurrentDraftId(id);
    saveCurrentDraftId(id);
    setArticle({ ...normalizeArticle(record.article) });
  }, []);

  /**
   * Delete a draft. When the deleted draft was the current one, fall back to
   * the most recently updated remaining draft (or a fresh empty draft when it
   * was the last one).
   */
  const deleteDraft = useCallback((id: string) => {
    const next = removeDraft(draftsRef.current, id);
    let final: DraftRecord[] = next;
    if (!final.length) {
      const fresh = createDraftRecord({ ...defaultArticle });
      final = [fresh];
      setCurrentDraftId(fresh.id);
      saveCurrentDraftId(fresh.id);
      setArticle({ ...defaultArticle });
    } else if (currentDraftIdRef.current === id) {
      const fallback = mostRecentDraft(final) ?? final[0];
      setCurrentDraftId(fallback.id);
      saveCurrentDraftId(fallback.id);
      setArticle({ ...normalizeArticle(fallback.article) });
    }
    draftsRef.current = final;
    setDrafts(final);
    saveDrafts(final);
  }, []);

  /**
   * Clear the published/discarded draft (after publish): remove the current
   * draft from the list, fall back to the most recently updated remaining
   * draft, or start a fresh empty draft when none remain. The legacy
   * single-draft key is removed (the persist effect keeps it removed because
   * the empty article skips the legacy mirror).
   */
  const clearDraft = useCallback(() => {
    removeLegacyDraft();
    suppressLegacyRef.current = true;
    const id = currentDraftIdRef.current;
    const remaining = id ? removeDraft(draftsRef.current, id) : draftsRef.current;
    let final: DraftRecord[];
    if (remaining.length) {
      final = remaining;
      const fallback = mostRecentDraft(final) ?? final[0];
      setCurrentDraftId(fallback.id);
      saveCurrentDraftId(fallback.id);
      setArticle({ ...normalizeArticle(fallback.article) });
    } else {
      const fresh = createDraftRecord({ ...defaultArticle });
      final = [fresh];
      setCurrentDraftId(fresh.id);
      saveCurrentDraftId(fresh.id);
      setArticle({ ...defaultArticle });
    }
    draftsRef.current = final;
    setDrafts(final);
    saveDrafts(final);
  }, []);

  return {
    stage,
    article,
    drafts,
    currentDraftId,
    updateTitle,
    updateContent,
    goToStage,
    updateCoverImage,
    updateDescription,
    addTag,
    removeTag,
    selectTemplate,
    selectSizePreset,
    setCustomWidth,
    setCustomHeight,
    setCoverColor,
    toggleOriginal,
    setLocation,
    setGroupId,
    setRedSkill,
    createDraft,
    switchDraft,
    deleteDraft,
    clearDraft,
  };
}
