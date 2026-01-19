ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS claimant_email text,
  ADD COLUMN IF NOT EXISTS defendant_email text;

CREATE TABLE IF NOT EXISTS public.schedule_email_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  provider text NULL,
  provider_message_id text NULL,
  status text NOT NULL DEFAULT 'created',
  error text NULL,
  sent_at timestamptz NULL,
  opened_at timestamptz NULL,
  confirmed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_email_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_email_receipts_select_own ON public.schedule_email_receipts;
CREATE POLICY schedule_email_receipts_select_own
  ON public.schedule_email_receipts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS schedule_email_receipts_insert_own ON public.schedule_email_receipts;
CREATE POLICY schedule_email_receipts_insert_own
  ON public.schedule_email_receipts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS schedule_email_receipts_update_own ON public.schedule_email_receipts;
CREATE POLICY schedule_email_receipts_update_own
  ON public.schedule_email_receipts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS schedule_email_receipts_delete_own ON public.schedule_email_receipts;
CREATE POLICY schedule_email_receipts_delete_own
  ON public.schedule_email_receipts
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS handle_schedule_email_receipts_updated_at ON public.schedule_email_receipts;
CREATE TRIGGER handle_schedule_email_receipts_updated_at
  BEFORE UPDATE ON public.schedule_email_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_schedule_email_receipts_process_id
  ON public.schedule_email_receipts(process_id);

CREATE INDEX IF NOT EXISTS idx_schedule_email_receipts_process_role
  ON public.schedule_email_receipts(process_id, recipient_role);
