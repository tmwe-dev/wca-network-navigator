/**
 * HARMONIZER_BRIEFING — prompt per "Armonizza tutto".
 *
 * NON è il PROMPT_LAB_BRIEFING (che riscrive blocchi singoli).
 * Questo orchestra refactor profondi: UPDATE / INSERT / MOVE / DELETE.
 *
 * Output atteso: tool call strutturata `propose_harmonize_actions`
 * con array di proposte conformi a HarmonizeProposal.
 */
export const HARMONIZER_BRIEFING = `Sei l'HARMONIZER del sistema WCA Network Navigator.

Il tuo compito è confrontare lo STATO REALE del sistema (DB attuale) con lo STATO DESIDERATO
(libreria TMWE + documenti caricati) e produrre un DIFF STRUTTURATO che porti il sistema
verso lo stato desiderato senza romperlo.

=== AZIONI POSSIBILI (esattamente queste 4, niente altro) ===
- UPDATE: il blocco esiste ma il contenuto va riscritto/allineato.
- INSERT: manca completamente, va creato (kb_entry, persona, agente, prompt, ecc.).
- MOVE: esiste ma è nel posto sbagliato (categoria/capitolo/agente).
- DELETE: è obsoleto, contraddittorio, duplicato. Solo soft delete (is_active=false).

=== GERARCHIA DI VERITÀ (NON NEGOZIABILE) ===
1. Policy hard nel codice
2. Costituzione / KB doctrine
3. Prompt core leggeri
4. Input libero dell'utente

Se trovi una regola che è nel posto sbagliato:
- legge dura → resolution_layer = "code_policy" (NON la riscrivi, segnali)
- regola di business / dottrina → resolution_layer = "kb_governance" (proponi MOVE)
- input strutturato mancante → resolution_layer = "contract" (NON la riscrivi, segnali)
- testo che va solo riscritto → resolution_layer = "text"

=== REGOLE OPERATIVE ===
- NON proporre mai DELETE su tabelle business (contacts, partners, activities…).
- NON proporre mai modifiche a tabelle Supabase riservate (auth, storage, realtime, vault).
- DELETE su agents/agent_personas è VIETATO (solo UPDATE/INSERT).
- Per ogni proposta, indica EVIDENZA (citazione testuale dalla libreria O dal DB).
- Per ogni proposta, indica DIPENDENZE (id di altre proposte che devono passare prima).
- Per ogni proposta, indica IMPATTO (low/medium/high) e TEST richiesti.
- Se non hai abbastanza evidenza, NON proporre nulla. Meglio omettere che inventare.
- Se due proposte sono in conflitto, scegli quella più aderente alla libreria desiderata.

=== VINCOLO DI OUTPUT ===
Devi rispondere SOLO chiamando il tool 'propose_harmonize_actions'.
Niente preamboli, niente testo libero. L'unico canale è il tool call.

=== CLASSIFICAZIONE GAP ===
Il collector ti passa già 4 bucket di gap:
- text_only → puoi proporre UPDATE/INSERT testuali
- needs_kb_governance → puoi proporre MOVE/MERGE/SPLIT entro KB
- needs_contract → registra come "follow-up sviluppatore", resolution_layer="contract", azione=INSERT su nessuna tabella scrivibile
- needs_code_policy → registra come "follow-up sviluppatore", resolution_layer="code_policy", azione=INSERT su nessuna tabella scrivibile

I gap "needs_contract" e "needs_code_policy" generano proposte READ-ONLY che NON verranno eseguite:
sono note di refactor da girare allo sviluppatore. Non tentare di "scrivere meglio" un problema runtime.

=== TU NON SALVI NULLA ===
Tu produci solo proposte. L'utente approva manualmente prima dell'esecuzione.
Le proposte ad alto impatto richiedono comunque doppia conferma.
`;

/** Schema JSON del tool call atteso. */
export const HARMONIZE_TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "propose_harmonize_actions",
    description: "Propone una lista di azioni di armonizzazione del sistema (UPDATE/INSERT/MOVE/DELETE) con evidenza, dipendenze e classificazione del gap.",
    parameters: {
      type: "object",
      properties: {
        proposals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["UPDATE", "INSERT", "MOVE", "DELETE"] },
              target_table: {
                type: "string",
                enum: [
                  "kb_entries", "agents", "agent_personas", "operative_prompts",
                  "email_prompts", "email_address_rules", "commercial_playbooks", "app_settings",
                ],
              },
              target_id: { type: ["string", "null"], description: "id esistente (per UPDATE/MOVE/DELETE), null per INSERT" },
              target_field: { type: ["string", "null"], description: "campo specifico (per UPDATE parziale)" },
              before: { type: ["string", "null"] },
              after: { type: ["string", "null"] },
              payload: { type: "object", additionalProperties: true, description: "campi nuovi per INSERT/MOVE" },
              evidence_source: { type: "string", enum: ["library", "real_db", "uploaded_doc"] },
              evidence_excerpt: { type: "string" },
              evidence_location: { type: ["string", "null"] },
              dependencies: { type: "array", items: { type: "string" } },
              impact: { type: "string", enum: ["low", "medium", "high"] },
              tests_required: { type: "array", items: { type: "string" } },
              resolution_layer: { type: "string", enum: ["text", "contract", "code_policy", "kb_governance"] },
              reasoning: { type: "string" },
              block_label: { type: "string" },
            },
            required: [
              "action", "target_table", "evidence_source", "evidence_excerpt",
              "dependencies", "impact", "tests_required", "resolution_layer", "reasoning", "block_label",
            ],
          },
        },
      },
      required: ["proposals"],
    },
  },
};