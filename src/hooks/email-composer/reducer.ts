/**
 * Reducer + initial state for EmailComposer
 */
import type { ComposerState, Action } from "./types";

export const initialState: ComposerState = {
  email: { subject: "", htmlBody: "", selectedAttachments: [], emailLinks: [], newLinkLabel: "", newLinkUrl: "" },
  ui: { manualEmail: "", previewOpen: false, unknownEmailDialog: false, pendingEmail: "", manualContactName: "", manualCompanyName: "" },
  ai: { aiGenerating: false, aiImproving: false, aiGeneratedBody: "", aiGeneratedSubject: "", learningDialogOpen: false, editAnalysis: null, pendingSend: false },
  template: { saveTemplateOpen: false, templateName: "", templateCategory: "primo_contatto", customCategory: "" },
  queue: { sending: false, activeDraftId: null, activeQueueStatus: "idle" },
};

export function reducer(state: ComposerState, action: Action): ComposerState {
  switch (action.type) {
    case "SET_SUBJECT": return { ...state, email: { ...state.email, subject: action.payload } };
    case "SET_HTML_BODY": return { ...state, email: { ...state.email, htmlBody: action.payload } };
    case "SET_ATTACHMENTS": return { ...state, email: { ...state.email, selectedAttachments: action.payload } };
    case "SET_EMAIL_LINKS": return { ...state, email: { ...state.email, emailLinks: action.payload } };
    case "SET_NEW_LINK_LABEL": return { ...state, email: { ...state.email, newLinkLabel: action.payload } };
    case "SET_NEW_LINK_URL": return { ...state, email: { ...state.email, newLinkUrl: action.payload } };
    case "SET_MANUAL_EMAIL": return { ...state, ui: { ...state.ui, manualEmail: action.payload } };
    case "TOGGLE_PREVIEW": return { ...state, ui: { ...state.ui, previewOpen: !state.ui.previewOpen } };
    case "SET_UNKNOWN_DIALOG": return { ...state, ui: { ...state.ui, unknownEmailDialog: action.payload } };
    case "SET_PENDING_EMAIL": return { ...state, ui: { ...state.ui, pendingEmail: action.payload } };
    case "SET_MANUAL_CONTACT_NAME": return { ...state, ui: { ...state.ui, manualContactName: action.payload } };
    case "SET_MANUAL_COMPANY_NAME": return { ...state, ui: { ...state.ui, manualCompanyName: action.payload } };
    case "SET_AI_GENERATING": return { ...state, ai: { ...state.ai, aiGenerating: action.payload } };
    case "SET_AI_IMPROVING": return { ...state, ai: { ...state.ai, aiImproving: action.payload } };
    case "SET_AI_GENERATED": return { ...state, ai: { ...state.ai, aiGeneratedBody: action.payload.body, aiGeneratedSubject: action.payload.subject } };
    case "SET_LEARNING_DIALOG": return { ...state, ai: { ...state.ai, learningDialogOpen: action.payload } };
    case "SET_EDIT_ANALYSIS": return { ...state, ai: { ...state.ai, editAnalysis: action.payload } };
    case "SET_PENDING_SEND": return { ...state, ai: { ...state.ai, pendingSend: action.payload } };
    case "SET_SAVE_TEMPLATE_OPEN": return { ...state, template: { ...state.template, saveTemplateOpen: action.payload } };
    case "SET_TEMPLATE_NAME": return { ...state, template: { ...state.template, templateName: action.payload } };
    case "SET_TEMPLATE_CATEGORY": return { ...state, template: { ...state.template, templateCategory: action.payload } };
    case "SET_CUSTOM_CATEGORY": return { ...state, template: { ...state.template, customCategory: action.payload } };
    case "SET_SENDING": return { ...state, queue: { ...state.queue, sending: action.payload } };
    case "SET_ACTIVE_DRAFT": return { ...state, queue: { ...state.queue, activeDraftId: action.payload.id, activeQueueStatus: action.payload.status } };
    case "SET_QUEUE_STATUS": return { ...state, queue: { ...state.queue, activeQueueStatus: action.payload } };
    case "RESET_TEMPLATE_FORM": return { ...state, template: { saveTemplateOpen: false, templateName: "", templateCategory: "primo_contatto", customCategory: "" } };
    default: return state;
  }
}
