/**
 * LabGuideDialog — guida step-by-step di tutte le tab del Lab Hub.
 *
 * Si apre dal pulsante "Guida" sulla LabPage. Mostra in alto le stesse
 * tab del Lab (raggruppate per group) e per ognuna spiega: cosa fa,
 * perché, step operativi, output atteso, dove modificarla, caveats.
 */
import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LAB_GROUPS,
  LAB_TABS,
  DEFAULT_LAB_GROUP,
  DEFAULT_LAB_TAB_BY_GROUP,
  getLabTabsByGroup,
  type LabTabGroup,
} from "@/v2/config/labTabs";
import { getLabGuide } from "@/v2/config/labGuide";

interface LabGuideDialogProps {
  /** Tab attualmente attiva nella LabPage: pre-seleziona la guida giusta. */
  initialTabId?: string;
  initialGroup?: LabTabGroup;
}

export function LabGuideDialog({ initialTabId, initialGroup }: LabGuideDialogProps) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<LabTabGroup>(initialGroup ?? DEFAULT_LAB_GROUP);
  const [tabId, setTabId] = useState<string>(
    initialTabId ?? DEFAULT_LAB_TAB_BY_GROUP[initialGroup ?? DEFAULT_LAB_GROUP],
  );

  const tabsInGroup = useMemo(() => getLabTabsByGroup(group), [group]);
  const validIds = useMemo(() => new Set(tabsInGroup.map((t) => t.id)), [tabsInGroup]);
  const activeId = validIds.has(tabId) ? tabId : tabsInGroup[0]?.id ?? "";
  const activeTab = LAB_TABS.find((t) => t.id === activeId);
  const guide = getLabGuide(activeId);

  const handleGroupChange = (next: string) => {
    const g = next as LabTabGroup;
    setGroup(g);
    setTabId(DEFAULT_LAB_TAB_BY_GROUP[g]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="w-4 h-4" strokeWidth={1.5} />
          Guida
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" strokeWidth={1.5} />
            Guida Lab &amp; Verifiche
          </DialogTitle>
          <DialogDescription>
            Una scheda per ogni tab: cosa fa, perché esiste, come usarla, cosa produce e dove modificarla.
          </DialogDescription>
        </DialogHeader>

        {/* Group selector */}
        <div className="px-6 pb-2">
          <Tabs value={group} onValueChange={handleGroupChange}>
            <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/60 p-1">
              {LAB_GROUPS.map((g) => {
                const Icon = g.icon;
                return (
                  <TabsTrigger key={g.id} value={g.id} className="gap-2">
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span>{g.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Tab selector inside group */}
        <div className="px-6 pb-3">
          <Tabs value={activeId} onValueChange={setTabId}>
            <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/30 p-1">
              {tabsInGroup.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.id} value={t.id} className="gap-2">
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span>{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        <Separator />

        {/* Guide content */}
        <ScrollArea className="flex-1 px-6 py-5">
          {activeTab && guide ? (
            <article className="space-y-5 max-w-3xl">
              <header className="space-y-2">
                <div className="flex items-center gap-2">
                  <activeTab.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  <h2 className="text-xl font-semibold">{activeTab.label}</h2>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {LAB_GROUPS.find((g) => g.id === activeTab.group)?.label}
                  </Badge>
                </div>
                <p className="text-base text-foreground/90">{guide.purpose}</p>
              </header>

              <Section title="Perché esiste">
                <p>{guide.why}</p>
              </Section>

              <Section title="Come si usa, passo per passo">
                <ol className="space-y-3">
                  {guide.steps.map((s, i) => (
                    <li key={i} className="rounded-md border border-border/60 bg-muted/30 p-3">
                      <div className="font-medium text-sm">{s.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{s.body}</div>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="Cosa aspettarsi (output)">
                <p>{guide.expected}</p>
              </Section>

              <Section title="Dove modificare">
                <p className="font-mono text-xs bg-muted/40 rounded p-3 whitespace-pre-wrap">
                  {guide.editing}
                </p>
              </Section>

              {guide.caveats ? (
                <Section title="Attenzione">
                  <p className="text-amber-600 dark:text-amber-400">{guide.caveats}</p>
                </Section>
              ) : null}
            </article>
          ) : activeTab ? (
            <div className="text-sm text-muted-foreground">
              Documentazione in arrivo per <strong>{activeTab.label}</strong>. Aggiungi una entry in{" "}
              <code className="font-mono text-xs">src/v2/config/labGuide.ts</code> con id{" "}
              <code className="font-mono text-xs">{activeTab.id}</code>.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Seleziona una tab.</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

export default LabGuideDialog;