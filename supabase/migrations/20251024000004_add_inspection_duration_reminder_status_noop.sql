ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS inspection_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS inspection_reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS inspection_status text;
