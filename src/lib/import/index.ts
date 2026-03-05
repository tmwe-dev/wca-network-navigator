/**
 * Import pipeline — unified exports
 */
export { parseFile } from "./fileParser";
export { autoMapColumns, mappingsToDict } from "./heuristicMapper";
export {
  validateAndTransform,
  transformRow,
  applyTransformation,
  normalizePhone,
  extractEmail,
  parseCountry,
} from "./validator";
export {
  TARGET_COLUMNS,
  TARGET_SCHEMA,
  type ParsedFile,
  type ParsingOptions,
  type ColumnMapping,
  type TransformationType,
  type ValidationResult,
  type RejectedRow,
  type ImportStats,
  type TargetColumnKey,
  type TargetColumn,
} from "./types";
