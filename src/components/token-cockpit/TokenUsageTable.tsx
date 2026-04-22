/**
 * TokenUsageTable — Detailed table of recent token usage entries
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenCount, getFunctionDisplayName } from "@/data/tokenUsage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsageRow {
  id: string;
  function_name: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  created_at: string;
}

export function TokenUsageTable() {
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: tableData = [], isLoading } = useQuery({
    queryKey: ["tokenUsage", "table", userData?.id],
    queryFn: async () => {
      if (!userData?.id) return [];

      const { data, error } = await supabase
        .from("ai_token_usage")
        .select("id, function_name, model, input_tokens, output_tokens, total_tokens, cost_estimate, created_at")
        .eq("user_id", userData.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching table data:", error);
        return [];
      }

      return data as UsageRow[];
    },
    enabled: !!userData?.id,
  });

  const tableDataMemoized = useMemo(() => tableData, [tableData]);

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
