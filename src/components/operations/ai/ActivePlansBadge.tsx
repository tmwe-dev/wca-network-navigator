import { ListChecks } from "lucide-react";

interface Plan {
  id: string;
  title: string;
  status: string;
  steps: Array<Record<string, unknown>>;
  current_step: number;
  tags: string[];
}

interface Props {
  plans: Plan[];
  isDark: boolean;
}

export function ActivePlansBadge({ plans, isDark }: Props) {
  if (plans.length === 0) return null;

  const totalSteps = plans.reduce((sum, p) => sum + (p.steps as Array<unknown>).length, 0);
  const completedSteps = plans.reduce((sum, p) => sum + p.current_step, 0);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${
        isDark
          ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
      title={plans.map(p => `${p.title} (${p.current_step}/${(p.steps as Array<unknown>).length})`).join("\n")}
    >
      <ListChecks className="w-3 h-3" />
      <span>{plans.length} piano{plans.length > 1 ? "i" : ""}</span>
      <span className="opacity-60">{completedSteps}/{totalSteps}</span>
    </div>
  );
}
