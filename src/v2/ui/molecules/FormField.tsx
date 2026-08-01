/**
 * FormField molecule — STEP 4 Design System v2
 * Label + input + errore inline.
 */

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "../atoms/Input";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function FormField({
  label, name, type = "text", placeholder, value,
  onChange, error, required, disabled, className,
}: FormFieldProps): React.ReactElement {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        hasError={!!error}
        disabled={disabled}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
