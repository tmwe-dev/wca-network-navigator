/**
 * responseParser.ts — Parse AI response for generate-outreach.
 * Extracts subject/body, normalises HTML, appends signature for email channel.
 */

export interface ParsedOutreachResponse {
  subject: string;
  body: string;
}

export function parseOutreachResponse(
  rawContent: string,
  channel: string,
  settings: Record<string, string>,
): ParsedOutreachResponse {
  let subject = "";
  let body = rawContent;

  if (channel === "email") {
    const subjectMatch = rawContent.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = rawContent.substring(subjectMatch[0].length).trim();
    }
    // Convert to HTML if needed
    if (!/<(p|br|div|ul|ol|h[1-6])\b/i.test(body)) {
      body = body.split(/\n\n+/).map((para: string) => `<p>${para.replace(/\n/g, "<br>")}</p>`).join("\n");
    }
    // Append signature
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
    if (signatureBlock.trim()) {
      body = body + `<br><br>${signatureBlock.replace(/\n/g, "<br>")}`;
    }
  }

  return { subject, body };
}
