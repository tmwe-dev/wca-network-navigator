

## Piano: Status circuito di attesa e contatore interazioni ben visibili nella card

### Problema attuale

L'indicatore del circuito di attesa (`HoldingPatternIndicator` compact) è relegato nell'angolo destro come elemento secondario — poco visibile. Il numero di interazioni (`interaction_count`) non è mostrato affatto nella card.

### Modifiche in `src/components/contacts/ContactListPanel.tsx`

**1. Spostare lo status in una riga dedicata in basso nella card**

Invece di metterlo nell'angolo destro come elemento accessorio, creare una riga finale nella card con:
- A sinistra: `HoldingPatternIndicator` compact (i 5 pallini colorati dello status)
- A destra: contatore interazioni con icona e numero (es. `💬 3` o icona `MessageCircle` + numero)

**2. Contatore interazioni**

Leggere `c.interaction_count` e mostrarlo come badge/chip:
- Se `interaction_count > 0`: badge colorato (es. `bg-chart-3/20 text-chart-3`) con icona + numero
- Se `interaction_count === 0`: nessun badge (o badge grigio tenue "0")

**3. Layout card risultante**

```text
☑ 🏢 ACME LOGISTICS              ⚠
  👤 Mario Rossi • Sales Manager
  📍 Milano, 20100  | 🏷️ Cosmoprof
  ✉ mario@acme.it  📱 WA  ☎ +39...
  ⚪🔵⚪⚪⚪  (holding pattern)   💬 3
```

La riga finale con status + interazioni sarà separata da un sottile bordo superiore (`border-t border-border/50 pt-1 mt-1`) per darle risalto visivo.

### File da modificare

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactListPanel.tsx` | Spostare `HoldingPatternIndicator` dalla colonna destra a una riga finale; aggiungere contatore interazioni accanto |

