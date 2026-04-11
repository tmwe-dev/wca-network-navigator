

## Piano: Archiviazione dei 4 Volumi nel Diario di Bordo del Progetto

### Obiettivo
Salvare i 4 documenti in formato Markdown nella cartella `docs/metodo/` e aggiornare il README come indice della bibbia metodologica v2.0. La v1.0 (codebase attuale) resta intatta — il freeze è confermato.

### Cosa verrà fatto

**1. Copiare i 4 .docx originali in `docs/metodo/`**
- `Volume_I_Il_Protocollo_del_Recupero-2.docx` → sovrascrive il vecchio (seconda edizione)
- `Volume_II_Il_Metodo_Enterprise-2.docx` → sovrascrive il vecchio (seconda edizione)
- `Volume_3_-_software_perfect.docx` → nuovo
- `volume_4_-_Manuale_Avanzato_Multi_Agente.docx` → nuovo

**2. Creare/aggiornare i file .md leggibili**
- `Volume_I_Il_Protocollo_del_Recupero.md` → aggiornato con la 2a edizione completa (21 pagine, 13 capitoli)
- `Volume_II_Il_Metodo_Enterprise.md` → aggiornato con la 2a edizione completa (32 pagine, 17 capitoli)
- `Volume_III_Software_Perfetto.md` → nuovo (3 pagine, 5 sezioni: TACO, best practices, Perfection Matrix, flusso disaccoppiamento)
- `Volume_IV_Manuale_Avanzato_Multi_Agente.md` → nuovo (21 pagine, 12 capitoli: resilienza, consenso, versionamento, osservabilità, sicurezza, event bus)

**3. Aggiornare `docs/metodo/README.md`**
- Dichiarare esplicitamente che i 4 volumi sono la guida per la v2.0
- Aggiungere Vol. III e Vol. IV all'indice
- Aggiungere sezione "v1.0 vs v2.0" che chiarisce: la v1.0 è il codice attuale (freeze), la v2.0 sarà ricostruita da zero seguendo i 4 volumi
- Aggiornare le citazioni chiave con i nuovi concetti (Perfection Matrix, Circuit Breaker, Convergenza L1/L2/L3, event bus, Atomic Design core/io/bridge)

**4. Rimuovere il vecchio `Documento_2_Software_Perfetto_da_Zero_con_AI.md`**
- Il suo contenuto è stato superato dai Vol. II e Vol. III (seconda edizione)

### Cosa NON verrà fatto
- Nessuna modifica al codice sorgente
- Nessuna nuova feature, pagina, tabella o edge function
- Il freeze resta attivo

### Struttura finale di `docs/metodo/`
```text
docs/metodo/
├── README.md                                    (indice aggiornato v2.0)
├── Volume_I_Il_Protocollo_del_Recupero.md       (2a ed.)
├── Volume_I_Il_Protocollo_del_Recupero-2.docx   (originale)
├── Volume_II_Il_Metodo_Enterprise.md            (2a ed.)
├── Volume_II_Il_Metodo_Enterprise-2.docx        (originale)
├── Volume_III_Software_Perfetto.md              (nuovo)
├── Volume_3_-_software_perfect.docx             (originale)
├── Volume_IV_Manuale_Avanzato_Multi_Agente.md   (nuovo)
├── volume_4_-_Manuale_Avanzato_Multi_Agente.docx (originale)
└── baseline-2026-04-08.md                       (invariato)
```

