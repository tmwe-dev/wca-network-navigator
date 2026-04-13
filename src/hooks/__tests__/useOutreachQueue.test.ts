import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    })),
    removeChannel: vi.fn(),
  },
}));
vi.mock("@/lib/api/invokeEdge", () => ({ invokeEdge: vi.fn() }));
vi.mock("@/lib/api/apiError", () => ({ isApiError: vi.fn() }));
vi.mock("@/hooks/useWhatsAppExtensionBridge", () => ({ useWhatsAppExtensionBridge: () => ({ send: vi.fn() }) }));
vi.mock("@/hooks/useLinkedInExtensionBridge", () => ({ useLinkedInExtensionBridge: () => ({ send: vi.fn() }) }));
vi.mock("@/hooks/useTrackActivity", () => ({ useTrackActivity: () => ({ track: vi.fn() }) }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/data/outreachQueue", () => ({
  findPendingOutreachItems: vi.fn().mockResolvedValue([]),
  updateOutreachItem: vi.fn(),
  getOutreachItemField: vi.fn(),
}));

import { useOutreachQueue } from "../useOutreachQueue";

describe("useOutreachQueue", () => {
  it("exposes pendingCount as a number", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(typeof result.current.pendingCount).toBe("number");
  });

  it("exposes processing as a boolean", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(typeof result.current.processing).toBe("boolean");
  });

  it("exposes paused as a boolean", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(typeof result.current.paused).toBe("boolean");
  });

  it("exposes setPaused function", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(typeof result.current.setPaused).toBe("function");
  });
});
