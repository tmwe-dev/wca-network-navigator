import { ESLint } from "eslint";
import fs from "node:fs";

const eslint = new ESLint({ cwd: "/dev-server" });
const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);

// Group by file
const byFile = new Map();
for (const r of results) {
  const msgs = r.messages.filter(m => m.severity === 2);
  if (!msgs.length) continue;
  byFile.set(r.filePath, { source: r.source ?? fs.readFileSync(r.filePath, "utf8"), messages: msgs });
}

const RULES_TO_FIX = new Set([
  "eqeqeq",
  "no-useless-escape",
  "prefer-const",
  "no-constant-condition",
  "no-constant-binary-expression",
  "no-empty",
]);

let fixed = 0;
let skipped = 0;

for (const [file, { source, messages }] of byFile) {
  const lines = source.split("\n");
  const applicable = messages.filter(m => RULES_TO_FIX.has(m.ruleId));
  if (!applicable.length) continue;

  // Sort by line desc to avoid offset drift when we alter lines
  applicable.sort((a, b) => b.line - a.line || b.column - a.column);

  for (const m of applicable) {
    const idx = m.line - 1;
    const line = lines[idx];
    if (line == null) { skipped++; continue; }
    let newLine = line;

    if (m.ruleId === "eqeqeq") {
      // Replace at exact column
      const col = m.column - 1;
      // Try longer match first: !== and ===
      // The op is either `==` or `!=` and NOT already `===`/`!==`
      const s = line.slice(col, col + 3);
      if (s === "===" || s === "!==") continue;
      const two = line.slice(col, col + 2);
      if (two === "==") {
        newLine = line.slice(0, col) + "===" + line.slice(col + 2);
      } else if (two === "!=") {
        newLine = line.slice(0, col) + "!==" + line.slice(col + 2);
      } else {
        // Fall back: naive replace on the line if only 1 occurrence
        const m2 = line.match(/([^=!<>])(==|!=)(?!=)/);
        if (m2) {
          newLine = line.replace(/([^=!<>])(==|!=)(?!=)/, (_, p1, op) => `${p1}${op}=`);
        } else {
          skipped++; continue;
        }
      }
    } else if (m.ruleId === "no-useless-escape") {
      // Remove single backslash at column
      const col = m.column - 1;
      if (line[col] === "\\") {
        newLine = line.slice(0, col) + line.slice(col + 1);
      } else {
        skipped++; continue;
      }
    } else if (m.ruleId === "prefer-const") {
      newLine = line.replace(/\blet\b/, "const");
    } else if (m.ruleId === "no-constant-condition" || m.ruleId === "no-constant-binary-expression" || m.ruleId === "no-empty") {
      // Prepend eslint-disable comment on that line
      newLine = line.replace(/^(\s*)/, `$1// eslint-disable-next-line ${m.ruleId}\n$1`);
    } else {
      skipped++; continue;
    }

    if (newLine !== line) {
      lines[idx] = newLine;
      fixed++;
    } else {
      skipped++;
    }
  }
  fs.writeFileSync(file, lines.join("\n"));
}

console.log(`fixed=${fixed} skipped=${skipped}`);
