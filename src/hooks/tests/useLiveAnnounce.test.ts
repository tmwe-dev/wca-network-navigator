import { renderHook, act } from "@testing-library/react";
import { useLiveAnnounce } from "@/hooks/useLiveAnnounce";

describe("useLiveAnnounce", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 0; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty message", () => {
    const { result } = renderHook(() => useLiveAnnounce());
    expect(result.current.message).toBe("");
  });

  it("sets message after announce", () => {
    const { result } = renderHook(() => useLiveAnnounce());
    act(() => { result.current.announce("Test message"); });
    expect(result.current.message).toBe("Test message");
  });

  it("updates message on successive calls", () => {
    const { result } = renderHook(() => useLiveAnnounce());
    act(() => { result.current.announce("First"); });
    expect(result.current.message).toBe("First");
    act(() => { result.current.announce("Second"); });
    expect(result.current.message).toBe("Second");
  });

  it("announce returns stable callback", () => {
    const { result, rerender } = renderHook(() => useLiveAnnounce());
    const first = result.current.announce;
    rerender();
    expect(result.current.announce).toBe(first);
  });
});
