
# Aggiunta campi credenziali WCA nella tab Scraping

## Situazione attuale
- Le credenziali WCA (`wca_username`, `wca_password`) sono gia' salvate nel database `app_settings`
- La edge function `get-wca-credentials` le legge gia' correttamente
- L'estensione Chrome e il flusso auto-login (`wca-auto-login`) usano gia' queste credenziali dal database
- Nessuna modifica necessaria all'estensione o alle edge function

## Modifica

### File: `src/components/settings/ScrapingSettings.tsx`

Aggiungere una Card in cima alla pagina con due campi:
- **Username WCA**: campo testo, pre-popolato dal database
- **Password WCA**: campo password, pre-popolato dal database
- Pulsante **Salva Credenziali** che scrive in `app_settings` con chiavi `wca_username` e `wca_password`
- Badge "Configurato" / "Non configurato" basato sulla presenza dei valori

I campi vengono letti e scritti tramite lo stesso meccanismo `useAppSettings` / `useUpdateSetting` gia' usato nel resto delle impostazioni.

Le credenziali attuali (`tmsrlmin` / `Wm8!o4EbZ1`) verranno mostrate automaticamente perche' gia' presenti nel database.

## Dettaglio tecnico

- Importare `Input` da `@/components/ui/input`
- Importare `Badge` e `CheckCircle2` per lo stato
- Usare `useAppSettings()` per leggere `wca_username` e `wca_password`
- Usare `useUpdateSetting()` per salvare
- Aggiungere stati locali `wcaUser` e `wcaPass` con `useState`
- Sincronizzare con `useEffect` al caricamento dei settings
- Nessuna modifica a edge function, estensione Chrome, o altri file
