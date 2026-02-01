import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Building2, Phone, Mail, Globe, MapPin, Calendar, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceColor,
  getPriorityColor,
} from "@/lib/countries";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: partner, isLoading } = usePartner(id || "");
  const toggleFavorite = useToggleFavorite();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Partner not found</p>
        <Button asChild className="mt-4">
          <Link to="/partners">Back to Partners</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/partners">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="text-5xl">{getCountryFlag(partner.country_code)}</div>
            <div>
              <h1 className="text-2xl font-bold">{partner.company_name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                <span>
                  {partner.city}, {partner.country_name}
                </span>
                {partner.wca_id && (
                  <Badge variant="outline" className="ml-2">
                    WCA #{partner.wca_id}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() =>
            toggleFavorite.mutate({
              id: partner.id,
              isFavorite: !partner.is_favorite,
            })
          }
        >
          {partner.is_favorite ? (
            <>
              <Star className="w-4 h-4 mr-2 fill-amber-400 text-amber-400" />
              Favorited
            </>
          ) : (
            <>
              <StarOff className="w-4 h-4 mr-2" />
              Add to Favorites
            </>
          )}
        </Button>
      </div>

      {/* Content tabs */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({partner.partner_contacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="services">Services & Networks</TabsTrigger>
          <TabsTrigger value="crm">
            CRM ({partner.interactions?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary">{formatPartnerType(partner.partner_type)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Office Type</span>
                    <span className="capitalize">{partner.office_type?.replace("_", " ")}</span>
                  </div>
                  {partner.address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="text-right max-w-[60%]">{partner.address}</span>
                    </div>
                  )}
                  {partner.member_since && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Member Since</span>
                      <span>
                        {format(new Date(partner.member_since), "MMM yyyy")} (
                        {getYearsMember(partner.member_since)} years)
                      </span>
                    </div>
                  )}
                  {partner.membership_expires && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires</span>
                      <span>{format(new Date(partner.membership_expires), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {partner.phone && (
                  <a
                    href={`tel:${partner.phone}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{partner.phone}</p>
                    </div>
                  </a>
                )}
                {partner.email && (
                  <a
                    href={`mailto:${partner.email}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{partner.email}</p>
                    </div>
                  </a>
                )}
                {partner.website && (
                  <a
                    href={`https://${partner.website.replace(/^https?:\/\//, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <p className="text-sm text-muted-foreground">{partner.website}</p>
                    </div>
                  </a>
                )}
              </CardContent>
            </Card>
          </div>

          {partner.profile_description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{partner.profile_description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {partner.partner_contacts?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No contacts on file
                </p>
              ) : (
                <div className="space-y-4">
                  {partner.partner_contacts?.map((contact: any) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contact.name}</p>
                          {contact.is_primary && (
                            <Badge variant="secondary" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {contact.title && (
                          <p className="text-sm text-muted-foreground">{contact.title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {contact.direct_phone && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`tel:${contact.direct_phone}`}>
                              <Phone className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {contact.email && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`mailto:${contact.email}`}>
                              <Mail className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Services</CardTitle>
              </CardHeader>
              <CardContent>
                {partner.partner_services?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No services listed</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {partner.partner_services?.map((s: any, i: number) => (
                      <Badge key={i} className={cn(getServiceColor(s.service_category))}>
                        {formatServiceCategory(s.service_category)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Networks</CardTitle>
              </CardHeader>
              <CardContent>
                {partner.partner_networks?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No network memberships</p>
                ) : (
                  <div className="space-y-3">
                    {partner.partner_networks?.map((n: any) => (
                      <div key={n.id} className="flex items-center justify-between">
                        <span className="font-medium">{n.network_name}</span>
                        {n.expires && (
                          <span className="text-sm text-muted-foreground">
                            Expires {format(new Date(n.expires), "MMM yyyy")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                {partner.partner_certifications?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No certifications listed</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {partner.partner_certifications?.map((c: any, i: number) => (
                      <Badge key={i} variant="outline">
                        {c.certification}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CRM Tab */}
        <TabsContent value="crm" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Interaction Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {partner.interactions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No interactions recorded
                  </p>
                ) : (
                  <div className="space-y-4">
                    {partner.interactions?.map((interaction: any) => (
                      <div
                        key={interaction.id}
                        className="flex gap-4 p-4 rounded-lg border"
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                            interaction.interaction_type === "call" && "bg-green-100 text-green-700",
                            interaction.interaction_type === "email" && "bg-blue-100 text-blue-700",
                            interaction.interaction_type === "meeting" &&
                              "bg-purple-100 text-purple-700",
                            interaction.interaction_type === "note" && "bg-gray-100 text-gray-700"
                          )}
                        >
                          {interaction.interaction_type?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{interaction.subject}</p>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(interaction.interaction_date), "MMM d, yyyy")}
                            </span>
                          </div>
                          {interaction.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {interaction.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reminders</CardTitle>
              </CardHeader>
              <CardContent>
                {partner.reminders?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active reminders
                  </p>
                ) : (
                  <div className="space-y-3">
                    {partner.reminders?.map((reminder: any) => (
                      <div key={reminder.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{reminder.title}</p>
                          <Badge
                            className={cn("text-[10px]", getPriorityColor(reminder.priority))}
                          >
                            {reminder.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(reminder.due_date), "MMM d, yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
