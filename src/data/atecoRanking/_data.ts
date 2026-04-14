/**
 * ATECO Ranking per Spedizioniere Internazionale / Corriere Espresso
 *
 * Ranking corretto e differenziato per sotto-categoria.
 * Ogni codice ATECO ha:
 *   - volume:  1-5  (volume spedizioni atteso)
 *   - valore:  1-5  (valore per kg della merce)
 *   - intl:    "MOLTO ALTO" | "ALTO" | "MEDIO" | "BASSO" | "MOLTO DIFFICILE"
 *   - paga:    "SI - ALTA PROBABILITÀ" | "SI - MEDIA PROBABILITÀ" | "POSSIBILE" | "IMPROBABILE"
 *   - note:    breve nota commerciale
 *
 * Lo score di priorità è calcolato: volume * valore * moltiplicatore_intl
 */

export interface AtecoRank {
  volume: number;       // 1-5
  valore: number;       // 1-5
  intl: string;
  paga: string;
  note: string;
}

const INTL_MULT: Record<string, number> = {
  "MOLTO ALTO": 1.0,
  "ALTO": 0.8,
  "MEDIO": 0.5,
  "BASSO": 0.3,
  "MOLTO DIFFICILE": 0.1,
};

export function calcScore(r: AtecoRank): number {
  const base = r.volume + r.valore;
  const mult = INTL_MULT[r.intl] ?? 0.5;
  return Math.round(base * 2 * mult * 10) / 10;
}

/**
 * Map: codice ATECO → ranking
 * Copre livello 2 e 3. Per i livelli 1 (sezioni) si calcola la media dei figli.
 * Se un codice livello 3 non è presente, eredita dal livello 2.
 */
