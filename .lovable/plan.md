

## Piano: Download Canvas + Terminal Button + Feedback Dinamico

### Problema
1. Durante il download profili, l'utente vede solo un flag verde e il nome azienda — non sa COSA è stato scaricato (profilo, N email, N telefoni)
2. Non c'è un bottone per aprire il Terminal dalla pagina Operations quando un paese è selezionato
3. Manca un canvas visuale (come DeepSearchCanvas) che mostri in tempo reale il profilo in fase di compilazione

### Soluzione

#### 1. Nuovo componente: `DownloadCanvas.tsx`
Canvas overlay (stessa struttura di DeepSearchCanvas) che mostra:
- **Current Card** animata con il profilo in fase di download:
  - Nome azienda + flag
  - 4 slot con animazione "typing": Profilo, Email (×N), Telefono (×N), Contatti (×N)
  - Ogni slot parte grigio/pulsante, poi diventa verde con il conteggio quando il dato arriva
- **Barra di progresso** globale (done/total con %)
- **Cronologia** dei profili completati con indicatori per ogni dato estratto (📋✓ 📧×2 📱×1)
- Bottoni Stop e Chiudi

**Types**:
```typescript
export interface DownloadResult {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  profileSaved: boolean;
  emailCount: number;
  phoneCount: number;
  contactCount: number;
  skipped?: boolean;
  error?: string;
}
export interface DownloadCurrent {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  index: number;
  total: number;
}
```

#### 2. Modificare `useDownloadProcessor.ts`
Aggiungere callback per emettere eventi al canvas:
- `onProgress?: (current: DownloadCurrent) => void` — chiamato prima di ogni profilo
- `onResult?: (result: DownloadResult) => void` — chiamato dopo ogni profilo con i dettagli di cosa è stato estratto

Esporre questi come props opzionali del hook oppure usare un ref per i callback.

#### 3. Modificare `Operations.tsx`
- Aggiungere stato per `dlCanvasOpen`, `dlResults`, `dlCurrent` (come per deep search)
- Passare i callback a `useDownloadProcessor`
- Aggiungere bottone **Terminal** (icona `Terminal`) nella top bar accanto al bottone Eye per deep search — visibile quando ci sono job attivi o completati
- Aggiungere bottone **Eye download** per riaprire il DownloadCanvas
- Il DownloadCanvas si apre automaticamente quando parte un job di download

#### 4. Aggiungere bottone Terminal in `PartnerListPanel.tsx`
Nella toolbar del pannello, aggiungere un bottone con icona Terminal che mostra/nasconde il DownloadTerminal sotto la lista partner (o come overlay).

### File da creare/modificare

| File | Azione |
|------|--------|
| `src/components/operations/DownloadCanvas.tsx` | **NUOVO** — Canvas visuale per download profili |
| `src/hooks/useDownloadProcessor.ts` | Aggiungere callback onProgress/onResult |
| `src/pages/Operations.tsx` | Integrare DownloadCanvas, bottone Terminal, bottone Eye download |

