/**
 * OnboardingPage — Multi-step onboarding wizard
 */
import * as React from "react";
import { useOnboardingV2 } from "@/v2/hooks/useOnboardingV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Rocket, ArrowRight, ArrowLeft, Check } from "lucide-react";

export function OnboardingPage(): React.ReactElement {
  const { currentStep, stepIndex, totalSteps, nextStep, prevStep, isFirst, isLast } = useOnboardingV2();

  const stepContent: Record<string, { title: string; description: string }> = {
    welcome: { title: "Benvenuto!", description: "WCA Network Navigator ti aiuta a gestire i tuoi partner logistici mondiali." },
    credentials: { title: "Credenziali", description: "Configura le tue credenziali WCA per accedere ai dati dei network." },
    agents: { title: "Agenti AI", description: "Configura i tuoi agenti AI per automatizzare le operazioni quotidiane." },
    preferences: { title: "Preferenze", description: "Imposta le tue preferenze di lingua, timezone e notifiche." },
    complete: { title: "Pronto!", description: "La configurazione è completa. Puoi iniziare a usare la piattaforma." },
  };

  const step = stepContent[currentStep] ?? { title: "", description: "" };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Onboarding</CardTitle>
          </div>
          <Progress value={((stepIndex + 1) / totalSteps) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">Step {stepIndex + 1} di {totalSteps}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-8">
            <h2 className="text-xl font-bold mb-2">{step.title}</h2>
            <p className="text-muted-foreground">{step.description}</p>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={prevStep} disabled={isFirst}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Indietro
            </Button>
            <Button onClick={nextStep}>
              {isLast ? <><Check className="h-4 w-4 mr-2" /> Completa</> : <>Avanti <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
