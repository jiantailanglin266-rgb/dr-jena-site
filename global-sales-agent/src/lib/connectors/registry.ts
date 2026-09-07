import type { PlatformConnector } from "./types";
import { coconalaConnector } from "./coconala";
import { crowdworksConnector } from "./crowdworks";
import { lancersConnector } from "./lancers";
import { upworkConnector } from "./upwork";
import { freelancerConnector } from "./freelancer";
import { peopleperhourConnector } from "./peopleperhour";
import { genericApiConnector } from "./generic-api";
import { manualImportConnector } from "./manual-import";
import { demoMarketplaceConnector } from "./demo-marketplace";
import { fiverrConnector } from "./fiverr";
import { indeedConnector } from "./indeed";
import { linkedinConnector } from "./linkedin";

const connectors = new Map<string, PlatformConnector>();

export function registerConnector(c: PlatformConnector) {
  connectors.set(c.key, c);
}

[demoMarketplaceConnector, upworkConnector, freelancerConnector, coconalaConnector, crowdworksConnector, lancersConnector, peopleperhourConnector, fiverrConnector, indeedConnector, linkedinConnector, genericApiConnector, manualImportConnector].forEach(registerConnector);

export function getConnector(key: string): PlatformConnector {
  const c = connectors.get(key);
  if (!c) throw new Error(`Unknown platform connector: ${key}`);
  return c;
}

export function listConnectors(): PlatformConnector[] {
  return Array.from(connectors.values());
}

export function hasConnector(key: string) {
  return connectors.has(key);
}
