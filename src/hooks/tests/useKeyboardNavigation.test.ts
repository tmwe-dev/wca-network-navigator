import { renderHook, act } from "@testing-library/react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

describe("useKeyboardNavigation", () => {
  it("starts at index 0", () => {
    const { result } = renderHook(() => useKeyboardNavigation(5));
    expect(result.current.focusedIndex).toBe(0);
  });

  it("moves down on ArrowDown", () => {
    const { result } = renderHook(() => useKeyboardNavigation(5));
    act(() => { result.current.handleKeyDown({ key: "ArrowDown", preventDefault: vi.fn() } as unknown as React.KeyboardEvent); });
    expect(result.current.focusedIndex).toBe(1);
  });

  it("moves up on ArrowUp", () => {
    const { result } = renderHook(() => useKeyboardNavigation(5));
    act(() => { result.current.setFocusedIndex(3); });
    act(() => { result.current.handleKeyDown({ key: "ArrowUp", preventDefault: vi.fn() } as unknown as React.KeyboardEvent); });
    expect(result.current.focusedIndex).toBe(2);
  });

  it("goes to first on Home", () => {
    const { result } = renderHook(() => useKeyboardNavigation(5));
    act(() => { result.current.setFocusedIndex(3); });
    act(() => { result.current.handleKeyDown({ key: "Home", preventDefault: vi.fn() } as unknown as React.KeyboardEvent); });
    expect(result.current.focusedIndex).toBe(0);
  });

  it("goes to last on End", () => {
    const { result } = renderHook(() => useKeyboardNavigation(5));
    act(() => { result.current.handleKeyDown({ key: "End", preventDefault: vi.fn() } as unknown as React.KeyboardEvent); });
    expect(result.current.focusedIndex).toBe(4);
  });

  it("wraps at boundaries", () => {
    const { result } = renderHook(() => useKeyboardNavigation(3));
    act(() => { result.current.handleKeyDown({ key: "ArrowUp", preventDefault: vi.fn() } as unknown as React.KeyboardEvent); });
    expect(result.current.focusedIndex).toBe(2);
  });
});
