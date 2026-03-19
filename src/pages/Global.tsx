import { useState, useCallback } from "react";
import { CampaignGlobe } from "@/components/campaigns/CampaignGlobe";
import { GlobalChat, type JobCreatedInfo } from "@/components/global/GlobalChat";
import { DownloadStatusPanel } from "@/components/global/DownloadStatusPanel";
import { useDownloadProcessor } from "@/hooks/useDownloadProcessor";

export default function Global() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const { startJob } = useDownloadProcessor();

  const handleActiveCountry = useCallback((code: string | null) => {
    if (code) setSelectedCountry(code);
  }, []);

  const handleJobCreated = useCallback((job: JobCreatedInfo) => {
    // Auto-start the download job created by the AI assistant
    if (job.job_id) {
      startJob(job.job_id);
    }
  }, [startJob]);

  const handleCountrySelect = useCallback((code: string | null) => {
    setSelectedCountry(code);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
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
