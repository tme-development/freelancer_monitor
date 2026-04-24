import { CLASSIFY_POSTER_PROMPT } from '../prompts/system-prompts';
import { queryOllamaJson } from './ollama-client';

export interface ClassificationResult {
  is_endcustomer: boolean;
  reasoning: string;
}

export async function classifyPoster(
  company: string,
  description: string,
): Promise<ClassificationResult> {
  const userPrompt = `COMPANY: ${company}\n\nPROJECT DESCRIPTION:\n${description.slice(0, 2000)}`;
  const result = await queryOllamaJson<ClassificationResult>(
    CLASSIFY_POSTER_PROMPT,
    userPrompt,
  );

  return {
    is_endcustomer: result.is_endcustomer === true,
    reasoning: result.reasoning || '',
  };
}
