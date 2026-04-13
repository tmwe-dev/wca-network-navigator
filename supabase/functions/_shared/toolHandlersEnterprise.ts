/**
 * Enterprise tool handlers: KB, workflows, playbooks, memory, plans.
 * Extracted from ai-assistant/index.ts for maintainability.
 */

import { escapeLike } from "./sqlEscape.ts";

type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient>;

// ── Local interfaces for JSON fields ──
interface WorkPlanStep {
  index?: number;
  title?: string;
  description?: string;
  status?: string;
  tool?: string;
  args?: Record<string, unknown>;
  args_template?: Record<string, unknown>;
  completed_at?: string;
  result?: unknown;
}

interface WorkflowGate {
  name?: string;
  objective?: string;
  exit_criteria?: string[];
  suggested_tools?: string[];
}

interface PlaybookTriggerConditions {
  country_codes?: string[];
  lead_status?: string[];
}

// Variable declared at module scope, set by executeSearchKb closure
let userId = "";

export function createEnterpriseHandlers(supabase: SupabaseClient) {

  async function executeSaveMemory(args: Record<string, unknown>, _userId: string) {
    const importance = Math.min(5, Math.max(1, Number(args.importance) || 3));
    const level = importance >= 4 ? 2 : 1;
    const confidence = level === 2 ? 0.6 : 0.5;
    const decayRate = level === 2 ? 0.005 : 0.02;
    const { data, error } = await supabase.from("ai_memory").insert({
      user_id: _userId, content: String(args.content),
      memory_type: String(args.memory_type || "fact"),
      tags: Array.isArray(args.tags) ? args.tags as string[] : [],
      importance, level, confidence, decay_rate: decayRate, source: "user_explicit",
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, memory_id: data.id, level, message: `Ricordo salvato (L${level}, importanza ${importance}).` };
  }

  async function executeSearchMemory(args: Record<string, unknown>, _userId: string) {
    let query = supabase.from("ai_memory")
      .select("id, content, memory_type, tags, importance, level, confidence, created_at")
      .eq("user_id", _userId)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("importance", { ascending: false })
      .limit(Number(args.limit) || 10);
    if (args.tags && Array.isArray(args.tags)) query = query.overlaps("tags", args.tags as string[]);
    if (args.memory_type) query = query.eq("memory_type", args.memory_type);
    if (args.query) query = query.ilike("content", `%${escapeLike(args.query)}%`);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { count: data?.length || 0, memories: data || [] };
  }

  async function executeCreateWorkPlan(args: Record<string, unknown>, _userId: string) {
    const rawSteps = (args.steps as WorkPlanStep[]) || [];
    const { data, error } = await supabase.from("ai_work_plans").insert({
      user_id: _userId, title: String(args.title),
      description: args.description ? String(args.description) : null,
      steps: rawSteps.map((s: WorkPlanStep, i: number) => ({ ...s, index: i, status: "pending" })),
      tags: Array.isArray(args.tags) ? args.tags as string[] : [],
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, plan_id: data.id, steps_count: rawSteps.length, message: `Piano "${args.title}" creato con ${rawSteps.length} step.` };
  }

  async function executeExecutePlanStep(args: Record<string, unknown>, _userId: string, _authHeader?: string) {
    const { data: plan, error: fetchErr } = await supabase.from("ai_work_plans")
      .select("*").eq("id", args.plan_id).eq("user_id", _userId).single();
    if (fetchErr || !plan) return { error: "Piano non trovato" };
    const steps = plan.steps as WorkPlanStep[];
    const stepIndex = plan.current_step as number;
    if (stepIndex >= steps.length) return { error: "Tutti gli step sono completati", plan_completed: true };
    const step = steps[stepIndex];
    let stepResult: unknown = null;
    if (step.tool && typeof step.tool === "string") {
      stepResult = { note: `Tool "${step.tool}" da eseguire con args: ${JSON.stringify(step.args || {})}` };
    }
    steps[stepIndex] = { ...step, status: "completed", completed_at: new Date().toISOString(), result: stepResult };
    const nextStep = stepIndex + 1;
    const isCompleted = nextStep >= steps.length;
    await supabase.from("ai_work_plans").update({
      steps, current_step: nextStep,
      status: isCompleted ? "completed" : "running",
      ...(isCompleted ? { completed_at: new Date().toISOString() } : {}),
    }).eq("id", plan.id);
    return {
      success: true, step_index: stepIndex, step_description: step.description,
      step_result: stepResult, next_step: isCompleted ? null : steps[nextStep],
      plan_completed: isCompleted,
      message: isCompleted ? `Piano completato! Tutti ${steps.length} step eseguiti.` : `Step ${stepIndex + 1}/${steps.length} completato. Prossimo: ${steps[nextStep]?.description}`,
    };
  }

  async function executeGetActivePlans(_userId: string) {
    const { data, error } = await supabase.from("ai_work_plans")
      .select("id, title, status, current_step, steps, tags, created_at")
      .eq("user_id", _userId).in("status", ["running", "paused"]).limit(10);
    if (error) return { error: error.message };
    return {
      count: data?.length || 0,
      plans: (data || []).map((p: { id: string; title: string; status: string; current_step: number; steps: unknown; tags: string[] }) => ({
        id: p.id, title: p.title, status: p.status,
        progress: `${p.current_step}/${(p.steps as WorkPlanStep[]).length}`,
        next_step: (p.steps as WorkPlanStep[])[p.current_step]?.description || null,
        tags: p.tags,
      })),
    };
  }

  async function executeSaveAsTemplate(args: Record<string, unknown>, _userId: string) {
    const { data: plan } = await supabase.from("ai_work_plans")
      .select("title, description, steps, tags").eq("id", args.plan_id).eq("user_id", _userId).single();
    if (!plan) return { error: "Piano non trovato" };
    const planSteps = plan.steps as WorkPlanStep[];
    const { data, error } = await supabase.from("ai_plan_templates").insert({
      user_id: _userId, name: args.name ? String(args.name) : plan.title,
      description: args.description ? String(args.description) : plan.description,
      steps_template: planSteps.map((s: WorkPlanStep) => ({ description: s.description, tool: s.tool, args_template: s.args })),
      tags: plan.tags || [],
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, template_id: data.id, message: `Template "${args.name || plan.title}" salvato.` };
  }

  async function executeSearchTemplates(args: Record<string, unknown>, _userId: string) {
    let query = supabase.from("ai_plan_templates")
      .select("id, name, description, steps_template, tags, use_count")
      .eq("user_id", _userId).order("use_count", { ascending: false }).limit(10);
    if (args.tags && Array.isArray(args.tags)) query = query.overlaps("tags", args.tags as string[]);
    if (args.search) query = query.ilike("name", `%${escapeLike(args.search)}%`);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { count: data?.length || 0, templates: data || [] };
  }

  function executeUiAction(args: Record<string, unknown>) {
    return { ui_action: { type: args.action_type, payload: args.payload || {} }, message: `Azione UI: ${args.action_type}` };
  }

  async function executeSearchKb(args: Record<string, unknown>) {
    const query = String(args.query || "").trim();
    if (!query) return { error: "query è obbligatoria" };
    const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 20);
    const categories = Array.isArray(args.categories) ? (args.categories as string[]) : undefined;
    try {
      const { ragSearchKb } = await import("./embeddings.ts");
      const matches = await ragSearchKb(supabase, query, {
        matchCount: limit, matchThreshold: 0.2, categories, onlyActive: true,
      });
      if (matches.length === 0) {
        const { data } = await supabase.from("kb_entries")
          .select("id, title, content, category, chapter, tags, priority")
          .eq("is_active", true).eq("user_id", userId).ilike("content", `%${escapeLike(query)}%`)
          .order("priority", { ascending: false }).limit(limit);
        return { matches: data || [], method: "fallback_text" };
      }
      return {
        matches: matches.map((m: { id: string; title: string; content: string; category: string; chapter: string; tags: string[]; similarity: number }) => ({
          id: m.id, title: m.title, content: m.content.slice(0, 800),
          category: m.category, chapter: m.chapter, tags: m.tags,
          similarity: Number(m.similarity.toFixed(3)),
        })),
        method: "rag_semantic",
      };
    } catch (e) {
      console.error("search_kb error:", e);
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  }

  async function executeSaveKbRule(args: Record<string, unknown>, _userId: string) {
    const title = String(args.title || "").trim();
    const content = String(args.content || "").trim();
    const category = String(args.category || "").trim();
    if (!title || !content || !category) return { error: "title, content, category obbligatori" };
    const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
    const priority = Math.min(Math.max(Number(args.priority) || 5, 1), 10);
    const chapter = args.chapter ? String(args.chapter) : null;
    const { data, error } = await supabase.from("kb_entries").insert({
      user_id: _userId, title, content, category, tags, priority, chapter: chapter || "", is_active: true,
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, rule_id: data?.id, message: `Regola "${title}" salvata in KB (categoria=${category}, priority=${priority})`, needs_embedding: true };
  }

  async function executeSaveOperativePrompt(args: Record<string, unknown>, _userId: string) {
    const name = String(args.name || "").trim();
    const objective = String(args.objective || "").trim();
    const procedure = String(args.procedure || "").trim();
    const criteria = String(args.criteria || "").trim();
    if (!name || !objective || !procedure || !criteria) return { error: "name, objective, procedure, criteria obbligatori" };
    const priority = Math.min(Math.max(Number(args.priority) || 7, 1), 10);
    const { data, error } = await supabase.from("operative_prompts").insert({
      user_id: _userId, name, objective, procedure, criteria, priority, is_active: true,
    }).select("id").single();
    if (error) return { error: error.message };
    return { success: true, prompt_id: data?.id, message: `Prompt operativo "${name}" salvato (priority=${priority}).` };
  }

  async function executeListWorkflows(args: Record<string, unknown>, _userId: string) {
    const partnerId = args.partner_id ? String(args.partner_id) : null;
    const templatesOnly = args.templates_only === true;
    if (partnerId && !templatesOnly) {
      const { data: state } = await supabase.from("partner_workflow_state")
        .select("id, current_gate, status, started_at, notes, commercial_workflows(code, name, description, gates)")
        .eq("user_id", _userId).eq("partner_id", partnerId).order("started_at", { ascending: false });
      return { partner_id: partnerId, states: state || [] };
    }
    const { data: workflows } = await supabase.from("commercial_workflows")
      .select("id, code, name, description, category, gates, is_template")
      .or(`user_id.eq.${_userId},is_template.eq.true`).eq("is_active", true)
      .order("is_template", { ascending: false });
    return { workflows: workflows || [] };
  }

  async function executeStartWorkflow(args: Record<string, unknown>, _userId: string) {
    const code = String(args.workflow_code || "").trim();
    const partnerId = String(args.partner_id || "").trim();
    if (!code || !partnerId) return { error: "workflow_code e partner_id obbligatori" };
    const { data: wf } = await supabase.from("commercial_workflows")
      .select("id, name, gates").or(`user_id.eq.${_userId},is_template.eq.true`)
      .eq("code", code).eq("is_active", true).maybeSingle();
    if (!wf) return { error: `Workflow "${code}" non trovato` };
    await supabase.from("partner_workflow_state").update({ status: "paused" })
      .eq("user_id", _userId).eq("partner_id", partnerId).eq("status", "active");
    const wfRow = wf as { id: string; name: string; gates: unknown };
    const { data: state, error } = await supabase.from("partner_workflow_state").insert({
      user_id: _userId, partner_id: partnerId,
      contact_id: args.contact_id ? String(args.contact_id) : null,
      workflow_id: wfRow.id, current_gate: 0, status: "active",
      notes: args.notes ? String(args.notes) : null,
    }).select("id").single();
    if (error) return { error: error.message };
    const gates = Array.isArray(wfRow.gates) ? wfRow.gates as WorkflowGate[] : [];
    const firstGate = gates[0] || {};
    return {
      success: true, state_id: state?.id, workflow_name: wfRow.name,
      current_gate: 0, gate_name: firstGate.name || "Gate 0",
      gate_objective: firstGate.objective, exit_criteria: firstGate.exit_criteria || [],
      suggested_tools: firstGate.suggested_tools || [],
      message: `Workflow "${wfRow.name}" avviato. Gate 0: ${firstGate.name || ""}`,
    };
  }

  async function executeAdvanceWorkflowGate(args: Record<string, unknown>, _userId: string) {
    const partnerId = String(args.partner_id || "").trim();
    const newGate = Number(args.new_gate);
    if (!partnerId || Number.isNaN(newGate)) return { error: "partner_id e new_gate obbligatori" };
    const { data: state } = await supabase.from("partner_workflow_state")
      .select("id, current_gate, status, notes, commercial_workflows(name, gates)")
      .eq("user_id", _userId).eq("partner_id", partnerId).eq("status", "active").maybeSingle();
    if (!state) return { error: "Nessun workflow attivo per questo partner" };
    const stateRow = state as { id: string; current_gate: number; status: string; notes: string | null; commercial_workflows: { name: string; gates: unknown } | null };
    const gates = Array.isArray(stateRow.commercial_workflows?.gates) ? stateRow.commercial_workflows!.gates as WorkflowGate[] : [];
    const cur = stateRow.current_gate;
    if (newGate > cur + 1) return { error: `Avanzamento non valido: gate corrente ${cur}, target ${newGate}. Massimo +1 alla volta.`, current_gate: cur };
    if (newGate >= gates.length) return { error: `Gate ${newGate} fuori range (max ${gates.length - 1})` };
    const status = args.status ? String(args.status) : "active";
    const update: Record<string, unknown> = { current_gate: newGate, status };
    if (args.gate_notes) {
      const existing = stateRow.notes || "";
      update.notes = (existing ? existing + "\n\n" : "") + `[Gate ${newGate}] ${args.gate_notes}`;
    }
    if (status === "completed") update.completed_at = new Date().toISOString();
    const { error } = await supabase.from("partner_workflow_state").update(update).eq("id", stateRow.id);
    if (error) return { error: error.message };
    const targetGate = gates[newGate] || {};
    return {
      success: true, workflow_name: stateRow.commercial_workflows?.name,
      previous_gate: cur, current_gate: newGate, gate_name: targetGate.name,
      gate_objective: targetGate.objective, exit_criteria: targetGate.exit_criteria || [],
      suggested_tools: targetGate.suggested_tools || [],
      message: `Workflow avanzato a Gate ${newGate}: ${targetGate.name || ""}`,
    };
  }

  async function executeListPlaybooks(args: Record<string, unknown>, _userId: string) {
    const { data } = await supabase.from("commercial_playbooks")
      .select("id, code, name, description, trigger_conditions, workflow_code, kb_tags, priority, is_template")
      .or(`user_id.eq.${_userId},is_template.eq.true`).eq("is_active", true)
      .order("priority", { ascending: false });
    let filtered = data || [];
    const cc = args.country_code ? String(args.country_code).toUpperCase() : null;
    const ls = args.lead_status ? String(args.lead_status) : null;
    if (cc || ls) {
      filtered = filtered.filter((p: { trigger_conditions: unknown }) => {
        const tc = (p.trigger_conditions || {}) as PlaybookTriggerConditions;
        if (cc && Array.isArray(tc.country_codes) && !tc.country_codes.includes(cc)) return false;
        if (ls && Array.isArray(tc.lead_status) && !tc.lead_status.includes(ls)) return false;
        return true;
      });
    }
    return { playbooks: filtered, count: filtered.length };
  }

  async function executeApplyPlaybook(args: Record<string, unknown>, _userId: string) {
    const code = String(args.playbook_code || "").trim();
    if (!code) return { error: "playbook_code obbligatorio" };
    const { data: pb } = await supabase.from("commercial_playbooks").select("*")
      .or(`user_id.eq.${_userId},is_template.eq.true`).eq("code", code).eq("is_active", true).maybeSingle();
    if (!pb) return { error: `Playbook "${code}" non trovato` };
    const pbRow = pb as { code: string; name: string; description: string; workflow_code: string; prompt_template: string; suggested_actions: unknown; kb_tags: string[] };
    let kbContext: { title: string; content: string; category: string }[] = [];
    if (Array.isArray(pbRow.kb_tags) && pbRow.kb_tags.length > 0) {
      const { data: kb } = await supabase.from("kb_entries").select("title, content, category")
        .eq("is_active", true).eq("user_id", _userId).overlaps("tags", pbRow.kb_tags)
        .order("priority", { ascending: false }).limit(6);
      kbContext = (kb || []) as { title: string; content: string; category: string }[];
    }
    return {
      success: true,
      playbook: {
        code: pbRow.code, name: pbRow.name, description: pbRow.description,
        workflow_code: pbRow.workflow_code, prompt_template: pbRow.prompt_template,
        suggested_actions: pbRow.suggested_actions,
      },
      kb_loaded: kbContext.length, kb_entries: kbContext,
      message: `Playbook "${pbRow.name}" attivato.`,
    };
  }

  return {
    executeSaveMemory,
    executeSearchMemory,
    executeCreateWorkPlan,
    executeExecutePlanStep,
    executeGetActivePlans,
    executeSaveAsTemplate,
    executeSearchTemplates,
    executeUiAction,
    executeSearchKb,
    executeSaveKbRule,
    executeSaveOperativePrompt,
    executeListWorkflows,
    executeStartWorkflow,
    executeAdvanceWorkflowGate,
    executeListPlaybooks,
    executeApplyPlaybook,
  };
}
