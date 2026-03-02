

## Diagnosi: "velina" durante la navigazione tra pagine

### Causa

Il `PageFallback` è già stato corretto (è un semplice `div` vuoto). Il problema visibile è causato dalla **combinazione di due fattori**:

1. **`AnimatePresence mode="wait"`** in `AppLayout.tsx` (riga 106): con `mode="wait"`, Framer Motion aspetta che la pagina uscente completi la sua exit animation (`opacity: 0`) prima di montare la nuova. Durante questo intervallo, l'area content è vuota/semi-trasparente — la "velina".

2. **`initial={{ opacity: 0 }}`** (riga 109): la nuova pagina parte da trasparenza totale e fa fade-in, creando un secondo momento di semi-visibilità.

Il risultato: navigando tra pagine c'è un flash di ~400ms dove il contenuto è invisibile o semi-trasparente.

### Soluzione

Rimuovere l'`AnimatePresence` e le animazioni `motion.div` dal wrapper dell'`<Outlet>`. Le pagine appariranno istantaneamente senza alcuna velina.

| File | Modifica |
|------|----------|
| `src/components/layout/AppLayout.tsx` | Sostituire il blocco `AnimatePresence` + `motion.div` con un semplice `<Outlet />` diretto, mantenendo il `<main>` con le stesse classi |

```text
Prima:
  <AnimatePresence mode="wait">
    <motion.div key={...} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <Outlet />
    </motion.div>
  </AnimatePresence>

Dopo:
  <Outlet />
```

Questo elimina completamente il flash/velina senza effetti collaterali — la sidebar ha già la sua animazione separata che non viene toccata.

