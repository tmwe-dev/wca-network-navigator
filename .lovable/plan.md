
# Aggiunta Partner Hub alla sidebar

Modifica semplice: aggiungere una voce "Partner Hub" nell'array `navItems` in `AppSidebar.tsx`, posizionata tra "Operations" e "Campaigns".

## Dettagli

- **Icona**: `Users` da lucide-react (rappresenta la gestione partner)
- **URL**: `/partner-hub` (route gia esistente)
- **Posizione**: seconda voce, subito dopo Operations

### File modificato

**`src/components/layout/AppSidebar.tsx`**:
- Aggiungere import `Users` da lucide-react
- Inserire `{ title: "Partner Hub", url: "/partner-hub", icon: Users }` come seconda voce nell'array `navItems`

L'ordine finale della sidebar sara:
1. Operations
2. Partner Hub
3. Campaigns
4. Email
5. Workspace
6. Prospect Center
7. Agenda
8. Impostazioni
9. Guida
