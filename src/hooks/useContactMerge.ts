/**
 * useContactMerge — Hook for contact deduplication and merging
 * Provides utilities for finding duplicate contacts and merging them
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getImportedContactById,
  updateImportedContact,
  reassignActivitiesContact,
  reassignEmailsContact,
  deleteImportedContact,
  findContactsForDuplicateScan,
  countImportedContactsForMerge,
} from "@/data/contactMergeQueries";
import { extractDomain, calculateSimilarity } from "@/lib/contactSimilarity";


import { createLogger } from "@/lib/log";
const log = createLogger("useContactMerge");
// levenshteinDistance / extractDomain / calculateSimilarity: helpers puri estratti
// in src/lib/contactSimilarity.ts (batch F20-P0.2, finding P001-025) per rimuovere
// la reimplementazione parallela in src/test/contact-merge-logic.test.ts.

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
      const contacts = await findContactsForDuplicateScan();
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
      const [keepContact, _deleteContact] = await Promise.all([
        getImportedContactById(keepId),
        getImportedContactById(deleteId),
      ]);

      // Build merged record
      const merged = { ...keepContact };
      for (const choice of fieldChoices) {
        if (choice.keepValue !== undefined) {
          (merged as Record<string, unknown>)[choice.fieldName] = choice.keepValue;
        }
      }

      // 1. Update the surviving contact
      await updateImportedContact(keepId, merged);

      // 2. Reassign activities to surviving contact
      const { error: activityError } = await reassignActivitiesContact(deleteId, keepId);

      if (activityError) log.warn("Activity reassignment warning:", { error: activityError });

      // 3. Reassign emails to surviving contact
      const { error: emailError } = await reassignEmailsContact(deleteId, keepId);

      if (emailError) log.warn("Email reassignment warning:", { error: emailError });

      // 4. Delete the duplicate
      await deleteImportedContact(deleteId);

      return { mergedId: keepId, deletedId: deleteId };
    },
  });
}

// ── Hook: Get duplicate count ──

export function useDuplicateCount() {
  return useQuery({
    queryKey: queryKeys.contactMerge.duplicateCount,
    queryFn: async () => {
      return countImportedContactsForMerge();
    },
  });
}
