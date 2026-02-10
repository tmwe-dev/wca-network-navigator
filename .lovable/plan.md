

# Bookmarklet per Cattura Cookie con Un Click

## Cosa cambia per te
Invece di aprire la console del browser (F12), trascinare un link nella barra dei preferiti. Quando sei su wcaworld.com, clicchi il bookmark e il cookie viene catturato automaticamente. Un click, zero console.

## Come funzionera'
1. Nella pagina WCA dell'app, trovi un bottone/link trascinabile "Cattura WCA"
2. Lo trascini nella barra dei preferiti del browser (una volta sola)
3. Quando sei loggato su wcaworld.com, clicchi il bookmark
4. Appare un alert "Cookie salvato!" -- fatto

## Modifiche tecniche

### 1. Aggiornamento pagina WCA (`src/pages/WCA.tsx`)
- Aggiungere un link con `href="javascript:..."` contenente lo snippet fetch (il bookmarklet)
- Istruzioni visive chiare: "Trascina questo bottone nella barra dei preferiti"
- Mantenere il fallback console/manuale per chi preferisce
- Rimuovere il testo tecnico confuso, sostituire con istruzioni numerate semplici

### 2. Il bookmarklet (codice nel link)
Il contenuto del bookmarklet sara' essenzialmente lo stesso snippet gia' funzionante, wrappato in un formato `javascript:void(...)`:

```text
javascript:void(fetch('https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message)))
```

### 3. Semplificazione UI della pagina WCA
- Sezione primaria: il bookmarklet drag-and-drop con istruzioni visive
- Sezione secondaria (collassabile): metodo console manuale come fallback
- Sezione terziaria (collassabile): inserimento cookie manuale come ultimo fallback
- Bottone "Verifica Sessione" sempre visibile

### 4. Nessuna modifica backend
Le edge functions `save-wca-cookie` e `check-wca-session` restano identiche -- il bookmarklet chiama lo stesso endpoint.

## Limiti da conoscere
- Il bookmarklet funziona solo se sei gia' loggato su wcaworld.com
- Quando il cookie scade (ogni pochi giorni), devi cliccare di nuovo il bookmark su wcaworld.com
- Alcuni browser (Safari mobile) non supportano i bookmarklet, ma su desktop funziona ovunque

