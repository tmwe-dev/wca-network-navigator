import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Save } from "lucide-react";
import type { EmailType } from "@/data/defaultEmailTypes";

interface Props {
  emailType: EmailType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (newType: EmailType) => void;
}

function parsePrompt(prompt: string) {
  const lines = prompt.split("\n").map(l => l.trim()).filter(Boolean);

  let obiettivo = "";
  const struttura: string[] = [];
  const vincoli: string[] = [];

  let section: "obj" | "struct" | "vincoli" | null = null;

  for (const line of lines) {
    if (line.startsWith("Obiettivo:")) {
      obiettivo = line.replace("Obiettivo:", "").trim();
      section = "obj";
      continue;
    }
    if (line.startsWith("STRUTTURA OBBLIGATORIA:")) {
      section = "struct";
      continue;
    }
    if (line.startsWith("VINCOLI:")) {
      section = "vincoli";
      continue;
    }

    if (section === "struct") {
      if (/^\d+\./.test(line)) {
        struttura.push(line);
      } else if (struttura.length > 0) {
        struttura[struttura.length - 1] += " " + line;
      }
    } else if (section === "vincoli") {
      if (line.startsWith("-")) {
        vincoli.push(line.replace(/^-\s*/, ""));
      } else if (vincoli.length > 0) {
        vincoli[vincoli.length - 1] += " " + line;
      }
    }
  }

  return { obiettivo, struttura, vincoli };
}

export default function EmailTypeDetailDialog({ emailType, open, onOpenChange, onDuplicate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  if (!emailType) return null;

  const { obiettivo, struttura, vincoli } = parsePrompt(emailType.prompt);

  const startEdit = () => {
    setEditName(emailType.name + " (copia)");
    setEditIcon(emailType.icon);
    setEditPrompt(emailType.prompt);
    setEditing(true);
  };

  const handleSave = () => {
    if (!editName.trim() || !editPrompt.trim()) return;
    const newType: EmailType = {
      id: `custom_${Date.now()}`,
      name: editName.trim(),
      icon: editIcon || "📧",
      category: "altro",
      prompt: editPrompt.trim(),
      tone: emailType.tone,
    };
    onDuplicate(newType);
    setEditing(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-lg">{emailType.icon}</span>
            {emailType.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Dettaglio tipo email</DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-4 text-sm">
            {/* Obiettivo */}
            {obiettivo && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Obiettivo</h4>
                <p className="text-foreground/80">{obiettivo}</p>
              </div>
            )}

            {/* Struttura */}
            {struttura.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Struttura</h4>
                <div className="flex items-center gap-1 mb-2">
                  {emailType.structure?.split("→").map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.trim()}</Badge>
                    </span>
                  ))}
                </div>
                <ol className="space-y-1.5 list-decimal list-inside text-foreground/70">
                  {struttura.map((s, i) => (
                    <li key={i} className="text-xs leading-relaxed">{s.replace(/^\d+\.\s*/, "")}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Vincoli */}
            {vincoli.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Vincoli</h4>
                <ul className="space-y-1 list-disc list-inside text-foreground/70">
                  {vincoli.map((v, i) => (
                    <li key={i} className="text-xs leading-relaxed">{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tono */}
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Tono</h4>
              <Badge variant="outline" className="text-[10px]">{emailType.tone}</Badge>
            </div>

            {/* Duplica e modifica */}
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={startEdit}>
              <Copy className="w-3.5 h-3.5" /> Duplica e modifica
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={editIcon} onChange={e => setEditIcon(e.target.value)} className="w-12 text-center text-sm" maxLength={2} />
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome tipo" className="flex-1 text-sm" />
            </div>
            <Textarea
              value={editPrompt}
              onChange={e => setEditPrompt(e.target.value)}
              className="text-xs min-h-[200px] font-mono"
              rows={10}
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleSave}>
                <Save className="w-3.5 h-3.5" /> Salva come nuovo tipo
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditing(false)}>Annulla</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
