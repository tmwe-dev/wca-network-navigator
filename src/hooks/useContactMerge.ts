/**
 * useContactMerge — Hook for contact deduplication and merging
 * Provides utilities for finding duplicate contacts and merging them
 */
import { tFrom } from "@/lib/typedSupabase";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";


import { createLogger } from "@/lib/log";
const log = createLogger("useContactMerge");
// ── Levenshtein distance for fuzzy matching ──
function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = aLower[j - 1] === bLower[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[bLower.length][aLower.length];
}

function extractDomain(email: string | null): string {
  if (!email) return "";
  const parts = email.toLowerCase().split("@");
  return parts.length > 1 ? parts[1] : "";
}

function calculateSimilarity(name1: string | null, name2: string | null): number {
  if (!name1 || !name2) return 0;
  const distance = levenshteinDistance(name1, name2);
  const maxLength = Math.max(name1.length, name2.length);
  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

// ── Types ──

export interface ContactForMerge {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company_name: string | null;
  company_id: string | null;
  title: string | null;
  country: string | null;
  created_at: string;
  interaction_count: number | null;
}

export interface DuplicatePair {
  contact1: ContactForMerge;
  contact2: ContactForMerge;
  matchConfidence: number; // 0-100
  reason: string;
  differences: string[];
}

export interface MergeFieldChoice {
  fieldName: string;
  keepValue: string | number | null | undefined;
}

// ── Hook: Find Duplicates ──

export function useFindDuplicates() {
  return useQuery({
    queryKey: queryKeys.contactMerge.duplicates,
    queryFn: async () => {
      const { data: contacts, error } = await tFrom("imported_contacts")
        .select(
          "id, name, email, phone, mobile, company_name, company_id, title, country, created_at, interaction_count"
        )
        .or("company_name.not.is.null,name.not.is.null,email.not.is.null")
        .limit(2000);

      if (error) throw error;
      if (!contacts || contacts.length === 0) return [];

      const pairs: DuplicatePair[] = [];
      const processed = new Set<string>();

      // Compare each pair
      for (let i = 0; i < contacts.length; i++) {
        for (let j = i + 1; j < contacts.length; j++) {
          const c1 = contacts[i] as ContactForMerge;
          const c2 = contacts[j] as ContactForMerge;

          const key = [c1.id, c2.id].sort().join("-");
          if (processed.has(key)) continue;
          processed.add(key);

          let confidence = 0;
          const differences: string[] = [];

          // Email exact match
          if (c1.email && c2.email && c1.email.toLowerCase() === c2.email.toLowerCase()) {
            confidence = 95;
            if (c1.name !== c2.name) differences.push(`Nomi diversi: "${c1.name}" vs "${c2.name}"`);
            if (c1.phone !== c2.phone) differences.push(`Telefoni diversi`);
          }
          // Email domain + name similarity
          else if (
            c1.email &&
            c2.email &&
            extractDomain(c1.email) === extractDomain(c2.email) &&
            c1.name &&
            c2.name
          ) {
            const nameSim = calculateSimilarity(c1.name, c2.name);
            if (nameSim > 0.7) {
              confidence = Math.round(85 * nameSim);
              differences.push(`Nomi simili (${Math.round(nameSim * 100)}%): "${c1.name}" vs "${c2.name}"`);
            }
          }
          // Same company + name similarity
          else if (
            c1.company_id &&
            c2.company_id &&
            c1.company_id === c2.company_id &&
            c1.name &&
            c2.name
          ) {
            const nameSim = calculateSimilarity(c1.name, c2.name);
            if (nameSim > 0.8) {
              confidence = Math.round(75 * nameSim);
              differences.push(`Stessa azienda, nomi simili (${Math.round(nameSim * 100)}%)`);
            }
          }
          // Phone match (normalized)
          else if (c1.phone || c1.mobile || c2.phone || c2.mobile) {
            const p1 = (c1.phone || c1.mobile || "").replace(/\D/g, "");
            const p2 = (c2.phone || c2.mobile || "").replace(/\D/g, "");
            if (p1.length >= 8 && p1 === p2) {
              confidence = 90;
              if (c1.email !== c2.email) differences.push(`Email diversi`);
              if (c1.name !== c2.name) differences.push(`Nomi diversi`);
            }
          }

          // Only include if confidence >= 60
          if (confidence >= 60) {
            pairs.push({
              contact1: c1,
              contact2: c2,
              matchConfidence: confidence,
              reason:
                confidence === 95
                  ? "Email identica"
                  : confidence >= 85
                    ? "Email dominio identico + nomi simili"
                    : confidence >= 75
                      ? "Stessa azienda + nomi simili"
                      : "Telefono identico",
              differences,
            });
          }
        }
      }

      // Sort by confidence descending
      return pairs.sort((a, b) => b.matchConfidence - a.matchConfidence);
    },
    staleTime: 300000, // 5 min
    gcTime: 600000, // 10 min
  });
}

// ── Hook: Merge Contacts ──

export function useMergeContacts() {
  return useMutation({
    mutationFn: async ({
      keepId,
      deleteId,
      fieldChoices,
    }: {
      keepId: string;
      deleteId: string;
      fieldChoices: MergeFieldChoice[];
    }) => {
      // Get both contacts
      const [keepRes, deleteRes] = await Promise.all([
        supabase.from("imported_contacts").select("*").eq("id", keepId).single(),
        supabase.from("imported_contacts").select("*").eq("id", deleteId).single(),
      ]);

      if (keepRes.error) throw keepRes.error;
      if (deleteRes.error) throw deleteRes.error;

      const keepContact = keepRes.data;
      const deleteContact = deleteRes.data;

      // Build merged record
      const merged = { ...keepContact };
      for (const choice of fieldChoices) {
        if (choice.keepValue !== undefined) {
          (merged as Record<string, unknown>)[choice.fieldName] = choice.keepValue;
        }
      }

      // 1. Update the surviving contact
      const { error: updateError } = await supabase
        .from("imported_contacts")
        .update(merged)
        .eq("id", keepId);

      if (updateError) throw updateError;

      // 2. Reassign activities to surviving contact
      const { error: activityError } = await tFrom("activities")
        .update({ contact_id: keepId })
        .eq("contact_id", deleteId);

      if (activityError) log.warn("Activity reassignment warning:", { error: activityError });

      // 3. Reassign emails to surviving contact
      const { error: emailError } = await tFrom("emails")
        .update({ contact_id: keepId })
        .eq("contact_id", deleteId);

      if (emailError) log.warn("Email reassignment warning:", { error: emailError });

      // 4. Delete the duplicate
      const { error: deleteError } = await supabase.from("imported_contacts").delete().eq("id", deleteId);

      if (deleteError) throw deleteError;

      return { mergedId: keepId, deletedId: deleteId };
    },
  });
}

// ── Hook: Get duplicate count ──

export function useDuplicateCount() {
  return useQuery({
    queryKey: queryKeys.contactMerge.duplicateCount,
    queryFn: async () => {
      const result = await tFrom("imported_contacts")
        .select("id", { count: "exact", head: true });
      return result.count || 0;
    },
  });
}
