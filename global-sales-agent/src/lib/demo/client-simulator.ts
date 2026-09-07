/**
 * Fake client behaviour for the demo marketplace: given the persona script and the round,
 * produce the next inbound client message in the client's language.
 */
import { fill } from "../ai/mock/phrases";
import { hashString } from "../utils";

const CLIENT_MESSAGES: Record<string, Record<string, string[]>> = {
  ja: {
    INTERESTED: ["ご提案ありがとうございます。内容に興味があります。特に{point}の部分についてもう少し詳しくお聞かせください。", "提案を拝見しました。良さそうですね。ぜひ詳しくお話を伺いたいです。"],
    QUESTION: ["ご提案ありがとうございます。いくつか質問です。納品後のサポート期間はどのくらいですか？また、修正は何回まで可能でしょうか？", "確認させてください。着手までにこちらで準備すべきものは何ですか？進捗はどのように共有されますか？"],
    TECHNICAL_QUESTION: ["技術面で質問です。既存システムとのAPI連携は可能ですか？セキュリティ対策（認証・データ暗号化）についても教えてください。", "使用予定の技術スタックと、将来的に自社エンジニアが保守できる構成かどうかを教えてください。"],
    PRICE_NEGOTIATION: ["ご提案ありがとうございます。正直なところ予算が {price} 程度しかなく、少し高いと感じています。値引きやスコープ調整は可能でしょうか？", "内容は魅力的ですが金額がネックです。{price} まで下げていただくことは可能ですか？"],
    SCHEDULE_NEGOTIATION: ["スケジュールについて相談です。社内の都合で {deadline} までに納品してほしいのですが、可能でしょうか？", "納期をもう少し早めることはできますか？急ぎのため、{deadline} を希望します。"],
    REQUEST_PORTFOLIO: ["同業種での実績やポートフォリオがあれば見せていただけますか？事例を確認してから判断したいです。"],
    REQUEST_MEETING: ["一度オンラインで打ち合わせをお願いできますか？来週の火曜か水曜の午後が空いています。"],
    OBJECTION: ["以前別の業者に依頼して失敗した経験があり、正直少し不安です。品質をどのように担保されるのか、保証はあるのか教えてください。"],
    ACCEPTANCE: ["社内で検討した結果、御社にお願いすることに決めました。条件（{price}、納期）で進めましょう。契約手続きをお願いします。", "ありがとうございます。この内容で発注します。契約の進め方を教えてください。"],
    REJECTION: ["ご提案ありがとうございました。今回は他社にお願いすることになりました。またの機会によろしくお願いします。"],
  },
  en: {
    INTERESTED: ["Thanks for the proposal — this sounds good. I'd like to hear more about {point} before we go further.", "Appreciate the detailed proposal. We're interested. Can you tell me more about how you'd handle the first phase?"],
    QUESTION: ["Thanks. A few questions: how long is the post-launch support period? How many revision rounds are included? What do you need from us before starting?", "Could you clarify how progress is reported and what tools you use for communication?"],
    TECHNICAL_QUESTION: ["Quick technical question: can this integrate with our existing system via API? What's your approach to security (authentication, data encryption)?", "Which stack would you use, and could our in-house engineers maintain it afterwards?"],
    PRICE_NEGOTIATION: ["Thanks for the proposal. Honestly our budget is around {price}, so the quote feels a bit high. Is there any room on price or scope?", "The plan looks solid but the cost is the sticking point. Could you do it for {price}?"],
    SCHEDULE_NEGOTIATION: ["On timing — we need this delivered by {deadline} for an internal launch. Is that feasible?", "Could you deliver sooner? Ideally by {deadline}."],
    REQUEST_PORTFOLIO: ["Could you share a portfolio or examples of similar work in our industry? We'd like to review case studies before deciding."],
    REQUEST_MEETING: ["Could we hop on a call to discuss? I'm free Tuesday or Wednesday afternoon next week."],
    OBJECTION: ["We had a bad experience with a previous vendor, so I'm a bit hesitant. How do you guarantee quality, and what happens if we're not satisfied?"],
    ACCEPTANCE: ["We've decided to go ahead with you. Let's proceed at {price} with the timeline discussed — please send over the contract.", "Great — we accept. Please let us know the next steps for the contract."],
    REJECTION: ["Thank you for the proposal. We've decided to go with another provider this time. Best of luck."],
  },
  de: {
    INTERESTED: ["Vielen Dank für das Angebot – das klingt gut. Ich würde gern mehr über {point} erfahren, bevor wir weitermachen."],
    QUESTION: ["Danke. Ein paar Fragen: Wie lange ist der Support nach dem Launch? Wie viele Korrekturrunden sind enthalten? Was benötigen Sie von uns vor dem Start?"],
    TECHNICAL_QUESTION: ["Technische Frage: Ist eine Integration mit unserem bestehenden System per API möglich? Wie gehen Sie mit Sicherheit (Authentifizierung, Verschlüsselung) um?"],
    PRICE_NEGOTIATION: ["Danke für das Angebot. Unser Budget liegt ehrlich gesagt bei etwa {price}, das Angebot erscheint uns etwas teuer. Gibt es Spielraum beim Preis oder Umfang?"],
    SCHEDULE_NEGOTIATION: ["Zum Zeitplan: Wir bräuchten die Lieferung bis {deadline}. Ist das machbar?"],
    REQUEST_PORTFOLIO: ["Könnten Sie Referenzen oder Arbeitsproben aus unserer Branche schicken? Wir möchten Beispiele sehen, bevor wir entscheiden."],
    REQUEST_MEETING: ["Können wir ein kurzes Gespräch vereinbaren? Nächste Woche Dienstag oder Mittwoch nachmittags passt bei uns."],
    OBJECTION: ["Wir hatten mit einem früheren Anbieter schlechte Erfahrungen und sind daher etwas unsicher. Wie sichern Sie die Qualität ab, und gibt es eine Garantie?"],
    ACCEPTANCE: ["Wir haben uns für Sie entschieden. Legen wir los – zu {price} und dem besprochenen Zeitplan. Bitte senden Sie den Vertrag."],
    REJECTION: ["Vielen Dank für Ihr Angebot. Wir haben uns diesmal für einen anderen Anbieter entschieden."],
  },
  fr: {
    INTERESTED: ["Merci pour votre proposition, cela m'intéresse. J'aimerais en savoir plus sur {point} avant d'aller plus loin."],
    QUESTION: ["Merci. Quelques questions : quelle est la durée du support après la mise en ligne ? Combien de séries de corrections sont incluses ? Que devons-nous préparer avant le démarrage ?"],
    TECHNICAL_QUESTION: ["Question technique : l'intégration avec notre système existant via API est-elle possible ? Quelle est votre approche de la sécurité (authentification, chiffrement) ?"],
    PRICE_NEGOTIATION: ["Merci pour la proposition. Honnêtement, notre budget est d'environ {price}, le devis nous paraît un peu élevé. Y a-t-il une marge sur le prix ou le périmètre ?"],
    SCHEDULE_NEGOTIATION: ["Concernant le calendrier, nous aurions besoin d'une livraison avant le {deadline}. Est-ce faisable ?"],
    REQUEST_PORTFOLIO: ["Pourriez-vous partager un portfolio ou des exemples de réalisations dans notre secteur ? Nous aimerions voir des références avant de décider."],
    REQUEST_MEETING: ["Pourrions-nous organiser un appel ? Je suis disponible mardi ou mercredi après-midi la semaine prochaine."],
    OBJECTION: ["Nous avons eu une mauvaise expérience avec un prestataire précédent, je suis donc un peu hésitant. Comment garantissez-vous la qualité, et quelle garantie proposez-vous ?"],
    ACCEPTANCE: ["Nous avons décidé de travailler avec vous. Allons-y à {price} avec le calendrier convenu — merci d'envoyer le contrat."],
    REJECTION: ["Merci pour votre proposition. Nous avons choisi un autre prestataire cette fois-ci."],
  },
  es: {
    INTERESTED: ["Gracias por la propuesta, me interesa. Me gustaría saber más sobre {point} antes de seguir."],
    QUESTION: ["Gracias. Algunas preguntas: ¿cuánto dura el soporte tras el lanzamiento? ¿Cuántas rondas de cambios se incluyen? ¿Qué necesitan de nosotros antes de empezar?"],
    TECHNICAL_QUESTION: ["Pregunta técnica: ¿es posible la integración con nuestro sistema actual mediante API? ¿Cómo gestionan la seguridad (autenticación, cifrado)?"],
    PRICE_NEGOTIATION: ["Gracias por la propuesta. Sinceramente nuestro presupuesto es de unos {price}; el precio nos parece algo alto. ¿Hay margen en precio o alcance?"],
    SCHEDULE_NEGOTIATION: ["Sobre los plazos: necesitaríamos la entrega antes del {deadline}. ¿Es viable?"],
    REQUEST_PORTFOLIO: ["¿Podrían compartir un portafolio o ejemplos de trabajos en nuestro sector? Queremos ver casos antes de decidir."],
    REQUEST_MEETING: ["¿Podemos tener una llamada? Estoy disponible el martes o miércoles por la tarde de la próxima semana."],
    OBJECTION: ["Tuvimos una mala experiencia con un proveedor anterior y estoy algo dudoso. ¿Cómo garantizan la calidad y qué garantía ofrecen?"],
    ACCEPTANCE: ["Hemos decidido seguir adelante con ustedes. Procedamos con {price} y el calendario acordado; envíen el contrato, por favor."],
    REJECTION: ["Gracias por la propuesta. Esta vez hemos elegido otro proveedor."],
  },
  ko: {
    INTERESTED: ["제안 감사합니다. 내용이 좋아 보입니다. 진행 전에 {point} 부분을 좀 더 자세히 듣고 싶습니다."],
    QUESTION: ["감사합니다. 몇 가지 질문이 있습니다. 오픈 후 지원 기간은 얼마나 되나요? 수정은 몇 회까지 가능한가요? 시작 전에 저희가 준비해야 할 것은 무엇인가요?"],
    TECHNICAL_QUESTION: ["기술 질문입니다. 기존 시스템과 API 연동이 가능한가요? 보안(인증, 데이터 암호화)은 어떻게 처리하시나요?"],
    PRICE_NEGOTIATION: ["제안 감사합니다. 솔직히 예산이 {price} 정도라 견적이 조금 높게 느껴집니다. 가격이나 범위 조정이 가능할까요?"],
    SCHEDULE_NEGOTIATION: ["일정 관련해서, 내부 사정으로 {deadline}까지 납품이 필요합니다. 가능할까요?"],
    REQUEST_PORTFOLIO: ["동종 업계 포트폴리오나 사례를 공유해 주실 수 있나요? 사례를 확인한 후 결정하고 싶습니다."],
    REQUEST_MEETING: ["온라인 미팅을 한번 진행할 수 있을까요? 다음 주 화요일이나 수요일 오후가 가능합니다."],
    OBJECTION: ["이전 업체와 좋지 않은 경험이 있어 솔직히 조금 걱정됩니다. 품질은 어떻게 보장하시나요? 보장 조건이 있나요?"],
    ACCEPTANCE: ["내부 검토 결과 귀사와 진행하기로 결정했습니다. {price}와 논의한 일정으로 진행하겠습니다. 계약서를 보내주세요."],
    REJECTION: ["제안 감사합니다. 이번에는 다른 업체와 진행하기로 했습니다."],
  },
};

