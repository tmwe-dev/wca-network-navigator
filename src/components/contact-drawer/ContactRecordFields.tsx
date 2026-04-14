import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Pencil, X, Globe, Mail, Phone, MapPin, Briefcase, Building2, Linkedin, StickyNote } from "lucide-react";
import { HoldingPatternIndicator } from "@/components/contacts/HoldingPatternIndicator";
import type { UnifiedRecord } from "@/hooks/useContactRecord";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "in_progress", label: "In corso" },
  { value: "negotiation", label: "Trattativa" },
  { value: "converted", label: "Cliente" },
  { value: "lost", label: "Perso" },
];

interface Props {
  record: UnifiedRecord;
  onSave: (updates: Record<string, unknown>) => void;
  isSaving: boolean;
}

interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
}

function FieldRow({ icon, label, value, editing, onChange, type = "text" }: FieldRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-[11px] text-muted-foreground w-20 flex-shrink-0">{label}</span>
      {editing ? (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-7 text-xs flex-1"
          type={type}
        />
      ) : (
        <span className={cn("text-xs flex-1 truncate", value ? "text-foreground" : "text-muted-foreground/50")}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

export function ContactRecordFields({ record, onSave, isSaving }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const startEdit = () => {
    setDraft({
      company_name: record.companyName || "",
      contact_name: record.contactName || "",
      email: record.email || "",
      phone: record.phone || "",
      mobile: record.mobile || "",
      country: record.country || "",
      city: record.city || "",
      address: record.address || "",
      position: record.position || "",
      website: record.website || "",
      note: record.note || "",
      lead_status: record.leadStatus,
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraft({}); };

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    if (record.sourceType === "partner") {
      if (draft.company_name !== record.companyName) updates.company_name = draft.company_name;
      if (draft.email !== (record.email || "")) updates.email = draft.email || null;
      if (draft.phone !== (record.phone || "")) updates.phone = draft.phone || null;
      if (draft.mobile !== (record.mobile || "")) updates.mobile = draft.mobile || null;
      if (draft.position !== (record.position || "")) updates.position = draft.position || null;
      if (draft.city !== (record.city || "")) updates.city = draft.city;
      if (draft.address !== (record.address || "")) updates.address = draft.address || null;
      if (draft.website !== (record.website || "")) updates.website = draft.website || null;
      if (draft.lead_status !== record.leadStatus) updates.lead_status = draft.lead_status;
      if (draft.note !== (record.note || "")) updates.profile_description = draft.note || null;
    } else if (record.sourceType === "contact") {
      if (draft.company_name !== record.companyName) updates.company_name = draft.company_name;
      if (draft.contact_name !== record.contactName) updates.name = draft.contact_name;
      if (draft.email !== (record.email || "")) updates.email = draft.email || null;
      if (draft.phone !== (record.phone || "")) updates.phone = draft.phone || null;
      if (draft.mobile !== (record.mobile || "")) updates.mobile = draft.mobile || null;
      if (draft.city !== (record.city || "")) updates.city = draft.city || null;
      if (draft.position !== (record.position || "")) updates.position = draft.position || null;
      if (draft.lead_status !== record.leadStatus) updates.lead_status = draft.lead_status;
      if (draft.note !== (record.note || "")) updates.note = draft.note || null;
    } else {
      if (draft.lead_status !== record.leadStatus) updates.lead_status = draft.lead_status;
      if (draft.note !== (record.note || "")) updates.notes = draft.note || null;
    }
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    setEditing(false);
  };

  const fieldMap: Record<string, keyof UnifiedRecord> = { contact_name: "contactName", company_name: "companyName", lead_status: "leadStatus" };
  const val = (key: string) => editing ? (draft[key] || "") : (String(record[fieldMap[key] ?? key as keyof UnifiedRecord] ?? ""));

  return (
    <div className="space-y-3">
      {/* Edit/Save toolbar */}
      <div className="flex items-center justify-end gap-1.5 mb-1">
        {editing ? (
          <>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={cancelEdit}>
              <X className="w-3 h-3" /> Annulla
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={isSaving}>
              <Save className="w-3 h-3" /> Salva
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={startEdit}>
            <Pencil className="w-3 h-3" /> Modifica
          </Button>
        )}
      </div>

      {/* Status + Holding Pattern */}
      <div className="flex items-center gap-2">
        <HoldingPatternIndicator status={record.leadStatus as "new" | "contacted" | "in_progress" | "negotiation" | "converted" | "lost"} />
        {editing ? (
          <Select value={draft.lead_status} onValueChange={v => setDraft(d => ({ ...d, lead_status: v }))}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-medium">{STATUS_OPTIONS.find(s => s.value === record.leadStatus)?.label || record.leadStatus}</span>
        )}
      </div>

      {/* Fields grid */}
      <div className="bg-muted/30 rounded-xl p-3 space-y-0.5">
        <FieldRow icon={<Building2 className="w-3.5 h-3.5" />} label="Azienda" value={val("company_name")} editing={editing} onChange={v => setDraft(d => ({ ...d, company_name: v }))} />
        <FieldRow icon={<Briefcase className="w-3.5 h-3.5" />} label="Ruolo" value={val("position") || record.position || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, position: v }))} />
        <FieldRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={val("email") || record.email || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, email: v }))} type="email" />
        <FieldRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefono" value={val("phone") || record.phone || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, phone: v }))} />
        <FieldRow icon={<Phone className="w-3.5 h-3.5" />} label="Mobile" value={val("mobile") || record.mobile || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, mobile: v }))} />
        <FieldRow icon={<MapPin className="w-3.5 h-3.5" />} label="Città" value={val("city") || record.city || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, city: v }))} />
        <FieldRow icon={<Globe className="w-3.5 h-3.5" />} label="Paese" value={val("country") || record.country || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, country: v }))} />
        <FieldRow icon={<Globe className="w-3.5 h-3.5" />} label="Sito web" value={val("website") || record.website || ""} editing={editing} onChange={v => setDraft(d => ({ ...d, website: v }))} />
        {record.linkedinUrl && (
          <div className="flex items-center gap-2 py-1.5">
            <Linkedin className="w-3.5 h-3.5 text-[hsl(210,80%,55%)]" />
            <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0">LinkedIn</span>
            <a href={record.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(210,80%,55%)] hover:underline truncate">
              {record.linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
            </a>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <StickyNote className="w-3 h-3" /> Note
        </div>
        {editing ? (
          <Textarea
            value={draft.note || ""}
            onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
            className="min-h-[80px] text-xs"
            placeholder="Aggiungi note..."
          />
        ) : (
          <p className={cn("text-xs rounded-lg bg-muted/20 p-2 min-h-[40px]", record.note ? "text-foreground" : "text-muted-foreground/50")}>
            {record.note || "Nessuna nota"}
          </p>
        )}
      </div>
    </div>
  );
}