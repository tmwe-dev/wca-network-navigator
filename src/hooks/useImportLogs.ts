import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { resolveCountryCode } from "@/lib/countries";

// Find a field value from a row using multiple possible aliases
function findField(row: Record<string, any>, aliases: string[]): string | null {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
  }
  return null;
}

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

export interface ImportLog {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string | null;
  file_size: number;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  status: string;
  normalization_method: string;
  processing_batch: number;
  total_batches: number;
  group_name?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ImportedContact {
  id: string;
  import_log_id: string;
  row_number: number;
  company_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  zip_code: string | null;
  note: string | null;
  origin: string | null;
  company_alias: string | null;
  contact_alias: string | null;
  position: string | null;
  external_id: string | null;
  lead_status: string;
  deep_search_at: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  converted_at: string | null;
  is_selected: boolean;
  is_transferred: boolean;
  raw_data: any;
  created_at: string;
}

export interface ImportError {
  id: string;
  import_log_id: string;
  row_number: number;
  error_type: string;
  error_message: string | null;
  raw_data: any;
  corrected_data: any;
  status: string;
  attempted_corrections: number;
  ai_suggestions: any;
  created_at: string;
}

export function useImportLogs() {
  return useQuery({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportLog[];
    },
  });
}

export function useImportLog(id: string | null) {
  return useQuery({
    queryKey: ["import-log", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ImportLog;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const log = query.state.data as ImportLog | null;
      return log?.status === "processing" ? 2000 : false;
    },
  });
}

export function useImportedContacts(importLogId: string | null) {
  return useQuery({
    queryKey: ["imported-contacts", importLogId],
    queryFn: async () => {
      if (!importLogId) return [];
      // Fetch all rows in batches to bypass the 1000-row default limit
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("imported_contacts")
          .select("*")
          .eq("import_log_id", importLogId)
          .order("row_number", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allData as ImportedContact[];
    },
    enabled: !!importLogId,
  });
}

export function useImportErrors(importLogId: string | null) {
  return useQuery({
    queryKey: ["import-errors", importLogId],
    queryFn: async () => {
      if (!importLogId) return [];
      const { data, error } = await supabase
        .from("import_errors")
        .select("*")
        .eq("import_log_id", importLogId)
        .order("row_number", { ascending: true });
      if (error) throw error;
      return data as ImportError[];
    },
    enabled: !!importLogId,
  });
}

export function useCreateImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      rows,
      userId,
    }: {
      file: File;
      rows: any[];
      userId: string;
    }) => {
      // 1. Upload file to storage
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("import-files")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("import-files")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      // 2. Create import log
      const { data: importLog, error: logError } = await supabase
        .from("import_logs")
        .insert({
          user_id: userId,
          file_name: file.name,
          file_url: urlData?.signedUrl || filePath,
          file_size: file.size,
          total_rows: rows.length,
          status: "pending",
        })
        .select()
        .single();
      if (logError) throw logError;

      // 3. Insert contacts into staging
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

      // Insert in batches of 100
      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from("imported_contacts")
          .insert(batch);
        if (insertError) throw insertError;
      }

      return importLog as ImportLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    },
  });
}

export function useProcessImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importLogId: string) => {
      const { data, error } = await supabase.functions.invoke("process-ai-import", {
        body: { import_log_id: importLogId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, importLogId) => {
      queryClient.invalidateQueries({ queryKey: ["import-log", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-errors", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
      toast({ title: "Elaborazione completata" });
    },
    onError: (err) => {
      toast({
        title: "Errore elaborazione",
        description: String(err),
        variant: "destructive",
      });
    },
  });
}

export function useToggleContactSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, selected }: { id: string; selected: boolean }) => {
      const { error } = await supabase
        .from("imported_contacts")
        .update({ is_selected: selected })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
    },
  });
}

