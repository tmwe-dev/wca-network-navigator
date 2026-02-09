
# Fix: Partner Non Visibili in Tempo Reale + Combobox Ricercabile

## Problema 1: Partner mancanti
Le query che caricano i partner nella pagina Campagne usano una cache di 2-5 minuti (`staleTime`). Quando il sistema di download sta scaricando nuovi profili in background, questi non compaiono nella lista finche la cache non scade. L'utente vede solo 3 partner USA invece dei 18-19 gia presenti nel database.

## Problema 2: Dropdown paese non ricercabile
Il selettore paese in alto usa un `Select` standard senza possibilita di digitare per cercare. I paesi non sono ordinati per nome.

---

## Modifiche

### File: `src/hooks/usePartnersForGlobe.ts`

**Aggiungere `refetchInterval` a entrambe le query** per aggiornare automaticamente i dati ogni 15 secondi:

- `usePartnersForGlobe`: aggiungere `refetchInterval: 15_000` e ridurre `staleTime` a 10 secondi
- `usePartnersByCountryForGlobe`: aggiungere `refetchInterval: 15_000` e ridurre `staleTime` a 10 secondi

Questo garantisce che i nuovi partner scaricati appaiano nella lista entro 15 secondi.

### File: `src/pages/Campaigns.tsx`

**Sostituire il `Select` del paese con un Combobox ricercabile** usando `Popover` + `Command` (cmdk):

1. Rimuovere gli import di `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
2. Aggiungere import di `Popover`, `PopoverContent`, `PopoverTrigger` e `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`
3. Aggiungere import di `Check`, `ChevronsUpDown` da lucide-react
4. Aggiungere stato `open` per il popover e `searchQuery` per il filtro
5. Ordinare i paesi per nome (`a.name.localeCompare(b.name)`)
6. Il `CommandInput` permette di digitare per filtrare i paesi in tempo reale
7. Ogni item mostra bandiera, nome paese e conteggio partner
8. Al click, seleziona il paese e chiude il popover

Stile coerente con il tema attuale (bg-black/90, border-amber-500/30, text-amber-100).
