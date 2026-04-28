/**
 * CostDashboardWidget — LOVABLE-93: Cost/usage dashboard for API credits.
 * Shows credits consumed today/week/month, breakdown by operation type, and trend chart.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  CreditCard, TrendingDown, Clock, AlertCircle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  operation: string;
  description: string;
  created_at: string;
}

interface CreditData {
  balance: number;
  total_consumed: number;
  updated_at: string;
}

interface TransactionBreakdown {
  operation: string;
  count: number;
  totalCost: number;
}

const OPERATION_COLORS: Record<string, string> = {
  ai_call: '#3b82f6',
  classify: '#10b981',
  generate_email: '#f59e0b',
  enrich: '#8b5cf6',
  categorize: '#ec4899',
  topup: '#06b6d4',
  other: '#6b7280',
};

export function CostDashboardWidget() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('month');
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession().then(r => ({ data: { user: r.data.session?.user ?? null } }));
      setUserId(data?.user?.id || null);
    };
    getUser();
  }, []);

  // Fetch credit balance
  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ['user-credits', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, total_consumed, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as CreditData | null;
    },
    enabled: !!userId,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transLoading } = useQuery({
    queryKey: ['credit-transactions', userId, timeRange],
    queryFn: async () => {
      if (!userId) return [];

      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case 'day':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }

      const { data, error } = await supabase
        .from('credit_transactions')
        .select('id, user_id, amount, operation, description, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CreditTransaction[];
    },
    enabled: !!userId,
  });

  // Calculate statistics
  const stats = {
    totalCostThisRange: transactions.reduce((sum, t) => {
      if (t.operation !== 'topup') return sum + t.amount;
      return sum;
    }, 0),
    transactionCount: transactions.length,
    avgCostPerTransaction: transactions.length > 0
      ? (transactions.reduce((sum, t) => {
        if (t.operation !== 'topup') return sum + t.amount;
        return sum;
      }, 0) / transactions.filter(t => t.operation !== 'topup').length).toFixed(2)
      : '0.00',
  };

  // Operation breakdown
  const operationBreakdown = transactions.reduce((acc, t) => {
    if (t.operation === 'topup') return acc;

    const existing = acc.find(o => o.operation === t.operation);
    if (existing) {
      existing.count += 1;
      existing.totalCost += t.amount;
    } else {
      acc.push({
        operation: t.operation,
        count: 1,
        totalCost: t.amount,
      });
    }
    return acc;
  }, [] as TransactionBreakdown[]);

  // Daily trend data (last 7 days)
  const dailyTrend = (() => {
    const map: Record<string, number> = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' });
      map[dateStr] = 0;
    }

    transactions.forEach(t => {
      if (t.operation !== 'topup') {
        const dateStr = new Date(t.created_at).toLocaleDateString('it-IT', { month: '2-digit', day: '2-digit' });
        if (map[dateStr] !== undefined) {
          map[dateStr] += t.amount;
        }
      }
    });

    return Object.entries(map).map(([date, cost]) => ({ date, cost }));
  })();

  const isLoading = creditsLoading || transLoading;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        {/* Current Balance */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Crediti</p>
                <p className="text-3xl font-bold">
                  {isLoading ? '—' : credits?.balance || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoading ? 'Caricamento...' : `Consumati totali: ${credits?.total_consumed || 0}`}
                </p>
              </div>
              <CreditCard className="h-10 w-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Cost This Period */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Costo questo {timeRange === 'day' ? 'giorno' : timeRange === 'week' ? 'settimana' : 'mese'}
                </p>
                <p className="text-3xl font-bold">
                  {isLoading ? '—' : stats.totalCostThisRange}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoading ? 'Caricamento...' : `${stats.transactionCount} transazioni`}
                </p>
              </div>
              <TrendingDown className="h-10 w-10 text-orange-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Cost per Transaction */}
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Costo Medio per Op.</p>
                <p className="text-3xl font-bold">
                  {isLoading ? '—' : stats.avgCostPerTransaction}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoading ? 'Caricamento...' : 'Crediti per operazione'}
                </p>
              </div>
              <Zap className="h-10 w-10 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Details */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Analisi Dettagliata
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="trend" className="space-y-4">
            <TabsList>
              <TabsTrigger value="trend">Trend Ultimi 7 Giorni</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown per Tipo</TabsTrigger>
              <TabsTrigger value="transactions">Transazioni</TabsTrigger>
            </TabsList>

            {/* Trend Chart */}
            <TabsContent value="trend" className="space-y-4">
              <div className="flex gap-2 mb-4">
                {(['day', 'week', 'month'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      'px-3 py-1 rounded text-sm transition-all',
                      timeRange === range
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {range === 'day' ? 'Giorno' : range === 'week' ? 'Settimana' : 'Mese'}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--primary)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            {/* Breakdown */}
            <TabsContent value="breakdown" className="space-y-4">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : operationBreakdown.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={operationBreakdown}
                        dataKey="totalCost"
                        nameKey="operation"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {operationBreakdown.map((entry) => (
                          <Cell
                            key={`cell-${entry.operation}`}
                            fill={OPERATION_COLORS[entry.operation] || OPERATION_COLORS.other}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--background)',
                          border: '1px solid var(--border)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-2 gap-2">
                    {operationBreakdown.map((op) => (
                      <div
                        key={op.operation}
                        className="p-3 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: OPERATION_COLORS[op.operation] || OPERATION_COLORS.other,
                            }}
                          />
                          <p className="text-sm font-medium capitalize">{op.operation}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {op.count} × {(op.totalCost / op.count).toFixed(2)} crediti
                        </p>
                        <p className="text-sm font-bold text-primary mt-1">
                          {op.totalCost} crediti
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground">
                  Nessuna transazione in questo periodo
                </div>
              )}
            </TabsContent>

            {/* Transactions List */}
            <TabsContent value="transactions" className="space-y-2">
              {isLoading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-lg border border-border/50 bg-muted/30 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium capitalize">
                            {tx.operation === 'topup' ? 'Ricarica' : tx.operation}
                          </p>
                          <Badge
                            variant={
                              tx.operation === 'topup'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </Badge>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {tx.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString('it-IT')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-semibold',
                            tx.amount > 0
                              ? 'text-green-600'
                              : 'text-orange-600'
                          )}
                        >
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground">
                  Nessuna transazione
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Note */}
      {!isLoading && credits && credits.balance < 20 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-700">
                Saldo crediti basso
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Il tuo saldo è inferiore a 20 crediti. Considera di ricaricare per evitare interruzioni.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
