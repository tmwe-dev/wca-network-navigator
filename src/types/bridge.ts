/**
 * Contratti tipizzati per le risposte dei bridge estensioni.
 * Fonte di verità: Documento 2, §2 regola 2 — "Prima contratti e schemi, poi prompt"
 * Ogni bridge restituisce una risposta con schema definito.
 */

/** Risposta base comune a tutti i bridge */
export interface BridgeResponse {
  success: boolean;
  error?: string;
}

/** Risposta da verifySession WhatsApp */
export interface VerifySessionResult extends BridgeResponse {
  authenticated?: boolean;
  method?: string;
  reason?: string;
  diagnostic?: {
    url: string;
    title: string;
    hasQR: boolean;
    hasLoadingScreen: boolean;
    sidebar: boolean;
    sidebarSelector: string;
    chatItems: number;
    chatItemsMethod: string;
    hasComposeBox: boolean;
    textboxCount: number;
  };
}

/** Risposta da sendWhatsApp */
export interface WhatsAppSendResult extends BridgeResponse {
  method?: string;
}

/** Singolo messaggio WhatsApp letto dalla sidebar */
export interface WhatsAppReadMessage {
  contact: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  phone?: string;
  jid?: string;
}

/** Risposta da readUnread WhatsApp */
export interface ReadUnreadResult extends BridgeResponse {
  messages?: WhatsAppReadMessage[];
  scanned?: number;
  version?: string;
}

/** Risposta da LinkedIn sendDirectMessage */
export interface LinkedInSendResult extends BridgeResponse {
  method?: string;
}

/** Risposta da LinkedIn searchProfile */
export interface LinkedInSearchResult extends BridgeResponse {
  profile?: {
    profileUrl: string;
    name?: string;
    headline?: string;
  };
}

/** Risposta da LinkedIn sendConnectionRequest */
export interface LinkedInConnectResult extends BridgeResponse {
  method?: string;
}

/** Risposta generica da FireScrape googleSearch */
export interface FireScrapeSearchResult extends BridgeResponse {
  data?: Array<{
    url: string;
    title?: string;
    snippet?: string;
  }>;
}
