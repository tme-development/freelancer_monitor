import { loadApplicationPromptMarkdown } from '../prompts/load-application-prompt';
import {
  GENERATE_APPLICATION_JSON_RULES,
  GENERATE_APPLICATION_PROMPT_LEGACY,
} from '../prompts/system-prompts';
import { queryOllamaJson } from './ollama-client';

export interface ApplicationText {
  motivation_paragraph: string | null;
  application_body: string;
  full_application_text: string;
}

const PROFILE_PLACEHOLDER = '{{CONSULTANT_PROFILE_JSON}}';

function buildGenerateApplicationSystemPrompt(profileJson: string): {
  systemPrompt: string;
  placeholderSubstituted: boolean;
} {
  const guide = loadApplicationPromptMarkdown();
  if (guide) {
    const placeholderSubstituted = guide.includes(PROFILE_PLACEHOLDER);
    const guideWithProfile = placeholderSubstituted
      ? guide.split(PROFILE_PLACEHOLDER).join(profileJson)
      : guide;
    return {
      systemPrompt: [
        '=== BEWERBUNGS-ANLEITUNG (application_prompt.md) ===',
        guideWithProfile,
        '',
        '=== TECHNISCHES AUSGABEFORMAT ===',
        GENERATE_APPLICATION_JSON_RULES,
      ].join('\n'),
      placeholderSubstituted,
    };
  }
  return {
    systemPrompt: GENERATE_APPLICATION_PROMPT_LEGACY,
    placeholderSubstituted: false,
  };
}

export async function generateApplication(
  projectJson: string,
  matchesJson: string,
  profileJson: string,
  isEndcustomer: boolean,
  language: string,
): Promise<ApplicationText> {
  const recipientHint = isEndcustomer
    ? 'Empfänger-Typ: Direkter Kunde — Motivationsschreiben (kurz) erlaubt; setze motivation_paragraph.'
    : 'Empfänger-Typ: Projektvermittler — kein Motivationsschreiben; motivation_paragraph muss null sein.';
  const { systemPrompt, placeholderSubstituted } =
    buildGenerateApplicationSystemPrompt(profileJson);

  const profileSection = placeholderSubstituted
    ? ''
    : `\n\nCONSULTANT PROFILE:\n${profileJson}`;

  const userPrompt = `PROJECT:\n${projectJson}\n\nMATCHES:\n${matchesJson}${profileSection}\n\nis_endcustomer: ${isEndcustomer}\nlanguage: ${language}\n${recipientHint}`;
  const result = await queryOllamaJson<ApplicationText>(
    systemPrompt,
    userPrompt,
  );

  return {
    motivation_paragraph: isEndcustomer
      ? result.motivation_paragraph || null
      : null,
    application_body: result.application_body || '',
    full_application_text: result.full_application_text || '',
  };
}
