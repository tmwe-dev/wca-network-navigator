/**
 * FormSection organism — STEP 4 Design System v2
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly columns?: 1 | 2 | 3;
  readonly className?: string;
}

const gridCols = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
};

export function FormSection({
  title, description, children, columns = 2, className,
}: FormSectionProps): React.ReactElement {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-4", gridCols[columns])}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
