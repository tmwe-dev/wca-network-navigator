import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, Loader2, Sparkles, RotateCcw, ChevronDown, Building2, TrendingUp } from "lucide-react";
import { DEFAULT_SALES_KNOWLEDGE_BASE } from "@/data/salesKnowledgeBase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function KnowledgeBaseManager() {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [companyKB, setCompanyKB] = useState("");
  const [salesKB, setSalesKB] = useState("");
  const [companyOpen, setCompanyOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(true);
  const [improvingCompany, setImprovingCompany] = useState(false);
  const [improvingSales, setImprovingSales] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompanyKB(settings.ai_knowledge_base || "");
      setSalesKB(settings.ai_sales_knowledge_base || DEFAULT_SALES_KNOWLEDGE_BASE);
    }
  }, [settings]);

  const handleSave = async (key: string, value: string) => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key, value });
      toast.success("Knowledge Base salvata");
    } catch { toast.error("Errore nel salvataggio"); }
    finally { setSaving(false); }
  };

  const handleImprove = async (type: "company" | "sales") => {
    const content = type === "company" ? companyKB : salesKB;
    if (!content.trim()) return;
    const setter = type === "company" ? setImprovingCompany : setImprovingSales;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-email", {
        body: { html: content, tone: "professionale", improveType: "kb" },
      });
      if (error) throw error;
      if (data?.html) {
        if (type === "company") setCompanyKB(data.html);
        else setSalesKB(data.html);
        toast.success("KB migliorata con AI");
      }
    } catch (e: any) {
      toast.error("Errore: " + (e.message || "sconosciuto"));
    } finally { setter(false); }
  };

  const resetSalesKB = () => {
    setSalesKB(DEFAULT_SALES_KNOWLEDGE_BASE);
    toast.info("SKB ripristinata ai valori predefiniti. Salva per confermare.");
  };

  return (
    <div className="space-y-4">
      {/* Usage info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Utilizzata da:</span>
        <Badge variant="outline" className="text-[10px]">Cockpit</Badge>
        <Badge variant="outline" className="text-[10px]">Email Composer</Badge>
        <Badge variant="outline" className="text-[10px]">Agenti AI</Badge>
      </div>

      {/* Company KB */}
      <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">KB Aziendale</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{companyKB.length} caratteri</Badge>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${companyOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              <p className="text-[10px] text-muted-foreground">Chi siamo, servizi offerti, certificazioni, punti di forza, network.</p>
              <Textarea
                value={companyKB}
                onChange={e => setCompanyKB(e.target.value)}
                className="text-xs min-h-[180px] font-mono"
                placeholder="Inserisci informazioni sull'azienda..."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleSave("ai_knowledge_base", companyKB)} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salva
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleImprove("company")} disabled={improvingCompany}>
                  {improvingCompany ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Migliora con AI
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sales KB */}
      <Collapsible open={salesOpen} onOpenChange={setSalesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm">Tecniche di Vendita (SKB)</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{salesKB.length} caratteri</Badge>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${salesOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              <p className="text-[10px] text-muted-foreground">Tecniche Chris Voss, Black Swan, regole strategiche, modelli Gold Standard.</p>
              <Textarea
                value={salesKB}
                onChange={e => setSalesKB(e.target.value)}
                className="text-xs min-h-[200px] font-mono"
                placeholder="Tecniche di vendita e negoziazione..."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleSave("ai_sales_knowledge_base", salesKB)} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salva
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleImprove("sales")} disabled={improvingSales}>
                  {improvingSales ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Migliora con AI
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={resetSalesKB}>
                  <RotateCcw className="w-3 h-3" /> Reset default
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
