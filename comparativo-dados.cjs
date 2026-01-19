// Script de Comparativo - Dados Cadastrados vs Relatório
const fs = require('fs');
const path = require('path');

console.log('📊 COMPARATIVO: DADOS CADASTRADOS vs RELATÓRIO');
console.log('=' .repeat(60));

// 1. Verificar onde os dados são cadastrados
console.log('\n🔍 1. VERIFICANDO ONDE OS DADOS SÃO CADASTRADOS...');

const processDetailPath = path.join(process.cwd(), 'src/pages/ProcessDetail.tsx');
if (fs.existsSync(processDetailPath)) {
  const content = fs.readFileSync(processDetailPath, 'utf8');
  
  console.log('\n📝 Campos que são salvos no banco:');
  
  // Procurar pela função handleSave para ver quais campos são salvos
  const handleSaveMatch = content.match(/const handleSave = async \(\) => \{([\s\S]*?)^\s*\}/m);
  if (handleSaveMatch) {
    const handleSaveContent = handleSaveMatch[1];
    
    // Extrair os campos que são salvos
    const updateMatch = handleSaveContent.match(/\.update\(\{([\s\S]*?)\}\)/);
    if (updateMatch) {
      const updateFields = updateMatch[1];
      console.log('   Campos salvos no banco:');
      
      // Procurar por campos específicos
      const fields = [
        'process_number',
        'claimant_name', 
        'defendant_name',
        'initial_data',
        'claimant_data',
        'defendant_data',
        'insalubrity_results',
        'tribunal',
        'status'
      ];
      
      fields.forEach(field => {
        if (updateFields.includes(field)) {
          console.log(`   ✅ ${field}: SALVO`);
        } else {
          console.log(`   ❌ ${field}: NÃO SALVO`);
        }
      });
    }
  }
}

// 2. Verificar onde os dados são usados no relatório
console.log('\n📄 2. VERIFICANDO ONDE OS DADOS SÃO USADOS NO RELATÓRIO...');

// Procurar por arquivos de relatório
const reportFiles = [
  'src/components/laudo/InitialDataSection.tsx',
  'src/components/laudo/ClaimantSection.tsx', 
  'src/components/laudo/DefendantSection.tsx'
];

reportFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  console.log(`\n📋 Analisando: ${file}`);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar quais dados são exibidos
    const propsMatch = content.match(/interface.*Props.*\{([\s\S]*?)\}/);
    if (propsMatch) {
      console.log('   Props recebidas:');
      const props = propsMatch[1];
      
      if (props.includes('value')) console.log('   ✅ value (dados do processo)');
      if (props.includes('onChange')) console.log('   ✅ onChange (atualização)');
      if (props.includes('process')) console.log('   ✅ process (objeto completo)');
    }
    
    // Verificar se usa dados específicos
    if (content.includes('initial_data')) console.log('   ✅ Usa initial_data');
    if (content.includes('claimant_data')) console.log('   ✅ Usa claimant_data');
    if (content.includes('defendant_data')) console.log('   ✅ Usa defendant_data');
    
  } else {
    console.log('   ❌ Arquivo não encontrado');
  }
});

// 3. Verificar o fluxo de dados completo
console.log('\n🔄 3. VERIFICANDO FLUXO COMPLETO DE DADOS...');

