

# Piano: Reply-To Email + Drop Zone Cockpit Migliorate

## 1. Reply-To configurabile (singolo vs bulk)

### Logica
Quando l'email parte dal cockpit:
- **Invio singolo** (drop su casella Email): la mail va dall'account dell'operatore, Reply-To = email diretta dell'operatore (o non impostato, il client risponde al From)
- **Invio bulk** (campagna/batch): la mail parte dall'account operatore ma il Reply-To viene forzato alla **email commerciale aziendale** (configurabile in `app_settings` con chiave `commercial_reply_to_email`)
- **Override manuale**: nel composer si potrà specificare un Reply-To diverso

### Modifiche

**Database**: Aggiungere in `app_settings` la chiave `commercial_reply_to_email` (es. `commerciale@tmwe.it`). Aggiungere campo `reply_to_email` nella tabella `operators` per override per operatore.

**Edge Function `send-email/index.ts`**:
- Accettare nuovo parametro `reply_to` dal body JSON
- Gerarchia: `reply_to` esplicito → `operators.reply_to_email` → `app_settings.commercial_reply_to_email` → nessuno
- Aggiungere header `replyTo` nella chiamata `client.send()`

**UI — Cockpit `handleDrop`**: 
- Quando `dragCount > 1` (bulk), passare automaticamente `reply_to` = email commerciale
- Quando singolo, non passare reply_to (risposta va al From dell'operatore)

### File coinvolti

| File | Modifica |
|------|----------|
| Migration SQL | Inserire `commercial_reply_to_email` in `app_settings` |
| `supabase/functions/send-email/index.ts` | Aggiungere parametro `reply_to`, leggere da settings/operators, header `replyTo` |
| `src/hooks/useCockpitLogic.ts` | Passare `reply_to` nel draft state quando bulk |

---

## 2. Drop Zone più grandi e visibili

### Problema attuale
Le caselle hanno `min-h-[72px]` e `py-4/py-5` — troppo piccole. Durante il drag la card mantiene dimensioni originali e copre le zone.

### Soluzione

**ChannelDropZones.tsx — Modo espanso (durante drag)**:
- Aumentare altezza: `min-h-[100px] py-6` → zone molto più alte, occupano tutto lo spazio verticale disponibile con `flex-1`
- Hover più evidente: bordo `border-[4px]`, background più intenso (`/30` invece di `/10`), ombra `shadow-xl`, scale `1.05`
- Testo più grande durante hover con icona animata (pulse)
- Container usa `h-full flex flex-col` per distribuire le zone su tutta l'altezza disponibile

**Card durante drag — Riduzione al 50%**:
- In `CockpitContactCard.tsx` e `CockpitContactListItem.tsx`: aggiungere CSS per l'elemento drag ghost
- Usare `onDragStart` per impostare `e.dataTransfer.setDragImage()` con un elemento clonato ridotto al 50%
- Alternativa più semplice: aggiungere `opacity-50 scale-50` alla card che viene trascinata (tramite prop `isDragging`)

**Cockpit.tsx**: 
- Il container centrale delle drop zone passa da `items-center justify-center` a `items-stretch` per dare tutto lo spazio verticale alle zone

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/cockpit/ChannelDropZones.tsx` | Zone più alte, flex-1, hover più evidente, bordi più spessi |
| `src/components/cockpit/CockpitContactCard.tsx` | Drag ghost al 50% via setDragImage |
| `src/components/cockpit/CockpitContactListItem.tsx` | Drag ghost al 50% |
| `src/pages/Cockpit.tsx` | Container drop zone stretch verticale |

---

## Risultato
- Invio singolo → risposta torna all'operatore direttamente
- Invio bulk → risposta va alla mail commerciale aziendale
- Drop zone visivamente dominanti durante il drag, feedback immediato
- Card trascinata ridotta al 50% per non coprire le zone di rilascio

