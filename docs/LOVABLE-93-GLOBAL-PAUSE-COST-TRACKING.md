# LOVABLE-93: Global AI Automation Pause & Cost/Usage Dashboard

## Overview

This feature implements two key capabilities:

1. **Global Pause Control** - Suspend all AI automations at once with confirmation dialog
2. **Cost/Usage Dashboard** - Track API credits, consumption trends, and operation breakdowns

## Task 1: Global Pause Control

### What It Does

Users can pause all AI automations simultaneously from the AI Control Center. When paused, the following functions skip execution:

- `check-inbox` - Email classification and processing
- `cadence-engine` - Scheduled follow-up actions
- `pending-action-executor` - Execution of approved pending actions

### Implementation Details

#### Database Schema

Added `user_id` column to `app_settings` table to support per-user settings:

```sql
ALTER TABLE public.app_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_key_user_id_unique UNIQUE (key, user_id);
```

Settings keys used:
- `ai_automations_paused` - boolean string ("true"/"false")
- `ai_automations_paused_at` - ISO 8601 timestamp
- `ai_automations_paused_reason` - optional reason text

#### Edge Functions Modifications

**check-inbox** (`supabase/functions/check-inbox/index.ts`):
```typescript
// LOVABLE-93: global pause check
const { data: pauseSettings } = await supabase
  .from("app_settings")
  .select("value")
  .eq("key", "ai_automations_paused")
  .eq("user_id", userId)
  .maybeSingle();

if (pauseSettings?.value === "true") {
  console.log(`[check-inbox] AI automations paused for user ${userId}`);
  return new Response(JSON.stringify({ paused: true, message: "AI automations paused" }), {
    headers: dynCors,
    status: 200,
  });
}
```

**cadence-engine** (`supabase/functions/cadence-engine/index.ts`):
- Per-action pause check in the loop
- Skips action processing if `ai_automations_paused` is true for the user

**pending-action-executor** (`supabase/functions/pending-action-executor/index.ts`):
- Early return if paused before action execution starts

#### Helper Functions

In `src/data/appSettings.ts`:

```typescript
export async function getAiAutomationsPaused(userId: string): Promise<boolean>
export async function setAiAutomationsPaused(userId: string, paused: boolean, reason?: string): Promise<void>
```

#### UI Component

New component: `src/components/ai-control/GlobalAIAutomationPause.tsx`

Features:
- Real-time pause status display
- Toggle switch with confirmation dialog
- Shows pause timestamp and reason
- Red/green visual indicators
- Updates all three functions immediately

### Usage

1. Navigate to AI Control Center → "Pause Control" tab
2. Click the toggle to pause/resume
3. If pausing, optionally enter a reason (e.g., "Maintenance", "Testing")
4. Confirm the action in the dialog
5. Status updates immediately

## Task 2: Cost/Usage Dashboard

### What It Does

Provides visibility into API credit consumption with:

- Current balance display
- Cost tracking for today/week/month
- Operation type breakdown (pie chart)
- Daily trend visualization (line chart)
- Transaction history list
- Low-balance warning (< 20 credits)

### Implementation Details

#### Database Schema

Enhanced `credit_transactions` table with:

```sql
ALTER TABLE public.credit_transactions
ADD COLUMN input_tokens INTEGER,
ADD COLUMN output_tokens INTEGER,
ADD COLUMN provider TEXT;
```

Added indexes for faster queries:
```sql
CREATE INDEX idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_operation ON public.credit_transactions(operation);
```

Existing tables used:
- `user_credits` - Balance and total consumed
- `credit_transactions` - Individual transaction history

#### UI Component

New component: `src/components/ai-control/CostDashboardWidget.tsx`

Features:
- 3 stat cards: Balance, Cost This Period, Avg Cost/Operation
- Time range selector: Day, Week, Month
- Tabs for different views:
  - **Trend**: Line chart of last 7 days
  - **Breakdown**: Pie chart + grid of operation types
  - **Transactions**: Detailed transaction list

Operation types tracked:
- `ai_call` - Claude API calls
- `classify` - Email classification
- `generate_email` - Email generation
- `enrich` - Contact/company enrichment
- `categorize` - Content categorization
- `topup` - Credit purchases

### Usage

1. Navigate to AI Control Center → "API Costs" tab
2. View current balance and spending
3. Use time range selector (Day/Week/Month) to view different periods
4. Switch tabs to see trends, breakdown, or transaction details
5. Warning appears if balance < 20 credits

## Integration Points

### AI Control Center Page

Updated `src/v2/ui/pages/AIControlCenterPage.tsx`:
- Added "Pause Control" button → GlobalAIAutomationPause component
- Added "API Costs" button → CostDashboardWidget component
- Both are lazy-loaded for performance

### Related Functions

The pause check integrates cleanly with:
- `consume-credits/index.ts` - Credit deduction (not affected by pause)
- `deduct_credits` RPC - Direct credit function (not affected by pause)

## Migration

Apply the migration to enable these features:

```bash
supabase migration up
```

Migration file: `supabase/migrations/20260421205000_lovable93_global_pause_cost_tracking.sql`

This migration:
- Adds `user_id` to `app_settings`
- Creates composite unique constraint
- Adds performance indexes
- Creates `user_automation_settings` table for future extensibility
- Extends `credit_transactions` with token counts

## Testing

### Global Pause

```bash
# Manual test
1. Set app_settings to paused
UPDATE app_settings SET value = 'true' WHERE key = 'ai_automations_paused' AND user_id = '<user-id>';

2. Trigger check-inbox - should return immediately with paused message
3. Trigger cadence-engine - should skip all actions
4. Trigger pending-action-executor - should return without executing

5. Unpause
UPDATE app_settings SET value = 'false' WHERE key = 'ai_automations_paused' AND user_id = '<user-id>';
```

### Cost Dashboard

```bash
# Manual test
1. Create test transactions:
INSERT INTO credit_transactions (user_id, amount, operation, description) VALUES ('<user-id>', 5, 'classify', 'Test email classification');

2. View dashboard - should show:
   - Updated balance
   - Transaction in history
   - Operation in breakdown pie chart
   - Trend updated if within time range
```

## Performance Considerations

- Pause check happens early in request lifecycle (minimal overhead)
- Dashboard queries use indexes for fast lookups
- Lazy-loading components reduces initial AI Control Center load time
- Per-user settings prevent cross-user interference

## Future Enhancements

1. Schedule pause/resume at specific times
2. Pause individual automations (check-inbox only, cadence-engine only, etc.)
3. Automation quota limits (max operations per day/week/month)
4. Cost alerts (email notification when spending exceeds threshold)
5. Detailed usage reports by operation type and date range
6. API key rotation audit trail in transactions
7. Budget planning with projected consumption

## Notes

- Pause is per-user and immediate
- No in-flight operations are cancelled (only future triggers)
- Cost tracking includes all operations, even when paused (transparency)
- Both features integrate with existing auth and RLS policies
