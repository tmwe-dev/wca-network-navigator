/**
 * File Parser Utility
 * Handles parsing of uploaded files (PDF, DOCX, TXT, MD, JSON, CSV)
 * and extracts text content for injection into the Prompt Lab's global improver.
 */

/**
 * Supported file extensions for upload
 */
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".json", ".csv"];

/**
 * HTML accept attribute string for file input elements
 */
export const ACCEPT_STRING = ".txt,.md,.pdf,.docx,.json,.csv";

/**
 * Type definition for parsed file result
 */
export interface ParsedFile {
  name: string;
  content: string;
  sizeKb: number;
}

/**
 * Parses a plain text file
 */
async function parseText(file: File): Promise<string> {
  return file.text();
}

/**
 * Parses a Markdown file
 */
async function parseMd(file: File): Promise<string> {
  return file.text();
}

/**
 * Parses a CSV file
 */
async function parseCsv(file: File): Promise<string> {
  return file.text();
}

/**
 * Parses a JSON file with pretty printing
 */
async function parseJson(file: File): Promise<string> {
  const text = await file.text();
  try {
    const json = JSON.parse(text);
    return JSON.stringify(json, null, 2);
  } catch {
    // If JSON parsing fails, return the raw text
    return text;
  }
}

/**
 * Parses a PDF file using pdfjs-dist
 * Gracefully falls back if pdfjs-dist is not available
 */
async function parsePdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Try dynamic import of pdfjs-dist
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(pageText);
    }

    return pages.join("\n\n");
  } catch {
    // Fallback: inform user that PDF parsing is not available
    return `[PDF: ${file.name} — ${Math.round(file.size / 1024)}KB — parsing non disponibile in questo ambiente. Copia il testo nel campo "Materiale di riferimento".]`;
  }
}

/**
 * Parses a DOCX file using mammoth
 * Gracefully falls back if mammoth is not available
 */
async function parseDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch {
    // Fallback: inform user that DOCX parsing is not available
    return `[DOCX: ${file.name} — ${Math.round(file.size / 1024)}KB — parsing non disponibile. Copia il testo nel campo "Materiale di riferimento".]`;
  }
}

/**
 * Gets the file extension from a filename
 */
function getExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return filename.substring(lastDotIndex).toLowerCase();
}

/**
 * Parses an uploaded file and extracts its text content
 *
 * @param file The File object to parse
 * @returns An object containing the file name, extracted content, and size in KB
 * @throws Error if the file extension is not supported
 *
 * @example
 * const file = new File(["Hello world"], "test.txt", { type: "text/plain" });
 * const result = await parseUploadedFile(file);
 * console.log(result.content); // "Hello world"
 */
export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const extension = getExtension(file.name);
  const sizeKb = Math.round(file.size / 1024);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Unsupported file type: ${extension}. Supported types are: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
  }

  let content: string;

  switch (extension) {
    case ".txt":
      content = await parseText(file);
      break;
    case ".md":
      content = await parseMd(file);
      break;
    case ".csv":
      content = await parseCsv(file);
      break;
    case ".json":
      content = await parseJson(file);
      break;
    case ".pdf":
      content = await parsePdf(file);
      break;
    case ".docx":
      content = await parseDocx(file);
      break;
    default:
      // This should never happen due to the check above, but TypeScript needs it
      throw new Error(`Unsupported file type: ${extension}`);
  }

  return {
    name: file.name,
    content,
    sizeKb,
  };
}
