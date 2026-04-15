import { useEffect, useState, useRef } from "react";
import { pingExtension } from "@/v2/io/extensions/bridge";
import type { ExtensionRequest } from "@/v2/io/extensions/bridge";

interface ExtensionInfo {
  target: ExtensionRequest["target"];
  label: string;
}

const EXTENSIONS: ExtensionInfo[] = [
  { target: "linkedin-scraper", label: "LinkedIn Scraper" },
  { target: "firescrape", label: "Firescrape" },
];

const POLL_INTERVAL = 10_000;

export function ExtensionStatus() {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const check = async () => {
      for (const ext of EXTENSIONS) {
        const alive = await pingExtension(ext.target);
        if (!mountedRef.current) return;
        setStatuses((prev) => ({ ...prev, [ext.target]: alive }));
      }
    };

    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  const active = EXTENSIONS.filter((e) => statuses[e.target]);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {active.map((ext) => (
        <span
          key={ext.target}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary"
          title={`${ext.label} è attivo e pronto`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {ext.label}
        </span>
      ))}
    </div>
  );
}
