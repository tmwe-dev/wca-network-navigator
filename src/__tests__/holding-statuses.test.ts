import { describe, it, expect } from "vitest";

/**
 * Tests for holding pattern logic extracted from useHoldingMessages.
 * We test the pure logic (statuses, dedup, grouping) without Supabase.
 */

// Mirror the constants from useHoldingMessages
const HOLDING_STATUSES = ["contacted", "in_progress", "negotiation"];

interface MockMessage {
  id: string;
  message_id_external: string | null;
  subject: string | null;
  from_address: string | null;
  email_date: string | null;
  created_at: string;
  partner_id: string | null;
  read_at: string | null;
  direction: string;
}

// Mirror dedup logic from useHoldingMessages
function deduplicateMessages(messages: MockMessage[]): MockMessage[] {
  const seen = new Set<string>();
  const deduped: MockMessage[] = [];
  for (const msg of messages) {
    if (msg.message_id_external) {
      if (seen.has(msg.message_id_external)) continue;
      seen.add(msg.message_id_external);
    } else {
      const fallbackKey = `${msg.subject || ""}|${msg.from_address || ""}|${msg.email_date || msg.created_at}`;
      if (seen.has(fallbackKey)) continue;
      seen.add(fallbackKey);
    }
    deduped.push(msg);
  }
  return deduped;
}

interface HoldingMessageGroup {
  partnerId: string;
  companyName: string;
  email: string | null;
  leadStatus: string;
  messages: MockMessage[];
  unreadCount: number;
  latestDate: string;
  isImportedContact?: boolean;
}

// Mirror grouping logic
function groupMessages(
  deduped: MockMessage[],
  partnerMap: Map<string, { id: string; company_name: string; email: string | null; lead_status: string }>,
  contactEmailMap: Map<string, { id: string; name: string; email: string | null; lead_status: string }>,
): HoldingMessageGroup[] {
  const groupMap = new Map<string, HoldingMessageGroup>();

  for (const msg of deduped) {
    const pid = msg.partner_id;
    if (pid && partnerMap.has(pid)) {
      if (!groupMap.has(pid)) {
        const p = partnerMap.get(pid)!;
        groupMap.set(pid, {
          partnerId: pid, companyName: p.company_name, email: p.email,
          leadStatus: p.lead_status, messages: [], unreadCount: 0,
          latestDate: msg.email_date || msg.created_at,
        });
      }
      const group = groupMap.get(pid)!;
      group.messages.push(msg);
      if (!msg.read_at) group.unreadCount++;
    } else if (!pid && msg.from_address) {
      const addr = msg.from_address.toLowerCase();
      const contact = contactEmailMap.get(addr);
      if (!contact) continue;
      const groupKey = `contact:${contact.id}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          partnerId: contact.id,
          companyName: contact.name || addr,
          email: contact.email,
          leadStatus: contact.lead_status || "contacted",
          messages: [], unreadCount: 0,
          latestDate: msg.email_date || msg.created_at,
          isImportedContact: true,
        });
      }
      const group = groupMap.get(groupKey)!;
      group.messages.push(msg);
      if (!msg.read_at) group.unreadCount++;
    }
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );
}

describe("HOLDING_STATUSES", () => {
  it("contains exactly the expected statuses", () => {
    expect(HOLDING_STATUSES).toEqual(["contacted", "in_progress", "negotiation"]);
    expect(HOLDING_STATUSES).toHaveLength(3);
  });
});

describe("deduplicateMessages", () => {
  it("deduplicates by message_id_external", () => {
    const msgs: MockMessage[] = [
      { id: "1", message_id_external: "ext-1", subject: "A", from_address: "a@b.com", email_date: null, created_at: "2025-01-01", partner_id: null, read_at: null, direction: "inbound" },
      { id: "2", message_id_external: "ext-1", subject: "A", from_address: "a@b.com", email_date: null, created_at: "2025-01-01", partner_id: null, read_at: null, direction: "inbound" },
    ];
    expect(deduplicateMessages(msgs)).toHaveLength(1);
    expect(deduplicateMessages(msgs)[0].id).toBe("1");
  });

  it("deduplicates by fallback key (subject|from|date)", () => {
    const msgs: MockMessage[] = [
      { id: "1", message_id_external: null, subject: "Hello", from_address: "x@y.com", email_date: "2025-06-01", created_at: "2025-06-01", partner_id: null, read_at: null, direction: "inbound" },
      { id: "2", message_id_external: null, subject: "Hello", from_address: "x@y.com", email_date: "2025-06-01", created_at: "2025-06-01", partner_id: null, read_at: null, direction: "inbound" },
    ];
    expect(deduplicateMessages(msgs)).toHaveLength(1);
  });

  it("keeps messages with different external IDs", () => {
    const msgs: MockMessage[] = [
      { id: "1", message_id_external: "ext-1", subject: "A", from_address: "a@b.com", email_date: null, created_at: "2025-01-01", partner_id: null, read_at: null, direction: "inbound" },
      { id: "2", message_id_external: "ext-2", subject: "A", from_address: "a@b.com", email_date: null, created_at: "2025-01-01", partner_id: null, read_at: null, direction: "inbound" },
    ];
    expect(deduplicateMessages(msgs)).toHaveLength(2);
  });
});

describe("groupMessages", () => {
  it("sorts groups by latestDate descending", () => {
    const msgs: MockMessage[] = [
      { id: "1", message_id_external: "e1", subject: "Old", from_address: "a@b.com", email_date: "2025-01-01", created_at: "2025-01-01", partner_id: "p1", read_at: null, direction: "inbound" },
      { id: "2", message_id_external: "e2", subject: "New", from_address: "c@d.com", email_date: "2025-06-01", created_at: "2025-06-01", partner_id: "p2", read_at: null, direction: "inbound" },
    ];
    const pMap = new Map([
      ["p1", { id: "p1", company_name: "OldCo", email: "a@b.com", lead_status: "contacted" }],
      ["p2", { id: "p2", company_name: "NewCo", email: "c@d.com", lead_status: "in_progress" }],
    ]);
    const groups = groupMessages(msgs, pMap, new Map());
    expect(groups[0].companyName).toBe("NewCo");
    expect(groups[1].companyName).toBe("OldCo");
  });

  it("marks groups from contactEmailMap as isImportedContact", () => {
    const msgs: MockMessage[] = [
      { id: "1", message_id_external: "e1", subject: "Hi", from_address: "import@test.com", email_date: "2025-06-01", created_at: "2025-06-01", partner_id: null, read_at: null, direction: "inbound" },
    ];
    const contactMap = new Map([
      ["import@test.com", { id: "c1", name: "Import Guy", email: "import@test.com", lead_status: "contacted" }],
    ]);
    const groups = groupMessages(msgs, new Map(), contactMap);
    expect(groups).toHaveLength(1);
    expect(groups[0].isImportedContact).toBe(true);
    expect(groups[0].companyName).toBe("Import Guy");
  });
});
