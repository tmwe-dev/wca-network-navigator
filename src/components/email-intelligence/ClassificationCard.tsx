/**
 * ClassificationCard — Adapted from tmwengine SmartEmailCardIntelligent.
 * Glassmorphism card for email_classifications entries.
 */
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Reply, Archive, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Classification {
  id: string;
  email_address: string;
  category: string;
  confidence: number;
  ai_summary: string | null;
  keywords: string[] | null;
  urgency: string | null;
  sentiment: string | null;
  action_suggested: string | null;
  classified_at: string;
  partner_id: string | null;
  subject: string | null;
}

interface ClassificationCardProps {
  classification: Classification;
  partnerName?: string;
  onClick: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  interested: '#22c55e',
  not_interested: '#ef4444',
  request_info: '#3b82f6',
  meeting_request: '#a855f7',
  complaint: '#f97316',
  follow_up: '#06b6d4',
  auto_reply: '#9ca3af',
  spam: '#991b1b',
  uncategorized: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  interested: 'Interessato',
  not_interested: 'Non Interessato',
  request_info: 'Richiesta Info',
  meeting_request: 'Meeting',
  complaint: 'Reclamo',
  follow_up: 'Follow-Up',
  auto_reply: 'Auto-Reply',
  spam: 'Spam',
  uncategorized: 'Da Classificare',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  neutral: 'bg-gray-400',
  mixed: 'bg-yellow-500',
};

function extractInitials(email: string): string {
  const name = email.split('@')[0];
  return name.substring(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 1) return `${Math.round(diffH * 60)}m fa`;
  if (diffH < 24) return `${Math.round(diffH)}h fa`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export function ClassificationCard({ classification, partnerName, onClick, isSelected, onToggleSelect }: ClassificationCardProps) {
  const catColor = CATEGORY_COLORS[classification.category] || '#6b7280';

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative p-4 cursor-pointer transition-all duration-300 rounded-2xl",
        "min-h-[200px]",
        "bg-gradient-to-br from-[#1c1c28]/80 via-[#23233a]/60 to-[#0e0e18]/70",
        "backdrop-blur-md border border-white/10",
        "hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(0,200,255,0.1)]",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl"
      )}
    >
      {/* Diagonal light reflection */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent opacity-50" />
      </div>

      <div className="flex gap-3 relative z-10">
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </div>

        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="rounded-full bg-white/10 border border-white/20 p-1">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-xs font-semibold">
                {extractInitials(classification.email_address)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-sm truncate text-white/90">
                  {partnerName || classification.email_address.split('@')[0]}
                </h3>
                {/* Category badge */}
                <Badge
                  className="text-[10px] border-0 rounded-full px-2"
                  style={{ backgroundColor: `${catColor}30`, color: catColor }}
                >
                  {CATEGORY_LABELS[classification.category] || classification.category}
                </Badge>
                {/* Sentiment dot */}
                {classification.sentiment && (
                  <span className={cn("h-2 w-2 rounded-full inline-block", SENTIMENT_COLORS[classification.sentiment] || 'bg-gray-400')} />
                )}
              </div>
              <p className="text-xs text-white/70 truncate">{classification.email_address}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-[10px] border-white/20">
                {Math.round(classification.confidence * 100)}%
              </Badge>
              <span className="text-xs text-white/60 whitespace-nowrap">
                {formatDate(classification.classified_at)}
              </span>
            </div>
          </div>

          {/* Urgency */}
          {classification.urgency && ['critical', 'high'].includes(classification.urgency) && (
            <Badge className="text-[10px] bg-red-500/20 border border-red-500/40 text-red-300 rounded-full px-1.5 py-0 mb-2">
              ⚡ {classification.urgency}
            </Badge>
          )}

          {/* Action suggested */}
          {classification.action_suggested && (
            <div className="flex items-start gap-1.5 mb-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded">
              <Target className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
              <span className="text-xs font-medium text-orange-300 leading-tight">
                {classification.action_suggested}
              </span>
            </div>
          )}

          {/* AI Summary */}
          {classification.ai_summary && (
            <p className="text-xs text-white/70 leading-tight mb-2 overflow-y-auto max-h-[80px]">
              {classification.ai_summary}
            </p>
          )}

          {/* Keywords */}
          {classification.keywords && classification.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {classification.keywords.slice(0, 3).map((kw, i) => (
                <Badge key={i} className="text-xs bg-white/10 border border-white/15 text-white/90 rounded-full px-2 py-0.5">
                  {kw}
                </Badge>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-1 pt-2 border-t border-white/10 mt-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
              onClick={(e) => e.stopPropagation()}>
              <Reply className="w-3 h-3 mr-1" /> Rispondi
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
              onClick={(e) => e.stopPropagation()}>
              <Archive className="w-3 h-3 mr-1" /> Archivia
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
