# Sistema de Configuração de Relatórios

## Visão Geral

O sistema agora permite configurar cabeçalhos e rodapés personalizados para os relatórios de laudo pericial. Essas configurações são salvas por processo e aplicadas automaticamente na geração dos relatórios em formato DOCX.

## Como Usar

### 1. Acessando as Configurações

1. Navegue até um processo específico
2. Vá para a aba **"Laudo"**
3. Role até o final da página para encontrar a seção **"22. Configurações do Relatório"**

### 2. Configurando o Cabeçalho

Na seção de **Configurações do Cabeçalho**, você pode personalizar:

- **Nome do Perito**: Nome que aparecerá no cabeçalho do relatório
- **Título Profissional**: Título profissional (ex: "ENGENHEIRO CIVIL")
- **Número de Registro**: Registro profissional (ex: "CREA")
- **Texto Personalizado**: Texto adicional que aparecerá no cabeçalho

### 3. Configurando o Rodapé

Na seção de **Configurações do Rodapé**, você pode personalizar:

- **E-mail de Contato**: E-mail que aparecerá no rodapé
- **Texto Personalizado**: Texto adicional no rodapé
- **Mostrar Números de Página**: Opção para incluir numeração de páginas

### 4. Prévia das Configurações

O sistema exibe uma prévia em tempo real de como o cabeçalho e rodapé aparecerão no relatório final.

### 5. Restaurar Padrões

Use o botão **"Restaurar Padrões"** para voltar às configurações originais do sistema.

## Funcionalidades Técnicas

### Fallback Inteligente

O sistema utiliza um sistema de fallback inteligente:

1. **Primeira prioridade**: Configurações personalizadas do relatório
2. **Segunda prioridade**: Dados da seção "Capa" do laudo
3. **Terceira prioridade**: Valores padrão do sistema

### Persistência de Dados

- As configurações são salvas automaticamente no banco de dados
- Cada processo mantém suas próprias configurações
- As configurações são aplicadas automaticamente na exportação

### Integração com Exportação

As configurações são automaticamente aplicadas quando você:

- Exporta o relatório em formato DOCX
- Gera relatórios através da API
- Utiliza a funcionalidade de relatório automático

## Estrutura de Dados

As configurações são armazenadas no campo `report_config` da tabela `processes` com a seguinte estrutura:

```json
{
  "header": {
    "peritoName": "Nome do Perito",
    "professionalTitle": "Título Profissional",
    "registrationNumber": "Número de Registro",
    "customText": "Texto personalizado"
  },
  "footer": {
    "contactEmail": "email@exemplo.com",
    "customText": "Texto personalizado do rodapé",
    "showPageNumbers": true
  }
}
```

## Benefícios

1. **Personalização**: Cada processo pode ter configurações específicas
2. **Flexibilidade**: Permite textos personalizados além dos campos padrão
3. **Consistência**: Mantém a formatação profissional dos relatórios
4. **Facilidade**: Interface intuitiva com prévia em tempo real
5. **Compatibilidade**: Funciona com o sistema existente sem quebrar funcionalidades

## Suporte

Para dúvidas ou problemas com o sistema de configuração de relatórios, verifique:

1. Se as configurações foram salvas corretamente
2. Se o processo possui as permissões necessárias
3. Se a exportação está funcionando normalmente

O sistema foi projetado para ser robusto e manter compatibilidade com relatórios existentes.