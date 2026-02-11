

# Fix: Canvas Real-Time e Riepilogo Qualità

## Problema

Il canvas mostra "rosso falso" perché:

1. Il server (Phase 1) restituisce contatti SENZA email/telefoni (non ha i cookie di autenticazione)
2. Il canvas mostra subito questi contatti come ROSSI
3. L'estensione Chrome (Phase 1.5) salva i dati reali nel database tramite `save-wca-contacts`, MA se la comunicazione bridge fallisce o va in timeout, il canvas non si aggiorna mai
4. Il contatore qualità segna "incompleto" e dopo 3 consecutivi manda il warning "Qualità dati sospetta"

## Soluzione

### 1. Verifica DB dopo l'estensione (fallback)

Dopo Phase 1.5, se il bridge non ha restituito contatti, fare una query diretta al DB per recuperare i contatti REALI che l'estensione potrebbe aver salvato in autonomia.

**File: `src/pages/AcquisizionePartner.tsx`** (dopo il blocco extension, ~riga 273)

Aggiungere un fallback che:
- Trova il partner nel DB tramite `wca_id`
- Recupera i contatti dalla tabella `partner_contacts`
- Aggiorna il canvas con i dati reali dal DB
- Se trova email/telefoni, segna `contactSource = "extension"`

### 2. Riepilogo Qualità Live nella Toolbar

Aggiungere una barra riepilogativa visibile durante l'esecuzione della pipeline, nella toolbar (sopra il canvas), che mostra in tempo reale:

```
Progresso: 5/11 | Con email: 4 | Con telefono: 3 | Completi: 3 | Vuoti: 1
```

Con indicatori colorati (verde/arancione/rosso) e una barra di progresso.

**File: `src/pages/AcquisizionePartner.tsx`** (nella toolbar, dopo i pulsanti)

### 3. Indicatore di fase sul Canvas per l'estensione

Aggiungere una fase visiva "Estrazione contatti..." tra Download e Arricchimento, per dare feedback che il sistema sta lavorando sull'estrazione dei contatti privati.

**File: `src/components/acquisition/PartnerCanvas.tsx`**

Aggiungere `"extracting"` come fase nel `PhaseIndicator` con label "Contatti Privati".

### 4. Contatore qualità corretto

Il conteggio qualità (completo/incompleto) deve usare i dati FINALI del canvas (dopo il fallback DB), non i dati intermedi del server.

## Dettagli Tecnici

### Modifica 1: Fallback DB dopo estensione (`AcquisizionePartner.tsx`, ~riga 273)

Dopo il blocco `try/catch` dell'estensione, aggiungere:

```typescript
// FALLBACK: If canvas still shows no emails, check DB directly
// (extension may have saved contacts via save-wca-contacts independently)
if (canvas.contactSource !== "extension" || 
    !canvas.contacts.some(c => c.email?.trim())) {
  try {
    // Find partner by wca_id
    const { data: dbPartner } = await supabase
      .from("partners")
      .select("id")
      .eq("wca_id", item.wca_id)
      .maybeSingle();
    
    if (dbPartner) {
      const { data: dbContacts } = await supabase
        .from("partner_contacts")
        .select("name, title, email, direct_phone, mobile")
        .eq("partner_id", dbPartner.id);
      
      if (dbContacts && dbContacts.length > 0 && 
          dbContacts.some(c => c.email || c.direct_phone || c.mobile)) {
        canvas.contacts = dbContacts.map(c => ({
          name: c.name,
          title: c.title || undefined,
          email: c.email || undefined,
          direct_phone: c.direct_phone || undefined,
          mobile: c.mobile || undefined,
        }));
        canvas.contactSource = "extension";
        setCanvasData({ ...canvas });
      }
    }
  } catch { /* DB check failure is non-blocking */ }
}
```

### Modifica 2: Barra riepilogo live (`AcquisizionePartner.tsx`, nella toolbar)

Nuovo stato per tracciare statistiche dettagliate:

```typescript
const [liveStats, setLiveStats] = useState({
  processed: 0,
  withEmail: 0,
  withPhone: 0,
  complete: 0, // email + phone
  empty: 0,    // no contacts at all
});
```

Aggiornare dopo ogni partner completato (dove ora si aggiorna qualityComplete/qualityIncomplete).

Rendering nella toolbar come barra compatta con numeri e indicatori colorati.

### Modifica 3: Fase "extracting" nel PhaseIndicator (`PartnerCanvas.tsx`)

Aggiungere `"extracting"` nel type `CanvasPhase` e nel componente `PhaseIndicator`:

```typescript
export type CanvasPhase = "idle" | "downloading" | "extracting" | "enriching" | "deep_search" | "complete";
```

Fasi visualizzate: Download -> Contatti Privati -> Arricchimento -> Completato

### Modifica 4: Usare `setCanvasPhase("extracting")` durante Phase 1.5

Nel pipeline, prima di chiamare `extensionExtract`, impostare la fase a "extracting" per dare feedback visivo che il sistema sta estraendo i contatti dall'estensione.

## Risultato Atteso

- Il canvas mostra il colore CORRETTO (verde/arancione/rosso) basato sui dati REALI nel database
- Se l'estensione salva i contatti ma non comunica al bridge, il fallback DB li recupera
- La toolbar mostra in tempo reale quanti partner hanno email, telefono, dati completi
- Una nuova fase "Contatti Privati" nel PhaseIndicator mostra quando il sistema sta estraendo i dati
- Niente piu' warning "Qualità dati sospetta" quando i dati sono effettivamente presenti nel DB
