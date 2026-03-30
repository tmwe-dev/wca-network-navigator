

# ElevenLabs Settings: Dropdown con Bandiere, Genere e Selezione Agente

## Cosa cambia

La libreria voci attuale mostra una griglia di card per categoria. Va sostituita con un'interfaccia piu' compatta e utile:

1. **Due Select dropdown** principali invece della griglia:
   - **Voce predefinita assistente**: dropdown con tutte le voci raggruppate per genere (Maschile / Femminile), ogni voce mostra bandiera dell'accento + nome + categoria
   - **Agente AI predefinito**: dropdown con la lista degli agenti dal sistema, per scegliere quale agente usa la voce

2. **Bandiere per accento/lingua**: mapping accent → emoji flag (american → US, british → GB, italian → IT, etc.)

3. **Raggruppamento per genere**: nel dropdown le voci sono organizzate in due gruppi separati (Maschile / Femminile) usando `SelectGroup` + `SelectLabel`

4. **Anteprima audio**: accanto al dropdown, pulsante Play per ascoltare la voce selezionata

## Dettagli tecnici

### `src/components/settings/ElevenLabsSettings.tsx`

- Rimuovere la griglia card delle voci
- Sostituire con due `Select` (da shadcn):
  - **Voce**: `SelectGroup` "Maschile" + `SelectGroup` "Femminile", ogni `SelectItem` mostra `{flag} {nome} · {categoria}`
  - **Agente**: `SelectGroup` con gli agenti attivi dall'hook `useAgents()`
- Mapping accento → bandiera:
  ```
  american → 🇺🇸, british → 🇬🇧, italian → 🇮🇹, french → 🇫🇷, 
  german → 🇩🇪, spanish → 🇪🇸, australian → 🇦🇺, indian → 🇮🇳
  ```
- Pulsante Play/Stop accanto al Select voce per anteprima
- Mantenere: toggle TTS, card custom Voice ID, tab Avanzate

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/ElevenLabsSettings.tsx` | Sostituire griglia voci con Select dropdown raggruppati per genere + aggiungere Select agente |

