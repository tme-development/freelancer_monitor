/** Fields for the canonical “Published” date (Freelancermap listing time + fallbacks). */
export type ProjectPublishFields = {
  external_created?: string | null;
  scraped_at?: string | null;
  created_at?: string | null;
};

/**
 * Published date: FM listing timestamp, then first scrape, then DB row created.
 */
export function getProjectPublishRaw(
  p: ProjectPublishFields | null | undefined,
): string | Date | null {
  if (!p) return null;
  const v = p.external_created ?? p.scraped_at ?? p.created_at;
  return v ?? null;
}

export function formatFmDate(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function formatProjectPublishDate(
  p: ProjectPublishFields | null | undefined,
): string {
  const raw = getProjectPublishRaw(p);
  return raw ? formatFmDate(raw) : 'n/a';
}
