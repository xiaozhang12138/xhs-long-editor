import { useEffect, useState } from 'react';
import type { ArticleData } from '../types';
import type { PageResult } from '../utils/pagination';
import {
  buildPaginationOptions,
  makeCoverPage,
  paginateBlocks,
} from '../utils/pagination';
import { parseContentToBlocks, resolveImageSizes } from '../utils/blockParser';
import { templates } from '../data/templates';

export interface ArticlePages {
  /** Cover page + content pages (cover always first). */
  pages: PageResult[];
  /** True once pagination + image-size resolution finished. */
  ready: boolean;
}

/**
 * Reactively paginate the article content into fixed-height pages.
 *
 * Re-runs whenever the editor content, template or size changes, and waits
 * for embedded image natural sizes to resolve (so page splits are accurate).
 */
export function useArticlePages(article: ArticleData): ArticlePages {
  const [pages, setPages] = useState<PageResult[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    const tpl =
      templates.find((t) => t.id === article.selectedTemplate) || templates[0];
    const options = buildPaginationOptions(article.selectedSize, tpl);
    const blocks = parseContentToBlocks(article.content);

    resolveImageSizes(blocks).then((resolved) => {
      if (cancelled) return;
      const contentPages = paginateBlocks(resolved, options);
      // Cover + content pages share a 0-based pageIndex; renumber so every
      // card has a unique index (click-to-edit relies on it).
      const all = [makeCoverPage(), ...contentPages].map((p, i) => ({
        ...p,
        pageIndex: i,
      }));
      setPages(all);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [article.content, article.selectedTemplate, article.selectedSize]);

  return { pages, ready };
}
