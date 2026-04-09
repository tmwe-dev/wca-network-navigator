import { ReactNode } from "react";

interface ScreenshotFrameProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

const ScreenshotFrame = ({ children, title = "WCA Network Navigator", className = "" }: ScreenshotFrameProps) => {
  return (
    <div className={`rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 ${className}`}>
      {/* macOS title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1c1c1e] border-b border-white/5">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="flex-1 text-center text-xs text-white/40 font-medium">{title}</span>
        <div className="w-12" />
      </div>
      {/* Content */}
      <div className="bg-[#111114]">
        {children}
      </div>
    </div>
  );
};

export default ScreenshotFrame;
