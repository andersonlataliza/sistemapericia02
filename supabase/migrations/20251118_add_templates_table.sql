-- Global Templates table for reusable models
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT,
  nr15_annexes JSONB DEFAULT '[]'::jsonb,
  nr16_annexes JSONB DEFAULT '[]'::jsonb,
  nr15_enquadramento BOOLEAN DEFAULT FALSE,
  nr16_enquadramento BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure external_id uniqueness per user
CREATE UNIQUE INDEX IF NOT EXISTS templates_user_external_idx
  ON public.templates (user_id, external_id);

-- Row Level Security
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Policies: Only owner can manage their templates
CREATE POLICY templates_select_own
  ON public.templates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY templates_insert_own
  ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY templates_update_own
  ON public.templates FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY templates_delete_own
  ON public.templates FOR DELETE USING (auth.uid() = user_id);
