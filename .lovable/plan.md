

## Piano: Riordinare e distanziare le Stat Pill

### Cambio richiesto
1. **Nuovo ordine**: Directory → Selezionati/Paesi → Partner → [spazio] → No Profilo → No Email → No Tel
2. **Breakpoint**: `hidden lg:flex` → `hidden md:flex` per visibilità a 833px
3. **Separatore visivo**: aggiungere un `div` spacer tra il gruppo "dati" e il gruppo "mancanze"
4. **Colori differenziati**: le pill "info" (Directory, Paesi, Partner) usano blu; le pill "warn/ok" (No Profilo, No Email, No Tel) mantengono il tri-state rosso/ambra/verde — già così nel codice, ma verificheremo che i colori siano distinti

### File da modificare
**`src/pages/Operations.tsx`** — righe 203-210:

```tsx
<div className="hidden md:flex items-center gap-1 flex-wrap">
  {/* Gruppo info */}
  <StatPill icon={FolderOpen} value={contextStats.totalDirectory} label="Directory" ... variant="info" />
  <StatPill icon={Globe} value={contextStats.scannedCountries} label={...} ... variant="info" />
  <StatPill icon={Users} value={contextStats.totalPartners} label="Partner" ... variant="info" />
  
  {/* Separatore */}
  <div className="w-px h-5 bg-border/50 mx-1" />
  
  {/* Gruppo mancanze */}
  <StatPill icon={FileX} value={missingProfile} label="No Profilo" ... variant={...} />
  <StatPill icon={MailX} value={missingEmail} label="No Email" ... variant={...} />
  <StatPill icon={PhoneOff} value={missingPhone} label="No Tel" ... variant={...} />
</div>
```

Un solo file, una sola modifica.

