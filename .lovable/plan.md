

# Partner Hub: Mercati con Bandiere, Routing e Armonizzazione Cromatica

## Problemi Identificati

1. **Mercati Principali**: mostrano un'icona Globe generica blu invece della bandiera del paese
2. **Routing esclusive/preferenziali**: non vengono estratte ne' mostrate
3. **Troppi colori nelle icone**: ogni servizio ha un colore diverso (sky, blue, amber, slate, orange, red, cyan, purple, green, teal, indigo, stone) -- confusionario
4. **Design poco accattivante**: le card dei servizi e specialita' sono piatte

## Modifiche Pianificate

### 1. Mercati Principali con Bandiere

Nella sezione "Mercati Principali" (pannello destro, linea 1106-1117), sostituire l'icona `Globe` con la bandiera emoji del paese. Il sistema prova a fare match tra il nome del mercato (es. "UAE", "Saudi Arabia") e i codici paese WCA per mostrare la bandiera corretta. Se non trova match, mostra la bandiera generica del globo.

### 2. Nuova Sezione "Routing Principali"

Aggiungere una sezione sotto i Mercati Principali che mostra le routing preferenziali/esclusive estratte da `enrichment_data.key_routes` o dal `profile_description`. Le routing vengono mostrate come coppie di bandiere (es. IT -> AE) con una freccia tra i due paesi.

Se i dati non sono disponibili (campo vuoto), la sezione non appare -- si riempira' con il prossimo ciclo di enrichment/parse-profile-ai.

### 3. Armonizzazione Cromatica a 2 Colori

Ridurre la palette delle icone dei servizi a **due colori principali**:
- **Sky-500** (`#0ea5e9`) per tutti i servizi di trasporto (Air, Ocean FCL, Ocean LCL, Road, Rail, Project)
- **Slate-500** per tutte le specialita' (Dangerous Goods, Perishables, Pharma, eCommerce, Relocations, Customs, Warehousing, NVOCC)

Colori mantenuti separatamente:
- **Amber-400/500** per stelle e trofei (gia' cosi')
- Loghi social network invariati (LinkedIn blu, Facebook blu, WhatsApp verde)

Questo si ottiene modificando `getServiceIconColor()` in `src/lib/countries.ts`.

### 4. Icone Servizi piu' Eleganti nel Dettaglio

Nelle card dei servizi (pannello destro), aggiungere un sottile effetto hover glassmorphism e uniformare i colori. Le icone rimangono filled ma con i due colori armonizzati.

Nella card sinistra (lista partner), le icone dei servizi diventano tutte dello stesso colore (sky per trasporto, slate per specialita') eliminando l'arcobaleno attuale.

### 5. Bandiere nei Mercati Principali -- Mapping Nomi->Codici

Creare una funzione `resolveCountryCode(marketName)` che mappa nomi comuni a codici ISO:
- "UAE" -> "AE"
- "Saudi Arabia" -> "SA"  
- "China" -> "CN"
- ecc.

Utilizza la lista `WCA_COUNTRIES` gia' presente per il matching fuzzy.

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/lib/countries.ts` | `getServiceIconColor()`: ridurre a 2 colori. Aggiungere `resolveCountryCode()` per mapping nome->codice |
| `src/pages/PartnerHub.tsx` | Mercati Principali: Globe -> bandiere con `resolveCountryCode`. Nuova sezione "Routing". Hover glassmorphism sulle card servizi |

## Palette Finale

```text
Servizi Trasporto:  sky-500  (icone filled)
Specialita':        slate-500 (icone filled)  
Stelle/Trofei:      amber-400/500
Social:             colori originali (invariati)
Contatti email:     sky-500 (unificato)
Contatti telefono:  sky-500 (unificato, era green)
```

Risultato: interfaccia cromaticamente coerente con massimo 2 colori funzionali + amber per i riconoscimenti.

