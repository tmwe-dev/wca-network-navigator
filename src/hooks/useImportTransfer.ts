import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { resolveCountryCode } from "@/lib/countries";
import type { ImportedContact } from "./useImportLogs";

/**
 * Shared helper: inserts a partner + optional contact from an ImportedContact,
 * marks the imported row as transferred, and returns the created partner & contact IDs.
 * Returns null when the partner insert fails (caller should skip that row).
 */
async function transferContactToPartner(
  c: ImportedContact,
  opts?: { includeAddress?: boolean }
): Promise<{ partnerId: string; contactId: string | null } | null> {
  const partnerPayload: Record<string, unknown> = {
    company_name: c.company_name || "Unknown",
    country_code: resolveCountryCode(c.country || "") || "XX",
    country_name: c.country || "Unknown",
    city: c.city || "Unknown",
    phone: c.phone,
    email: c.email,
    company_alias: c.company_alias,
    is_active: true,
  };

  // useTransferToPartners passes address + mobile on the partner row;
  // useCreateActivitiesFromImport does not.
  if (opts?.includeAddress) {
    partnerPayload.address = c.address;
    partnerPayload.mobile = c.mobile;
  }

  const { data: partner, error: pError } = await supabase
    .from("partners")
    .insert(partnerPayload)
    .select()
    .single();

  if (pError) {
    console.error("Transfer error:", pError);
    return null;
  }

  // Insert contact if name exists
  let contactId: string | null = null;
  if (c.name) {
    const contactPayload: Record<string, unknown> = {
      partner_id: partner.id,
      name: c.name,
      email: c.email,
      direct_phone: c.phone,
      mobile: c.mobile,
      contact_alias: c.contact_alias,
      is_primary: true,
    };

    // useTransferToPartners also sets title from position
    if (opts?.includeAddress) {
      contactPayload.title = (c as any).position || null;
    }

    const { data: contact } = await supabase
      .from("partner_contacts")
      .insert(contactPayload)
      .select()
      .single();

    contactId = contact?.id || null;
  }

  // Mark as transferred
  await supabase
    .from("imported_contacts")
    .update({ is_transferred: true })
    .eq("id", c.id);

  return { partnerId: partner.id, contactId };
}

export function useTransferToPartners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: ImportedContact[]) => {
      let successCount = 0;
      for (const c of contacts) {
        const result = await transferContactToPartner(c, { includeAddress: true });
        if (result) successCount++;
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
      let count = 0;
      for (const c of contacts) {
        const result = await transferContactToPartner(c, { includeAddress: false });
        if (!result) continue;

        // Create activity
        await supabase.from("activities").insert({
          partner_id: result.partnerId,
          source_type: "partner",
          source_id: result.partnerId,
          activity_type: activityType,
          title: `${activityType === "send_email" ? "Email" : "Chiamata"} - ${c.company_name}`,
          status: "pending",
          priority: "medium",
          selected_contact_id: result.contactId,
          campaign_batch_id: campaignBatchId || null,
        });

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
