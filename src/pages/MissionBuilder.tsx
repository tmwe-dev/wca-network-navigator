import { Rocket, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderChatInterface } from "./builder/BuilderChatInterface";
import { BuilderVoiceControls } from "./builder/BuilderVoiceControls";
import { useMissionBuilder } from "./builder/useMissionBuilder";

export default function MissionBuilder() {
  const mb = useMissionBuilder();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => mb.navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Rocket className="w-5 h-5 text-primary" />
        <input value={mb.missionTitle} onChange={e => mb.setMissionTitle(e.target.value)}
          placeholder="Nome missione..."
          className="bg-transparent text-lg font-semibold text-foreground outline-none flex-1 placeholder:text-muted-foreground/50" />
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => { mb.setVoiceEnabled(v => !v); if (mb.audioRef.current) { mb.audioRef.current.pause(); mb.audioRef.current = null; } }}
          title={mb.voiceEnabled ? "Disattiva voce" : "Attiva voce"}>
          {mb.voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
        </Button>
        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${mb.progressPct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{mb.progressPct}%</span>
      </div>

      {/* Chat */}
      <BuilderChatInterface messages={mb.messages} isChatLoading={mb.isChatLoading} chatScrollRef={mb.chatScrollRef}
        stepData={mb.stepData} onSetStepData={mb.setStepData} countryStats={mb.countryStats}
        onLaunch={mb.launchMission} onPlanApprove={mb.handlePlanApprove} onPlanCancel={mb.handlePlanCancel}
        pendingPlan={mb.pendingPlan} isApproving={mb.isApproving} />

      {/* Input */}
      <BuilderVoiceControls chatInput={mb.chatInput} onChatInputChange={mb.setChatInput} onSend={mb.sendChat}
        isChatLoading={mb.isChatLoading} chatInputRef={mb.chatInputRef} speech={mb.speech} />
    </div>
  );
}
