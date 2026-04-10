import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type KbInsert = Database["public"]["Tables"]["kb_entries"]["Insert"];

export interface KbEntry {
  id: string;
  user_id: string;
  category: string;
  chapter: string;
  title: string;
  content: string;
  tags: string[];
  priority: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useKbEntries() {
  return useQuery({
    queryKey: ["kb_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_entries")
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as KbEntry[];
    },
  });
}

export function useUpsertKbEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<KbEntry> & { title: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        ...entry,
        user_id: user.id,
      };

      if (entry.id) {
        const { error } = await supabase.from("kb_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kb_entries").insert(payload as KbInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb_entries"] });
      toast.success("Scheda KB salvata");
    },
    onError: (e: any) => toast.error(e.message || "Errore salvataggio KB"),
  });
}

export function useDeleteKbEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kb_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb_entries"] });
      toast.success("Scheda eliminata");
    },
    onError: (e: any) => toast.error(e.message || "Errore eliminazione"),
  });
}

export function useSeedKbFromLegacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { count } = await supabase
        .from("kb_entries")
        .select("id", { count: "exact", head: true });
      if ((count || 0) > 0) throw new Error("KB già popolata. Elimina le schede esistenti prima di re-importare.");

      const entries = getDefaultKbEntries(user.id);
      // Insert in batches of 10 to avoid payload limits
      for (let i = 0; i < entries.length; i += 10) {
        const batch = entries.slice(i, i + 10);
        const { error } = await supabase.from("kb_entries").insert(batch as KbInsert[]);
        if (error) throw error;
      }
      return entries.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["kb_entries"] });
      toast.success(`${count} schede KB importate con successo`);
    },
    onError: (e: any) => toast.error(e.message || "Errore importazione"),
  });
}

type KbSeed = Omit<KbEntry, "id" | "created_at" | "updated_at">;
function e(userId: string, cat: string, ch: string, title: string, content: string, tags: string[], priority: number, sort: number): KbSeed {
  return { user_id: userId, category: cat, chapter: ch, title, content, tags, priority, sort_order: sort, is_active: true };
}

