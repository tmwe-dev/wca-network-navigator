/**
 * Email contact picker shared contracts + reducer.
 *
 * Transitional types layer (strangler seam): re-exports the picker contracts
 * and its (pure) reducer so that hooks depend on the types layer instead of
 * `@/components/global/email-picker/*`. Includes runtime re-exports
 * (pickerReducer, INITIAL_PICKER_STATE, TABS_CONFIG) — behaviour unchanged.
 */
export { pickerReducer, INITIAL_PICKER_STATE, TABS_CONFIG } from "@/components/global/email-picker/types";
export type {
  PickerTab,
  CountrySort,
  PartnerSort,
  ContactSort,
  BcaSort,
  CountryStat,
  PartnerRow,
  PartnerContactRow,
  ImportedContactRow,
  BcaRow,
  PickerState,
  PickerAction,
} from "@/components/global/email-picker/types";
