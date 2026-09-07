import { createManualOnlyConnector } from "../manual-only";

/** Indeed (contract / freelance listings): the Publisher API is partner-only. Manual import + human application. */
export const indeedConnector = createManualOnlyConnector({
  key: "indeed",
  displayName: "Indeed (contract work)",
  website: "https://www.indeed.com",
  termsUrl: "https://www.indeed.com/legal",
  notes: "Job search API is partner-only and automated applications are not permitted. Import listings manually (or via generic-api with an authorised feed); applications are sent by a person.",
  supportedLanguages: ["*"],
  policy: "PROHIBITED",
});
