import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Mail, Phone, Globe, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ScrapeSingleResult } from "@/lib/api/wcaScraper";

interface PartnerDetailModalProps {
  partner: ScrapeSingleResult["partner"] | null;
  partnerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartnerDetailModal({ partner, partnerId, open, onOpenChange }: PartnerDetailModalProps) {
  const navigate = useNavigate();

  if (!partner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {partner.company_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3">
            {partner.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{partner.address}</span>
              </div>
            )}
            {(partner.city || partner.country_name) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{[partner.city, partner.country_name].filter(Boolean).join(", ")}</span>
                {partner.country_code && (
                  <Badge variant="outline" className="text-xs">{partner.country_code}</Badge>
                )}
              </div>
            )}
            {partner.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${partner.email}`} className="text-primary hover:underline">{partner.email}</a>
              </div>
            )}
            {partner.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`tel:${partner.phone}`} className="hover:underline">{partner.phone}</a>
              </div>
            )}
            {partner.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                  {partner.website}
                </a>
              </div>
            )}
          </div>

          {partner.wca_id && (
            <div className="text-xs text-muted-foreground">
              WCA ID: {partner.wca_id}
            </div>
          )}

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
