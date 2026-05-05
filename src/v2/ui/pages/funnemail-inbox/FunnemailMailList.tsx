/**
 * FunnemailMailList — lista email del client Funnemail con sort/raggruppamento.
 *
 * Modalità:
 *  - Raggruppa = "none": lista virtualizzata piatta (TanStack Virtual).
 *  - Raggruppa = "company" | "sender": sezioni collassabili con menu Azioni gruppo.
 *
 * Persistenza preferenze: localStorage (`funnemail_list_view_v1`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHoldingPatternEmails } from "@/hooks/useHoldingPatternEmails";
import { useEmailAddressGroups } from "@/hooks/useEmailAddressGroups";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { extractSenderName, stripReplyPrefixes } from "./utils";
import { FunnemailMailCard } from "./FunnemailMailCard";
import { FunnemailListToolbar, type GroupMode, type SortMode } from "./FunnemailListToolbar";
import { FunnemailGroupHeader } from "./FunnemailGroupHeader";
import { FunnemailBulkBar } from "./FunnemailBulkBar";

const ROW_HEIGHT = 124;
const STORAGE_KEY = "funnemail_list_view_v4";

interface StoredPrefs {
  sort: SortMode;
  group: GroupMode;
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sort: "date_desc", group: "none" };
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      sort: parsed.sort ?? "date_desc",
      group: parsed.group ?? "none",
    };
  } catch {
    return { sort: "date_desc", group: "none" };
  }
}

function savePrefs(p: StoredPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

interface Props {
  messages: ChannelMessage[];
  selectedId: string | null;
  onSelect: (msg: ChannelMessage) => void;
  bulkMarkRead: (msgs: ChannelMessage[]) => Promise<void>;
  bulkArchive: (msgs: ChannelMessage[]) => void;
  bulkDelete: (msgs: ChannelMessage[]) => void;
  bulkAssignGroup: (msgs: ChannelMessage[], groupName: string) => Promise<void>;
  bulkBusy: boolean;
}

function getCompanyKey(msg: ChannelMessage): string {
  const { brand } = extractSenderBrand(msg.from_address || "");
  return (brand || "—").trim();
}

function getSenderKey(msg: ChannelMessage): string {
  return extractSenderName(msg.from_address);
}

function sortMessages(msgs: ChannelMessage[], mode: SortMode): ChannelMessage[] {
  const arr = [...msgs];
  switch (mode) {
    case "company_asc":
      arr.sort((a, b) => getCompanyKey(a).localeCompare(getCompanyKey(b)));
      break;
    case "sender_asc":
      arr.sort((a, b) => getSenderKey(a).localeCompare(getSenderKey(b)));
      break;
    case "subject_asc":
      arr.sort((a, b) =>
        stripReplyPrefixes(a.subject).localeCompare(stripReplyPrefixes(b.subject)),
      );
      break;
    case "date_desc":
    default: {
      arr.sort((a, b) => {
        const da = new Date(a.email_date || a.created_at).getTime();
        const db = new Date(b.email_date || b.created_at).getTime();
        return db - da;
      });
      break;
    }
  }
  return arr;
}

export function FunnemailMailList({
  messages, selectedId, onSelect,
  bulkMarkRead, bulkArchive, bulkDelete, bulkAssignGroup, bulkBusy,
}: Props): JSX.Element {
  const [{ sort, group }, setPrefs] = useState<StoredPrefs>(() => loadPrefs());
  useEffect(() => { savePrefs({ sort, group }); }, [sort, group]);

  const { getGroup } = useEmailAddressGroups();

  // Multi-selezione manuale
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const toggleChecked = (id: string) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearChecked = () => setCheckedIds(new Set());
  const addManyChecked = (ids: string[]) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });

  // Reset selezione se cambiano sort/group/filtri (lista cambia identità)
  useEffect(() => { clearChecked(); }, [sort, group]);

  const checkedMessages = useMemo(
    () => messages.filter((m) => checkedIds.has(m.id)),
    [messages, checkedIds],
  );

  const sourceIds = useMemo(() => {
    const ids: { partnerId?: string; contactId?: string }[] = [];
    messages.forEach((msg) => {
      if (msg.partner_id) ids.push({ partnerId: msg.partner_id });
      if (msg.source_type === "imported_contact" && msg.source_id) ids.push({ contactId: msg.source_id });
    });
    return ids;
  }, [messages]);
  const holdingSet = useHoldingPatternEmails(sourceIds);

  const sortedAll = useMemo(() => sortMessages(messages, sort), [messages, sort]);

  const renderCard = (msg: ChannelMessage) => {
    const inHolding = msg.partner_id
      ? holdingSet.has(`p:${msg.partner_id}`)
      : msg.source_type === "imported_contact" && msg.source_id
        ? holdingSet.has(`c:${msg.source_id}`)
        : false;
    const grp = getGroup(msg.from_address);
    const aiRaw = (msg as ChannelMessage & { ai_classification_suggestion?: { category?: string; suggested_group?: string | null; reason?: string | null } | null }).ai_classification_suggestion;
    const aiSuggestion = aiRaw && (aiRaw.suggested_group || aiRaw.category)
      ? { label: aiRaw.suggested_group || aiRaw.category || "", reason: aiRaw.reason ?? null }
      : null;
    return (
      <FunnemailMailCard
        message={msg}
        selected={msg.id === selectedId}
        inHolding={inHolding}
        groupName={grp?.groupName ?? null}
        groupColor={grp?.groupColor ?? null}
        groupIcon={grp?.groupIcon ?? null}
        aiSuggestion={aiSuggestion}
        onSelect={() => onSelect(msg)}
        showCheckbox
        checked={checkedIds.has(msg.id)}
        onToggleChecked={() => toggleChecked(msg.id)}
      />
    );
  };

  const toolbar = (
    <FunnemailListToolbar
      sort={sort}
      group={group}
      onSortChange={(s) => setPrefs((p) => ({ ...p, sort: s }))}
      onGroupChange={(g) => setPrefs((p) => ({ ...p, group: g }))}
      totalCount={messages.length}
      checkedCount={checkedIds.size}
      onSelectAll={() => setCheckedIds(new Set(messages.map((m) => m.id)))}
      onClearSelection={clearChecked}
    />
  );

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {toolbar}
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          Nessuna email in questa cartella
        </div>
      </div>
    );
  }

  if (group === "none") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {toolbar}
        <FlatVirtualList
          messages={sortedAll}
          selectedId={selectedId}
          renderCard={renderCard}
        />
        {checkedIds.size > 0 && (
          <FunnemailBulkBar
            count={checkedIds.size}
            busy={bulkBusy}
            onClear={clearChecked}
            onMarkRead={() => { void bulkMarkRead(checkedMessages); clearChecked(); }}
            onAssignGroup={(name) => { void bulkAssignGroup(checkedMessages, name); clearChecked(); }}
            onArchive={() => { bulkArchive(checkedMessages); clearChecked(); }}
            onDelete={() => { bulkDelete(checkedMessages); clearChecked(); }}
            selectedIds={checkedMessages.map((m) => m.id)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toolbar}
      <GroupedList
        messages={sortedAll}
        groupMode={group}
        renderCard={renderCard}
        bulkMarkRead={bulkMarkRead}
        bulkArchive={bulkArchive}
        bulkDelete={bulkDelete}
        bulkAssignGroup={bulkAssignGroup}
        bulkBusy={bulkBusy}
        onSelectGroup={(msgs) => addManyChecked(msgs.map((m) => m.id))}
      />
      {checkedIds.size > 0 && (
        <FunnemailBulkBar
          count={checkedIds.size}
          busy={bulkBusy}
          onClear={clearChecked}
          onMarkRead={() => { void bulkMarkRead(checkedMessages); clearChecked(); }}
          onAssignGroup={(name) => { void bulkAssignGroup(checkedMessages, name); clearChecked(); }}
          onArchive={() => { bulkArchive(checkedMessages); clearChecked(); }}
          onDelete={() => { bulkDelete(checkedMessages); clearChecked(); }}
          selectedIds={checkedMessages.map((m) => m.id)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

interface FlatProps {
  messages: ChannelMessage[];
  selectedId: string | null;
  renderCard: (msg: ChannelMessage) => JSX.Element;
}

function FlatVirtualList({ messages, selectedId, renderCard }: FlatProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  useEffect(() => {
    if (!selectedId) return;
    const idx = messages.findIndex((m) => m.id === selectedId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [selectedId, messages, virtualizer]);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const msg = messages[row.index];
          return (
            <div
              key={msg.id}
              style={{
                position: "absolute",
                top: 0, left: 0, width: "100%",
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {renderCard(msg)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface GroupedProps {
  messages: ChannelMessage[];
  groupMode: Exclude<GroupMode, "none">;
  renderCard: (msg: ChannelMessage) => JSX.Element;
  bulkMarkRead: (msgs: ChannelMessage[]) => Promise<void>;
  bulkArchive: (msgs: ChannelMessage[]) => void;
  bulkDelete: (msgs: ChannelMessage[]) => void;
  bulkAssignGroup: (msgs: ChannelMessage[], groupName: string) => Promise<void>;
  bulkBusy: boolean;
  onSelectGroup?: (msgs: ChannelMessage[]) => void;
}

function GroupedList({
  messages, groupMode, renderCard,
  bulkMarkRead, bulkArchive, bulkDelete, bulkAssignGroup, bulkBusy,
  onSelectGroup,
}: GroupedProps): JSX.Element {
  const groups = useMemo(() => {
    const map = new Map<string, ChannelMessage[]>();
    for (const m of messages) {
      const key = groupMode === "company" ? getCompanyKey(m) : getSenderKey(m);
      const list = map.get(key);
      if (list) list.push(m);
      else map.set(key, [m]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [messages, groupMode]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {groups.map(([key, msgs]) => {
        const expanded = !collapsed.has(key);
        return (
          <section key={key}>
            <FunnemailGroupHeader
              label={key}
              count={msgs.length}
              expanded={expanded}
              onToggle={() => toggle(key)}
              busy={bulkBusy}
              onMarkAllRead={() => { void bulkMarkRead(msgs); }}
              onAssignGroup={(groupName) => { void bulkAssignGroup(msgs, groupName); }}
              onArchiveAll={() => bulkArchive(msgs)}
              onDeleteAll={() => bulkDelete(msgs)}
              onSelectAll={onSelectGroup ? () => onSelectGroup(msgs) : undefined}
            />
            {expanded && (
              <div>
                {msgs.map((msg) => (
                  <div key={msg.id}>{renderCard(msg)}</div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
