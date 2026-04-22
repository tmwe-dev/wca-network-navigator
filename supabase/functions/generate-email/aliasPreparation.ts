/**
 * aliasPreparation.ts — Auto-generate and persist missing aliases for companies and contacts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateAliasesInline } from "./aliasGenerator.ts";
import type { PartnerData, ContactData } from "./promptBuilder.ts";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Auto-generate and persist aliases if missing.
 */
export async function ensureAliasesExist(
  supabase: SupabaseClient,
  partner: PartnerData,
  contact: ContactData | null,
  sourceType: string,
  standalone: boolean,
): Promise<void> {
  const needsCompanyAlias = !standalone && !partner.company_alias;
  const needsContactAlias = contact && !contact.contact_alias;

  if (!needsCompanyAlias && !needsContactAlias) return;

  const generated = await generateAliasesInline(
    partner.company_name,
    contact?.name || null,
    contact?.title || null,
  );

  // Persist company alias
  if (generated.company_alias && needsCompanyAlias) {
    partner.company_alias = generated.company_alias;
    if (sourceType === "partner") {
      await supabase
        .from("partners")
        .update({ company_alias: generated.company_alias })
        .eq("id", partner.id!);
    } else if (sourceType === "contact") {
      await supabase
        .from("imported_contacts")
        .update({ company_alias: generated.company_alias })
        .eq("id", partner.id!);
    }
  }

  // Persist contact alias
  if (generated.contact_alias && needsContactAlias && contact) {
    contact.contact_alias = generated.contact_alias;
    if (sourceType === "partner") {
      await supabase
        .from("partner_contacts")
        .update({ contact_alias: generated.contact_alias })
        .eq("id", contact.id);
    } else if (sourceType === "contact") {
      await supabase
        .from("imported_contacts")
        .update({ contact_alias: generated.contact_alias })
        .eq("id", contact.id);
    }
  }
}
