/**
 * Acquisition Pipeline — State management (extracted from useAcquisitionPipeline)
 * Manages all the reactive state for the acquisition pipeline UI.
 */
import { useState, useRef } from "react";
import { QueueItem, CanvasData, CanvasPhase } from "@/components/acquisition/types";
import { NetworkStats, NetworkRegression } from "@/components/acquisition/NetworkPerformanceBar";

export type PipelineStatus = "idle" | "scanning" | "running" | "paused" | "done";
export type SessionHealth = "unknown" | "checking" | "active" | "recovering" | "dead";

export interface LiveStats {
  processed: number;
  withEmail: number;
  withPhone: number;
  complete: number;
  empty: number;
  failedLoads: number;
}

export interface ScanStats {
  total: number;
  existing: number;
  missing: number;
}

export const EMPTY_STATS: LiveStats = { processed: 0, withEmail: 0, withPhone: 0, complete: 0, empty: 0, failedLoads: 0 };

export function useAcquisitionPipelineState() {
  // Toolbar state
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(8);
  const [includeEnrich, setIncludeEnrich] = useState(false);
  const [includeDeepSearch, setIncludeDeepSearch] = useState(false);

  // Pipeline state
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>("idle");
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [qualityComplete, setQualityComplete] = useState(0);
  const [qualityIncomplete, setQualityIncomplete] = useState(0);
  const [showComet, setShowComet] = useState(false);
  const [showSessionAlert, setShowSessionAlert] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [liveStats, setLiveStats] = useState<LiveStats>(EMPTY_STATS);

  // Network performance tracking
  const [networkStats, setNetworkStats] = useState<Record<string, NetworkStats>>({});
  const [excludedNetworks, setExcludedNetworks] = useState<Set<string>>(new Set());
  const excludedNetworksRef = useRef<Set<string>>(new Set());
  const [networkRegressions, setNetworkRegressions] = useState<NetworkRegression[]>([]);
  const networkBaselineRef = useRef<Record<string, { successes: number; consecutiveFailures: number }>>({});

  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>("unknown");

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const pollingAbortRef = useRef(false);
  const extensionWarningShown = useRef(false);

  return {
    // Toolbar
    selectedCountries, setSelectedCountries,
    selectedNetworks, setSelectedNetworks,
    delaySeconds, setDelaySeconds,
    includeEnrich, setIncludeEnrich,
    includeDeepSearch, setIncludeDeepSearch,
    // Pipeline
    pipelineStatus, setPipelineStatus,
    queue, setQueue,
    activeIndex, setActiveIndex,
    canvasData, setCanvasData,
    canvasPhase, setCanvasPhase,
    isAnimatingOut, setIsAnimatingOut,
    completedCount, setCompletedCount,
    qualityComplete, setQualityComplete,
    qualityIncomplete, setQualityIncomplete,
    showComet, setShowComet,
    showSessionAlert, setShowSessionAlert,
    selectedIds, setSelectedIds,
    activeJobId, setActiveJobId,
    resumeLoading, setResumeLoading,
    liveStats, setLiveStats,
    // Network
    networkStats, setNetworkStats,
    excludedNetworks, setExcludedNetworks,
    excludedNetworksRef,
    networkRegressions, setNetworkRegressions,
    networkBaselineRef,
    // Scan
    scanStats, setScanStats,
    // Session
    sessionHealth, setSessionHealth,
    // Refs
    pauseRef, cancelRef, pollingAbortRef, extensionWarningShown,
  };
}
