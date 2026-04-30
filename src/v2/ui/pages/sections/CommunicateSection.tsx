import * as React from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { GoldenHeaderBar } from "@/v2/ui/templates/GoldenHeaderBar";
import { cn } from "@/lib/utils";
import { InreachPage } from "@/v2/ui/pages/InreachPage";
import { OutreachPage } from "@/v2/ui/pages/OutreachPage";
import { EmailComposerPage } from "@/v2/ui/pages/EmailComposerPage";
import { Sorting as SortingPage } from "@/v2/ui/pages/SortingPage";

const TABS: readonly SectionTab[] = [
  { key: "inbox",    label: "Inbox",        to: "/v2/communicate/inbox" },
  { key: "outreach", label: "Outreach",     to: "/v2/communicate/outreach" },
  { key: "compose",  label: "Componi",      to: "/v2/communicate/compose" },
  { key: "approve",  label: "Approvazioni", to: "/v2/communicate/approve" },
];

function InlineTabs({ tabs }: { tabs: readonly SectionTab[] }): React.ReactElement {
  const { pathname } = useLocation();
  return (
    <div className="flex items-center gap-0.5">
      {tabs.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        return (
          <NavLink
            key={tab.key}
            to={tab.to}
            className={cn(
              "relative px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap rounded-md",
              active
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </div>
  );
}

export function CommunicateSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GoldenHeaderBar actions={<InlineTabs tabs={TABS} />} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route index element={<Navigate to="/v2/communicate/inbox" replace />} />
          <Route path="inbox"    element={<InreachPage />} />
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="compose"  element={<EmailComposerPage />} />
          <Route path="approve"  element={<SortingPage />} />
          <Route path="*"        element={<Navigate to="/v2/communicate/inbox" replace />} />
        </Routes>
      </div>
    </div>
  );
}
export default CommunicateSection;
