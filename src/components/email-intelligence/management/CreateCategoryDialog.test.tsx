import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { CreateCategoryDialog } from "./CreateCategoryDialog";

describe("CreateCategoryDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    existingNames: ["Existing Category"],
  };

  beforeEach(() => vi.clearAllMocks());

  it("renders dialog title and description", () => {
    renderWithProviders(React.createElement(CreateCategoryDialog, defaultProps));
    expect(screen.getByText("Nuova Categoria Email")).toBeInTheDocument();
    expect(screen.getByText(/Crea una categoria personalizzata/)).toBeInTheDocument();
  });

  it("shows validation error for empty name", async () => {
    renderWithProviders(React.createElement(CreateCategoryDialog, defaultProps));
    fireEvent.click(screen.getByText("Crea Categoria"));
    await waitFor(() => expect(screen.getByText("Nome obbligatorio")).toBeInTheDocument());
  });

  it("shows error for duplicate name", async () => {
    renderWithProviders(React.createElement(CreateCategoryDialog, defaultProps));
    fireEvent.change(screen.getByLabelText("Nome Categoria *"), { target: { value: "Existing Category" } });
    fireEvent.click(screen.getByText("Crea Categoria"));
    await waitFor(() => expect(screen.getByText("Questo nome è già in uso")).toBeInTheDocument());
  });

  it("submits valid form data", async () => {
    renderWithProviders(React.createElement(CreateCategoryDialog, defaultProps));
    fireEvent.change(screen.getByLabelText("Nome Categoria *"), { target: { value: "New Cat" } });
    fireEvent.click(screen.getByText("Crea Categoria"));
    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ nome_gruppo: "New Cat", colore: "#3B82F6", icon: "🔧" })
      );
    });
  });

  it("clears error when typing new name", async () => {
    renderWithProviders(React.createElement(CreateCategoryDialog, defaultProps));
    fireEvent.click(screen.getByText("Crea Categoria"));
    await waitFor(() => expect(screen.getByText("Nome obbligatorio")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Nome Categoria *"), { target: { value: "A" } });
    expect(screen.queryByText("Nome obbligatorio")).not.toBeInTheDocument();
  });

  it("shows color presets as clickable buttons", () => {
    renderWithProviders(React.createElement(CreateCategoryDialog, defaultProps));
    expect(screen.getByTitle("Blu")).toBeInTheDocument();
    expect(screen.getByTitle("Verde")).toBeInTheDocument();
    expect(screen.getByTitle("Rosso")).toBeInTheDocument();
  });
});
