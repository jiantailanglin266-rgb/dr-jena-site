import { describe, expect, it } from "vitest";
import { evaluateOffer, enforceFloor, maxDiscountedPrice, PricingViolation } from "@/lib/pricing/engine";

const cfg = { minimumPrice: 1000, targetPrice: 3000, idealPrice: 5000, maximumDiscountPct: 15, currency: "USD", hourlyRate: 80 };

describe("Pricing Engine", () => {
  it("never goes below minimumPrice", () => {
    expect(enforceFloor(500, cfg)).toBe(1000);
    expect(() => enforceFloor(500, cfg, true)).toThrow(PricingViolation);
    expect(maxDiscountedPrice(1100, cfg)).toBe(1000);
  });
  it("holds when the client asks at or above the current offer", () => {
    const r = evaluateOffer({ currentOffer: 3000, requestedPrice: 3200, discountAlreadyAppliedPct: 0, cfg, roundsSoFar: 0, requireHumanApprovalForPrice: true });
    expect(r.recommended).toBe("HOLD");
    expect(r.offerPrice).toBe(3000);
    expect(r.requiresHumanApproval).toBe(false);
  });
  it("discounts within the allowance", () => {
    const r = evaluateOffer({ currentOffer: 3000, requestedPrice: 2700, discountAlreadyAppliedPct: 0, cfg, roundsSoFar: 0, requireHumanApprovalForPrice: true });
    expect(r.recommended).toBe("DISCOUNT");
    expect(r.offerPrice).toBe(2700);
    expect(r.discountPct).toBe(10);
    expect(r.requiresHumanApproval).toBe(true);
  });
  it("reduces scope instead of exceeding max discount, and declines below the floor", () => {
    const scope = evaluateOffer({ currentOffer: 3000, requestedPrice: 2000, discountAlreadyAppliedPct: 0, cfg, roundsSoFar: 0, requireHumanApprovalForPrice: false });
    expect(scope.recommended).toBe("SCOPE_REDUCTION");
    expect(scope.offerPrice).toBeGreaterThanOrEqual(2550);
    const decline = evaluateOffer({ currentOffer: 3000, requestedPrice: 800, discountAlreadyAppliedPct: 0, cfg, roundsSoFar: 0, requireHumanApprovalForPrice: false });
    expect(decline.recommended).toBe("DECLINE");
    expect(decline.offerPrice).toBe(1000);
    expect(decline.allowedStrategies).toContain("DECLINE");
  });
  it("accounts for discount already applied in earlier rounds", () => {
    const r = evaluateOffer({ currentOffer: 2700, requestedPrice: 2500, discountAlreadyAppliedPct: 10, cfg, roundsSoFar: 1, requireHumanApprovalForPrice: false });
    // only 5% left → lowest allowed 2565 → requested 2500 is below → scope reduction
    expect(r.recommended).toBe("SCOPE_REDUCTION");
    expect(r.allowedStrategies).toContain("DISCOUNT");
  });
});
