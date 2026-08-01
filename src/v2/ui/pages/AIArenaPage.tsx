/**
 * AIArena — Orchestrator using sub-components
 */
import * as React from "react";
import { ArenaPreSession } from "@/components/ai-arena/ArenaPreSession";
import { ArenaActiveSession } from "@/components/ai-arena/ArenaActiveSession";
import { useArenaSession } from "@/components/ai-arena/useArenaSession";

export function AIArenaPage(): React.ReactElement {
  const s = useArenaSession();

  if (!s.sessionStarted) {
    return (
      <ArenaPreSession
        focus={s.focus} setFocus={s.setFocus}
        channel={s.channel} setChannel={s.setChannel}
        sendLanguage={s.sendLanguage} setSendLanguage={s.setSendLanguage}
        batchSize={s.batchSize} setBatchSize={s.setBatchSize}
        onStart={s.startSession}
      />
    );
  }

  return (
    <ArenaActiveSession
      minutes={s.minutes} seconds={s.seconds}
      proposed={s.proposed} confirmed={s.confirmed} skipped={s.skipped}
      focus={s.focus} setFocus={s.setFocus}
      batchSize={s.batchSize} setBatchSize={s.setBatchSize}
      channel={s.channel}
      current={s.current} loadingSuggestions={s.loadingSuggestions}
      animState={s.animState} effectTrigger={s.effectTrigger}
      editing={s.editing}
      editSubject={s.editSubject} setEditSubject={s.setEditSubject}
      editBody={s.editBody} setEditBody={s.setEditBody}
      handleConfirm={s.handleConfirm} handleSkip={s.handleSkip}
      handleBlacklist={s.handleBlacklist} handleEdit={s.handleEdit}
      endSession={s.endSession}
      sessionEnded={s.sessionEnded} sessionStats={s.sessionStats}
    />
  );
}

export default AIArenaPage;
