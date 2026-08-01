import { ReactNode } from "react";
import ScreenshotFrame from "./ScreenshotFrame";

interface RealScreenshotProps {
  /** Imported image asset (Vite-bundled). */
  src?: string;
  alt: string;
  title?: string;
  /** Fallback rendered if no real screenshot is provided yet. */
  fallback?: ReactNode;
}

/**
 * RealScreenshot — wraps a real product screenshot inside the macOS-style
 * frame used by the rest of the guide. Falls back gracefully to a mock
 * when the asset is not available, so the guide never breaks.
 */
const RealScreenshot = ({ src, alt, title, fallback }: RealScreenshotProps) => (
  <ScreenshotFrame title={title}>
    {src ? (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="block w-full h-auto"
      />
    ) : (
      <div className="p-6 min-h-[280px]">{fallback}</div>
    )}
  </ScreenshotFrame>
);

export default RealScreenshot;