/**
 * Draft-list persistence helpers (P1-3).
 *
 * Storage layout:
 * - `xhs_drafts_v2`        : JSON array of `DraftRecord[]` (the source of truth)
 * - `xhs_drafts_current`   : id of the currently-open draft
 * - `xhs-long-article-draft` : LEGACY single-draft key, kept as a mirror of the
 *                            current article so old auto-save consumers and
 *                            the existing test suite keep working.
 *
 * Migration: when `xhs_drafts_v2` is absent but the legacy key exists, the
 * legacy draft is promoted to the first v2 draft (migrateLegacyToDrafts).
 */
import type { ArticleData, ArticleSize } from '../types';
import { defaultArticleSize } from '../data/templates';

export const DRAFTS_KEY = 'xhs_drafts_v2';
export const CURRENT_DRAFT_KEY = 'xhs_drafts_current';
export const LEGACY_KEY = 'xhs-long-article-draft';

/** One saved draft. `article` is a full snapshot of the article state. */
export interface DraftRecord {
  id: string;
  title: string;
  /** Epoch milliseconds of the last auto-save. */
  updatedAt: number;
  article: ArticleData;
}

/** Collision-resistant, unguessable-ish id for a new draft. */
export function generateDraftId(): string {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Display title of a draft (empty titles show as 未命名长文). */
export function draftTitleOf(article: ArticleData): string {
  return article.title?.trim() ? article.title.trim() : '未命名长文';
}

/** Normalize an arbitrary stored article object onto the default shape. */
export function normalizeArticle(raw: unknown): ArticleData {
  const base: ArticleData = {
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
  if (!raw || typeof raw !== 'object') return base;
  const parsed = { ...base, ...(raw as Partial<ArticleData>) } as ArticleData;
  // Drafts saved before the size feature existed have no valid selectedSize.
  const s = parsed.selectedSize as Partial<ArticleSize> | undefined;
  if (!s || typeof s.width !== 'number' || typeof s.height !== 'number') {
    parsed.selectedSize = defaultArticleSize;
  }
  if (!Array.isArray(parsed.tags)) parsed.tags = [];
  return parsed;
}

/** Create a draft record from an article snapshot. */
export function createDraftRecord(article: ArticleData, now: number = Date.now()): DraftRecord {
  return {
    id: generateDraftId(),
    title: draftTitleOf(article),
    updatedAt: now,
    article: normalizeArticle(article),
  };
}

/* ──────────────────────────────────────────────────────────────────────
 * v2 drafts array
 * ────────────────────────────────────────────────────────────────────── */

/** Load the draft list (never throws; empty array when absent/corrupt). */
export function loadDrafts(): DraftRecord[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d): d is DraftRecord => !!d && typeof d === 'object' && typeof d.id === 'string')
      .map((d) => ({
        id: d.id,
        title: typeof d.title === 'string' ? d.title : draftTitleOf(d.article),
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
        article: normalizeArticle(d.article),
      }));
  } catch {
    return [];
  }
}

/** Persist the draft list (never throws). */
export function saveDrafts(drafts: DraftRecord[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore storage quota / availability errors
  }
}

/** Load the persisted current draft id (null when absent). */
export function loadCurrentDraftId(): string | null {
  try {
    return localStorage.getItem(CURRENT_DRAFT_KEY);
  } catch {
    return null;
  }
}

/** Persist the current draft id (never throws). */
export function saveCurrentDraftId(id: string | null): void {
  try {
    if (id) localStorage.setItem(CURRENT_DRAFT_KEY, id);
    else localStorage.removeItem(CURRENT_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Insert or replace a draft record in the list (returns a new array). */
export function upsertDraft(drafts: DraftRecord[], record: DraftRecord): DraftRecord[] {
  const idx = drafts.findIndex((d) => d.id === record.id);
  if (idx === -1) return [...drafts, record];
  const next = drafts.slice();
  next[idx] = record;
  return next;
}

/** Remove a draft by id (returns a new array). */
export function removeDraft(drafts: DraftRecord[], id: string): DraftRecord[] {
  return drafts.filter((d) => d.id !== id);
}

/** Pick the most recently updated draft (null when list is empty). */
export function mostRecentDraft(drafts: DraftRecord[]): DraftRecord | null {
  if (!drafts.length) return null;
  return drafts.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
}

/* ──────────────────────────────────────────────────────────────────────
 * Legacy single-draft key (backward compatibility)
 * ────────────────────────────────────────────────────────────────────── */

/** Load the legacy single draft (null when absent/corrupt). */
export function loadLegacyDraft(): ArticleData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? normalizeArticle(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Mirror the current article to the legacy key (never throws). */
export function saveLegacyDraft(article: ArticleData): void {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(article));
  } catch {
    // ignore
  }
}

/** Remove the legacy key (used by clearDraft). */
export function removeLegacyDraft(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Migrate the legacy single draft into the v2 draft list.
 * Returns the new list + current id, or null when there is nothing to migrate.
 */
export function migrateLegacyToDrafts(): { drafts: DraftRecord[]; currentId: string } | null {
  const legacy = loadLegacyDraft();
  if (!legacy) return null;
  const record = createDraftRecord(legacy);
  return { drafts: [record], currentId: record.id };
}
