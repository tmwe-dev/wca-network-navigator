export const commsKeys = {
  cestinone: {
    all: ["cestinone"] as const,
    list: (filters?: unknown) => ["cestinone-list", filters] as const,
    count: ["cestinone-count"] as const,
  },
  activities: {
    all: ["activities"] as const,
    allActivities: ["all-activities"] as const,
    today: ["today-activities"] as const,
    outreach: (filters?: unknown) => ["activities-outreach", filters] as const,
    aiGenerated: ["ai-generated-activities"] as const,
    workedToday: ["worked-today"] as const,
    agendaDay: (...args: unknown[]) => ["agenda-day", ...args] as const,
    departmentKanban: ["activities-department-kanban"] as const,
  },
  outreach: {
    scheduled: (filters?: unknown) => ["outreach-scheduled", filters] as const,
    pending: (filters?: unknown) => ["outreach-pending", filters] as const,
    failed: (filters?: unknown) => ["outreach-failed", filters] as const,
    sent: (filters?: unknown) => ["outreach-sent", filters] as const,
    replies: (filters?: unknown) => ["outreach-replies", filters] as const,
    bounces: (filters?: unknown) => ["outreach-bounces", filters] as const,
    stats: ["outreach-stats"] as const,
    subCounts: (filters?: unknown) => ["outreach-sub-counts", filters] as const,
    miniCharts: ["outreach-mini-charts"] as const,
  },
  email: {
    count: ["email-count"] as const,
    mailboxes: ["email-mailboxes"] as const,
    mailboxesAll: ["email-mailboxes", "all"] as const,
    operatorAccess: (operatorId: string) => ["email-mailboxes", "access", operatorId] as const,
    syncJob: ["email-sync-job"] as const,
    syncJobCompleted: ["email-sync-job-completed"] as const,
    drafts: (filters?: unknown) => ["email-drafts", filters] as const,
    templates: ["email-templates"] as const,
    images: ["email-images"] as const,
    classifications: ["email-classifications"] as const,
    classificationsCatCounts: ["email-classifications-cat-counts"] as const,
    addressRules: ["email-address-rules"] as const,
    senderGroups: ["email-sender-groups"] as const,
    senderGroupsRules: ["email-sender-groups-rules"] as const,
    senderProfiles: ["sender-profiles"] as const,
    campaignQueue: (filters?: unknown) => ["email-campaign-queue", filters] as const,
    queueOutreach: (filters?: unknown) => ["email-queue-outreach", filters] as const,
    queueGlobalCounts: ["email-queue-global-counts"] as const,
    messageContent: (messageId?: string | null) => ["email-message-content", messageId] as const,
    attachments: (messageId?: string | null) => ["email-attachments", messageId] as const,
    downloadedFeed: (filters?: unknown) => ["downloaded-emails-feed", filters] as const,
    promptsTab4: ["email-prompts-tab4"] as const,
    addressRulesTab4: ["address-rules-tab4"] as const,
    sendLog: (range: string) => ["email-send-log", range] as const,
  },
  emailIntel: {
    uncategorizedCount: ["email-intel-uncategorized-count"] as const,
    aiSuggestionsCount: ["email-intel-ai-suggestions-count"] as const,
    classifyToday: ["email-intel-classify-today"] as const,
    activeRules: ["email-intel-active-rules"] as const,
  },
  channelMessages: {
    root: ["channel-messages"] as const,
    all: ["channel-messages"] as const,
    list: (channel?: string, search?: string, page?: number, operatorId?: string) =>
      ["channel-messages", channel ?? "all", search ?? "", page ?? 0, operatorId ?? "self"] as const,
    unread: (channel?: string, operatorId?: string) =>
      ["channel-messages-unread", channel ?? "all", operatorId ?? "self"] as const,
    unreadCounts: ["unread-counts"] as const,
    inboundPreview: (partnerId?: string | null, fromAddress?: string | null, subject?: string | null) =>
      ["channel-messages-inbound-preview", partnerId ?? "", fromAddress ?? "", subject?.slice(0, 60) ?? ""] as const,
  },
  campaigns: {
    jobs: (filters?: unknown) => ["campaign-jobs", filters] as const,
    jobsOutreach: (filters?: unknown) => ["campaign-jobs-outreach", filters] as const,
    analytics: (filters?: unknown) => ["campaign-analytics", filters] as const,
  },
  funnemailInbox: {
    root: ["funnemail-inbox"] as const,
    folders: ["funnemail-inbox", "folders"] as const,
    counts: ["funnemail-inbox", "counts"] as const,
    grouped: (userId: string, operatorUserId?: string | null) =>
      ["funnemail-inbox", "grouped", userId, operatorUserId ?? "self"] as const,
    mailsByFolder: (slug: string, limit: number) =>
      ["funnemail-inbox", "mails", slug, limit] as const,
    decision: (messageId?: string | null) => ["funnemail-inbox", "decision", messageId ?? "none"] as const,
    mail: (messageId?: string | null) => ["funnemail-inbox", "mail", messageId ?? "none"] as const,
    claims: {
      byGroup: (groupId?: string | null) => ["funnemail-inbox", "claims", "group", groupId ?? "all"] as const,
      active: () => ["funnemail-inbox", "claims", "active"] as const,
    },
    statuses: {
      byGroup: (groupId?: string | null) => ["funnemail-inbox", "statuses", "group", groupId ?? "all"] as const,
      history: (messageId?: string | null) => ["funnemail-inbox", "statuses", "history", messageId ?? "none"] as const,
    },
    sorting: {
      queue: () => ["funnemail-inbox", "sorting", "queue"] as const,
      count: () => ["funnemail-inbox", "sorting", "count"] as const,
    },
    reminders: {
      byGroup: (groupId?: string | null) => ["funnemail-inbox", "reminders", "group", groupId ?? "all"] as const,
      active: () => ["funnemail-inbox", "reminders", "active"] as const,
    },
    jobs: {
      list: (filters?: { status?: string | null; ownerId?: string | null; limit?: number }) =>
        ["funnemail-inbox", "jobs", "list", filters ?? {}] as const,
      byMessage: (messageId?: string | null) =>
        ["funnemail-inbox", "jobs", "by-message", messageId ?? "none"] as const,
    },
  },
  alertRouting: {
    recipients: (userId?: string) => ["alert-recipients", userId ?? "current"] as const,
    log: (userId?: string) => ["alert-dispatch-log", userId ?? "current"] as const,
  },
} as const;
