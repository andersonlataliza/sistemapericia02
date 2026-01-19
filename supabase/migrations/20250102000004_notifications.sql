-- =====================================================
-- MIGRATION: Notifications Table
-- Created: 2025-01-02
-- Description: Criação da tabela de notificações com RLS
-- =====================================================

-- 1. Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS e Políticas
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Seleção restrita ao próprio usuário
CREATE POLICY IF NOT EXISTS "allow select own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Inserção restrita ao próprio usuário
CREATE POLICY IF NOT EXISTS "allow insert own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Atualização restrita ao próprio usuário
CREATE POLICY IF NOT EXISTS "allow update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- =====================================================
-- END OF MIGRATION
-- =====================================================