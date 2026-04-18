/**
 * KBSupervisorCanvas — Pannello canvas (destro) con tab Documenti/Documento/Modifiche/Audit
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Save, AlertTriangle, AlertCircle, Info, FileText, List } from "lucide-react";
import type { KBDocument, ProposedAction, CanvasTab } from "@/v2/ui/pages/kb-supervisor/hooks/useKBSupervisorState";

interface AuditIssue {
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly level: string;
  readonly category: string;
  readonly description: string;
  readonly location: string;
  readonly fix_proposal: string;
}

interface AuditReport {
  readonly summary?: {
    readonly total_issues?: number;
    readonly critical?: number;
    readonly high?: number;
    readonly medium?: number;
    readonly low?: number;
  };
  readonly results?: readonly AuditIssue[];
}

interface Props {
  readonly activeDocument: KBDocument | null;
  readonly proposedChanges: ProposedAction | null;
  readonly canvasTab: CanvasTab;
  readonly onTabChange: (tab: CanvasTab) => void;
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onEdit: (field: keyof KBDocument, value: string | string[] | number) => void;
  readonly onSave: () => void;
  readonly auditReport: AuditReport | null;
  readonly documentList: readonly KBDocument[];
  readonly onSelectDocument: (doc: KBDocument) => void;
}

export function KBSupervisorCanvas({
  activeDocument, proposedChanges, canvasTab, onTabChange,
  onApprove, onReject, onEdit, onSave,
  auditReport, documentList, onSelectDocument,
}: Props) {
  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <Tabs value={canvasTab} onValueChange={(v) => onTabChange(v as CanvasTab)} className="flex flex-col h-full">
        <div className="border-b border-border px-3 pt-3 bg-card">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="list" className="gap-1.5 text-xs">
              <List className="w-3.5 h-3.5" /> Documenti
            </TabsTrigger>
            <TabsTrigger value="document" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Documento
            </TabsTrigger>
            <TabsTrigger value="diff" className="gap-1.5 text-xs">
              Modifiche
              {proposedChanges?.status === "pending" && (
                <Badge variant="destructive" className="h-4 px-1 text-[9px]">!</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" /> Audit
            </TabsTrigger>
          </TabsList>
        </div>

        {/* DOCUMENT LIST TAB */}
        <TabsContent value="list" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {documentList.map((doc) => (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => onSelectDocument(doc)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.category} • P{doc.priority} • {doc.chapter ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
                        {(doc.tags ?? []).slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-[9px]">
                            {tag}
                          </Badge>
                        ))}
                        {(doc.tags ?? []).length > 3 && (
                          <Badge variant="outline" className="text-[9px]">
                            +{doc.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {documentList.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">Nessun documento KB caricato.</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* DOCUMENT EDITOR TAB */}
        <TabsContent value="document" className="flex-1 mt-0 overflow-hidden">
          {activeDocument ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-base truncate">{activeDocument.title}</h3>
                  <Button onClick={onSave} size="sm" className="gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Salva
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Categoria</label>
                    <Input
                      value={activeDocument.category}
                      onChange={(e) => onEdit("category", e.target.value)}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Priorità</label>
                    <Input
                      type="number"
                      value={activeDocument.priority}
                      onChange={(e) => onEdit("priority", Number(e.target.value))}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Capitolo</label>
                    <Input
                      value={activeDocument.chapter ?? ""}
                      onChange={(e) => onEdit("chapter" as keyof KBDocument, e.target.value)}
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Tag (separati da virgola)</label>
                  <Input
                    value={(activeDocument.tags ?? []).join(", ")}
                    onChange={(e) => onEdit("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
                    className="mt-1 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Contenuto</label>
                  <Textarea
                    value={activeDocument.content}
                    onChange={(e) => onEdit("content", e.target.value)}
                    className="mt-1 min-h-[400px] font-mono text-xs"
                  />
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Seleziona un documento dalla lista
            </div>
          )}
        </TabsContent>

        {/* DIFF TAB */}
        <TabsContent value="diff" className="flex-1 mt-0 overflow-hidden">
          {proposedChanges ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Modifica Proposta</h3>
                    <p className="text-xs text-muted-foreground">
                      {proposedChanges.type.toUpperCase()}: {proposedChanges.targetTitle ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      proposedChanges.status === "pending" ? "secondary" :
                      proposedChanges.status === "rejected" ? "destructive" :
                      "default"
                    }
                  >
                    {proposedChanges.status}
                  </Badge>
                </div>

                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-xs">Motivo</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-xs">{proposedChanges.reason}</p>
                  </CardContent>
                </Card>

                {proposedChanges.currentContent !== undefined && proposedChanges.proposedContent !== undefined && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-destructive">ATTUALE</label>
                      <div className="mt-1 p-2 bg-destructive/10 rounded border border-destructive/30 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
                        {proposedChanges.currentContent}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-primary">PROPOSTO</label>
                      <div className="mt-1 p-2 bg-primary/10 rounded border border-primary/30 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
                        {proposedChanges.proposedContent}
                      </div>
                    </div>
                  </div>
                )}

                {proposedChanges.currentTags && proposedChanges.proposedTags && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-destructive">Tag Attuali</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {proposedChanges.currentTags.map(t => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-primary">Tag Proposti</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {proposedChanges.proposedTags.map(t => (
                          <Badge
                            key={t}
                            variant={proposedChanges.currentTags?.includes(t) ? "outline" : "default"}
                            className="text-[10px]"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {proposedChanges.status === "pending" && (
                  <div className="flex gap-3 pt-3 border-t border-border">
                    <Button onClick={onApprove} className="flex-1 gap-2" variant="default">
                      <Check className="w-4 h-4" /> Approva e Applica
                    </Button>
                    <Button onClick={onReject} className="flex-1 gap-2" variant="destructive">
                      <X className="w-4 h-4" /> Rifiuta
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Nessuna modifica proposta
            </div>
          )}
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit" className="flex-1 mt-0 overflow-hidden">
          {auditReport ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Critiche", count: auditReport.summary?.critical ?? 0, className: "text-destructive" },
                    { label: "Alte", count: auditReport.summary?.high ?? 0, className: "text-warning" },
                    { label: "Medie", count: auditReport.summary?.medium ?? 0, className: "text-warning/70" },
                    { label: "Basse", count: auditReport.summary?.low ?? 0, className: "text-info" },
                  ].map(({ label, count, className }) => (
                    <Card key={label}>
                      <CardContent className="p-3 text-center">
                        <p className={`text-2xl font-bold ${className}`}>{count}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-2">
                  {(auditReport.results ?? []).map((issue, i) => (
                    <Card
                      key={i}
                      className={
                        issue.severity === "critical" ? "border-destructive/50" :
                        issue.severity === "high" ? "border-warning/50" :
                        ""
                      }
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          {issue.severity === "critical" ? <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" /> :
                           issue.severity === "high" ? <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" /> :
                           <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[9px]">{issue.level}</Badge>
                              <Badge variant="outline" className="text-[9px]">{issue.category}</Badge>
                            </div>
                            <p className="text-xs font-medium mt-1">{issue.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{issue.location}</p>
                            <p className="text-xs mt-1"><strong>Fix:</strong> {issue.fix_proposal}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm px-4 text-center">
              Nessun audit eseguito. Chiedi al supervisor di analizzare la KB.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
