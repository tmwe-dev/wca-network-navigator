/**
 * useDragAndDrop — Drag and drop state and hover detection.
 */
import { useState, useEffect } from "react";
import type { SenderAnalysis } from "@/types/email-management";

export function useDragAndDrop() {
  const [activeDrag, setActiveDrag] = useState<SenderAnalysis | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Track hover detection during drag
  useEffect(() => {
    if (!activeDrag) return;

    const handleDrag = (e: DragEvent) => {
      // Ignore stale drag events
      if (e.clientX === 0 && e.clientY === 0) return;

      const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
      let found = false;

      dropZones.forEach((zone) => {
        const rect = zone.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const gid = zone.getAttribute("data-group-id");
          if (gid) {
            setHoveredGroupId(gid);
            found = true;
          }
        }
      });

      if (!found) setHoveredGroupId(null);
    };

    document.addEventListener("drag", handleDrag);
    return () => document.removeEventListener("drag", handleDrag);
  }, [activeDrag]);

  const handleDragEnd = (clientX: number, clientY: number): string | null => {
    if (!activeDrag) return null;

    const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
    let targetGroupId: string | null = null;

    dropZones.forEach((zone) => {
      const rect = zone.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        targetGroupId = zone.getAttribute("data-group-id");
      }
    });

    setActiveDrag(null);
    setHoveredGroupId(null);

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
