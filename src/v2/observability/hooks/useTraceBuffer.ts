import { useEffect, useState } from "react";
import { traceCollector } from "../traceCollector";
import type { TraceEvent } from "../traceTypes";

export function useTraceBuffer(): TraceEvent[] {
  const [events, setEvents] = useState<TraceEvent[]>(() => traceCollector.getBuffer());
  useEffect(() => {
    const unsub = traceCollector.subscribe((evs) => setEvents([...evs]));
    return () => { unsub(); };
  }, []);
  return events;
}