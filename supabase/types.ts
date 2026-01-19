// Re-exporta os tipos compartilhados do frontend para evitar duplicação
// e garantir que o arquivo seja tratado como texto (não binário) pelo TypeScript.
export type { Database, Json } from "../src/integrations/supabase/types";