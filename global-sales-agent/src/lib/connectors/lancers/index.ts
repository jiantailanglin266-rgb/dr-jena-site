import { createManualOnlyConnector } from "../manual-only";

export const lancersConnector = createManualOnlyConnector({
  key: "lancers",
  displayName: "ランサーズ",
  website: "https://www.lancers.jp",
  termsUrl: "https://www.lancers.jp/help/terms",
  notes: "公開APIなし。自動応募・スクレイピングは規約で制限。案件は手動取込、提案は候補生成＋人間送信。",
  supportedLanguages: ["ja"],
  policy: "PROHIBITED",
});
