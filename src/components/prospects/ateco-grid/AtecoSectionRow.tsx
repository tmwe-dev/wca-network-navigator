import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Folder, FolderOpen, Check, ChevronRight, ChevronDown } from "lucide-react";
import type { AtecoEntry } from "@/data/atecoCategories";
import { getAtecoRank, calcScore, scoreColor, scoreBg } from "@/data/atecoRanking";
import { t } from "@/components/download/theme";
import { childDivisions, childGroups, allLeafCodes, passesRankingFilter } from "./useAtecoGrid";
import type { ProspectFilters } from "@/components/prospects/ProspectAdvancedFilters";

interface AtecoSectionRowProps {
  section: AtecoEntry;
  isDark: boolean;
  expanded: Set<string>;
  selectedSet: Set<string>;
  nodeCount: Map<string, number>;
  onlyInDb: boolean;
  rankingFilters?: ProspectFilters;
  onToggleExpand: (code: string) => void;
  onToggleBranch: (entry: AtecoEntry) => void;
  onToggleCode: (code: string) => void;
}

export function AtecoSectionRow({
  section, isDark, expanded, selectedSet, nodeCount, onlyInDb, rankingFilters,
  onToggleExpand, onToggleBranch, onToggleCode,
}: AtecoSectionRowProps) {
  const th = t(isDark);
  const sCount = nodeCount.get(section.codice) || 0;
  const isOpen = expanded.has(section.codice);
  const sLeaves = allLeafCodes(section);
  const allSel = sLeaves.length > 0 && sLeaves.every(c => selectedSet.has(c));
  const someSel = sLeaves.some(c => selectedSet.has(c));

  const sRanks = childDivisions(section.codice).map(d => getAtecoRank(d.codice)).filter(Boolean);
  const sAvgScore = sRanks.length > 0 ? Math.round(sRanks.reduce((s, r) => s + calcScore(r!), 0) / sRanks.length * 10) / 10 : 0;
  const sHighPriority = sAvgScore >= 12;
  const sPriorityClass = sHighPriority ? "bg-primary/[0.06] border-l-2 border-primary/40" : "";

  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggleExpand(section.codice)}>
      <div className={`flex items-center gap-1 rounded-xl px-2 py-1.5 transition-all ${sPriorityClass} ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-muted/50"}`}>
        <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {isOpen ? <FolderOpen className="w-4 h-4 shrink-0 text-primary" /> : <Folder className={`w-4 h-4 shrink-0 ${th.dim}`} />}
          <span className={`text-xs font-bold uppercase tracking-wide ${th.h2}`}>{section.codice}</span>
          <span className={`text-[11px] truncate flex-1 ${th.sub}`}>{section.descrizione}</span>
          {isOpen ? <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${th.dim}`} /> : <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${th.dim}`} />}
        </CollapsibleTrigger>
        {sAvgScore > 0 && (
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${scoreBg(sAvgScore, isDark)} ${scoreColor(sAvgScore, isDark)}`} title={`Score medio: ${sAvgScore}`}>
            {sAvgScore.toFixed(0)}
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); onToggleBranch(section); }}
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
            allSel ? "bg-primary border-primary" : someSel ? "bg-primary/40 border-primary" : isDark ? "border-white/15 hover:border-white/30" : "border-border hover:border-foreground/30"
          }`}>
          {(allSel || someSel) && <Check className="w-3 h-3 text-primary-foreground" />}
        </button>
        <span className={`text-[10px] font-mono w-8 text-right ${th.dim}`}>{sCount || ""}</span>
      </div>

      <CollapsibleContent>
        <div className="ml-4 border-l border-dashed pl-2 space-y-0.5" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }}>
          {childDivisions(section.codice)
            .filter(div => childGroups(div.codice).some(g => passesRankingFilter(getAtecoRank(g.codice), rankingFilters) && (!onlyInDb || (nodeCount.get(g.codice) || 0) > 0)))
            .map(div => {
              const dCount = nodeCount.get(div.codice) || 0;
              const isDivOpen = expanded.has(div.codice);
              const dLeaves = allLeafCodes(div);
              const allDSel = dLeaves.length > 0 && dLeaves.every(c => selectedSet.has(c));
              const someDSel = dLeaves.some(c => selectedSet.has(c));
              const dRank = getAtecoRank(div.codice);
              const dScore = dRank ? calcScore(dRank) : 0;
              const dHighPriority = dScore >= 12;
              const dPriorityClass = dHighPriority ? "bg-primary/[0.06] border-l-2 border-primary/40" : "";

              return (
                <Collapsible key={div.codice} open={isDivOpen} onOpenChange={() => onToggleExpand(div.codice)}>
                  <div className={`flex items-center gap-1 rounded-lg px-2 py-1 transition-all ${dPriorityClass} ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-muted/50"}`}>
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isDivOpen ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-primary/70" /> : <Folder className={`w-3.5 h-3.5 shrink-0 ${th.dim}`} />}
                      <span className={`text-xs font-semibold ${th.h2}`}>{div.codice}</span>
                      <span className={`text-[11px] truncate flex-1 ${th.sub}`}>{div.descrizione}</span>
                      {isDivOpen ? <ChevronDown className={`w-3 h-3 shrink-0 ${th.dim}`} /> : <ChevronRight className={`w-3 h-3 shrink-0 ${th.dim}`} />}
                    </CollapsibleTrigger>
                    {dScore > 0 && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${scoreBg(dScore, isDark)} ${scoreColor(dScore, isDark)}`} title={dRank ? `Vol:${dRank.volume} Val:${dRank.valore} ${dRank.intl} — ${dRank.note}` : ""}>
                        {dScore.toFixed(0)}
                      </span>
                    )}
                    <button onClick={e => { e.stopPropagation(); onToggleBranch(div); }}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        allDSel ? "bg-primary border-primary" : someDSel ? "bg-primary/40 border-primary" : isDark ? "border-white/15 hover:border-white/30" : "border-border hover:border-foreground/30"
                      }`}>
                      {(allDSel || someDSel) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </button>
                    <span className={`text-[10px] font-mono w-7 text-right ${th.dim}`}>{dCount || ""}</span>
                  </div>
                  <CollapsibleContent>
                    <div className="ml-5 space-y-0.5">
                      {childGroups(div.codice).filter(g => passesRankingFilter(getAtecoRank(g.codice), rankingFilters) && (!onlyInDb || (nodeCount.get(g.codice) || 0) > 0)).map(grp => {
                        const gCount = nodeCount.get(grp.codice) || 0;
                        const isSel = selectedSet.has(grp.codice);
                        const gRank = getAtecoRank(grp.codice);
                        const gScore = gRank ? calcScore(gRank) : 0;
                        const gHighPriority = gScore >= 12;
                        const gPriorityClass = gHighPriority && !isSel ? "bg-primary/[0.06] border-l-2 border-primary/40" : "";
                        return (
                          <button key={grp.codice} onClick={() => onToggleCode(grp.codice)}
                            className={`w-full flex items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-all ${gPriorityClass} ${
                              isSel ? "bg-primary/10 border border-primary/20" : isDark ? "hover:bg-white/[0.03]" : "hover:bg-muted/50"
                            }`}
                            title={gRank ? `Vol:${"★".repeat(gRank.volume)}  Val:${"★".repeat(gRank.valore)}  ${gRank.intl}\n${gRank.note}` : ""}>
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSel ? "bg-primary border-primary" : isDark ? "border-white/15" : "border-border"}`}>
                              {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <span className={`text-[11px] font-medium ${th.h2}`}>{grp.codice}</span>
                            <span className={`text-[11px] truncate flex-1 ${th.sub}`}>{grp.descrizione}</span>
                            {gScore > 0 && (
                              <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border shrink-0 ${scoreBg(gScore, isDark)} ${scoreColor(gScore, isDark)}`}>{gScore.toFixed(0)}</span>
                            )}
                            {gCount > 0 && <span className="text-[10px] font-mono text-primary/70">{gCount}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
