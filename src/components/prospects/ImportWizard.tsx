import { useImportWizard } from "./wizard/useImportWizard";
import { AtecoStep } from "./wizard/AtecoStep";
import { GeographyStep } from "./wizard/GeographyStep";
import { ProfileStep } from "./wizard/ProfileStep";
import { SummaryStep } from "./wizard/SummaryStep";

export type { WizardState } from "./wizard/useImportWizard";

export interface ImportWizardProps {
  isDark: boolean;
  isExtAvailable: boolean;
  onStart: (state: { atecoCodes: string[]; regions: string[]; provinces: string[]; filters: import("./ProspectAdvancedFilters").ProspectFilters }) => void;
  initialAtecoCodes?: string[];
  initialRegions?: string[];
  initialProvinces?: string[];
}

export function ImportWizard({
  isDark, isExtAvailable, onStart,
  initialAtecoCodes = [], initialRegions = [], initialProvinces = [],
}: ImportWizardProps) {
  const w = useImportWizard({
    initialAtecoCodes,
    initialRegions,
    initialProvinces,
    onStart,
  });

  switch (w.step) {
    case 1:
      return (
        <AtecoStep
          isDark={isDark}
          atecoCodes={w.atecoCodes}
          expandedSection={w.expandedSection}
          onToggleCode={w.toggleCode}
          onToggleSection={w.toggleSection}
          onExpandSection={w.setExpandedSection}
          onStepClick={w.setStep}
          onNext={() => w.setStep(2)}
          onSkip={() => w.setStep(2)}
        />
      );
    case 2:
      return (
        <GeographyStep
          isDark={isDark}
          regions={w.regions}
          provinces={w.provinces}
          onToggleRegion={w.toggleRegion}
          onToggleProvince={w.toggleProvince}
          onStepClick={w.setStep}
          onNext={() => w.setStep(3)}
          onBack={() => w.setStep(1)}
        />
      );
    case 3:
      return (
        <ProfileStep
          isDark={isDark}
          filters={w.filters}
          fatturatoPreset={w.fatturatoPreset}
          dipendentiPreset={w.dipendentiPreset}
          onSetFilters={w.setFilters}
          onApplyFatturato={w.applyFatturatoPreset}
          onApplyDipendenti={w.applyDipendentiPreset}
          onStepClick={w.setStep}
          onNext={() => w.setStep(4)}
          onBack={() => w.setStep(2)}
          onSkip={w.resetFiltersAndSkip}
        />
      );
    case 4:
    default:
      return (
        <SummaryStep
          isDark={isDark}
          isExtAvailable={isExtAvailable}
          atecoCodes={w.atecoCodes}
          regions={w.regions}
          provinces={w.provinces}
          fatturatoPreset={w.fatturatoPreset}
          dipendentiPreset={w.dipendentiPreset}
          hasFilters={w.hasFilters}
          filters={w.filters}
          onStepClick={w.setStep}
          onBack={() => w.setStep(3)}
          onStart={w.handleStart}
          onEditStep={w.setStep}
        />
      );
  }
}
