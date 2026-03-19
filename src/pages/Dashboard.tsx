import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Globe } from "lucide-react";

const SuperHome3D = lazy(() => import("./SuperHome3D"));
const GlobalPage = lazy(() => import("./Global"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const containerRef = useRef<HTMLDivElement>(null);

  // Block ALL wheel/trackpad gestures to prevent browser back/forward navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const blockWheel = (e: WheelEvent) => {
      // Always block horizontal swipes (browser back/forward)
      if (Math.abs(e.deltaX) > 2) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Also block touch-based swipe gestures on trackpad
    const blockTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", blockWheel, { passive: false });
    el.addEventListener("touchmove", blockTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", blockWheel);
      el.removeEventListener("touchmove", blockTouchMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden"
      style={{ overscrollBehavior: "none", touchAction: "none" }}
    >
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="home" className="gap-1.5 text-xs">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Mission Control
            </TabsTrigger>
            <TabsTrigger value="global" className="gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5" />
              Global AI
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden" style={{ overscrollBehavior: "none" }}>
        {tab === "home" && (
          <Suspense fallback={<TabFallback />}>
            <SuperHome3D />
          </Suspense>
        )}
        {tab === "global" && (
          <Suspense fallback={<TabFallback />}>
            <GlobalPage />
          </Suspense>
        )}
      </div>
    </div>
  );
}
