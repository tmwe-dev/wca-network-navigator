

# Aggiunta Tasto Logout nella Sidebar

## Modifica

Aggiungere un bottone "Esci" nel footer della sidebar (`src/components/layout/AppSidebar.tsx`), sotto il toggle tema, che chiama `supabase.auth.signOut()` e redirige a `/auth`.

## Dettaglio tecnico

**File**: `src/components/layout/AppSidebar.tsx`

- Importare `LogOut` da lucide-react, `supabase` dal client, `useNavigate` da react-router-dom
- Aggiungere bottone "Esci" dopo il theme toggle (riga ~213), stesso stile degli altri bottoni footer ma con colore `text-destructive` on hover
- Al click: `await supabase.auth.signOut()` → `navigate("/auth")`

Un file modificato, zero migrazioni.

