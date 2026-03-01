import { useState, useCallback } from "react";
import { CampaignGlobe } from "@/components/campaigns/CampaignGlobe";
import { GlobalChat, type JobCreatedInfo } from "@/components/global/GlobalChat";
import { DownloadStatusPanel } from "@/components/global/DownloadStatusPanel";

export default function Global() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleActiveCountry = useCallback((code: string | null) => {
    if (code) setSelectedCountry(code);
  }, []);

  const handleJobCreated = useCallback((job: JobCreatedInfo) => {
    // Extract country code from job info — the AI returns country name,
    // but the download_jobs table has country_code which DownloadStatusPanel uses
  }, []);

  const handleCountrySelect = useCallback((code: string | null) => {
    setSelectedCountry(code);
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel: Chat + Status */}
      <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-white/10 bg-slate-950/80">
        {/* Chat — upper portion */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <GlobalChat onJobCreated={handleJobCreated} />
        </div>

        {/* Download status — bottom */}
        <div className="border-t border-white/10 max-h-[40%] overflow-auto">
          <DownloadStatusPanel onActiveCountry={handleActiveCountry} />
        </div>
      </div>

      {/* Right panel: 3D Globe */}
      <div className="flex-1 min-w-0">
        <CampaignGlobe
          selectedCountry={selectedCountry}
          onCountrySelect={handleCountrySelect}
        />
      </div>
    </div>
  );
}
