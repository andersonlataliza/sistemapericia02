-- =====================================================
-- MIGRATION: Seed Data and Additional Configurations
-- Created: 2025-01-02
-- Description: Dados iniciais e configurações adicionais
-- =====================================================

-- =====================================================
-- SEED DATA FOR SYSTEM CONFIGURATION
-- =====================================================

-- Insert default risk agent types and configurations
-- This can be used for dropdowns and validation

-- Example seed data for common risk agents (can be customized)
-- Note: This is optional and can be removed if not needed

-- =====================================================
-- ADDITIONAL FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Function to calculate process statistics
CREATE OR REPLACE FUNCTION public.get_process_statistics(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_processes', COUNT(*),
    'active_processes', COUNT(*) FILTER (WHERE status = 'active'),
    'completed_processes', COUNT(*) FILTER (WHERE status = 'completed'),
    'pending_payments', COUNT(*) FILTER (WHERE payment_status = 'pending'),
    'overdue_payments', COUNT(*) FILTER (WHERE payment_status = 'overdue'),
    'total_payment_amount', COALESCE(SUM(payment_amount), 0),
    'total_determined_value', COALESCE(SUM(determined_value), 0)
  ) INTO result
  FROM public.processes
  WHERE user_id = user_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get upcoming inspections
CREATE OR REPLACE FUNCTION public.get_upcoming_inspections(user_uuid UUID, days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
  process_id UUID,
  process_number TEXT,
  claimant_name TEXT,
  inspection_date TIMESTAMPTZ,
  inspection_address TEXT,
  inspection_status TEXT,
  days_until_inspection INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.process_number,
    p.claimant_name,
    p.inspection_date,
    p.inspection_address,
    p.inspection_status,
    EXTRACT(DAY FROM (p.inspection_date - NOW()))::INTEGER as days_until_inspection
  FROM public.processes p
  WHERE p.user_id = user_uuid
    AND p.inspection_date IS NOT NULL
    AND p.inspection_date >= NOW()
    AND p.inspection_date <= NOW() + INTERVAL '1 day' * days_ahead
    AND p.inspection_status IN ('scheduled_pending', 'scheduled_confirmed', 'rescheduled')
  ORDER BY p.inspection_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get overdue payments
CREATE OR REPLACE FUNCTION public.get_overdue_payments(user_uuid UUID)
RETURNS TABLE (
  process_id UUID,
  process_number TEXT,
  claimant_name TEXT,
  determined_value NUMERIC,
  payment_amount NUMERIC,
  payment_due_date DATE,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.process_number,
    p.claimant_name,
    p.determined_value,
    p.payment_amount,
    p.payment_due_date,
    (CURRENT_DATE - p.payment_due_date)::INTEGER as days_overdue
  FROM public.processes p
  WHERE p.user_id = user_uuid
    AND p.payment_due_date IS NOT NULL
    AND p.payment_due_date < CURRENT_DATE
    AND p.payment_status IN ('pending', 'partial')
  ORDER BY p.payment_due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search processes
CREATE OR REPLACE FUNCTION public.search_processes(
  user_uuid UUID,
  search_term TEXT DEFAULT '',
  status_filter TEXT DEFAULT 'all',
  payment_status_filter TEXT DEFAULT 'all',
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  process_number TEXT,
  claimant_name TEXT,
  defendant_name TEXT,
  court TEXT,
  status TEXT,
  payment_status TEXT,
  determined_value NUMERIC,
  payment_amount NUMERIC,
  inspection_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.process_number,
    p.claimant_name,
    p.defendant_name,
    p.court,
    p.status,
    p.payment_status,
    p.determined_value,
    p.payment_amount,
    p.inspection_date,
    p.created_at,
    p.updated_at
  FROM public.processes p
  WHERE p.user_id = user_uuid
    AND (
      search_term = '' OR
      p.process_number ILIKE '%' || search_term || '%' OR
      p.claimant_name ILIKE '%' || search_term || '%' OR
      p.defendant_name ILIKE '%' || search_term || '%' OR
      p.court ILIKE '%' || search_term || '%'
    )
    AND (status_filter = 'all' OR p.status = status_filter)
    AND (payment_status_filter = 'all' OR p.payment_status = payment_status_filter)
  ORDER BY p.updated_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for process summary with payment information
CREATE OR REPLACE VIEW public.process_summary AS
SELECT 
  p.id,
  p.user_id,
  p.process_number,
  p.claimant_name,
  p.defendant_name,
  p.court,
  p.status,
  p.inspection_date,
  p.inspection_status,
  p.payment_status,
  p.determined_value,
  p.payment_amount,
  p.payment_due_date,
  (p.determined_value - COALESCE(p.payment_amount, 0)) as remaining_amount,
  CASE 
    WHEN p.payment_due_date IS NOT NULL AND p.payment_due_date < CURRENT_DATE 
    THEN (CURRENT_DATE - p.payment_due_date)
    ELSE 0
  END as days_overdue,
  p.created_at,
  p.updated_at,
  -- Count related records
  (SELECT COUNT(*) FROM public.risk_agents ra WHERE ra.process_id = p.id) as risk_agents_count,
  (SELECT COUNT(*) FROM public.questionnaires q WHERE q.process_id = p.id) as questionnaires_count,
  (SELECT COUNT(*) FROM public.reports r WHERE r.process_id = p.id) as reports_count,
  (SELECT COUNT(*) FROM public.documents d WHERE d.process_id = p.id) as documents_count
FROM public.processes p;

-- View for risk agents summary
CREATE OR REPLACE VIEW public.risk_agents_summary AS
SELECT 
  ra.id,
  ra.process_id,
  ra.agent_type,
  ra.agent_name,
  ra.risk_level,
  ra.insalubrity_degree,
  ra.periculosity_applicable,
  ra.exposure_level,
  ra.measurement_value,
  ra.measurement_unit,
  ra.tolerance_limit,
  ra.tolerance_unit,
  CASE 
    WHEN ra.measurement_value IS NOT NULL AND ra.tolerance_limit IS NOT NULL
    THEN (ra.measurement_value > ra.tolerance_limit)
    ELSE NULL
  END as exceeds_tolerance,
  ra.created_at,
  ra.updated_at,
  -- Process information
  p.process_number,
  p.claimant_name
FROM public.risk_agents ra
JOIN public.processes p ON ra.process_id = p.id;

-- =====================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_processes_user_status_payment ON public.processes(user_id, status, payment_status);
CREATE INDEX IF NOT EXISTS idx_processes_user_inspection_date ON public.processes(user_id, inspection_date) WHERE inspection_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processes_user_payment_due ON public.processes(user_id, payment_due_date) WHERE payment_due_date IS NOT NULL;

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_processes_search_text ON public.processes USING gin(
  to_tsvector('portuguese', 
    COALESCE(process_number, '') || ' ' ||
    COALESCE(claimant_name, '') || ' ' ||
    COALESCE(defendant_name, '') || ' ' ||
    COALESCE(court, '')
  )
);

-- JSONB indexes for structured data
CREATE INDEX IF NOT EXISTS idx_processes_cover_data ON public.processes USING gin(cover_data);
CREATE INDEX IF NOT EXISTS idx_processes_identifications ON public.processes USING gin(identifications);
CREATE INDEX IF NOT EXISTS idx_processes_claimant_data ON public.processes USING gin(claimant_data);
CREATE INDEX IF NOT EXISTS idx_processes_defendant_data ON public.processes USING gin(defendant_data);
CREATE INDEX IF NOT EXISTS idx_processes_workplace_characteristics ON public.processes USING gin(workplace_characteristics);
CREATE INDEX IF NOT EXISTS idx_processes_epis ON public.processes USING gin(epis);

-- =====================================================
-- SECURITY ENHANCEMENTS
-- =====================================================

-- Function to validate user ownership of process
CREATE OR REPLACE FUNCTION public.user_owns_process(process_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.processes 
    WHERE id = process_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's process IDs (for validation)
CREATE OR REPLACE FUNCTION public.get_user_process_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT id FROM public.processes WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUDIT TRAIL (Optional - for tracking changes)
-- =====================================================

-- Create audit table for important changes
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

-- Audit function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_values JSONB := NULL;
  new_values JSONB := NULL;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Only audit specific tables
  IF TG_TABLE_NAME NOT IN ('processes', 'risk_agents', 'reports') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Prepare values based on operation
  IF TG_OP = 'DELETE' THEN
    old_values := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    old_values := to_jsonb(OLD);
    new_values := to_jsonb(NEW);
    
    -- Identify changed fields
    SELECT array_agg(key) INTO changed_fields
    FROM jsonb_each(new_values)
    WHERE new_values->key IS DISTINCT FROM old_values->key;
  END IF;

  -- Insert audit record
  INSERT INTO public.audit_log (
    table_name,
    record_id,
    user_id,
    action,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    old_values,
    new_values,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers (optional - comment out if not needed)
-- CREATE TRIGGER audit_processes_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON public.processes
--   FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- CREATE TRIGGER audit_risk_agents_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON public.risk_agents
--   FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- CREATE TRIGGER audit_reports_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON public.reports
--   FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- =====================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to clean up old audit logs (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_log 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get database statistics
CREATE OR REPLACE FUNCTION public.get_database_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_profiles', (SELECT COUNT(*) FROM public.profiles),
    'total_processes', (SELECT COUNT(*) FROM public.processes),
    'total_risk_agents', (SELECT COUNT(*) FROM public.risk_agents),
    'total_questionnaires', (SELECT COUNT(*) FROM public.questionnaires),
    'total_reports', (SELECT COUNT(*) FROM public.reports),
    'total_documents', (SELECT COUNT(*) FROM public.documents),
    'processes_by_status', (
      SELECT json_object_agg(status, count)
      FROM (
        SELECT status, COUNT(*) as count
        FROM public.processes
        GROUP BY status
      ) t
    ),
    'payment_status_summary', (
      SELECT json_object_agg(payment_status, count)
      FROM (
        SELECT payment_status, COUNT(*) as count
        FROM public.processes
        GROUP BY payment_status
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR ADDITIONAL OBJECTS
-- =====================================================

COMMENT ON FUNCTION public.get_process_statistics IS 'Retorna estatísticas dos processos de um usuário';
COMMENT ON FUNCTION public.get_upcoming_inspections IS 'Retorna inspeções próximas de um usuário';
COMMENT ON FUNCTION public.get_overdue_payments IS 'Retorna pagamentos em atraso de um usuário';
COMMENT ON FUNCTION public.search_processes IS 'Busca processos com filtros e paginação';
COMMENT ON VIEW public.process_summary IS 'Visão resumida dos processos com informações de pagamento';
COMMENT ON VIEW public.risk_agents_summary IS 'Visão resumida dos agentes de risco';
COMMENT ON TABLE public.audit_log IS 'Log de auditoria para rastreamento de alterações';

-- =====================================================
-- END OF SEED DATA MIGRATION
-- =====================================================