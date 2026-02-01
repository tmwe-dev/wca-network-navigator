import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InteractiveGlobe, PARTNER_LOCATIONS, PartnerPoint } from "@/components/globe/InteractiveGlobe";
import { 
  Mail, 
  Send, 
  Users, 
  Globe, 
  BarChart3, 
  Plus,
  CheckCircle,
  Clock,
  TrendingUp
} from "lucide-react";

// Mock campaign data
const CAMPAIGNS = [
  {
    id: "1",
    name: "Q1 2026 Rate Updates",
    status: "sent",
    sentDate: "2026-01-15",
    recipients: 156,
    opens: 124,
    clicks: 67,
  },
  {
    id: "2",
    name: "New Service Announcement - Pharma Logistics",
    status: "sent",
    sentDate: "2026-01-28",
    recipients: 89,
    opens: 72,
    clicks: 34,
  },
  {
    id: "3",
    name: "February Newsletter",
    status: "draft",
    sentDate: null,
    recipients: 0,
    opens: 0,
    clicks: 0,
  },
  {
    id: "4",
    name: "Partnership Renewal Reminder",
    status: "scheduled",
    sentDate: "2026-02-05",
    recipients: 23,
    opens: 0,
    clicks: 0,
  },
];

export default function Campaigns() {
  const [selectedPartner, setSelectedPartner] = useState<PartnerPoint | null>(null);

  const totalCampaigns = PARTNER_LOCATIONS.reduce((acc, p) => acc + p.campaigns, 0);
  const avgOpenRate = 78;
  const avgClickRate = 42;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage email campaigns to your global partner network
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                <p className="text-3xl font-bold">{totalCampaigns}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Send className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Partners Reached</p>
                <p className="text-3xl font-bold">{PARTNER_LOCATIONS.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-success/10 text-success">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Open Rate</p>
                <p className="text-3xl font-bold">{avgOpenRate}%</p>
              </div>
              <div className="p-3 rounded-xl bg-warning/10 text-warning">
                <Mail className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Click Rate</p>
                <p className="text-3xl font-bold">{avgClickRate}%</p>
              </div>
              <div className="p-3 rounded-xl bg-accent text-accent-foreground">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Globe visualization */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Global Partner Network
            </CardTitle>
            <CardDescription>
              Interactive view of email campaign reach across your partner network
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] bg-gradient-to-b from-slate-900 to-slate-950 rounded-b-lg">
              <InteractiveGlobe onPartnerSelect={setSelectedPartner} />
            </div>
          </CardContent>
        </Card>

        {/* Recent campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Recent Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {CAMPAIGNS.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {campaign.status === "sent" && (
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Sent
                        </Badge>
                      )}
                      {campaign.status === "scheduled" && (
                        <Badge variant="secondary" className="bg-warning/10 text-warning">
                          <Clock className="w-3 h-3 mr-1" />
                          Scheduled
                        </Badge>
                      )}
                      {campaign.status === "draft" && (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      {campaign.sentDate && (
                        <span className="text-xs text-muted-foreground">
                          {campaign.sentDate}
                        </span>
                      )}
                    </div>
                  </div>
                  {campaign.status === "sent" && (
                    <div className="text-right">
                      <p className="text-sm font-medium">{campaign.opens}/{campaign.recipients}</p>
                      <p className="text-xs text-muted-foreground">opens</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Partner activity */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Activity by Region</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {PARTNER_LOCATIONS.sort((a, b) => b.campaigns - a.campaigns)
                .slice(0, 5)
                .map((partner) => (
                  <div key={partner.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{partner.city}</p>
                      <p className="text-xs text-muted-foreground">{partner.country}</p>
                    </div>
                    <div className="w-32">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(partner.campaigns / 35) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {partner.campaigns}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
