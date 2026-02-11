
# Fix: Parser non estrae i contatti dall'HTML strutturato di WCA

## Il Problema Reale (finalmente chiaro!)

Il cookie FUNZIONA. La pagina viene scaricata correttamente (35-46k chars). Il problema e' nel **parser**.

L'HTML di WCA ha i contatti in questa struttura:
```text
<div class="profile_label">Name:</div>
<div class="profile_val">Mr. Ledio Saliko</div>

<div class="profile_label">Title:</div>
<div class="profile_val">Managing Director</div>

<div class="profile_label">Email:</div>
<div class="profile_val"><a href='mailto:ledio.saliko@wto.com'>ledio.saliko@wto.com</a></div>

<div class="profile_label">Direct Line:</div>
<div class="profile_val"><span class='warning_login_text'>Members only...</span></div>
```

Ma il parser (riga 210) fa `content.split(/(?=Name\s*:)/i)` e poi cerca il valore con regex tipo `Name\s*:\s*([^*\n]+?)` -- che NON cattura il valore perche' c'e' tutto l'HTML (`</div><div class="profile_val">`) tra "Name:" e il nome reale.

Il risultato: 0 contatti estratti dal regex, nonostante email e nomi siano visibili nell'HTML.

## La Soluzione

Aggiungere una **Strategy 0** specifica per il formato HTML strutturato di WCA, prima delle strategie esistenti (che funzionano solo sul markdown/testo).

## Modifiche Pianificate

| File | Modifica |
|------|----------|
| `supabase/functions/scrape-wca-partners/index.ts` | Aggiungere parser HTML specifico per la struttura `profile_label`/`profile_val` di WCA |

## Dettaglio Tecnico

### Nuova Strategy 0: HTML strutturato WCA (prima della riga 209)

```text
// Strategy 0: WCA structured HTML (profile_label/profile_val divs)
const contactPersonBlocks = content.split(/contactperson_row/).slice(1)

for (const block of contactPersonBlocks) {
  // Extract fields from profile_label/profile_val pairs
  function getProfileVal(label: string): string | null {
    const regex = new RegExp(
      'profile_label">[^<]*' + label + '[^<]*</div>[\\s\\S]*?profile_val">[\\s\\S]*?(?:<a[^>]*>)?([^<]+)',
      'i'
    )
    const m = block.match(regex)
    return m?.[1]?.trim() || null
  }

  const name = getProfileVal('Name')
  const title = getProfileVal('Title')
  const email = getProfileVal('Email')  // estrae da <a href='mailto:...'>email</a>
  const directLine = getProfileVal('Direct Line')
  const mobile = getProfileVal('Mobile')

  if (!name && !title) continue
  if (name && /Members\s*only|Login/i.test(name)) continue

  const contact = { title: title || name || 'Unknown' }
  if (name) contact.name = name
  if (email && !isGarbageEmail(email)) contact.email = email
  if (directLine && !/Members\s*only|Login/i.test(directLine)) contact.phone = directLine
  if (mobile && !/Members\s*only|Login/i.test(mobile)) contact.mobile = mobile

  contacts.push(contact)
}
```

Questa strategy viene eseguita PRIMA delle altre. Se trova contatti, le Strategy 1/2/3 vengono saltate. I campi "Members only" (Direct Line, Mobile) vengono correttamente filtrati, ma Name, Title e Email vengono estratti.

### Risultato atteso per il partner WCA 140543:

```text
{ name: "Mr. Ledio Saliko", title: "Managing Director", email: "ledio.saliko@wto.com" }
```

Invece dell'attuale risultato vuoto (0 contatti).
