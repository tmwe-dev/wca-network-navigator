import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Mail, Phone, Globe, ExternalLink, Award, Users, Network, FileText, Calendar, Printer } from "lucide-react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import type { ScrapedPartner, AIClassification } from "@/lib/api/wcaScraper";
import { formatServiceCategory } from "@/lib/countries";
import { getRealLogoUrl } from "@/lib/partnerUtils";
import { PartnerRating } from "./PartnerRating";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

interface PartnerDetailModalProps {
  partner: ScrapedPartner | null;
  partnerId?: string;
  aiClassification?: AIClassification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartnerDetailModal({ partner, partnerId, aiClassification, open, onOpenChange }: PartnerDetailModalProps) {
  const navigate = useAppNavigate();

  if (!partner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {getRealLogoUrl(partner.logo_url) && (
              <OptimizedImage src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-12 h-12 object-contain rounded border bg-white p-1" />
            )}
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary shrink-0" />
                {partner.company_name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {partner.city}, {partner.country_name}
                {partner.office_type && (
                  <Badge variant="outline" className="ml-2 text-xs">{partner.office_type === "head_office" ? "Sede Principale" : "Filiale"}</Badge>
                )}
              </p>
              {aiClassification?.rating && (
                <div className="mt-1">
                  <PartnerRating
                    rating={aiClassification.rating}
                    ratingDetails={aiClassification.rating_details}
                    size="md"
                  />
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile description */}
          {partner.profile_description && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
                <FileText className="w-4 h-4" /> Profilo Aziendale
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{partner.profile_description}</p>
            </div>
          )}

          {/* AI Classification */}
          {aiClassification && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
                  🤖 Analisi AI
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">{aiClassification.summary}</p>
                {aiClassification.services?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {aiClassification.services.map((s, i) => (
                      <Badge key={i} className="text-xs">{formatServiceCategory(s)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Contact details */}
          <div className="grid gap-2">
            <h4 className="text-sm font-semibold">Contatti</h4>
            {partner.address && (
              <InfoRow icon={<MapPin className="w-4 h-4" />} label={partner.address} />
            )}
            {partner.phone && (
              <InfoRow icon={<Phone className="w-4 h-4" />} label={partner.phone} href={`tel:${partner.phone}`} />
            )}
            {partner.fax && (
              <InfoRow icon={<Printer className="w-4 h-4" />} label={`Fax: ${partner.fax}`} />
            )}
            {partner.email && (
              <InfoRow icon={<Mail className="w-4 h-4" />} label={partner.email} href={`mailto:${partner.email}`} />
            )}
            {partner.website && (
              <InfoRow icon={<Globe className="w-4 h-4" />} label={partner.website} href={partner.website} external />
            )}
          </div>

          {/* Networks */}
          {partner.networks && partner.networks.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Network className="w-4 h-4" /> Network
                </h4>
                <div className="flex flex-wrap gap-2">
                  {partner.networks.map((n, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {n.name}
                      {n.expires && <span className="ml-1 opacity-70">• Scade: {n.expires}</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Certifications */}
          {partner.certifications && partner.certifications.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Award className="w-4 h-4" /> Certificazioni
                </h4>
                <div className="flex flex-wrap gap-2">
                  {partner.certifications.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Contacts */}
          {partner.contacts && partner.contacts.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Users className="w-4 h-4" /> Contatti Ufficio
                </h4>
                <div className="space-y-1">
                  {partner.contacts.map((c, i) => (
                    <div key={i} className="text-sm flex items-center gap-2">
                      <span className="text-muted-foreground">{c.title}</span>
                      {c.name && <span className="font-medium">{c.name}</span>}
                      {c.email && <a href={`mailto:${c.email}`} className="text-primary text-xs hover:underline">{c.email}</a>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Branch offices */}
          {partner.branch_offices && partner.branch_offices.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Building2 className="w-4 h-4" /> Filiali
                </h4>
                <div className="flex flex-wrap gap-2">
                  {partner.branch_offices.map((b, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {b.city} {b.wca_id && `(ID: ${b.wca_id})`}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Meta info */}
          <Separator />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {partner.wca_id && <span>WCA ID: {partner.wca_id}</span>}
              {partner.member_since && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Membro dal: {partner.member_since}
                </span>
              )}
              {partner.gold_medallion && (
                <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">Gold Medallion</Badge>
              )}
            </div>
          </div>

          {/* CRM button */}
          {partnerId && (
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/partners/${partnerId}`);
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Vedi nel CRM
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, href, external }: { icon: React.ReactNode; label: string; href?: string; external?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-primary hover:underline truncate"
        >
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
