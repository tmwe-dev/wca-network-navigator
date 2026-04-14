import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { ROUTE_OUTREACH, ROUTE_NETWORK, ROUTE_CRM, ROUTE_AGENDA, ROUTE_EMAIL_COMPOSER } from "@/constants/routes";
import { useGlobalFilters, type CockpitChannelFilter, type CockpitQualityFilter, type WorkspaceFilterKey } from "@/contexts/GlobalFiltersContext";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { FLAG } from "./constants";

export function useFiltersDrawerState(onOpenChange: (open: boolean) => void) {
  const g = useGlobalFilters();
  const location = useLocation();
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null);
  const isResizing = useRef(false);

  const route = location.pathname;
  const seg = route.replace(/^\/v2/, "");
  const isOutreach = seg === `/${ROUTE_OUTREACH}`;
  const isNetwork = seg === `/${ROUTE_NETWORK}`;
  const isCRM = seg === `/${ROUTE_CRM}`;
  const isAgenda = seg === `/${ROUTE_AGENDA}`;
  const isEmailComposer = seg === `/${ROUTE_EMAIL_COMPOSER}`;

  const outreachTab = g.filters.outreachTab;
  const isCockpit = isOutreach && outreachTab === "cockpit";
  const isWorkspace = isOutreach && outreachTab === "workspace";
  const isInUscita = isOutreach && outreachTab === "inuscita";
  const isCircuito = isOutreach && outreachTab === "circuito";
  const isAttivita = isOutreach && outreachTab === "attivita";
  const isEmail = isOutreach && outreachTab === "email";
  const isWhatsApp = isOutreach && outreachTab === "whatsapp";
  const isLinkedIn = isOutreach && outreachTab === "linkedin";
  const isInbox = isEmail || isWhatsApp || isLinkedIn;

  const { contacts } = useCockpitContacts();

  const countryStats = useMemo(() => {
    if (!isCockpit || !contacts.length) return [];
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      const cc = ((c as any).country as string)?.toUpperCase() || "??"; // eslint-disable-line @typescript-eslint/no-explicit-any -- boundary cast
      counts[cc] = (counts[cc] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count, flag: FLAG[code] || "🌍" }));
  }, [contacts, isCockpit]);

  const sectionTitle = isCockpit ? "Cockpit" : isWorkspace ? "Workspace" : isInUscita ? "In Uscita" : isCircuito ? "Circuito" : isAttivita ? "Attività" : isEmail ? "Email" : isWhatsApp ? "WhatsApp" : isLinkedIn ? "LinkedIn" : isNetwork ? "Network" : isCRM ? (g.filters.crmActiveTab === "biglietti" ? "Biglietti da visita" : "CRM Contatti") : isAgenda ? "Agenda" : isEmailComposer ? "Email Composer" : "Globale";

  useEffect(() => {
    const handler = () => onOpenChange(false);
    window.addEventListener("filters-drawer-close", handler);
    return () => window.removeEventListener("filters-drawer-close", handler);
  }, [onOpenChange]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (isCockpit) {
      if (g.filters.cockpitCountries.size) n++;
      if (g.filters.cockpitChannels.size) n++;
      if (g.filters.cockpitQuality.size) n++;
      if (g.filters.cockpitStatus !== "all") n++;
      if (g.filters.sortBy !== "name") n++;
      if (g.filters.origin.size < 4) n++;
    }
    if (isAttivita) {
      if (g.filters.attivitaStatus !== "all") n++;
      if (g.filters.attivitaPriority !== "all") n++;
    }
    if (isEmail) {
      if (g.filters.emailCategory !== "all") n++;
      if (g.filters.sortingFilter !== "all") n++;
    }
    if (isNetwork) {
      if (g.filters.networkSearch.trim()) n++;
      if (g.filters.networkQuality !== "all") n++;
      if (g.filters.networkSort !== "name") n++;
      if (g.filters.networkSelectedCountries.size > 0) n++;
    }
    if (isCRM) {
      if (g.filters.leadStatus !== "all") n++;
      if (g.filters.holdingPattern !== "out") n++;
      if (g.filters.crmQuality !== "all") n++;
      if (g.filters.crmChannel !== "all") n++;
    }
    return n;
  }, [g.filters, isCockpit, isAttivita, isEmail, isNetwork, isCRM]);

  const handleResetAll = useCallback(() => {
    if (isCockpit) {
      g.setCockpitCountries(new Set()); g.setCockpitChannels(new Set()); g.setCockpitQuality(new Set());
      g.setCockpitStatus("all"); g.setSortBy("name"); g.setOrigin(new Set(["wca", "import", "report_aziende", "bca"])); g.setSearch("");
    }
    if (isAttivita) { g.setAttivitaStatus("all"); g.setAttivitaPriority("all"); g.setSearch(""); }
    if (isEmail || isWhatsApp || isLinkedIn) { g.setSortingFilter("all"); g.setEmailCategory("all"); g.setEmailSort("date_desc"); g.setSortBy("date_desc"); g.setSortingSearch(""); }
    if (isWorkspace) { g.setWorkspaceFilters(new Set()); g.setEmailGenFilter("all"); g.setSearch(""); }
    if (isInUscita) { g.setSortingFilter("all"); g.setSortingSearch(""); }
    if (isNetwork) { g.setNetworkSearch(""); g.setNetworkQuality("all"); g.setNetworkSort("name"); g.setNetworkSelectedCountries(new Set()); g.setNetworkDirectoryOnly(false); }
    if (isCRM) { g.setSearch(""); g.setLeadStatus("all"); g.setHoldingPattern("out"); g.setCrmQuality("all"); g.setCrmChannel("all"); g.setGroupBy("country"); g.setSortBy("name"); }
  }, [g, isCockpit, isAttivita, isEmail, isWhatsApp, isLinkedIn, isWorkspace, isInUscita, isNetwork, isCRM]);

  const toggleOrigin = useCallback((val: string) => {
    const next = new Set(g.filters.origin);
    if (next.has(val)) { if (next.size > 1) next.delete(val); } else next.add(val);
    g.setOrigin(next);
  }, [g]);

  const toggleCockpitCountry = useCallback((code: string) => {
    const next = new Set(g.filters.cockpitCountries);
    if (next.has(code)) next.delete(code); else next.add(code);
    g.setCockpitCountries(next);
  }, [g]);

  const toggleCockpitChannel = useCallback((key: CockpitChannelFilter) => {
    const next = new Set(g.filters.cockpitChannels);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setCockpitChannels(next);
  }, [g]);

  const toggleCockpitQuality = useCallback((key: CockpitQualityFilter) => {
    const next = new Set(g.filters.cockpitQuality);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setCockpitQuality(next);
  }, [g]);

  const toggleWs = useCallback((key: WorkspaceFilterKey) => {
    const next = new Set(g.filters.workspaceFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setWorkspaceFilters(next);
  }, [g]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const w = Math.max(320, Math.min(ev.clientX, window.innerWidth * 0.8));
      setDrawerWidth(w);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return {
    g, drawerWidth, sectionTitle, activeCount, countryStats,
    isCockpit, isWorkspace, isInUscita, isCircuito, isAttivita,
    isEmail, isWhatsApp, isLinkedIn, isInbox,
    isOutreach, isNetwork, isCRM, isAgenda, isEmailComposer,
    handleResetAll, toggleOrigin, toggleCockpitCountry,
    toggleCockpitChannel, toggleCockpitQuality, toggleWs, startResize,
  };
}
