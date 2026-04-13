/**
 * ClassificationList — Adapted from tmwengine SmartEmailListIntelligent.
 * ScrollArea card list pattern.
 */
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClassificationCard } from './ClassificationCard';
import { Inbox } from 'lucide-react';

interface Classification {
  id: string;
  email_address: string;
  category: string;
  confidence: number;
  ai_summary: string | null;
  keywords: string[] | null;
  urgency: string | null;
  sentiment: string | null;
  action_suggested: string | null;
  classified_at: string;
  partner_id: string | null;
  subject: string | null;
}

interface ClassificationListProps {
  classifications: Classification[];
  onItemClick: (c: Classification) => void;
  isLoading?: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

export function ClassificationList({ classifications, onItemClick, isLoading, selectedIds, onSelectionChange }: ClassificationListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
        <div className="text-center space-y-3 p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Caricamento classificazioni...</p>
        </div>
      </div>
    );
  }

  if (classifications.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
        <div className="text-center space-y-3 p-8">
          <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <h3 className="text-lg font-semibold">Nessuna email classificata</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Le classificazioni appariranno qui dopo la sincronizzazione email.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-6 space-y-4">
          {classifications.map((c) => (
            <ClassificationCard
              key={c.id}
              classification={c}
              onClick={() => onItemClick(c)}
              isSelected={selectedIds.has(c.id)}
              onToggleSelect={() => handleToggle(c.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
