/**
 * Test message store dedup/merge.
 * Vol. II §10.1 (idempotenza).
 */
import { describe, it, expect } from "vitest";
import {
  mergeMessages,
  prependMessage,
  filterByThread,
  countUnread,
  groupByThread,
} from "@/lib/inbox/messageStore";
import type { ChannelMessage } from "@/lib/inbox/types";

function mk(over: Partial<ChannelMessage>): ChannelMessage {
  return {
    id: over.id ?? "id_" + Math.random().toString(36).slice(2),
    user_id: "u1",
    channel: "email",
    direction: "inbound",
    source_type: null,
    source_id: null,
    partner_id: null,
    from_address: null,
    to_address: null,
    cc_addresses: null,
    bcc_addresses: null,
    subject: null,
    body_text: null,
    body_html: null,
    raw_payload: null,
    message_id_external: null,
    in_reply_to: null,
    read_at: null,
    created_at: "2026-01-01T00:00:00Z",
    email_date: null,
    raw_storage_path: null,
    raw_sha256: null,
    raw_size_bytes: null,
    imap_uid: null,
    uidvalidity: null,
    imap_flags: null,
    internal_date: null,
    parse_status: null,
    parse_warnings: null,
    thread_id: null,
    references_header: null,
    ...over,
  } as ChannelMessage;
}

describe("mergeMessages", () => {
  it("dedupes by id", () => {
    const a = mk({ id: "1", created_at: "2026-01-01T10:00:00Z" });
    const b = mk({ id: "1", created_at: "2026-01-01T11:00:00Z", subject: "updated" });
    const merged = mergeMessages([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].subject).toBe("updated");
  });

  it("sorts by created_at desc", () => {
    const a = mk({ id: "1", created_at: "2026-01-01T08:00:00Z" });
    const b = mk({ id: "2", created_at: "2026-01-01T10:00:00Z" });
    const c = mk({ id: "3", created_at: "2026-01-01T09:00:00Z" });
    const merged = mergeMessages([a], [b, c]);
    expect(merged.map(m => m.id)).toEqual(["2", "3", "1"]);
  });
});

describe("prependMessage", () => {
  it("does nothing if id already exists", () => {
    const a = mk({ id: "1" });
    const result = prependMessage([a], mk({ id: "1", subject: "ignored" }));
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBeNull();
  });

  it("replaces if message_id_external matches", () => {
    const a = mk({ id: "1", message_id_external: "ext1", subject: "old" });
    const incoming = mk({ id: "2", message_id_external: "ext1", subject: "new" });
    const result = prependMessage([a], incoming);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("new");
  });

  it("prepends new message at the start", () => {
    const a = mk({ id: "1" });
    const result = prependMessage([a], mk({ id: "2" }));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("2");
  });
});

describe("countUnread", () => {
  it("counts only messages with read_at === null", () => {
    const msgs = [
      mk({ id: "1", read_at: null }),
      mk({ id: "2", read_at: "2026-01-01T00:00:00Z" }),
      mk({ id: "3", read_at: null }),
    ];
    expect(countUnread(msgs)).toBe(2);
  });
});

describe("filterByThread", () => {
  it("returns only matching thread_id", () => {
    const msgs = [
      mk({ id: "1", thread_id: "t1" }),
      mk({ id: "2", thread_id: "t2" }),
      mk({ id: "3", thread_id: "t1" }),
    ];
    expect(filterByThread(msgs, "t1")).toHaveLength(2);
  });
});

describe("groupByThread", () => {
  it("groups by thread_id and sorts groups by last message desc", () => {
    const msgs = [
      mk({ id: "1", thread_id: "t1", created_at: "2026-01-01T08:00:00Z" }),
      mk({ id: "2", thread_id: "t2", created_at: "2026-01-01T10:00:00Z" }),
      mk({ id: "3", thread_id: "t1", created_at: "2026-01-01T09:00:00Z" }),
    ];
    const grouped = groupByThread(msgs);
    expect(grouped[0].threadId).toBe("t2");
    expect(grouped[1].threadId).toBe("t1");
    expect(grouped[1].messages).toHaveLength(2);
  });
});
