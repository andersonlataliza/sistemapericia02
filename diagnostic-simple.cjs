// Script de Diagnóstico Simples - Sistema de Laudo Pericial
const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNÓSTICO RÁPIDO DO SISTEMA DE LAUDO PERICIAL');
console.log('=' .repeat(60));

const report = {
  timestamp: new Date().toISOString(),
  frontend_analysis: {},
  issues_found: [],
  recommendations: []
};

// 1. Verificar arquivos críticos do frontend
console.log('\n🖥️  VERIFICANDO ARQUIVOS DO FRONTEND...');

const criticalFiles = [
  'src/pages/ProcessDetail.tsx',
  'src/components/laudo/InitialDataSection.tsx',
  'src/integrations/supabase/client.ts',
  '.env',
  'package.json'
];

criticalFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  console.log(`\n📄 Analisando: ${file}`);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const analysis = {
      exists: true,
      size: content.length,
      lines: content.split('\n').length
    };
    
    // Análises específicas por arquivo
    if (file.includes('ProcessDetail.tsx')) {
      analysis.has_initial_data = content.includes('initial_data');
      analysis.has_updateprocess = content.includes('updateProcess');
      analysis.has_handleSave = content.includes('handleSave');
      analysis.has_supabase = content.includes('supabase');
      
      // Procurar por padrões problemáticos
      if (content.includes('console.log')) {
        analysis.has_debug_logs = true;
      }
      
      console.log(`   ✅ Arquivo existe (${analysis.size} chars, ${analysis.lines} linhas)`);
      console.log(`   - initial_data: ${analysis.has_initial_data ? '✅' : '❌'}`);
      console.log(`   - updateProcess: ${analysis.has_updateprocess ? '✅' : '❌'}`);
      console.log(`   - handleSave: ${analysis.has_handleSave ? '✅' : '❌'}`);
      console.log(`   - supabase: ${analysis.has_supabase ? '✅' : '❌'}`);
      console.log(`   - debug logs: ${analysis.has_debug_logs ? '✅' : '❌'}`);
    }
    
    if (file.includes('InitialDataSection.tsx')) {
      analysis.has_value_prop = content.includes('value');
      analysis.has_onchange_prop = content.includes('onChange');
      analysis.has_textarea = content.includes('Textarea') || content.includes('textarea');
      
      console.log(`   ✅ Arquivo existe (${analysis.size} chars, ${analysis.lines} linhas)`);
      console.log(`   - value prop: ${analysis.has_value_prop ? '✅' : '❌'}`);
      console.log(`   - onChange prop: ${analysis.has_onchange_prop ? '✅' : '❌'}`);
      console.log(`   - textarea: ${analysis.has_textarea ? '✅' : '❌'}`);
    }
    
    if (file.includes('.env')) {
      analysis.has_supabase_url = content.includes('VITE_SUPABASE_URL');
      analysis.has_supabase_key = content.includes('VITE_SUPABASE_ANON_KEY');
      
      console.log(`   ✅ Arquivo existe (${analysis.size} chars)`);
      console.log(`   - SUPABASE_URL: ${analysis.has_supabase_url ? '✅' : '❌'}`);
      console.log(`   - SUPABASE_KEY: ${analysis.has_supabase_key ? '✅' : '❌'}`);
      
      if (!analysis.has_supabase_url || !analysis.has_supabase_key) {
        report.issues_found.push({
          severity: 'CRITICAL',
          area: 'Configuration',
          issue: 'Configuração do Supabase incompleta no .env',
          file: file
        });
      }
    }
    
    if (file.includes('package.json')) {
      try {
        const packageData = JSON.parse(content);
        analysis.has_supabase_dep = packageData.dependencies && packageData.dependencies['@supabase/supabase-js'];
        analysis.has_react = packageData.dependencies && packageData.dependencies['react'];
        
        console.log(`   ✅ Arquivo existe - ${packageData.name || 'N/A'}`);
        console.log(`   - @supabase/supabase-js: ${analysis.has_supabase_dep ? '✅' : '❌'}`);
        console.log(`   - react: ${analysis.has_react ? '✅' : '❌'}`);
      } catch (e) {
        console.log(`   ❌ Erro ao parsear package.json: ${e.message}`);
        report.issues_found.push({
          severity: 'HIGH',
          area: 'Configuration',
          issue: 'package.json inválido',
          file: file
        });
      }
    }
    
    report.frontend_analysis[file] = analysis;
    
  } else {
    console.log(`   ❌ ARQUIVO NÃO ENCONTRADO`);
    report.frontend_analysis[file] = { exists: false };
    report.issues_found.push({
      severity: 'CRITICAL',
      area: 'Missing Files',
      issue: `Arquivo crítico não encontrado: ${file}`,
      file: file
    });
  }
});

