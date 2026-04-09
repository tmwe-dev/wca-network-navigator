import { useEffect, useRef, useState } from "react";
import SectionWrapper from "./SectionWrapper";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Globe, Users, Mail, Briefcase, Bot, Cpu } from "lucide-react";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const duration = 2000;
        const start = performance.now();
        const animate = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setCount(Math.floor(eased * target));
          if (p < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const PerformanceSection = () => {
  const { data: stats } = useQuery({
    queryKey: ["guida-stats"],
    queryFn: async () => {
      const [partners, emails, countries, agents, tasks] = await Promise.all([
        supabase.from("partners").select("id", { count: "planned", head: true }).eq("is_active", true),
        supabase.from("channel_messages").select("id", { count: "planned", head: true }).eq("channel", "email"),
        supabase.from("partners").select("country_code").eq("is_active", true),
        supabase.from("agents").select("id", { count: "planned", head: true }).eq("is_active", true),
        supabase.from("agent_tasks").select("id", { count: "planned", head: true }).eq("status", "completed"),
      ]);
      
      const uniqueCountries = new Set((countries.data || []).map((r: any) => r.country_code)).size;
      
      return {
        partners: partners.count || 0,
        emails: emails.count || 0,
        countries: uniqueCountries,
        agents: agents.count || 0,
        tasks: tasks.count || 0,
      };
    },
    staleTime: 60000,
  });

  const metrics = [
    { icon: Users, value: stats?.partners || 0, label: "Partner nel database", suffix: "" },
    { icon: Globe, value: stats?.countries || 0, label: "Paesi con partner attivi", suffix: "" },
    { icon: Mail, value: stats?.emails || 0, label: "Email processate", suffix: "" },
    { icon: Bot, value: stats?.agents || 0, label: "Agenti AI attivi", suffix: "" },
    { icon: Cpu, value: stats?.tasks || 0, label: "Task completati dall'AI", suffix: "" },
    { icon: Briefcase, value: 24, label: "Ore operative / giorno", suffix: "h" },
  ];

  return (
    <>
      {/* Performance 1 - Big Numbers */}
      <SectionWrapper className="bg-[#0a0a0f]">
        <div className="space-y-12">
          <div className="text-center space-y-4">
            <span className="text-primary text-sm font-bold tracking-widest uppercase">Performance</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white">Numeri in tempo reale</h2>
            <p className="text-white/40 text-lg">Dati live dal database di produzione</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {metrics.map(({ icon: Icon, value, label, suffix }) => (
              <div key={label} className="text-center space-y-3 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <Icon className="w-8 h-8 text-primary mx-auto" />
                <div className="text-4xl md:text-5xl font-black text-white">
                  <AnimatedCounter target={value} suffix={suffix} />
                </div>
                <p className="text-sm text-white/40">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* Performance 2 - Impact */}
      <SectionWrapper className="bg-[#0b0b12]">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <span className="text-primary text-sm font-bold tracking-widest uppercase">Impatto</span>
            <h2 className="text-4xl font-bold text-white">ROI misurabile</h2>
            <p className="text-lg text-white/50 leading-relaxed">
              Quello che prima richiedeva un team di 10 persone e mesi di lavoro, 
              oggi viene gestito autonomamente dal sistema con risultati superiori.
            </p>
          </div>
          <div className="space-y-6">
            {[
              { metric: "95%", desc: "Riduzione tempo operativo", bar: 95 },
              { metric: "10×", desc: "Volume contatti gestiti", bar: 85 },
              { metric: "100%", desc: "Copertura follow-up", bar: 100 },
              { metric: "0", desc: "Interventi manuali richiesti", bar: 5 },
            ].map((m) => (
              <div key={m.desc} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/50 text-sm">{m.desc}</span>
                  <span className="text-white font-bold">{m.metric}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all duration-1000" style={{ width: `${m.bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper>
    </>
  );
};

export default PerformanceSection;
