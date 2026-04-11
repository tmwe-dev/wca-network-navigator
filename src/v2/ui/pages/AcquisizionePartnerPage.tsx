/**
 * AcquisizionePartnerPage — Pipeline acquisizione partner WCA
 */
import * as React from "react";
import { useState } from "react";
import { useAcquisitionV2 } from "@/v2/hooks/useAcquisitionV2";
import { useDownloadJobsV2 } from "@/v2/hooks/useDownloadJobsV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Globe, Play, Pause, BarChart3 } from "lucide-react";

export function AcquisizionePartnerPage(): React.ReactElement {
  const { data: stats, isLoading: statsLoading } = useAcquisitionV2();
  const { data: jobs } = useDownloadJobsV2();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Download className="h-5 w-5" /> Acquisizione Partner
          </h1>
          <p className="text-xs text-muted-foreground">Pipeline download WCA directory</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{stats?.totalCountries ?? 0} paesi</Badge>
          <Badge variant="secondary">{stats?.totalPartnersFound ?? 0} partner trovati</Badge>
          <Badge variant="outline">{stats?.activeJobs ?? 0} job attivi</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paesi Scansionati</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats?.countriesScanned ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Partner Trovati</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats?.totalPartnersFound ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Job Attivi</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats?.activeJobs ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paesi Totali</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats?.totalCountries ?? 0}</p></CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Job di Download
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!jobs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun job di download attivo</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{job.countryName} ({job.countryCode})</p>
                      <p className="text-xs text-muted-foreground">{job.networkName} • {job.currentIndex}/{job.totalCount}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={job.status === "running" ? "default" : job.status === "completed" ? "secondary" : "outline"}>
                      {job.status}
                    </Badge>
                    {job.status === "running" && <Button size="icon" variant="ghost"><Pause className="h-3 w-3" /></Button>}
                    {job.status === "paused" && <Button size="icon" variant="ghost"><Play className="h-3 w-3" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
