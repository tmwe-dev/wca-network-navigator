

# Fix Mapping Contatti: phone vs direct_phone

## Problema

Lo scraper (`scrape-wca-partners`) restituisce i contatti con questa struttura:
```text
{ title: "Executive Director", name: "Mr. Makis Mavroeidis", email: "makis@...", phone: "+355...", mobile: "..." }
```

Ma il mapping in `AcquisizionePartner.tsx` (riga 217-223) cerca campi diversi:
```text
name: c.name,           // OK ma puo' essere vuoto
direct_phone: c.direct_phone,  // SBAGLIATO - il campo si chiama "phone"
mobile: c.mobile,       // OK
```

Risultato: il telefono e' sempre vuoto, quindi tutti i contatti appaiono come "arancioni" (parziali) invece che "verdi" (completi), anche quando il telefono esiste nei dati scaricati.

## Fix

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Riga 217-223: correggere il mapping dei contatti |

### Codice corretto

```text
contacts: contacts.map((c: any) => ({
  name: c.name || c.title || "Sconosciuto",
  title: c.title,
  email: c.email,
  direct_phone: c.phone || c.direct_phone,   // "phone" dallo scraper -> "direct_phone" nel canvas
  mobile: c.mobile,
})),
```

Modifica minima: 2 righe cambiate. Il semaforo verde apparira' correttamente quando email + telefono sono presenti.
