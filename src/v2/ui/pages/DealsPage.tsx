/**
 * Deals & Pipeline Management Page
 * Full page with KPI bar, Kanban view, and deal management
 */
import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealStatsBar } from "@/components/deals/DealStatsBar";
import { DealPipeline } from "@/components/deals/DealPipeline";
import { CreateDealDialog } from "@/components/deals/CreateDealDialog";
import { useDeals } from "@/hooks/useDeals";
import { Plus, Search, LayoutGrid, Table2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export function DealsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const { data: deals, isLoading } = useDeals();

  const filteredDeals = deals?.filter(
    (d) =>
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.partner?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      lead: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
      qualified: "bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100",
      proposal: "bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-100",
      negotiation: "bg-amber-100 text-amber-800 dark:bg-amber-700 dark:text-amber-100",
      won: "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100",
      lost: "bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100",
    };
    return colors[stage] || "";
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      lead: "Lead",
      qualified: "Qualificato",
      proposal: "Proposta",
      negotiation: "Negoziazione",
      won: "Vinto",
      lost: "Perso",
    };
    return labels[stage] || stage;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Affari"
        description="Gestisci gli affari e le opportunità commerciali con i tuoi partner"
        icon="pipeline"
      />

      {/* KPI Stats Bar */}
      <div className="bg-card rounded-lg border border-border p-6">
        <DealStatsBar />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca affari, partner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "table")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <Table2 className="w-4 h-4" />
                <span className="hidden sm:inline">Tabella</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuovo Affare</span>
            <span className="sm:hidden">Nuovo</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "table")}>
        <TabsContent value="kanban" className="mt-0">
          <div className="bg-card rounded-lg border border-border p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Caricamento...
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground flex-col gap-2">
                <p>Nessun affare trovato</p>
                <p className="text-sm">Inizia creando il tuo primo affare</p>
              </div>
            ) : (
              <DealPipeline searchTerm={searchTerm} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Caricamento...
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-muted-foreground flex-col gap-2">
                <p>Nessun affare trovato</p>
                <p className="text-sm">Inizia creando il tuo primo affare</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="text-right">Probabilità</TableHead>
                    <TableHead>Chiusura prevista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((deal) => (
                    <TableRow key={deal.id} className="hover:bg-accent cursor-pointer">
                      <TableCell className="font-medium">
                        <div>
                          <p className="line-clamp-1">{deal.title}</p>
                          {deal.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {deal.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {deal.partner?.company_name ? (
                          <div>
                            <p className="text-sm">{deal.partner.company_name}</p>
                            <p className="text-xs text-muted-foreground">{deal.partner.country_code}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStageColor(deal.stage)}>
                          {getStageLabel(deal.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(deal.amount, deal.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{deal.probability}%</Badge>
                      </TableCell>
                      <TableCell>
                        {deal.expected_close_date
                          ? new Date(deal.expected_close_date).toLocaleDateString("it-IT")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CreateDealDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}

export default DealsPage;