export function useTransferToPartners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: ImportedContact[]) => {
      let successCount = 0;
      for (const c of contacts) {
        // Insert partner
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

        if (pError) {
          console.error("Transfer error:", pError);
          continue;
        }

        // Insert contact if name exists
        if (c.name) {
          await supabase.from("partner_contacts").insert({
            partner_id: partner.id,
            name: c.name,
            email: c.email,
            direct_phone: c.phone,
            mobile: c.mobile,
            contact_alias: c.contact_alias,
            title: (c as any).position || null,
            is_primary: true,
          });
        }

        // Mark as transferred
        await supabase
          .from("imported_contacts")
          .update({ is_transferred: true })
          .eq("id", c.id);

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
    mutationFn: async ({
      contacts,
      activityType,
      campaignBatchId,
    }: {
      contacts: ImportedContact[];
      activityType: "send_email" | "phone_call";
      campaignBatchId?: string;
    }) => {
      // First transfer to partners, then create activities
      let count = 0;
      for (const c of contacts) {
        // Upsert partner
        const { data: partner, error: pError } = await supabase
          .from("partners")
          .insert({
            company_name: c.company_name || "Unknown",
            country_code: resolveCountryCode(c.country || "") || "XX",
            country_name: c.country || "Unknown",
            city: c.city || "Unknown",
            phone: c.phone,
            email: c.email,
            company_alias: c.company_alias,
            is_active: true,
          })
          .select()
          .single();

        if (pError) continue;

        // Create contact
        let contactId: string | null = null;
        if (c.name) {
          const { data: contact } = await supabase
            .from("partner_contacts")
            .insert({
              partner_id: partner.id,
              name: c.name,
              email: c.email,
              direct_phone: c.phone,
              mobile: c.mobile,
              contact_alias: c.contact_alias,
              is_primary: true,
            })
            .select()
            .single();
          contactId = contact?.id || null;
        }

        // Create activity
        await supabase.from("activities").insert({
          partner_id: partner.id,
          source_type: "partner",
          source_id: partner.id,
          activity_type: activityType,
          title: `${activityType === "send_email" ? "Email" : "Chiamata"} - ${c.company_name}`,
          status: "pending",
          priority: "medium",
          selected_contact_id: contactId,
          campaign_batch_id: campaignBatchId || null,
        });

        await supabase
          .from("imported_contacts")
          .update({ is_transferred: true })
          .eq("id", c.id);

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
    mutationFn: async ({
      sampleRows,
      inputType,
      rawText,
    }: {
      sampleRows?: any[];
      inputType: "paste" | "file";
      rawText?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("analyze-import-structure", {
        body: { sample_rows: sampleRows || [], input_type: inputType, raw_text: rawText },
      });
      if (error) throw error;
      return data as {
        column_mapping: Record<string, string>;
        parsed_rows: any[];
        confidence: number;
        warnings: string[];
        unmapped_columns?: string[];
      };
    },
    onError: (err) => {
      toast({ title: "Errore analisi AI", description: String(err), variant: "destructive" });
    },
  });
}

export function useFixImportErrors() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ importLogId, customPrompt }: { importLogId: string; customPrompt?: string }) => {
      const { data, error } = await supabase.functions.invoke("process-ai-import", {
        body: { import_log_id: importLogId, mode: "fix_errors", custom_prompt: customPrompt || undefined },
      });
      if (error) throw error;
      return data as { corrected: number; dismissed: number; has_more: boolean; remaining: number };
    },
    onSuccess: (result, { importLogId }) => {
      queryClient.invalidateQueries({ queryKey: ["import-errors", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["imported-contacts", importLogId] });
      queryClient.invalidateQueries({ queryKey: ["import-log", importLogId] });
      toast({
        title: "Batch completato",
        description: `${result.corrected} corretti, ${result.dismissed} non recuperabili${result.has_more ? ` — ${result.remaining} rimanenti` : ""}`,
      });
    },
    onError: (err) => {
      toast({ title: "Errore correzione AI", description: String(err), variant: "destructive" });
    },
  });
}

export function exportErrorsToCSV(errors: ImportError[]) {
  const SEP = ";";
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val).replace(/"/g, '""');
    if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s}"`;
    }
    return s;
  };

  // Extract raw_data fields as separate columns
  const firstWithRaw = errors.find(e => e.raw_data && typeof e.raw_data === "object");
  const rawKeys = firstWithRaw ? Object.keys(firstWithRaw.raw_data as Record<string, any>) : [];

  const headers = ["riga", "tipo_errore", "messaggio", ...rawKeys];
  const csvRows = [headers.map(escapeCell).join(SEP)];

  for (const err of errors) {
    const raw = (err.raw_data && typeof err.raw_data === "object" ? err.raw_data : {}) as Record<string, any>;
    const row = [
      escapeCell(err.row_number),
      escapeCell(err.error_type),
      escapeCell(err.error_message),
      ...rawKeys.map(k => escapeCell(raw[k])),
    ];
    csvRows.push(row.join(SEP));
  }

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `errori_import_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function useCreateImportFromParsedRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rows,
      userId,
      fileName,
      groupName,
      importSource,
    }: {
      rows: any[];
      userId: string;
      fileName: string;
      groupName?: string;
      importSource?: "standard" | "business_card";
    }) => {
      const source = importSource || "standard";
      const normalizedGroupName = groupName?.trim() || null;
      const businessCardOrigin = normalizedGroupName
        ? `business_card:${normalizedGroupName}`
        : "business_card";

      const { data: importLog, error: logError } = await supabase
        .from("import_logs")
        .insert({
          user_id: userId,
          file_name: fileName,
          file_size: 0,
          total_rows: rows.length,
          status: "pending",
          normalization_method: "ai",
          group_name: normalizedGroupName,
        })
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
          import_log_id: importLog.id,
          row_number: index + 1,
          company_name: mapped.company_name || null,
          name: mapped.name || null,
          email: mapped.email || null,
          phone: mapped.phone || null,
          mobile: mapped.mobile || null,
          country: mapped.country || null,
          city: mapped.city || null,
          address: mapped.address || null,
          zip_code: mapped.zip_code || null,
          note: [existingNote, sourceNote].filter(Boolean).join(" · ") || null,
          origin: isBusinessCard ? businessCardOrigin : mapped.origin || null,
          company_alias: mapped.company_alias || null,
          contact_alias: mapped.contact_alias || null,
          position: mapped.position || null,
          external_id: mapped.external_id || null,
          raw_data: rawData,
        };
      });

      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);
        const { error: insertError } = await supabase.from("imported_contacts").insert(batch);
        if (insertError) throw insertError;
      }

      const totalBatches = Math.ceil(contacts.length / 100);
      await supabase
        .from("import_logs")
        .update({ status: "completed", imported_rows: contacts.length, processing_batch: totalBatches, total_batches: totalBatches })
        .eq("id", importLog.id);

      return importLog as ImportLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    },
  });
}
