-- Adicionar campos de acompanhamento de pagamento e valor determinado
ALTER TABLE processes
ADD COLUMN IF NOT EXISTS determined_value NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_notes TEXT,
ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Comentários para documentar os campos
COMMENT ON COLUMN processes.determined_value IS 'Valor determinado/acordado para o processo';
COMMENT ON COLUMN processes.payment_status IS 'Status do pagamento: pending, partial, paid, overdue';
COMMENT ON COLUMN processes.payment_amount IS 'Valor já pago';
COMMENT ON COLUMN processes.payment_date IS 'Data do último pagamento';
COMMENT ON COLUMN processes.payment_notes IS 'Observações sobre o pagamento';
COMMENT ON COLUMN processes.payment_due_date IS 'Data de vencimento do pagamento';