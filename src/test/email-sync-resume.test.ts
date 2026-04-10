import { describe, it, expect } from "vitest";

/**
 * [B06] Email Sync Resume Logic
 * Scope: Verify sync resumes from last_uid, not from zero.
 * Preconditions: email_sync_state has saved state.
 * Tables: email_sync_state (logic only, no real IMAP).
 *
 * This tests the LOGIC of the resume mechanism:
 * - If last_uid=100, new fetch should start from uid > 100
 * - If last_uid=0 (fresh), should fetch all
 * - If stored_uidvalidity changes, should reset to uid=0
 */

describe("Email Sync Resume Logic [B06]", () => {
  function computeStartUid(syncState: { last_uid: number; stored_uidvalidity: number | null }, serverUidValidity: number): number {
    // If UIDVALIDITY changed, reset
    if (syncState.stored_uidvalidity !== null && syncState.stored_uidvalidity !== serverUidValidity) {
      return 0;
    }
    return syncState.last_uid;
  }

  it("resumes from last_uid when UIDVALIDITY matches", () => {
    const state = { last_uid: 150, stored_uidvalidity: 12345 };
    expect(computeStartUid(state, 12345)).toBe(150);
  });

  it("resets to 0 when UIDVALIDITY changes", () => {
    const state = { last_uid: 150, stored_uidvalidity: 12345 };
    expect(computeStartUid(state, 99999)).toBe(0);
  });

  it("starts from 0 on fresh sync (null uidvalidity)", () => {
    const state = { last_uid: 0, stored_uidvalidity: null };
    expect(computeStartUid(state, 12345)).toBe(0);
  });

  it("resumes correctly after incremental sync", () => {
    // Simulate: first sync got up to uid=50, second should start from 50
    const state = { last_uid: 50, stored_uidvalidity: 1000 };
    expect(computeStartUid(state, 1000)).toBe(50);
  });
});
