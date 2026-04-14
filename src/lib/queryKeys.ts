/**
 * Centralized React Query key factory.
 * Use these helpers everywhere to guarantee cache consistency.
 *
 * RULE: All query keys MUST be defined here. Inline string arrays are banned
 * by the ESLint `no-restricted-syntax` rule in eslint.config.js.
 */
export const queryKeys = {
  // ── Partners ──────────────────────────────────────────
  partners: {
    all: ["partners"] as const,
    filtered: (filters?: Record<string, unknown>) => ["partners", filters] as const,
    paginated: (filters?: unknown) => ["partners-paginated", filters] as const,
    byCountry: (countryCode: string) => ["partners-by-country", countryCode] as const,
    globe: ["partners-globe"] as const,
    globeCountry: (code: string) => ["partners-globe-country", code] as const,
    countryPartnerCounts: ["country-partner-counts"] as const,
    enrichment: (filters?: unknown) => ["enrichment-partners", filters] as const,
    agendaCard: (ids?: unknown) => ["agenda-card-partners", ids] as const,
    agendaList: (filters?: unknown) => ["agenda-list-partners", filters] as const,
    downloadAgenda: (filters?: unknown) => ["download-agenda-partners", filters] as const,
    picker: (filters?: unknown) => ["picker-partners", filters] as const,
  },
  partner: (id: string) => ["partner", id] as const,

  // ── Partner Contacts ──────────────────────────────────
  partnerContacts: {
    all: ["partner-contacts"] as const,
    forCampaign: (ids: string) => ["partner-contacts-for-campaign", ids] as const,
    map: (partnerId: string) => ["partner-contacts-map", partnerId] as const,
    picker: (filters?: unknown) => ["partner-contacts-picker", filters] as const,
    pickerPartner: (filters?: unknown) => ["picker-partner-contacts", filters] as const,
  },

  // ── Social Links ──────────────────────────────────────
  socialLinks: {
    all: ["social-links"] as const,
    byPartner: (partnerId: string) => ["social-links", partnerId] as const,
    batch: (ids?: unknown) => ["social-links-batch", ids] as const,
    linkedin: (filters?: unknown) => ["linkedin-links-workspace", filters] as const,
  },

  // ── Contacts (imported_contacts) ──────────────────────
  contacts: {
    all: ["contacts"] as const,
    imported: (filters?: unknown) => ["imported-contacts", filters] as const,
    paginated: (filters?: unknown) => ["contacts-paginated", filters] as const,
    byGroup: (groupType?: string, groupKey?: string, page?: number, pageSize?: number, holding?: string) =>
      ["contacts-by-group", groupType, groupKey, page, pageSize, holding] as const,
    groupCounts: ["contact-group-counts"] as const,
    contactsGroupCounts: ["contacts-group-counts"] as const,
    segments: (filters?: unknown) => ["contact-segment-counts", filters] as const,
    pipeline: (filters?: unknown) => ["pipeline-contacts", filters] as const,
    holdingPattern: ["holding-pattern"] as const,
    holdingPatternList: (filters?: unknown) => ["holding-pattern-list", filters] as const,
    holdingPatternEmails: (filters?: unknown) => ["holding-pattern-emails", filters] as const,
    holdingMessages: (filters?: unknown) => ["holding-messages", filters] as const,
    holdingUnreadCounts: ["holding-unread-counts"] as const,
    holdingTimeline: (contactId?: string) => ["holding-timeline", contactId] as const,
    record: (contactId: string) => ["contact-record", contactId] as const,
    recordInteractions: (contactId: string) => ["record-interactions", contactId] as const,
    recordActivities: (contactId: string) => ["record-activities", contactId] as const,
    groupItems: (groupType?: string, groupKey?: string) => ["contact-group-items", groupType, groupKey] as const,
    picker: (filters?: unknown) => ["picker-contacts", filters] as const,
    pickerOrigins: ["picker-origin-options"] as const,
    pickerCountryStats: (filters?: unknown) => ["picker-country-stats-v2", filters] as const,
    proto: {
      recentContacts: (filters?: unknown) => ["proto-recent-contacts", filters] as const,
      partnerCount: (filters?: unknown) => ["proto-partner-count", filters] as const,
      partnerContacts: (filters?: unknown) => ["proto-partner-contacts", filters] as const,
      convContacts: (filters?: unknown) => ["proto-conv-contacts", filters] as const,
    },
  },

  // ── Contact Interactions ──────────────────────────────
  contactInteractions: {
    all: ["contact-interactions"] as const,
    byContact: (contactId: string) => ["contact-interactions", contactId] as const,
  },

  // ── Business Cards ────────────────────────────────────
  businessCards: {
    all: ["business-cards"] as const,
    forContact: (contactId: string) => ["business-card-for-contact", contactId] as const,
    matches: ["business-card-matches"] as const,
    matchesPartners: ["business-card-matches", "partners"] as const,
    matchesContacts: ["business-card-matches", "contacts"] as const,
    details: (filters?: unknown) => ["bca-details-for-list", filters] as const,
    countryCounts: ["bca-country-counts"] as const,
    campaign: (filters?: unknown) => ["bca-campaign", filters] as const,
  },

  // ── Activities ────────────────────────────────────────
  activities: {
    all: ["activities"] as const,
    allActivities: ["all-activities"] as const,
    today: ["today-activities"] as const,
    outreach: (filters?: unknown) => ["activities-outreach", filters] as const,
    aiGenerated: ["ai-generated-activities"] as const,
    workedToday: ["worked-today"] as const,
    agendaDay: (date?: string) => ["agenda-day", date] as const,
  },

  // ── Outreach ──────────────────────────────────────────
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

  // ── Email ─────────────────────────────────────────────
  email: {
    count: ["email-count"] as const,
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
    messageContent: (messageId: string) => ["email-message-content", messageId] as const,
    attachments: (messageId: string) => ["email-attachments", messageId] as const,
    downloadedFeed: (filters?: unknown) => ["downloaded-emails-feed", filters] as const,
    promptsTab4: ["email-prompts-tab4"] as const,
    addressRulesTab4: ["address-rules-tab4"] as const,
  },

  // ── Email Intelligence ────────────────────────────────
  emailIntel: {
    uncategorizedCount: ["email-intel-uncategorized-count"] as const,
    aiSuggestionsCount: ["email-intel-ai-suggestions-count"] as const,
    classifyToday: ["email-intel-classify-today"] as const,
    activeRules: ["email-intel-active-rules"] as const,
  },

  // ── Channel Messages ──────────────────────────────────
  channelMessages: {
    all: ["channel-messages"] as const,
    unread: ["channel-messages-unread"] as const,
    unreadCounts: ["unread-counts"] as const,
  },

  // ── Campaigns ─────────────────────────────────────────
  campaigns: {
    jobs: (filters?: unknown) => ["campaign-jobs", filters] as const,
    jobsOutreach: (filters?: unknown) => ["campaign-jobs-outreach", filters] as const,
    analytics: (filters?: unknown) => ["campaign-analytics", filters] as const,
  },

  // ── Cockpit ───────────────────────────────────────────
  cockpit: {
    queue: ["cockpit-queue"] as const,
  },

  // ── Import ────────────────────────────────────────────
  imports: {
    logs: ["import-logs"] as const,
    log: (importLogId: string) => ["import-log", importLogId] as const,
    errors: (importLogId: string) => ["import-errors", importLogId] as const,
    groups: ["import-groups"] as const,
  },

  // ── Download ──────────────────────────────────────────
  downloads: {
    jobs: ["download-jobs"] as const,
    terminalLog: (jobId: string) => ["job-terminal-log", jobId] as const,
    dataViewer: (jobId: string) => ["job-data-viewer", jobId] as const,
    failedIdsNames: (jobId: string) => ["failed-ids-names", jobId] as const,
    liveProfiles: (filters?: unknown) => ["live-profiles", filters] as const,
    maxWcaId: ["max-wca-id"] as const,
    staffJobs: (filters?: unknown) => ["staff-jobs", filters] as const,
  },

  // ── Sorting ───────────────────────────────────────────
  sorting: {
    jobs: ["sorting-jobs"] as const,
  },

  // ── Country Stats ─────────────────────────────────────
  countryStats: ["country-stats"] as const,

  // ── Partner Stats ─────────────────────────────────────
  partnerStats: ["partner-stats"] as const,

  // ── Directory Cache ───────────────────────────────────
  directoryCache: (countryCodes: string[], networkKeys: string[]) =>
    ["directory-cache", countryCodes, networkKeys] as const,
  directoryCacheAll: ["directory-cache"] as const,

  // ── DB Partners for Countries ─────────────────────────
  dbPartnersForCountries: (countryCodes: string[]) =>
    ["db-partners-for-countries", countryCodes] as const,
  dbPartnersForCountriesAll: ["db-partners-for-countries"] as const,

  // ── No Profile WCA IDs ────────────────────────────────
  noProfileWcaIds: (countryCodes: string[]) =>
    ["no-profile-wca-ids", countryCodes] as const,

  // ── Cache Data by Country ─────────────────────────────
  cacheDataByCountry: ["cache-data-by-country"] as const,

  // ── Credits ───────────────────────────────────────────
  credits: {
    all: ["user-credits"] as const,
  },

  // ── Subscription ──────────────────────────────────────
  subscription: {
    all: ["subscription"] as const,
  },

  // ── Prospects ─────────────────────────────────────────
  prospects: {
    all: ["prospects"] as const,
    byAteco: (filters?: unknown) => ["prospects-by-ateco", filters] as const,
    contacts: (prospectId: string) => ["prospect-contacts", prospectId] as const,
    globalStats: ["prospect-global-stats"] as const,
    ra: {
      prospect: (id: string) => ["ra-prospect", id] as const,
      contacts: (id: string) => ["ra-prospect-contacts", id] as const,
      interactions: (id: string) => ["ra-prospect-interactions", id] as const,
    },
  },

  // ── Blacklist ─────────────────────────────────────────
  blacklist: {
    all: ["blacklist-entries"] as const,
    stats: ["blacklist-stats"] as const,
    syncLog: ["blacklist-sync-log"] as const,
    partnerIds: ["blacklist-partner-ids"] as const,
    partner: (partnerId: string) => ["blacklist-partner", partnerId] as const,
  },

  // ── AI ────────────────────────────────────────────────
  ai: {
    suggestions: ["ai-suggestions"] as const,
    memories: ["ai-memories"] as const,
    pendingActions: ["ai-pending-actions"] as const,
    agentPendingActions: ["agent-pending-actions"] as const,
    decisionLog: (filters?: unknown) => ["ai-decision-log", filters] as const,
    performance: {
      kpi: ["ai-performance-kpi"] as const,
      types: ["ai-performance-types"] as const,
      critical: ["ai-performance-critical"] as const,
    },
  },

  // ── Agents ────────────────────────────────────────────
  agents: {
    all: ["agents"] as const,
    tasks: (filters?: unknown) => ["agent-tasks", filters] as const,
    clients: (agentId: string) => ["agent-clients", agentId] as const,
    forRecord: (sourceId: string) => ["agent-for-record", sourceId] as const,
    dashboard: {
      tasks: (filters?: unknown) => ["agent-dashboard-tasks", filters] as const,
      agents: ["agent-dashboard-agents"] as const,
    },
  },

  // ── Missions ──────────────────────────────────────────
  missions: {
    activeActions: (filters?: unknown) => ["active-mission-actions", filters] as const,
    actions: (missionId: string) => ["mission-actions", missionId] as const,
    recipientSearch: (q: string) => ["mission-recipient-search", q] as const,
  },

  // ── Operators ─────────────────────────────────────────
  operators: {
    all: ["operators"] as const,
    current: ["current-operator"] as const,
    adminCheck: ["my-operator-admin-check"] as const,
  },

  // ── Client Assignments ────────────────────────────────
  clientAssignments: {
    all: ["client-assignments"] as const,
  },

  // ── Reminders ─────────────────────────────────────────
  reminders: {
    all: ["reminders"] as const,
  },

  // ── Network Configs ───────────────────────────────────
  networkConfigs: {
    all: ["network-configs"] as const,
  },

  // ── App Settings ──────────────────────────────────────
  appSettings: {
    all: ["app-settings"] as const,
  },

  // ── Alert Config ──────────────────────────────────────
  alertConfig: {
    all: ["alert-config"] as const,
  },

  // ── Authorized Users ──────────────────────────────────
  authorizedUsers: {
    all: ["authorized-users"] as const,
  },

  // ── Onboarding ────────────────────────────────────────
  onboarding: {
    completed: ["onboarding-completed"] as const,
    check: ["onboarding-check"] as const,
  },

  // ── Daily Briefing ────────────────────────────────────
  dailyBriefing: {
    all: ["daily-briefing"] as const,
  },

  // ── System ────────────────────────────────────────────
  system: {
    health: ["system-health"] as const,
    directory: ["system-directory"] as const,
    errorLogs: ["error-logs"] as const,
  },

  // ── Telemetry ─────────────────────────────────────────
  telemetry: {
    requestLogs: (filters?: unknown) => ["telemetry-request-logs", filters] as const,
    pageEvents: (filters?: unknown) => ["telemetry-page-events", filters] as const,
    aiRequests: (filters?: unknown) => ["telemetry-ai-requests", filters] as const,
  },

  // ── Timing Templates ──────────────────────────────────
  timingTemplates: {
    all: ["timing-templates"] as const,
  },

  // ── Send Gate ─────────────────────────────────────────
  sendGate: {
    rules: ["send-gate-rules"] as const,
    context: (filters?: unknown) => ["send-gate-context", filters] as const,
  },

  // ── Pending Task Count ────────────────────────────────
  pendingTaskCount: ["pending-task-count"] as const,

  // ── Workspace Documents ───────────────────────────────
  workspaceDocs: {
    all: ["workspace-documents-all"] as const,
  },

  // ── Enrichment ────────────────────────────────────────
  enrichment: {
    contacts: (filters?: unknown) => ["enrichment-contacts", filters] as const,
    emailSenders: (filters?: unknown) => ["enrichment-email-senders", filters] as const,
    cockpit: (filters?: unknown) => ["enrichment-cockpit", filters] as const,
    bca: (filters?: unknown) => ["enrichment-bca", filters] as const,
  },

  // ── Dashboard ─────────────────────────────────────────
  dashboard: {
    responseCountry: (filters?: unknown) => ["dashboard-response-country", filters] as const,
    leadScoreDist: ["dashboard-lead-score-dist"] as const,
    channelDist: ["dashboard-channel-dist"] as const,
    activityTrend: (filters?: unknown) => ["dashboard-activity-trend", filters] as const,
  },

  // ── Guida ─────────────────────────────────────────────
  guida: {
    stats: ["guida-stats"] as const,
    agents: ["guida-agents"] as const,
  },

  // ── Supervisor ────────────────────────────────────────
  supervisor: {
    kpis: ["supervisor-kpis"] as const,
    feed: (filters?: unknown) => ["supervisor-feed", filters] as const,
  },

  // ── IntelliFlow ───────────────────────────────────────
  intelliflow: {
    stats: ["intelliflow-stats"] as const,
  },

  // ── Arena ─────────────────────────────────────────────
  arena: {
    suggestions: (filters?: unknown) => ["arena-suggestions", filters] as const,
  },

  // ── Super Home ────────────────────────────────────────
  superHome: {
    count: ["super-home-count"] as const,
  },

  // ── Conversation Context ──────────────────────────────
  convContext: {
    byEmail: (email: string) => ["conv-context", email] as const,
  },

  // ── AB Tests ──────────────────────────────────────────
  abTests: {
    all: ["ab-tests"] as const,
  },

  // ── Ops Center ────────────────────────────────────────
  opsCenter: {
    emailQueue: (filters?: unknown) => ["ops-center-email-queue", filters] as const,
    agentTasks: (filters?: unknown) => ["ops-center-agent-tasks", filters] as const,
    activities: (filters?: unknown) => ["ops-center-activities", filters] as const,
  },

  // ── Group Address Counts ──────────────────────────────
  groupAddressCounts: (group?: string) => ["group-address-counts", group] as const,

  // ═══ V2 namespace ═════════════════════════════════════
  v2: {
    settings: ["v2-settings"] as const,
    operators: ["v2-operators"] as const,
    aiMemoryStats: ["v2-ai-memory-stats"] as const,
    memoryCount: ["v2-memory-count"] as const,
    kbCount: ["v2-kb-count"] as const,
    recipientSearch: (q: string) => ["v2-recipient-search", q] as const,
    dataCounts: ["v2-data-counts"] as const,
    enrichmentCounts: ["v2-enrichment-counts"] as const,

    contacts: (filters?: unknown) => ["v2", "contacts", filters] as const,
    contact: (id: string) => ["v2", "contact", id] as const,
    blacklist: ["v2", "blacklist"] as const,
    channelMessages: (direction?: string, limit?: number) =>
      ["v2", "channel-messages", direction ?? "all", limit] as const,
    businessCards: (partnerId?: string) => ["v2", "business-cards", partnerId ?? "all"] as const,
    creditBalance: ["v2", "credit-balance"] as const,
    creditTransactions: ["v2", "credit-transactions"] as const,
    campaignDrafts: (filters?: unknown) => ["v2", "campaign-drafts", filters] as const,
    kbEntries: (filters?: unknown) => ["v2", "kb-entries", filters] as const,
    workspaceDocs: (filters?: unknown) => ["v2", "workspace-docs", filters] as const,
    outreachQueue: (filters?: unknown) => ["v2", "outreach-queue", filters] as const,
    sortingRules: ["v2", "sorting-rules"] as const,
    emailDownload: (filters?: unknown) => ["v2", "email-download", filters] as const,
    emailTemplates: ["v2", "email-templates"] as const,
    authorizedUsers: ["v2", "authorized-users"] as const,
    importLogs: ["v2-import-logs"] as const,
    importLogsRecent: ["v2-import-logs-recent"] as const,
    countryStats: ["v2-country-stats"] as const,
    partners: (filters?: unknown) => ["v2", "partners", filters] as const,
    partnerFacets: (filters?: unknown) => ["v2", "partner-facets", filters] as const,
    prospects: (filters?: unknown) => ["v2", "prospects", filters] as const,
    prospectPipeline: (filters?: unknown) => ["v2", "prospect-pipeline", filters] as const,
    activities: (filters?: unknown) => ["v2", "activities", filters] as const,
    sortingJobs: ["v2", "sorting-jobs"] as const,
    downloadJobs: (filters?: unknown) => ["v2", "download-jobs", filters] as const,
    emailSync: (filters?: unknown) => ["v2", "email-sync", filters] as const,
    emailCampaignQueue: (filters?: unknown) => ["v2", "email-campaign-queue", filters] as const,
    dailyBriefing: ["v2", "daily-briefing"] as const,
    dashboardMetrics: (filters?: unknown) => ["v2", "dashboard-metrics", filters] as const,
    agentTasks: (filters?: unknown) => ["v2", "agent-tasks", filters] as const,
    agents: (filters?: unknown) => ["v2", "agents", filters] as const,
    agentChat: (agentId: string) => ["v2", "agent-chat", agentId] as const,
    cockpit: (filters?: unknown) => ["v2", "cockpit", filters] as const,
    aiLab: (filters?: unknown) => ["v2", "ai-lab", filters] as const,
    inreach: (filters?: unknown) => ["v2", "inreach", filters] as const,
    acquisition: (filters?: unknown) => ["v2", "acquisition", filters] as const,
    staff: (filters?: unknown) => ["v2", "staff", filters] as const,
    raScrapingJobs: (filters?: unknown) => ["v2", "ra-scraping-jobs", filters] as const,
    operativePrompts: ["v2", "operative-prompts"] as const,
    acquisitionStats: ["v2", "acquisition-stats"] as const,
    campaignStats: ["v2", "campaign-stats"] as const,
    campaignQueueItems: (draftId?: string) => ["v2", "campaign-queue-items", draftId] as const,
    campaignJobs: (batchId?: string) => ["v2", "campaign-jobs", batchId] as const,
    cockpitQueue: ["v2", "cockpit-queue"] as const,
    operationsQueue: ["v2", "operations-queue"] as const,
    emailSyncJobs: ["v2", "email-sync-jobs"] as const,
    workPlans: ["v2", "work-plans"] as const,
    unreadCounts: ["v2", "unread-counts"] as const,
    adminUsers: ["v2", "admin-users"] as const,
    agentDetail: (agentId: string) => ["v2", "agent-detail", agentId] as const,
    campaignQueue: (draftId?: string) => ["v2", "campaign-queue", draftId ?? "global"] as const,
    partnersInfinite: (filters?: unknown) => ["v2", "partners-infinite", filters] as const,
    partnerDetail: (partnerId?: string) => ["v2", "partner", partnerId] as const,
    dashboard: ["v2", "dashboard", "metrics"] as const,
  },

  // ── Misc / Uncategorized ──────────────────────────────
  responseRateCard: ["response-rate-card"] as const,
  activeSchedules: ["active-schedules"] as const,
  atecoGroups: ["ateco-groups"] as const,
  noop: ["noop"] as const,
} as const;
