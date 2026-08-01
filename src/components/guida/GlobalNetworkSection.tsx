import SectionWrapper from "./SectionWrapper";
import { useCountryPartnerCounts } from "@/hooks/useCountryPartnerCounts";

const GlobalNetworkSection = () => {
  const { data } = useCountryPartnerCounts();
  const top10 = (data?.countries || [])
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <SectionWrapper className="bg-[#0a0a0f]">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <span className="text-primary text-sm font-bold tracking-widest uppercase">Rete Globale</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">Copertura mondiale</h2>
          <p className="text-white/40 text-lg">
            {data?.activeCountries || 0} paesi con partner attivi — {data?.totalPartners?.toLocaleString() || 0} partner totali
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {top10.map((c, i) => (
            <div key={c.code} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center space-y-2">
              <span className="text-2xl">{i + 1}°</span>
              <h4 className="text-sm font-bold text-white truncate">{c.name}</h4>
              <p className="text-2xl font-black text-primary">{c.count}</p>
              <p className="text-xs text-white/30">partner</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
};

export default GlobalNetworkSection;
