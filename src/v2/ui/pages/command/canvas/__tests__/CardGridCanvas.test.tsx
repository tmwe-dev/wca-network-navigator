import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CardGridCanvas from "../CardGridCanvas";

const items = [
  { id: "c1", name: "Mario Rossi", company: "Acme", lastContact: "2g fa", action: "Followup" },
  { id: "c2", name: "Lara Bianchi", company: "Beta", lastContact: "5g fa", action: "Call" },
];
const bulkActions = [
  { id: "followup", label: "Invia followup", promptTemplate: "fup per {ids}" },
];

describe("CardGridCanvas", () => {
  it("renders cards", () => {
    render(<CardGridCanvas items={items} badge="LIVE" />);
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("Lara Bianchi")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<CardGridCanvas items={[]} />);
    expect(screen.getByText(/Nessun contatto trovato/i)).toBeInTheDocument();
  });

  it("renders bulk bar only when something is selected", () => {
    const { rerender } = render(
      <CardGridCanvas items={items} selectable selectedIds={new Set()} bulkActions={bulkActions} />
    );
    expect(screen.queryByText("Invia followup")).not.toBeInTheDocument();

    rerender(
      <CardGridCanvas items={items} selectable selectedIds={new Set(["c1"])} bulkActions={bulkActions} />
    );
    expect(screen.getByText("Invia followup")).toBeInTheDocument();
  });

  it("invokes onBulkAction with current selection", () => {
    const onBulk = vi.fn();
    render(
      <CardGridCanvas
        items={items}
        selectable
        selectedIds={new Set(["c1"])}
        bulkActions={bulkActions}
        onBulkAction={onBulk}
      />
    );
    fireEvent.click(screen.getByText("Invia followup"));
    expect(onBulk).toHaveBeenCalledWith(bulkActions[0], ["c1"]);
  });

  it("seleziona tutti toggles full selection", () => {
    const onSelectAll = vi.fn();
    render(
      <CardGridCanvas
        items={items}
        selectable
        selectedIds={new Set()}
        bulkActions={bulkActions}
        onSelectAll={onSelectAll}
      />
    );
    fireEvent.click(screen.getByText(/seleziona tutti/i));
    expect(onSelectAll).toHaveBeenCalledWith(["c1", "c2"]);
  });
});
