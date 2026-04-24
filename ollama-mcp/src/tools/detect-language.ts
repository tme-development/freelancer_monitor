import { DETECT_LANGUAGE_PROMPT } from '../prompts/system-prompts';
import { queryOllama } from './ollama-client';

export async function detectLanguage(text: string): Promise<string> {
  const response = await queryOllama(
    DETECT_LANGUAGE_PROMPT,
    text.slice(0, 500),
  );
  const cleaned = response.trim().toLowerCase();
  if (cleaned.includes('de')) return 'de';
  if (cleaned.includes('en')) return 'en';
  return 'de';
}
