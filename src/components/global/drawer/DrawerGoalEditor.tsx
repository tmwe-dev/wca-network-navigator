import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Target, FileText, MessageSquareText } from "lucide-react";
import ContentSelect from "@/components/shared/ContentSelect";

interface Props {
  goalOpen: boolean;
  proposalOpen: boolean;
  contextOpen: boolean;
  onGoalOpenChange: (open: boolean) => void;
  onProposalOpenChange: (open: boolean) => void;
  onContextOpenChange: (open: boolean) => void;
  goal: string;
  baseProposal: string;
  context: string;
  onSetGoal: (v: string) => void;
  onSetBaseProposal: (v: string) => void;
  onSetContext: (v: string) => void;
}

const CONTEXT_CHIPS = [
  { label: "Fiera / Evento", value: "Incontrato a una fiera/evento di settore" },
  { label: "Trovato online", value: "Trovato online attraverso ricerca di mercato" },
  { label: "Referral", value: "Segnalato da un partner/contatto comune" },
  { label: "Ex-cliente", value: "Ricontatto di un ex-cliente per nuova collaborazione" },
  { label: "Cold outreach", value: "Primo contatto a freddo basato sul profilo aziendale" },
  { label: "Follow-up", value: "Follow-up dopo un primo contatto precedente" },
];

export function DrawerGoalEditor(props: Props) {
  const { goal, baseProposal, context, onSetGoal, onSetBaseProposal, onSetContext } = props;

  return (
    <>
      <Dialog open={props.goalOpen} onOpenChange={props.onGoalOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Obiettivo</DialogTitle>
            <DialogDescription className="text-xs">Seleziona o scrivi il tuo obiettivo</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            <ContentSelect type="goals" onSelect={(text) => onSetGoal(text)} selectedText={goal} placeholder="Seleziona obiettivo..." />
            <Textarea value={goal} onChange={e => onSetGoal(e.target.value)} placeholder="Descrivi l'obiettivo..." className="min-h-[100px] text-sm resize-none" />
          </div>
          <DialogFooter><Button size="sm" onClick={() => props.onGoalOpenChange(false)}>Chiudi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.proposalOpen} onOpenChange={props.onProposalOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /> Proposta Base</DialogTitle>
            <DialogDescription className="text-xs">Seleziona o scrivi la proposta</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            <ContentSelect type="proposals" onSelect={(text) => onSetBaseProposal(text)} selectedText={baseProposal} placeholder="Seleziona proposta..." />
            <Textarea value={baseProposal} onChange={e => onSetBaseProposal(e.target.value)} placeholder="La proposta commerciale..." className="min-h-[100px] text-sm resize-none" />
          </div>
          <DialogFooter><Button size="sm" onClick={() => props.onProposalOpenChange(false)}>Chiudi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.contextOpen} onOpenChange={props.onContextOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-primary" /> Contesto</DialogTitle>
            <DialogDescription className="text-xs">Perché stai scrivendo? Il contesto guida l'AI nella personalizzazione</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_CHIPS.map(chip => (
                <button key={chip.label} onClick={() => onSetContext(context ? `${context}. ${chip.value}` : chip.value)} className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/40 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  {chip.label}
                </button>
              ))}
            </div>
            <Textarea value={context} onChange={e => onSetContext(e.target.value)} placeholder="Es: Abbiamo incontrato il sig. Rossi alla fiera di Milano il 15 marzo..." className="min-h-[120px] text-sm resize-none" />
          </div>
          <DialogFooter>
            {context && <Button variant="ghost" size="sm" onClick={() => onSetContext("")}>Cancella</Button>}
            <Button size="sm" onClick={() => props.onContextOpenChange(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
