/**
 * useGlobalAutoSync — Orchestratore sync globale.
 *
 * Night pause basata sulle impostazioni agent_work_start_hour / agent_work_end_hour (CET).
 * WhatsApp e LinkedIn sync sono ora solo manuali (click utente).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { supabase } from "@/integrations/supabase/client";

function getCETHour(): number {
  const now = new Date();
  const cetString = now.toLocaleString("en-US", { timeZone: "Europe/Rome", hour12: false, hour: "2-digit" });
  return parseInt(cetString, 10);
}

function isNightTimeCET(startHour: number, endHour: number): boolean {
  const hour = getCETHour();
  if (endHour > startHour) {
    return hour < startHour || hour >= endHour;
  }
  return hour >= endHour && hour < startHour;
}

function minutesUntilResumeCET(startHour: number): number {
  const now = new Date();
  const cetNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const resume = new Date(cetNow);
  resume.setHours(startHour, 0, 0, 0);
  if (resume <= cetNow) resume.setDate(resume.getDate() + 1);
  return Math.max(0, Math.ceil((resume.getTime() - cetNow.getTime()) / 60_000));
}

export function useGlobalAutoSync() {
  useAutoConnect();

  const [nightPause, setNightPause] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [resumeMinutes, setResumeMinutes] = useState(0);
  const nightCheckRef = useRef<ReturnType<typeof setInterval>>();
  const workHoursRef = useRef({ start: 6, end: 24 });

  // Load work hours once from DB
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["agent_work_start_hour", "agent_work_end_hour"])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          if (row.key === "agent_work_start_hour") workHoursRef.current.start = parseInt(row.value || "6", 10);
          if (row.key === "agent_work_end_hour") workHoursRef.current.end = parseInt(row.value || "24", 10);
        }
        const isNight = isNightTimeCET(workHoursRef.current.start, workHoursRef.current.end);
        setNightPause(isNight);
        setResumeMinutes(minutesUntilResumeCET(workHoursRef.current.start));
      });
  }, []);

  // Check night status every minute
  useEffect(() => {
    nightCheckRef.current = setInterval(() => {
      const isNight = isNightTimeCET(workHoursRef.current.start, workHoursRef.current.end);
      setNightPause(isNight);
      setResumeMinutes(minutesUntilResumeCET(workHoursRef.current.start));
      if (!isNight) setManualOverride(false);
    }, 60_000);
    return () => { if (nightCheckRef.current) clearInterval(nightCheckRef.current); };
  }, []);

  const effectivePause = nightPause && !manualOverride;

  const toggleNightPause = useCallback(() => {
    setManualOverride(prev => !prev);
  }, []);

  // Email auto-sync (still managed automatically)
  const emailSync = useEmailAutoSync({ paused: effectivePause });

  return {
    nightPause: effectivePause,
    isNightTime: nightPause,
    manualOverride,
    toggleNightPause,
    resumeMinutes,
    emailSync,
  };
}
