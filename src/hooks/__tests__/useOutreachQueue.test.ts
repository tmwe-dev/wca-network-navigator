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
  it("initializes with processing=false", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(result.current.processing).toBe(false);
  });

  it("initializes with pendingCount=0", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(result.current.pendingCount).toBe(0);
  });

  it("initializes with paused=false", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(result.current.paused).toBe(false);
  });

  it("exposes setPaused function", () => {
    const { result } = renderHook(() => useOutreachQueue());
    expect(typeof result.current.setPaused).toBe("function");
  });
});
