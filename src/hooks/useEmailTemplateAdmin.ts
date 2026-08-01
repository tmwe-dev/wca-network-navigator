/**
 * useEmailTemplateAdmin — hook di dominio per i template email (admin).
 * Isola i componenti dal DAL e centralizza la query dei template.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findEmailTemplates, createEmailTemplate, deleteEmailTemplate } from "@/data/emailTemplates";
import { queryKeys } from "@/lib/queryKeys";

export function useEmailTemplateAdmin() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.email.templates,
    queryFn: () => findEmailTemplates(),
  });
  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    createTemplate: createEmailTemplate,
    deleteTemplate: deleteEmailTemplate,
    invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.email.templates }),
  };
}