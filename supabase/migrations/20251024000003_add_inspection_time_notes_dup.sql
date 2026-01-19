-- Add scheduling fields to processes
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS inspection_time text;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS inspection_notes text;