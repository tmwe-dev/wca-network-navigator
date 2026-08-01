import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Handshake, Plus } from "lucide-react";

interface CompanyListHeaderProps {
  countryName?: string;
  filteredCount: number;
  selectedCount: number;
  selectedContactCount: number;
  isBcaSource: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddToCampaign: () => void;
  hasPartners: boolean;
}

export function CompanyListHeader({
  countryName, filteredCount, selectedCount, selectedContactCount,
  isBcaSource, onSelectAll, onDeselectAll, onAddToCampaign, hasPartners,
}: CompanyListHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-primary">
          {isBcaSource ? <Handshake className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
          {countryName
            ? (isBcaSource ? `BCA in ${countryName}` : `Aziende in ${countryName}`)
            : "Seleziona un paese"}
        </h3>
        <Badge variant="outline">{filteredCount} risultati</Badge>
      </div>

      {hasPartners && (
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Seleziona tutti ({filteredCount})
          </Button>
          <Button variant="outline" size="sm" onClick={onDeselectAll} className="text-muted-foreground">
            Deseleziona tutti
          </Button>
        </div>
      )}

      {(selectedCount > 0 || selectedContactCount > 0) && (
        <Button onClick={onAddToCampaign} className="w-full space-button-primary">
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi alla campagna ({selectedCount} aziende{selectedContactCount > 0 ? `, ${selectedContactCount} contatti` : ""})
        </Button>
      )}
    </>
  );
}
