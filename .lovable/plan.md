

## Analisi Deep Search: Logo e Background

### Problema 1: I loghi non vengono mostrati nelle card

La Deep Search **salva correttamente** il logo nel campo `logo_url` del partner (riga 593-595 della edge function). La strategia a 3 livelli (branding → OG image → Google favicon) funziona.

**Ma la PartnerCard lo ignora completamente.** In `src/components/partners/PartnerCard.tsx` (righe 79-96), il logo viene SEMPRE preso dal Google Favicon API basato sul dominio:

```text
src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
```

Non c'è nessun riferimento a `partner.logo_url`. Quindi anche se la Deep Search trova un bel logo branding e lo salva nel database, la card non lo usa mai.

**Soluzione**: Modificare la logica del logo nella PartnerCard con priorità:
1. Se `partner.logo_url` esiste → usalo (è il logo trovato dalla Deep Search)
2. Se ha un sito web ma no logo_url → usa Google favicon (come adesso)
3. Altrimenti → bandiera del paese

### Problema 2: Background execution — già funziona

La Deep Search **già funziona in background**. L'hook `useDeepSearchRunner` è montato in `AppLayout` (riga 16) e fornito tramite `DeepSearchContext.Provider` (riga 38). Poiché `AppLayout` è il layout root, il processo continua anche quando navighi tra le pagine. Questo è già corretto e non richiede modifiche.

### File da modificare

| File | Modifica |
|---|---|
| `src/components/partners/PartnerCard.tsx` | Righe 79-96: aggiungere priorità `partner.logo_url` prima del Google favicon |

### Codice della modifica

```tsx
{/* Logo / Favicon — Priority: logo_url > Google favicon > flag */}
<div className="flex-shrink-0 w-11 h-11 rounded-lg bg-muted/50 border flex items-center justify-center overflow-hidden">
  {partner.logo_url ? (
    <img
      src={partner.logo_url}
      alt=""
      className="w-8 h-8 object-contain"
      onError={() => setFaviconError(true)}  // fallback al favicon
    />
  ) : hasWebsite && !faviconError ? (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      className="w-8 h-8 object-contain"
      onError={() => setFaviconError(true)}
    />
  ) : hasWebsite && faviconError ? (
    <span className="text-2xl">{getCountryFlag(partner.country_code)}</span>
  ) : (
    <Tooltip>
      <TooltipTrigger>
        <GlobeIcon className="w-5 h-5 text-destructive/60" />
      </TooltipTrigger>
      <TooltipContent>Nessun sito web</TooltipContent>
    </Tooltip>
  )}
</div>
```

Serve anche gestire il fallback: se `logo_url` fallisce (immagine rotta), ricadere sul favicon. Per questo serve un secondo stato (`logoError`) separato da `faviconError`.

