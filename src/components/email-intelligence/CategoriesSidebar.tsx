/**
 * CategoriesSidebar — Adapted from tmwengine CategoriesVerticalSidebar.
 * WCA categories with lucide icons instead of emoji.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ThumbsUp, ThumbsDown, HelpCircle, Calendar, AlertTriangle,
  RefreshCw, Bot, AlertOctagon, HelpCircle as Uncategorized, Inbox,
} from 'lucide-react';

interface CategoryStat {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  count: number;
}

const WCA_CATEGORIES: { id: string; name: string; icon: React.ReactNode; color: string }[] = [
  { id: 'interested', name: 'Interessato', icon: <ThumbsUp className="h-4 w-4" />, color: '#22c55e' },
  { id: 'not_interested', name: 'Non Interessato', icon: <ThumbsDown className="h-4 w-4" />, color: '#ef4444' },
  { id: 'request_info', name: 'Richiesta Info', icon: <HelpCircle className="h-4 w-4" />, color: '#3b82f6' },
  { id: 'meeting_request', name: 'Meeting', icon: <Calendar className="h-4 w-4" />, color: '#a855f7' },
  { id: 'complaint', name: 'Reclamo', icon: <AlertTriangle className="h-4 w-4" />, color: '#f97316' },
  { id: 'follow_up', name: 'Follow-Up', icon: <RefreshCw className="h-4 w-4" />, color: '#06b6d4' },
  { id: 'auto_reply', name: 'Auto-Reply', icon: <Bot className="h-4 w-4" />, color: '#9ca3af' },
  { id: 'spam', name: 'Spam', icon: <AlertOctagon className="h-4 w-4" />, color: '#991b1b' },
  { id: 'uncategorized', name: 'Da Classificare', icon: <Uncategorized className="h-4 w-4" />, color: '#6b7280' },
];

interface CategoriesSidebarProps {
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoriesSidebar({ categoryCounts, selectedCategory, onCategoryChange }: CategoriesSidebarProps) {
  const totalCount = Object.values(categoryCounts).reduce((s, c) => s + c, 0);

  return (
    <div className="w-[240px] flex-shrink-0 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 space-y-2 h-full overflow-y-auto">
      {/* Tutte */}
      <button
        onClick={() => onCategoryChange('all')}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
          selectedCategory === 'all'
            ? 'bg-primary/20 border-2 border-primary'
            : 'bg-white/10 hover:bg-white/20 border border-white/20'
        )}
      >
        <Inbox className="h-5 w-5" />
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm">Tutte</div>
        </div>
        <Badge className="bg-white/20">{totalCount}</Badge>
      </button>

      <div className="border-t border-white/10 my-2" />

      {WCA_CATEGORIES.map(cat => {
        const count = categoryCounts[cat.id] || 0;
        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              selectedCategory === cat.id
                ? 'backdrop-blur-md border-2'
                : 'bg-white/10 hover:bg-white/20 border border-white/20'
            )}
            style={selectedCategory === cat.id ? {
              backgroundColor: `${cat.color}30`,
              borderColor: cat.color,
            } : undefined}
          >
            <span style={{ color: cat.color }}>{cat.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-xs leading-tight">{cat.name}</div>
            </div>
            {count > 0 && (
              <Badge style={{ backgroundColor: `${cat.color}50` }}>{count}</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
