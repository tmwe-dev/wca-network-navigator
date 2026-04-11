/**
 * EmailDownloadPage — IMAP email sync with progress
 */
import * as React from "react";
import { useEmailDownloadV2 } from "@/v2/hooks/useEmailDownloadV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export function EmailDownloadPage(): React.ReactElement {
  const { data: jobs, startSync, isSyncing } = useEmailDownloadV2();

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Download className="h-5 w-5" /> Download Email
          </h1>
          <p className="text-xs text-muted-foreground">Sincronizzazione IMAP</p>
        </div>
        <Button onClick={() => startSync()} disabled={isSyncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Sincronizzazione..." : "Avvia Sync"}
        </Button>
      </div>

      <div className="space-y-3">
        {!jobs?.length ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun job di sync trovato</CardContent></Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Job {job.id.slice(0, 8)}</CardTitle>
                  <Badge variant={job.status === "completed" ? "secondary" : job.status === "running" ? "default" : "outline"}>
                    {job.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                    {job.status === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
                    {job.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                  <div><span className="text-muted-foreground">Scaricate:</span> {job.downloadedCount}</div>
                  <div><span className="text-muted-foreground">Errori:</span> {job.errorCount}</div>
                  <div><span className="text-muted-foreground">Rimanenti:</span> {job.totalRemaining}</div>
                </div>
                {job.totalRemaining > 0 && (
                  <Progress value={(job.downloadedCount / (job.downloadedCount + job.totalRemaining)) * 100} className="h-2" />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
