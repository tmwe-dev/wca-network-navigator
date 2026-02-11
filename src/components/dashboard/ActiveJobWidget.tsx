import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, CheckCircle2, XCircle, Pause, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ActiveJob {
  id: string;
  country_name: string;
  network_name: string;
  status: string;
  current_index: number;
  total_count: number;
  last_processed_company: string | null;
  contacts_found_count: number;
  contacts_missing_count: number;
  last_contact_result: string | null;
  error_message: string | null;
}

export function ActiveJobWidget() {
  const [job, setJob] = useState<ActiveJob | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      const { data } = await supabase
        .from("download_jobs")
        .select("id, country_name, network_name, status, current_index, total_count, last_processed_company, contacts_found_count, contacts_missing_count, last_contact_result, error_message")
        .in("status", ["running", "paused", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setJob(data as ActiveJob | null);
    };

    fetchJob();

    // Realtime subscription
    const channel = supabase
      .channel("dashboard-active-job")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "download_jobs" },
        () => fetchJob()
      )
      .subscribe();

    // Poll every 5s as backup
    const interval = setInterval(fetchJob, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (!job) return null;

  const pct = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
  const isRunning = job.status === "running";
  const isPaused = job.status === "paused";

  const contactQuality = job.current_index > 0
    ? Math.round((job.contacts_found_count / job.current_index) * 100)
    : 0;

  return (
    <Card className="p-4 border-l-4 border-l-primary animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : isPaused ? (
            <Pause className="w-4 h-4 text-amber-500" />
          ) : (
            <Loader2 className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">
            {isRunning ? "Acquisizione in corso" : isPaused ? "Acquisizione in pausa" : "In attesa..."}
          </span>
          <Badge variant={isRunning ? "default" : "secondary"} className="text-xs">
            {job.country_name}
          </Badge>
        </div>
        <Link to="/acquisizione">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            Apri <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5 mb-3">
        <Progress value={pct} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{job.current_index}/{job.total_count} partner</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Last processed */}
      {job.last_processed_company && (
        <p className="text-xs text-muted-foreground truncate mb-2">
          Ultimo: <span className="text-foreground font-medium">{job.last_processed_company}</span>
        </p>
      )}

      {/* Contact stats */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <Mail className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">{job.contacts_found_count}</span>
          <span className="text-muted-foreground">con contatti</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5 text-destructive" />
          <span className="font-medium">{job.contacts_missing_count}</span>
          <span className="text-muted-foreground">senza</span>
        </div>
        {job.current_index > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-medium">{contactQuality}%</span>
            <span className="text-muted-foreground">qualità</span>
          </div>
        )}
      </div>

      {/* Error message */}
      {job.error_message && (
        <p className="text-xs text-destructive mt-2 truncate">{job.error_message}</p>
      )}
    </Card>
  );
}
