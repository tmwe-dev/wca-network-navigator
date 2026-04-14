/**
 * SmartClassificationView — Split-view layout (sidebar | list 40% | detail 60%).
 * Adapted from tmwengine SmartInboxTabIntelligent layout pattern.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CategoriesSidebar } from './CategoriesSidebar';
import { ClassificationList } from './ClassificationList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Target, Brain, MessageSquare } from 'lucide-react';

interface Classification {
  id: string;
  email_address: string;
  category: string;
  confidence: number;
  ai_summary: string | null;
  keywords: string[] | null;
  urgency: string | null;
  sentiment: string | null;
  detected_patterns: string[] | null;
  action_suggested: string | null;
  reasoning: string | null;
  classified_at: string;
  partner_id: string | null;
  subject: string | null;
  direction: string | null;
}

export function SmartClassificationView() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<Classification | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: classifications = [], isLoading } = useQuery({
    queryKey: ['email-classifications', selectedCategory],
    queryFn: async () => {
      let q = supabase
        .from('email_classifications')
        .select('*')
        .order('classified_at', { ascending: false })
        .limit(100);
      if (selectedCategory !== 'all') q = q.eq('category', selectedCategory);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Classification[];
    },
  });

  // Category counts (from all data)
  const { data: allClassifications = [] } = useQuery({
    queryKey: ['email-classifications-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_classifications')
        .select('category');
      if (error) throw error;
      return (data || []) as { category: string }[];
    },
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allClassifications.forEach((c: { category: string }) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return counts;
  }, [allClassifications]);

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* Left: Categories sidebar */}
      <CategoriesSidebar
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onCategoryChange={(cat) => { setSelectedCategory(cat); setSelectedItem(null); }}
      />

      {/* Center: Card list (40%) */}
      <div className="w-[40%] flex flex-col">
        <ClassificationList
          classifications={classifications}
          onItemClick={(c) => setSelectedItem(c as Classification)}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>

      {/* Right: Detail panel (60%) */}
      <div className="flex-1">
        {selectedItem ? (
          <Card className="h-full bg-card/50 backdrop-blur-sm border-primary/20 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {selectedItem.email_address}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge>{selectedItem.category}</Badge>
                <Badge variant="outline">{Math.round(selectedItem.confidence * 100)}%</Badge>
                {selectedItem.sentiment && (
                  <Badge variant="secondary">{selectedItem.sentiment}</Badge>
                )}
                {selectedItem.urgency && (
                  <Badge variant={selectedItem.urgency === 'critical' ? 'destructive' : 'outline'}>
                    {selectedItem.urgency}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-360px)]">
                <div className="space-y-4">
                  {/* AI Summary */}
                  {selectedItem.ai_summary && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" /> Riassunto AI
                      </h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.ai_summary}</p>
                    </div>
                  )}

                  {/* Keywords */}
                  {selectedItem.keywords && selectedItem.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">🏷️ Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected Patterns */}
                  {selectedItem.detected_patterns && selectedItem.detected_patterns.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">🔍 Pattern Rilevati</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.detected_patterns.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Suggested */}
                  {selectedItem.action_suggested && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-1 text-orange-300">
                        <Target className="h-4 w-4" /> Azione Suggerita
                      </h4>
                      <p className="text-sm text-orange-200/80">{selectedItem.action_suggested}</p>
                    </div>
                  )}

                  {/* Reasoning */}
                  {selectedItem.reasoning && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4" /> Ragionamento AI
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedItem.reasoning}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="text-center space-y-3 p-8">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <h3 className="text-lg font-semibold">Seleziona una classificazione</h3>
              <p className="text-sm text-muted-foreground">
                Clicca su un'email classificata per vedere i dettagli
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
