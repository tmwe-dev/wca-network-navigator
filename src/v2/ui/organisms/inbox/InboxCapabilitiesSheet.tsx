/**
 * InboxCapabilitiesSheet — drawer "Cosa può fare l'AI qui".
 *
 * Mappa statica (testo + link) di tutte le attività che il sistema sa già
 * svolgere intorno alle email: sync, classificazione, regole, intelligence,
 * ricerca, governance.
 *
 * Nessuna logica: solo presentazione + navigazione verso pagine dedicate
 * (Prompt Lab, Email Intelligence, Pipeline Traces, AI Interaction Log).
 */
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Capability = {
  title: string;
  detail: string;
};

type Section = {
  title: string;
  items: Capability[];
  link?: { label: string; to: string };
};

const SECTIONS: Section[] = [
  {
    title: "Lettura & sincronia",
    items: [
      { title: "Scarica nuove", detail: "Pull IMAP on-demand o continuo, con pausa notturna." },
      { title: "Download massivo", detail: "Backfill storico paginato e ripartibile." },
      { title: "Auto-sync", detail: "Ciclo automatico in background con cursore persistente." },
      { title: "Reset cursore", detail: "Riparti da zero senza duplicati (dedup upsert)." },
    ],
  },
  {
    title: "Classificazione & gruppi",
    items: [
      { title: "Classificazione AI", detail: "Categoria automatica + learning loop su dominio/mittente." },
      { title: "Assegna a gruppo", detail: "Manuale o suggerito, con icona e colore." },
      { title: "Suggerisci nuovi gruppi", detail: "Clustering AI con prompt editabile dal Prompt Lab." },
    ],
    link: { label: "Apri Email Intelligence", to: "/v2/email-intelligence" },
  },
  {
    title: "Regole & azioni automatiche",
    items: [
      { title: "Regole per mittente", detail: "Mark read · Archivia · Nascondi · Spam · Sposta cartella." },
      { title: "Retro-applica su storico", detail: "Backfill della regola sulle email già scaricate." },
      { title: "Cartelle IMAP", detail: "Move / archive / spam / create folder direttamente sul server." },
      { title: "Bulk action", detail: "Applica un'azione a N email selezionate in un colpo solo." },
    ],
  },
  {
    title: "Intelligence & risposta",
    items: [
      { title: "Genera risposta", detail: "Bozza AI con editorial review obbligatorio." },
      { title: "Migliora bozza", detail: "Riscrittura mirata mantenendo tono e contesto." },
      { title: "Classifica risposta", detail: "Escalation automatica del lead_status sulle inbound." },
      { title: "Autoresponder template", detail: "Solo template pre-approvati (eccezione editorial)." },
      { title: "Bounce automation", detail: "Hard/soft bounce gestiti durante il check-inbox." },
    ],
    link: { label: "Apri Prompt Lab", to: "/v2/prompt-lab" },
  },
  {
    title: "Ricerca & contesto",
    items: [
      { title: "Deep Search", detail: "Sherlock Scout / Detective / Sherlock per arricchire il mittente." },
      { title: "Apri partner / contatto", detail: "Drawer con scheda completa direttamente dal messaggio." },
      { title: "Holding pattern", detail: "Chip ✈️ pulsante per contatti in pausa controllata." },
    ],
  },
  {
    title: "Governance",
    items: [
      { title: "Prompt versionati", detail: "Ogni prompt operativo email è snapshot + testabile." },
      { title: "AI Interaction Log", detail: "Storico messaggi AI con thumbs up/down per feedback." },
      { title: "Pipeline Traces", detail: "Vedi passo-passo cosa fa la pipeline su una mail." },
    ],
    link: { label: "Vedi catalogo prompt", to: "/v2/prompt-lab/catalog" },
  },
];

export interface InboxCapabilitiesSheetProps {
  trigger?: React.ReactNode;
}

export function InboxCapabilitiesSheet({ trigger }: InboxCapabilitiesSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
            <Sparkles className="h-3 w-3" />
            Cosa può fare l'AI qui
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Cosa può fare l'AI qui
          </SheetTitle>
          <SheetDescription>
            Mappa delle attività che il sistema sa già svolgere intorno alle email,
            in autonomia o su tua approvazione.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2"
                  >
                    <div className="text-xs font-semibold text-foreground">{item.title}</div>
                    <div className="text-[11px] leading-snug text-foreground/70">{item.detail}</div>
                  </li>
                ))}
              </ul>
              {section.link && (
                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                  <Link to={section.link.to}>→ {section.link.label}</Link>
                </Button>
              )}
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}