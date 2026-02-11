

# Fix: Non mostrare i contatti rossi del server — aspettare l'estensione

## Problema
Alla riga 252 del pipeline, il canvas viene aggiornato con i contatti del server (che non hanno email/telefono) e vengono mostrati subito come **rossi**. Solo dopo, l'estensione li sovrascrive con i dati reali. L'utente vede un flash di badge rossi inutile e confuso.

## Soluzione

Separare i dati del partner (nome, città, servizi, network) dai contatti. Mostrare subito i dati aziendali ma **nascondere i contatti** fino a quando l'estensione non ha finito il suo lavoro.

### Modifica in `AcquisizionePartner.tsx`

1. **Alla riga 252**: impostare il canvas con `contacts: []` e `contactSource: "none"` — cioè non mostrare nessun contatto dal server
2. I contatti verranno popolati SOLO dopo Phase 1.5 (estensione + fallback DB)
3. Se l'estensione non è disponibile, ALLORA mostrare i contatti del server come fallback finale

In pratica:
- Canvas iniziale: tutti i dati aziendali visibili, sezione contatti vuota (nessun badge rosso)
- Fase "Contatti Privati": l'indicatore mostra che sta lavorando
- Dopo estensione/fallback DB: i contatti appaiono con i colori corretti
- Solo se l'estensione NON è installata: mostrare i contatti del server (che saranno rossi, ma almeno è un dato reale e non un falso negativo)

### Modifica in `PartnerCanvas.tsx`

Nella sezione contatti, durante la fase `extracting`, mostrare un piccolo indicatore "Estrazione contatti in corso..." al posto dei badge rossi vuoti, così l'utente capisce che il sistema sta lavorando.

## Risultato

- Zero badge rossi falsi
- I contatti appaiono una sola volta con il colore corretto
- Feedback visivo chiaro durante l'estrazione
