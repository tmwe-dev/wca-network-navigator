/**
 * useImportLogs — Mutation hooks (write operations)
 * Split from the original 619-LOC monolith.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { resolveCountryCode } from "@/lib/countries";
import { createLogger } from "@/lib/log";
import type { ImportLog, ImportedContact } from "./useImportLogQueries";
import { insertPartnerContact } from "@/data/partnerRelations";
import { insertActivity } from "@/data/activities";
import { updateImportLog } from "@/data/importLogs";

const log = createLogger("useImportLogActions");

// ─── Field aliases for CSV mapping ─────────────────────
const FIELD_ALIASES: Record<string, string[]> = {
  company_name: ["company_name", "ragione_sociale", "azienda", "company", "societa", "ditta", "denominazione", "name_2"],
  name: ["name", "nome", "contatto", "referente", "contact", "nome_contatto", "nome_referente"],
  email: ["email", "e_mail", "mail", "email_address", "posta_elettronica"],
  phone: ["phone", "telefono", "tel", "phone_number", "numero_telefono"],
  mobile: ["mobile", "cellulare", "cell", "mobile_phone", "cell_phone"],
  country: ["country", "paese", "nazione", "stato", "country_name"],
  city: ["city", "citta", "localita", "comune"],
  address: ["address", "indirizzo", "via", "sede"],
  zip_code: ["zip_code", "cap", "postal_code", "codice_postale"],
  note: ["note", "notes", "annotazioni", "commenti", "osservazioni", "position"],
  origin: ["origin", "origine", "provenienza", "fonte", "source"],
  company_alias: ["company_alias", "alias_azienda", "alias_2"],
  contact_alias: ["contact_alias", "alias", "alias_contatto"],
};

function findField(row: Record<string, unknown>, aliases: string[]): string | null {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
  }
  return null;
}

// ─── Mutations ──────────────────────────────────────────

export function useCreateImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, rows, userId }: { file: File; rows: Array<Record<string, unknown>>; userId: string }) => {
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("import-files").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage.from("import-files").createSignedUrl(filePath, 60 * 60 * 24 * 365);

      const { data: importLog, error: logError } = await supabase
        .from("import_logs")
        .insert({ user_id: userId, file_name: file.name, file_url: urlData?.signedUrl || filePath, file_size: file.size, total_rows: rows.length, status: "pending" })
        .select()
        .single();
      if (logError) throw logError;

      const contacts = rows.map((row, index) => ({
        import_log_id: importLog.id,
        row_number: index + 1,
        company_name: findField(row, FIELD_ALIASES.company_name),
        name: findField(row, FIELD_ALIASES.name),
        email: findField(row, FIELD_ALIASES.email),
        phone: findField(row, FIELD_ALIASES.phone),
        mobile: findField(row, FIELD_ALIASES.mobile),
        country: findField(row, FIELD_ALIASES.country),
        city: findField(row, FIELD_ALIASES.city),
        address: findField(row, FIELD_ALIASES.address),
        zip_code: findField(row, FIELD_ALIASES.zip_code),
        note: findField(row, FIELD_ALIASES.note),
        origin: findField(row, FIELD_ALIASES.origin),
        raw_data: row,
      }));

      const { insertContacts } = await import("@/data/contacts");
      {
        await insertContacts(contacts);
      }

      return importLog as ImportLog;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["import-logs"] }),
  });
}

export function useProcessImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (importLogId: string) => {
      return invokeEdge<Record<string, unknown>>("process-ai-import", { body: { import_log_id: importLogId }, context: "useProcessImport" });
    },
    onSuccess: (_, importLogId) => {
      queryClient.invalidateQueries({ queryKey: ["import-log", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-errors", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
      toast({ title: "Elaborazione completata" });
    },
    onError: (err) => toast({ title: "Errore elaborazione", description: String(err), variant: "destructive" }),
  });
}

export function useToggleContactSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, selected }: { id: string; selected: boolean }) => {
      const { toggleContactSelection } = await import("@/data/contacts");
      await toggleContactSelection(id, selected);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["imported-contacts"] }),
  });
}

export function useTransferToPartners() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contacts: ImportedContact[]) => {
      let successCount = 0;
      for (const c of contacts) {
        const { data: partner, error: pError } = await supabase
          .from("partners")
          .insert({
            company_name: c.company_name || "Unknown",
            country_code: resolveCountryCode(c.country || "") || "XX",
            country_name: c.country || "Unknown",
            city: c.city || "Unknown",
            address: c.address,
            phone: c.phone,
            mobile: c.mobile,
            email: c.email,
            company_alias: c.company_alias,
            is_active: true,
          })
          .select()
          .single();

        if (pError) { log.error("transfer failed", { message: pError.message }); continue; }

        if (c.name) {
          await insertPartnerContact({
            partner_id: partner.id, name: c.name, email: c.email,
            direct_phone: c.phone, mobile: c.mobile, contact_alias: c.contact_alias,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic property access on imported contact
            title: (c as any).position || null, is_primary: true,
          });
        }

        await (await import("@/data/contacts")).markContactTransferred(c.id);
        successCount++;
      }
      return successCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: `${count} partner trasferiti con successo` });
    },
  });
}

export function useCreateActivitiesFromImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contacts, activityType, campaignBatchId }: { contacts: ImportedContact[]; activityType: "send_email" | "phone_call"; campaignBatchId?: string }) => {
      let count = 0;
      for (const c of contacts) {
        const { data: partner, error: pError } = await supabase
          .from("partners")
          .insert({
            company_name: c.company_name || "Unknown",
            country_code: resolveCountryCode(c.country || "") || "XX",
            country_name: c.country || "Unknown",
            city: c.city || "Unknown",
            phone: c.phone, email: c.email, company_alias: c.company_alias, is_active: true,
          })
          .select()
          .single();
        if (pError) continue;

        let contactId: string | null = null;
        if (c.name) {
          const { data: contact } = await supabase
            .from("partner_contacts")
            .insert({ partner_id: partner.id, name: c.name, email: c.email, direct_phone: c.phone, mobile: c.mobile, contact_alias: c.contact_alias, is_primary: true })
            .select()
            .single();
          contactId = contact?.id || null;
        }

        await insertActivity({
          partner_id: partner.id, source_type: "partner", source_id: partner.id,
          activity_type: activityType,
          title: `${activityType === "send_email" ? "Email" : "Chiamata"} - ${c.company_name}`,
          status: "pending", priority: "medium", selected_contact_id: contactId,
          campaign_batch_id: campaignBatchId || null,
        });

        await (await import("@/data/contacts")).markContactTransferred(c.id);
        count++;
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: `${count} attività create con successo` });
    },
  });
}

export function useAnalyzeImportStructure() {
  return useMutation({
    mutationFn: async ({ sampleRows, inputType, rawText }: { sampleRows?: Array<Record<string, unknown>>; inputType: "paste" | "file"; rawText?: string }) => {
      return invokeEdge<{ column_mapping: Record<string, string>; parsed_rows: Array<Record<string, unknown>>; confidence: number; warnings: string[]; unmapped_columns?: string[] }>(
        "analyze-import-structure",
        { body: { sample_rows: sampleRows || [], input_type: inputType, raw_text: rawText }, context: "useAnalyzeImportStructure" }
      );
    },
    onError: (err) => toast({ title: "Errore analisi AI", description: String(err), variant: "destructive" }),
  });
}

export function useFixImportErrors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ importLogId, customPrompt }: { importLogId: string; customPrompt?: string }) => {
      return invokeEdge<{ corrected: number; dismissed: number; has_more: boolean; remaining: number }>(
        "process-ai-import",
        { body: { import_log_id: importLogId, mode: "fix_errors", custom_prompt: customPrompt || undefined }, context: "useFixImportErrors" }
      );
    },
    onSuccess: (result, { importLogId }) => {
      queryClient.invalidateQueries({ queryKey: ["import-errors", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-log", importLogId] });
      toast({ title: "Batch completato", description: `${result.corrected} corretti, ${result.dismissed} non recuperabili${result.has_more ? ` — ${result.remaining} rimanenti` : ""}` });
    },
    onError: (err) => toast({ title: "Errore correzione AI", description: String(err), variant: "destructive" }),
  });
}

export function useCreateImportFromParsedRows() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, userId, fileName, groupName, importSource }: { rows: Array<Record<string, unknown>>; userId: string; fileName: string; groupName?: string; importSource?: "standard" | "business_card" }) => {
      const source = importSource || "standard";
      const normalizedGroupName = groupName?.trim() || null;
      const businessCardOrigin = normalizedGroupName ? `business_card:${normalizedGroupName}` : "business_card";

      const { data: importLog, error: logError } = await supabase
        .from("import_logs")
        .insert({ user_id: userId, file_name: fileName, file_size: 0, total_rows: rows.length, status: "pending", normalization_method: "ai", group_name: normalizedGroupName })
        .select()
        .single();
      if (logError) throw logError;

      const contacts = rows.map((row, index) => {
        const rawData = row._raw || row;
        const { _raw, ...mapped } = row;
        const isBusinessCard = source === "business_card";
        const existingNote = mapped.note || null;
        const sourceNote = isBusinessCard ? "Importato da biglietto da visita" : null;
        return {
          import_log_id: importLog.id, row_number: index + 1,
          company_name: mapped.company_name || null, name: mapped.name || null,
          email: mapped.email || null, phone: mapped.phone || null, mobile: mapped.mobile || null,
          country: mapped.country || null, city: mapped.city || null, address: mapped.address || null,
          zip_code: mapped.zip_code || null,
          note: [existingNote, sourceNote].filter(Boolean).join(" · ") || null,
          origin: isBusinessCard ? businessCardOrigin : mapped.origin || null,
          company_alias: mapped.company_alias || null, contact_alias: mapped.contact_alias || null,
          position: mapped.position || null, external_id: mapped.external_id || null,
          raw_data: rawData,
        };
      });

      {
        const { insertContacts } = await import("@/data/contacts");
        await insertContacts(contacts);
      }

      const totalBatches = Math.ceil(contacts.length / 100);
      await updateImportLog(importLog.id, { status: "completed", imported_rows: contacts.length, processing_batch: totalBatches, total_batches: totalBatches });

      return importLog as ImportLog;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["import-logs"] }),
  });
}