export const ATECO_RANKING: Record<string, AtecoRank> = {
  // ═══════════════════════════════════════
  // A - AGRICOLTURA
  // ═══════════════════════════════════════
  "01":   { volume: 3, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Prodotti deperibili, spesso gestiti da grossisti" },
  "01.1": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Cereali e ortaggi — bulk, basso valore/kg" },
  "01.2": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Frutta, vino, olio — export italiano forte" },
  "01.3": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Piante e sementi — nicchia export" },
  "01.4": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Allevamento — catena freddo, export carni" },
  "01.5": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Misto — prevalentemente locale" },
  "02":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Legname — trasporto specializzato" },
  "02.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Gestione forestale — poco export" },
  "02.2": { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Prodotti forestali non legnosi — nicchia" },
  "03":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Pesce — catena freddo, export" },
  "03.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Pesca marittima — export prodotti ittici" },
  "03.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pesca dolce — locale" },
  "03.3": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Acquacoltura — export crescente" },

  // ═══════════════════════════════════════
  // B - ATTIVITA ESTRATTIVE
  // ═══════════════════════════════════════
  "05":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Carbone — bulk, poco export IT" },
  "05.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Carbone" },
  "05.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Lignite e torba" },
  "06":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Petrolio — pipeline, non corriere" },
  "06.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Petrolio greggio — pipeline" },
  "06.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gas naturale — condotte" },
  "07":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Minerali — bulk" },
  "07.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Minerali ferrosi" },
  "07.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Minerali non ferrosi" },
  "08":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Cave e miniere" },
  "08.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Pietre sabbia argille" },
  "08.9": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altri minerali" },
  "09":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi supporto — non spediscono merci" },
  "09.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi supporto estrattive" },

  // ═══════════════════════════════════════
  // C - ATTIVITA MANIFATTURIERE
  // ═══════════════════════════════════════

  // 10 - Alimentari (corretto: 4 non 5 volume)
  "10":   { volume: 4, valore: 2, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Food italiano = export mondiale, produttori DOP/IGP pagano spedizioni" },
  "10.1": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Carni — catena freddo, export salumi DOP" },
  "10.2": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Pesce — catena freddo, export" },
  "10.3": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Frutta ortaggi — conserve, export" },
  "10.4": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Olio d'oliva — export fortissimo, alto valore" },
  "10.5": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Formaggi DOP — export forte, alto valore" },
  "10.6": { volume: 3, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Farine amidi — prevalentemente domestico" },
  "10.7": { volume: 4, valore: 2, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Pasta e prodotti da forno — simbolo export" },
  "10.8": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Dolciumi, caffè, cioccolato — alto valore" },
  "10.9": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Mangimi — bulk, poco export" },

  // 11 - Bevande
  "11":   { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Vino, spirits — alto valore, export fortissimo" },
  "11.1": { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Spirits — altissimo valore, export" },
  "11.2": { volume: 3, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Bevande analcoliche — prevalentemente domestico" },

  // 12 - Tabacco
  "12":   { volume: 2, valore: 3, intl: "MEDIO",        paga: "POSSIBILE",              note: "Tabacco — regolamentato ma export esiste" },
  "12.0": { volume: 2, valore: 3, intl: "MEDIO",        paga: "POSSIBILE",              note: "Tabacco — regolamentato" },

  // 13 - Tessile
  "13":   { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Tessile italiano — export forte, alto valore" },
  "13.1": { volume: 3, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Filatura — materia prima tessile" },
  "13.2": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Tessitura — tessuti pregiati export" },
  "13.3": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Finissaggio — conto terzi, meno export diretto" },
  "13.9": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Altre tessili — tappeti, cordami" },

  // 14 - Abbigliamento
  "14":   { volume: 5, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Abbigliamento — corriere espresso intensivo, alto valore/kg" },
  "14.1": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Abbigliamento in pelle — lusso, altissimo valore" },
  "14.2": { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Abbigliamento su misura — sartoria export" },
  "14.3": { volume: 5, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Accessori moda — alto valore, express" },

  // 15 - Pelletteria/Calzature
  "15":   { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Pelletteria/calzature — lusso italiano, altissimo valore/kg" },
  "15.1": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Borse, valigeria — lusso, corriere express" },
  "15.2": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Calzature — Made in Italy, altissimo valore" },

  // 16 - Legno
  "16":   { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Legno — semilavorati, qualche export" },
  "16.1": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Segagione — bulk, locale" },
  "16.2": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Pannelli — semilavorati" },
  "16.3": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Carpenteria legno — locale" },
  "16.4": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Contenitori — packaging export" },
  "16.9": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Sughero, intreccio — artigianato" },

  // 17 - Carta
  "17":   { volume: 3, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Carta — export packaging" },
  "17.1": { volume: 3, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Fabbricazione carta — bulk" },
  "17.2": { volume: 3, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Articoli di carta — packaging" },

  // 18 - Stampa
  "18":   { volume: 2, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Stampa — prevalentemente locale" },
  "18.1": { volume: 2, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Stampa — locale" },
  "18.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riproduzione supporti — digitale ormai" },

  // 19 - Raffinazione petrolio
  "19":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Petrolio raffinato — cisterne, non corriere" },
  "19.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Raffinazione — non corriere" },

  // 20 - Chimica
  "20":   { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Chimica — export forte, prodotti specializzati" },
  "20.1": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Chimici base — medio valore" },
  "20.2": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Chimici organici — specializzati" },
  "20.3": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Fertilizzanti — bulk, basso valore" },
  "20.4": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Resine sintetiche — export" },
  "20.5": { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Cosmetica, profumeria — altissimo export Italia" },
  "20.6": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Fibre sintetiche — tessile" },

  // 21 - Farmaceutico
  "21":   { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Farmaceutico — altissimo valore/kg, express obbligatorio" },
  "21.1": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Farmaceutico — express, cold chain, PAGANO" },

  // 22 - Gomma/Plastica
  "22":   { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Gomma/plastica — componentistica export" },
  "22.1": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Gomma — componentistica auto" },
  "22.2": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Plastica — packaging, componentistica" },

  // 23 - Minerali non metalliferi (DIFFERENZIATO)
  "23":   { volume: 3, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Ceramica, vetro — export arredo/design" },
  "23.1": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Cemento laterizi — locale, pesante" },
  "23.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Gesso — locale" },
  "23.3": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Fibrocemento — locale" },
  "23.4": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Ceramica artistica — export design italiano" },
  "23.5": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Cemento calce — bulk" },
  "23.6": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Marmo pietra — export design italiano" },
  "23.7": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Pietre ornamentali — export" },
  "23.9": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Vetro, abrasivi — misto" },

  // 24 - Metallurgia
  "24":   { volume: 3, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Metallurgia — bulk, qualche specializzazione" },
  "24.1": { volume: 2, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Ghisa acciaio — bulk pesante" },
  "24.2": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Tubi acciaio — qualche export" },
  "24.3": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Trafilatura — semilavorati" },
  "24.4": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Metalli non ferrosi — alluminio, rame, più valore" },
  "24.5": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Fonderia — pesante" },

  // 25 - Prodotti in metallo
  "25":   { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Prodotti metallo — componentistica export" },
  "25.1": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Elementi costruttivi — pesanti" },
  "25.2": { volume: 2, valore: 1, intl: "MEDIO",        paga: "POSSIBILE",              note: "Serbatoi cisterne — ingombranti" },
  "25.3": { volume: 2, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Generatori vapore — specializzati" },
  "25.4": { volume: 2, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Armi munizioni — regolamentato, alto valore" },
  "25.5": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Utensili — export" },
  "25.6": { volume: 3, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Trattamento metalli — subfornitura" },
  "25.7": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Articoli in metallo — componentistica" },
  "25.9": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Vari metallo — componentistica" },

  // 26 - Elettronica/Ottica
  "26":   { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Elettronica/ottica — altissimo valore/kg, corriere express" },
  "26.1": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Componenti elettronici — altissimo valore" },
  "26.2": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Computer — express obbligatorio" },
  "26.3": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Telecom — alto valore" },
  "26.4": { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Audio/video — alto valore" },
  "26.5": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Strumenti precisione, orologi — altissimo valore" },
  "26.6": { volume: 4, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Ottica — altissimo valore/kg" },
  "26.7": { volume: 5, valore: 5, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Medicale — express, altissimo valore" },
  "26.8": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Supporti magnetici — nicchia in calo" },

  // 27 - Apparecchiature elettriche
  "27":   { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Apparecchiature elettriche — alto valore, export forte" },
  "27.1": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Motori trasformatori — export" },
  "27.2": { volume: 3, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Batterie — ADR, specializzato" },
  "27.3": { volume: 3, valore: 2, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Cavi conduttori — pesanti" },
  "27.4": { volume: 4, valore: 4, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Illuminazione — design italiano, export forte" },
  "27.5": { volume: 4, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Elettrodomestici — export" },
  "27.9": { volume: 4, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Articoli elettrici vari — export" },

  // 28 - Macchinari
  "28":   { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari — cuore export italiano, ricambi express" },
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
  "53.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Poste e corrieri — concorrente" },

  // ═══════════════════════════════════════
  // I - ALLOGGIO/RISTORAZIONE
  // ═══════════════════════════════════════
  "55":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Alloggio — servizi, no merci" },
  "55.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Alberghi" },
  "55.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Campeggi" },
  "55.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Affittacamere" },
  "55.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Soggiorni brevi" },
  "56":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ristorazione — locale" },
  "56.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ristoranti" },
  "56.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Catering" },
  "56.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Bar" },

  // ═══════════════════════════════════════
  // J - INFORMAZIONE/COMUNICAZIONE (CORRETTO: quasi tutto 1/1)
  // ═══════════════════════════════════════
  "58":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Editoria — libri export, poco volume" },
  "58.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Libri, riviste — qualche export" },
  "58.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre editoriali — digitale" },
  "59":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Cinema/musica — digitale ormai" },
  "59.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Produzione video — digitale" },
  "59.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Musica — digitale" },
  "60":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Radio/TV — no merci" },
  "60.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Radio" },
  "60.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "TV" },
  "61":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Telecom — servizio, non merce" },
  "61.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Telecom cavo — servizio" },
  "61.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Telecom satellite — servizio" },
  "61.3": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre telecom — servizio" },
  "62":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Software/IT — zero merci fisiche" },
  "62.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Software — digitale" },
  "62.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Consulenza IT — servizio" },
  "62.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gestione IT — servizio" },
  "62.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi IT — digitale" },
  "63":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi informazione — digitale" },
  "63.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Hosting — digitale" },
  "63.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre informazione — digitale" },

  // ═══════════════════════════════════════
  // K - FINANZA/ASSICURAZIONI
  // ═══════════════════════════════════════
  "64":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Finanza — no merci" },
  "64.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Banche" },
  "64.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gestione patrimoniale" },
  "64.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre finanziarie" },
  "65":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assicurazioni — no merci" },
  "65.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assicurazioni" },
  "65.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Riassicurazioni" },
  "65.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Fondi pensione" },
  "66":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi finanziari — no merci" },
  "66.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Mercati finanziari" },
  "66.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Intermediazione" },
  "66.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gestione fondi" },
  "66.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ausiliarie assicurazioni" },

  // ═══════════════════════════════════════
  // L - IMMOBILIARE
  // ═══════════════════════════════════════
  "68":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Immobiliare — no merci" },
  "68.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Compravendita immobili" },
  "68.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Affitto immobili" },
  "68.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Agenzie immobiliari" },

  // ═══════════════════════════════════════
  // M - PROFESSIONALI (CORRETTO: quasi tutto 1/1)
  // ═══════════════════════════════════════
  "69":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Legale/contabilità — no merci" },
  "69.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Avvocati — documenti digitali" },
  "69.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Commercialisti — digitale" },
  "70":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Consulenza — no merci" },
  "70.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Direzione aziendale — servizio" },
  "71":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Ingegneria — qualche campione/strumento" },
  "71.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Architettura — servizio" },
  "71.2": { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Collaudi analisi — qualche campione" },
  "72":   { volume: 3, valore: 4, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Ricerca — campioni, strumenti scientifici, express" },
  "72.1": { volume: 3, valore: 4, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "R&D scienze naturali — campioni, reagenti express" },
  "72.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "R&D scienze sociali — no merci" },
  "73":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pubblicità — digitale" },
  "73.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pubblicità — digitale" },
  "73.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ricerche mercato — digitale" },
  "74":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Design — prototipi, campionari" },
  "74.1": { volume: 2, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Design industriale — prototipi, campioni" },
  "74.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Fotografia — no merci fisiche" },
  "74.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Traduzione — servizio digitale" },
  "74.8": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre professionali — misto" },
  "74.9": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Varie professionali" },
  "75":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Veterinari — locale" },
  "75.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Veterinari — locale" },

  // ═══════════════════════════════════════
  // N - SUPPORTO IMPRESE (non presente in ATECO_TREE livello 2/3)
  // ═══════════════════════════════════════

  // ═══════════════════════════════════════
  // O - PUBBLICA AMMINISTRAZIONE
  // ═══════════════════════════════════════
  "84":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "PA — non cliente privato" },
  "84.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Amministrazione pubblica" },

  // ═══════════════════════════════════════
  // P - ISTRUZIONE
  // ═══════════════════════════════════════
  "85":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Istruzione — non spedisce" },
  "85.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pre-primaria" },
  "85.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Primaria" },
  "85.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Secondaria" },
  "85.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Post-secondaria" },
  "85.5": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Università" },
  "85.6": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre istruzione" },

  // ═══════════════════════════════════════
  // Q - SANITA
  // ═══════════════════════════════════════
  "86":   { volume: 2, valore: 4, intl: "MEDIO",        paga: "POSSIBILE",              note: "Sanità — dispositivi medici, campioni" },
  "86.1": { volume: 2, valore: 4, intl: "MEDIO",        paga: "POSSIBILE",              note: "Ospedali — dispositivi medici" },
  "86.2": { volume: 2, valore: 4, intl: "MEDIO",        paga: "POSSIBILE",              note: "Specialistiche — strumenti" },
  "86.9": { volume: 2, valore: 3, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre sanitarie — locale" },
  "87":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza residenziale — locale" },
  "87.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "RSA anziani" },
  "87.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza disabili" },
  "87.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza anziani" },
  "87.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre residenziali" },
  "88":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza non residenziale" },
  "88.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza anziani/disabili" },
  "88.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre assistenza" },

  // ═══════════════════════════════════════
  // R - ARTE/INTRATTENIMENTO (CORRETTO: quasi tutto 1/1)
  // ═══════════════════════════════════════
  "90":   { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Attività artistiche — nicchia" },
  "90.1": { volume: 1, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Arte — opere, trasporto specializzato" },
  "90.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Supporto spettacolo — locale" },
  "90.3": { volume: 1, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Musei — prestiti opere d'arte internazionali" },
  "90.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Giardinaggio — locale, zero export" },
  "91":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Giochi azzardo — no merci" },
  "91.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Scommesse" },
  "92":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Sport — attrezzature" },
  "92.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Attività sportive — attrezzature" },
  "92.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Supporto sport — locale" },
  "93":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Intrattenimento — locale" },
  "93.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Parchi tematici" },
  "93.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Intrattenimento vario" },

  // ═══════════════════════════════════════
  // S - ALTRI SERVIZI
  // ═══════════════════════════════════════
  "94":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Associazioni — no merci" },
  "94.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Organizzazioni professionali" },
  "94.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Organizzazioni religiose" },
  "94.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre organizzazioni" },
  "95":   { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riparazione computer — locale" },
  "95.1": { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riparazione computer — locale" },
  "95.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riparazione beni personali — locale" },
  "96":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi personali — locale" },
  "96.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Lavanderie" },
  "96.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Parrucchieri" },
  "96.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pompe funebri" },
  "96.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altri servizi personali" },

  // ═══════════════════════════════════════
  // T/U
  // ═══════════════════════════════════════
  "97":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Famiglie datori lavoro" },
  "97.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Famiglie — non impresa" },
  "98":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Produzione propria famiglie" },
  "98.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Beni propri famiglie" },
  "98.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi propri famiglie" },
  "99":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Organismi extraterritoriali" },
  "99.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Extraterritoriali" },
};

