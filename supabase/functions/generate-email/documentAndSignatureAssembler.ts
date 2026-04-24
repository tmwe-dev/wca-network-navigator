/**
 * documentAndSignatureAssembler.ts — Load documents and build signature blocks
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

interface DocRow {
  file_name: string;
  extracted_text: string | null;
}

export interface DocumentsAndSignature {
  documentsContext: string;
  signatureBlock: string;
}

/**
 * Load reference documents if IDs provided and quality allows.
 */
async function loadDocuments(
  supabase: SupabaseClient,
  quality: Quality,
  documentIds: string[] | undefined,
): Promise<string> {
  if (quality === "fast" || !documentIds?.length) return "";

  const { data: docs } = await supabase
    .from("workspace_documents")
    .select("file_name, extracted_text")
    .in("id", documentIds);

  if (!docs?.length) return "";

  const docTexts = (docs as DocRow[])
    .filter((d) => d.extracted_text)
    .map((d) => `--- ${d.file_name} ---\n${d.extracted_text!.substring(0, 3000)}`)
    .join("\n\n");

  return docTexts ? `\nDOCUMENTI DI RIFERIMENTO:\n${docTexts}\n` : "";
}

/**
 * Build signature block from settings, or construct from parts if missing.
 */
function buildSignatureBlock(settings: Record<string, string>): string {
  const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
  const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";
  let signatureBlock = settings.ai_email_signature_block || "";

  if (!signatureBlock.trim()) {
    const sigParts: string[] = [];
    if (senderAlias) sigParts.push(senderAlias);
    if (settings.ai_contact_role) sigParts.push(settings.ai_contact_role);
    if (senderCompanyAlias) sigParts.push(senderCompanyAlias);
    if (settings.ai_phone_signature) sigParts.push(`Tel: ${settings.ai_phone_signature}`);
    if (settings.ai_email_signature) sigParts.push(`Email: ${settings.ai_email_signature}`);
    if (sigParts.length > 0) signatureBlock = sigParts.join("\n");
  }

  return signatureBlock;
}

/**
 * Assemble documents and signature block.
 */
export async function assembleDocumentsAndSignature(
  supabase: SupabaseClient,
  quality: Quality,
  settings: Record<string, string>,
  documentIds: string[] | undefined,
): Promise<DocumentsAndSignature> {
  const [documentsContext, signatureBlock] = await Promise.all([
    loadDocuments(supabase, quality, documentIds),
    Promise.resolve(buildSignatureBlock(settings)),
  ]);

  return { documentsContext, signatureBlock };
}
