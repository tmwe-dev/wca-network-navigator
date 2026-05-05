## Cosa succede oggi (dati reali in agenda)

Ho letto le 4 attività "Risposta email" pendenti per oggi 5/5/2026. Ecco cosa abbiamo:

| # | Subject | Mittente reale | Azienda mostrata in agenda |
|---|---|---|---|
| 1 | RE: RFP FOR A TOTAL OF 230 PALLETS... | `dvorakb@sbaglobal.com` | RADIANT / Service By Air |
| 2 | RFP FOR A TOTAL OF 230 PALLETS... | `dvorakb@sbaglobal.com` | RADIANT / Service By Air |
| 3 | Payment slip | `sell@vhumania.com` | (nessuna) |
| 4 | 19 / Shah-e-Karam Shipping... | `info@bizzmail.today` | (nessuna — ma il subject parla di Shah-e-Karam, newsletter di terzi) |

I problemi sono **due distinti**:

### Problema A — match cieco per dominio
Il partner "RADIANT / Service By Air" ha email `sbadtw@sbaglobal.com`. La mail arriva da `dvorakb@sbaglobal.com` (persona diversa, stesso dominio). La funzione `matchSender` (`supabase/functions/check-inbox/dbOperations.ts`, righe 76-82) ha un **fallback per dominio**:

```ts
const { data: dp } = await supabase.from("partners")
  .select("id, company_name")
  .ilike("email", `%@${domain}`)
  .limit(1).maybeSingle();
```

- **Nessun ORDER BY** → prende un partner a caso fra tutti quelli con quel dominio.
- **Nessun controllo di confidenza** → tratta un match per dominio come uguale a un match per email esatta.
- L'attribuzione viene poi ereditata dal trigger `on_inbound_message` (migrazione `20260504061239`) che genera l'attività con `partner_id` "fidato".

Risultato: l'agenda mostra il nome di un'azienda che **potrebbe non essere quella che ha davvero scritto**, e l'operatore (giustamente) si insospettisce.

### Problema B — newsletter/notifiche entrano in agenda come "Risposta da gestire"
Mail tipo "Payment slip" da `sell@vhumania.com`, "1.500€ per te! Grazie alla tua auto Diesel!", "L'app di LinkedIn può aiutarti ancora di più", "Cerotto sottile contro il grasso..." vengono classificate come `follow_up` e finiscono fra le azioni urgenti, anche se non sono risposte commerciali ma spam/newsletter/notifiche.

Il trigger `on_inbound_message` crea un'`activity` follow_up per **ogni inbound**, senza guardare la categoria assegnata da `email_address_rules` o se il mittente è una newsletter/spam.

## Cosa propongo

Due fix indipendenti, entrambi minimi e reversibili.

### Fix 1 — Match mittente più onesto e deterministico

Toccare solo `supabase/functions/check-inbox/dbOperations.ts` (`matchSender`):

1. **Match per dominio deterministico**: aggiungere `ORDER BY created_at ASC` (partner più vecchio = quello "principale" dello scope), oppure preferire partner con `email = @dominio` esatto se esiste. Non più "primo a caso".
2. **Marcare il match come "soft"**: aggiungere campo `match_confidence: 'exact' | 'domain' | 'none'` nel ritorno. Per `domain` non valorizzare `partner_id` direttamente sul `channel_messages` ma metterlo in un nuovo campo `partner_id_suggested` (o nel `raw_payload.match_confidence`), così:
   - Il trigger `on_inbound_message` può decidere di **non** creare la follow_up con partner attribuito quando la confidenza è solo `domain`.
   - L'agenda mostra "Mittente sconosciuto · `dvorakb@sbaglobal.com` (dominio simile a RADIANT?)" invece di affermare l'identità.
3. **Cambiare `maybeSingle()` in `select.limit(2)`**: se il dominio matcha 2+ partner diversi → confidenza scende a `domain_ambiguous` e nessuna attribuzione automatica.

Variante leggera (se preferisci toccare meno cose): mantenere `partner_id` ma far mostrare nell'UI dell'agenda il **mittente reale** (email + nome) accanto al partner attribuito quando il match è solo per dominio, e permettere all'operatore di confermare/dissociare con un click.

### Fix 2 — Niente newsletter/notifiche in agenda

Toccare il trigger `on_inbound_message` (nuova migrazione, no edit retro):

- Prima dell'`INSERT INTO activities`, controllare:
  - `email_address_rules.category` per `from_address`: se ∈ `('newsletter','transactional','marketing','spam','automation')` → **skip** la creazione dell'activity.
  - Se l'oggetto inizia con pattern noti di no-reply / notifiche LinkedIn / Google / pubblicità (`/^L'app di LinkedIn/`, `/^Hai \d+ nuovi inviti/`, `/^Re: air cargo market$/`...) → skip.
- L'inbound resta in `channel_messages` (visibile in Funnemail), ma **non sporca** l'agenda commerciale.

Questo è coerente con la regola già scritta nelle memorie (Email Intelligence Learning Loop): l'agenda è per le risposte commerciali, non per il rumore.

### Fix 3 — UI agenda: mostrare il mittente reale accanto al partner

In `AgendaDayDetail.tsx` (riga 291-294, `partnerName`):
- Sotto il nome del partner mostrare sempre, in caratteri piccoli, **`from_address` reale** (estratto da `description` o, meglio, joinato dal `channel_messages` collegato).
- Quando il match è "domain" mostrare un badge giallo "match per dominio · da verificare".
- Aggiungere voce nel menu `⋯` → "Riassegna mittente" che apre la lookup partner.

## File toccati (stima)

- `supabase/functions/check-inbox/dbOperations.ts` — matchSender deterministico + confidence (~30 righe).
- Nuova migrazione SQL: aggiorna `on_inbound_message` con guard newsletter/spam e su `match_confidence='domain'` non assegna partner_id sull'activity.
- `src/components/agenda/AgendaDayDetail.tsx` — riga mittente reale + badge confidenza (~20 righe UI).
- Eventuale nuova RPC `unlink_activity_partner(activity_id)` per il "Riassegna" (~10 righe SQL).

## Cosa NON tocco

- `check-inbox/index.ts` (codice protetto da memoria "Email Code Integrity").
- Il flusso di salvataggio `channel_messages` resta identico.
- Nessun retro-fix sui dati già scritti — i fix valgono per gli inbound futuri. Per i 2 record RADIANT già errati di oggi, opzionalmente posso fornire una query manuale che li dissocia (one-shot, non automatica).

## Domanda di scope prima di procedere

Vuoi:

**A.** Solo il **Fix 3 (UI)** — l'agenda mostra mittente reale + badge "match per dominio". Backend invariato. Soluzione più rapida, fa subito vedere il problema all'operatore senza cambiare logica.

**B.** Fix 1 + 2 + 3 completo — match più onesto, niente newsletter in agenda, UI trasparente. Più lavoro ma risolve la radice.

**C.** Solo Fix 2 (newsletter fuori dall'agenda) + Fix 3 (UI mittente reale), senza toccare matchSender.

Indica A/B/C e procedo con il piano definitivo + implementazione.