export interface SimulatedReplyInput {
  persona: string[];
  round: number; // 0-based index of client reply
  language: string;
  proposedPrice: number | null;
  currency: string;
  minimumPriceLocal: number | null;
  jobId: string;
  category?: string | null;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export function simulateClientReply(input: SimulatedReplyInput): { category: string; text: string } | null {
  const category = input.persona[input.round];
  if (!category) return null;
  const packs = CLIENT_MESSAGES[input.language] ?? CLIENT_MESSAGES.en;
  const options = packs[category] ?? CLIENT_MESSAGES.en[category] ?? ["..."];
  const seed = hashString(`${input.jobId}-${input.round}`);
  const tpl = options[seed % options.length];
  // Requested price: persona[4] (double price negotiation → rejection) asks below floor on 2nd round
  let price = input.proposedPrice ?? 0;
  if (category === "PRICE_NEGOTIATION") {
    const lowball = input.round >= 1 && input.persona[input.round + 1] === "REJECTION";
    if (lowball) {
      // Hard-bargaining persona: asks clearly below the seller's minimum price → Pricing Engine must DECLINE
      price = Math.round(Math.min((input.proposedPrice ?? 0) * 0.45, (input.minimumPriceLocal ?? (input.proposedPrice ?? 0) * 0.45) * 0.7));
    } else {
      price = Math.round((input.proposedPrice ?? 0) * 0.82);
      if (input.minimumPriceLocal) price = Math.max(price, Math.round(input.minimumPriceLocal * 1.02));
    }
  }
  const deadline = new Date(Date.now() + (14 + (seed % 20)) * 86400000).toISOString().slice(0, 10);
  const points: Record<string, string> = { ja: "工程と納期", en: "the timeline and phases", de: "den Zeitplan", fr: "le calendrier", es: "el calendario", ko: "일정과 단계" };
  const text = fill(tpl, { price: money(price, input.currency), deadline, point: points[input.language] ?? points.en });
  return { category, text };
}
