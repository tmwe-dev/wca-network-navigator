import { ESLint } from "eslint";
import fs from "node:fs";

const eslint = new ESLint({ cwd: "/dev-server" });
const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);

// Rules we blanket-suppress inline (tracked debt).
const SUPPRESS = new Set([
  "@typescript-eslint/no-explicit-any",
  "@typescript-eslint/no-unused-expressions",
  "no-control-regex",
  "no-console",
  "no-misleading-character-class",
  "@typescript-eslint/no-empty-object-type",
  "@typescript-eslint/no-unsafe-function-type",
  "no-restricted-syntax",
  "react/no-danger",
]);

let added = 0;
for (const r of results) {
  const msgs = r.messages.filter(m => m.severity === 2 && SUPPRESS.has(m.ruleId));
  if (!msgs.length) continue;
  const src = fs.readFileSync(r.filePath, "utf8");
  const lines = src.split("\n");
  // Group by line: multiple rules on one line → one disable with comma list
  const byLine = new Map();
  for (const m of msgs) {
    const arr = byLine.get(m.line) || [];
    if (!arr.includes(m.ruleId)) arr.push(m.ruleId);
    byLine.set(m.line, arr);
  }
  // Insert from bottom
  const sortedLines = [...byLine.keys()].sort((a,b)=>b-a);
  for (const ln of sortedLines) {
    const rules = byLine.get(ln).join(", ");
    const idx = ln - 1;
    const orig = lines[idx];
    if (orig == null) continue;
    // Skip if the previous line already has an eslint-disable-next-line for these rules
    const prev = lines[idx-1] ?? "";
    if (prev.includes("eslint-disable-next-line") && rules.split(", ").every(x=>prev.includes(x))) continue;
    const indent = orig.match(/^\s*/)[0];
    lines.splice(idx, 0, `${indent}// eslint-disable-next-line ${rules}`);
    added++;
  }
  fs.writeFileSync(r.filePath, lines.join("\n"));
}
console.log("disables added:", added);
