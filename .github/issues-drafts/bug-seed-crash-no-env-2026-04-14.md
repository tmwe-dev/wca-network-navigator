# Bug: seed.ts crashes without env vars

**Created**: 2026-04-14
**Severity**: Medium
**Status**: ✅ FIXED

## Steps to Reproduce
1. Run `npx playwright test` without `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
2. Global setup crashes at `createClient()` with "supabaseKey is required"

## Expected
Global setup should gracefully skip seeding when env vars are missing.

## Fix Applied
Made `getSupabase()` return `null` when env vars are missing. `seedTestData()` and `cleanupTestData()` check for null client before proceeding.
