import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Star,
  StarOff,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  Calendar,
  MessageSquare,
  Clock,
  ChevronRight,
  Users,
  ExternalLink,
} from "lucide-react";
import { usePartners, useToggleFavorite, usePartner } from "@/hooks/usePartners";
import { PartnerRating } from "@/components/partners/PartnerRating";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceColor,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";
import { KpiBadges } from "@/components/agents/KpiBadges";
import { EnrichmentCard } from "@/components/agents/EnrichmentCard";
import { SocialLinks } from "@/components/agents/SocialLinks";
import { BulkActionBar } from "@/components/agents/BulkActionBar";
import { AssignActivityDialog } from "@/components/agents/AssignActivityDialog";
import { ActivityList } from "@/components/agents/ActivityList";

function getContactStatus(interactions: any[] | undefined) {
  if (!interactions || interactions.length === 0) {
    return { label: "Primo contatto", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", count: 0 };
  }
  if (interactions.length <= 2) {
    return { label: "In conoscenza", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", count: interactions.length };
  }
  return { label: "Attivo", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", count: interactions.length };
}

export default function Agents() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const { data: partners, isLoading } = usePartners({
    search: search.length >= 2 ? search : undefined,
  });
  const toggleFavorite = useToggleFavorite();

  const { data: selectedPartner, isLoading: detailLoading } = usePartner(selectedId || "");

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0 -m-6 relative">
      {/* Left panel: Agent list */}
      <div className="w-96 flex-shrink-0 border-r flex flex-col bg-card">
        <div className="p-4 border-b space-y-3">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Agenti WCA
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Caricamento..." : `${partners?.length || 0} agenti`}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))
              : partners?.map((partner) => (
                  <div
                    key={partner.id}
                    onClick={() => setSelectedId(partner.id)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-accent/50 transition-colors cursor-pointer",
                      selectedId === partner.id && "bg-accent",
                      selectedIds.has(partner.id) && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1" onClick={(e) => toggleSelection(partner.id, e)}>
                        <Checkbox checked={selectedIds.has(partner.id)} />
                      </div>
                      <span className="text-2xl leading-none mt-0.5">
                        {getCountryFlag(partner.country_code)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">
                            {partner.company_name}
                          </span>
                          {partner.is_favorite && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {partner.city}, {partner.country_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {formatPartnerType(partner.partner_type)}
                          </Badge>
                          {partner.rating && (
                            <span className="text-[10px] text-muted-foreground">
                              ★ {Number(partner.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <KpiBadges partner={partner} compact />
                        {/* Service tags */}
                        {partner.partner_services && partner.partner_services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {partner.partner_services.slice(0, 2).map((s: any, i: number) => (
                              <span
                                key={i}
                                className={cn(
                                  "text-[9px] px-1 py-0 rounded font-medium",
                                  getServiceColor(s.service_category)
                                )}
                              >
                                {formatServiceCategory(s.service_category)}
                              </span>
                            ))}
                            {partner.partner_services.length > 2 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{partner.partner_services.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
          </div>
        </ScrollArea>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onAssignActivity={() => setAssignDialogOpen(true)}
      />

      <AssignActivityDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        partnerIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />



      {/* Right panel: Detail */}
      <div className="flex-1 overflow-y-auto bg-background">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Users className="w-12 h-12 mx-auto opacity-30" />
              <p>Seleziona un agente dalla lista</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : selectedPartner ? (
          <AgentDetail
            partner={selectedPartner}
            onToggleFavorite={() =>
              toggleFavorite.mutate({
                id: selectedPartner.id,
                isFavorite: !selectedPartner.is_favorite,
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function AgentDetail({ partner, onToggleFavorite }: { partner: any; onToggleFavorite: () => void }) {
  const status = getContactStatus(partner.interactions);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <span className="text-5xl">{getCountryFlag(partner.country_code)}</span>
          <div>
            <h2 className="text-xl font-bold">{partner.company_name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="w-4 h-4" />
              {partner.city}, {partner.country_name}
              {partner.wca_id && (
                <Badge variant="outline" className="text-xs ml-1">WCA #{partner.wca_id}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
              <Badge variant="secondary" className="text-xs">
                {formatPartnerType(partner.partner_type)}
              </Badge>
              {partner.rating && (
                <PartnerRating
                  rating={Number(partner.rating)}
                  ratingDetails={partner.rating_details as any}
                  size="sm"
                />
              )}
            </div>
            <KpiBadges partner={partner} />
            <SocialLinks partnerId={partner.id} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onToggleFavorite}>
            {partner.is_favorite ? (
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/partners/${partner.id}`}>
              <ExternalLink className="w-4 h-4 mr-1" />
              Scheda completa
            </Link>
          </Button>
        </div>
      </div>

      {/* Profile description */}
      {partner.profile_description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{partner.profile_description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Contatti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {partner.phone}
              </a>
            )}
            {partner.email && (
              <a href={`mailto:${partner.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {partner.email}
              </a>
            )}
            {partner.website && (
              <a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm hover:text-primary">
                <Globe className="w-4 h-4 text-muted-foreground" />
                {partner.website}
              </a>
            )}
            {partner.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{partner.address}</span>
              </div>
            )}
            {partner.member_since && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Membro dal {format(new Date(partner.member_since), "MMMM yyyy", { locale: it })} ({getYearsMember(partner.member_since)} anni)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CRM Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Stato CRM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stato</span>
              <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Contatti effettuati</span>
              <span className="font-medium">{status.count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Promemoria attivi</span>
              <span className="font-medium">
                {partner.reminders?.filter((r: any) => r.status === "pending").length || 0}
              </span>
            </div>
            {partner.interactions?.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ultimo contatto</span>
                <span className="font-medium">
                  {format(new Date(partner.interactions[partner.interactions.length - 1].interaction_date), "d MMM yyyy", { locale: it })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enrichment from website */}
      <EnrichmentCard partner={partner} />

      {/* Activities */}
      <ActivityList partnerId={partner.id} />

      {/* Services */}
      {partner.partner_services?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Servizi & Specialità</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {partner.partner_services.map((s: any, i: number) => (
                <Badge key={i} className={cn(getServiceColor(s.service_category))}>
                  {formatServiceCategory(s.service_category)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Networks & Certifications */}
      {(partner.partner_networks?.length > 0 || partner.partner_certifications?.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {partner.partner_networks?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Network</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {partner.partner_networks.map((n: any) => (
                    <div key={n.id} className="flex items-center justify-between text-sm">
                      <span>{n.network_name}</span>
                      {n.expires && (
                        <span className="text-xs text-muted-foreground">
                          Scade {format(new Date(n.expires), "MMM yyyy")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {partner.partner_certifications?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Certificazioni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {partner.partner_certifications.map((c: any, i: number) => (
                    <Badge key={i} variant="outline">{c.certification}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Office Contacts */}
      {partner.partner_contacts?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Contatti Ufficio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {partner.partner_contacts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <SocialLinks partnerId={partner.id} contactId={c.id} compact />
                    {c.email && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={`mailto:${c.email}`}><Mail className="w-3.5 h-3.5" /></a>
                      </Button>
                    )}
                    {c.direct_phone && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={`tel:${c.direct_phone}`}><Phone className="w-3.5 h-3.5" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interaction Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Timeline Interazioni ({partner.interactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!partner.interactions?.length ? (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nessuna interazione registrata</p>
              <p className="text-xs">Pronto per il primo contatto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {partner.interactions.map((interaction: any) => (
                <div key={interaction.id} className="flex gap-3 p-3 rounded-lg border">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      interaction.interaction_type === "call" && "bg-green-100 text-green-700",
                      interaction.interaction_type === "email" && "bg-blue-100 text-blue-700",
                      interaction.interaction_type === "meeting" && "bg-purple-100 text-purple-700",
                      interaction.interaction_type === "note" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {interaction.interaction_type?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{interaction.subject}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(interaction.interaction_date), "d MMM yyyy", { locale: it })}
                      </span>
                    </div>
                    {interaction.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{interaction.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminders */}
      {partner.reminders?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Promemoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {partner.reminders.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Scadenza: {format(new Date(r.due_date), "d MMM yyyy", { locale: it })}
                    </p>
                  </div>
                  <Badge variant={r.status === "completed" ? "secondary" : "default"} className="text-xs">
                    {r.status === "completed" ? "Completato" : "In attesa"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
