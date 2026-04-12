/**
 * AddContactDialog — Orchestrator (refactored from 797-line monolith)
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Search, Briefcase } from "lucide-react";
import { useAddContactForm } from "@/hooks/useAddContactForm";
import { ContactSearchStep } from "@/components/contacts/add-contact/ContactSearchStep";
import { ContactEnrichmentPanel } from "@/components/contacts/add-contact/ContactEnrichmentPanel";
import { CompanyTabContent, ContactTabContent, NotesTabContent } from "@/components/contacts/add-contact/ContactFormStep";
import { ContactFormActions } from "@/components/contacts/add-contact/ContactFormActions";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const c = useAddContactForm();
  const { form, ui } = c.state;

  const handleClose = () => { c.reset(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Nuovo Contatto / Azienda
          </DialogTitle>
          <DialogDescription className="sr-only">
            Maschera di inserimento manuale con ricerca Google, logo, LinkedIn e Deep Search collegati al record salvato.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="search" className="text-xs gap-1"><Search className="w-3.5 h-3.5" /> Ricerca</TabsTrigger>
            <TabsTrigger value="company" className="text-xs gap-1"><Building2 className="w-3.5 h-3.5" /> Azienda</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs gap-1"><User className="w-3.5 h-3.5" /> Contatto</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1"><Briefcase className="w-3.5 h-3.5" /> Note</TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <ContactSearchStep
              companyName={form.companyName} contactName={form.contactName}
              placesLoading={ui.placesLoading} placesResults={c.state.placesResults}
              onFieldChange={c.setField} onSearch={c.handlePlacesSearch} onApplyResult={c.applyPlacesResult}
            />
            <div className="space-y-3 mt-3">
              <ContactEnrichmentPanel
                logoUrl={form.logoUrl} linkedinUrl={form.linkedinUrl} website={form.website}
                savedId={ui.savedId} logoLoading={ui.logoLoading} linkedinLoading={ui.linkedinLoading}
                deepSearchRunning={c.deepSearchRunning} fsBridgeAvailable={c.fsBridgeAvailable}
                onLogoSearch={c.handleLogoSearch} onLinkedInSearch={c.handleLinkedInSearch}
                onDeepSearch={c.handleDeepSearch}
                onLogoError={() => c.setField("logoUrl", "")}
              />
            </div>
          </TabsContent>

          <TabsContent value="company">
            <CompanyTabContent form={form} onFieldChange={c.setField} />
          </TabsContent>

          <TabsContent value="contact">
            <ContactTabContent form={form} onFieldChange={c.setField} />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTabContent form={form} onFieldChange={c.setField} />
          </TabsContent>
        </Tabs>

        <ContactFormActions
          companyName={form.companyName} contactName={form.contactName}
          logoUrl={form.logoUrl} savedId={ui.savedId} saving={ui.saving}
          onClose={handleClose} onSave={c.handleSave} onReset={c.reset}
        />
      </DialogContent>
    </Dialog>
  );
}
