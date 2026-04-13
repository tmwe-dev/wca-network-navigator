/**
 * ArenaActiveSession — Active session view with card, draft, and controls
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, SkipForward, Ban, Edit3, Settings2, Timer,
  Target, Loader2, Inbox, Globe,
} from "lucide-react";

const ContactCard3D = React.lazy(() => import("@/components/ai-arena/ContactCard3D").then(m => ({ default: m.ContactCard3D })));
import { ConfirmationEffects } from "@/components/ai-arena/ConfirmationEffects";
import { SessionSummary } from "@/components/ai-arena/SessionSummary";
import { TypewriterText } from "@/components/ai-arena/TypewriterText";
import { type Suggestion, type AnimState, type EffectTrigger, LANG_FLAGS } from "./useArenaSession";

interface SessionStats {
  proposed: number;
  confirmed: number;
  skipped: number;
  blocked: number;
  languages: string[];
  circuitBefore: number;
  circuitAfter: number;
}

interface Props {
  // Timer
  minutes: string;
  seconds: string;
  // Counters
  proposed: number;
  confirmed: number;
  skipped: number;
  // Config
  focus: string;
  setFocus: (v: string) => void;
  batchSize: number;
  setBatchSize: (v: number) => void;
  channel: string;
  // Suggestions
  current: Suggestion | null;
  loadingSuggestions: boolean;
  animState: AnimState;
  effectTrigger: EffectTrigger;
  editing: boolean;
  editSubject: string;
  setEditSubject: (v: string) => void;
  editBody: string;
  setEditBody: (v: string) => void;
  // Actions
  handleConfirm: () => void;
  handleSkip: () => void;
  handleBlacklist: () => void;
  handleEdit: () => void;
  endSession: () => void;
  // Stats
  sessionEnded: boolean;
  sessionStats: SessionStats;
}

export function ArenaActiveSession({
  minutes, seconds, proposed, confirmed, skipped,
  focus, setFocus, batchSize, setBatchSize, channel,
  current, loadingSuggestions, animState, effectTrigger,
  editing, editSubject, setEditSubject, editBody, setEditBody,
  handleConfirm, handleSkip, handleBlacklist, handleEdit,
  endSession, sessionEnded, sessionStats,
}: Props): React.ReactElement {
  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-blue-500/3 pointer-events-none" />
      <ConfirmationEffects trigger={effectTrigger} />
      <SessionSummary open={sessionEnded} stats={sessionStats} onClose={() => window.history.back()} />

      {/* TOP ZONE */}
      <div className="relative z-10 h-[140px] border-b border-border/30 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-baseline gap-0.5 font-mono text-2xl font-bold text-foreground">
            <motion.span key={minutes} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{minutes}</motion.span>
            <span className="text-muted-foreground animate-pulse">:</span>
            <motion.span key={seconds} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{seconds}</motion.span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {[
            { label: "Proposti", value: proposed, color: "text-blue-400" },
            { label: "Confermati", value: confirmed, color: "text-green-400" },
            { label: "Saltati", value: skipped, color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <motion.div key={value} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }} className={`text-2xl font-bold ${color}`}>
                {value}
              </motion.div>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><Settings2 className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Focus</Label>
                <Select value={focus} onValueChange={setFocus}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    <SelectItem value="estero">Estero</SelectItem>
                    <SelectItem value="italia">Italia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Batch: {batchSize}</Label>
                <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={1} max={10} step={1} />
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="destructive" size="sm" onClick={endSession}>Fine Sessione</Button>
        </div>
      </div>

      {/* MIDDLE ZONE */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        {loadingSuggestions && !current && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">L'AI sta analizzando i contatti migliori...</p>
          </motion.div>
        )}

        {!loadingSuggestions && !current && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Inbox className="h-12 w-12 opacity-40" />
            <p>Nessun contatto disponibile con i filtri selezionati.</p>
          </div>
        )}

        {current && (
          <div className="w-full max-w-3xl space-y-4">
            <ContactCard3D
              contact={{
                company_name: current.company_name,
                contact_name: current.contact_name,
                contact_position: current.contact_position,
                country_code: current.country_code,
                country_name: current.country_name,
                city: current.city,
                email: current.email,
                partner_match: current.partner_match,
                rating: current.rating,
              }}
              animState={animState}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={current.partner_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Suggerito perché:</span>
                  <span className="text-foreground">{current.ai_reasoning}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-0 text-xs">
                    {LANG_FLAGS[current.target_language] || "🌍"} {channel === "linkedin" ? "LinkedIn" : "Email"} in {current.language_label}
                  </Badge>
                  {channel === "linkedin" && (
                    <Badge variant="outline" className="text-[10px] border-[#0A66C2]/30 text-[#0A66C2]">Max 300 char</Badge>
                  )}
                </div>

                {!editing ? (
                  <div className="bg-background/50 rounded-lg p-3 space-y-2">
                    {channel !== "linkedin" && (
                      <div className="text-xs text-muted-foreground font-mono">Subject: {current.draft_subject}</div>
                    )}
                    <div className="text-sm text-foreground/90 leading-relaxed max-h-32 overflow-y-auto">
                      <TypewriterText text={current.draft_body.replace(/<[^>]*>/g, "")} speed={15} />
                    </div>
                    {channel === "linkedin" && (
                      <div className="text-[10px] text-muted-foreground text-right">
                        {current.draft_body.replace(/<[^>]*>/g, "").length}/300
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {channel !== "linkedin" && (
                      <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Subject" className="text-sm" />
                    )}
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={channel === "linkedin" ? 3 : 4}
                      className="text-sm"
                      maxLength={channel === "linkedin" ? 300 : undefined}
                    />
                    {channel === "linkedin" && (
                      <div className="text-[10px] text-muted-foreground text-right">{editBody.length}/300</div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white h-12 px-6" onClick={handleConfirm}>
                  <Check className="h-5 w-5 mr-2" /> Conferma e Invia
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="outline" className="h-12 px-6 border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={handleEdit}>
                  <Edit3 className="h-5 w-5 mr-2" /> {editing ? "Anteprima" : "Modifica"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="ghost" className="h-12 px-6 text-muted-foreground" onClick={handleSkip}>
                  <SkipForward className="h-5 w-5 mr-2" /> Salta
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleBlacklist}>
                  <Ban className="h-4 w-4 mr-1" /> Mai
                </Button>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ZONE */}
      <div className="relative z-10 h-[60px] border-t border-border/30 px-6 flex items-center gap-4 shrink-0">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(100, (confirmed / Math.max(proposed, 1)) * 100)}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {confirmed} confermati su {proposed} proposti
        </span>
      </div>
    </div>
  );
}
