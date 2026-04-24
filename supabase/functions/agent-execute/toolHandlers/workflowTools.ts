interface WorkPlanStep {
  index?: number;
  title?: string;
  description?: string;
  status?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

interface AbTestVariant {
  agent_name: string;
  tone: string;
  percentage: number;
}

interface AbTestConfig {
  enabled?: boolean;
  variants?: AbTestVariant[];
}

export async function handleCreateWorkPlan(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const steps = (args.steps as WorkPlanStep[] || []).map(
    (s: WorkPlanStep, i: number) => ({
      index: i,
      title: s.title || `Step ${i + 1}`,
      description: s.description || "",
      status: "pending",
    })
  );

  const { data, error } = await supabase
    .from("ai_work_plans")
    .insert({
      user_id: userId,
      title: String(args.title),
      description: String(args.description || ""),
      steps: steps as unknown as Record<string, unknown>,
      status: "active",
      tags: (args.tags || []) as string[],
      metadata: {
        created_by: "luca_director",
        created_at: new Date().toISOString(),
      } as Record<string, unknown>,
    })
    .select("id, title")
    .single();

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    plan_id: data.id,
    title: data.title,
    total_steps: steps.length,
    message: `Piano "${data.title}" creato con ${steps.length} step.`,
  };
}

export async function handleListWorkPlans(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("ai_work_plans")
    .select(
      "id, title, description, status, current_step, steps, tags, created_at, completed_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 20);

  if (args.status) {
    query = query.eq("status", args.status);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const plans = (data || []).map((p: any) => ({
    ...p,
    total_steps: Array.isArray(p.steps) ? p.steps.length : 0,
    completed_steps: Array.isArray(p.steps)
      ? p.steps.filter((s: WorkPlanStep) => s.status === "completed").length
      : 0,
  }));

  if (args.tag) {
    return {
      count: plans.filter((p: any) =>
        (p.tags as string[] | undefined)?.includes(String(args.tag))
      ).length,
      plans: plans.filter((p: any) =>
        (p.tags as string[] | undefined)?.includes(String(args.tag))
      ),
    };
  }

  return { count: plans.length, plans };
}

export async function handleUpdateWorkPlan(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data: plan, error: fetchErr } = await supabase
    .from("ai_work_plans")
    .select("*")
    .eq("id", args.plan_id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !plan) {
    return { error: "Piano non trovato" };
  }

  const updates: Record<string, unknown> = {};

  if (args.status) {
    updates.status = args.status;
  }

  if (args.advance_step) {
    const steps = (plan.steps as WorkPlanStep[]) || [];

    if (plan.current_step < steps.length) {
      steps[plan.current_step].status = "completed";
      updates.steps = steps;
      updates.current_step = plan.current_step + 1;

      if (plan.current_step + 1 >= steps.length) {
        updates.status = "completed";
        updates.completed_at = new Date().toISOString();
      }
    }
  }

  if (args.metadata_note) {
    const meta = (plan.metadata as Record<string, unknown>) || {};
    const notes = (meta.notes as string[]) || [];
    notes.push(`[${new Date().toISOString()}] ${args.metadata_note}`);
    meta.notes = notes;
    updates.metadata = meta;
  }

  const { error } = await supabase
    .from("ai_work_plans")
    .update(updates)
    .eq("id", args.plan_id);

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: `Piano aggiornato.`,
    updates: Object.keys(updates),
  };
}

export async function handleCreateCampaign(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const steps: WorkPlanStep[] = [];
  const contactType = String(args.contact_type || "all");
  const countryCodes = (args.country_codes as string[]) || [];

  steps.push({
    index: 0,
    title: "Selezione contatti",
    description: `Tipo: ${contactType}, Paesi: ${countryCodes.join(", ") || "tutti"}`,
    status: "pending",
  });

  const agentNames = (args.agent_names as string[]) || [];
  if (agentNames.length > 0) {
    steps.push({
      index: 1,
      title: "Assegnazione agenti",
      description: `Agenti: ${agentNames.join(", ")}`,
      status: "pending",
    });
  }

  const abTest = args.ab_test as AbTestConfig | undefined;
  const variants = abTest?.variants ?? [];
  if (abTest?.enabled && variants.length > 0) {
    steps.push({
      index: steps.length,
      title: "Configurazione A/B Test",
      description: `Varianti: ${variants
        .map(
          (v: AbTestVariant) =>
            `${v.agent_name}(${v.tone}/${v.percentage}%)`
        )
        .join(" vs ")}`,
      status: "pending",
    });
  }

  steps.push({
    index: steps.length,
    title: "Invio outreach",
    description: "Esecuzione invii tramite agenti assegnati",
    status: "pending",
  });

  steps.push({
    index: steps.length,
    title: "Monitoraggio circuito",
    description: "Verifica risposte e follow-up secondo workflow",
    status: "pending",
  });

  const { data, error } = await supabase
    .from("ai_work_plans")
    .insert({
      user_id: userId,
      title: `Campagna: ${args.name}`,
      description: String(args.objective || ""),
      steps: steps as unknown as Record<string, unknown>,
      status: "active",
      tags: [
        "campaign",
        contactType,
        ...countryCodes.map((c) => `country:${c}`),
      ],
      metadata: {
        campaign: true,
        contact_type: contactType,
        country_codes: countryCodes,
        agent_names: agentNames,
        ab_test: abTest || null,
        max_contacts: Number(args.max_contacts) || 100,
      } as Record<string, unknown>,
    })
    .select("id, title")
    .single();

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    campaign_id: data.id,
    name: data.title,
    steps: steps.length,
    message: `Campagna "${args.name}" creata con ${steps.length} step.`,
  };
}
