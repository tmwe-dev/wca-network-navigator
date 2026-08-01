/**
 * PageHeader — Intestazione pagina semplice e riutilizzabile.
 * Usata dalle pagine V2 (DealsPage, ecc.). Stile coerente con design system.
 */
import type { ReactNode } from "react";
import {
  GitBranch,
  LayoutDashboard,
  Users,
  Mail,
  Bot,
  Settings,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  pipeline: GitBranch,
  dashboard: LayoutDashboard,
  users: Users,
  mail: Mail,
  bot: Bot,
  settings: Settings,
  analytics: BarChart3,
};

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: keyof typeof ICON_MAP | string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  const Icon = icon ? ICON_MAP[icon] : undefined;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;