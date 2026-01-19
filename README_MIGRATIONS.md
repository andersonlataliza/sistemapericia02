# Migrations do Supabase - Sistema de Perícia Automata

## Visão Geral

Este documento descreve a estrutura completa do banco de dados Supabase para o Sistema de Perícia Automata, incluindo todas as tabelas, relacionamentos, políticas de segurança e funções auxiliares.

## Arquivos de Migration

### 1. `20250102000000_complete_database_structure.sql`
**Estrutura principal do banco de dados**

Este arquivo contém:
- Criação de todas as tabelas principais
- Configuração de RLS (Row Level Security)
- Triggers para `updated_at`
- Função `handle_new_user`
- Bucket de storage para documentos

### 2. `20250102000001_seed_data.sql`
**Dados iniciais e funções auxiliares**

Este arquivo contém:
- Dados iniciais para desenvolvimento
- Funções de negócio
- Views para relatórios
- Índices para performance
- Sistema de auditoria (opcional)

### 3. `types.ts`
**Definições TypeScript**

Arquivo com todas as definições de tipos TypeScript geradas automaticamente para integração com o frontend.

## Estrutura das Tabelas

### Tabelas Principais

#### `profiles`
- Perfis de usuário vinculados ao auth.users
- Campos: id, full_name, avatar_url, timestamps

#### `processes`
- Tabela central do sistema com todos os dados do processo
- Campos principais:
  - Informações básicas (process_number, claimant_name, defendant_name, court)
  - Agendamento de inspeção (inspection_date, inspection_time, inspection_status)
  - Dados de pagamento (determined_value, payment_status, payment_amount)
  - Dados do relatório (cover_data, identifications, objective, methodology)
  - Análises (insalubrity_analysis, periculosity_analysis, conclusion)

#### `risk_agents`
- Agentes de risco identificados nos processos
- Campos: agent_type, agent_name, exposure_level, measurement_value, risk_level

#### `questionnaires`
- Questionários para as partes (autor/réu)
- Campos: party, question_number, question, answer, attachments

#### `reports`
- Relatórios gerados do sistema
- Campos: report_type, title, content, status, version, file_path

#### `documents`
- Documentos anexados aos processos
- Campos: name, description, file_path, category, is_confidential

#### `audit_log` (opcional)
- Log de auditoria para rastreamento de alterações
- Campos: table_name, record_id, action, old_values, new_values

### Views

#### `process_summary`
- Visão consolidada dos processos com contadores
- Inclui: dados básicos + contagem de agentes de risco, questionários, relatórios e documentos

#### `risk_agents_summary`
- Visão dos agentes de risco com dados do processo
- Inclui: dados do agente + informações básicas do processo

## Funções Auxiliares

### Funções de Negócio

#### `get_process_statistics(user_uuid)`
Retorna estatísticas dos processos do usuário:
- Total de processos
- Processos por status
- Valores totais
- Próximas inspeções

#### `get_upcoming_inspections(user_uuid, days_ahead)`
Lista inspeções próximas do usuário com contagem de dias.

#### `get_overdue_payments(user_uuid)`
Lista pagamentos em atraso com cálculo de dias de atraso.

#### `search_processes(user_uuid, search_term, filters)`
Busca avançada de processos com filtros por status e termo de busca.

### Funções de Segurança

#### `user_owns_process(process_uuid, user_uuid)`
Verifica se o usuário é proprietário do processo.

#### `get_user_process_ids(user_uuid)`
Retorna lista de IDs de processos do usuário.

### Funções de Manutenção

#### `cleanup_audit_logs(days_to_keep)`
Remove logs de auditoria antigos (padrão: 90 dias).

#### `get_database_stats()`
Retorna estatísticas gerais do banco de dados.

## Políticas de Segurança (RLS)

Todas as tabelas possuem RLS habilitado com as seguintes políticas:

### Políticas Padrão
- **SELECT**: Usuários podem ver apenas seus próprios dados
- **INSERT**: Usuários podem inserir dados vinculados ao seu ID
- **UPDATE**: Usuários podem atualizar apenas seus próprios dados
- **DELETE**: Usuários podem deletar apenas seus próprios dados

### Políticas Especiais

#### Storage (process-documents)
- **SELECT**: Acesso a documentos de processos próprios
- **INSERT**: Upload de documentos em processos próprios
- **UPDATE**: Atualização de documentos próprios
- **DELETE**: Remoção de documentos próprios

## Índices para Performance

### Índices Principais
- `idx_processes_user_id`: Busca por usuário
- `idx_processes_status`: Filtro por status
- `idx_processes_payment_status`: Filtro por status de pagamento
- `idx_processes_inspection_date`: Ordenação por data de inspeção

### Índices Compostos
- `idx_processes_user_status`: Busca por usuário + status
- `idx_processes_user_payment`: Busca por usuário + pagamento

### Índice de Busca Textual
- `idx_processes_search`: Busca full-text em campos principais

## Como Aplicar as Migrations

### 1. Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para "SQL Editor"
3. Execute os arquivos na ordem:
   - `20250102000000_complete_database_structure.sql`
   - `20250102000001_seed_data.sql`

### 2. Via Supabase CLI
```bash
# Aplicar migration principal
supabase db push

# Ou aplicar manualmente
supabase db reset
```

### 3. Verificação
Após aplicar as migrations, verifique:
- Todas as tabelas foram criadas
- RLS está habilitado
- Políticas estão ativas
- Funções estão disponíveis
- Índices foram criados

## Integração com o Frontend

### Configuração do Cliente Supabase
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase/types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Exemplo de Uso
```typescript
// Buscar processos do usuário
const { data: processes } = await supabase
  .from('processes')
  .select('*')
  .eq('user_id', user.id)

// Usar função personalizada
const { data: stats } = await supabase
  .rpc('get_process_statistics', { user_uuid: user.id })
```

## Manutenção e Monitoramento

### Limpeza Automática
Configure um cron job para limpeza periódica:
```sql
SELECT cleanup_audit_logs(90); -- Manter 90 dias de logs
```

### Monitoramento
Use a função de estatísticas para monitorar o uso:
```sql
SELECT get_database_stats();
```

## Considerações de Segurança

1. **RLS Habilitado**: Todas as tabelas possuem RLS ativo
2. **Políticas Restritivas**: Usuários acessam apenas seus dados
3. **Auditoria**: Log opcional de todas as alterações
4. **Validação**: Constraints e checks nos campos críticos
5. **Backup**: Configure backups automáticos no Supabase

## Próximos Passos

1. Aplicar as migrations no ambiente de desenvolvimento
2. Testar todas as funcionalidades
3. Validar as políticas de segurança
4. Configurar backups automáticos
5. Implementar monitoramento de performance
6. Aplicar em produção após validação completa