/** Get ranking for a code. Falls back to parent division if not found. */
export function getAtecoRank(code: string): AtecoRank | null {
  if (ATECO_RANKING[code]) return ATECO_RANKING[code];
  // Try parent (e.g. "10.1" → "10")
  const parent = code.split(".")[0];
  if (parent !== code && ATECO_RANKING[parent]) return ATECO_RANKING[parent];
  return null;
}

/** Star string for a 1-5 value */
export function starsString(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** Color class for score */
export function scoreColor(score: number, isDark: boolean): string {
  if (score >= 16) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (score >= 12) return isDark ? "text-sky-400" : "text-sky-600";
  if (score >= 8) return isDark ? "text-amber-400" : "text-amber-600";
  if (score >= 4) return isDark ? "text-orange-400" : "text-orange-500";
  return isDark ? "text-slate-600" : "text-slate-400";
}

/** Bg class for inline badge */
export function scoreBg(score: number, isDark: boolean): string {
  if (score >= 16) return isDark ? "bg-emerald-500/15 border-emerald-500/25" : "bg-emerald-50 border-emerald-200";
  if (score >= 12) return isDark ? "bg-sky-500/15 border-sky-500/25" : "bg-sky-50 border-sky-200";
  if (score >= 8) return isDark ? "bg-amber-500/15 border-amber-500/25" : "bg-amber-50 border-amber-200";
  if (score >= 4) return isDark ? "bg-orange-500/15 border-orange-500/25" : "bg-orange-50 border-orange-200";
  return isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200";
}
