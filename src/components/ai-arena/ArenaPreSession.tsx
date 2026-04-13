/**
 * ArenaPreSession — Configuration screen before starting AI Arena session
 */
import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Zap } from "lucide-react";

interface Props {
  focus: string;
  setFocus: (v: string) => void;
  channel: string;
  setChannel: (v: string) => void;
  sendLanguage: string;
  setSendLanguage: (v: string) => void;
  batchSize: number;
  setBatchSize: (v: number) => void;
  onStart: () => void;
}

export function ArenaPreSession({
  focus, setFocus, channel, setChannel, sendLanguage, setSendLanguage,
  batchSize, setBatchSize, onStart,
}: Props): React.ReactElement {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 text-center space-y-6 max-w-lg"
      >
        <div className="h-20 w-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Zap className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">AI Arena</h1>
        <p className="text-muted-foreground">
          L'AI ti propone contatti da raggiungere. Tu confermi, modifichi o salti. Zero decisioni, massima velocità.
        </p>

        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4 text-left">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Focus</Label>
            <Select value={focus} onValueChange={setFocus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">🌍 Tutti</SelectItem>
                <SelectItem value="estero">✈️ Estero</SelectItem>
                <SelectItem value="italia">🇮🇹 Italia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Canale</Label>
            <RadioGroup value={channel} onValueChange={setChannel} className="flex gap-3">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="email" id="ch-email" /><Label htmlFor="ch-email" className="text-sm">Email</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="whatsapp" id="ch-wa" /><Label htmlFor="ch-wa" className="text-sm">WhatsApp</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="linkedin" id="ch-li" /><Label htmlFor="ch-li" className="text-sm">LinkedIn</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Lingua invio</Label>
            <RadioGroup value={sendLanguage} onValueChange={setSendLanguage} className="flex gap-3">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="recipient" id="lang-r" /><Label htmlFor="lang-r" className="text-xs">Destinatario</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="english" id="lang-en" /><Label htmlFor="lang-en" className="text-xs">Inglese</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="italian" id="lang-it" /><Label htmlFor="lang-it" className="text-xs">Italiano</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Batch size: {batchSize}</Label>
            <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={1} max={10} step={1} />
          </div>
        </div>

        <Button size="lg" onClick={onStart} className="w-full text-lg h-14">
          <Zap className="h-5 w-5 mr-2" /> Inizia Sessione
        </Button>
      </motion.div>
    </div>
  );
}
