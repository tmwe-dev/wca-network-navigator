ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS department text
  CHECK (department IS NULL OR department IN ('commercial','operations','admin','general'));
CREATE INDEX IF NOT EXISTS idx_activities_department ON public.activities(department) WHERE deleted_at IS NULL;