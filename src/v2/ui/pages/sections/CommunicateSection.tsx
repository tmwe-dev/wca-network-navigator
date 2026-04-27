import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
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

export function CommunicateSection(): React.ReactElement {
  return (
    <SectionTabs tabs={TABS} rootPath="/v2/communicate">
      <Routes>
        <Route index element={<Navigate to="/v2/communicate/inbox" replace />} />
        <Route path="inbox"    element={<InreachPage />} />
        <Route path="outreach" element={<OutreachPage />} />
        <Route path="compose"  element={<EmailComposerPage />} />
        <Route path="approve"  element={<SortingPage />} />
        <Route path="*"        element={<Navigate to="/v2/communicate/inbox" replace />} />
      </Routes>
    </SectionTabs>
  );
}
export default CommunicateSection;
