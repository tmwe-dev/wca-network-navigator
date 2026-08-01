import type { AtecoRank } from "./types";

export const ATECO_RANKING_1: Record<string, AtecoRank> = {
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
  "28":   { volume: 5, valore: 3, intl: "MOLTO ALTO",   paga: "SI - ALTA PROBABILITÀ",  note: "Macchinari — cuore export italiano, ricambi express" }
};
