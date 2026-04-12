/**
 * EmailComposerContactPicker — Orchestrator (refactored from 678-line monolith)
 */
import { useEmailContactPicker } from "@/hooks/useEmailContactPicker";
import { PickerHeader } from "./email-picker/PickerHeader";
import { CountryStrip } from "./email-picker/CountryStrip";
import { ResultsList } from "./email-picker/ResultsList";

export function EmailComposerContactPicker({ onConfirm }: { onConfirm?: () => void }) {
  const picker = useEmailContactPicker();

  return (
    <div className="flex flex-col h-full">
      <PickerHeader picker={picker} />

      {/* Main: Left country strip + Right results */}
      <div className="flex-1 flex min-h-0 gap-2">
        <CountryStrip
          sortedCountries={picker.sortedCountries}
          selectedCountry={picker.state.selectedCountry}
          countrySort={picker.state.countrySort}
          dispatch={picker.dispatch}
        />
        <ResultsList picker={picker} />
      </div>
    </div>
  );
}
