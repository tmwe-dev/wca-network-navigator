

# Fix: Spazio vuoto nell'Oracolo — Tipi email nascosti

## Problema

Il `TabsContent` del componente Radix UI ha una classe default `mt-2` nel file `src/components/ui/tabs.tsx` (riga 45). Il pannello Oracolo passa `mt-0` per sovrascriverlo, ma il problema principale è che il `TabsContent` non propaga correttamente il layout flex — la `ScrollArea` interna non riceve l'altezza corretta e il contenuto (lista tipi email) viene tagliato/nascosto.

## Fix

### File: `src/components/email/OraclePanel.tsx`

1. Sui tre `TabsContent`, assicurarsi che abbiano `flex-1 min-h-0 flex flex-col mt-0 data-[state=active]:flex` — il problema è che Radix imposta `display: none` sulle tab inattive e solo `display: block` su quelle attive. Serve forzare `display: flex` quando attiva.

2. Sulla `ScrollArea` (riga 161), aggiungere un'altezza esplicita `h-0 flex-1` per forzare il contenimento — `flex-1` da solo non basta senza un'altezza base.

### File: `src/components/ui/tabs.tsx` (opzionale)

Aggiungere nel TabsContent base la classe `data-[state=active]:flex` in modo che quando è attivo usi flex layout, permettendo ai figli flex di funzionare correttamente.

## Risultato

- Tutte le voci dei tipi email predefiniti sono visibili e scrollabili
- Nessuno spazio vuoto tra il campo obiettivo e la lista tipi

