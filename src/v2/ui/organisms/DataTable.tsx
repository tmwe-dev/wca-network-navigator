/**
 * DataTable organism — STEP 4 Design System v2
 * Tabella generica tipizzata con sort, pagination.
 */

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "../atoms/Button";
import { EmptyState } from "../atoms/EmptyState";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  readonly id: string;
  readonly header: string;
  readonly accessorFn: (row: T) => string | number | null | undefined;
  readonly cell?: (row: T) => React.ReactNode;
  readonly sortable?: boolean;
  readonly className?: string;
}

type SortDirection = "asc" | "desc" | null;

interface DataTableProps<T> {
  readonly columns: readonly ColumnDef<T>[];
  readonly rows: readonly T[];
  readonly getRowId: (row: T) => string;
  readonly pageSize?: number;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly onRowClick?: (row: T) => void;
  readonly className?: string;
}

// ── Component ────────────────────────────────────────────────────────

export function DataTable<T>({
  columns, rows, getRowId, pageSize = 25,
  emptyTitle = "Nessun risultato",
  emptyDescription = "Non ci sono dati da visualizzare.",
  onRowClick, className,
}: DataTableProps<T>): React.ReactElement {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleSort = useCallback((colId: string) => {
    if (sortColumn === colId) {
      setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortColumn(null);
    } else {
      setSortColumn(colId);
      setSortDir("asc");
    }
    setCurrentPage(0);
  }, [sortColumn, sortDir]);

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDir) return rows;
    const col = columns.find((c) => c.id === sortColumn);
    if (!col) return rows;

    return [...rows].sort((rowA, rowB) => {
      const valA = col.accessorFn(rowA);
      const valB = col.accessorFn(rowB);
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sortColumn, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className={cn(col.className)}>
                  {col.sortable !== false ? (
                    <button
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => handleSort(col.id)}
                    >
                      {col.header}
                      {sortColumn === col.id ? (
                        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row) => (
              <TableRow
                key={getRowId(row)}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <TableCell key={col.id} className={cn(col.className)}>
                    {col.cell ? col.cell(row) : String(col.accessorFn(row) ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{sortedRows.length} risultati</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              ←
            </Button>
            <span>{currentPage + 1} / {totalPages}</span>
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              →
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
