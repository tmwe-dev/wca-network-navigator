import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";

function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 6;
}

/** Minutes remaining until 06:00 local time */
function minutesUntilResume(): number {
  const now = new Date();
  const resume = new Date(now);
  resume.setHours(6, 0, 0, 0);
  if (resume <= now) resume.setDate(resume.getDate() + 1);
  return Math.max(0, Math.ceil((resume.getTime() - now.getTime()) / 60_000));
}

export function useGlobalAutoSync() {
  useAutoConnect();

  const [nightPause, setNightPause] = useState(isNightTime);
  const [manualOverride, setManualOverride] = useState(false);
  const [resumeMinutes, setResumeMinutes] = useState(minutesUntilResume);
  const nightCheckRef = useRef<ReturnType<typeof setInterval>>();

  // Check night status every minute (for countdown accuracy)
  useEffect(() => {
    nightCheckRef.current = setInterval(() => {
      const isNight = isNightTime();
      setNightPause(isNight);
      setResumeMinutes(minutesUntilResume());
      // Reset manual override when night ends naturally
      if (!isNight) setManualOverride(false);
    }, 60 * 1000);
    return () => { if (nightCheckRef.current) clearInterval(nightCheckRef.current); };
  }, []);

  const effectivePause = nightPause && !manualOverride;

  const toggleNightPause = useCallback(() => {
    setManualOverride(prev => !prev);
  }, []);

  // Email auto-sync
  const emailSync = useEmailAutoSync({ paused: effectivePause });

  // WhatsApp adaptive sync
  const waSync = useWhatsAppAdaptiveSync();

  const waInitDone = useRef(false);
  useEffect(() => {
    if (waInitDone.current) return;
    waInitDone.current = true;
    if (!waSync.enabled) waSync.setEnabled(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (effectivePause && waSync.enabled) {
      waSync.setEnabled(false);
    } else if (!effectivePause && !waSync.enabled && waInitDone.current) {
      waSync.setEnabled(true);
    }
  }, [effectivePause]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    nightPause: effectivePause,
    isNightTime: nightPause,
    manualOverride,
    toggleNightPause,
    resumeMinutes,
    emailSync,
    waSync,
  };
}
