/**
 * TokenUsageTable — Detailed table of recent token usage entries
 */
import { useMemo } from "react";
import { useTokenCockpitUser, useRecentTokenUsage, type UsageRow } from "@/hooks/useTokenCockpitData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenCount, getFunctionDisplayName } from "@/lib/tokenFormat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


export function TokenUsageTable() {
  const { data: userData } = useTokenCockpitUser();
  const { data: tableData = [], isLoading } = useRecentTokenUsage(userData?.id);

  const tableDataMemoized = useMemo<UsageRow[]>(() => tableData, [tableData]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 4,
    }).format(cost);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Utilizzo recente</h3>
        <Skeleton className="h-80 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Utilizzo recente</h3>
      {tableDataMemoized.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funzione</TableHead>
                <TableHead>Modello</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableDataMemoized.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {getFunctionDisplayName(row.function_name)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.model || "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatTokenCount(row.input_tokens)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatTokenCount(row.output_tokens)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatTokenCount(row.total_tokens)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCost(row.cost_estimate)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(row.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          Nessun utilizzo recente
        </div>
      )}
    </Card>
  );
}
