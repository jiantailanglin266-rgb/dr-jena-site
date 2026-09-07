/** Static FX table (to USD). Replace with a live provider in production. */
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  JPY: 0.0067,
  EUR: 1.08,
  GBP: 1.27,
  SGD: 0.74,
  AUD: 0.66,
  KRW: 0.00073,
  CNY: 0.14,
  CAD: 0.73,
  INR: 0.012,
  BRL: 0.18,
  CHF: 1.12,
  HKD: 0.128,
  MXN: 0.055,
};

export function toUsd(amount: number | null | undefined, currency: string): number | null {
  if (amount === null || amount === undefined) return null;
  const rate = FX_TO_USD[currency.toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

export function fromUsd(amountUsd: number, currency: string): number {
  const rate = FX_TO_USD[currency.toUpperCase()] ?? 1;
  const v = amountUsd / rate;
  return currency === "JPY" || currency === "KRW" ? Math.round(v) : Math.round(v * 100) / 100;
}

export const COUNTRY_CURRENCY: Record<string, string> = {
  JP: "JPY", US: "USD", GB: "GBP", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", PT: "EUR",
  SG: "SGD", AU: "AUD", KR: "KRW", CN: "CNY", CA: "CAD", BR: "BRL", IN: "INR",
};
