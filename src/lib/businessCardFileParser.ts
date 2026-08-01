/**
 * Parse data files (CSV, XLSX, JSON, VCF) into business card records.
 * Reuses the existing fileParser for CSV/XLSX/JSON, adds VCF support.
 */
import { parseFile } from "@/lib/import/fileParser";

export interface ParsedBusinessCard {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  position?: string | null;
  notes?: string | null;
  raw_data?: Record<string, string>;
}

/** Field synonyms for business card columns */
const FIELD_MAP: Record<keyof Omit<ParsedBusinessCard, "raw_data">, string[]> = {
  company_name: ["company", "azienda", "company_name", "company name", "ditta", "ragione sociale", "società", "organizzazione", "organization", "org"],
  contact_name: ["name", "nome", "contact_name", "contact name", "nome contatto", "nominativo", "full name", "fullname", "nome e cognome", "contact", "referente", "fn"],
  email: ["email", "e-mail", "mail", "posta elettronica", "email address"],
  phone: ["phone", "telefono", "tel", "telephone", "phone number", "fisso", "landline"],
  mobile: ["mobile", "cellulare", "cell", "cel", "smartphone", "mobile phone", "whatsapp"],
  position: ["position", "ruolo", "role", "posizione", "title", "titolo", "job title", "qualifica", "carica"],
  notes: ["notes", "note", "annotazioni", "commenti", "comments", "descrizione", "description"],
};

function matchField(header: string): keyof Omit<ParsedBusinessCard, "raw_data"> | null {
  const h = header.trim().toLowerCase().replace(/[_\-./]/g, " ");
  for (const [field, synonyms] of Object.entries(FIELD_MAP)) {
    if (synonyms.some(s => h === s || h.includes(s))) {
      return field as keyof Omit<ParsedBusinessCard, "raw_data">;
    }
  }
  return null;
}

/** Parse a VCF (vCard) file into business card records */
async function parseVcf(file: File): Promise<ParsedBusinessCard[]> {
  const text = await file.text();
  const cards: ParsedBusinessCard[] = [];
  const vcardBlocks = text.split(/(?=BEGIN:VCARD)/i).filter(b => b.trim());

  for (const block of vcardBlocks) {
    if (!block.toUpperCase().includes("BEGIN:VCARD")) continue;
    const lines = block.split(/\r?\n/);
    const card: ParsedBusinessCard = {};
    const raw: Record<string, string> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
      const value = line.substring(colonIdx + 1).trim();
      if (!value) continue;
      raw[key] = value;

      switch (key) {
        case "FN":
          card.contact_name = value;
          break;
        case "N": {
          if (!card.contact_name) {
            const parts = value.split(";").filter(Boolean);
            card.contact_name = parts.length >= 2 ? `${parts[1]} ${parts[0]}` : parts[0];
          }
          break;
        }
        case "ORG":
          card.company_name = value.replace(/;/g, " ").trim();
          break;
        case "TITLE":
          card.position = value;
          break;
        case "EMAIL":
          if (!card.email) card.email = value;
          break;
        case "TEL": {
          const typeInfo = line.substring(0, colonIdx).toUpperCase();
          if (typeInfo.includes("CELL") || typeInfo.includes("MOBILE")) {
            if (!card.mobile) card.mobile = value;
          } else {
            if (!card.phone) card.phone = value;
          }
          break;
        }
        case "NOTE":
          card.notes = value;
          break;
      }
    }

    if (card.contact_name || card.company_name || card.email) {
      card.raw_data = raw;
      cards.push(card);
    }
  }

  return cards;
}

/** Main entry: parse any data file into business card records */
export async function parseBusinessCardFile(file: File): Promise<ParsedBusinessCard[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  // VCF files: custom parser
  if (ext === "vcf") {
    return parseVcf(file);
  }

  // CSV, XLSX, JSON: use existing parser
  if (!["csv", "xlsx", "xls", "json", "txt"].includes(ext)) {
    throw new Error(`Formato non supportato: .${ext}`);
  }

  const { parsed } = await parseFile(file);
  const { headers, rows } = parsed;

  // Map headers to business card fields
  const fieldMapping: Array<{ idx: number; field: keyof Omit<ParsedBusinessCard, "raw_data"> } | null> =
    headers.map((h, idx) => {
      const field = matchField(h);
      return field ? { idx, field } : null;
    });

  const mappings = fieldMapping.filter(Boolean) as Array<{ idx: number; field: keyof Omit<ParsedBusinessCard, "raw_data"> }>;

  if (mappings.length === 0) {
    throw new Error("Nessuna colonna riconosciuta. Serve almeno una colonna tra: nome, azienda, email, telefono.");
  }

  const cards: ParsedBusinessCard[] = [];

  for (const row of rows) {
    const card: ParsedBusinessCard = {};
    const raw: Record<string, string> = {};

    for (let i = 0; i < headers.length; i++) {
      if (row[i]?.trim()) raw[headers[i]] = row[i].trim();
    }

    for (const { idx, field } of mappings) {
      const val = row[idx]?.trim();
      if (val) card[field] = val;
    }

    if (card.contact_name || card.company_name || card.email) {
      card.raw_data = raw;
      cards.push(card);
    }
  }

  return cards;
}

/** Check if a file is an image */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpg|jpeg|png|heic|webp|gif|bmp|tiff?)$/i.test(file.name);
}

/** Check if a file is a data file */
export function isDataFile(file: File): boolean {
  return /\.(csv|xlsx|xls|json|vcf|txt)$/i.test(file.name);
}
