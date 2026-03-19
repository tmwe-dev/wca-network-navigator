

## Problems Identified

**1. AI conversations are NOT persisted** — Both `IntelliFlowOverlay` and `GlobalChat` use `useState<Message[]>([])`. When the overlay closes or the user navigates away, the entire conversation is lost. There is no DB table for chat sessions.

**2. Download jobs created by AI never start processing** — The AI's `create_download_job` tool correctly inserts a job in the `download_jobs` table with status "pending", but:
   - The `handleJobCreated` callback in `Global.tsx` is **empty** (does nothing)
   - The download processor (`useDownloadProcessor.startJob`) only runs on the **Operations page**
   - The Global page has no instance of `useDownloadProcessor`, so pending jobs sit idle forever

---

## Plan

### A. Persist AI Conversations

1. **Create `ai_conversations` table** with columns: `id`, `user_id`, `title`, `messages` (jsonb), `page_context`, `created_at`, `updated_at`. RLS: users manage own rows.

2. **Update `IntelliFlowOverlay`**:
   - On open, load the most recent conversation (or create new)
   - Auto-save messages to DB after each exchange (debounced)
   - Add a "Nuova chat" button and a small conversation list/selector to resume past chats
   - Auto-generate title from first user message

3. **Update `GlobalChat`** with same persistence pattern — load/save conversation to `ai_conversations` with `page_context = 'global'`.

### B. Fix Download Job Execution from AI

4. **Add `useDownloadProcessor` to `Global.tsx`** — wire the processor so when a job is created via AI chat, it auto-starts:
   - Import and instantiate `useDownloadProcessor`
   - In `handleJobCreated`, call `startJob(job.job_id)` to begin processing
   - Show download progress in the existing `DownloadStatusPanel`

5. **Add auto-start for pending jobs** — when the Global page mounts and finds a pending job with no running jobs, auto-start it (same pattern as Operations page).

---

### Technical Details

```text
ai_conversations
├── id (uuid, PK)
├── user_id (uuid, NOT NULL)
├── title (text, default 'Nuova conversazione')
├── messages (jsonb, default '[]')
├── page_context (text, nullable — 'intelliflow' | 'global' | 'home')
├── created_at (timestamptz)
└── updated_at (timestamptz)

RLS: auth.uid() = user_id for ALL
```

For download fix, the flow becomes:
```text
AI creates job (DB insert, status=pending)
  → GlobalChat detects JOB_CREATED in response
  → onJobCreated called with job info
  → Global.tsx calls startJob(jobId)
  → useDownloadProcessor picks up, verifies WCA session via extension
  → Processing loop begins
```

