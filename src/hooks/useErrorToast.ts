/**
 * useErrorToast — Standardized error toast pattern.
 * Replaces the repetitive toast({ title, description, variant: "destructive" }) calls.
 */
import { useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { extractErrorMessage } from "@/lib/errors";

export function useErrorToast() {
  const showError = useCallback((title: string, error?: unknown): void => {
    toast({
      title,
      description: error ? extractErrorMessage(error) : undefined,
      variant: "destructive",
    });
  }, []);

  return { showError };
}
