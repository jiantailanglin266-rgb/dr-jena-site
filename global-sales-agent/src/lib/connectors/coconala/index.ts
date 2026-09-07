import { createManualOnlyConnector } from "../manual-only";

export const coconalaConnector = createManualOnlyConnector({
  key: "coconala",
  displayName: "ココナラ",
  website: "https://coconala.com",
  termsUrl: "https://coconala.com/pages/about_terms",
  notes: "公開APIなし。利用規約により自動投稿・スクレイピングは不可。案件は手動取込、提案は候補生成＋人間がココナラ上で送信。",
  supportedLanguages: ["ja"],
  policy: "PROHIBITED",
});