// 2. Verificar estrutura de pastas
console.log('\n📁 VERIFICANDO ESTRUTURA DE PASTAS...');
const requiredDirs = [
  'src',
  'src/pages',
  'src/components',
  'src/components/laudo',
  'src/integrations',
  'src/integrations/supabase'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    console.log(`   ✅ ${dir}`);
  } else {
    console.log(`   ❌ ${dir} - NÃO ENCONTRADO`);
    report.issues_found.push({
      severity: 'HIGH',
      area: 'Project Structure',
      issue: `Pasta necessária não encontrada: ${dir}`,
      dir: dir
    });
  }
});

// 3. Análise de código específica
console.log('\n🔍 ANÁLISE DETALHADA DE CÓDIGO...');

// Verificar ProcessDetail.tsx em detalhes
const processDetailPath = path.join(process.cwd(), 'src/pages/ProcessDetail.tsx');
if (fs.existsSync(processDetailPath)) {
  const content = fs.readFileSync(processDetailPath, 'utf8');
  
  console.log('\n📋 ProcessDetail.tsx:');
  
  // Verificar funções críticas
  const functions = [
    'updateProcess',
    'handleSave',
    'fetchProcess',
    'saveProcessMeta'
  ];
  
  functions.forEach(func => {
    const hasFunction = content.includes(`${func}`);
    console.log(`   - ${func}: ${hasFunction ? '✅' : '❌'}`);
    
    if (!hasFunction) {
      report.issues_found.push({
        severity: 'CRITICAL',
        area: 'Code Structure',
        issue: `Função crítica não encontrada: ${func}`,
        file: 'ProcessDetail.tsx'
      });
    }
  });
  
  // Verificar padrões específicos
  const patterns = [
    { name: 'initial_data usage', pattern: /initial_data/g },
    { name: 'Supabase updates', pattern: /\.update\(/g },
    { name: 'State updates', pattern: /setProcess/g },
    { name: 'Error handling', pattern: /catch|error/gi }
  ];
  
  patterns.forEach(({ name, pattern }) => {
    const matches = content.match(pattern);
    const count = matches ? matches.length : 0;
    console.log(`   - ${name}: ${count} ocorrências`);
  });
}

// 4. Gerar recomendações baseadas nos achados
console.log('\n💡 GERANDO RECOMENDAÇÕES...');

if (report.issues_found.length === 0) {
  report.recommendations = [
    'Estrutura do projeto parece estar correta',
    'Verificar logs do console do navegador para erros de runtime',
    'Testar manualmente o fluxo de salvamento de dados',
    'Verificar se o Supabase está configurado corretamente'
  ];
} else {
  const criticalIssues = report.issues_found.filter(i => i.severity === 'CRITICAL');
  const highIssues = report.issues_found.filter(i => i.severity === 'HIGH');
  
  if (criticalIssues.length > 0) {
    report.recommendations.push('🚨 URGENTE: Resolver problemas críticos primeiro');
    criticalIssues.forEach(issue => {
      report.recommendations.push(`   - ${issue.issue}`);
    });
  }
  
  if (highIssues.length > 0) {
    report.recommendations.push('⚠️  IMPORTANTE: Resolver problemas de alta prioridade');
    highIssues.forEach(issue => {
      report.recommendations.push(`   - ${issue.issue}`);
    });
  }
  
  report.recommendations.push('🔧 Verificar configurações do ambiente (.env)');
  report.recommendations.push('🧪 Testar conexão com Supabase manualmente');
  report.recommendations.push('📱 Verificar interface do usuário no navegador');
}

// 5. Salvar relatório
console.log('\n💾 SALVANDO RELATÓRIO...');
const reportPath = path.join(process.cwd(), 'diagnostic-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`✅ Relatório salvo em: ${reportPath}`);

// 6. Resumo final
console.log('\n📊 RESUMO EXECUTIVO');
console.log('=' .repeat(40));
console.log(`🔍 Problemas encontrados: ${report.issues_found.length}`);

if (report.issues_found.length > 0) {
  console.log('\n❌ PROBLEMAS:');
  report.issues_found.forEach((issue, index) => {
    console.log(`${index + 1}. [${issue.severity}] ${issue.issue}`);
  });
}

console.log('\n💡 PRÓXIMOS PASSOS:');
report.recommendations.forEach((rec, index) => {
  console.log(`${index + 1}. ${rec}`);
});

console.log('\n🏁 DIAGNÓSTICO CONCLUÍDO');
console.log(`📄 Relatório completo salvo em: diagnostic-report.json`);