

## Test Results & Fixes Needed

### What Works
1. **Contextual stat pills** - WORKING. When Thailand is selected, counters correctly show: 1 SELEZ, 178 PARTNER, 6 NO PROFILO, 78 NO EMAIL, 102 NO TEL, 179 DIRECTORY.

### What Needs Fixing

#### Fix 1: Edge function `generate-aliases` excludes partners without contacts

The edge function query uses `.not("partner_contacts", "is", null)` which excludes partners that have no contacts. Of the 78 Thailand partners without `company_alias`, **77 have zero contacts** — so they get excluded. The `eligible` filter further requires `hasContactInfo = true`, double-excluding them.

The company alias generation does NOT need contacts — it just cleans the company name.

**Changes to `supabase/functions/generate-aliases/index.ts`:**
- Remove `.not("partner_contacts", "is", null)` filter
- Split eligible logic: partners need company alias OR have contacts needing contact alias
- Partners with no contacts should still be included if they need a company_alias
- The AI prompt payload should handle partners with empty contacts arrays

#### Fix 2: Toast shows "undefined" for contacts count

In `Operations.tsx` line 135, the toast already uses `data.contacts ?? 0`, so this should work now. But we should also show the `total` field from the response to give context (e.g., "Alias generati: 78 aziende, 3 contatti su 81 elaborati").

### Files to Change
1. `supabase/functions/generate-aliases/index.ts` — Remove contact-required filter; allow company-only alias generation for partners without contacts

