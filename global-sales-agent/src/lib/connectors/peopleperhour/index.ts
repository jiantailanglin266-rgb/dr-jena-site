import { createManualOnlyConnector } from "../manual-only";

export const peopleperhourConnector = createManualOnlyConnector({
  key: "peopleperhour",
  displayName: "PeoplePerHour",
  website: "https://www.peopleperhour.com",
  termsUrl: "https://www.peopleperhour.com/site/terms",
  notes: "No public API. Automated proposals are not permitted by the ToS. Import jobs manually; proposals are generated for human sending.",
  supportedLanguages: ["en"],
  policy: "UNKNOWN",
});
