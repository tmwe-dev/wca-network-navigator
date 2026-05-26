import { describe, it, expect, vi, beforeEach } from "vitest";
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const _mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));
import { updateImportLog, deleteImportLog, deleteImportErrors } from "@/data/importLogs";
describe("DAL — importLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ update: mockUpdate, delete: mockDelete, select: mockSelect, insert: mockInsert });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });
  it("updates import log", async () => {
    await updateImportLog("i1", { status: "done" });
    expect(mockFrom).toHaveBeenCalledWith("import_logs");
  });
  it("deletes import log", async () => {
    await deleteImportLog("i1");
    expect(mockFrom).toHaveBeenCalledWith("import_logs");
  });
  it("deletes import errors", async () => {
    await deleteImportErrors("i1");
    expect(mockFrom).toHaveBeenCalledWith("import_errors");
  });
  it("throws on delete error", async () => {
    mockEq.mockResolvedValue({ error: { message: "nope" } });
    await expect(deleteImportLog("i1")).rejects.toEqual({ message: "nope" });
  });
});
