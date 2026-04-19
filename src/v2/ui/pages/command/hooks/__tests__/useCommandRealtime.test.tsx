import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const channelMock = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};
const removeChannel = vi.fn();
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    channel: vi.fn(() => channelMock),
    removeChannel: (c: unknown) => removeChannel(c),
  },
}));

import { useCommandRealtime } from "../useCommandRealtime";
import { supabase } from "@/integrations/supabase/client";

describe("useCommandRealtime", () => {
  beforeEach(() => {
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
    removeChannel.mockClear();
    (supabase.channel as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it("subscribes to the command_live channel with 5 listeners", async () => {
    renderHook(() => useCommandRealtime());
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith("command_live");
    });
    // 5 .on() chained calls → download_jobs, outreach_queue, agent_action_log, mission_actions, campaign_jobs
    expect(channelMock.on).toHaveBeenCalledTimes(5);
    expect(channelMock.subscribe).toHaveBeenCalledTimes(1);
  });

  it("returns initial empty snapshot", () => {
    const { result } = renderHook(() => useCommandRealtime());
    expect(result.current.activities).toEqual([]);
    expect(result.current.outreachUpdates).toBe(0);
    expect(result.current.jobUpdates).toBe(0);
  });

  it("removes channel on unmount", async () => {
    const { unmount } = renderHook(() => useCommandRealtime());
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(removeChannel).toHaveBeenCalledTimes(1));
  });

  it("does not subscribe when there is no authenticated user", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    (supabase.channel as unknown as ReturnType<typeof vi.fn>).mockClear();
    renderHook(() => useCommandRealtime());
    await new Promise((r) => setTimeout(r, 30));
    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
