import { MATCH_REQUIREMENTS_PROMPT } from '../prompts/system-prompts';
import { queryOllamaJson } from './ollama-client';

export interface RequirementMatchResult {
  requirement_text: string;
  match_type: 'direct' | 'alternative' | 'none';
  profile_evidence: string;
  explanation: string;
  match_score: number;
}

export async function matchRequirements(
  requirementsJson: string,
  profileJson: string,
): Promise<RequirementMatchResult[]> {
  const userPrompt = `REQUIREMENTS:\n${requirementsJson}\n\nCONSULTANT PROFILE:\n${profileJson}`;
  const raw = await queryOllamaJson<unknown>(
    MATCH_REQUIREMENTS_PROMPT,
    userPrompt,
  );
  const rows = extractMatchRows(raw);
  const normalized = rows.map((r) => normalizeMatchRow(r));

  const counts = normalized.reduce(
    (acc, r) => {
      acc[r.match_type] += 1;
      return acc;
    },
    { direct: 0, alternative: 0, none: 0 },
  );
  console.info(
    `[match_requirements] count=${normalized.length} direct=${counts.direct} alternative=${counts.alternative} none=${counts.none}`,
  );

  return normalized;
}

function extractMatchRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const candidates = [obj.matches, obj.result, obj.items, obj.data];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function normalizeMatchRow(raw: unknown): RequirementMatchResult {
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const requirement_text = str(
    row.requirement_text ?? row.requirement ?? row.text ?? row.name,
  );
  const profile_evidence = str(
    row.profile_evidence ?? row.evidence ?? row.profileEvidence,
  );
  const explanation = str(row.explanation ?? row.reasoning ?? row.reason);
  const match_type = normalizeMatchType(
    row.match_type ?? row.matchType ?? row.classification,
    row.match_score ?? row.score,
    explanation,
    profile_evidence,
  );

  return {
    requirement_text,
    match_type,
    profile_evidence,
    explanation,
    match_score:
      match_type === 'direct' ? 1.0 : match_type === 'alternative' ? 0.5 : 0.0,
  };
}

function normalizeMatchType(
  rawType: unknown,
  rawScore: unknown,
  explanation: string,
  evidence: string,
): 'direct' | 'alternative' | 'none' {
  const t = str(rawType).toLowerCase().trim();
  if (t) {
    if (/^direct$|direct_match|exact|volltreffer|direkt/.test(t)) return 'direct';
    if (/alternative|partial|related|similar|alternativ|teilweise/.test(t)) {
      return 'alternative';
    }
    if (/none|no_match|unmatched|kein|nicht/.test(t)) return 'none';
  }

  const numeric = Number(rawScore);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0.75) return 'direct';
    if (numeric >= 0.25) return 'alternative';
    return 'none';
  }

  const signal = `${explanation} ${evidence}`.toLowerCase();
  if (!signal.trim()) return 'none';
  if (/direct|exakt|genau|identisch/.test(signal)) return 'direct';
  if (/alternative|ähnlich|related|vergleichbar|teilweise/.test(signal)) {
    return 'alternative';
  }
  return 'none';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
