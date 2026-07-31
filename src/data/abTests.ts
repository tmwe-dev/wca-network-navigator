/**
 * DAL — ab_tests
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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

export async function findAbTests(limit = 50): Promise<ABTestRow[]> {
  const { data, error } = await supabase
    .from("ab_tests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ABTestRow[];
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
