/**
 * TypewriterText — Character-by-character text reveal with customizable speed.
 */
import * as React from "react";
import { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypewriterText({ text, speed = 20, className, onComplete }: TypewriterTextProps): React.ReactElement {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    const timer = setInterval(() => {
      if (indexRef.current >= text.length) {
        clearInterval(timer);
        onComplete?.();
        return;
      }
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayed}
      {indexRef.current < text.length && (
        <span className="animate-pulse text-primary">▊</span>
      )}
    </span>
  );
}
