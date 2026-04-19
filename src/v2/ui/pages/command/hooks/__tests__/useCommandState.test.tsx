import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandState } from "../useCommandState";

describe("useCommandState — selection helpers", () => {
  it("toggleSelected adds and removes ids", () => {
    const { result } = renderHook(() => useCommandState());
    expect(result.current.selectedIds.size).toBe(0);

    act(() => result.current.toggleSelected("a"));
    expect(result.current.selectedIds.has("a")).toBe(true);

    act(() => result.current.toggleSelected("b"));
    expect(result.current.selectedIds.size).toBe(2);

    act(() => result.current.toggleSelected("a"));
    expect(result.current.selectedIds.has("a")).toBe(false);
    expect(result.current.selectedIds.has("b")).toBe(true);
  });

  it("selectAll replaces selection set", () => {
    const { result } = renderHook(() => useCommandState());
    act(() => result.current.toggleSelected("x"));
    act(() => result.current.selectAll(["1", "2", "3"]));
    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.selectedIds.has("x")).toBe(false);
  });

  it("clearSelection empties the set", () => {
    const { result } = renderHook(() => useCommandState());
    act(() => result.current.selectAll(["a", "b"]));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("resetForNewMessage clears selection and canvas state", () => {
    const { result } = renderHook(() => useCommandState());
    act(() => {
      result.current.selectAll(["a", "b"]);
      result.current.setActiveToolKey("partner-search");
      result.current.setCanvas("table");
    });
    act(() => result.current.resetForNewMessage());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.activeToolKey).toBeNull();
    expect(result.current.canvas).toBeNull();
  });

  it("addMessage appends with unique id", () => {
    const { result } = renderHook(() => useCommandState());
    act(() => result.current.addMessage({ role: "user", content: "hi", timestamp: "10:00" } as never));
    act(() => result.current.addMessage({ role: "ai", content: "hello", timestamp: "10:01" } as never));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).not.toBe(result.current.messages[1].id);
  });
});
