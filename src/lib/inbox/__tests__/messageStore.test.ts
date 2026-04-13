import { describe, it, expect } from "vitest";
import { mergeMessages, prependMessage, countUnread } from "@/lib/inbox/messageStore";
import type { ChannelMessage } from "@/lib/inbox/types";

const msg = (id: string, created_at: string, read_at: string | null = null) =>
  ({ id, created_at, read_at, message_id_external: null, channel: "email", direction: "inbound", user_id: "u1" }) as unknown as ChannelMessage<"email">;

describe("mergeMessages", () => {
  it("merges two lists and deduplicates by id", () => {
    const a = [msg("1", "2024-01-02"), msg("2", "2024-01-01")];
    const b = [msg("2", "2024-01-01"), msg("3", "2024-01-03")];
    const result = mergeMessages(a, b);
    expect(result).toHaveLength(3);
  });

  it("sorts by created_at descending", () => {
    const a = [msg("1", "2024-01-01")];
    const b = [msg("2", "2024-01-03")];
    const result = mergeMessages(a, b);
    expect(result[0].id).toBe("2");
  });
});

describe("prependMessage", () => {
  it("adds message to front", () => {
    const existing = [msg("1", "2024-01-01")];
    const result = prependMessage(existing, msg("2", "2024-01-02"));
    expect(result[0].id).toBe("2");
    expect(result).toHaveLength(2);
  });

  it("deduplicates by id", () => {
    const existing = [msg("1", "2024-01-01")];
    const result = prependMessage(existing, msg("1", "2024-01-01"));
    expect(result).toHaveLength(1);
  });
});

describe("countUnread", () => {
  it("counts messages with null read_at", () => {
    const msgs = [msg("1", "2024-01-01", null), msg("2", "2024-01-02", "2024-01-03")];
    expect(countUnread(msgs)).toBe(1);
  });

  it("returns 0 for all read", () => {
    const msgs = [msg("1", "2024-01-01", "2024-01-02")];
    expect(countUnread(msgs)).toBe(0);
  });
});
