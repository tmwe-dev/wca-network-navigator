export type { ProcedureCategory, Channel, PrerequisiteCheck, ProcedureStep, OperationProcedure } from "./types";
import type { OperationProcedure } from "./types";
import { PROCEDURES_PART1 } from "./procedures1";
import { PROCEDURES_PART2 } from "./procedures2";

export const OPERATIONS_PROCEDURES: OperationProcedure[] = [
  ...PROCEDURES_PART1,
  ...PROCEDURES_PART2,
];

export { findProcedures, getProceduresByCategory, getProcedureById, serializeProceduresForPrompt } from "./helpers";
