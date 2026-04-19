import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TableCanvas from "../TableCanvas";

const cols = [{ key: "name", label: "Nome" }, { key: "country", label: "Paese" }];
const rows = [
  { id: "p1", name: "Alpha SRL", country: "IT" },
  { id: "p2", name: "Beta Ltd", country: "UK" },
];
const bulkActions = [
  { id: "outreach", label: "Programma outreach", promptTemplate: "outreach per {ids}" },
];

describe("TableCanvas", () => {
  it("renders rows + LIVE badge", () => {
    render(<TableCanvas columns={cols} rows={rows} isLive />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("Alpha SRL")).toBeInTheDocument();
    expect(screen.getByText("Beta Ltd")).toBeInTheDocument();
  });

  it("does NOT render bulk bar when nothing selected", () => {
    render(
      <TableCanvas
        columns={cols}
        rows={rows}
        selectable
        selectedIds={new Set()}
        bulkActions={bulkActions}
      />
    );
    expect(screen.queryByText("Programma outreach")).not.toBeInTheDocument();
  });

  it("renders bulk bar + count when ≥1 selected", () => {
    render(
      <TableCanvas
        columns={cols}
        rows={rows}
        selectable
        selectedIds={new Set(["p1"])}
        bulkActions={bulkActions}
      />
    );
    expect(screen.getByText("Programma outreach")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/selezionati/i)).toBeInTheDocument();
  });

  it("clicking a bulk action calls onBulkAction with selected ids", () => {
    const onBulk = vi.fn();
    render(
      <TableCanvas
        columns={cols}
        rows={rows}
        selectable
        selectedIds={new Set(["p1", "p2"])}
        bulkActions={bulkActions}
        onBulkAction={onBulk}
      />
    );
    fireEvent.click(screen.getByText("Programma outreach"));
    expect(onBulk).toHaveBeenCalledTimes(1);
    expect(onBulk.mock.calls[0][0]).toEqual(bulkActions[0]);
    expect(onBulk.mock.calls[0][1].sort()).toEqual(["p1", "p2"]);
  });

  it("shows empty state when no rows", () => {
    render(<TableCanvas columns={cols} rows={[]} />);
    expect(screen.getByText(/Nessun risultato trovato/i)).toBeInTheDocument();
  });
});
