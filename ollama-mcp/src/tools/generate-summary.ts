import { GENERATE_SUMMARY_PROMPT } from '../prompts/system-prompts';
import { queryOllama } from './ollama-client';

export async function generateSummary(
  description: string,
  language: string,
): Promise<string> {
  const userPrompt = `Language: ${language}\n\n${description.slice(0, 3000)}`;
  return queryOllama(GENERATE_SUMMARY_PROMPT, userPrompt);
}
