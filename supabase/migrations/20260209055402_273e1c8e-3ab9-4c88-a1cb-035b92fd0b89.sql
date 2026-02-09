ALTER TABLE directory_cache
  ADD COLUMN download_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at timestamptz;