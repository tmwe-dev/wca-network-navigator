import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { AiTestHubPage } from "./AiTestHubPage";
import { ArrowLeft, FlaskConical, Library } from "lucide-react";

export function PromptTestsPage() {
  return (
    <div className="text-foreground space-y-4">
      <PageTitleHeader
        title="Test Prompt"
        subtitle="Pagina dedicata per eseguire i test"
        icon={FlaskConical}
      />

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold tracking-normal">Test Prompt</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Sei nel posto giusto: da qui si selezionano gli scenari e si lanciano i test.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/v2/prompt-lab/catalog">
                <ArrowLeft className="h-4 w-4" />
                Catalogo prompt
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="gap-2">
              <Link to="/v2/ai-staff/prompt-lab">
                <Library className="h-4 w-4" />
                Prompt Lab
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="grid gap-2 p-4 text-sm md:grid-cols-3">
          <div><strong>1.</strong> Seleziona uno o più scenari con la checkbox.</div>
          <div><strong>2.</strong> Premi <strong>Esegui selezionati</strong> o <strong>Esegui tutti</strong>.</div>
          <div><strong>3.</strong> Leggi pass/fail sotto ogni scenario.</div>
        </CardContent>
      </Card>

      <AiTestHubPage />
    </div>
  );
}

export default PromptTestsPage;
