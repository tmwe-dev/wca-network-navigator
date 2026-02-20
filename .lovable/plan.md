
# Aggiunta Campi Credenziali WCA nella Pagina Impostazioni

## Problema

La tab WCA in Impostazioni mostra solo:
- Pulsante scarica estensione Chrome
- Pulsante verifica sessione
- Campo cookie manuale (nascosto nelle opzioni avanzate)

Mancano completamente i **campi username e password WCA**, che sono necessari per il sistema di auto-login automatico. Senza di questi, l'app non sa con quali credenziali autenticarsi e il flusso di download si blocca.

I campi esistono nel database (`app_settings` con chiavi `wca_username` e `wca_password`) e vengono già letti dalla edge function `get-wca-credentials`, ma non c'è nessun form nell'interfaccia per inserirli.

## Soluzione

Aggiungere una card "Credenziali WCA" nella tab WCA di `Settings.tsx`, **subito sopra** la card dell'estensione Chrome.

La card conterrà:
- Campo **Username WCA**
- Campo **Password WCA** (con toggle mostra/nascondi)
- Badge stato (Configurato / Non configurato)
- Pulsante **Salva Credenziali**

I valori vengono letti da `app_settings` (già disponibili tramite `useAppSettings`) e salvati con `useUpdateSetting`.

## Struttura della nuova card

```
┌─────────────────────────────────────────────────────┐
│  🔑 Credenziali Auto-Login          [✓ Configurato] │
│  Username e password per il login automatico WCA     │
├─────────────────────────────────────────────────────┤
│  Username WCA                                        │
│  [________________________]                          │
│                                                      │
│  Password WCA                                   [👁]  │
│  [________________________]                          │
│                                                      │
│  [Salva Credenziali]                                 │
└─────────────────────────────────────────────────────┘
```

## File da modificare

| File | Modifica |
|------|---------|
| `src/pages/Settings.tsx` | Aggiungere state per `wcaUser`/`wcaPass`, `useEffect` che li legge da `settings`, e la card con i campi form nella tab WCA |

## Dettagli tecnici

- Aggiungere `useState` per `wcaUser`, `wcaPass`, `showWcaPass`, `savingWcaCreds`
- Aggiungere `useEffect` che popola i campi quando `settings` è disponibile (chiavi `wca_username` e `wca_password`)
- Aggiungere handler `handleSaveWcaCreds` che chiama `updateSetting.mutateAsync` per entrambe le chiavi
- Posizionare la nuova card come **prima card** nella tab WCA, prima del blocco estensione Chrome
- Importare `KeyRound`, `Eye`, `EyeOff` da `lucide-react` (già installato)

Nessuna modifica al database o alle Edge Functions necessaria — la struttura dei dati è già pronta.