function getDefaultKbEntries(userId: string): KbSeed[] {
  return [
    // ═══════════════════════════════════════════════════
    // SEZ. 1 — REGOLE SISTEMA
    // ═══════════════════════════════════════════════════
    e(userId, "regole_sistema", "Regole AI", "7 Regole inviolabili per email AI",
`1. Mai menzionare il prezzo per primo: il valore si comunica sempre prima del costo.
2. Mai criticare i competitor direttamente: usa domande che fanno emergere i limiti.
3. Mai forzare la vendita: la pressione è sostituita da logica e valore.
4. Mai usare un tono generico: ogni email deve sembrare scritta per quel destinatario.
5. Sempre chiudere con un'azione: ogni email contiene UNA SOLA CTA chiara.
6. Brevità con sostanza: email concise ma dense di valore.
7. Personalizza con almeno 3 campi del partner.`,
      ["regole", "email", "sistema", "inviolabili"], 10, 0),

    // ═══════════════════════════════════════════════════
    // SEZ. 2 — FILOSOFIA VENDITORE
    // ═══════════════════════════════════════════════════
    e(userId, "filosofia", "Filosofia Venditore", "Identità e personalità del venditore",
`Il venditore non è un semplice commerciale. È un consulente d'elite che combina competenza logistica, intelligenza emotiva e determinazione.

Non vende servizi: costruisce partnership.
Non insegue clienti: li seleziona.
Non parla di prezzo: parla di valore.

Personalità: calmo, riflessivo, analitico. Fiducia radicata in preparazione maniacale.`,
      ["filosofia", "identità", "vendita", "tono"], 8, 1),

    e(userId, "filosofia", "Filosofia Venditore", "Le 5 Missioni Fondamentali",
`1. GUIDA STRATEGICA: Ogni interazione parte dalla realtà del cliente e arriva alla soluzione. Non si vende: si guida.
2. ASCOLTO PROFONDO: Ogni frase del cliente è un indizio. Il venditore è un detective del business.
3. FOCUS ASSOLUTO: Non cambiare argomento, salvo per smascherare un problema nascosto.
4. VALORE PRIMA DEL PREZZO: Il prezzo si discute solo dopo che il valore è stato dimostrato. Mai prima.
5. CREARE IL BISOGNO: Il cliente deve sentire il BISOGNO di lavorare con te e considerare insostituibile il supporto.`,
      ["filosofia", "missioni", "vendita", "5_missioni"], 9, 2),

    e(userId, "filosofia", "Filosofia Venditore", "Approccio Anti-Ansia",
`Presentati con calma, sapendo di offrire valore assoluto.
Il tuo approccio è quello del consulente che ha selezionato con cura l'azienda da contattare.
Conferma sempre che le scelte passate del cliente sono state intelligenti.
Non fai telemarketing: offri valore, consulenza, risparmio, modernità.`,
      ["filosofia", "anti-ansia", "approccio", "calma"], 7, 3),

    // ═══════════════════════════════════════════════════
    // SEZ. 3 — 10 COMANDAMENTI NEGOZIAZIONE
    // ═══════════════════════════════════════════════════
    e(userId, "negoziazione", "10 Comandamenti", "Comandamenti 1-5 della negoziazione",
`1. PORTA AL NO CONSAPEVOLE: "È contrario a...?" — il "no" fa sentire il cliente al sicuro.
2. SMASCHERA LA DECISION FATIGUE: offri max 2 opzioni, mai elenchi infiniti.
3. CONTROLLO EMOTIVO: mai rispondere d'impulso. Anche con rifiuto brusco, rispondi con calma.
4. CONTROLLO NEGOZIALE: porta con logica il cliente a comprendere il valore.
5. ASCOLTA PRIMA, GUIDA DOPO: nelle risposte, dimostra di aver compreso prima di proporre.`,
      ["negoziazione", "comandamenti", "1-5"], 9, 4),

    e(userId, "negoziazione", "10 Comandamenti", "Comandamenti 6-10 della negoziazione",
`6. NON VENDERE, ORIENTA: proponi soluzioni, non prodotti.
7. CONCRETEZZA: dati reali, tempistiche precise, esempi verificabili. Niente frasi vaghe.
8. ANTICIPA LE OBIEZIONI: affronta proattivamente i dubbi comuni prima che vengano sollevati.
9. CREA COINVOLGIMENTO: poni domande, invita a rispondere, coinvolgi attivamente.
10. VALORE PRIMA DEL PREZZO — SEMPRE: mai menzionare costi senza aver comunicato il valore.`,
      ["negoziazione", "comandamenti", "6-10"], 9, 5),

    // ═══════════════════════════════════════════════════
    // SEZ. 4 — CHRIS VOSS
    // ═══════════════════════════════════════════════════
    e(userId, "chris_voss", "Chris Voss — Black Swan", "VOSS-01: Domande orientate al NO",
`Le persone possono dire "no" anche con decision fatigue. Il "no" richiede meno energia e fa sentire in controllo.

Sostituisci "Le farebbe piacere...?" con:
• "È contrario a...?"
• "La metto in difficoltà se...?"
• "Sarebbe un problema se...?"

Esempio: "Ha qualcosa in contrario a ricevere una breve panoramica delle soluzioni che stiamo offrendo ad aziende del vostro settore?"`,
      ["chris_voss", "no", "domande", "tecnica"], 9, 6),

    e(userId, "chris_voss", "Chris Voss — Black Swan", "VOSS-02: Riattivazione post-ghosting",
`Quando il cliente sparisce, la domanda "Ha rinunciato a X?" riattiva la conversazione il 99% delle volte.
Il cliente non vuole ammettere di aver rinunciato.

Esempio email: "Ha rinunciato all'idea di ottimizzare la gestione delle spedizioni, oppure è semplicemente una questione di tempistica?"

Regola: usare solo dopo 21+ giorni di silenzio.`,
      ["chris_voss", "ghosting", "riattivazione"], 9, 7),

    e(userId, "chris_voss", "Chris Voss — Black Swan", "VOSS-03: Gestione prezzo",
`Se il cliente tratta sul prezzo, il problema NON è il prezzo ma il valore percepito.
Non tagliare mai il prezzo. Concentrati sul valore, migliora il servizio, sovra-consegna.

Regola: "Se stai negoziando sul prezzo, stai parlando della cosa sbagliata."

In email: proponi un'analisi comparativa dei costi totali (supplementi, tempo, errori) anziché fare sconti.`,
      ["chris_voss", "prezzo", "valore"], 9, 8),

    e(userId, "chris_voss", "Chris Voss — Black Swan", "VOSS-04: Labeling e Mirroring",
`LABELING: Dai un nome all'emozione dell'altro.
→ "Sembra che la sua preoccupazione principale sia..."

MIRRORING: Riprendi le esatte parole che il cliente ha usato nella sua risposta.

Esempio: "Dalla sua risposta sembra che il tema principale sia la continuità del servizio e l'affidabilità nei momenti critici."

Regola: usa labeling per validare, mirroring per approfondire.`,
      ["chris_voss", "labeling", "mirroring"], 8, 9),

    e(userId, "chris_voss", "Chris Voss — Black Swan", "VOSS-05: Forced Empathy",
`Quando il cliente chiede qualcosa di irragionevole, non rifiutare e non cedere.

In email si traduce in:
"Mi aiuti a capire come potremmo rendere possibile ciò mantenendo la qualità che meritate."

Questa tecnica riporta la responsabilità al cliente senza creare conflitto.`,
      ["chris_voss", "empatia", "irragionevole"], 7, 10),

    // ═══════════════════════════════════════════════════
    // SEZ. 5 — STRUTTURA EMAIL
    // ═══════════════════════════════════════════════════
    e(userId, "struttura_email", "Struttura Email", "La regola delle 5 righe (primo contatto)",
`Un'email di primo contatto deve essere leggibile in 30 secondi:

• Riga 1: HOOK — perché gli stai scrivendo (network, riferimento, dato di mercato)
• Riga 2-3: VALUE PROPOSITION — cosa fai e perché è rilevante per LUI
• Riga 4: SOCIAL PROOF — una metrica, un cliente, una certificazione
• Riga 5: CTA — un'azione sola, semplice, a basso impegno`,
      ["struttura", "email", "5_righe", "primo_contatto"], 9, 11),

    e(userId, "struttura_email", "Struttura Email", "Struttura dettagliata in 7 passi",
`1. SALUTO: breve, personale. "Dear [Nome]," — mai "Dear Sir/Madam"
2. HOOK DI APERTURA (1 frase): collega te al destinatario
3. CONTESTO (1-2 frasi): chi sei, cosa fai, perché è rilevante
4. VALORE SPECIFICO (2-3 frasi): cosa puoi fare per lui concretamente
5. PROVA (1 frase): dato, certificazione, volume, referenza
6. CTA (1 frase): proposta chiara e a basso impegno
7. CHIUSURA: cordiale, professionale`,
      ["struttura", "email", "7_passi", "template"], 8, 12),

    e(userId, "struttura_email", "Struttura Email", "Lunghezze email per tipo",
`PRIMO CONTATTO: 80-120 parole (mai oltre 150). Il prospect non ti conosce.
FOLLOW-UP: 50-80 parole. Breve, nuovo angolo, nuova info.
PROPOSTA DETTAGLIATA: max 200 parole con bullet points.

Regola: se puoi togliere una frase senza perdere significato, toglila.
Ogni parola deve giustificare la sua presenza.`,
      ["struttura", "lunghezza", "parole", "regole"], 7, 13),

    // ═══════════════════════════════════════════════════
    // SEZ. 6 — HOOK / APERTURA
    // ═══════════════════════════════════════════════════
    e(userId, "hook", "Tecniche di Apertura", "Hook per network condiviso",
`• "As fellow [WCA/FIATA] members, I wanted to reach out..."
• "I noticed we're both part of [network] and I believe we could complement each other on [rotta]..."
• "Our shared [network] membership made me look into your company..."

Questo è l'hook più forte quando si condivide un network. Usalo SEMPRE come priorità.`,
      ["hook", "apertura", "network"], 7, 14),

    e(userId, "hook", "Tecniche di Apertura", "Hook per geografia e complimento",
`GEOGRAFIA:
• "We're expanding our coverage in [country] and your company stood out..."
• "Looking at the growing trade lane between [A] and [B], I see a natural fit..."

COMPLIMENTO SPECIFICO:
• "I was impressed by your [certificazione/servizio/presenza]..."
• "Your expertise in [dangerous goods/project cargo] caught my attention..."`,
      ["hook", "apertura", "geografia", "complimento"], 7, 15),

    e(userId, "hook", "Tecniche di Apertura", "Hook per dato di mercato",
`• "With [trade lane] volumes up X% this year, having a reliable partner in [country] is critical..."
• "The [e-commerce/pharma/automotive] sector in [region] is growing fast..."

Usa dati reali e verificabili. Mai inventare percentuali.
Collega il dato alla rilevanza per il destinatario.`,
      ["hook", "apertura", "dato_mercato", "settore"], 7, 16),

    e(userId, "hook", "Tecniche di Apertura", "Hook stile TMWE (selezione mirata)",
`• "Mi permetto di contattarla perché abbiamo selezionato la vostra azienda tra quelle che rappresentano il profilo ideale..."
• "Ho notato che [riferimento specifico] e mi sono chiesto se..."
• "Non le scrivo per proporle un servizio generico. Le scrivo perché..."

REGOLA: Mai iniziare con "I am writing to..." o "Let me introduce myself".
Inizia SEMPRE dal destinatario o dal contesto condiviso.`,
      ["hook", "apertura", "tmwe", "selezione"], 8, 17),

    // ═══════════════════════════════════════════════════
    // SEZ. 7 — DATI PARTNER
    // ═══════════════════════════════════════════════════
    e(userId, "dati_partner", "Uso Dati Partner", "Campi disponibili e come usarli",
`| Campo | Come usarlo |
|-------|-------------|
| company_name | Sempre nel saluto e nel corpo |
| contact name | Nel "Dear [Nome]" |
| contact title/role | Adatta tono (CEO→strategico, Ops→pratico) |
| country/city | Riferimento geografico nell'hook |
| network_name | Hook primario |
| services | Collega i tuoi servizi ai loro |
| rating | Se alto, menziona la reputazione |
| enrichment_data | Dimostra che hai studiato l'azienda |`,
      ["personalizzazione", "dati", "partner", "campi"], 8, 18),

    e(userId, "dati_partner", "Uso Dati Partner", "Regole di personalizzazione",
`1. Usa ALMENO 3 CAMPI in ogni email per renderla unica.
2. Mai inventare dati — se un campo è vuoto, omettilo.
3. Collega i dati alla tua proposta — non elencarli, integrali nel discorso.
4. Priorità: network condiviso > paese/città > servizi > rating > profilo.

Esempio: company="Global Express", country="Germany", network="WCA", services=["air","ocean"]
→ "As fellow WCA members, I was pleased to see Global Express's reputation in Germany. With your air and ocean expertise, I see a natural synergy on the Italy–Germany corridor."`,
      ["personalizzazione", "regole", "esempio", "integrazione"], 8, 19),

    // ═══════════════════════════════════════════════════
    // SEZ. 8 — COLD OUTREACH
    // ═══════════════════════════════════════════════════
    e(userId, "cold_outreach", "Cold Outreach", "Principi cold email",
`• Non è spam: è una selezione. Hai scelto questa azienda con cura. Dimostralo.
• Personalizzazione obbligatoria: almeno 1 elemento specifico dell'azienda.
• Brevità: max 150 parole. Il prospect non ti conosce.
• Una sola CTA a basso impegno.
• Approccio anti-ansia: comunica valore, non urgenza.`,
      ["cold", "outreach", "principi", "regole"], 8, 20),

    e(userId, "cold_outreach", "Cold Outreach", "Struttura Cold Email in 4 righe",
`1. MOTIVO DEL CONTATTO: Perché ho scelto la vostra azienda (personalizzazione)
2. PROBLEMA/OPPORTUNITÀ: Un punto debole del settore che conosci (valore)
3. SOLUZIONE SINTETICA: Come lo risolvi concretamente (beneficio)
4. CTA ORIENTATA AL NO: Domanda che invita al "no" (azione)

Questa è la struttura più efficace per il primo contatto freddo.`,
      ["cold", "outreach", "struttura", "4_righe"], 8, 21),

    // ═══════════════════════════════════════════════════
    // SEZ. 9 — ARSENALE STRATEGICO
    // ═══════════════════════════════════════════════════
    e(userId, "arsenale", "Arsenale Strategico", "I costi occulti dei competitor",
`SUPPLEMENTI NASCOSTI: fatture diverse dal listino, coefficienti volumetrici peggiorativi.
COSTO TEMPO: ore perse in verifiche fatture, ricalcolo riaddebiti.
COSTO CAOS: più corrieri = magazzino confuso, comunicazione frammentata.
ASSISTENZA INEFFICACE: i grandi operatori non offrono supporto reale.

Come usarli in email (DOMANDE, non accuse):
"Molti clienti, analizzando i costi complessivi, hanno scoperto che il costo reale era molto diverso dal listino..."`,
      ["arsenale", "competitor", "costi_occulti", "differenziazione"], 7, 22),

    // ═══════════════════════════════════════════════════
    // SEZ. 10 — OBIEZIONI
    // ═══════════════════════════════════════════════════
    e(userId, "obiezioni", "Gestione Obiezioni", "Obiezione: Costa troppo",
`Riformula sui costi totali, non sul prezzo unitario.

Risposta: "Capisco l'attenzione al costo. Molti clienti scoprono che i costi totali — supplementi, tempo, errori — si riducono significativamente con il nostro sistema. Le propongo un confronto concreto: analizziamo insieme i costi attuali?"

Regola: MAI fare sconti. Sposta la conversazione sul valore totale.`,
      ["obiezioni", "prezzo", "costo", "riformulazione"], 9, 23),

    e(userId, "obiezioni", "Gestione Obiezioni", "Obiezione: Abbiamo già un fornitore",
`Non attaccare il fornitore attuale. Valorizza la scelta passata.

Risposta: "Ottimo, vuol dire che la logistica è un tema importante per voi. Ci hanno scelto non per sostituire fornitori, ma per aggiungere un livello di controllo e risparmio. Ha qualcosa in contrario a valutare un confronto?"

Regola: posizionati come complemento, non sostituto.`,
      ["obiezioni", "fornitore", "competitor"], 9, 24),

    e(userId, "obiezioni", "Gestione Obiezioni", "Obiezione: Non è il momento / Mi mandi una mail",
`"NON È IL MOMENTO":
→ "Capisco. Le invio un breve riepilogo di 2 minuti. Quando sarà il momento, avrà già tutto. Le sembra ragionevole?"

"MI MANDI UNA MAIL":
→ "Con piacere. Potrebbe indicarmi il nome del responsabile? Preferisco qualcosa di mirato piuttosto che generico."

Regola: trasforma il rinvio in un'azione concreta.`,
      ["obiezioni", "tempo", "rinvio", "mail"], 8, 25),

    // ═══════════════════════════════════════════════════
    // SEZ. 11 — CHIUSURA
    // ═══════════════════════════════════════════════════
    e(userId, "chiusura", "Tecniche di Chiusura", "5 modelli di chiusura",
`MORBIDA: "Ha qualcosa in contrario nel programmare il primo test?"
URGENZA ELEGANTE: "Il numero di nuovi account che possiamo acquisire è limitato."
RESPONSABILIZZA: "Di norma è il cliente a inseguire questo tipo di opportunità."
EMOTIVA: "Dal momento in cui diventasse nostro cliente, le sue spedizioni sarebbero promesse da mantenere."
RIFORMULAZIONE: "Abbiamo parlato di riduzione costi, produttività e controllo. Direi che valga la pena iniziare."`,
      ["chiusura", "closing", "5_modelli"], 8, 26),

    // ═══════════════════════════════════════════════════
    // SEZ. 12 — PROTOCOLLO VENDITA 5 FASI
    // ═══════════════════════════════════════════════════
    e(userId, "followup", "Protocollo Vendita 5 Fasi", "Fase 1-2: Connessione e Scoperta",
`FASE 1 — CONNESSIONE (Email 1):
• Obiettivo: aprire il dialogo
• Tono: cordiale, curioso, non invasivo
• Contenuto: hook + breve presentazione + CTA leggera
• NON includere: tariffe, listini, proposte dettagliate

FASE 2 — SCOPERTA (Email 2):
• Obiettivo: capire i bisogni del partner
• Tono: consulenziale, interessato
• Contenuto: domande mirate su rotte, volumi, problemi
• Riferimento alla prima email + dato personalizzato in più`,
      ["followup", "fase_1", "fase_2", "connessione", "scoperta"], 8, 27),

    e(userId, "followup", "Protocollo Vendita 5 Fasi", "Fase 3-5: Proposta, Obiezioni, Chiusura",
`FASE 3 — PROPOSTA (Email 3):
• Proposta su misura con bullet points, metrica, differenziatore
• Tono professionale, concreto

FASE 4 — GESTIONE OBIEZIONI (Email 4):
• Risposta all'obiezione specifica + social proof
• Tono empatico, rassicurante

FASE 5 — CHIUSURA (Email 5):
• Riepilogo valore + CTA concreta
• Tono diretto, propositivo`,
      ["followup", "fase_3", "fase_4", "fase_5", "proposta", "chiusura"], 8, 28),

    e(userId, "followup", "Protocollo Vendita 5 Fasi", "Sequenza email e tempistiche",
`TEMPISTICA:
• Giorno 0: Presentazione + hook + CTA leggera
• Giorno 3-5: Contenuto di valore aggiunto (dato mercato, caso studio)
• Giorno 10-14: CTA diretta con proposta concreta
• Giorno 21+ (solo se ghost): Riattivazione con tecnica Voss

REGOLE:
1. MAI ripetere la stessa email
2. Cambia angolo ad ogni tentativo
3. Mantieni brevità (50-80 parole)
4. Tono consultivo, mai accusatorio
5. Ogni email aggiunge qualcosa di nuovo`,
      ["followup", "sequenza", "tempistica", "regole"], 8, 29),

    // ═══════════════════════════════════════════════════
    // SEZ. 13 — TONO E PERSUASIONE
    // ═══════════════════════════════════════════════════
    e(userId, "tono", "Adattamento Tono", "Adattamento per ruolo destinatario",
`CEO / OWNER:
• Tono formale ma non rigido. Focus: partnership strategica, crescita.
• CTA: "Exploring a strategic partnership"

OPERATIONS MANAGER:
• Tono pratico, diretto. Focus: efficienza, affidabilità, problem solving.
• CTA: "Discussing specific routes"

SALES / BUSINESS DEVELOPMENT:
• Tono dinamico, reciproco. Focus: vantaggi reciproci, volumi.
• CTA: "Exchange of rate cards"`,
      ["tono", "adattamento", "ruolo", "destinatario"], 7, 30),

    e(userId, "tono", "Adattamento Tono", "Adattamento per area geografica",
`FAR EAST: formale, rispetto gerarchia, menziona longevità e stabilità.
MIDDLE EAST & INDIA: relazione personale, referenze nella regione.
EUROPA: diretto, professionale, focus efficienza e qualità.
AMERICAS — USA: diretto, orientato risultati. LATAM: più caloroso, importanza relazione.
AFRICA: rispettoso, professionale, sensibilità sfide logistiche locali.

Regola: adatta SEMPRE il tono alla cultura del destinatario.`,
      ["tono", "adattamento", "geografia", "cultura"], 7, 31),

    e(userId, "persuasione", "Persuasione B2B", "Social Proof, Reciprocità, Urgenza",
`SOCIAL PROOF:
• "We handle over [X] shipments monthly from/to [paese]"
• "We've been [network] members since [anno], with a [X]/5 rating"

RECIPROCITÀ:
• "Happy to share our route analysis with no obligation"

URGENZA APPROPRIATA (mai artificiale):
• "With the peak season approaching, now is the ideal time to align"
• "New regulations effective [date] make it important to have a prepared partner"`,
      ["persuasione", "social_proof", "reciprocità", "urgenza"], 7, 32),

    // ═══════════════════════════════════════════════════
    // SEZ. 14 — LIBRERIA FRASI MODELLO
    // ═══════════════════════════════════════════════════
    e(userId, "frasi_modello", "Libreria Frasi", "Frasi di apertura e valore",
`APERTURA:
• "Mi permetto di contattarla perché abbiamo selezionato la vostra azienda..."
• "Le scrivo brevemente perché credo che possiate trarre un vantaggio concreto..."
• "Non le scrivo per proporle un servizio generico. Le scrivo perché..."

COMUNICARE VALORE:
• "Molti clienti con esigenze simili preferiscono la nostra soluzione perché..."
• "Il nostro sistema permette di prenotare in pochi secondi, senza email."
• "Controlliamo ogni spedizione proattivamente, con aggiornamenti prima che ce li chiedano."`,
      ["frasi", "apertura", "valore", "modello"], 7, 33),

    e(userId, "frasi_modello", "Libreria Frasi", "Frasi di empatia e fiducia",
`• "Capisco perfettamente la sua preoccupazione."
• "Molti clienti avevano il suo stesso dubbio prima di iniziare con noi."
• "Mi occupo personalmente di questa richiesta."
• "We treat every shipment as if it were our own."
• "Our approach is simple: communicate before you need to ask."

Regola: l'empatia non è debolezza, è intelligenza strategica.`,
      ["frasi", "empatia", "fiducia", "modello"], 7, 34),

    e(userId, "frasi_modello", "Libreria Frasi", "CTA e chiusure email",
`CTA (NO-oriented):
• "Ha qualcosa in contrario a ricevere una breve panoramica?"
• "Le sembrerebbe fuori luogo dedicarmi 5 minuti?"
• "Would you be open to a 15-minute call next week?"

CHIUSURE:
• "Resto a disposizione. Il nostro obiettivo è la sua tranquillità operativa."
• "I look forward to exploring how we can support each other."

OGGETTO EMAIL (max 6-8 parole, mai MAIUSCOLO):
• "[Network] member — [servizio] in [paese]"
• "[Nome Azienda] – una domanda sulla vostra logistica"`,
      ["frasi", "cta", "chiusura", "oggetto"], 7, 35),

    e(userId, "errori", "Errori da Evitare", "8 errori fatali nelle email",
`1. GENERICITÀ: "We are a leading company" → Tutti lo dicono. Sii specifico.
2. EMAIL TROPPO LUNGHE: Max 150 parole al primo contatto.
3. PROMESSE VAGHE: "Best service" / "Competitive rates" → Dati concreti.
4. FOCUS SU DI TE: il 70% dell'email deve parlare del destinatario.
5. TONO SUPPLICANTE: "I would really appreciate..." → Sii propositivo.
6. MULTIPLE CTA: Una sola azione per email.
7. NESSUNA PERSONALIZZAZIONE: Se l'email va bene per chiunque, è sbagliata.
8. ALLEGATI AL PRIMO CONTATTO: mai. Red flag per filtri spam.`,
      ["errori", "regole", "evitare", "spam"], 8, 36),

    // ═══════════════════════════════════════════════════
    // SEZ. 14b — EMAIL MODELLO
    // ═══════════════════════════════════════════════════
    e(userId, "frasi_modello", "Email Modello", "Modello 1: Primo contatto (EN, ~100 parole)",
`Subject: WCA member — ocean freight partnership, Italy–[Country]

Dear [Contact Name],

As fellow WCA members, I came across [Company Name] and was impressed by your [services/reputation].

We are [Your Company], based in [City], Italy, specializing in [services] with strong coverage across the Mediterranean and Europe. I believe there's a natural synergy, particularly on the [Country]–Italy trade lane.

We currently handle [X] shipments monthly on this corridor with [differentiator].

Would you be open to a brief call next week to explore how we could support each other?`,
      ["email_modello", "primo_contatto", "inglese", "template"], 7, 37),

    e(userId, "frasi_modello", "Email Modello", "Modello 2-3: Follow-up e Proposta (EN)",
`FOLLOW-UP (~70 parole):
Subject: Re: WCA member — a quick update on [trade lane]
"Following up — we've recently expanded our [service] capacity on the [A]–[B] route. This could be relevant for [Company]'s operations. Happy to share details."

PROPOSTA OPERATIVA (~150 parole):
Subject: [Company] + [Your Company] — service overview
Include bullet points con:
• Ocean FCL, Air freight, Customs, Warehousing
• Differenziatori: tracking proattivo, punto di contatto dedicato
• CTA: "Shall I prepare a spot rate for a specific route?"`,
      ["email_modello", "followup", "proposta", "template"], 7, 38),

    e(userId, "frasi_modello", "Email Modello", "Modello 4-5: Riattivazione e Sconto (IT)",
`RIATTIVAZIONE GHOSTING:
Oggetto: Ha rinunciato a ottimizzare le spedizioni?
"Mi rendo conto che i tempi stretti possono aver reso difficile approfondire. Ha rinunciato all'idea di ottimizzare la gestione, oppure è una questione di tempistica?"

RISPOSTA A RICHIESTA SCONTO:
Oggetto: Re: Richiesta condizioni
"Comprendo l'attenzione al budget. Molti clienti, analizzando i costi complessivi, hanno scoperto che lavorare con noi ha rappresentato un risparmio netto. Le propongo un'analisi comparativa gratuita."`,
      ["email_modello", "riattivazione", "sconto", "italiano"], 7, 39),
  ];
}
