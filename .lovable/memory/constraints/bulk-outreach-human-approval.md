---
name: Bulk Outreach Human Approval
summary: Qualsiasi comunicazione bulk non invia mai direttamente; genera bozze e coda in uscita, poi richiede autorizzazione umana esplicita.
type: constraint
---
Qualsiasi operazione bulk di outreach/email/WhatsApp/LinkedIn deve fermarsi a bozza o coda in uscita.

Il sistema non deve mai inviare comunicazioni bulk direttamente dalla chat, dal canvas o da un agente AI.

Flusso obbligatorio:
1. Genera bozze personalizzate.
2. Mostra chiaramente che sono bozze/coda in uscita.
3. Accoda come elemento da confermare.
4. L'invio parte solo dopo autorizzazione esplicita del tutor/user/responsabile.

La UI e i messaggi AI devono dire esplicitamente: "messe in uscita / da autorizzare", non "procedo con l'invio" quando l'utente non ha ancora visto e confermato le bozze.
