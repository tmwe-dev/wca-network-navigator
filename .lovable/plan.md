

# Ripristino Accesso Pagine Global e Campagne

## Problema
In `App.tsx` righe 106-107, le route `/global` e `/campaigns` sono state sostituite con `<Navigate to="/" replace />`, quindi qualsiasi accesso viene reindirizzato alla homepage. Le pagine esistono ancora come file ma non sono raggiungibili.

Dalla memory: *"Il Sistema Multi-UI esclude esplicitamente le maschere 'Global' e 'Campagne', che mantengono la loro struttura originale"* — quindi queste pagine devono restare accessibili.

## Piano

### 1. Ripristinare le route in App.tsx
- Riga 106: `<Route path="/global" element={<Global />} />` (rimuovere il Navigate)
- Riga 107: `<Route path="/campaigns" element={<Campaigns />} />` (rimuovere il Navigate)
- Verificare che i lazy import di `Global` e `Campaigns` siano presenti (Global c'è già, Campaigns va verificato)

### 2. Aggiungere link nella sidebar/drawer
- Aggiungere le voci **Global** (icona Globe) e **Campagne** (icona Mail/Send) nel `SidebarDrawer` nella sezione appropriata, probabilmente nella sezione strumenti o come voci dedicate
- Rispettare la logica context-aware della sidebar (visibili in entrambi i contesti Network/CRM)

### Dettagli tecnici
- File modificati: `src/App.tsx`, componente sidebar/drawer
- Nessuna nuova dipendenza
- Il fix del runtime error React ("Should have a queue") verrà investigato separatamente

