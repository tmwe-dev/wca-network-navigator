/**
 * ABTestCreator — Dialog to create A/B email tests
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { FlaskConical, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const TEST_TYPES = [
  { value: "subject", label: "Oggetto" },
  { value: "cta", label: "Call to Action" },
  { value: "tone", label: "Tono" },
  { value: "body", label: "Corpo intero" },
] as const;

export function ABTestCreator() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [testType, setTestType] = useState("subject");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [splitRatio, setSplitRatio] = useState([50]);
  const [generating, setGenerating] = useState(false);
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const fieldKey = testType === "body" ? "body" : testType;
      const { error } = await supabase.from("ab_tests").insert({
        user_id: user.id,
        test_name: name,
        test_type: testType,
        variant_a: { [fieldKey]: variantA } as Record<string, unknown>,
        variant_b: { [fieldKey]: variantB } as Record<string, unknown>,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("A/B Test creato");
      qc.invalidateQueries({ queryKey: ["ab-tests"] });
      setOpen(false);
      setName("");
      setVariantA("");
      setVariantB("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGenerateB = async () => {
    if (!variantA.trim()) {
      toast.error("Inserisci prima la Variante A");
      return;
    }
    setGenerating(true);
    try {
      const data = await invokeEdge<{ choices?: { message?: { content?: string } }[]; content?: string; text?: string }>("ai-assistant", {
        body: {
          messages: [
            { role: "system", content: "Genera una variante alternativa per un A/B test email. Rispondi SOLO con il testo della variante, niente altro." },
            { role: "user", content: `Tipo: ${testType}. Variante originale: "${variantA}". Genera una variante B diversa ma con lo stesso intento.` },
          ],
        },
        context: "ABTestCreator.generateB",
      });
      const text = data?.choices?.[0]?.message?.content || data?.content || data?.text || "";
      if (text) setVariantB(text.trim().replace(/^["']|["']$/g, ""));
      else toast.error("Nessuna risposta AI");
    } catch {
      toast.error("Errore generazione AI");
    } finally {
      setGenerating(false);
    }
  };

  const isBody = testType === "body";
  const InputComp = isBody ? Textarea : Input;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <FlaskConical className="w-3.5 h-3.5" /> A/B Test
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Nuovo A/B Test
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome test</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="es. Test oggetto Q2 2026" className="h-8 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo test</Label>
            <Select value={testType} onValueChange={setTestType}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEST_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Variante A</Label>
              <InputComp value={variantA} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVariantA(e.target.value)} placeholder="Testo variante A..." className="text-sm" rows={isBody ? 4 : undefined} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Variante B</Label>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={handleGenerateB} disabled={generating}>
                  <Sparkles className="w-3 h-3" /> {generating ? "..." : "Genera AI"}
                </Button>
              </div>
              <InputComp value={variantB} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVariantB(e.target.value)} placeholder="Testo variante B..." className="text-sm" rows={isBody ? 4 : undefined} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Split ratio: {splitRatio[0]}% A / {100 - splitRatio[0]}% B</Label>
            <Slider value={splitRatio} onValueChange={setSplitRatio} min={30} max={70} step={10} className="py-2" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !variantA.trim() || !variantB.trim() || createMutation.isPending}
          >
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Avvia Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
