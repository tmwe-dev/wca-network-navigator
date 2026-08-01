import { ArrowUpDown, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01 } from "lucide-react";

export type LetterRange =
  | "all"
  | "A-B" | "C-D" | "E-F" | "G-H" | "I-J" | "K-L"
  | "M-N" | "O-P" | "Q-R" | "S-T" | "U-V" | "W-X" | "Y-Z";

export const LETTER_RANGES: { value: LetterRange; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "A-B", label: "A-B" },
  { value: "C-D", label: "C-D" },
  { value: "E-F", label: "E-F" },
  { value: "G-H", label: "G-H" },
  { value: "I-J", label: "I-J" },
  { value: "K-L", label: "K-L" },
  { value: "M-N", label: "M-N" },
  { value: "O-P", label: "O-P" },
  { value: "Q-R", label: "Q-R" },
  { value: "S-T", label: "S-T" },
  { value: "U-V", label: "U-V" },
  { value: "W-X", label: "W-X" },
  { value: "Y-Z", label: "Y-Z" },
];

export function inLetterRange(name: string, range: LetterRange): boolean {
  if (range === "all") return true;
  const first = name.charAt(0).toUpperCase();
  if (!/[A-Z]/.test(first)) return false;
  const [a, b] = range.split("-");
  return first >= a && first <= b;
}

export type GroupSort = "alpha-asc" | "alpha-desc" | "count-desc" | "count-asc";

export const GROUP_SORT_CYCLE: Record<GroupSort, GroupSort> = {
  "alpha-asc": "alpha-desc",
  "alpha-desc": "count-desc",
  "count-desc": "count-asc",
  "count-asc": "alpha-asc",
};

export const GROUP_SORT_META: Record<GroupSort, { label: string; Icon: typeof ArrowUpDown }> = {
  "alpha-asc":  { label: "A → Z",        Icon: ArrowDownAZ },
  "alpha-desc": { label: "Z → A",        Icon: ArrowUpAZ },
  "count-desc": { label: "Più contatti", Icon: ArrowDown01 },
  "count-asc":  { label: "Meno contatti", Icon: ArrowUp01 },
};