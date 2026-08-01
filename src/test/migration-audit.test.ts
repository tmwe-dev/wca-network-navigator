/**
 * Gate offline sulla riproducibilità delle migrazioni.
 * Nessuna connessione al DB: analizza solo i file in supabase/migrations.
 *
 * I valori sono RATCHET: possono solo scendere. Un nuovo file che introduce
 * naming non standard, timestamp duplicati, ordinamento ambiguo, funzioni
 * SECURITY DEFINER senza search_path o view SECURITY DEFINER fa fallire il test.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error - script JS senza tipi, importato solo dai test
import { auditMigrations } from "../../scripts/audit-migrations.mjs";

interface Audit {
  totalMigrations: number;
  badNames: string[];
  duplicateTimestamps: { prefix: string; files: string[] }[];
  orderingConflicts: { file: string }[];
  referencedBeforeCreation: { file: string; object: string }[];
  definerFunctionsWithoutSearchPath: { file: string; fn: string }[];
  securityDefinerViews: { file: string; view: string }[];
  tablesWithoutGrant: { file: string; table: string }[];
  schemaDrift: {
    typeTables: number;
    createdTables: number;
    missingInTypes: string[];
    missingInMigrations: string[];
  };
}

const audit = auditMigrations() as Audit;

// Ratchet storici — misurati 2026-08-01, riducibili ma mai incrementabili.
const RATCHET = {
  badNames: 7,
  duplicateTimestampGroups: 2,
  orderingConflicts: 7,
  referencedBeforeCreation: 7,
  definerFunctionsWithoutSearchPath: 1,
  tablesWithoutGrant: 202,
  missingInTypes: 17,
  missingInMigrations: 70,
};

describe("migration audit (offline)", () => {
  it("trova le migrazioni", () => {
    expect(audit.totalMigrations).toBeGreaterThan(400);
  });

  it("naming a 14 cifre: nessun nuovo file non standard", () => {
    expect(audit.badNames.length).toBeLessThanOrEqual(RATCHET.badNames);
  });

  it("nessun nuovo gruppo di timestamp duplicati", () => {
    expect(audit.duplicateTimestamps.length).toBeLessThanOrEqual(
      RATCHET.duplicateTimestampGroups,
    );
  });

  it("nessun nuovo conflitto di ordinamento", () => {
    expect(audit.orderingConflicts.length).toBeLessThanOrEqual(RATCHET.orderingConflicts);
  });

  it("nessun nuovo oggetto alterato prima della creazione", () => {
    expect(audit.referencedBeforeCreation.length).toBeLessThanOrEqual(
      RATCHET.referencedBeforeCreation,
    );
  });

  it("nessuna nuova funzione SECURITY DEFINER senza search_path", () => {
    expect(audit.definerFunctionsWithoutSearchPath.length).toBeLessThanOrEqual(
      RATCHET.definerFunctionsWithoutSearchPath,
    );
  });

  it("nessuna view SECURITY DEFINER dichiarata nelle migrazioni", () => {
    expect(audit.securityDefinerViews).toEqual([]);
  });

  it("nessuna nuova CREATE TABLE public senza GRANT", () => {
    expect(audit.tablesWithoutGrant.length).toBeLessThanOrEqual(RATCHET.tablesWithoutGrant);
  });

  it("drift schema/tipi non peggiora", () => {
    expect(audit.schemaDrift.missingInTypes.length).toBeLessThanOrEqual(
      RATCHET.missingInTypes,
    );
    expect(audit.schemaDrift.missingInMigrations.length).toBeLessThanOrEqual(
      RATCHET.missingInMigrations,
    );
  });
});
