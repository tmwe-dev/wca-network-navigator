import { ReactNode } from "react";
import ScreenshotFrame from "./ScreenshotFrame";

interface Annotation {
  x: string; // percentage
  y: string; // percentage
  label: string;
  side?: "left" | "right";
}

interface AnnotatedScreenshotProps {
  children: ReactNode;
  annotations?: Annotation[];
  title?: string;
  className?: string;
}

const AnnotatedScreenshot = ({ children, annotations = [], title, className }: AnnotatedScreenshotProps) => {
  return (
    <div className={`relative ${className || ""}`}>
      <ScreenshotFrame title={title}>
        <div className="relative">
          {children}
          {/* Annotation dots */}
          {annotations.map((a, i) => (
            <div
              key={i}
              className="absolute z-10"
              style={{ left: a.x, top: a.y, transform: "translate(-50%, -50%)" }}
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 w-6 h-6 -ml-3 -mt-3 rounded-full bg-primary/30 animate-ping" />
              <span className="relative block w-4 h-4 rounded-full bg-primary border-2 border-white shadow-lg" />
              {/* Label */}
              <span
                className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-medium text-white bg-primary/90 px-2 py-1 rounded-md shadow-lg ${
                  a.side === "left" ? "right-6" : "left-6"
                }`}
              >
                {a.label}
              </span>
            </div>
          ))}
        </div>
      </ScreenshotFrame>
    </div>
  );
};

export default AnnotatedScreenshot;
