

# Fix: Workspace tab switching not filtering contact list

## Problem
`ContactListPanel.tsx` (workspace) calls `useAllActivities()` and filters only by `activity_type === "send_email"` and `status !== "completed"` (line 97-101). It never filters by `source_type`, so switching tabs has no effect on the displayed list.

The parent `Workspace.tsx` correctly filters by `sourceTab` for its own `emailActivities` (line 57-60), but never passes `sourceTab` to `ContactListPanel`.

## Fix

**File: `src/components/workspace/ContactListPanel.tsx`**
1. Add `sourceType` prop to `ContactListPanelProps` interface
2. Use it in the `emailActivities` filter: `a.source_type === sourceType`

**File: `src/pages/Workspace.tsx`**  
3. Pass `sourceTab` to `ContactListPanel` as `sourceType={sourceTab}`

This is a 2-line fix across 2 files.

