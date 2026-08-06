/**
 * Types, reducer and initial state for the Add Contact form.
 * Extracted verbatim from useAddContactForm.ts (no behavioral change).
 */
export interface ContactFormData {
  companyName: string;
  companyAlias: string;
  country: string;
  city: string;
  address: string;
  zipCode: string;
  companyPhone: string;
  companyEmail: string;
  website: string;
  contactName: string;
  contactAlias: string;
  position: string;
  contactEmail: string;
  contactPhone: string;
  contactMobile: string;
  origin: string;
  note: string;
  logoUrl: string;
  linkedinUrl: string;
}

export interface GoogleSearchResult {
  title: string;
  url: string;
  description: string;
}

interface UIFlags {
  saving: boolean;
  savedId: string | null;
  placesLoading: boolean;
  logoLoading: boolean;
  linkedinLoading: boolean;
}

export interface AddContactState {
  form: ContactFormData;
  ui: UIFlags;
  placesResults: GoogleSearchResult[];
}

export const emptyForm: ContactFormData = {
  companyName: "",
  companyAlias: "",
  country: "",
  city: "",
  address: "",
  zipCode: "",
  companyPhone: "",
  companyEmail: "",
  website: "",
  contactName: "",
  contactAlias: "",
  position: "",
  contactEmail: "",
  contactPhone: "",
  contactMobile: "",
  origin: "",
  note: "",
  logoUrl: "",
  linkedinUrl: "",
};

export const initialState: AddContactState = {
  form: { ...emptyForm },
  ui: { saving: false, savedId: null, placesLoading: false, logoLoading: false, linkedinLoading: false },
  placesResults: [],
};

export type Action =
  | { type: "SET_FIELD"; field: keyof ContactFormData; value: string }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_SAVED_ID"; payload: string | null }
  | { type: "SET_PLACES_LOADING"; payload: boolean }
  | { type: "SET_PLACES_RESULTS"; payload: GoogleSearchResult[] }
  | { type: "SET_LOGO_LOADING"; payload: boolean }
  | { type: "SET_LINKEDIN_LOADING"; payload: boolean }
  | { type: "RESET" }
  | { type: "BATCH_FORM"; payload: Partial<ContactFormData> };

export function reducer(state: AddContactState, action: Action): AddContactState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "SET_SAVING":
      return { ...state, ui: { ...state.ui, saving: action.payload } };
    case "SET_SAVED_ID":
      return { ...state, ui: { ...state.ui, savedId: action.payload } };
    case "SET_PLACES_LOADING":
      return { ...state, ui: { ...state.ui, placesLoading: action.payload } };
    case "SET_PLACES_RESULTS":
      return { ...state, placesResults: action.payload };
    case "SET_LOGO_LOADING":
      return { ...state, ui: { ...state.ui, logoLoading: action.payload } };
    case "SET_LINKEDIN_LOADING":
      return { ...state, ui: { ...state.ui, linkedinLoading: action.payload } };
    case "RESET":
      return { ...initialState };
    case "BATCH_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    default:
      return state;
  }
}
