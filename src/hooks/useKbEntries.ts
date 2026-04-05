import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
        const { error } = await supabase.from("kb_entries").insert(payload as any);
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

      // Check if already seeded
      const { count } = await supabase
        .from("kb_entries")
        .select("id", { count: "exact", head: true });
      if ((count || 0) > 0) throw new Error("KB già popolata. Elimina le schede esistenti prima di re-importare.");

      const entries = getDefaultKbEntries(user.id);
      const { error } = await supabase.from("kb_entries").insert(entries as any);
      if (error) throw error;
      return entries.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["kb_entries"] });
      toast.success(`${count} schede KB importate con successo`);
    },
    onError: (e: any) => toast.error(e.message || "Errore importazione"),
  });
}

function getDefaultKbEntries(userId: string) {
  const entries: Array<Omit<KbEntry, "id" | "created_at" | "updated_at">> = [
    {
      user_id: userId, category: "regole_sistema", chapter: "Regole AI", title: "Regole generali per generazione email",
      content: `1. Mai menzionare il prezzo per primo: il valore si comunica sempre prima del costo.\n2. Mai criticare i competitor direttamente: usa domande che fanno emergere i limiti.\n3. Mai forzare la vendita: la pressione è sempre sostituita da logica e valore.\n4. Mai usare un tono generico: ogni email deve sembrare scritta per quel destinatario.\n5. Sempre chiudere con un'azione: ogni email contiene UNA SOLA CTA chiara.\n6. Brevità con sostanza: email concise ma dense di valore.\n7. Personalizza con almeno 3 campi del partner.`,
      tags: ["regole", "email", "sistema", "base"], priority: 10, sort_order: 0, is_active: true,
    },
    {
      user_id: userId, category: "filosofia", chapter: "Filosofia Venditore", title: "Identità e personalità del venditore",
      content: `Il venditore non è un semplice commerciale. È un consulente d'elite che combina competenza logistica, intelligenza emotiva e determinazione.\n\nNon vende servizi: costruisce partnership.\nNon insegue clienti: li seleziona.\nNon parla di prezzo: parla di valore.\n\nPersonalità: calmo, riflessivo, analitico. Fiducia radicata in preparazione maniacale. Ogni parola pesa, ogni frase costruisce fiducia.`,
      tags: ["filosofia", "identità", "vendita", "tono"], priority: 8, sort_order: 1, is_active: true,
    },
    {
      user_id: userId, category: "filosofia", chapter: "Filosofia Venditore", title: "Le 5 missioni fondamentali",
      content: `1. Guida strategica: ogni interazione parte dalla realtà del cliente e arriva alla soluzione.\n2. Ascolto profondo: ogni frase del cliente è un indizio.\n3. Focus assoluto: non cambiare argomento, salvo per smascherare un problema nascosto.\n4. Valore prima del prezzo: il prezzo si discute solo dopo che il valore è stato dimostrato.\n5. Creare il bisogno: il cliente deve sentire il BISOGNO di lavorare con te.`,
      tags: ["filosofia", "missioni", "vendita"], priority: 8, sort_order: 2, is_active: true,
    },
    {
      user_id: userId, category: "negoziazione", chapter: "10 Comandamenti", title: "I 10 comandamenti della negoziazione",
      content: `1. Porta al NO consapevole: "È contrario a...?" — il "no" fa sentire il cliente al sicuro.\n2. Smaschera la decision fatigue: offri max 2 opzioni, mai elenchi infiniti.\n3. Controllo emotivo: mai rispondere d'impulso.\n4. Controllo negoziale: porta con logica il cliente a comprendere il valore.\n5. Ascolta prima, guida dopo.\n6. Non vendere, orienta: proponi soluzioni, non prodotti.\n7. Concretezza: dati reali, tempistiche precise.\n8. Anticipa le obiezioni proattivamente.\n9. Crea coinvolgimento: poni domande, invita a rispondere.\n10. Valore prima del prezzo — sempre.`,
      tags: ["negoziazione", "comandamenti", "regole"], priority: 9, sort_order: 3, is_active: true,
    },
    {
      user_id: userId, category: "chris_voss", chapter: "Chris Voss — Black Swan", title: "VOSS-01: Domande orientate al NO",
      content: `Le persone possono dire "no" anche con decision fatigue. Il "no" richiede meno energia del "sì" e fa sentire il cliente in controllo.\n\nSostituisci "Le farebbe piacere...?" con:\n- "È contrario a...?"\n- "La metto in difficoltà se...?"\n- "Sarebbe un problema se...?"\n\nEsempio: "Ha qualcosa in contrario a ricevere una breve panoramica delle soluzioni che stiamo offrendo ad aziende del vostro settore?"`,
      tags: ["chris_voss", "no", "domande", "tecnica"], priority: 9, sort_order: 4, is_active: true,
    },
    {
      user_id: userId, category: "chris_voss", chapter: "Chris Voss — Black Swan", title: "VOSS-02: Riattivazione post-ghosting",
      content: `Quando il cliente sparisce, la domanda "Ha rinunciato a X?" riattiva la conversazione il 99% delle volte. Il cliente non vuole ammettere di aver rinunciato.\n\nEsempio email: "Ha rinunciato all'idea di ottimizzare la gestione delle spedizioni, oppure è semplicemente una questione di tempistica?"`,
      tags: ["chris_voss", "ghosting", "riattivazione", "tecnica"], priority: 9, sort_order: 5, is_active: true,
    },
    {
      user_id: userId, category: "chris_voss", chapter: "Chris Voss — Black Swan", title: "VOSS-03: Gestione prezzo",
      content: `Se il cliente tratta sul prezzo, il problema non è il prezzo ma il valore percepito. Non tagliare mai il prezzo. Concentrati sul valore.\n\nRegola: "Se stai negoziando sul prezzo, stai parlando della cosa sbagliata."\n\nIn email: proponi un'analisi comparativa dei costi totali (supplementi, tempo, errori) anziché fare sconti.`,
      tags: ["chris_voss", "prezzo", "valore", "tecnica"], priority: 9, sort_order: 6, is_active: true,
    },
    {
      user_id: userId, category: "chris_voss", chapter: "Chris Voss — Black Swan", title: "VOSS-04: Labeling e Mirroring",
      content: `Labeling: Dai un nome all'emozione dell'altro → "Sembra che la sua preoccupazione principale sia..."\n\nMirroring: Riprendi le esatte parole che il cliente ha usato nella sua risposta.\n\nEsempio: "Dalla sua risposta sembra che il tema principale sia la continuità del servizio e l'affidabilità nei momenti critici."`,
      tags: ["chris_voss", "labeling", "mirroring", "tecnica"], priority: 8, sort_order: 7, is_active: true,
    },
    {
      user_id: userId, category: "chris_voss", chapter: "Chris Voss — Black Swan", title: "VOSS-05: Forced Empathy",
      content: `Quando il cliente chiede qualcosa di irragionevole, in email si traduce in:\n\n"Mi aiuti a capire come potremmo rendere possibile ciò mantenendo la qualità che meritate."`,
      tags: ["chris_voss", "empatia", "tecnica"], priority: 7, sort_order: 8, is_active: true,
    },
    {
      user_id: userId, category: "struttura_email", chapter: "Struttura Email", title: "La regola delle 5 righe (primo contatto)",
      content: `Un'email di primo contatto deve essere leggibile in 30 secondi:\n\n- Riga 1: Hook — perché gli stai scrivendo\n- Riga 2-3: Value proposition — cosa fai e perché è rilevante per LUI\n- Riga 4: Social proof — metrica, cliente, certificazione\n- Riga 5: CTA — un'azione sola, semplice, a basso impegno\n\nLunghezze:\n- Primo contatto: 80-120 parole (mai oltre 150)\n- Follow-up: 50-80 parole\n- Proposta dettagliata: max 200 parole con bullet points`,
      tags: ["struttura", "email", "primo_contatto", "lunghezza"], priority: 9, sort_order: 9, is_active: true,
    },
    {
      user_id: userId, category: "struttura_email", chapter: "Struttura Email", title: "Struttura dettagliata email",
      content: `1. Saluto: breve, personale. "Dear [Nome]," — mai "Dear Sir/Madam"\n2. Hook di apertura (1 frase): collega te al destinatario\n3. Contesto (1-2 frasi): chi sei, cosa fai, perché è rilevante\n4. Valore specifico (2-3 frasi): cosa puoi fare per lui concretamente\n5. Prova (1 frase): dato, certificazione, volume, referenza\n6. CTA (1 frase): proposta chiara e a basso impegno\n7. Chiusura: cordiale, professionale`,
      tags: ["struttura", "email", "template"], priority: 8, sort_order: 10, is_active: true,
    },
    {
      user_id: userId, category: "hook", chapter: "Tecniche di Apertura", title: "Hook per network condiviso",
      content: `- "As fellow [WCA/FIATA] members, I wanted to reach out..."\n- "I noticed we're both part of [network] and I believe we could complement each other on [rotta/servizio]..."\n- "Our shared [network] membership made me look into your company..."`,
      tags: ["hook", "apertura", "network", "email"], priority: 7, sort_order: 11, is_active: true,
    },
    {
      user_id: userId, category: "hook", chapter: "Tecniche di Apertura", title: "Hook per geografia e complimento",
      content: `Per riferimento geografico:\n- "We're expanding our coverage in [country/region] and your company stood out..."\n- "Looking at the growing trade lane between [A] and [B], I see a natural fit..."\n\nPer complimento specifico:\n- "I was impressed by your [certificazione/servizio/presenza]..."\n- "Your expertise in [dangerous goods/project cargo] caught my attention..."`,
      tags: ["hook", "apertura", "geografia", "complimento"], priority: 7, sort_order: 12, is_active: true,
    },
    {
      user_id: userId, category: "hook", chapter: "Tecniche di Apertura", title: "Hook stile TMWE (selezione mirata)",
      content: `- "Mi permetto di contattarla perché abbiamo selezionato la vostra azienda tra quelle che, per tipologia e reputazione, rappresentano il profilo ideale..."\n- "Ho notato che [riferimento specifico] e mi sono chiesto se..."\n- "Non le scrivo per proporle un servizio generico. Le scrivo perché..."\n\nREGOLA: Mai iniziare con "I am writing to..." o "Let me introduce myself". Inizia dal destinatario o dal contesto condiviso.`,
      tags: ["hook", "apertura", "tmwe", "selezione"], priority: 8, sort_order: 13, is_active: true,
    },
    {
      user_id: userId, category: "dati_partner", chapter: "Uso Dati Partner", title: "Come personalizzare con i dati del partner",
      content: `| Campo | Come usarlo |\n|-------|-------------|\n| company_name | Sempre nel saluto e nel corpo |\n| contact name | Nel "Dear [Nome]" |\n| contact title/role | Adatta il tono (CEO → strategico, Ops → pratico) |\n| country/city | Riferimento geografico nell'hook |\n| network_name | Hook primario |\n| services | Collega i tuoi servizi ai loro |\n| rating | Se alto, menziona la reputazione |\n| enrichment_data | Dimostra che hai studiato l'azienda |\n\nRegole: usa almeno 3 campi, mai inventare dati, priorità: network > paese > servizi > rating.`,
      tags: ["personalizzazione", "dati", "partner", "email"], priority: 8, sort_order: 14, is_active: true,
    },
    {
      user_id: userId, category: "cold_outreach", chapter: "Cold Outreach", title: "Principi cold email",
      content: `- Non è spam: è una selezione. Hai scelto questa azienda con cura. Dimostralo.\n- Personalizzazione obbligatoria: almeno 1 elemento specifico.\n- Brevità: max 150 parole.\n- Una sola CTA a basso impegno.\n- Approccio anti-ansia: comunica valore, non urgenza.\n\nStruttura:\n1. Motivo del contatto (personalizzazione)\n2. Problema/Opportunità (valore)\n3. Soluzione sintetica (beneficio)\n4. CTA orientata al NO (azione)`,
      tags: ["cold", "outreach", "primo_contatto", "struttura"], priority: 8, sort_order: 15, is_active: true,
    },
    {
      user_id: userId, category: "arsenale", chapter: "Arsenale Strategico", title: "I costi occulti dei competitor",
      content: `Leve argomentative per differenziarsi:\n\n- Supplementi nascosti: fatture diverse dal listino, coefficienti volumetrici peggiorativi\n- Costo tempo: ore perse in verifiche fatture, ricalcolo riaddebiti\n- Costo caos: più corrieri = magazzino confuso, comunicazione frammentata\n- Assistenza inefficace: i grandi operatori non offrono supporto reale\n\nCome usarli in email (domande, non accuse):\n"Molti clienti, analizzando i costi complessivi, hanno scoperto che il costo reale era molto diverso dal listino..."`,
      tags: ["arsenale", "competitor", "costi", "differenziazione"], priority: 7, sort_order: 16, is_active: true,
    },
    {
      user_id: userId, category: "obiezioni", chapter: "Gestione Obiezioni", title: "Risposte alle obiezioni comuni",
      content: `"Costa troppo": Riformula sui costi totali. "Molti clienti scoprono che i costi totali si riducono significativamente. Le propongo un confronto concreto."\n\n"Abbiamo già un fornitore": "Ottimo. Ci hanno scelto non per sostituirli, ma per aggiungere un livello di controllo e risparmio."\n\n"Non è il momento": "Le invio un breve riepilogo di 2 minuti. Quando sarà il momento, avrà già tutto sotto mano."\n\n"Mi mandi una mail": "Con piacere. Potrebbe indicarmi il nome del responsabile? Preferisco qualcosa di mirato."`,
      tags: ["obiezioni", "prezzo", "fornitore", "tempo"], priority: 9, sort_order: 17, is_active: true,
    },
    {
      user_id: userId, category: "chiusura", chapter: "Tecniche di Chiusura", title: "5 modelli di chiusura",
      content: `Morbida: "Ha qualcosa in contrario nel programmare il primo test?"\n\nUrgenza Elegante: "Per mantenere alta la qualità, il numero di nuovi account che possiamo acquisire è limitato."\n\nResponsabilizza: "Di norma è il cliente a inseguire questo tipo di opportunità."\n\nEmotiva: "Dal momento in cui diventasse nostro cliente, le sue spedizioni sarebbero promesse da mantenere."\n\nRiformulazione: "Abbiamo parlato di riduzione costi, aumento produttività e maggior controllo. Direi che valga la pena iniziare."`,
      tags: ["chiusura", "closing", "tecniche"], priority: 8, sort_order: 18, is_active: true,
    },
    {
      user_id: userId, category: "followup", chapter: "Protocollo Follow-up", title: "Sequenza email e regole follow-up",
      content: `Tempistica:\n- Email riepilogativa lo stesso giorno\n- Secondo contatto 3-5 giorni\n- Terzo 10-14 giorni\n\nSequenza:\n- EMAIL 1 (Giorno 0): Presentazione + hook + CTA leggera\n- EMAIL 2 (Giorno 3-5): Contenuto di valore aggiunto\n- EMAIL 3 (Giorno 10-14): CTA diretta con proposta concreta\n- EMAIL 4 (Giorno 21+, solo se ghost): Riattivazione Voss\n\nRegole: mai ripetere la stessa email, cambia angolo, mantieni brevità (50-80 parole), tono consultivo.`,
      tags: ["followup", "sequenza", "tempistica"], priority: 8, sort_order: 19, is_active: true,
    },
    {
      user_id: userId, category: "tono", chapter: "Adattamento Tono", title: "Adattamento per ruolo e geografia",
      content: `Per ruolo:\n- CEO/Owner: formale, focus partnership strategica\n- Operations Manager: pratico, focus efficienza\n- Sales/BizDev: dinamico, focus vantaggi reciproci\n\nPer area geografica:\n- Far East: formale, rispetto gerarchia, longevità\n- Middle East/India: relazione personale, referenze locali\n- Europa: diretto, professionale, efficienza\n- Americas (USA): orientato risultati; LATAM: più caloroso\n- Africa: rispettoso, sensibile a sfide logistiche locali`,
      tags: ["tono", "adattamento", "ruolo", "geografia"], priority: 7, sort_order: 20, is_active: true,
    },
    {
      user_id: userId, category: "persuasione", chapter: "Adattamento Tono", title: "Tecniche di persuasione B2B",
      content: `Social Proof:\n- "We handle over [X] shipments monthly from/to [paese]"\n- "We've been [network] members since [anno], with a [X]/5 rating"\n\nReciprocità:\n- "Happy to share our route analysis with no obligation"\n\nUrgenza appropriata (mai artificiale):\n- "With the peak season approaching, now is the ideal time to align"\n- "New regulations effective [date] make it important to have a prepared partner"`,
      tags: ["persuasione", "social_proof", "reciprocità", "urgenza"], priority: 7, sort_order: 21, is_active: true,
    },
    {
      user_id: userId, category: "frasi_modello", chapter: "Libreria Frasi", title: "CTA e frasi di chiusura",
      content: `CTA (NO-oriented):\n- "Ha qualcosa in contrario a ricevere una breve panoramica?"\n- "Le sembrerebbe fuori luogo dedicarmi 5 minuti?"\n- "Would you be open to a 15-minute call next week?"\n\nChiusure:\n- "Resto a disposizione. Il nostro obiettivo è la sua tranquillità operativa."\n- "I look forward to exploring how we can support each other."\n\nOggetto Email (max 6-8 parole, mai tutto maiuscolo):\n- "[Network] member — [servizio] in [paese]"\n- "[Nome Azienda] – una domanda sulla vostra logistica"`,
      tags: ["cta", "chiusura", "frasi", "oggetto"], priority: 7, sort_order: 22, is_active: true,
    },
    {
      user_id: userId, category: "errori", chapter: "Libreria Frasi", title: "Errori da evitare nelle email",
      content: `1. Genericità: "We are a leading logistics company" — tutti lo dicono, sii specifico.\n2. Email troppo lunghe: max 150 parole al primo contatto.\n3. Promesse vaghe: "Best service" → dati concreti.\n4. Focus su di te: il 70% deve parlare del destinatario.\n5. Tono supplicante: "I would really appreciate..." → sii propositivo.\n6. Multiple CTA: una sola azione per email.\n7. Nessuna personalizzazione: se l'email potrebbe andare a chiunque, è sbagliata.\n8. Follow-up identici.\n9. Allegati al primo contatto: mai.`,
      tags: ["errori", "regole", "email"], priority: 8, sort_order: 23, is_active: true,
    },
  ];
  return entries;
}
