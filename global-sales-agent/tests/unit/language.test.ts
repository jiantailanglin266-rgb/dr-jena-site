import { describe, expect, it } from "vitest";
import { detectLanguage } from "@/lib/language/detect";
import { resolveTargetLanguage } from "@/lib/language/layer";

describe("Client Language Detection", () => {
  it("detects Japanese / Korean / Chinese by script", () => {
    expect(detectLanguage("コーポレートサイトのリニューアルをお願いします。")).toBe("ja");
    expect(detectLanguage("홈페이지 리뉴얼을 부탁드립니다. 반응형으로 제작해 주세요.")).toBe("ko");
    expect(detectLanguage("我们需要一个新的企业网站，支持移动端。")).toBe("zh");
  });
  it("detects Latin languages by stop words and accents", () => {
    expect(detectLanguage("We need a new website for our dental clinic with a booking form.")).toBe("en");
    expect(detectLanguage("Necesitamos una nueva web para nuestra clínica dental con formulario de reservas.")).toBe("es");
    expect(detectLanguage("Nous cherchons un développeur pour la refonte du site de notre clinique.")).toBe("fr");
    expect(detectLanguage("Wir suchen eine Agentur für den Relaunch unserer Website mit Terminbuchung.")).toBe("de");
    expect(detectLanguage("Precisamos de um novo site para a nossa clínica com formulário de marcação.")).toBe("pt");
    expect(detectLanguage("Cerchiamo uno sviluppatore per il nuovo sito della nostra clinica con prenotazioni.")).toBe("it");
  });
  it("falls back to en for empty text", () => {
    expect(detectLanguage("")).toBe("en");
  });
  it("Language Layer prefers explicit client language and flags translation need", () => {
    const r = resolveTargetLanguage({ clientLanguage: "de", text: "irrelevant", orgDefault: "ja", sourceLanguage: "ja" });
    expect(r.targetLanguage).toBe("de");
    expect(r.needsTranslation).toBe(true);
    const same = resolveTargetLanguage({ clientLanguage: null, text: "日本語の募集です。", orgDefault: "ja", sourceLanguage: "ja" });
    expect(same.targetLanguage).toBe("ja");
    expect(same.needsTranslation).toBe(false);
  });
});
