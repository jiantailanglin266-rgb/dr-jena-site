import { createManualOnlyConnector } from "../manual-only";

/** LinkedIn: no public job-search API for third parties; automated outreach violates the User Agreement. */
export const linkedinConnector = createManualOnlyConnector({
  key: "linkedin",
  displayName: "LinkedIn (job posts)",
  website: "https://www.linkedin.com",
  termsUrl: "https://www.linkedin.com/legal/user-agreement",
  notes: "No public job-search API; scraping and automated messaging are prohibited. Import posts manually; proposals/InMail drafts are generated for human sending.",
  supportedLanguages: ["*"],
  policy: "PROHIBITED",
});
