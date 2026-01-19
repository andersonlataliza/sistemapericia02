-- Adicionar campo de configuração do relatório na tabela processes
ALTER TABLE processes
ADD COLUMN IF NOT EXISTS report_config JSONB DEFAULT '{
  "header": {
    "peritoName": "PERITO JUDICIAL",
    "professionalTitle": "ENGENHEIRO CIVIL", 
    "registrationNumber": "CREA",
    "customText": ""
  },
  "footer": {
    "contactEmail": "contato@perito.com.br",
    "customText": "",
    "showPageNumbers": true
  }
}'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN processes.report_config IS 'Configurações personalizadas de cabeçalho e rodapé para geração de relatórios';