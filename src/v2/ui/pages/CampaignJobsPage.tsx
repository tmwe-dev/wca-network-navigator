/**
 * CampaignJobsPage — Campaign jobs monitor
 */
import * as React from "react";
import { useState } from "react";
import { useEmailCampaignQueueV2 } from "@/v2/hooks/useEmailCampaignQueueV2";
import { useOutreachQueueV2 } from "@/v2/hooks/useOutreachQueueV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListChecks, CheckCircle, AlertCircle, Clock } from "lucide-react";

export function CampaignJobsPage(): React.ReactElement {
  const { data: stats } = useEmailCampaignQueueV2();
  const { data: queueItems } = useOutreachQueueV2();

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Monitor Campagne
        </h1>
        <p className="text-xs text-muted-foreground">Stato coda email e job</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">Totale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</p>
            <p className="text-xs text-muted-foreground">In attesa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats?.completed ?? 0}</p>
            <p className="text-xs text-muted-foreground">Completati</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats?.failed ?? 0}</p>
            <p className="text-xs text-muted-foreground">Falliti</p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader><CardTitle className="text-sm">Coda Email</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-350px)]">
            <div className="space-y-2">
              {(queueItems ?? []).slice(0, 100).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div>
                    <p className="font-medium">{item.recipientName ?? item.recipientEmail}</p>
                    <p className="text-xs text-muted-foreground">{item.subject}</p>
                  </div>
                  <Badge variant={item.status === "completed" ? "secondary" : item.status === "failed" ? "destructive" : "outline"}>
                    {item.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                    {item.status === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
                    {item.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
