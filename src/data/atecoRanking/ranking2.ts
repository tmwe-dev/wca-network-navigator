import type { AtecoRank } from "./types";

export const ATECO_RANKING_2: Record<string, AtecoRank> = {
  "28.1": { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari agricoltura — export forte" },
  "28.2": { volume: 4, valore: 2, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari costruzioni — pesanti ma export" },
  "28.3": { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari alimentare — fortissimo export" },
  "28.4": { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari tessile — distretto export" },
  "28.5": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari carta/stampa — export" },
  "28.6": { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari metallo — export forte" },
  "28.7": { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari industrie specifiche — export" },
  "28.9": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Altri macchinari — export" },

  // 29 - Autoveicoli (DIFFERENZIATO)
  "29":   { volume: 4, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Autoveicoli — componentistica export" },
  "29.1": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Fabbricazione auto — OEM, logistica propria" },
  "29.2": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Parti accessori — componentistica express, PAGANO" },
  "29.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Riparazione auto — locale, non esporta" },

  // 30 - Altri mezzi trasporto
  "30":   { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Mezzi trasporto — nautica, aerospaziale" },
  "30.1": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Navi — componentistica, non la nave intera" },
  "30.2": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Locomotive — raro in Italia" },
  "30.3": { volume: 3, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Aeromobili — altissimo valore, ricambi express" },
  "30.4": { volume: 2, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Militare — regolamentato" },
  "30.9": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Bici, moto — export design" },

  // 31 - Mobili
  "31":   { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Mobili — design italiano, export forte" },
  "31.1": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Mobili ufficio — contract export" },
  "31.2": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Arredamento — design italiano" },
  "31.3": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Materassi — qualche export" },

  // 32 - Altre manifatturiere (DIFFERENZIATO per sotto-categoria)
  "32":   { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Gioielleria, occhiali, medicali — altissimo valore" },
  "32.1": { volume: 4, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Gioielleria — altissimo valore/kg, corriere express" },
  "32.2": { volume: 2, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Strumenti musicali — nicchia, alto valore unitario" },
  "32.3": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Articoli sportivi — export, medio valore" },
  "32.4": { volume: 3, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Giocattoli — qualche export, basso valore/kg" },
  "32.5": { volume: 4, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Articoli medici — altissimo valore, express" },
  "32.9": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Occhiali, varie — export italiano" },

  // 33 - Riparazione/Installazione
  "33":   { volume: 3, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Riparazione/installazione — ricambi express" },
  "33.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Riparazione metallo — locale" },
  "33.2": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Installazione macchine — trasfertisti con ricambi" },
  "33.3": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Riparazione macchine — locale" },

  // ═══════════════════════════════════════
  // D - ENERGIA
  // ═══════════════════════════════════════
  "35":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Energia — non spedisce merci" },
  "35.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Elettricità — non corriere" },
  "35.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gas — non corriere" },
  "35.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Distribuzione gas — condotte" },
  "35.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Vapore aria condizionata — servizio" },

  // ═══════════════════════════════════════
  // E - ACQUA/RIFIUTI
  // ═══════════════════════════════════════
  "36":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Acqua — servizio" },
  "36.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Raccolta rifiuti — locale" },
  "36.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Smaltimento — locale" },
  "36.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Riciclaggio — locale" },
  "37":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Risanamento" },
  "37.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Risanamento — locale" },
  "38":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Acque reflue" },
  "38.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Trattamento acque — locale" },
  "38.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Smaltimento rifiuti — locale" },
  "39":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Bonifica — locale" },
  "39.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Bonifica ambientale — locale" },

  // ═══════════════════════════════════════
  // F - COSTRUZIONI
  // ═══════════════════════════════════════
  "41":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Costruzione edifici — locale" },
  "41.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Sviluppo immobiliare — locale" },
  "41.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Costruzione — locale" },
  "42":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Strade/ferrovie — locale" },
  "42.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Strade — locale" },
  "42.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ferrovie — locale" },
  "42.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Condotte — locale" },
  "43":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Lavori specializzati — locale" },
  "43.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Demolizione — locale" },
  "43.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Lavori profondità — locale" },
  "43.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Opere civili — locale" },
  "43.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre costruzioni — locale" },

  // ═══════════════════════════════════════
  // G - COMMERCIO (DIFFERENZIATO)
  // ═══════════════════════════════════════

  // 45 - Auto/Moto
  "45":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Auto/moto — ricambi export" },
  "45.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Commercio auto — locale" },
  "45.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Riparazione auto — locale" },
  "45.3": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Ricambi auto — export significativo" },
  "45.4": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Moto — ricambi" },

  // 46 - Ingrosso (CORRETTO: differenziato, non tutto 5/5)
  "46":   { volume: 3, valore: 2, intl: "ALTO",         paga: "POSSIBILE",              note: "Grossisti — intermediari, NON tutti pagano spedizioni" },
  "46.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Intermediari — agenti, poco volume diretto" },
  "46.2": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Materie prime agricole — bulk, grossisti non pagano" },
  "46.3": { volume: 3, valore: 2, intl: "ALTO",         paga: "POSSIBILE",              note: "Alimentari ingrosso — export food, ma spesso FOB" },
  "46.4": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - MEDIA PROBABILITÀ", note: "Beni consumo — moda, cosmetica, MIGLIORE del 46" },
  "46.5": { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "IT/telecom ingrosso — alto valore, express" },
  "46.6": { volume: 3, valore: 2, intl: "ALTO",         paga: "POSSIBILE",              note: "Macchine ingrosso — ricambi, medio" },
  "46.7": { volume: 3, valore: 2, intl: "ALTO",         paga: "POSSIBILE",              note: "Altri beni ingrosso — misto" },
  "46.9": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Non specializzato — troppo generico" },

  // 47 - Dettaglio (CORRETTO: molto basso)
  "47":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Dettaglio — locale, non export" },
  "47.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Non specializzato — supermercati" },
  "47.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Alimentari dettaglio — locale" },
  "47.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Carburante — stazioni servizio" },
  "47.4": { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "IT dettaglio — locale" },
  "47.5": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Negozi — locale" },
  "47.6": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Usato — locale" },
  "47.7": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Negozi vari — locale" },
  "47.8": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Bancarelle — locale" },
  "47.9": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "E-commerce — unica nicchia cross-border" },

  // ═══════════════════════════════════════
  // H - TRASPORTO (concorrenti)
  // ═══════════════════════════════════════
  "49":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Concorrente — trasporto terrestre" },
  "49.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ferroviario passeggeri" },
  "49.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ferroviario merci — concorrente" },
  "49.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Trasporto passeggeri" },
  "49.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Stradale merci — concorrente diretto" },
  "49.5": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Condotte — non corriere" },
  "50":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Concorrente — trasporto acqua" },
  "50.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Marittimo passeggeri" },
  "50.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Marittimo merci — concorrente" },
  "50.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Acque interne" },
  "50.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Lacustre" },
  "51":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Concorrente — trasporto aereo" },
  "51.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Aereo passeggeri" },
  "51.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Aereo merci — concorrente" },
  "52":   { volume: 2, valore: 1, intl: "BASSO",        paga: "POSSIBILE",              note: "Magazzinaggio — potenziale partner, non concorrente puro" },
  "52.1": { volume: 2, valore: 1, intl: "BASSO",        paga: "POSSIBILE",              note: "Depositi — potenziale partner 3PL" },
  "52.2": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Supporto trasporti — spedizionieri, agenti" },
  "53":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Concorrente diretto — corrieri e poste" },
  "53.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Poste e corrieri — concorrente" }
};
