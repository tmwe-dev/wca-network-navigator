import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { InreachPage } from "@/v2/ui/pages/InreachPage";
import { OutreachPage } from "@/v2/ui/pages/OutreachPage";
import { EmailComposerPage } from "@/v2/ui/pages/EmailComposerPage";

const TABS: readonly SectionTab[] = [
  { key: "compose",  label: "Componi",      to: "/v2/communicate/compose" },
  { key: "inbox",    label: "Inreach",      to: "/v2/communicate/inbox" },
  { key: "outreach", label: "Outreach",     to: "/v2/communicate/outreach" },
];

export function CommunicateSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionTabs tabs={TABS} rootPath="/v2/communicate" contentOverflow="contain">
        <Routes>
          <Route index element={<Navigate to="/v2/communicate/compose" replace />} />
          <Route path="inbox"    element={<InreachPage />} />
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="compose"  element={<EmailComposerPage />} />
          <Route path="campaigns" element={<Navigate to="/v2/explore/campaigns" replace />} />
          <Route path="approve"  element={<Navigate to="/v2/cestinone" replace />} />
          {/* Tab Outreach legacy → spostate altrove */}
          <Route path="outreach/inuscita" element={<Navigate to="/v2/cestinone" replace />} />
          <Route path="outreach/circuito" element={<Navigate to="/v2/communicate/inbox" replace />} />
          <Route path="outreach/attivita" element={<Navigate to="/v2/agenda" replace />} />
          <Route path="outreach/strumenti" element={<Navigate to="/v2/settings/outreach-tools" replace />} />
          <Route path="*"        element={<Navigate to="/v2/communicate/compose" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default CommunicateSection;
