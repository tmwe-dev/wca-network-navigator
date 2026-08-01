/**
 * Feature Flags — Vol. II §10
 *
 * Registry per abilitare/disabilitare moduli v2 a runtime.
 */

import { createLogger } from "./logger";

const logger = createLogger("FeatureFlags");

// ── Types ────────────────────────────────────────────────────────────

export type FeatureFlagName =
  | "v2.partners"
  | "v2.crm"
  | "v2.outreach"
  | "v2.campaigns"
  | "v2.agents"
  | "v2.import"
  | "v2.settings"
  | "v2.diagnostics"
  | "v2.globe"
  | "v2.staff";

interface FeatureFlag {
  readonly name: FeatureFlagName;
  enabled: boolean;
  readonly description: string;
}

// ── Registry ─────────────────────────────────────────────────────────

const flags = new Map<FeatureFlagName, FeatureFlag>();

function register(
  name: FeatureFlagName,
  enabled: boolean,
  description: string,
): void {
  flags.set(name, { name, enabled, description });
}

// ── Default flags (tutti disabilitati inizialmente) ──────────────────

register("v2.partners", false, "Modulo Network/Partners v2");
register("v2.crm", false, "Modulo CRM/Contatti v2");
register("v2.outreach", false, "Modulo Outreach/Email v2");
register("v2.campaigns", false, "Modulo Campagne v2");
register("v2.agents", false, "Modulo Agenti AI v2");
register("v2.import", false, "Modulo Import/Export v2");
register("v2.settings", false, "Modulo Settings v2");
register("v2.diagnostics", false, "Modulo Diagnostics v2");
register("v2.globe", false, "Modulo Globe 3D v2");
register("v2.staff", false, "Modulo Staff Direzionale v2");

// ── Public API ───────────────────────────────────────────────────────

export function isEnabled(name: FeatureFlagName): boolean {
  return flags.get(name)?.enabled ?? false;
}

export function enable(name: FeatureFlagName): void {
  const flag = flags.get(name);
  if (flag) {
    flag.enabled = true;
    logger.info("feature enabled", { feature: name });
  }
}

export function disable(name: FeatureFlagName): void {
  const flag = flags.get(name);
  if (flag) {
    flag.enabled = false;
    logger.info("feature disabled", { feature: name });
  }
}

export function getAllFlags(): ReadonlyArray<Readonly<FeatureFlag>> {
  return Array.from(flags.values());
}
