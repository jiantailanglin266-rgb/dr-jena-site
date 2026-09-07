import { createManualOnlyConnector } from "../manual-only";

export const crowdworksConnector = createManualOnlyConnector({
  key: "crowdworks",
  displayName: "クラウドワークス",
  website: "https://crowdworks.jp",
  termsUrl: "https://crowdworks.jp/pages/agreement",
  notes: "公開APIなし（旧APIは終了）。規約上、自動化ツールによる応募は制限。案件は手動取込、提案は候補生成＋人間送信。",
  supportedLanguages: ["ja"],
  policy: "PROHIBITED",
});
