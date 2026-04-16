/**
 * AgentPersonaEditorPage — Full persona editor with live prompt preview
 * V2 logic-less: all state in hooks
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgentPersona } from "@/v2/hooks/useAgentPersona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Eye, Plus, X, Sparkles } from "lucide-react";

const TONE_OPTIONS = ["professional", "friendly", "formal", "casual", "assertive", "empathetic", "direct"];
const LANG_OPTIONS = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
];

export function AgentPersonaEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const agentId = searchParams.get("agent_id") || "";

  // Load agent info
  const { data: agent } = useQuery({
    queryKey: ["agent-detail", agentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, name, role, avatar_emoji, system_prompt")
        .eq("id", agentId)
        .maybeSingle();
      return data;
    },
    enabled: !!agentId,
  });

  const { persona, isLoading, upsert } = useAgentPersona(agentId);

  // Local form state
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("it");
  const [styleRules, setStyleRules] = useState<string[]>([]);
  const [vocDo, setVocDo] = useState<string[]>([]);
  const [vocDont, setVocDont] = useState<string[]>([]);
  const [examples, setExamples] = useState<Array<{ role: string; content: string }>>([]);
  const [signature, setSignature] = useState("");
  const [newRule, setNewRule] = useState("");
  const [newVocDo, setNewVocDo] = useState("");
  const [newVocDont, setNewVocDont] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Seed from existing persona
  useEffect(() => {
    if (persona) {
      setTone(persona.tone);
      setLanguage(persona.language);
      setStyleRules(persona.style_rules);
      setVocDo(persona.vocabulary_do);
      setVocDont(persona.vocabulary_dont);
      setExamples(persona.example_messages);
      setSignature(persona.signature_template || "");
    }
  }, [persona]);

  // Live prompt preview
  const promptPreview = useMemo(() => {
    let prompt = agent?.system_prompt?.substring(0, 200) || "Sei un agente AI.";
    prompt += "\n\n--- PERSONA ---";
    prompt += `\nTONO: ${tone}`;
    prompt += `\nLINGUA: ${LANG_OPTIONS.find(l => l.value === language)?.label || language}`;
    if (styleRules.length) prompt += `\nSTILE:\n${styleRules.map(r => `- ${r}`).join("\n")}`;
    if (vocDo.length) prompt += `\nUSA SEMPRE: ${vocDo.join(", ")}`;
    if (vocDont.length) prompt += `\nEVITA SEMPRE: ${vocDont.join(", ")}`;
    if (examples.length) {
      prompt += `\nESEMPI:`;
      for (const ex of examples) prompt += `\n[${ex.role}]: ${ex.content}`;
    }
    if (signature) prompt += `\nFIRMA: ${signature}`;
    return prompt;
  }, [agent, tone, language, styleRules, vocDo, vocDont, examples, signature]);

  const handleSave = () => {
    upsert.mutate({
      agent_id: agentId,
      tone,
      language,
      style_rules: styleRules,
      vocabulary_do: vocDo,
      vocabulary_dont: vocDont,
      example_messages: examples,
      signature_template: signature || null,
      kb_filter: {},
    });
  };

  const addToList = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setValue("");
    }
  };

  const removeFromList = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  if (!agentId) {
    return <div className="p-8 text-muted-foreground">Seleziona un agente dalla pagina Agenti.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/v2/agents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {agent?.avatar_emoji} Persona: {agent?.name || "..."}
            <Badge variant="outline">{agent?.role}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Configura tono, stile e vocabolario dell'agente</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
          <Eye className="h-4 w-4 mr-1" /> Preview
        </Button>
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
          <Save className="h-4 w-4 mr-1" /> Salva
        </Button>
      </div>

      <div className={`grid gap-6 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Editor */}
        <div className="space-y-4">
          {/* Tone & Language */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Tono e Lingua</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tono</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lingua</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANG_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Style Rules */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Regole di Stile</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input value={newRule} onChange={e => setNewRule(e.target.value)} placeholder="Es: Usa frasi brevi e dirette"
                  onKeyDown={e => e.key === "Enter" && addToList(styleRules, setStyleRules, newRule, setNewRule)} />
                <Button size="icon" variant="outline" onClick={() => addToList(styleRules, setStyleRules, newRule, setNewRule)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {styleRules.map((r, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {r} <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(styleRules, setStyleRules, i)} />
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vocabulary */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Vocabolario</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-accent-foreground">✅ Usa sempre</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={newVocDo} onChange={e => setNewVocDo(e.target.value)} placeholder="Es: partnership, collaborazione"
                    onKeyDown={e => e.key === "Enter" && addToList(vocDo, setVocDo, newVocDo, setNewVocDo)} />
                  <Button size="icon" variant="outline" onClick={() => addToList(vocDo, setVocDo, newVocDo, setNewVocDo)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vocDo.map((v, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {v} <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(vocDo, setVocDo, i)} />
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-destructive">❌ Evita sempre</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={newVocDont} onChange={e => setNewVocDont(e.target.value)} placeholder="Es: SPAM, urgente!!!"
                    onKeyDown={e => e.key === "Enter" && addToList(vocDont, setVocDont, newVocDont, setNewVocDont)} />
                  <Button size="icon" variant="outline" onClick={() => addToList(vocDont, setVocDont, newVocDont, setNewVocDont)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vocDont.map((v, i) => (
                    <Badge key={i} variant="destructive" className="gap-1">
                      {v} <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(vocDont, setVocDont, i)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Example Messages */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Messaggi d'Esempio</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {examples.map((ex, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Badge variant="outline" className="mt-1 min-w-[60px] justify-center">{ex.role}</Badge>
                  <Textarea value={ex.content} className="min-h-[60px]"
                    onChange={e => {
                      const updated = [...examples];
                      updated[i] = { ...updated[i], content: e.target.value };
                      setExamples(updated);
                    }} />
                  <Button size="icon" variant="ghost" onClick={() => setExamples(examples.filter((_, idx) => idx !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setExamples([...examples, { role: "agent", content: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Esempio agente
                </Button>
                <Button size="sm" variant="outline" onClick={() => setExamples([...examples, { role: "user", content: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Esempio utente
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Firma</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={signature} onChange={e => setSignature(e.target.value)}
                placeholder="Es: Cordiali saluti,\n{agent_name}\n{company}" className="min-h-[80px]" />
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {showPreview && (
          <Card className="h-fit sticky top-4">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Prompt Composto (Preview)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 rounded p-3 max-h-[70vh] overflow-auto text-foreground">
                {promptPreview}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
