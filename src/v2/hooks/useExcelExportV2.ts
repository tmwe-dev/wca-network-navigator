/**
 * useExcelExportV2 — Export partners to Excel via ExcelJS (lazy loaded)
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { PartnerV2 } from "@/v2/core/domain/partner-entity";

export function useExcelExportV2() {
  const [exporting, setExporting] = useState(false);

  const exportToExcel = useCallback(async (partners: readonly PartnerV2[], filename = "partners_export") => {
    if (partners.length === 0) {
      toast.error("Nessun partner da esportare");
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Partners");

      ws.columns = [
        { header: "Azienda", key: "company", width: 30 },
        { header: "Alias", key: "alias", width: 20 },
        { header: "Paese", key: "country", width: 8 },
        { header: "Città", key: "city", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Telefono", key: "phone", width: 20 },
        { header: "Mobile", key: "mobile", width: 20 },
        { header: "Tipo", key: "type", width: 15 },
        { header: "Rating", key: "rating", width: 8 },
      ];

      // Header styling
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      for (const p of partners) {
        ws.addRow({
          company: p.companyName,
          alias: p.companyAlias ?? "",
          country: p.countryCode,
          city: p.city ?? "",
          email: p.email ?? "",
          phone: p.phone ?? "",
          mobile: p.mobile ?? "",
          type: p.partnerType ?? "",
          rating: p.rating ?? "",
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${partners.length} partner esportati`);
    } catch (e) {
      toast.error(`Errore export: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportToExcel, exporting };
}
