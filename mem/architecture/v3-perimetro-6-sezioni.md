---
name: V3 perimetro a 6 sezioni
description: Navigazione V3 limitata a Contatti, Messaggi, Da fare, Command, Tracciamento, Impostazioni; le maschere fuori perimetro non esistono più in V3 e rimandano alla V2
type: feature
---
La barra laterale V3 mostra solo 6 sezioni, definite in `src/v3/app/navigation.ts`:
Contatti · Messaggi (Inbox, Scrivi, Canali) · Da fare · Command · Tracciamento (Andamento, Registro) · Impostazioni (Impostazioni, Operatori, Laboratorio).

- «Da fare» = `/v3/da-fare`, maschera unica che monta Approvazioni, Agenda e Coda (parametro `?sezione=`).
- Fuori perimetro (rimosse dalla V3, non riscritte): Import, Duplicati, Cestino, Qualità classificazione, Modelli, Campagne, Pipeline. I vecchi percorsi `/v3/...` sono dichiarati in `V3_RINVII_V2` (pageContract) e rimandano alla superficie V2; il Laboratorio li elenca nel gruppo «Fuori dal perimetro V3».
- Restano in V3 perché portanti del ciclo commerciale: contatti, messaggi multicanale, **Regole e gruppi** (catalogazione indirizzi e filtri), Scrivi, Approvazioni, Coda, Agenda, Tracciamento, Command, circuito di attesa.
- Le due galassie restano: sono lo strumento di controllo dello stato del sistema.
