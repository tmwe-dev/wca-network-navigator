/**
 * useSiblingRisk — passthrough di dominio verso il DAL siblingRisk.
 * Isola i componenti dall'import diretto di @/data (regola layer).
 */
export { checkSiblingRisk } from "@/data/siblingRisk";
export type { SiblingRiskRow } from "@/data/siblingRisk";