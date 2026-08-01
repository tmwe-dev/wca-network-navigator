/**
 * useKeyboardNavigation — Keyboard navigation hook for grid/list components.
 *
 * Provides arrow key (Up/Down/Home/End) navigation for accessible list/table components.
 * The focused index is tracked in state and updated on keydown events.
 *
 * @param itemCount - The total number of navigable items in the list
 * @returns An object with focusedIndex, setFocusedIndex, and handleKeyDown callback
 *
 * @example
 * const { focusedIndex, handleKeyDown } = useKeyboardNavigation(items.length);
 * <div onKeyDown={handleKeyDown}>
 *   {items.map((item, i) => <Row key={i} focused={i === focusedIndex} />)}
 * </div>
 */
import { useState, useCallback } from "react";

export function useKeyboardNavigation(itemCount: number) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
      }
    },
    [itemCount],
  );

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}
