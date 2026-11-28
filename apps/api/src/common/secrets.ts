import { ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Integration secrets (platform webhook secrets, mailbox tokens) are stored encrypted with AES-256-GCM, never as
 * plain text. The key is INTEGRATIONS_KEY: 32 random bytes, as 64 hex characters or base64. Without it the CRM
 * refuses to store or read such secrets rather than keeping them readable.
 */
function key(): Buffer {
  const raw = (process.env.INTEGRATIONS_KEY ?? "").trim();
  const buffer = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buffer.length !== 32) {
    throw new ServiceUnavailableException("Integrations are not set up on the server: INTEGRATIONS_KEY is missing or not 32 bytes.");
  }
  return buffer;
}

export function integrationsKeySet(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** "v1.<iv>.<tag>.<ciphertext>", base64url parts. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function randomSecret(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

/** Compares two strings in constant time (signatures). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Signs short-lived values (the OAuth `state`) with a key derived from INTEGRATIONS_KEY. */
export function sign(value: string): string {
  return createHmac("sha256", key()).update(`state:${value}`).digest("base64url");
}
