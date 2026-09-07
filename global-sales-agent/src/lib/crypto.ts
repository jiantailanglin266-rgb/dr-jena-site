import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("ENCRYPTION_KEY is not set");
    // Deterministic dev fallback — never used in production
    return createHmac("sha256", "dev-encryption-key").digest();
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  // Any other secret string (e.g. a platform-generated random value) → derive a 32-byte key via SHA-256
  if (raw.length < 16) throw new Error("ENCRYPTION_KEY is too short (use `openssl rand -base64 32`)");
  return createHmac("sha256", "gsa-key-derivation").update(raw).digest();
}

/** AES-256-GCM: returns base64(iv | tag | ciphertext) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptJson(obj: unknown): string {
  return encryptSecret(JSON.stringify(obj));
}

export function decryptJson<T = Record<string, unknown>>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  try {
    return JSON.parse(decryptSecret(payload)) as T;
  } catch {
    return null;
  }
}

/** HMAC-SHA256 signature for webhooks: sha256=<hex> over `${timestamp}.${body}` */
export function signWebhook(secret: string, timestamp: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhookSignature(secret: string, timestamp: string, body: string, signature: string, toleranceSec = 300): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = signWebhook(secret, timestamp, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function maskSecret(s: string | null | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "••••";
  return s.slice(0, 3) + "••••" + s.slice(-3);
}
