/**
 * DAL — ab_tests
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toRecord } from "@/lib/records";

export interface ABTestRow {
  id: string;
  test_name: string;
  test_type: string;
  status: string;
  variant_a: Record<string, string>;
  variant_b: Record<string, string>;
  total_sent_a: number;
  total_sent_b: number;
  responses_a: number;
  responses_b: number;
  open_rate_a: number;
  open_rate_b: number;
  winner: string | null;
  confidence_level: number;
  started_at: string;
  completed_at: string | null;
}

type AbTestDbRow = Database["public"]["Tables"]["ab_tests"]["Row"];

/** Variante come mappa stringa→stringa: le voci non stringa vengono scartate. */
function parseVariant(value: Json): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(toRecord(value))) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function mapAbTestRow(r: AbTestDbRow): ABTestRow {
  return {
    id: r.id,
    test_name: r.test_name,
    test_type: r.test_type,
    status: r.status,
    variant_a: parseVariant(r.variant_a),
    variant_b: parseVariant(r.variant_b),
    total_sent_a: r.total_sent_a ?? 0,
    total_sent_b: r.total_sent_b ?? 0,
    responses_a: r.responses_a ?? 0,
    responses_b: r.responses_b ?? 0,
    open_rate_a: r.open_rate_a ?? 0,
    open_rate_b: r.open_rate_b ?? 0,
    winner: r.winner,
    confidence_level: r.confidence_level ?? 0,
    started_at: r.started_at ?? "",
    completed_at: r.completed_at,
  };
}

export async function findAbTests(limit = 50): Promise<ABTestRow[]> {
  const { data, error } = await supabase
    .from("ab_tests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapAbTestRow);
}

export async function completeAbTest(id: string, winner: "a" | "b") {
  const { error } = await supabase.from("ab_tests").update({
    status: "completed",
    winner,
    completed_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export interface CreateAbTestInput {
  user_id: string;
  test_name: string;
  test_type: string;
  variant_a: Record<string, string>;
  variant_b: Record<string, string>;
}

export async function createAbTest(input: CreateAbTestInput) {
  const { error } = await supabase.from("ab_tests").insert({
    user_id: input.user_id,
    test_name: input.test_name,
    test_type: input.test_type,
    variant_a: input.variant_a as Json,
    variant_b: input.variant_b as Json,
  });
  if (error) throw error;
}
