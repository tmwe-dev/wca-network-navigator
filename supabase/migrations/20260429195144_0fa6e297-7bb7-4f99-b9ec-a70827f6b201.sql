UPDATE public.kb_entries
SET 
  title = 'Calligrafia — Standard di formattazione email (plain text)',
  is_active = true,
  priority = 100,
  category = 'calligrafia',
  content = $CAL$# Calligrafia — Standard di formattazione email (PLAIN TEXT)

Scopo: definire ESCLUSIVAMENTE la posizione e la formattazione visiva del testo email. Il contenuto, il tono e la strategia sono decisi altrove e non devono essere toccati qui.

## Formato output
- Il corpo email è PLAIN TEXT puro. Niente HTML, niente Markdown, niente tag, niente entità (<p>, <br>, &lt;, **, _, #, >, ecc.).
- Codifica UTF-8. Caratteri tipografici corretti: apostrofi curvi ’ se naturali, virgolette « » oppure “ ”, en-dash – per gli intervalli, em-dash — per gli incisi. Mai "--" o "->".
- Nessun emoji. Nessun TUTTO MAIUSCOLO per enfasi. Nessuna sottolineatura simulata con "===" o "---".

## Struttura
1. Saluto: una sola riga, seguita da una riga vuota. Esempi: "Gentile Sig. Rossi," oppure "Buongiorno Maria,".
2. Corpo: 2–4 paragrafi brevi, ciascuno separato dal successivo da UNA riga vuota (doppio newline). Mai più di una riga vuota consecutiva.
3. Chiusura: una riga di commiato ("Cordiali saluti," / "Un cordiale saluto," / "A presto,"), seguita da una riga vuota.
4. Firma: NON inserirla nel corpo. La aggiunge il sistema.

## Paragrafi
- Ogni paragrafo è un blocco continuo, senza a capo manuali interni. Il word-wrap lo gestisce il client email.
- Lunghezza paragrafo consigliata: 1–4 frasi, max ~60 parole.
- Niente rientri, niente tabulazioni, niente spazi multipli. Un solo spazio tra le parole. Nessuno spazio a inizio o fine riga.

## Elenchi (solo se davvero servono)
- Usa trattino + spazio: "- voce". Una voce per riga, nessuna riga vuota tra le voci.
- Una riga vuota PRIMA dell elenco e UNA dopo. Mai elenchi numerati "1." salvo sequenze ordinate reali.

## Link, email, telefoni
- Scrivili in chiaro: https://example.com, nome@example.com, +39 02 1234567. Nessuna parentesi quadra in stile Markdown.

## Punteggiatura
- Punto/virgola/due punti attaccati alla parola precedente, spazio dopo. Nessuno spazio prima di "," "." ";" ":" "?" "!".
- Mai puntini di sospensione "...": usa il singolo carattere … solo se necessario.

## Divieti assoluti
- Nessun tag HTML, nemmeno <br> o <p>.
- Nessun Markdown (**, *, _, #, backtick, >, |).
- Nessun placeholder tipo {{nome}}, [azienda], XXX, TBD.
- Nessuna firma manuale, nessun disclaimer, nessun blocco contatti nel corpo.
- Nessuna riga vuota a inizio o fine messaggio.

## Checklist finale (prima di restituire l output)
1. Solo testo: zero tag, zero Markdown, zero entità HTML.
2. Saluto su 1 riga + riga vuota.
3. Paragrafi separati da esattamente UNA riga vuota.
4. Chiusura su 1 riga + riga vuota.
5. Nessuna firma nel corpo.
6. Nessuno spazio doppio, nessun carriage return, nessun a capo orfano dentro un paragrafo.
$CAL$,
  updated_at = now()
WHERE id = '8676236e-c8e7-4a23-b2c3-bb1ee4b43848';