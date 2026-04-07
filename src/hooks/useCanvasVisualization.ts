import { useState } from "react";
import { CanvasData, CanvasPhase } from "@/components/acquisition/types";

export function useCanvasVisualization() {
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>("idle");
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [showComet, setShowComet] = useState(false);

  return {
    canvasData, setCanvasData,
    canvasPhase, setCanvasPhase,
    isAnimatingOut, setIsAnimatingOut,
    showComet, setShowComet,
  };
}
