/**
 * Types for EmailComposerContactPicker modules — zero `any`
 */

export type PickerTab = "partners" | "contacts" | "bca";
export type CountrySort = "name" | "count";
export type PartnerSort = "name" | "country" | "rating";
export type ContactSort = "name" | "company" | "origin" | "country";
export type BcaSort = "name" | "company" | "location";

export interface CountryStat {
  readonly code: string;
  readonly count: number;
  readonly flag: string;
  readonly name: string;
}

export interface PartnerRow {
  readonly id: string;
  readonly company_name: string | null;
  readonly company_alias: string | null;
  readonly country_code: string | null;
  readonly city: string | null;
  readonly lead_status: string | null;
}

export interface PartnerContactRow {
  readonly id: string;
  readonly name: string | null;
  readonly contact_alias: string | null;
  readonly email: string | null;
  readonly title: string | null;
}

export interface ImportedContactRow {
  readonly id: string;
  readonly name: string | null;
  readonly company_name: string | null;
  readonly email: string | null;
  readonly country: string | null;
  readonly contact_alias: string | null;
  readonly company_alias: string | null;
  readonly lead_status: string | null;
  readonly origin: string | null;
  readonly position: string | null;
}

export interface BcaRow {
  readonly id: string;
  readonly contact_name: string | null;
  readonly company_name: string | null;
  readonly email: string | null;
  readonly location: string | null;
  readonly matched_partner_id: string | null;
  readonly lead_status: string | null;
}

export interface PickerState {
  readonly tab: PickerTab;
  readonly search: string;
  readonly expandedPartner: string | null;
  readonly expandedCompany: string | null;
  readonly selectedCountry: string | null;
  readonly countrySort: CountrySort;
  readonly hideHolding: boolean;
  readonly partnerSort: PartnerSort;
  readonly contactSort: ContactSort;
  readonly bcaSort: BcaSort;
  readonly originFilter: string;
}

export type PickerAction =
  | { type: "SET_TAB"; tab: PickerTab }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_EXPANDED_PARTNER"; id: string | null }
  | { type: "SET_EXPANDED_COMPANY"; name: string | null }
  | { type: "SET_SELECTED_COUNTRY"; code: string | null }
  | { type: "TOGGLE_COUNTRY_SORT" }
  | { type: "SET_HIDE_HOLDING"; value: boolean }
  | { type: "SET_PARTNER_SORT"; sort: PartnerSort }
  | { type: "SET_CONTACT_SORT"; sort: ContactSort }
  | { type: "SET_BCA_SORT"; sort: BcaSort }
  | { type: "SET_ORIGIN_FILTER"; origin: string };

export const TABS_CONFIG: readonly { value: PickerTab; label: string; iconName: "Globe" | "Users" | "CreditCard" }[] = [
  { value: "partners", label: "Partner", iconName: "Globe" },
  { value: "contacts", label: "Contatti", iconName: "Users" },
  { value: "bca", label: "BCA", iconName: "CreditCard" },
];

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, tab: action.tab, search: "", expandedPartner: null, expandedCompany: null };
    case "SET_SEARCH":
      return { ...state, search: action.search };
    case "SET_EXPANDED_PARTNER":
      return { ...state, expandedPartner: action.id };
    case "SET_EXPANDED_COMPANY":
      return { ...state, expandedCompany: action.name };
    case "SET_SELECTED_COUNTRY":
      return { ...state, selectedCountry: action.code };
    case "TOGGLE_COUNTRY_SORT":
      return { ...state, countrySort: state.countrySort === "count" ? "name" : "count" };
    case "SET_HIDE_HOLDING":
      return { ...state, hideHolding: action.value };
    case "SET_PARTNER_SORT":
      return { ...state, partnerSort: action.sort };
    case "SET_CONTACT_SORT":
      return { ...state, contactSort: action.sort };
    case "SET_BCA_SORT":
      return { ...state, bcaSort: action.sort };
    case "SET_ORIGIN_FILTER":
      return { ...state, originFilter: action.origin };
    default:
      return state;
  }
}

export const INITIAL_PICKER_STATE: PickerState = {
  tab: "partners",
  search: "",
  expandedPartner: null,
  expandedCompany: null,
  selectedCountry: null,
  countrySort: "count",
  hideHolding: true,
  partnerSort: "name",
  contactSort: "name",
  bcaSort: "name",
  originFilter: "all",
};
