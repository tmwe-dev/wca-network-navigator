/**
 * RAScrapingEnginePage — RA scraping control
 */
import * as React from "react";
import { useRAScrapingV2 } from "@/v2/hooks/useRAScrapingV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Cpu, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RAScrapingEnginePage(): React.ReactElement {
  const { data: jobs } = useRAScrapingV2();

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Cpu className="h-5 w-5" /> Motore Scraping RA
        </h1>
        <p className="text-xs text-muted-foreground">Gestione job di scraping Report Aziende</p>
      </div>

      <div className="space-y-3">
        {!jobs?.length ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun job attivo</CardContent></Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{job.countryName} — {job.networkName}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={job.status === "running" ? "default" : "outline"}>{job.status}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      {job.status === "running" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>{job.currentIndex} / {job.totalCount}</span>
                  <span>{job.totalCount > 0 ? Math.round((job.currentIndex / job.totalCount) * 100) : 0}%</span>
                </div>
                <Progress value={job.totalCount > 0 ? (job.currentIndex / job.totalCount) * 100 : 0} className="h-2" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
