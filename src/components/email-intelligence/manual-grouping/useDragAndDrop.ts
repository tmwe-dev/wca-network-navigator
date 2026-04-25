/**
 * useDragAndDrop — Drag and drop state and hover detection.
 *
 * Hit-test source: the **mouse cursor position**, not the dragged card.
 * We continuously track the pointer via document `dragover` (which always
 * reports correct `clientX/Y`, unlike `dragend` which can fire with 0,0
 * on macOS). The drop target is whichever drop-zone the cursor is over
 * at the moment of `dragend` — independent of where the card sits.
 */
import { useState, useEffect } from "react";
import { useRef } from "react";
import type { SenderAnalysis } from "@/types/email-management";

export function useDragAndDrop() {
  const [activeDrag, setActiveDrag] = useState<SenderAnalysis | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  // Last known cursor position during the active drag.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // Track hover detection AND cursor position during drag.
  useEffect(() => {
    if (!activeDrag) return;

    const hitTest = (x: number, y: number) => {
      // Cache last known pointer for use at dragend
      lastPointer.current = { x, y };
      // elementFromPoint walks the DOM at the cursor — most accurate hit test
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const zone = el?.closest('[data-drop-zone="true"]') as HTMLElement | null;
      if (zone) {
        const gid = zone.getAttribute("data-group-id");
        setHoveredGroupId(gid);
      } else {
        setHoveredGroupId(null);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      // dragover always reports correct clientX/Y (unlike dragend on macOS)
      if (e.clientX === 0 && e.clientY === 0) return;
      // Required so the drop event can fire on listening targets
      e.preventDefault();
      hitTest(e.clientX, e.clientY);
    };

    // Fallback: also listen to plain mousemove during drag (some browsers
    // emit it; harmless if they don't).
    const handleMouseMove = (e: MouseEvent) => {
      hitTest(e.clientX, e.clientY);
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [activeDrag]);

  const handleDragEnd = (clientX: number, clientY: number): string | null => {
    if (!activeDrag) return null;

    // Prefer the live cursor position tracked via dragover.
    // Fall back to dragend coordinates only if we never recorded one.
    let x = clientX;
    let y = clientY;
    if (lastPointer.current) {
      x = lastPointer.current.x;
      y = lastPointer.current.y;
    } else if (x === 0 && y === 0) {
      // dragend often fires with (0,0) on macOS — give up cleanly
      setActiveDrag(null);
      setHoveredGroupId(null);
      return null;
    }

    // Hit test by cursor: smaller and more precise target than the card.
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const zone = el?.closest('[data-drop-zone="true"]') as HTMLElement | null;
    const targetGroupId = zone?.getAttribute("data-group-id") ?? null;

    setActiveDrag(null);
    setHoveredGroupId(null);
    lastPointer.current = null;

    return targetGroupId;
  };

  return {
    activeDrag,
    setActiveDrag,
    hoveredGroupId,
    setHoveredGroupId,
    handleDragEnd,
  };
}
