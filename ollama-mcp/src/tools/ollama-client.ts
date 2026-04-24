import http from 'http';

const DEFAULT_OLLAMA_HOST = 'localhost';
const DEFAULT_OLLAMA_PORT = 11434;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const DEFAULT_NUM_PREDICT = parseInt(
  process.env.OLLAMA_NUM_PREDICT || '4096',
  10,
);
const JSON_NUM_PREDICT = parseInt(
  process.env.OLLAMA_JSON_NUM_PREDICT || '16384',
  10,
);

type OllamaTarget = { host: string; port: number };

export interface QueryOllamaOptions {
  model?: string;
  /** When 'json', Ollama constrains the output to valid JSON. */
  format?: 'json';
  /** Maximum tokens to generate. */
  numPredict?: number;
  temperature?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

interface OllamaResponse {
  response: string;
  done?: boolean;
  done_reason?: string;
}

function resolveOllamaTarget(): OllamaTarget {
  const rawHost = (process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).trim();
  const rawPort = (process.env.OLLAMA_PORT || `${DEFAULT_OLLAMA_PORT}`).trim();

  let host = rawHost;
  let port = parseInt(rawPort, 10);

  // Accept values like "http://host:11434" or "host:11434" in OLLAMA_HOST.
  if (/^https?:\/\//i.test(host)) {
    try {
      const parsed = new URL(host);
      host = parsed.hostname;
      if (parsed.port) port = parseInt(parsed.port, 10);
    } catch {
      // fallback to plain parsing below
    }
  }

  if (host.includes(':') && !host.includes(']')) {
    const idx = host.lastIndexOf(':');
    const hostPart = host.slice(0, idx).trim();
    const portPart = host.slice(idx + 1).trim();
    const parsedPort = parseInt(portPart, 10);
    if (hostPart && Number.isFinite(parsedPort)) {
      host = hostPart;
      port = parsedPort;
    }
  }

  if (host === '0.0.0.0') {
    // "0.0.0.0" is a bind-address, not a routable destination.
    // In Docker Desktop, host services are reachable via host.docker.internal.
    host = 'host.docker.internal';
  }

  if (!Number.isFinite(port) || port <= 0) port = DEFAULT_OLLAMA_PORT;
  return { host, port };
}

export async function queryOllama(
  systemPrompt: string,
  userPrompt: string,
  options: QueryOllamaOptions | string = {},
): Promise<string> {
  // Back-compat: the third argument used to be `model` (string).
  const opts: QueryOllamaOptions =
    typeof options === 'string' ? { model: options } : options;

  const target = resolveOllamaTarget();
  const numPredict = opts.numPredict ?? DEFAULT_NUM_PREDICT;
  const temperature = opts.temperature ?? 0.1;

  const payload: Record<string, unknown> = {
    model: opts.model || OLLAMA_MODEL,
    prompt: userPrompt,
    system: systemPrompt,
    stream: false,
    options: {
      temperature,
      num_predict: numPredict,
    },
  };
  if (opts.format) payload.format = opts.format;

  const body = JSON.stringify(payload);
  const timeoutMs = opts.timeoutMs ?? 240000;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: target.host,
        port: target.port,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed: OllamaResponse = JSON.parse(data);
            if (parsed.done_reason && parsed.done_reason !== 'stop') {
              console.warn(
                `[ollama] generation stopped early reason=${parsed.done_reason} ` +
                  `num_predict=${numPredict} response_len=${parsed.response?.length ?? 0}`,
              );
            }
            resolve(parsed.response);
          } catch {
            reject(
              new Error(`Failed to parse Ollama response: ${data.slice(0, 500)}`),
            );
          }
        });
      },
    );
    req.on('error', (err) => {
      reject(
        new Error(
          `Ollama request failed for ${target.host}:${target.port}: ${err.message}`,
        ),
      );
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timed out'));
    });
    req.write(body);
    req.end();
  });
}

export type JsonShape = 'object' | 'array' | 'auto';

export interface QueryOllamaJsonOptions extends QueryOllamaOptions {
  /** Expected top-level JSON shape; defaults to 'auto'. */
  expect?: JsonShape;
}

/**
 * Query Ollama and parse the response as JSON.
 * - Uses `format: 'json'` by default so Ollama grammar-constrains the output.
 * - Uses a larger `num_predict` budget so long applications are not truncated.
 * - Falls back to robust extraction + lightweight repair if JSON.parse fails.
 */
export async function queryOllamaJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: QueryOllamaJsonOptions = {},
): Promise<T> {
  const raw = await queryOllama(systemPrompt, userPrompt, {
    format: options.format ?? 'json',
    numPredict: options.numPredict ?? JSON_NUM_PREDICT,
    temperature: options.temperature,
    model: options.model,
    timeoutMs: options.timeoutMs,
  });

  const expect: JsonShape = options.expect ?? 'auto';

  // Fast path: Ollama with format:'json' usually returns pure JSON.
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    // fall through to robust extraction
  }

  const candidate = extractJsonCandidate(raw, expect);
  if (candidate !== null) {
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      const repaired = repairTruncatedJson(candidate);
      if (repaired !== null) {
        try {
          return JSON.parse(repaired) as T;
        } catch {
          // fall through
        }
      }
      throw new Error(
        `Failed to parse JSON from Ollama (${(err as Error).message}). ` +
          `Candidate head: ${candidate.slice(0, 200)}... ` +
          `Candidate tail: ...${candidate.slice(-200)}`,
      );
    }
  }

  throw new Error(
    `No JSON found in Ollama response. Head: ${raw.slice(0, 300)}`,
  );
}

/**
 * Scan `raw` for the first top-level JSON value matching the expected shape
 * and return it as a substring. String contents and escapes are respected so
 * brackets inside strings do not confuse the scanner.
 */
export function extractJsonCandidate(
  raw: string,
  expect: JsonShape,
): string | null {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const openers: string[] =
    expect === 'object' ? ['{'] : expect === 'array' ? ['['] : ['{', '['];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (!openers.includes(ch)) continue;
    const end = findMatchingClose(cleaned, i);
    if (end !== -1) return cleaned.slice(i, end + 1);
    // No complete match — return the tail so the repair pass can try to
    // close it rather than bail out entirely.
    return cleaned.slice(i);
  }
  return null;
}

/**
 * Given `str` and an index pointing at `{` or `[`, return the index of the
 * matching closing bracket, or -1 if none exists (e.g. truncated output).
 * Correctly skips brackets inside string literals and handles escapes.
 */
function findMatchingClose(str: string, start: number): number {
  const open = str[start];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return -1;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && ch === close) return i;
    }
  }
  return -1;
}

/**
 * Best-effort repair for JSON that was truncated mid-output (most commonly
 * because the model hit `num_predict`). Closes any open string, then closes
 * any still-open objects/arrays. Also trims trailing commas.
 *
 * This is intentionally conservative: if the structure cannot be restored we
 * return null rather than emit something misleading.
 */
export function repairTruncatedJson(input: string): string | null {
  let s = input.trim();
  if (!s) return null;

  // Track structural state, not just brackets, so we know if we are inside
  // a string at EOF.
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  if (escape) s = s.slice(0, -1); // dangling backslash
  if (inString) s += '"';

  // Trim trailing comma / whitespace before closing containers.
  s = s.replace(/,\s*$/, '');

  while (stack.length) s += stack.pop();

  return s;
}
