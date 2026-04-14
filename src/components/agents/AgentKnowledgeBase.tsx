import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, BookOpen } from "lucide-react";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { toast } from "sonner";

interface KBEntry {
  title: string;
  content: string;
}

interface Props {
  agent: Agent;
}

export function AgentKnowledgeBase({ agent }: Props) {
  const [entries, setEntries] = useState<KBEntry[]>((agent.knowledge_base as any as KBEntry[]) || []);
  const { updateAgent } = useAgents();

  useEffect(() => setEntries((agent.knowledge_base as any as KBEntry[]) || []), [agent.id]);

  const addEntry = () => setEntries([...entries, { title: "", content: "" }]);

  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));

  const updateEntry = (i: number, field: keyof KBEntry, value: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], [field]: value };
    setEntries(copy);
  };

  const save = () => {
    updateAgent.mutate(
      { id: agent.id, knowledge_base: entries as any } as any,
      { onSuccess: () => toast.success("Knowledge Base salvata") }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Knowledge Base ({entries.length})
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addEntry}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi
          </Button>
          <Button size="sm" onClick={save}>
            <Save className="w-3.5 h-3.5 mr-1" /> Salva
          </Button>
        </div>
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nessun documento. Aggiungi documenti, procedure o informazioni che l'agente deve conoscere.
        </p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="border border-border/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={entry.title}
              onChange={(e) => updateEntry(i, "title", e.target.value)}
              placeholder="Titolo documento"
              className="text-sm"
            />
            <Button size="icon" variant="ghost" onClick={() => removeEntry(i)} aria-label="Elimina">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
          <Textarea
            value={entry.content}
            onChange={(e) => updateEntry(i, "content", e.target.value)}
            placeholder="Contenuto..."
            className="min-h-[100px] text-xs"
          />
        </div>
      ))}
    </div>
  );
}
