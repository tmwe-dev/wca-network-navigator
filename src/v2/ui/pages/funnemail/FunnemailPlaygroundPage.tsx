/**
 * FunnemailPlaygroundPage — Mail Playground ispirato al prototipo
 * `funnemail-sorgenti/index.html`. Editor con preset tono, switch vista
 * FunneMail/Globale, regola automatica e prompt AI personale.
 *
 * IMPORTANTE — Logica:
 *   - Nessuna scrittura su CRM, casella o contatti.
 *   - Pulsanti "Migliora con AI" rinviano al flusso ufficiale Email Lab
 *     (`/v2/email-lab`) che già passa da `invokeAi()` con journalistReview.
 *   - Questo è un banco di prova visivo: nessun invio reale, nessun
 *     bypass dei guard di sicurezza.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Wand2, Send, ArrowLeft, Sparkles, FlaskConical, Users, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { FunnemailGlassCard } from "@/v2/ui/atoms/funnemail/FunnemailGlassCard";
import { EmailEditorPanel } from "@/v2/ui/organisms/email/EmailEditorPanel";
import { cn } from "@/lib/utils";

type ToneKey = "plain" | "formale" | "diretto" | "operativo" | "newsletter" | "vip";
type ViewKey = "funnemail" | "globale";

const TONES: ReadonlyArray<{ key: ToneKey; label: string; hint: string }> = [
  { key: "plain",      label: "Plain",      hint: "Neutro, senza fronzoli" },
  { key: "formale",    label: "Formale",    hint: "Lei, registro alto" },
  { key: "diretto",    label: "Diretto",    hint: "Pochi giri, dritto al punto" },
  { key: "operativo",  label: "Operativo",  hint: "Liste, prossimi passi" },
  { key: "newsletter", label: "Newsletter", hint: "Tono informativo, ampio" },
  { key: "vip",        label: "VIP",        hint: "Cura, riconoscimento" },
];

const VIEWS: ReadonlyArray<{ key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "funnemail", label: "FunneMail", icon: Sparkles },
  { key: "globale",   label: "Globale",   icon: Globe },
];

export default function FunnemailPlaygroundPage(): React.ReactElement {
  const [view, setView] = React.useState<ViewKey>("funnemail");
  const [tone, setTone] = React.useState<ToneKey>("plain");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [autoRule, setAutoRule] = React.useState("");
  const [personalPrompt, setPersonalPrompt] = React.useState("");

  React.useEffect(() => {
    const prev = document.title;
    document.title = "Funnemail · Mail Playground";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader
        icon={Wand2}
        title="Mail Playground"
        subtitle="Componi un'email finta, scegli tono e regole — niente invii reali"
        right={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/v2/email-lab"><FlaskConical className="h-3.5 w-3.5" />Vai al Lab vero</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/v2/funnemail"><ArrowLeft className="h-3.5 w-3.5" />Hub</Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
          {/* Colonna principale: editor */}
          <FunnemailGlassCard className="flex min-h-[520px] flex-col gap-3 p-4">
            {/* Switch vista FunneMail/Globale */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
                {VIEWS.map((v) => {
                  const Icon = v.icon;
                  const active = view === v.key;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setView(v.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />{v.label}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled
                title="Modalità playground: nessun invio reale"
              >
                <Send className="h-3.5 w-3.5" />Componi a selezionati
              </Button>
            </div>

            {/* Preset tono (6 chip) */}
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Tono</div>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => {
                  const active = tone === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTone(t.key)}
                      title={t.hint}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editor */}
            <EmailEditorPanel
              subject={subject}
              onSubjectChange={setSubject}
              body={body}
              onBodyChange={setBody}
              recipientName="Mario Rossi"
              recipientCompany="Acme Srl"
              recipientCity="Milano"
              recipientCountry="Italia"
            />
          </FunnemailGlassCard>

          {/* Colonna destra: regola + prompt personale + suggerimenti */}
          <div className="flex flex-col gap-4">
            <FunnemailGlassCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground">Regola automatica</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Descrivi a parole quando questa email dovrebbe partire da sola
                (verrà solo memorizzata in locale, non attivata).
              </p>
              <textarea
                value={autoRule}
                onChange={(e) => setAutoRule(e.target.value)}
                placeholder="Es: ogni lunedì alle 9 ai clienti VIP che non rispondono da 2 settimane"
                className="mt-2 h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </FunnemailGlassCard>

            <FunnemailGlassCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground">Prompt AI personale</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Istruzioni extra solo per questa prova (non sovrascrive i prompt
                ufficiali Prompt Lab).
              </p>
              <textarea
                value={personalPrompt}
                onChange={(e) => setPersonalPrompt(e.target.value)}
                placeholder="Es: usa metafore sportive, mai più di 80 parole"
                className="mt-2 h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </FunnemailGlassCard>

            <FunnemailGlassCard className="p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Users className="h-3.5 w-3.5" />Destinatario di prova
              </h3>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Nome</dt><dd>Mario Rossi</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Azienda</dt><dd>Acme Srl</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Città</dt><dd>Milano</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Vista</dt><dd className="font-medium">{view}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tono</dt><dd className="font-medium">{tone}</dd></div>
              </dl>
              <p className="mt-3 text-[11px] text-muted-foreground/80">
                Per generare/migliorare davvero la bozza con AI, apri
                <Link to="/v2/email-lab" className="ml-1 text-primary hover:underline">Email Lab</Link>
                {" "}— passa dai prompt versionati e dal journalist review.
              </p>
            </FunnemailGlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export { FunnemailPlaygroundPage };