import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Image, Upload, X } from "lucide-react";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { Badge } from "@/components/ui/badge";

export interface CompanyData {
  companyName: string;
  networks: string[];
  signatureText: string;
  signatureImageUrl: string | null;
}

interface StepCompanyProps {
  data: CompanyData;
  onChange: (data: CompanyData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepCompany({ data, onChange, onNext, onBack }: StepCompanyProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(data.signatureImageUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof CompanyData, value: unknown) =>
    onChange({ ...data, [field]: value });

  const toggleNetwork = (network: string) => {
    const next = data.networks.includes(network)
      ? data.networks.filter(n => n !== network)
      : [...data.networks, network];
    update("networks", next);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Store as data URL for persistence
    const reader = new FileReader();
    reader.onload = () => update("signatureImageUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPreviewUrl(null);
    update("signatureImageUrl", null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Azienda & Firma</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Configura i dettagli aziendali e la tua firma email
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Azienda</Label>
          <Input
            value={data.companyName}
            onChange={e => update("companyName", e.target.value)}
            className="mt-1"
          />
        </div>

        {/* WCA Networks multi-select */}
        <div>
          <Label className="text-sm font-medium">Network WCA</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto">
            {WCA_NETWORKS.map(net => (
              <Badge
                key={net}
                variant={data.networks.includes(net) ? "default" : "outline"}
                className="cursor-pointer text-[11px] transition-colors"
                onClick={() => toggleNetwork(net)}
              >
                {net.replace("WCA ", "")}
              </Badge>
            ))}
          </div>
        </div>

        {/* Email signature */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" /> Firma email
          </Label>
          <Textarea
            value={data.signatureText}
            onChange={e => update("signatureText", e.target.value)}
            placeholder="Mario Rossi&#10;Sales Manager — Transport Management&#10;+39 333 1234567"
            rows={3}
            className="mt-1 text-xs"
          />

          <div className="mt-2">
            {previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Firma"
                  className="h-16 rounded border border-border object-contain"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Aggiungi immagine firma
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Indietro
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continua
        </Button>
      </div>
    </div>
  );
}
