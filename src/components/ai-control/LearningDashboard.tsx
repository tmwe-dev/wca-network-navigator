/**
 * LearningDashboard — Adapted from tmwengine LearningDashboard.
 * Computes metrics from ai_decision_log aggregations.
 * Visual: Progress bars, TrendingUp/Down, problematic senders, yellow suggestion card.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DecisionRow {
  decision_type: string;
  email_address: string | null;
  confidence: number | null;
  user_review: string | null;
  was_auto_executed: boolean;
}

export function LearningDashboard() {
  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['learning-decisions'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('ai_decision_log')
        .select('decision_type, email_address, confidence, user_review, was_auto_executed')
        .gte('created_at', thirtyDaysAgo);
      if (error) throw error;
      return (data || []) as DecisionRow[];
    },
  });

  const { data: recentFeedback = [] } = useQuery({
    queryKey: ['recent-feedback-decisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_decision_log')
        .select('id, decision_type, ai_reasoning, confidence, user_review, user_correction, email_address, created_at')
        .not('user_review', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Compute classification accuracy
  const classifyDecisions = decisions.filter(d => d.decision_type === 'classify_email');
  const classifyReviewed = classifyDecisions.filter(d => d.user_review);
  const classifyApproved = classifyReviewed.filter(d => d.user_review === 'approved');
  const classificationAccuracy = classifyReviewed.length > 0
    ? (classifyApproved.length / classifyReviewed.length) * 100
    : 0;
  const classificationConfidence = classifyDecisions.length > 0
    ? classifyDecisions.reduce((s, d) => s + (d.confidence || 0), 0) / classifyDecisions.length
    : 0;

  // Compute action accuracy
  const actionDecisions = decisions.filter(d => d.decision_type !== 'classify_email');
  const actionReviewed = actionDecisions.filter(d => d.user_review);
  const actionApproved = actionReviewed.filter(d => d.user_review === 'approved');
  const actionAccuracy = actionReviewed.length > 0
    ? (actionApproved.length / actionReviewed.length) * 100
    : 0;
  const actionConfidence = actionDecisions.length > 0
    ? actionDecisions.reduce((s, d) => s + (d.confidence || 0), 0) / actionDecisions.length
    : 0;

  // Problematic senders
  const senderMap = new Map<string, { total: number; approved: number }>();
  decisions.forEach(d => {
    if (!d.email_address || !d.user_review) return;
    const entry = senderMap.get(d.email_address) || { total: 0, approved: 0 };
    entry.total++;
    if (d.user_review === 'approved') entry.approved++;
    senderMap.set(d.email_address, entry);
  });
  const problematicSenders = Array.from(senderMap.entries())
    .filter(([, s]) => s.total >= 3 && (s.approved / s.total) * 100 < 70)
    .map(([email, s]) => ({ email, ...s, accuracy: (s.approved / s.total) * 100 }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">📊 Learning Insights</h2>
        <p className="text-muted-foreground">
          Metriche di performance e suggerimenti per migliorare l'AI
        </p>
      </div>

      {/* Overall Accuracy Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Classificazione Email
            </CardTitle>
            <CardDescription>Accuracy complessiva nelle classificazioni</CardDescription>
          </CardHeader>
          <CardContent>
            {classifyReviewed.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{classificationAccuracy.toFixed(1)}%</span>
                  {classificationAccuracy >= 80 ? (
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <Progress value={classificationAccuracy} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {classifyApproved.length}/{classifyReviewed.length} classificazioni corrette
                </p>
                <p className="text-xs text-muted-foreground">
                  Confidence media: {(classificationConfidence * 100).toFixed(1)}%
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun dato disponibile ancora</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              Azioni AI
            </CardTitle>
            <CardDescription>Accuracy nelle decisioni di azione</CardDescription>
          </CardHeader>
          <CardContent>
            {actionReviewed.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{actionAccuracy.toFixed(1)}%</span>
                  {actionAccuracy >= 85 ? (
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <Progress value={actionAccuracy} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {actionApproved.length}/{actionReviewed.length} azioni corrette
                </p>
                <p className="text-xs text-muted-foreground">
                  Confidence media: {(actionConfidence * 100).toFixed(1)}%
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun dato disponibile ancora</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Problematic Senders */}
      {problematicSenders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Contatti Problematici
            </CardTitle>
            <CardDescription>Contatti con bassa accuracy (servono regole custom)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {problematicSenders.map((sender) => (
                  <div key={sender.email} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium truncate">{sender.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {sender.approved}/{sender.total} azioni corrette
                      </p>
                    </div>
                    <Badge variant={sender.accuracy < 60 ? 'destructive' : 'secondary'}>
                      {sender.accuracy.toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recent Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Feedback Recenti</CardTitle>
          <CardDescription>Ultimi 10 feedback registrati</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {recentFeedback.length > 0 ? (
              <div className="space-y-3">
                {recentFeedback.map((fb) => (
                  <div key={fb.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          fb.user_review === 'approved' ? 'default'
                          : fb.user_review === 'rejected' ? 'destructive'
                          : 'secondary'
                        }
                      >
                        {fb.user_review === 'approved' ? '✓ Approvato'
                          : fb.user_review === 'rejected' ? '✗ Rifiutato'
                          : '✎ Modificato'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fb.created_at ? new Date(fb.created_at).toLocaleDateString('it-IT') : ''}
                      </span>
                    </div>
                    <p className="text-sm">
                      <strong>AI ha suggerito:</strong> {fb.ai_reasoning || fb.decision_type}
                    </p>
                    {fb.user_correction && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Correzione:</strong> {fb.user_correction}
                      </p>
                    )}
                    {fb.email_address && (
                      <p className="text-xs text-muted-foreground">
                        Contatto: {fb.email_address}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nessun feedback ancora. Inizia a dare feedback sulle azioni AI!
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {problematicSenders.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              💡 Suggerimenti
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-yellow-300/80">
            <p>
              • {problematicSenders.length} contatt{problematicSenders.length > 1 ? 'i' : 'o'} con
              bassa accuracy - considera di creare regole AI personalizzate
            </p>
            {classificationAccuracy > 0 && classificationAccuracy < 75 && (
              <p>• Accuracy classificazione sotto il 75% - rivedi i prompt di classificazione</p>
            )}
            {actionAccuracy > 0 && actionAccuracy < 80 && (
              <p>• Accuracy azioni sotto l&apos;80% - adatta le confidence threshold</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
