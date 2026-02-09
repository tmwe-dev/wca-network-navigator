

# Fase 1: Filtri Popup + Logo Azienda + WhatsApp + Design Migliorato

## Panoramica
Trasformare la pagina Partners per dare piu spazio alle schede, aggiungere il logo aziendale, integrare WhatsApp come canale di contatto rapido, e migliorare il design visivo delle card.

---

## 1. Filtri come Popup (non piu sidebar)

Rimuovere la sidebar laterale fissa dei filtri e sostituirla con un **Dialog/Sheet** che si apre cliccando il pulsante Filtri.

- Il pulsante Filtri nella barra di ricerca apre un pannello laterale (Sheet) o una modale
- Dentro ci sono gli stessi filtri attuali: paese (con combobox ricercabile come fatto per Campaigns), preferiti, tipo partner, servizi
- Quando si chiude, i filtri applicati restano attivi
- Badge con conteggio filtri attivi visibile sul pulsante
- Risultato: tutta la larghezza della pagina e disponibile per le card dei partner

### File: `src/pages/Partners.tsx`
- Rimuovere il blocco `<aside>` con la sidebar
- Importare `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetTrigger` da `@/components/ui/sheet`
- Spostare il contenuto dei filtri dentro lo `SheetContent`
- Sostituire il `Select` paese con Combobox ricercabile (Popover + Command) come gia fatto per Campaigns
- Aggiungere badge conteggio filtri attivi sul pulsante Filter
- Cambiare la griglia da `sm:grid-cols-2 xl:grid-cols-3` a `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` per sfruttare lo spazio

---

## 2. Logo Aziendale dalla Favicon del Sito Web

Mostrare il logo dell'azienda nella card usando la **favicon del sito web** tramite il servizio Google Favicons. Se il partner non ha un sito web, mostrare un'icona di avviso.

### File: `src/pages/Partners.tsx` (componente card)
- Se `partner.website` esiste: mostrare `<img src="https://www.google.com/s2/favicons?domain=DOMINIO&sz=64" />` dentro un contenitore 48x48 con bordo arrotondato
- Se `partner.website` non esiste: mostrare un'icona `Globe` barrata o un indicatore rosso "No web" come segnale negativo
- Fallback con `onError`: se la favicon non carica, mostrare la bandiera del paese come attualmente
- Questo non richiede modifiche al database ne edge function

---

## 3. Pulsante WhatsApp nelle Card

Aggiungere un pulsante WhatsApp nelle azioni rapide di ogni card.

### File: `src/pages/Partners.tsx`
- Aggiungere il pulsante WhatsApp usando `https://wa.me/NUMERO` (dopo aver pulito il numero da spazi, trattini, parentesi)
- Usare il campo `partner.phone` o `partner.mobile` (preferire mobile se disponibile)
- Icona: `MessageCircle` da lucide-react con colore verde WhatsApp
- Il pulsante apre direttamente WhatsApp Web/App con il numero pre-compilato

---

## 4. Design Migliorato delle Card

Rendere le card piu eleganti e informative a colpo d'occhio.

### File: `src/pages/Partners.tsx`
- **Header card**: logo a sinistra, nome azienda + citta/paese a destra, stellina favorito in alto a destra
- **Rating visivo**: se `partner.rating` esiste, mostrare stelle colorate (1-5) sotto il nome
- **Badge servizi migliorati**: usare icone piccole colorate invece di solo testo, con tooltip per il nome completo
- **Indicatore sito web**: bordo verde sottile se ha website, bordo grigio/rosso se non ce l'ha
- **Anni WCA**: mostrare con un piccolo badge colorato graduato (verde scuro = 10+ anni, verde = 5+, giallo = 2+, grigio = nuovo)
- **Tipo ufficio**: piccola etichetta "HQ" o "Branch" nell'angolo della card
- **Azioni rapide ridisegnate**: icone piu grandi, disposte in una riga uniforme con separatori, colori specifici per canale (verde WhatsApp, blu email, grigio telefono, azzurro web)

---

## Riepilogo File Modificati

| File | Modifiche |
|------|-----------|
| `src/pages/Partners.tsx` | Sidebar -> Sheet popup, logo favicon, WhatsApp, redesign card |

Nessuna modifica al database. Nessuna nuova edge function. Tutto frontend.

