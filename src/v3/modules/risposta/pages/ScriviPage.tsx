/**
 * Scrivi — maschera Operativa. "Cosa mando e a chi?"
 *
 * Composizione guidata di una bozza email: destinatario (ricerca o email
 * libera), oggetto, corpo. Il pulsante "Invia" mette la bozza nella coda di
 * Approvazioni: nessun invio diretto, l'editorial review è obbligatoria.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Loader2, Mail, Send, User, X } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { V3_PAGES } from "@/v3/app/pageContract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useScrivi } from "../useScrivi";
import type { V3Destinatario } from "@/data/v3/scrivi";

function RigaDestinatario({
  destinatario,
  onSelect,
}: {
  readonly destinatario: V3Destinatario;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
    >
      {destinatario.tipo === "partner" ? (
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">
          {destinatario.nome ?? destinatario.azienda ?? destinatario.email}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {destinatario.email}
          {destinatario.nome && destinatario.azienda ? ` · ${destinatario.azienda}` : ""}
        </span>
      </span>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {destinatario.tipo === "partner" ? "Azienda" : "Contatto"}
      </Badge>
    </button>
  );
}

export function ScriviPage(): React.ReactElement {
  const {
    destinatario,
    emailLibera,
    setEmailLibera,
    ricerca,
    setRicerca,
    risultati,
    isCercando,
    seleziona,
    oggetto,
    setOggetto,
    corpo,
    setCorpo,
    modelli,
    applicaModello,
    emailEffettiva,
    pronto,
    accoda,
    isAccodando,
    esitoAccodamento,
    azzera,
  } = useScrivi();

  return (
    <PageFrame
      pageId="scrivi"
      actions={
        <>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={azzera}>
            Azzera
          </Button>
          <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" disabled={!pronto || isAccodando} onClick={accoda}>
            {isAccodando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Metti in approvazione
          </Button>
        </>
      }
      workflow={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Modelli attivi</p>
            <p className="px-0.5 text-[11px] text-muted-foreground/80">
              Tocca un modello per usarne obiettivo e procedura come base del corpo.
            </p>
            <div className="space-y-1">
              {modelli.length === 0 && <p className="px-0.5 text-xs text-muted-foreground">Nessun modello attivo.</p>}
              {modelli.slice(0, 12).map((modello) => (
                <button
                  key={modello.id}
                  type="button"
                  onClick={() => applicaModello(modello)}
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {modello.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-[11px] font-medium text-muted-foreground">Come funziona</p>
            <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
              La bozza non parte mai da qui. Viene messa in{" "}
              <Link to={V3_PAGES.approvazioni.path} className="text-primary underline-offset-2 hover:underline">
                Approvazioni
              </Link>{" "}
              e l'invio avviene solo dopo la tua conferma.
            </p>
          </div>
        </div>
      }
    >
      <div className="mx-auto flex h-full max-w-2xl flex-col gap-3 overflow-y-auto">
        {esitoAccodamento && (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">{esitoAccodamento}</span>
            <Link to={V3_PAGES.approvazioni.path} className="shrink-0 text-xs text-primary underline-offset-2 hover:underline">
              Apri Approvazioni
            </Link>
          </div>
        )}

        {/* Destinatario */}
        <section className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Destinatario</p>
          {destinatario ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {destinatario.nome ?? destinatario.azienda ?? ""} &lt;{destinatario.email}&gt;
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => seleziona(null)} aria-label="Cambia destinatario">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <Input
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca per nome, azienda o email…"
                className="h-8 text-sm"
              />
              {ricerca.trim().length >= 2 && (
                <div className="rounded-md border border-border bg-card p-1">
                  {isCercando && <p className="px-2 py-1.5 text-xs text-muted-foreground">Ricerca in corso…</p>}
                  {!isCercando && risultati.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nessun contatto trovato. Puoi scrivere l'indirizzo a mano sotto.
                    </p>
                  )}
                  {risultati.map((r) => (
                    <RigaDestinatario key={`${r.tipo}-${r.id}`} destinatario={r} onSelect={() => seleziona(r)} />
                  ))}
                </div>
              )}
              <Input
                value={emailLibera}
                onChange={(e) => setEmailLibera(e.target.value)}
                placeholder="oppure scrivi l'indirizzo email direttamente"
                type="email"
                className="h-8 text-sm"
              />
            </div>
          )}
        </section>

        {/* Oggetto */}
        <section className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Oggetto</p>
          <Input
            value={oggetto}
            onChange={(e) => setOggetto(e.target.value)}
            placeholder="Oggetto del messaggio"
            className="h-8 text-sm"
          />
        </section>

        {/* Corpo */}
        <section className="flex min-h-0 flex-1 flex-col space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Messaggio</p>
          <Textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Scrivi il messaggio. Andrà in approvazione prima di partire: lì potrai ancora correggerlo."
            className="min-h-40 flex-1 resize-none text-sm"
          />
        </section>

        <p className="text-[11px] text-muted-foreground">
          {pronto
            ? `Pronto per l'approvazione → ${emailEffettiva}`
            : "Servono un destinatario valido, un oggetto e il testo del messaggio."}
        </p>
      </div>
    </PageFrame>
  );
}

export default ScriviPage;
