import { createManualOnlyConnector } from "../manual-only";

/** Fiverr: Buyer Requests / Briefs are not exposed through a public job-search API. Manual import + human sending. */
export const fiverrConnector = createManualOnlyConnector({
  key: "fiverr",
  displayName: "Fiverr",
  website: "https://www.fiverr.com",
  termsUrl: "https://www.fiverr.com/terms_of_service",
  notes: "No public API for briefs/requests; automated messaging is prohibited by the ToS. Import briefs manually; proposals are generated for human sending inside Fiverr.",
  supportedLanguages: ["en", "es", "de", "fr", "pt", "it"],
  policy: "PROHIBITED",
});
