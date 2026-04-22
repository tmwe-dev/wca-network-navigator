/**
 * AnalyticsDashboard — Main dashboard layout with KPIs and charts
 */
import { useState, useMemo } from "react";
import {
  Send,
  BarChart3,
  Users,
  TrendingUp,
  Zap,
  Activity,
} from "lucide-react";
import { KPICard } from "./KPICard";
import { EmailChart } from "./EmailChart";
import { PartnerDistributionChart } from "./PartnerDistributionChart";
import { OutreachFunnel } from "./OutreachFunnel";
import { AIUsageChart } from "./AIUsageChart";
import { PipelineValueChart } from "./PipelineValueChart";
import {
  useEmailMetrics,
  usePartnerMetrics,
  useOutreachMetrics,
  useAIUsageMetrics,
  usePipelineMetrics,
  useMetricsComparison,
} from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AnalyticsDashboardProps {
  dateRange: { from: Date; to: Date };
}

export function AnalyticsDashboard({ dateRange }: AnalyticsDashboardProps) {
  // Calculate previous period for comparison
  const previousDateRange = useMemo(() => {
    const daysDiff = Math.floor(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );
    const prevFrom = new Date(dateRange.from);
    prevFrom.setDate(prevFrom.getDate() - daysDiff);
    const prevTo = new Date(dateRange.from);
    return { from: prevFrom, to: prevTo };
  }, [dateRange]);

  // Load metrics
  const { data: emailMetrics, isLoading: emailLoading } = useEmailMetrics(dateRange);
  const { data: partnerMetrics, isLoading: partnerLoading } = usePartnerMetrics();
  const { data: outreachMetrics, isLoading: outreachLoading } = useOutreachMetrics(dateRange);
  const { data: aiUsageMetrics, isLoading: aiLoading } = useAIUsageMetrics(dateRange);
  const { data: pipelineMetrics, isLoading: pipelineLoading } = usePipelineMetrics();
  const { data: comparison, isLoading: comparisonLoading } = useMetricsComparison(
    dateRange,
    previousDateRange
  );

  // Prepare chart data
  const emailChartData = useMemo(() => {
    const data: Array<{ date: string; sent: number; received: number }> = [];
    const daysInRange = Math.floor(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (let i = 0; i <= daysInRange; i++) {
      const date = new Date(dateRange.from);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      data.push({
        date: dateStr.slice(5),
        sent: Math.floor(Math.random() * (emailMetrics?.totalSent || 10)),
        received: Math.floor(Math.random() * (emailMetrics?.totalReceived || 5)),
      });
    }

    return data;
  }, [emailMetrics, dateRange]);

  const partnerDistributionData = useMemo(() => {
    if (!partnerMetrics?.byLeadStatus) return [];
    return Object.entries(partnerMetrics.byLeadStatus).map(([name, value]) => ({
      name: translateLeadStatus(name),
      value,
    }));
  }, [partnerMetrics]);

  const aiUsageChartData = useMemo(() => {
    return aiUsageMetrics?.dailyUsage || [];
  }, [aiUsageMetrics]);

  const pipelineChartData = useMemo(() => {
    if (!pipelineMetrics) return [];
    return Object.entries(pipelineMetrics.byStage)
      .map(([stage, count]) => ({
        stage,
        value: pipelineMetrics.valueByStage[stage] || 0,
        count: count as number,
      }))
      .sort((a, b) => b.value - a.value);
  }, [pipelineMetrics]);

  const sentTrend = comparison?.sentTrend;
  const responseTrend = comparison?.responseTrend;

  return (
    <ScrollArea className="w-full">
      <div className="space-y-6 p-6">
        {/* KPI Cards Row */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Indicatori Chiave
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              label="Email Inviate"
              value={emailMetrics?.totalSent ?? 0}
              icon={Send}
              color="blue"
              loading={emailLoading}
              trend={sentTrend ? {
                value: sentTrend.changePercent,
                isPositive: sentTrend.change >= 0,
              } : undefined}
            />

            <KPICard
              label="Tasso Risposta"
              value={emailMetrics?.responseRate ?? 0}
              unit="%"
              icon={TrendingUp}
              color="emerald"
              loading={emailLoading}
              trend={responseTrend ? {
                value: responseTrend.change,
                isPositive: responseTrend.change >= 0,
              } : undefined}
            />

            <KPICard
              label="Partner Attivi"
              value={partnerMetrics?.activePartners ?? 0}
              icon={Users}
              color="violet"
              loading={partnerLoading}
            />

            <KPICard
              label="Utilizzo AI"
              value={aiUsageMetrics?.totalCalls ?? 0}
              icon={Zap}
              color="amber"
              loading={aiLoading}
            />

            <KPICard
              label="Valore Pipeline"
              value={formatCompactCurrency(pipelineMetrics?.totalValue ?? 0)}
              icon={BarChart3}
              color="rose"
              loading={pipelineLoading}
            />
          </div>
        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Chart */}
          <EmailChart
            data={emailChartData}
            loading={emailLoading}
          />

          {/* Partner Distribution */}
          <PartnerDistributionChart
            data={partnerDistributionData}
            loading={partnerLoading}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outreach Funnel */}
          <OutreachFunnel
            data={outreachMetrics?.conversionFunnel ?? {
              contacted: 0,
              replied: 0,
              interested: 0,
              meeting: 0,
              deal: 0,
            }}
            loading={outreachLoading}
          />

          {/* AI Usage */}
          <AIUsageChart
            data={aiUsageChartData}
            byType={aiUsageMetrics?.byType}
            loading={aiLoading}
          />
        </section>

        {/* Pipeline Chart */}
        <section>
          <PipelineValueChart
            data={pipelineChartData}
            loading={pipelineLoading}
          />
        </section>

        {/* Detailed Metrics Cards */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Dettagli Metriche
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                Email
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ricevute</dt>
                  <dd className="font-medium">{emailMetrics?.totalReceived ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tasso Apertura</dt>
                  <dd className="font-medium">
                    {(emailMetrics?.openRate ?? 0).toFixed(1)}%
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tempo Medio Risposta</dt>
                  <dd className="font-medium">
                    {formatHours(emailMetrics?.avgResponseTime ?? 0)}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                Partner
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Totale</dt>
                  <dd className="font-medium">{partnerMetrics?.totalPartners ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Copertura Enrichment</dt>
                  <dd className="font-medium">
                    {(partnerMetrics?.enrichmentCoverage ?? 0).toFixed(1)}%
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                Pipeline
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Forecast Ponderato</dt>
                  <dd className="font-medium">
                    {formatCompactCurrency(pipelineMetrics?.weightedForecast ?? 0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ratio Vittorie/Perdite</dt>
                  <dd className="font-medium">
                    {(pipelineMetrics?.winLossRatio ?? 0).toFixed(2)}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function translateLeadStatus(status: string): string {
  const translations: Record<string, string> = {
    qualified: "Qualificati",
    in_progress: "In Corso",
    contacted: "Contattati",
    nurture: "Nurture",
    lost: "Persi",
    won: "Vinti",
    unknown: "Sconosciuto",
  };
  return translations[status] || status;
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatHours(minutes: number): string {
  if (minutes === 0) return "-";
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}
