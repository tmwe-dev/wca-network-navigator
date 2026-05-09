## Piano di fix WhatsApp

### Obiettivo
Eliminare la ricerca manuale nella maschera test e rendere il pulsante “Invia WhatsApp” utilizzabile subito con un destinatario stabile.

### Cosa modifico
1. **Maschera `WhatsAppTest`**
   - All’avvio carica automaticamente l’ultimo numero WhatsApp valido usato nei test.
   - Se non esiste in memoria locale, recupera l’ultimo invio WhatsApp registrato nelle attività recenti.
   - Se trova un numero valido, compila subito il campo destinatario e abilita il pulsante.
   - Mantiene la ricerca DB solo come fallback, non più come passaggio obbligatorio.

2. **Persistenza ultimo destinatario**
   - Dopo ogni invio riuscito salva localmente:
     - numero normalizzato
     - nome/azienda se disponibili
     - timestamp
   - Al reset non cancella per forza il “default test”, ma solo la sessione corrente; aggiungo un comando separato se serve svuotare tutto.

3. **Invio WhatsApp più robusto**
   - Il test userà sempre il numero normalizzato in formato diretto `+E164`.
   - Il messaggio di test non resta bloccato se il contatto selezionato non ha telefono: userà il destinatario fisso/ultimo valido.
   - Il bottone mostrerà chiaramente il numero effettivo usato.

4. **Verifica completa**
   - Ping estensione.
   - Verifica sessione WhatsApp Web.
   - Invio reale tramite bridge `sendWhatsApp`.
   - Controllo risposta dell’estensione e logging chiaro nel terminale della maschera.
   - Se fallisce lato estensione, il terminale mostrerà esattamente quale fase è fallita.

### File coinvolti
- `src/components/test-extensions/WhatsAppTest.tsx`
- `src/data/whatsappTestLookup.ts` solo se serve aggiungere una funzione DAL read-only per recuperare l’ultimo numero WhatsApp dalle attività.

### Vincoli
- Modifica minima e locale.
- Nessun refactor opportunistico.
- Nessun invio duplicato.
- Nessuna modifica a pipeline email, auth, edge function o orchestratori AI.