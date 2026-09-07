import type { PricingConfig } from "../settings";
import type { NegotiationOutput } from "../agents/schemas";

export type NegotiationStrategy = NegotiationOutput["strategy"];

export interface OfferEvaluation {
  /** Client's requested price (in pricing currency), if any */
  requestedPrice: number | null;
  /** Our current offer before this round */
  currentOffer: number;
  /** Hard floor — AI may never go below */
  floor: number;
  allowedStrategies: NegotiationStrategy[];
  recommended: NegotiationStrategy;
  /** Offer price for the recommended strategy (>= floor) */
  offerPrice: number;
  discountPct: number;
  requiresHumanApproval: boolean;
  notes: string[];
}

export class PricingViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingViolation";
  }
}

/** Clamp any AI-produced price to the configured floor. Throws when below minimum and strict. */
export function enforceFloor(price: number, cfg: PricingConfig, strict = false): number {
  if (price < cfg.minimumPrice) {
    if (strict) throw new PricingViolation(`Price ${price} is below minimumPrice ${cfg.minimumPrice}`);
    return cfg.minimumPrice;
  }
  return price;
}

export function maxDiscountedPrice(base: number, cfg: PricingConfig): number {
  const discounted = base * (1 - cfg.maximumDiscountPct / 100);
  return Math.max(cfg.minimumPrice, Math.round(discounted));
}

/**
 * Evaluate a negotiation round. Pure function: decides which strategies are permitted and the recommended offer.
 * The AI (Negotiation Agent) may pick among `allowedStrategies` and write the message, but the numeric offer
 * is always re-validated with `enforceFloor`.
 */
export function evaluateOffer(input: {
  currentOffer: number;
  requestedPrice: number | null;
  discountAlreadyAppliedPct: number;
  cfg: PricingConfig;
  roundsSoFar: number;
  requireHumanApprovalForPrice: boolean;
}): OfferEvaluation {
  const { cfg } = input;
  const floor = cfg.minimumPrice;
  const notes: string[] = [];
  const current = Math.max(input.currentOffer, floor);
  const requested = input.requestedPrice;
  const remainingDiscountPct = Math.max(0, cfg.maximumDiscountPct - input.discountAlreadyAppliedPct);
  const lowestAllowed = Math.max(floor, Math.round(current * (1 - remainingDiscountPct / 100)));

  const allowed: NegotiationStrategy[] = ["HOLD", "ADD_OPTION", "MAINTENANCE_CONTRACT", "SPLIT_DELIVERY"];
  if (remainingDiscountPct > 0) allowed.push("DISCOUNT");
  allowed.push("SCOPE_REDUCTION");

  let recommended: NegotiationStrategy = "HOLD";
  let offerPrice = current;
  let discountPct = 0;

  if (requested === null) {
    recommended = input.roundsSoFar === 0 ? "HOLD" : "ADD_OPTION";
    notes.push("No explicit price requested; hold and reinforce value.");
  } else if (requested >= current) {
    recommended = "HOLD";
    notes.push("Requested price is at or above current offer.");
  } else if (requested >= lowestAllowed) {
    recommended = "DISCOUNT";
    offerPrice = Math.max(requested, lowestAllowed);
    discountPct = Math.round((1 - offerPrice / current) * 1000) / 10;
    notes.push(`Discount ${discountPct}% within remaining allowance ${remainingDiscountPct}%.`);
  } else if (requested >= floor) {
    // Between floor and allowed discount: reduce scope rather than price
    recommended = "SCOPE_REDUCTION";
    offerPrice = Math.max(lowestAllowed, floor);
    notes.push("Requested price below discount allowance but above floor → reduce scope.");
  } else {
    recommended = "DECLINE";
    allowed.push("DECLINE");
    offerPrice = floor;
    notes.push(`Requested price ${requested} is below minimumPrice ${floor}; cannot accept.`);
  }
  if (input.roundsSoFar >= 3 && recommended === "DISCOUNT") {
    recommended = "SPLIT_DELIVERY";
    notes.push("Too many discount rounds; switch to split delivery.");
  }
  offerPrice = enforceFloor(offerPrice, cfg);
  const requiresHumanApproval = input.requireHumanApprovalForPrice && (recommended === "DISCOUNT" || recommended === "SCOPE_REDUCTION" || recommended === "DECLINE");
  return { requestedPrice: requested, currentOffer: current, floor, allowedStrategies: allowed, recommended, offerPrice, discountPct, requiresHumanApproval, notes };
}
