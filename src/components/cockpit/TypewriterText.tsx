import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import DOMPurify from "dompurify";

export function TypewriterText({ text, speed = 20, isHtml = false }: { text: string; speed?: number; isHtml?: boolean }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;
    if (!text) return;

    const interval = setInterval(() => {
      indexRef.current += 3;
      const slice = text.slice(0, indexRef.current);
      setDisplayed(slice);
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  const cursor = !done && text && (
    <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-text-bottom" />
  );

  if (isHtml) {
    return (
      <span>
        <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayed) }} />
        {cursor}
      </span>
    );
  }

  return (
    <span className="whitespace-pre-wrap">
      {displayed}
      {cursor}
    </span>
  );
}
