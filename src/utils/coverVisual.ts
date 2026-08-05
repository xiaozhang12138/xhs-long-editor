export interface CoverVisualData {
  keywords: string[];
  seed: number;
  variant: number;
}

/** Stable tiny hash so the same article always gets the same visual. */
function hashText(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Extract 1–3 short visual keywords without any network/API cost.
 * Title phrases take priority, with body phrases used as fallback.
 */
export function buildCoverVisualData(title: string, html: string): CoverVisualData {
  const plain = `${title} ${html.replace(/<[^>]*>/g, ' ')}`
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[，。！？、；：,.!?;:\n\r｜|/\\—–_()[\]{}《》“”"']/g, ' ');
  const phrases = plain
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .flatMap((part) => {
      if (part.length <= 8) return [part];
      return [part.slice(0, 6), part.slice(6, 12)];
    });
  const keywords = [...new Set(phrases)].slice(0, 3);
  if (!keywords.length) keywords.push('灵感', '记录');
  const seed = hashText(`${title}|${keywords.join('|')}`);
  return { keywords, seed, variant: seed % 4 };
}
