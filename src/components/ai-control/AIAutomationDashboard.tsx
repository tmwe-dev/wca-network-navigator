/**
 * AIAutomationDashboard — Adapted from tmwengine AIAutomationDashboard.
 * Shows email_address_rules with execution stats from ai_decision_log.
 * Visual pattern: 4 gradient stat cards + Card-inside-ScrollArea list with Switch toggle.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, Activity, CheckCircle2, XCircle, Clock, Mail,
  TrendingUp, AlertCircle, Edit, Copy, PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';


import { createLogger } from "@/lib/log";
const log = createLogger("AIAutomationDashboard");
interface RuleWithStats {
  id: string;
  email_address: string;
  display_name: string | null;
  category: string | null;
  is_active: boolean;
  auto_action: string | null;
  auto_execute: boolean;
  ai_confidence_threshold: number;
  interaction_count: number;
  success_rate: number | null;
  last_interaction_at: string | null;
  created_at: string;
}

interface DecisionLog {
  id: string;
  decision_type: string;
  ai_reasoning: string | null;
  confidence: number | null;
  was_auto_executed: boolean;
  user_review: string | null;
  created_at: string;
}

export function AIAutomationDashboard() {
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<DecisionLog[]>([]);

  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-automation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_address_rules')
        .select('id, email_address, display_name, category, is_active, auto_action, auto_execute, ai_confidence_threshold, interaction_count, success_rate, last_interaction_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RuleWithStats[];
    },
  });

  const fetchExecutionLogs = async (emailAddress: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_decision_log')
        .select('id, decision_type, ai_reasoning, confidence, was_auto_executed, user_review, created_at')
        .eq('email_address', emailAddress)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setExecutionLogs((data || []) as DecisionLog[]);
    } catch (error) {
      log.error('Error fetching logs:', { error: error });
    }
  };

  useEffect(() => {
    if (expandedRuleId) {
      const rule = rules.find(r => r.id === expandedRuleId);
      if (rule) fetchExecutionLogs(rule.email_address);
    } else {
      setExecutionLogs([]);
    }
  }, [expandedRuleId, rules]);

  const stats = {
    totalRules: rules.length,
    activeRules: rules.filter(r => r.is_active).length,
    totalInteractions: rules.reduce((sum, r) => sum + (r.interaction_count || 0), 0),
    avgSuccessRate: rules.length
      ? (rules.reduce((sum, r) => sum + (r.success_rate || 0), 0) / rules.length).toFixed(1)
      : '0.0',
  };

  const handleToggleActive = async (ruleId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('email_address_rules')
        .update({ is_active: !currentState })
        .eq('id', ruleId);
      if (error) throw error;
      toast.success(currentState ? 'Regola disattivata' : 'Regola attivata');
      refetch();
    } catch (error) {
      log.error('Error toggling rule:', { error: error });
      toast.error('Errore aggiornamento stato');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Stats — identical gradient pattern */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Regole Totali</p>
                <p className="text-3xl font-bold">{stats.totalRules}</p>
              </div>
              <Bot className="h-10 w-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Regole Attive</p>
                <p className="text-3xl font-bold">{stats.activeRules}</p>
              </div>
              <Activity className="h-10 w-10 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interazioni</p>
                <p className="text-3xl font-bold">{stats.totalInteractions}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-orange-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold">{stats.avgSuccessRate}%</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Regole AI Configurate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {rules.length > 0 ? (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <Card
                    key={rule.id}
                    className={cn(
                      "border transition-all duration-200 hover:border-primary/40",
                      rule.is_active ? "border-green-500/30 bg-green-500/5" : "border-gray-500/30 bg-gray-500/5",
                      expandedRuleId === rule.id && "ring-2 ring-primary/50"
                    )}
                  >
                    <CardContent className="pt-6 space-y-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-lg">{rule.display_name || rule.email_address}</h4>
                            <Badge variant={rule.is_active ? "default" : "secondary"}>
                              {rule.is_active ? 'Attivo' : 'Inattivo'}
                            </Badge>
                            {rule.auto_action && rule.auto_action !== 'none' && (
                              <Badge variant="outline" className="text-xs">
                                {rule.auto_action}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {rule.email_address}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleActive(rule.id, rule.is_active)}
                          />
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-400" />
                          <span className="text-muted-foreground">Interazioni:</span>
                          <span className="font-semibold">{rule.interaction_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="text-muted-foreground">Success:</span>
                          <span className="font-semibold">{(rule.success_rate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-400" />
                          <span className="text-muted-foreground">
                            {rule.last_interaction_at
                              ? new Date(rule.last_interaction_at).toLocaleDateString('it-IT')
                              : 'Mai'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          {expandedRuleId === rule.id ? 'Nascondi' : 'Mostra'} Log
                        </Button>
                        <Button variant="ghost" size="sm" disabled>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifica
                        </Button>
                        <Button variant="ghost" size="sm" disabled>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplica
                        </Button>
                        <Button variant="ghost" size="sm" disabled>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Test
                        </Button>
                      </div>

                      {/* Execution Logs */}
                      {expandedRuleId === rule.id && executionLogs.length > 0 && (
                        <div className="space-y-2 pt-4 border-t border-border/50">
                          <h5 className="text-sm font-semibold flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Ultimi 10 Log Decisioni
                          </h5>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2">
                              {executionLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="flex items-start gap-3 p-3 rounded-lg bg-card/30 border border-border/30 text-xs"
                                >
                                  {log.user_review === 'approved' || log.was_auto_executed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                                  ) : log.user_review === 'rejected' ? (
                                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 space-y-1">
                                    <p className="font-medium">
                                      {log.decision_type} — {log.confidence ? `${Math.round(log.confidence * 100)}%` : 'N/A'}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {new Date(log.created_at).toLocaleString('it-IT')}
                                    </p>
                                    {log.ai_reasoning && (
                                      <p className="text-muted-foreground text-xs truncate">{log.ai_reasoning}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Nessuna regola AI configurata
                </p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Vai su Email Intelligence per configurare regole AI per i tuoi contatti
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
