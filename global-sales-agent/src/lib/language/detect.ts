/**
 * Client Language Detection (heuristic, zero-dependency).
 * Script detection for CJK / Hangul / Cyrillic / Arabic / Thai; stop-word scoring for Latin languages.
 * The Translation Agent can override this with an AI-based detection when a real provider is configured.
 */
const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "for", "with", "we", "need", "looking", "you", "our", "is", "to", "of", "a", "in", "project", "website"],
  es: ["el", "la", "los", "las", "de", "para", "con", "que", "una", "necesitamos", "buscamos", "proyecto", "sitio", "web", "y"],
  fr: ["le", "la", "les", "des", "pour", "avec", "nous", "une", "est", "site", "projet", "cherchons", "besoin", "et", "du"],
  de: ["der", "die", "das", "und", "für", "mit", "wir", "eine", "ist", "suchen", "projekt", "website", "nicht", "auf", "zu"],
  pt: ["o", "a", "os", "as", "de", "para", "com", "que", "uma", "precisamos", "procuramos", "projeto", "site", "e", "não"],
  it: ["il", "la", "gli", "le", "di", "per", "con", "che", "una", "abbiamo", "cerchiamo", "progetto", "sito", "e", "non"],
  nl: ["de", "het", "een", "en", "voor", "met", "wij", "zoeken", "project", "website", "niet", "van"],
  id: ["yang", "dan", "untuk", "dengan", "kami", "membutuhkan", "proyek", "situs", "web", "ini"],
  vi: ["và", "cho", "với", "chúng", "tôi", "cần", "dự", "án", "trang", "web"],
};

export function detectLanguage(text: string): string {
  const t = text ?? "";
  if (!t.trim()) return "en";
  const len = t.length;
  const count = (re: RegExp) => (t.match(re) || []).length;
  const hiragana = count(/[぀-ゟ]/g);
  const katakana = count(/[゠-ヿ]/g);
  const hangul = count(/[가-힯]/g);
  const han = count(/[一-鿿]/g);
  const cyrillic = count(/[Ѐ-ӿ]/g);
  const arabic = count(/[؀-ۿ]/g);
  const thai = count(/[฀-๿]/g);
  const devanagari = count(/[ऀ-ॿ]/g);

  if (hangul / len > 0.05) return "ko";
  if ((hiragana + katakana) / len > 0.03) return "ja";
  if (han / len > 0.1) return "zh";
  if (cyrillic / len > 0.1) return "ru";
  if (arabic / len > 0.1) return "ar";
  if (thai / len > 0.1) return "th";
  if (devanagari / len > 0.1) return "hi";

  const words = t.toLowerCase().replace(/[^\p{L}\s']/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "en";
  const scores: Record<string, number> = {};
  for (const [lang, sw] of Object.entries(STOPWORDS)) {
    const set = new Set(sw);
    scores[lang] = words.filter((w) => set.has(w)).length;
  }
  // accent hints
  if (/[ãõç]/i.test(t)) scores.pt += 2;
  if (/[ñ¿¡]/i.test(t)) scores.es += 3;
  if (/[äöüß]/i.test(t)) scores.de += 3;
  if (/[àâêëîïôûùœ]/i.test(t) || /\bc'est\b/i.test(t)) scores.fr += 2;
  if (/[àèéìòù]\b/i.test(t) && !/[ñ]/i.test(t)) scores.it += 1;
  let best = "en";
  let bestScore = -1;
  for (const [lang, s] of Object.entries(scores)) {
    if (s > bestScore) {
      best = lang;
      bestScore = s;
    }
  }
  return bestScore <= 0 ? "en" : best;
}

export function isSupportedLanguage(lang: string, supported: string[]) {
  return supported.includes(lang);
}
