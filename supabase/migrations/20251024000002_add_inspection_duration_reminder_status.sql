-- Add scheduling enhancements: duration, reminder, status
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS inspection_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS inspection_reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS inspection_status text;

-- Optional: constrain status to known values (commented to avoid breaking existing data)
-- COMMENT ON COLUMN public.processes.inspection_status IS 'scheduled_pending | scheduled_confirmed | rescheduled | cancelled';