import { createContext, useContext, useState, type ReactNode } from "react";
import { useWorkspaceDocuments, type WorkspaceDoc } from "@/hooks/useWorkspaceDocuments";
import { useWorkspacePresets, type WorkspacePreset } from "@/hooks/useWorkspacePresets";
import type { EmailQuality } from "@/components/workspace/QualitySelector";

export interface SelectedRecipient {
  partnerId: string;
  companyName: string;
  companyAlias?: string;
  contactId?: string;
  contactName?: string;
  contactAlias?: string;
  email: string | null;
  city: string;
  countryName: string;
  countryCode?: string;
  isEnriched: boolean;
}

interface MissionState {
  goal: string;
  setGoal: (v: string) => void;
  baseProposal: string;
  setBaseProposal: (v: string) => void;
  referenceLinks: string[];
  setReferenceLinks: React.Dispatch<React.SetStateAction<string[]>>;
  documents: WorkspaceDoc[];
  uploading: boolean;
  upload: (file: File) => Promise<WorkspaceDoc | null>;
  removeDocument: (id: string) => Promise<void>;
  presets: WorkspacePreset[];
  activePresetId: string | null;
  setActivePresetId: (id: string | null) => void;
  savePreset: (name: string, id?: string) => void;
  deletePreset: (id: string) => void;
  loadPreset: (preset: WorkspacePreset) => void;
  context: string;
  setContext: (v: string) => void;
  quality: EmailQuality;
  setQuality: (q: EmailQuality) => void;
  recipients: SelectedRecipient[];
  addRecipient: (r: SelectedRecipient) => void;
  removeRecipient: (idx: number) => void;
  clearRecipients: () => void;
}

const MissionCtx = createContext<MissionState | null>(null);

export function useMission() {
  const ctx = useContext(MissionCtx);
  if (!ctx) throw new Error("useMission must be used within MissionProvider");
  return ctx;
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const [goal, setGoal] = useState("");
  const [baseProposal, setBaseProposal] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [quality, setQuality] = useState<EmailQuality>("standard");
  const [recipients, setRecipients] = useState<SelectedRecipient[]>([]);

  const addRecipient = (r: SelectedRecipient) => {
    setRecipients(prev => {
      const key = r.contactId ? `${r.partnerId}-${r.contactId}` : r.partnerId;
      if (prev.some(x => (x.contactId ? `${x.partnerId}-${x.contactId}` : x.partnerId) === key)) return prev;
      return [...prev, r];
    });
  };

  const removeRecipientByIdx = (idx: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== idx));
  };

  const clearRecipients = () => setRecipients([]);

  const { documents, uploading, upload, remove } = useWorkspaceDocuments();
  const { presets, save: savePresetMut, remove: removePresetMut } = useWorkspacePresets();

  const loadPreset = (preset: WorkspacePreset) => {
    setGoal(preset.goal || "");
    setBaseProposal(preset.base_proposal || "");
    setReferenceLinks(preset.reference_links || []);
    setContext((preset as any).context || "");
    setActivePresetId(preset.id);
  };

  const savePreset = (name: string, id?: string) => {
    savePresetMut.mutate({
      id,
      name,
      goal,
      base_proposal: baseProposal,
      document_ids: documents.map((d) => d.id),
      reference_links: referenceLinks,
    });
  };

  const deletePreset = (id: string) => {
    removePresetMut.mutate(id);
    if (activePresetId === id) setActivePresetId(null);
  };

  return (
    <MissionCtx.Provider value={{
      goal, setGoal, baseProposal, setBaseProposal,
      referenceLinks, setReferenceLinks,
      documents, uploading, upload, removeDocument: remove,
      presets, activePresetId, setActivePresetId,
      savePreset, deletePreset, loadPreset,
      quality, setQuality,
      recipients, addRecipient, removeRecipient: removeRecipientByIdx, clearRecipients,
    }}>
      {children}
    </MissionCtx.Provider>
  );
}
