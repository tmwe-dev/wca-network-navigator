/**
 * promptAnalysis.ts - Functions for analyzing and evaluating prompts
 * Pure functions that analyze prompt content, structure, and quality metrics
 */

import type { Block } from "../types";

/** Analyzes prompt structure and completeness. */
export function analyzePromptStructure(content: string): {
  hasHeadings: boolean;
  hasExamples: boolean;
  hasCriteria: boolean;
  wordCount: number;
  sectionCount: number;
} {
  const lines = content.split("\n");
  const hasHeadings = /^#+\s/m.test(content);
  const hasExamples = /example|sample|e\.g\.|e\.g|instance/i.test(content);
  const hasCriteria = /criteria|condition|requirement|must|should/i.test(
    content
  );
  const wordCount = content.split(/\s+/).length;
  const sectionCount = (content.match(/\n\n/g) || []).length;

  return {
    hasHeadings,
    hasExamples,
    hasCriteria,
    wordCount,
    sectionCount,
  };
}

/** Evaluates prompt completeness based on content analysis. */
export function evaluatePromptCompleteness(content: string): number {
  const analysis = analyzePromptStructure(content);
  let score = 0;

  if (analysis.wordCount >= 100) score += 20;
  else if (analysis.wordCount >= 50) score += 10;

  if (analysis.hasHeadings) score += 20;
  if (analysis.hasExamples) score += 20;
  if (analysis.hasCriteria) score += 20;
  if (analysis.sectionCount >= 3) score += 20;

  return Math.min(100, score);
}

/** Detects potential issues in prompt content. */
export function detectPromptIssues(content: string): string[] {
  const issues: string[] = [];

  if (content.length < 20) {
    issues.push("Prompt molto breve - aggiungere dettagli");
  }
  if (!content.includes("?") && !content.includes(":")) {
    issues.push("Nessuna domanda o istruzione chiara");
  }
  if (/undefined|null|TODO|FIXME/i.test(content)) {
    issues.push("Contiene placeholder o valori indefiniti");
  }
  if (content.includes("vago") || content.includes("incerto")) {
    issues.push("Linguaggio incerto o vago rilevato");
  }

  return issues;
}

/** Calculates a quality score for a prompt. */
export function calculatePromptQualityScore(content: string): number {
  let score = 50;

  const completeness = evaluatePromptCompleteness(content);
  score += completeness * 0.5;

  const issues = detectPromptIssues(content);
  score -= issues.length * 10;

  return Math.max(0, Math.min(100, score));
}
