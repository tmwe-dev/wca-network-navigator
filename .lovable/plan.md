

## Fix Completo della Maschera Partner Hub

### Problemi identificati dallo screenshot

1. Le coppe sono **vuote** (solo contorno) - manca il `fill`
2. Layout **caotico**: badge sparsi su 6 righe verticali senza logica
3. **Bandiera paese** quasi invisibile
4. **"No contatti personali"** scritto in testo rosso - dovrebbe essere solo la striscia laterale
5. **"WhatsApp" / "Telefono" / "Email"** come testo nel header - ridondante e brutto
6. Badge "Primo contatto", "Freight Forwarder", "HQ" tutti separati e disordinati

### Correzioni

**1. Coppe piene (riga 125)**
Aggiungere `fill-amber-500` alle icone Trophy per renderle solide.

**2. Eliminare testo ridondante contatti dal header (righe 472-502)**
Rimuovere completamente la sezione "WhatsApp / Telefono / Email / No contatti personali" dal dettaglio header. La qualita' contatto e' gia' comunicata dalla striscia laterale nella lista. Nel dettaglio si vedono i contatti veri nella sezione dedicata.

**3. Compattare header dettaglio (righe 440-507)**
Mettere tutto su 2-3 righe massimo:
- Riga 1: Nome + Bandiera grande + WCA ID
- Riga 2: Citta', Paese + Tipo (FF) + Office (HQ) -- tutto inline
- Riga 3: Stelline + Coppe (sulla stessa riga)
- Eliminare il badge "Primo contatto" (informazione inutile nel dettaglio, si vede dalla timeline)

**4. Lista partner (sinistra) - pulizia**
- Rimuovere il testo "No contatti" dalla card (la striscia rossa laterale basta)
- Coppe con fill
- Bandiera del paese visibile accanto al nome della citta'

**5. Bandiera grande nel dettaglio**
Spostare la bandiera accanto al nome della citta' come testo grande (non come micro-overlay sul logo).

### File modificato

`src/pages/PartnerHub.tsx` -- tutte le correzioni sono in questo file:

| Zona | Modifica |
|------|----------|
| `TrophyRow` (riga 125) | Aggiungere `fill-amber-500` alle coppe |
| Lista partner (righe 320-329) | Rimuovere testo "No contatti" e icone contatto ridondanti |
| Header dettaglio (righe 440-507) | Compattare: nome+bandiera, citta+tipo+office su una riga, stelline+coppe su una riga, eliminare sezione contatti e badge "Primo contatto" |
| Bandiera (riga 443) | Bandiera grande accanto a citta'/paese |

### Risultato atteso
Header pulito su 3 righe: nome con bandiera, localita' e tipo, stelline e coppe piene. Nessun testo ridondante sui contatti nel header. La striscia laterale rossa/ambra/blu nella lista comunica gia' la qualita' contatto.
