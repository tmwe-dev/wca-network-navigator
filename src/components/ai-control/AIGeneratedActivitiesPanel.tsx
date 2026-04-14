/**
 * AIGeneratedActivitiesPanel — Adapted from tmwengine AIGeneratedActivitiesPanel.
 * Shows activities WHERE metadata->>'created_by_ai' = 'true' AND status = 'pending'.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Edit2, Calendar, Phone, ListTodo, Sparkles, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface AIActivity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  priority: string;
  created_at: string;
  partner_id: string | null;
  source_meta: Record<string, unknown> | null;
}

const ActivityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'meeting': return <Calendar className="h-5 w-5" />;
    case 'call': return <Phone className="h-5 w-5" />;
    case 'task': return <ListTodo className="h-5 w-5" />;
    case 'email': return <Mail className="h-5 w-5" />;
    default: return <Sparkles className="h-5 w-5" />;
  }
};

const ActivityLabel: Record<string, string> = {
  meeting: 'Meeting',
  call: 'Chiamata',
  task: 'Task',
  email: 'Email',
  follow_up: 'Follow-Up',
};

const PriorityColor: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-400 border-green-500/20',
};

export function AIGeneratedActivitiesPanel() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState('');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['ai-generated-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, activity_type, title, description, status, due_date, priority, created_at, partner_id, source_meta')
        .eq('status', 'pending')
        .eq('source_type', 'ai_generated')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as AIActivity[];
    },
    refetchInterval: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('activities')
        .update({ status: 'in_progress' })
        .eq('id', activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-generated-activities'] });
      toast.success('Attività approvata');
    },
    onError: (err: Error) => toast.error(`Errore: ${err.message}`),
  });

  const rejectMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('activities')
        .update({ status: 'cancelled' })
        .eq('id', activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-generated-activities'] });
      toast.success('Attività rifiutata');
    },
    onError: (err: Error) => toast.error(`Errore: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const { error } = await supabase
        .from('activities')
        .update({ description })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-generated-activities'] });
      toast.success('Descrizione aggiornata');
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(`Errore: ${err.message}`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Attività Generate dall'AI
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Attività Generate dall'AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessuna attività AI in sospeso
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Attività Generate dall'AI
          <Badge variant="secondary" className="ml-auto">{activities.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
        {activities.map((activity) => {
          const confidence = activity.source_meta?.ai_confidence as number | undefined;
          const reasoning = activity.source_meta?.ai_reasoning as string | undefined;

          return (
            <Card key={activity.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <ActivityIcon type={activity.activity_type} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {ActivityLabel[activity.activity_type] || activity.activity_type}
                        </Badge>
                        <Badge variant="outline" className={PriorityColor[activity.priority] || ''}>
                          {activity.priority}
                        </Badge>
                        {confidence != null && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(confidence * 100)}% confident
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-sm">{activity.title}</h4>
                    </div>
                  </div>

                  {editingId === activity.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: activity.id, description: editedDescription })} disabled={updateMutation.isPending}>
                          Salva
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditedDescription(''); }}>
                          Annulla
                        </Button>
                      </div>
                    </div>
                  ) : (
                    activity.description && <p className="text-sm">{activity.description}</p>
                  )}

                  {reasoning && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      💡 <strong>Reasoning:</strong> {reasoning}
                    </div>
                  )}

                  {activity.due_date && (
                    <div className="text-xs text-muted-foreground">
                      📅 Scadenza: {new Date(activity.due_date).toLocaleDateString('it-IT')}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => approveMutation.mutate(activity.id)} disabled={approveMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approva
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(activity.id); setEditedDescription(activity.description || ''); }}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Modifica
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(activity.id)} disabled={rejectMutation.isPending}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Rifiuta
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Creata: {new Date(activity.created_at).toLocaleString('it-IT')}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
