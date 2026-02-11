

# Redesign Partner Hub: Coppe, Contatti, Social, Design Professionale

## Problemi segnalati

1. **Coppe**: troppe coppe individuali -- servono UNA coppa + numero anni chiaro
2. **Network a sinistra**: mostra tutti i loghi a tutti i partner invece che solo quelli a cui appartiene
3. **Contatti nella card**: mancano icone telefono/email accanto a ogni persona
4. **Pannello destro**: troppo dispersivo, loghi network ancora "vuoti" (non pieni), serve compattare
5. **Social nella card sinistra**: mancano icone LinkedIn/Facebook
6. **Design generale**: troppo elementare, mancano glassmorphism, sfumature, gradients
7. **Servizi trasporto e specialita'**: brutti, da rifare con design professionale
8. **Contatti azienda**: non evidenziano se i valori sono pieni o vuoti
9. **Icone piene**: a destra ancora non sono fill

## Modifiche pianificate

### File: `src/pages/PartnerHub.tsx`

#### 1. TrophyRow -> singola coppa + numero
Sostituire la griglia di N coppe con:
- 1 icona Trophy (fill, amber, `w-4 h-4`)
- numero anni in grassetto (`text-sm font-bold text-amber-500`)
- testo "yrs" piccolo accanto

Sia nella card sinistra che nel pannello destro.

#### 2. Contatti con icone email/telefono nella card sinistra
Per ogni contatto mostrato (max 3), aggiungere accanto al nome:
- Icona `Mail` piena (fill) in blu se `c.email` esiste, altrimenti grigia/opaca
- Icona `Phone` piena (fill) in verde se `c.direct_phone || c.mobile` esiste, altrimenti grigia/opaca
- Questo mostra immediatamente la qualita' del contatto

#### 3. Social links nella card sinistra
Dopo i contatti e prima dei servizi, aggiungere una riga con le icone social (LinkedIn, Facebook, ecc.) recuperate dal componente `SocialLinks` in modalita' compact. Importare `useSocialLinks` e mostrare le icone direttamente nella card con `fill="currentColor"`.

#### 4. Network solo del partner (card sinistra)
Il codice attuale gia' filtra `partner.partner_networks` -- verificare che funzioni correttamente. Se il database ritorna i network corretti per partner, non serve modifica. Se mostra tutti, aggiungere filtro.

#### 5. Pannello destro: compattare e icone piene
- **Servizi trasporto**: aggiungere `fill="currentColor"` a tutte le icone, aggiungere gradient di sfondo alle card servizio (`bg-gradient-to-r from-sky-500/10 to-transparent` per air, `from-blue-500/10` per ocean, ecc.)
- **Specialita'**: stesso trattamento con icone piene e sfumature colorate
- **Network logos**: i loghi da `w-24 h-24` sono gia' immagini reali (PNG caricati), ma il fallback Globe e' vuoto -- aggiungere `fill="currentColor"` al fallback
- **Contatti azienda collapsible**: accanto a ogni campo (Phone, Mail, Globe, Address), mostrare l'icona piena colorata se il valore esiste, grigia outline se manca. Aggiungere anche i campi mancanti in grigio per evidenziare cosa non abbiamo
- **Contatti ufficio collapsible**: per ogni persona, mostrare icone email/phone piene se presenti, vuote/grigie se mancanti

#### 6. Design professionale con glassmorphism e gradients
- **Header card**: aggiungere `bg-gradient-to-br from-primary/5 via-transparent to-accent/10` e `backdrop-blur-sm`
- **Sezioni servizi/specialita'**: `bg-gradient-to-r` con colori tematici
- **Badge servizi singoli**: bordo con glow sottile (`shadow-sm shadow-sky-500/20` per air, ecc.)
- **Collapsible triggers**: aggiungere gradient sottile e icona con glow
- **Card KPI**: aggiungere gradient e border glow
- **Bottone Deep Search**: gradient `from-primary to-sky-400` con hover animato
- **Bottone preferiti**: glow amber quando attivo
- **Card network**: backdrop-blur e border sottile luminoso

#### 7. Bottoni e tasti migliorati
- Tutti i bottoni con `rounded-xl` e transizioni smooth
- Social links nel pannello destro: icone piu' grandi (`w-6 h-6`), con label sotto, sfondo colorato per piattaforma
- Rating stars: leggermente piu' grandi nel dettaglio

### File: `src/components/agents/SocialLinks.tsx`
- Modalita' non-compact: icone piu' grandi (`w-6 h-6`), con `fill="currentColor"`, sfondo colorato per piattaforma (`bg-blue-500/10` per LinkedIn, `bg-blue-400/10` per Facebook, ecc.)
- Label sotto l'icona in formato verticale

### Riepilogo modifiche per file

| File | Modifiche |
|------|-----------|
| `src/pages/PartnerHub.tsx` | TrophyRow semplificata, contatti con icone pieni/vuoti, social nella card sinistra, icone piene ovunque, glassmorphism, gradients, design professionale, servizi ridisegnati, contatti azienda con stati pieni/vuoti |
| `src/components/agents/SocialLinks.tsx` | Icone piu' grandi con fill, sfondo colorato per piattaforma, layout verticale |

### Risultato atteso
- Card sinistra: coppa singola con numero, contatti con icone stato, social visibili, design moderno
- Pannello destro: compatto, icone piene, gradients, glassmorphism, contatti con evidenza pieno/vuoto
- Design professionale con sfumature e profondita' visiva

