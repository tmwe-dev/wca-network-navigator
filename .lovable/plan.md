

# Fix: Pagina bianca in produzione

## Causa
Il `manualChunks` in `vite.config.ts` separa `@radix-ui` in un chunk (`vendor-radix`) diverso da React (`vendor-react`). In produzione, quando il browser carica `vendor-radix` prima che `vendor-react` sia inizializzato, `React.createContext` è `undefined` → crash → pagina bianca.

Lo stesso problema può colpire anche `vendor-tanstack`, `vendor-motion`, `vendor-markdown`, `vendor-resizable`, `vendor-ui-misc` — tutti usano React internamente.

## Soluzione
**Rimuovere completamente la funzione `manualChunks`**. Vite/Rollup gestisce già il code-splitting automatico in modo sicuro, rispettando l'ordine delle dipendenze. Il manualChunks custom rompe queste garanzie.

### File modificato

| File | Modifica |
|---|---|
| `vite.config.ts` | Rimuovere `rollupOptions.output.manualChunks` e il commento associato. Mantenere solo `chunkSizeWarningLimit: 600` |

Il risultato sarà:
```typescript
build: {
  chunkSizeWarningLimit: 600,
},
```

Dopo la modifica, l'app va ri-pubblicata per applicare il fix in produzione.

