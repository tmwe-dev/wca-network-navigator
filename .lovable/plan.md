

# Piano: Avatar Gianfranco + Fix Build Error

## 1. Aggiungere avatar Gianfranco
- Copiare `user-uploads://gian_avatat.png` in `src/assets/agents/avatar-gianfranco.png`
- Aggiornare `src/data/agentAvatars.ts`:
  - Aggiungere import `avatarGianfranco`
  - Aggiungere entry nell'array `AGENT_AVATARS`: `{ id: "gianfranco", src: avatarGianfranco, label: "Gianfranco", gender: "male" }`
  - Aggiungere mapping in `NAME_AVATAR_MAP`: `gianfranco: "gianfranco"`

## 2. Fix build error Edge Function
**File**: `supabase/functions/buy-credits/index.ts` riga 3
- Cambiare `import { createClient } from "npm:@supabase/supabase-js@2.57.2"` in `import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"` (formato esm.sh standard usato dalle altre Edge Functions)

## File coinvolti
| File | Azione |
|------|--------|
| `src/assets/agents/avatar-gianfranco.png` | Nuovo file (copia immagine) |
| `src/data/agentAvatars.ts` | Import + array + mapping |
| `supabase/functions/buy-credits/index.ts` | Fix import Supabase |

