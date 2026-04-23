export async function handleManageWorkspacePreset(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const action = String(args.action);

  if (action === "list") {
    const { data, error } = await supabase
      .from("workspace_presets")
      .select("id, name, goal, base_proposal, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return error
      ? { error: error.message }
      : { count: data?.length || 0, presets: data || [] };
  }

  if (action === "create") {
    const { data, error } = await supabase
      .from("workspace_presets")
      .insert({
        user_id: userId,
        name: String(args.name || "Nuovo preset"),
        goal: String(args.goal || ""),
        base_proposal: String(args.base_proposal || ""),
      })
      .select("id, name")
      .single();

    return error
      ? { error: error.message }
      : {
          success: true,
          preset_id: data.id,
          message: `Preset "${data.name}" creato.`,
        };
  }

  if (action === "update" && args.preset_id) {
    const updates: Record<string, unknown> = {};

    if (args.name) {
      updates.name = args.name;
    }
    if (args.goal) {
      updates.goal = args.goal;
    }
    if (args.base_proposal) {
      updates.base_proposal = args.base_proposal;
    }

    const { error } = await supabase
      .from("workspace_presets")
      .update(updates)
      .eq("id", args.preset_id)
      .eq("user_id", userId);

    return error
      ? { error: error.message }
      : { success: true, message: "Preset aggiornato." };
  }

  if (action === "delete" && args.preset_id) {
    const { error } = await supabase
      .from("workspace_presets")
      .delete()
      .eq("id", args.preset_id)
      .eq("user_id", userId);

    return error
      ? { error: error.message }
      : { success: true, message: "Preset eliminato." };
  }

  return {
    error: "Azione non valida. Usa: create, list, update, delete.",
  };
}

export async function handleGetConversationContext(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase
    .from("contact_conversation_context")
    .select("*")
    .eq("email_address", String(args.email_address))
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { message: "No conversation context found." };
  }

  return data;
}

export async function handleGetAddressRules(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let q = supabase
    .from("email_address_rules")
    .select("*")
    .eq("user_id", userId)
    .order("interaction_count", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 50));

  if (args.email_address) {
    q = q.eq("email_address", args.email_address);
  }

  if (args.is_active !== undefined) {
    q = q.eq("is_active", !!args.is_active);
  }

  const { data, error } = await q;

  if (error) {
    return { error: error.message };
  }

  return { count: data?.length, rules: data };
}

export async function handleSaveMemory(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase
    .from("ai_memory")
    .insert({
      user_id: userId,
      content: String(args.content),
      memory_type: String(args.memory_type || "fact"),
      tags: (args.tags as string[]) || [],
      importance: Math.min(5, Math.max(1, Number(args.importance) || 3)),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, memory_id: data.id };
}

export async function handleDetectLanguage(
  args: Record<string, unknown>
): Promise<unknown> {
  const map: Record<string, string> = {
    IT: "Italiano",
    DE: "Deutsch",
    FR: "Français",
    ES: "Español",
    PT: "Português",
    NL: "Nederlands",
    PL: "Polski",
    US: "English",
    GB: "English",
    BR: "Português",
    RU: "Русский",
    TR: "Türkçe",
    CN: "中文",
    JP: "日本語",
  };

  const lang = map[String(args.country_code).toUpperCase()] || "English";

  return { country_code: args.country_code, language: lang };
}

export async function handleGetPendingActions(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const status = String(args.status || "pending");
  let q = supabase
    .from("ai_pending_actions")
    .select(
      "id, action_type, confidence, reasoning, suggested_content, partner_id, contact_id, email_address, status, created_at, source"
    )
    .eq("user_id", userId)
    .eq("status", status)
    .order("confidence", { ascending: false })
    .limit(Number(args.limit) || 20);

  if (args.action_type) {
    q = q.eq("action_type", String(args.action_type));
  }

  const { data, error } = await q;

  if (error) {
    return { error: error.message };
  }

  return { count: data?.length || 0, actions: data || [] };
}

export async function handleApproveAiAction(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const actionId = String(args.action_id);
  const { error } = await supabase
    .from("ai_pending_actions")
    .update({ status: "approved", executed_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: `Azione ${actionId} approvata.` };
}

export async function handleRejectAiAction(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const actionId = String(args.action_id);
  const reason = args.reason ? String(args.reason) : null;
  const updatePayload: Record<string, unknown> = { status: "rejected" };

  if (reason) {
    updatePayload.reasoning = reason;
  }

  const { error } = await supabase
    .from("ai_pending_actions")
    .update(updatePayload)
    .eq("id", actionId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: `Azione ${actionId} rifiutata.` };
}

export async function handleExecuteUiAction(
  args: Record<string, unknown>
): Promise<unknown> {
  const action = String(args.action || "toast");
  const target = String(args.target || "");
  const params = (args.params || {}) as Record<string, unknown>;

  return {
    success: true,
    ui_action: { action, target, params },
    message:
      action === "navigate"
        ? `Navigazione a ${target}`
        : action === "toast"
          ? `Notifica: ${target}`
          : `Filtro applicato: ${target}`,
  };
}

export async function handleReadKb(
  args: Record<string, unknown>
): Promise<unknown> {
  return {
    error: "Tool not yet implemented",
    message: "read_kb tool è programmato per future implementazione. Contattare il team di development.",
    details: {
      requested_kb_category: args.kb_category || "unknown",
      requested_query: args.query || "none",
    },
  };
}

export async function handleGetOutreachStats(
  args: Record<string, unknown>
): Promise<unknown> {
  return {
    error: "Tool not yet implemented",
    message: "get_outreach_stats tool è programmato per future implementazione. Contattare il team di development.",
    details: {
      requested_period: args.period || "all_time",
      requested_filter: args.filter || "none",
    },
  };
}
