import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
let viewRows: Row[] = [];
let viewError: { message: string } | null = null;
let legacyRows: Row[] = [];
let legacyError: { message: string } | null = null;
let lastFromTable = "";
let lastLimit = 0;

function buildBuilder(rows: Row[], error: { message: string } | null) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.eq = () => builder;
  builder.limit = (n: number) => {
    lastLimit = n;
    return builder;
  };
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: error ? null : rows, error });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      lastFromTable = table;
      if (table === "message_intelligence_v") return buildBuilder(viewRows, viewError);
      return buildBuilder(legacyRows, legacyError);
    },
  },
}));

import { fetchChannelMessagesFromView, fetchChannelMessages } from "../channel-messages";

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  channel: "email",
  direction: "inbound",
  subject: "Hi",
  from_address: "a@b.com",
  to_address: null,
  body_text: null,
  body_html: null,
  partner_id: null,
  category: null,
  read_at: null,
  email_date: "2026-07-20T00:00:00Z",
  created_at: "2026-07-20T00:00:00Z",
};

describe("fetchChannelMessagesFromView (B4.1)", () => {
  beforeEach(() => {
    viewRows = [];
    viewError = null;
    legacyRows = [];
    legacyError = null;
    lastFromTable = "";
    lastLimit = 0;
  });

  it("messaggio classificato: preserva tutti i campi reali (body, to_address, partner_id, read_at, category originale)", async () => {
    viewRows = [
      {
        message_id: baseRow.id,
        user_id: baseRow.user_id,
        channel: "email",
        direction: "inbound",
        subject: "Hi",
        from_address: "a@b.com",
        to_address: "me@x.com",
        body_text: "ciao",
        body_html: "<p>ciao</p>",
        partner_id: "33333333-3333-4333-8333-333333333333",
        message_category: "fornitori",
        read_at: "2026-07-20T01:00:00Z",
        email_date: baseRow.email_date,
        message_created_at: baseRow.created_at,
      },
    ];
    const r = await fetchChannelMessagesFromView(50, "inbound");
    expect(lastFromTable).toBe("message_intelligence_v");
    expect(lastLimit).toBe(50);
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") {
      const m = r.value[0];
      expect(m.bodyText).toBe("ciao");
      expect(m.bodyHtml).toBe("<p>ciao</p>");
      expect(m.toAddress).toBe("me@x.com");
      expect(m.partnerId).toBe("33333333-3333-4333-8333-333333333333");
      expect(m.readAt).toBe("2026-07-20T01:00:00Z");
      expect(m.category).toBe("fornitori");
    }
  });

  it("messaggio NON classificato: è comunque presente con campi rc null", async () => {
    viewRows = [
      {
        message_id: baseRow.id,
        user_id: baseRow.user_id,
        channel: "email",
        direction: "inbound",
        subject: "Not classified yet",
        from_address: "a@b.com",
        to_address: null,
        body_text: "corpo",
        body_html: null,
        partner_id: null,
        message_category: null,
        read_at: null,
        email_date: baseRow.email_date,
        message_created_at: baseRow.created_at,
      },
    ];
    const r = await fetchChannelMessagesFromView(10);
    expect(r._tag).toBe("Ok");
    if (r._tag === "Ok") {
      expect(r.value).toHaveLength(1);
      expect(r.value[0].bodyText).toBe("corpo");
      expect(r.value[0].category).toBeNull();
    }
  });

  it("ritorna Err se la view fallisce (permette al consumer il fallback)", async () => {
    viewError = { message: "boom" };
    const r = await fetchChannelMessagesFromView(10);
    expect(r._tag).toBe("Err");
  });

  it("fetchChannelMessages legacy resta invariato e legge da channel_messages", async () => {
    legacyRows = [baseRow];
    const r = await fetchChannelMessages(25);
    expect(lastFromTable).toBe("channel_messages");
    expect(lastLimit).toBe(25);
    expect(r._tag).toBe("Ok");
  });
});
