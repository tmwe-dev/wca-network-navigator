import { toneLabel } from "../../lib/toneDetector";
import type { DetectedTone, EmailPipelineStage, PartnerRow } from "./types";

interface BuildPipelineArgs {
  partner: Pick<PartnerRow, "company_name" | "lead_status" | "status_reason"> | null;
  tone: DetectedTone;
  hasContact?: boolean;
  contactEmailMissing?: boolean;
  kbCount?: number;
  promptsApplied?: ReadonlyArray<string>;
  playbookActive?: boolean;
  model?: string;
  generationOk?: boolean;
  generationWarning?: string | null;
  language?: string;
}

export function buildEmailPipeline(args: BuildPipelineArgs): EmailPipelineStage[] {
  const {
    partner, tone, hasContact, contactEmailMissing,
    kbCount = 0, promptsApplied = [], playbookActive = false,
    model, generationOk, generationWarning, language = "it",
  } = args;

  // 1) Oracolo
  let oracoloStatus: EmailPipelineStage["status"] = partner ? "ok" : "failed";
  let oracoloDetail: string | undefined;
  let oracoloTooltip = partner ? `${partner.company_name} risolto dal CRM` : "Partner non risolto";
  if (partner?.lead_status === "blacklisted") {
    oracoloStatus = "failed";
    oracoloDetail = "blacklist";
    oracoloTooltip = `Partner in blacklist${partner.status_reason ? `: ${partner.status_reason}` : ""}`;
  } else if (partner?.lead_status === "holding") {
    oracoloStatus = "warn";
    oracoloDetail = "holding";
    oracoloTooltip = "Holding pattern attivo";
  } else if (partner?.lead_status === "archived") {
    oracoloStatus = "warn";
    oracoloDetail = "archived";
  } else if (contactEmailMissing) {
    oracoloStatus = "warn";
    oracoloDetail = "no email";
    oracoloTooltip = "Partner trovato ma senza email contatto";
  } else if (!hasContact && partner) {
    oracoloDetail = "no contact";
    oracoloTooltip = "Nessun contatto censito, uso destinatario generico";
  }

  // 2) Architetto (KB + playbook + contesto)
  const architettoStatus: EmailPipelineStage["status"] = kbCount > 0 || playbookActive ? "ok" : "skipped";
  const architettoDetail =
    kbCount > 0
      ? `KB·${kbCount}${playbookActive ? " + playbook" : ""}`
      : playbookActive ? "playbook" : "—";

  // 3) Prompt Lab
  const promptStatus: EmailPipelineStage["status"] = promptsApplied.length > 0 ? "ok" : "skipped";
  const promptDetail = promptsApplied.length > 0 ? `${promptsApplied.length}` : "—";
  const promptTooltip = promptsApplied.length > 0
    ? `Prompt operativi applicati:\n• ${promptsApplied.join("\n• ")}`
    : "Nessun prompt operativo aggiuntivo";

  // 4) Giornalista (editorial review obbligatorio in generate-email)
  let giornalistaStatus: EmailPipelineStage["status"] = "skipped";
  let giornalistaDetail: string | undefined;
  let giornalistaTooltip = "Editorial review eseguito da generate-email";
  if (generationOk === true) {
    giornalistaStatus = "ok";
    giornalistaDetail = "review ok";
  } else if (generationOk === false) {
    giornalistaStatus = "failed";
    giornalistaDetail = "fail";
    giornalistaTooltip = generationWarning ?? "Generazione/review fallita";
  }

  // 5) Bozza pronta (modello + tono + lingua)
  let bozzaStatus: EmailPipelineStage["status"] = "skipped";
  let bozzaDetail: string | undefined;
  if (generationOk === true) {
    bozzaStatus = "ok";
    bozzaDetail = `${toneLabel(tone)} · ${language}`;
  } else if (generationOk === false) {
    bozzaStatus = "failed";
    bozzaDetail = "—";
  }
  const bozzaTooltip = model ? `Modello: ${model} · tono: ${toneLabel(tone)}` : `Tono: ${toneLabel(tone)}`;

  return [
    { id: "oracolo",     label: "Oracolo",     status: oracoloStatus,     detail: oracoloDetail, tooltip: oracoloTooltip },
    { id: "architetto",  label: "Architetto",  status: architettoStatus,  detail: architettoDetail,
      tooltip: kbCount > 0 ? `${kbCount} sezioni KB consultate${playbookActive ? " + playbook attivo" : ""}` : "Nessuna sezione KB" },
    { id: "prompt-lab",  label: "Prompt Lab",  status: promptStatus,      detail: promptDetail,    tooltip: promptTooltip },
    {
      id: "calligrafia",
      label: "Calligrafia",
      status: generationOk === true ? "ok" : (generationOk === false ? "failed" : "skipped"),
      detail: generationOk === true ? "KB" : undefined,
      tooltip: 'Regole di formattazione email caricate dalla KB "Calligrafia" e iniettate nel prompt (server-side, generate-email).',
    },
    { id: "giornalista", label: "Giornalista", status: giornalistaStatus, detail: giornalistaDetail, tooltip: giornalistaTooltip },
    { id: "bozza",       label: "Bozza",       status: bozzaStatus,       detail: bozzaDetail,     tooltip: bozzaTooltip },
  ];
}