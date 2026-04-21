/**
 * UploadButton — accetta .txt/.md/.json/.csv e crea blocchi nuovi.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import type { Block } from "./types";
import { toast } from "sonner";

interface UploadButtonProps {
  onBlocksUploaded: (blocks: Block[]) => void;
  accept?: string;
}

export function UploadButton({ onBlocksUploaded, accept = ".txt,.md,.json,.csv" }: UploadButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const newBlocks: Block[] = [];

      if (ext === "txt" || ext === "md") {
        newBlocks.push({
          id: `upload-${Date.now()}`,
          label: file.name,
          content: text,
          source: { kind: "ephemeral" },
          dirty: true,
        });
      } else if (ext === "json") {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        arr.forEach((item, i) => {
          newBlocks.push({
            id: `upload-${Date.now()}-${i}`,
            label: typeof item === "object" && item && "title" in item ? String(item.title) : `${file.name} #${i + 1}`,
            content: typeof item === "string" ? item : JSON.stringify(item, null, 2),
            source: { kind: "ephemeral" },
            dirty: true,
          });
        });
      } else if (ext === "csv") {
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        const header = lines[0]?.split(",").map((h) => h.trim()) ?? [];
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(",");
          const row: Record<string, string> = {};
          header.forEach((h, idx) => {
            row[h] = cells[idx]?.trim() ?? "";
          });
          newBlocks.push({
            id: `upload-${Date.now()}-${i}`,
            label: row.title ?? `Riga ${i}`,
            content: row.content ?? JSON.stringify(row),
            source: { kind: "ephemeral" },
            dirty: true,
          });
        }
      } else {
        throw new Error(`Estensione non supportata: ${ext}`);
      }

      onBlocksUploaded(newBlocks);
      toast.success(`Importati ${newBlocks.length} blocchi da ${file.name}`);
    } catch (e) {
      toast.error(`Errore upload: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> Upload
      </Button>
    </>
  );
}