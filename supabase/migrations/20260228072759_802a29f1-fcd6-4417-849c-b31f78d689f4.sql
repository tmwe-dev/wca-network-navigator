
UPDATE storage.buckets SET public = false WHERE id IN ('templates', 'workspace-docs', 'import-files');
