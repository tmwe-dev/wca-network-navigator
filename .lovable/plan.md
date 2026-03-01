

## Piano: Semplificare GoalBar e allargare le textarea

### Problemi
1. Il dropdown "Carica preset..." in alto crea confusione — sembra un duplicato dei selettori Goal/Proposta appena aggiunti
2. Le textarea sono troppo piccole (`min-h-[56px] max-h-[80px]`) — il testo non si legge

### Modifiche su `src/components/workspace/GoalBar.tsx`

**1. Rimuovere la riga preset selector in alto**
- Eliminare tutto il blocco "Preset selector" (righe 111-147): il Select "Carica preset...", i pulsanti Aggiorna/Elimina e il form di salvataggio
- Spostare la funzionalità di salvataggio preset dentro i tab come azione secondaria (un piccolo bottone "Salva come preset" in fondo ai tab Goal/Proposta), oppure rimuoverla del tutto se non serve

**2. Allargare le textarea**
- Goal: da `min-h-[56px] max-h-[80px]` a `min-h-[120px] max-h-[200px]`
- Proposta: stessa cosa — `min-h-[120px] max-h-[200px]`
- Togliere `resize-none` per permettere il resize manuale se l'utente vuole

**3. Mantenere i selettori Goal/Proposta predefiniti**
- Restano i dropdown "Seleziona goal predefinito..." e "Seleziona proposta predefinita..." che funzionano correttamente

### Risultato
- Interfaccia pulita: solo tab con dropdown predefinito + textarea ampia
- Nessuna confusione tra "preset" e "goal predefinito"
- Testo leggibile e utilizzabile

