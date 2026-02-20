
# Filtro "Solo nel DB" + Evidenziazione Priorità nell'Albero ATECO

## Obiettivo

Due miglioramenti all'albero ATECO nel Prospect Center:

1. **Filtro "Solo nel DB"** — Un toggle che nasconde tutti i codici ATECO per cui non esiste ancora nessun prospect importato nel database. Utile per lavorare solo su dati già disponibili.

2. **Evidenziazione azzurra per le priorità** — I codici ad alta priorità (score elevato secondo `atecoRanking.ts`) vengono evidenziati in azzurro/cyan all'interno dei raggruppamenti dell'albero, anche senza filtri di ranking attivi. Così si vedono a colpo d'occhio i settori su cui puntare.

---

## Analisi dello stato attuale

### File coinvolto: `src/components/prospects/AtecoGrid.tsx`

- L'albero ha già `nodeCount` / `countMap` che mappa codice ATECO → numero di prospect nel DB.
- Ha già il sistema di score `calcScore(rank)` e colori `scoreBg` / `scoreColor` tramite `atecoRanking.ts`.
- I badge score (numero) compaiono già accanto ad ogni nodo.
- **Manca**: un toggle per filtrare solo i nodi con `count > 0` nel DB.
- **Manca**: l'evidenziazione visiva azzurra per i nodi ad alta priorità (score alto) a livello di riga (non solo il badge).

### Soglia priorità

Dalla formula `calcScore`: `(volume + valore) * 2 * moltiplicatore_intl`
- Score massimo teorico = `(5+5) * 2 * 1.0 = 20`
- Soglia "alta priorità" = **score >= 12** (volume + valore alti con internazionale ALTO o MOLTO ALTO)
- Soglia "media priorità" = **score >= 7**

---

## Modifiche tecniche

### Solo file: `src/components/prospects/AtecoGrid.tsx`

#### 1. Aggiungere stato toggle `onlyInDb`

```typescript
const [onlyInDb, setOnlyInDb] = useState(false);
```

#### 2. Toggle UI — sopra la barra di ricerca ATECO

Un piccolo switch con etichetta "Solo nel DB (X prospect)", dove X è il totale dei prospect nel DB. Visivamente integrato nello stile dark/light esistente.

#### 3. Logica di filtro — `filteredSections`

Nel `useMemo` che calcola `filteredSections`, aggiungere il controllo:

```typescript
// Se onlyInDb, una section è visibile solo se ha almeno un leaf con count > 0
const sectionHasDbData = (secCode: string) =>
  childDivisions(secCode).some(d =>
    childGroups(d.codice).some(g => (nodeCount.get(g.codice) || 0) > 0)
  );

if (onlyInDb) {
  result = result.filter(s => sectionHasDbData(s.codice));
}
```

Stesso controllo a livello di division e group: filtrare divisioni e gruppi senza dati nel DB quando il toggle è attivo.

#### 4. Evidenziazione azzurra righe ad alta priorità

Per **ogni riga** (section, division, group), se lo score è >= 12 (alta priorità), aggiungere un sottile bordo/sfondo azzurro alla riga stessa, non solo al badge:

```typescript
// Classe aggiuntiva per righe ad alta priorità
const isHighPriority = gScore >= 12;
const priorityClass = isHighPriority
  ? isDark
    ? "bg-sky-500/[0.06] border-l-2 border-sky-500/40"
    : "bg-sky-50/80 border-l-2 border-sky-400/50"
  : "";
```

Questo crea un bordo azzurro sinistro + sfondo molto leggero sulle righe prioritarie, senza interferire con i colori di selezione.

---

## Flusso risultante

```text
[Toggle OFF - default]
→ Albero mostra tutti i codici ATECO
→ I codici con score >= 12 hanno bordo azzurro a sinistra + sfondo leggero
→ Tutti i badge score rimangono visibili come prima

[Toggle ON - "Solo nel DB"]
→ Albero mostra SOLO i codici che hanno almeno 1 prospect importato
→ Section/Division vengono nascoste se tutti i loro figli hanno count = 0
→ Il badge con il conteggio (es. "247") rimane visibile per indicare quanti prospect ci sono
→ L'evidenziazione azzurra per le priorità rimane attiva
```

---

## Nessuna modifica al DB o all'API necessaria

I dati dei conteggi sono già caricati da `useAtecoGroups()` che fetcha dal DB. Il toggle è puramente client-side.

---

## File da modificare

- **`src/components/prospects/AtecoGrid.tsx`** — Unico file da modificare: aggiunta toggle UI, logica filtro, evidenziazione righe prioritarie.
