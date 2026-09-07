import { detectLanguage } from "./detect";
import { LANGUAGE_NAMES } from "../settings";

export interface LanguageResolution {
  detectedLanguage: string;
  targetLanguage: string;
  needsTranslation: boolean;
  reason: string;
}

/**
 * Language Layer: decide which language to write the proposal / reply in.
 * Priority: explicit client language on the job > detected from description > platform default > org default.
 */
export function resolveTargetLanguage(input: {
  clientLanguage?: string | null;
  text: string;
  platformDefault?: string | null;
  orgDefault: string;
  sourceLanguage: string;
}): LanguageResolution {
  const detected = input.clientLanguage?.trim() || detectLanguage(input.text) || input.platformDefault || input.orgDefault;
  const target = detected;
  return {
    detectedLanguage: detected,
    targetLanguage: target,
    needsTranslation: target !== input.sourceLanguage,
    reason: input.clientLanguage ? "job.client_language" : "detected_from_text",
  };
}

export function languageName(code: string) {
  return LANGUAGE_NAMES[code] ?? code;
}
