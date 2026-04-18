// AES-GCM encryption helpers for LinkedIn credentials/cookies stored in app_settings.
// Uses LINKEDIN_ENCRYPTION_KEY env var if available; otherwise derives from SUPABASE_SERVICE_ROLE_KEY.
// Ciphertext format: base64( IV[12] || ciphertext ). Plaintext values may coexist during migration.

const RAW_KEY =
  Deno.env.get("LINKEDIN_ENCRYPTION_KEY") ||
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").slice(0, 32);

// Tag prefix to identify encrypted values (helps migration: legacy values lack this prefix).
const ENC_PREFIX = "enc:v1:";

async function getKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  // Pad/truncate to 32 bytes for AES-256-GCM
  const keyBytes = new Uint8Array(32);
  const src = encoder.encode(RAW_KEY);
  keyBytes.set(src.slice(0, 32));
  return await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [usage]);
}

export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  const encoder = new TextEncoder();
  const key = await getKey("encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  let bin = "";
  for (const b of combined) bin += String.fromCharCode(b);
  return ENC_PREFIX + btoa(bin);
}

export async function decryptValue(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;
  // Migration fallback: if not prefixed, treat as legacy plaintext.
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext;
  const b64 = ciphertext.slice(ENC_PREFIX.length);
  const bin = atob(b64);
  const combined = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) combined[i] = bin.charCodeAt(i);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await getKey("decrypt");
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(ENC_PREFIX);
}
