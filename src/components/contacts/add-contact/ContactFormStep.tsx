/**
 * ContactFormStep — Company tab + Contact tab fields
 */
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Linkedin } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { COUNTRY_OPTIONS, type ContactFormData } from "@/hooks/useAddContactForm";

interface ContactFormStepProps {
  readonly form: ContactFormData;
  readonly onFieldChange: (field: keyof ContactFormData, value: string) => void;
}

export function CompanyTabContent({ form, onFieldChange }: ContactFormStepProps): React.ReactElement {
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome Azienda *</Label>
          <Input value={form.companyName} onChange={e => onFieldChange("companyName", e.target.value)} placeholder="Es. Acme Logistics Srl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Alias</Label>
          <Input value={form.companyAlias} onChange={e => onFieldChange("companyAlias", e.target.value)} placeholder="Nome abbreviato" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Paese</Label>
          <Select value={form.country} onValueChange={v => onFieldChange("country", v)}>
            <SelectTrigger><SelectValue placeholder="Seleziona paese" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {COUNTRY_OPTIONS.map(code => (
                <SelectItem key={code} value={code}>{getCountryFlag(code)} {code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Città</Label>
          <Input value={form.city} onChange={e => onFieldChange("city", e.target.value)} placeholder="Milano" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Indirizzo</Label>
          <Input value={form.address} onChange={e => onFieldChange("address", e.target.value)} placeholder="Via Roma 1" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CAP</Label>
          <Input value={form.zipCode} onChange={e => onFieldChange("zipCode", e.target.value)} placeholder="20100" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Telefono</Label>
          <Input value={form.companyPhone} onChange={e => onFieldChange("companyPhone", e.target.value)} placeholder="+39 02..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input value={form.companyEmail} onChange={e => onFieldChange("companyEmail", e.target.value)} placeholder="info@azienda.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sito Web</Label>
          <Input value={form.website} onChange={e => onFieldChange("website", e.target.value)} placeholder="https://..." />
        </div>
      </div>
    </div>
  );
}

export function ContactTabContent({ form, onFieldChange }: ContactFormStepProps): React.ReactElement {
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome e Cognome</Label>
          <Input value={form.contactName} onChange={e => onFieldChange("contactName", e.target.value)} placeholder="Mario Rossi" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Alias</Label>
          <Input value={form.contactAlias} onChange={e => onFieldChange("contactAlias", e.target.value)} placeholder="Soprannome" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Posizione / Ruolo</Label>
        <Input value={form.position} onChange={e => onFieldChange("position", e.target.value)} placeholder="Sales Manager" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input value={form.contactEmail} onChange={e => onFieldChange("contactEmail", e.target.value)} placeholder="mario@azienda.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Telefono</Label>
          <Input value={form.contactPhone} onChange={e => onFieldChange("contactPhone", e.target.value)} placeholder="+39 02..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mobile</Label>
          <Input value={form.contactMobile} onChange={e => onFieldChange("contactMobile", e.target.value)} placeholder="+39 333..." />
        </div>
      </div>
      {form.linkedinUrl && (
        <div className="flex items-center gap-2 text-xs">
          <Linkedin className="w-3.5 h-3.5 text-muted-foreground" />
          <a href={form.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
            {form.linkedinUrl.replace("https://www.", "").replace("https://", "")}
          </a>
        </div>
      )}
    </div>
  );
}

export function NotesTabContent({ form, onFieldChange }: ContactFormStepProps): React.ReactElement {
  return (
    <div className="space-y-3 mt-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Origine / Fonte</Label>
        <Input value={form.origin} onChange={e => onFieldChange("origin", e.target.value)} placeholder="Es. Fiera Milano 2026, Referral, Cold call..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Note</Label>
        <Textarea value={form.note} onChange={e => onFieldChange("note", e.target.value)} placeholder="Appunti, dettagli, osservazioni..." rows={6} />
      </div>
    </div>
  );
}
