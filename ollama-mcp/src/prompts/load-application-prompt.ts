import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let cached: string | null = null;

function sanitizeMarkdown(raw: string): string {
  return raw
    .replace(/<img[^>]*>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .trim();
}

/**
 * Loads application_prompt.md (repo root or ollama-mcp/prompts).
 * Set APPLICATION_PROMPT_PATH to override.
 */
export function loadApplicationPromptMarkdown(): string {
  if (cached !== null) return cached;

  const envPath = process.env.APPLICATION_PROMPT_PATH?.trim();
  const candidates = [
    envPath,
    join(process.cwd(), 'prompts', 'application_prompt.md'),
    join(process.cwd(), '..', 'application_prompt.md'),
  ].filter((p): p is string => !!p);

  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        cached = sanitizeMarkdown(readFileSync(p, 'utf8'));
        // #region agent log
        fetch('http://host.docker.internal:7596/ingest/ccd82b16-684f-4ff7-a8e1-f72f775ec19c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f99f59'},body:JSON.stringify({sessionId:'f99f59',runId:'initial',hypothesisId:'H1+H2',location:'load-application-prompt.ts:loaded',message:'application_prompt.md loaded',data:{path:p,cwd:process.cwd(),candidates,length:cached.length,containsProfilePlaceholder:cached.includes('{{CONSULTANT_PROFILE_JSON}}'),head:cached.slice(0,200),tail:cached.slice(-200)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return cached;
      }
    } catch {
      /* try next */
    }
  }

  cached = '';
  // #region agent log
  fetch('http://host.docker.internal:7596/ingest/ccd82b16-684f-4ff7-a8e1-f72f775ec19c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f99f59'},body:JSON.stringify({sessionId:'f99f59',runId:'initial',hypothesisId:'H3',location:'load-application-prompt.ts:fallback-empty',message:'no candidate file found; falling back to legacy prompt',data:{cwd:process.cwd(),candidates},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return cached;
}

export function resetApplicationPromptCache(): void {
  cached = null;
}
