---
name: V3 perimetro a 6 sezioni
description: Navigazione V3 limitata a Contatti, Messaggi, Da fare, Command, Tracciamento, Impostazioni; maschere secondarie solo dal Laboratorio
type: feature
---
La barra laterale V3 mostra solo 6 sezioni, definite in `src/v3/app/navigation.ts`:
Contatti · Messaggi (Inbox, Scrivi, Canali) · Da fare · Command · Tracciamento (Andamento, Registro) · Impostazioni (Impostazioni, Operatori, Laboratorio).

- «Da fare» = `/v3/da-fare`, maschera unica che monta Approvazioni, Agenda e Coda (parametro `?sezione=`). Le rotte singole restano valide: lo sfoltimento è di sola navigazione, reversibile.
- Le maschere V3 fuori dal perimetro (regole, classificazione, modelli, campagne, pipeline, import, duplicati, cestino, galassie) sono calcolate da `V3_PAGINE_SECONDARIE` e compaiono nel Laboratorio, non nel menu.
- Aggiungere una voce al menu significa modificare `navigation.ts`, non il contratto di pagina.
