/**
 * SenderProfileCard — Adapted from tmwengine SenderCard visual style.
 * border-l-4 with sentiment-based coloring, interaction stats.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SenderProfile {
  email_address: string;
  display_name: string | null;
  interaction_count: number;
  success_rate: number | null;
  dominant_sentiment: string | null;
  response_rate: number | null;
  avg_response_time_hours: number | null;
  last_interaction_at: string | null;
  auto_action: string | null;
  preferred_channel: string | null;
  ai_confidence_threshold: number;
  classification_count: number;
  sentiment_trend: string[];
}

interface SenderProfileCardProps {
  profile: SenderProfile;
  onViewConversation?: () => void;
  onEditRules?: () => void;
  onViewClassifications?: () => void;
}

const SENTIMENT_BORDER: Record<string, string> = {
  positive: 'border-l-green-500',
  negative: 'border-l-red-500',
  neutral: 'border-l-gray-400',
  mixed: 'border-l-yellow-500',
};

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  neutral: 'bg-gray-400',
  mixed: 'bg-yellow-500',
};

function extractInitials(email: string): string {
  const name = email.split('@')[0];
  return name.substring(0, 2).toUpperCase();
}

export function SenderProfileCard({ profile, onViewConversation, onEditRules, onViewClassifications }: SenderProfileCardProps) {
  const borderClass = SENTIMENT_BORDER[profile.dominant_sentiment || 'neutral'] || 'border-l-gray-400';

  return (
    <Card className={cn("border-l-4 transition-shadow hover:shadow-lg", borderClass)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Initials avatar */}
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
              {extractInitials(profile.email_address)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {profile.display_name || profile.email_address.split('@')[0]}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {profile.email_address}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-primary">{profile.interaction_count}</div>
            <div className="text-xs text-muted-foreground">interazioni</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
          <div>
            <span className="text-muted-foreground">Response Rate</span>
            <div className="font-semibold">{profile.response_rate != null ? `${Math.round(profile.response_rate * 100)}%` : 'N/A'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Tempo Medio</span>
            <div className="font-semibold">{profile.avg_response_time_hours != null ? `${profile.avg_response_time_hours.toFixed(1)}h` : 'N/A'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Success Rate</span>
            <div className="font-semibold">{profile.success_rate != null ? `${profile.success_rate.toFixed(0)}%` : 'N/A'}</div>
          </div>
        </div>

        {/* Sentiment trend */}
        {profile.sentiment_trend.length > 0 && (
          <div className="flex items-center gap-1 mt-3">
            <span className="text-xs text-muted-foreground mr-2">Trend:</span>
            {profile.sentiment_trend.slice(-5).map((s, i) => (
              <span key={i} className={cn("h-2.5 w-2.5 rounded-full", SENTIMENT_DOT[s] || 'bg-gray-400')} />
            ))}
          </div>
        )}

        {/* Rules summary */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.auto_action && profile.auto_action !== 'none' && (
            <Badge variant="outline" className="text-[10px]">{profile.auto_action}</Badge>
          )}
          {profile.preferred_channel && (
            <Badge variant="secondary" className="text-[10px]">{profile.preferred_channel}</Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            threshold: {Math.round(profile.ai_confidence_threshold * 100)}%
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <Button size="sm" variant="ghost" className="text-xs flex-1" onClick={onViewConversation}>
            <MessageSquare className="h-3 w-3 mr-1" /> Conversazione
          </Button>
          <Button size="sm" variant="ghost" className="text-xs flex-1" onClick={onEditRules}>
            <Settings className="h-3 w-3 mr-1" /> Regole
          </Button>
          <Button size="sm" variant="ghost" className="text-xs flex-1" onClick={onViewClassifications}>
            <FileText className="h-3 w-3 mr-1" /> Classificazioni
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
