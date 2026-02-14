
# Piano: Visualizzare gli Alias nei Componenti Partner e Job

## Panoramica

Mostrare gli alias (azienda e contatto) accanto ai nomi originali, con uno stile visivo distinto che indica che il lavoro di generazione e' stato completato. Se l'alias non e' presente, non viene mostrato nulla di aggiuntivo.

## Dove appaiono gli alias

### 1. Operations Center - Lista Partner (PartnerListPanel.tsx)

Nella riga di ogni partner nella lista, accanto al nome azienda (riga 233), aggiungere l'alias azienda con un badge colorato:

```text
Milano
Procter & Gamble SPA  [Procter & Gamble]  <-- badge verde/teal
```

L'alias appare come un piccolo tag con sfondo `emerald/teal` che indica "nome pronto per l'uso nelle email".

### 2. Operations Center - Dettaglio Partner (PartnerListPanel.tsx, PartnerDetail)

Nell'header del dettaglio (riga 315), accanto al nome azienda, mostrare l'alias con sfondo diverso:

```text
← Procter & Gamble SPA  [Procter & Gamble]
```

Nella sezione contatti (riga 363), accanto al nome del contatto, mostrare l'alias contatto:

```text
👤 Mr. Filippo Rossini  [Rossini]  Primary
```

Anche qui badge con sfondo `violet/purple` per distinguere l'alias persona dall'alias azienda.

### 3. Campaign Jobs - Lista Contatti (JobList.tsx)

Nella riga di ogni contatto (riga 181), accanto al nome, mostrare l'alias contatto:

```text
☑ Mr. Filippo Rossini  [Rossini]  · CEO
```

### 4. PartnerCard.tsx (opzionale)

Nella card partner (usata in altre viste), mostrare l'alias azienda accanto al nome nella riga del link.

## Stile visivo

- **Alias azienda**: badge con sfondo `bg-teal-100 text-teal-700` (light) / `bg-teal-900/30 text-teal-400` (dark), font size `text-[10px]`
- **Alias contatto**: badge con sfondo `bg-violet-100 text-violet-700` (light) / `bg-violet-900/30 text-violet-400` (dark), font size `text-[10px]`
- Entrambi con bordo arrotondato (`rounded`), padding compatto (`px-1.5 py-0.5`)
- Appaiono solo se il campo alias e' valorizzato (non null/vuoto)

## Dettaglio tecnico -- File da modificare

### `src/components/operations/PartnerListPanel.tsx`

**Lista partner (riga ~233)**: dopo `{partner.company_name}`, aggiungere condizionale:
```
{partner.company_alias && <span className="...alias-badge...">{partner.company_alias}</span>}
```

**Dettaglio header (riga ~315)**: dopo il titolo h2 con `partner.company_name`, aggiungere l'alias azienda.

**Contatti (riga ~363)**: dopo `{c.name}`, aggiungere:
```
{c.contact_alias && <span className="...alias-badge...">{c.contact_alias}</span>}
```

### `src/components/campaigns/JobList.tsx`

**Riga contatto (riga ~181)**: dopo `{contact.name}`, aggiungere l'alias contatto se presente.

### `src/components/partners/PartnerCard.tsx`

**Nome azienda (riga ~101)**: dopo il Link con `partner.company_name`, aggiungere l'alias azienda.

### Nessuna migrazione necessaria

Le colonne `company_alias` e `contact_alias` esistono gia' nel database. I dati sono gia' caricati dalle query esistenti (`usePartners`, `usePartner`).
