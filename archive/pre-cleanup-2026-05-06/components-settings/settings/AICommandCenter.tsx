import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquareText, BookOpen, FileText, Search } from "lucide-react";
import { PromptManager } from "./PromptManager";
import { KnowledgeBaseManager } from "./KnowledgeBaseManager";
import { DeepSearchConfig } from "./DeepSearchConfig";
import TemplateManager from "./TemplateManager";

export default function AICommandCenter() {
  const [tab, setTab] = useState("prompt");

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-9">
          <TabsTrigger value="prompt" className="text-xs gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" />
            Prompt
          </TabsTrigger>
          <TabsTrigger value="kb" className="text-xs gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="template" className="text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Template
          </TabsTrigger>
          <TabsTrigger value="deepsearch" className="text-xs gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Deep Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="mt-4">
          <PromptManager />
        </TabsContent>
        <TabsContent value="kb" className="mt-4">
          <KnowledgeBaseManager />
        </TabsContent>
        <TabsContent value="template" className="mt-4">
          <TemplateManager />
        </TabsContent>
        <TabsContent value="deepsearch" className="mt-4">
          <DeepSearchConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
