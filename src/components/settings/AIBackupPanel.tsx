import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RefreshCw, Shield, Clock } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";

interface BackupFile {
  name: string;
  created_at: string;
}

export function AIBackupPanel({ userId }: { userId: string }) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage
        .from("ai-backups")
        .list(userId, { sortBy: { column: "created_at", order: "desc" } });
      setBackups((data as BackupFile[]) || []);
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = async (fileName: string) => {
    const { data } = await supabase.storage
      .from("ai-backups")
      .download(`${userId}/${fileName}`);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const triggerBackup = async () => {
    setTriggering(true);
    try {
      await invokeEdge("ai-backup", { context: "AIBackupPanel.triggerBackup" });
      toast.success("Backup completato");
      loadBackups();
    } catch {
      toast.error("Errore nel backup");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Backup AI Knowledge
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadBackups} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
          <Button size="sm" onClick={triggerBackup} disabled={triggering}>
            {triggering ? "Backup..." : "Backup ora"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {backups.length > 0 ? (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between p-2 rounded bg-muted/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{b.name}</span>
                  <span className="text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadBackup(b.name)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Clicca &quot;Aggiorna&quot; per vedere i backup disponibili
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
