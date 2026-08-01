/**
 * Credential Vault — cifratura applicativa per credenziali sensibili
 * (IMAP/SMTP password, LinkedIn cookie, ecc.).
 *
 * Vol. II §6.2 (segreti) — mai plaintext at rest.
 *
 * Strategia:
 *  - AES-256-GCM via WebCrypto (compatibile browser + Deno edge)
 *  - Chiave master derivata da VITE_CREDENTIAL_VAULT_KEY (env, mai in DB)
 *  - IV random per ogni encrypt → ciphertext include IV in chiaro davanti
 *  - Output formato: base64(iv || ciphertext || authTag)
 *
 * Backwards-compat: i valori plaintext esistenti vengono riconosciuti
 * (no prefisso `v1:`) e migrati al prossimo write.
 */

const VAULT_VERSION = "v1";
const ALG = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

let cachedKey: CryptoKey | null = null;

async function getMasterKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const rawKey = import.meta.env.VITE_CREDENTIAL_VAULT_KEY as string | undefined;
  if (!rawKey || rawKey.length < 32) {
    throw new Error(
      "VITE_CREDENTIAL_VAULT_KEY non configurata o troppo corta (minimo 32 char). " +
      "Genera una chiave con: openssl rand -base64 32"
    );
  }

  // Derive a 256-bit key from the env string via SHA-256
  const enc = new TextEncoder();
  const hashed = await crypto.subtle.digest("SHA-256", enc.encode(rawKey));

  cachedKey = await crypto.subtle.importKey(
    "raw",
    hashed,
    { name: ALG, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
  return cachedKey;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Cifra un valore plaintext con la chiave master.
 * Output: stringa `v1:<base64>` pronta da salvare in DB.
 */
export async function vaultEncrypt(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALG, iv }, key, enc.encode(plaintext))
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return `${VAULT_VERSION}:${bytesToB64(combined)}`;
}

/**
 * Decifra un valore. Se la stringa non ha prefisso `v1:` viene
 * trattata come legacy plaintext e restituita as-is (per migrazione
 * incrementale dei record esistenti).
 */
export async function vaultDecrypt(stored: string): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith(`${VAULT_VERSION}:`)) {
    // Legacy plaintext — segnaliamo nel logger (non throw, no breaking)
    return stored;
  }
  const key = await getMasterKey();
  const combined = b64ToBytes(stored.slice(VAULT_VERSION.length + 1));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: ALG, iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintextBuf);
}

/**
 * Verifica se un valore è già cifrato in formato vault.
 * Utile per migrazioni: leggi → if !isVaulted → encrypt → write.
 */
export function isVaulted(value: string): boolean {
  return !!value && value.startsWith(`${VAULT_VERSION}:`);
}

/**
 * Sostituisce il prefisso versione (per future migrazioni di algoritmo).
 * Per ora identità, ma esposto per testabilità.
 */
export function vaultVersion(): string {
  return VAULT_VERSION;
}
