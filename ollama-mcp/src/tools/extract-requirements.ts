import { EXTRACT_REQUIREMENTS_PROMPT } from '../prompts/system-prompts';
import { queryOllamaJson } from './ollama-client';

export interface ExtractedRequirement {
  text: string;
  category: string;
  is_must_have: boolean;
}

const extractionStats = {
  totalCalls: 0,
  normalizedCalls: 0,
  fallbackCalls: 0,
};

export async function extractRequirements(
  description: string,
): Promise<ExtractedRequirement[]> {
  const userPrompt = `Extract all requirements from this project description:\n\n${description}`;
  const raw = await queryOllamaJson<unknown>(
    EXTRACT_REQUIREMENTS_PROMPT,
    userPrompt,
  );
  const normalized = normalizeRequirements(raw);
  extractionStats.totalCalls += 1;

  if (normalized.length > 0) {
    extractionStats.normalizedCalls += 1;
    console.info(
      `[extract_requirements] normalized_count=${normalized.length} ` +
        `calls=${extractionStats.totalCalls} normalized_calls=${extractionStats.normalizedCalls} ` +
        `fallback_calls=${extractionStats.fallbackCalls}`,
    );
    return normalized;
  }

  const fallback = fallbackRequirementsFromText(description);
  extractionStats.fallbackCalls += 1;
  console.warn(
    `[extract_requirements] fallback_used fallback_count=${fallback.length} ` +
      `calls=${extractionStats.totalCalls} normalized_calls=${extractionStats.normalizedCalls} ` +
      `fallback_calls=${extractionStats.fallbackCalls}`,
  );
  return fallback;
}

function normalizeRequirements(raw: unknown): ExtractedRequirement[] {
  const list = extractRequirementList(raw);
  const seen = new Set<string>();
  const result: ExtractedRequirement[] = [];

  for (const item of list) {
    const row =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : null;
    if (!row) continue;

    const textCandidate =
      row.text ?? row.requirement_text ?? row.requirement ?? row.name ?? row.skill;
    const text = typeof textCandidate === 'string' ? textCandidate.trim() : '';
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const categoryCandidate = row.category ?? row.type ?? 'other';
    const category =
      typeof categoryCandidate === 'string' && categoryCandidate.trim()
        ? categoryCandidate.trim().slice(0, 100)
        : 'other';

    const mustHaveRaw = row.is_must_have ?? row.must_have ?? row.mustHave;
    const is_must_have =
      typeof mustHaveRaw === 'boolean'
        ? mustHaveRaw
        : String(mustHaveRaw).toLowerCase() === 'true';

    result.push({ text, category, is_must_have });
  }

  return result;
}

function extractRequirementList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const candidates = [
    obj.requirements,
    obj.items,
    obj.data,
    obj.result,
    obj.extracted_requirements,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function fallbackRequirementsFromText(description: string): ExtractedRequirement[] {
  const lines = description
    .split(/\r?\n+/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length >= 4);

  const candidates = lines
    .filter((l) =>
      /(must|nice|anforder|kenntn|erfahr|skill|technolog|stack|profil|gesucht|wünschenswert|required|requirement)/i.test(
        l,
      ),
    )
    .slice(0, 20);

  if (candidates.length === 0) {
    const compact = description.replace(/\s+/g, ' ').trim();
    if (!compact) return [];
    return [
      {
        text: compact.slice(0, 300),
        category: 'other',
        is_must_have: false,
      },
    ];
  }

  return candidates.map((text) => ({
    text: text.slice(0, 500),
    category: 'other',
    is_must_have: /(must|muss|required|zwingend|a-kriter)/i.test(text),
  }));
}
