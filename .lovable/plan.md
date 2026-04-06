

# Fix: destinatario non pre-compilato quando si clicca email dal Network

## Problema

Quando clicchi sull'email di un contatto dal Network (o da Prospects/BCA), il sistema naviga a `/email-composer` passando `prefilledRecipient` nel `location.state`. Ma **nessun componente legge mai quel dato**. Il composer usa solo `useMission().recipients`, che resta vuoto.

## Intervento

### File: `src/pages/EmailComposer.tsx`

Aggiungere un `useEffect` che:
1. Legge `location.state?.prefilledRecipient` al mount
2. Se presente, chiama `addRecipient()` con i dati mappati nel formato `SelectedRecipient`
3. Pulisce lo state dalla history (via `navigate(location.pathname, { replace: true })`) per evitare re-inserimenti al refresh

```text
useEffect:
  const state = location.state as any
  if (state?.prefilledRecipient) {
    const r = state.prefilledRecipient
    addRecipient({
      partnerId: r.partnerId || "",
      companyName: r.company || "",
      contactName: r.name || "",
      email: r.email,
      city: "", countryName: "", isEnriched: false,
    })
    navigate(location.pathname, { replace: true, state: {} })
  }
```

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/EmailComposer.tsx` | Aggiungere `useLocation`, `useEffect` per leggere `prefilledRecipient` e iniettarlo nei recipients |

Nessun altro file da modificare — il dato viene già passato correttamente da Network, Prospects e BCA.

