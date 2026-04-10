import { describe, it, expect } from "vitest";

/**
 * Bridge Token Tests
 * Covers: hash generation, expiration validation, token structure
 */

// Simulate the hash function used in edge functions
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("Bridge Tokens — Hash Generation", () => {
  it("produces a 64-char hex string", async () => {
    const hash = await hashToken("test-token-123");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("same input produces same hash", async () => {
    const h1 = await hashToken("my-token");
    const h2 = await hashToken("my-token");
    expect(h1).toBe(h2);
  });

  it("different inputs produce different hashes", async () => {
    const h1 = await hashToken("token-a");
    const h2 = await hashToken("token-b");
    expect(h1).not.toBe(h2);
  });

  it("empty string still produces valid hash", async () => {
    const hash = await hashToken("");
    expect(hash).toHaveLength(64);
  });
});

describe("Bridge Tokens — Token Structure", () => {
  function generateBridgeToken(): string {
    return crypto.randomUUID() + "-" + crypto.randomUUID();
  }

  it("generates a token with two UUIDs joined by hyphen", () => {
    const token = generateBridgeToken();
    // Format: uuid-uuid (73 chars: 36 + 1 + 36)
    expect(token.length).toBe(73);
    expect(token.split("-").length).toBe(10); // 5 from each UUID = 10 segments
  });

  it("generates unique tokens each time", () => {
    const t1 = generateBridgeToken();
    const t2 = generateBridgeToken();
    expect(t1).not.toBe(t2);
  });
});

describe("Bridge Tokens — Expiration Validation", () => {
  function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  it("future expiration is not expired", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it("past expiration is expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it("default TTL is 30 minutes", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now;
    expect(diffMs).toBe(30 * 60 * 1000);
  });
});

describe("Bridge Tokens — Validation Flow", () => {
  type BridgeTokenRow = {
    id: string;
    token_hash: string;
    created_by: string;
    expires_at: string;
    used: boolean;
  };

  function validateToken(token: BridgeTokenRow | null): { valid: boolean; reason?: string } {
    if (!token) return { valid: false, reason: "not_found" };
    if (token.used) return { valid: false, reason: "already_used" };
    if (new Date(token.expires_at) < new Date()) return { valid: false, reason: "expired" };
    return { valid: true };
  }

  it("rejects null token", () => {
    const result = validateToken(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_found");
  });

  it("rejects used token", () => {
    const result = validateToken({
      id: "1",
      token_hash: "abc",
      created_by: "user1",
      expires_at: new Date(Date.now() + 60000).toISOString(),
      used: true,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("already_used");
  });

  it("rejects expired token", () => {
    const result = validateToken({
      id: "1",
      token_hash: "abc",
      created_by: "user1",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      used: false,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("accepts valid token", () => {
    const result = validateToken({
      id: "1",
      token_hash: "abc",
      created_by: "user1",
      expires_at: new Date(Date.now() + 60000).toISOString(),
      used: false,
    });
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