if (fs.existsSync(processDetailPath)) {
  const content = fs.readFileSync(processDetailPath, 'utf8');
  
  console.log('\n📊 Fluxo de dados identificado:');
  
  // 1. Carregamento inicial
  if (content.includes('fetchProcess')) {
    console.log('   1️⃣ CARREGAMENTO: fetchProcess() carrega dados do banco');
  }
  
  // 2. Atualização de estado
  if (content.includes('updateProcess')) {
    console.log('   2️⃣ ATUALIZAÇÃO: updateProcess() atualiza estado local');
  }
  
  // 3. Salvamento
  if (content.includes('handleSave')) {
    console.log('   3️⃣ SALVAMENTO: handleSave() salva no banco');
  }
  
  // 4. Verificar se há problemas no fluxo
  console.log('\n🔍 Verificando possíveis problemas:');
  
  // Verificar se updateProcess atualiza o campo correto
  const updateProcessMatch = content.match(/const updateProcess = \(([^)]+)\) => \{([^}]+)\}/s);
  if (updateProcessMatch) {
    const updateProcessBody = updateProcessMatch[2];
    
    if (updateProcessBody.includes('setProcess')) {
      console.log('   ✅ updateProcess atualiza o estado');
    } else {
      console.log('   ❌ updateProcess NÃO atualiza o estado');
    }
    
    if (updateProcessBody.includes('[field]')) {
      console.log('   ✅ updateProcess usa campo dinâmico');
    } else {
      console.log('   ❌ updateProcess NÃO usa campo dinâmico');
    }
  }
  
  // Verificar se handleSave pega os dados do estado atual
  const handleSaveMatch = content.match(/const handleSave = async \(\) => \{([\s\S]*?)^\s*\}/m);
  if (handleSaveMatch) {
    const handleSaveBody = handleSaveMatch[1];
    
    if (handleSaveBody.includes('process.initial_data')) {
      console.log('   ✅ handleSave usa process.initial_data');
    } else {
      console.log('   ❌ handleSave NÃO usa process.initial_data');
    }
    
    if (handleSaveBody.includes('process.claimant_data')) {
      console.log('   ✅ handleSave usa process.claimant_data');
    } else {
      console.log('   ❌ handleSave NÃO usa process.claimant_data');
    }
  }
}

// 4. Comparativo direto
console.log('\n📋 4. COMPARATIVO DIRETO - PROBLEMA IDENTIFICADO');
console.log('-' .repeat(50));

const comparison = {
  cenarios: [
    {
      nome: 'CENÁRIO 1: Dados não são salvos',
      problema: 'Campo não está sendo incluído no handleSave',
      solucao: 'Adicionar campo no objeto de update do Supabase'
    },
    {
      nome: 'CENÁRIO 2: Dados são salvos mas não carregados',
      problema: 'Campo não está sendo buscado no fetchProcess',
      solucao: 'Adicionar campo no select do Supabase'
    },
    {
      nome: 'CENÁRIO 3: Dados são salvos e carregados mas não exibidos',
      problema: 'Componente não está recebendo ou usando os dados',
      solucao: 'Verificar props e binding do componente'
    },
    {
      nome: 'CENÁRIO 4: Estado local não é atualizado',
      problema: 'updateProcess não está funcionando corretamente',
      solucao: 'Corrigir função updateProcess'
    }
  ]
};

comparison.cenarios.forEach((cenario, index) => {
  console.log(`\n${index + 1}. ${cenario.nome}`);
  console.log(`   Problema: ${cenario.problema}`);
  console.log(`   Solução: ${cenario.solucao}`);
});

// 5. Teste específico para identificar o problema
console.log('\n🧪 5. TESTE ESPECÍFICO PARA IDENTIFICAR O PROBLEMA');
console.log('-' .repeat(50));

console.log('\nPara identificar exatamente onde está o problema:');
console.log('');
console.log('1. 🔍 Abra o Console do navegador (F12)');
console.log('2. 📋 Vá para um processo na aba Laudo');
console.log('3. ✏️  Digite algo no campo "Alegações extraídas"');
console.log('4. 👀 Observe os logs no console:');
console.log('');
console.log('   Se aparecer "updateProcess chamado":');
console.log('   ✅ Estado local está sendo atualizado');
console.log('');
console.log('   Se aparecer "handleSave chamado":');
console.log('   ✅ Função de salvamento está sendo executada');
console.log('');
console.log('   Se aparecer "Dados salvos com sucesso":');
console.log('   ✅ Dados estão sendo salvos no banco');
console.log('');
console.log('   Se aparecer "fetchProcess - dados carregados":');
console.log('   ✅ Dados estão sendo carregados do banco');
console.log('');
console.log('5. 🔄 Recarregue a página e veja se os dados persistiram');

// 6. Resumo do diagnóstico
console.log('\n📊 6. RESUMO DO DIAGNÓSTICO');
console.log('=' .repeat(40));

console.log('\n🎯 OBJETIVO: Identificar por que dados cadastrados não aparecem no relatório');
console.log('\n🔍 MÉTODO: Verificar cada etapa do fluxo de dados');
console.log('\n📝 PRÓXIMOS PASSOS:');
console.log('   1. Testar a aplicação seguindo as instruções acima');
console.log('   2. Observar os logs no console do navegador');
console.log('   3. Identificar em qual etapa o fluxo está falhando');
console.log('   4. Aplicar a correção específica para o problema encontrado');

console.log('\n🏁 DIAGNÓSTICO CONCLUÍDO - ' + new Date().toISOString());