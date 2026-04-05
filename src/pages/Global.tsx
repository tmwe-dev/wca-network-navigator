import { useState, useCallback } from "react";
import { CampaignGlobe } from "@/components/campaigns/CampaignGlobe";
import { DownloadStatusPanel } from "@/components/global/DownloadStatusPanel";

export default function Global() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleActiveCountry = useCallback((code: string | null) => {
    if (code) setSelectedCountry(code);
  }, []);

  const handleCountrySelect = useCallback((code: string | null) => {
    setSelectedCountry(code);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-white/10 bg-slate-950/80">
        <div className="flex-1 min-h-0 overflow-auto">
          <DownloadStatusPanel onActiveCountry={handleActiveCountry} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <CampaignGlobe selectedCountry={selectedCountry} onCountrySelect={handleCountrySelect} />
      </div>
    </div>
  );
}
