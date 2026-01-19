// Script de Diagnóstico - Sistema de Laudo Pericial
// Este script vai verificar todos os aspectos do problema de extração de dados

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuração do Supabase (usando as mesmas variáveis do .env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ixqjqhqjqhqjqhqjqhqj.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxaHFqcWhxanFocWpxaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwNzA4NzEsImV4cCI6MjA1MDY0Njg3MX0.VYlYWJmYzI2ZjI2ZjI2ZjI2ZjI2ZjI2ZjI2ZjI2ZjI2';

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateDiagnosticReport() {
  console.log('🔍 INICIANDO DIAGNÓSTICO COMPLETO DO SISTEMA DE LAUDO PERICIAL');
  console.log('=' .repeat(80));
  
  const report = {
    timestamp: new Date().toISOString(),
    database_status: {},
    processes_data: {},
    frontend_analysis: {},
    issues_found: [],
    recommendations: []
  };

  try {
    // 1. Verificar conexão com o banco
    console.log('\n📊 1. VERIFICANDO CONEXÃO COM O BANCO DE DADOS...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('processes')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      report.issues_found.push({
        severity: 'CRITICAL',
        area: 'Database Connection',
        issue: 'Falha na conexão com Supabase',
        details: connectionError.message
      });
      console.log('❌ ERRO: Falha na conexão com o banco');
      return report;
    }
    
    report.database_status.connection = 'OK';
    console.log('✅ Conexão com banco estabelecida');

    // 2. Verificar estrutura da tabela processes
    console.log('\n🏗️  2. VERIFICANDO ESTRUTURA DA TABELA PROCESSES...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'processes' })
      .catch(() => null);
    
    // Verificar se o campo initial_data existe
    const { data: processesData, error: processesError } = await supabase
      .from('processes')
      .select('id, process_number, initial_data, created_at')
      .limit(5);
    
    if (processesError) {
      report.issues_found.push({
        severity: 'HIGH',
        area: 'Database Schema',
        issue: 'Erro ao acessar tabela processes',
        details: processesError.message
      });
    } else {
      report.database_status.processes_table = 'OK';
      report.processes_data.total_processes = processesData.length;
      console.log(`✅ Tabela processes acessível - ${processesData.length} processos encontrados`);
      
      // Verificar dados do initial_data
      const processesWithInitialData = processesData.filter(p => p.initial_data && p.initial_data.trim().length > 0);
      const processesWithoutInitialData = processesData.filter(p => !p.initial_data || p.initial_data.trim().length === 0);
      
      report.processes_data.with_initial_data = processesWithInitialData.length;
      report.processes_data.without_initial_data = processesWithoutInitialData.length;
      
      console.log(`📋 Processos com initial_data: ${processesWithInitialData.length}`);
      console.log(`📋 Processos sem initial_data: ${processesWithoutInitialData.length}`);
      
      if (processesWithoutInitialData.length > 0) {
        report.issues_found.push({
          severity: 'MEDIUM',
          area: 'Data Integrity',
          issue: 'Processos sem dados de initial_data',
          details: `${processesWithoutInitialData.length} processos não possuem dados em initial_data`
        });
      }
    }

    // 3. Verificar dados específicos de um processo
    console.log('\n🔍 3. ANALISANDO DADOS ESPECÍFICOS DE UM PROCESSO...');
    if (processesData && processesData.length > 0) {
      const firstProcess = processesData[0];
      console.log(`📄 Analisando processo: ${firstProcess.process_number || firstProcess.id}`);
      
      const { data: fullProcess, error: fullProcessError } = await supabase
        .from('processes')
        .select('*')
        .eq('id', firstProcess.id)
        .single();
      
      if (fullProcessError) {
        report.issues_found.push({
          severity: 'HIGH',
          area: 'Data Retrieval',
          issue: 'Erro ao carregar processo completo',
          details: fullProcessError.message
        });
      } else {
        report.processes_data.sample_process = {
          id: fullProcess.id,
          process_number: fullProcess.process_number,
          has_initial_data: !!fullProcess.initial_data,
          initial_data_length: fullProcess.initial_data ? fullProcess.initial_data.length : 0,
          initial_data_preview: fullProcess.initial_data ? fullProcess.initial_data.substring(0, 100) + '...' : null,
          has_claimant_data: !!fullProcess.claimant_data,
          has_defendant_data: !!fullProcess.defendant_data,
          created_at: fullProcess.created_at,
          updated_at: fullProcess.updated_at
        };
        
        console.log(`✅ Processo carregado com sucesso`);
        console.log(`   - ID: ${fullProcess.id}`);
        console.log(`   - Número: ${fullProcess.process_number || 'N/A'}`);
        console.log(`   - Initial Data: ${fullProcess.initial_data ? 'SIM (' + fullProcess.initial_data.length + ' chars)' : 'NÃO'}`);
        console.log(`   - Claimant Data: ${fullProcess.claimant_data ? 'SIM' : 'NÃO'}`);
        console.log(`   - Defendant Data: ${fullProcess.defendant_data ? 'SIM' : 'NÃO'}`);
      }
    }

    // 4. Verificar arquivos do frontend
    console.log('\n🖥️  4. VERIFICANDO ARQUIVOS DO FRONTEND...');
    const frontendFiles = [
      'src/pages/ProcessDetail.tsx',
      'src/components/laudo/InitialDataSection.tsx',
      'src/integrations/supabase/client.ts'
    ];
    
    for (const file of frontendFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        report.frontend_analysis[file] = {
          exists: true,
          size: content.length,
          has_initial_data_refs: content.includes('initial_data'),
          has_updateprocess_refs: content.includes('updateProcess'),
          has_supabase_refs: content.includes('supabase')
        };
        console.log(`✅ ${file} - OK`);
      } else {
        report.frontend_analysis[file] = { exists: false };
        report.issues_found.push({
          severity: 'HIGH',
          area: 'Frontend Files',
          issue: `Arquivo não encontrado: ${file}`,
          details: `O arquivo ${file} não existe no caminho esperado`
        });
        console.log(`❌ ${file} - NÃO ENCONTRADO`);
      }
    }

    // 5. Teste de escrita e leitura
    console.log('\n✍️  5. TESTANDO ESCRITA E LEITURA DE DADOS...');
    if (processesData && processesData.length > 0) {
      const testProcess = processesData[0];
      const testData = `TESTE DE DIAGNÓSTICO - ${new Date().toISOString()}`;
      
      // Tentar escrever
      const { error: writeError } = await supabase
        .from('processes')
        .update({ initial_data: testData })
        .eq('id', testProcess.id);
      
      if (writeError) {
        report.issues_found.push({
          severity: 'CRITICAL',
          area: 'Database Write',
          issue: 'Falha ao escrever dados',
          details: writeError.message
        });
        console.log('❌ ERRO: Falha ao escrever dados no banco');
      } else {
        console.log('✅ Escrita no banco - OK');
        
        // Tentar ler de volta
        const { data: readBack, error: readError } = await supabase
          .from('processes')
          .select('initial_data')
          .eq('id', testProcess.id)
          .single();
        
        if (readError) {
          report.issues_found.push({
            severity: 'HIGH',
            area: 'Database Read',
            issue: 'Falha ao ler dados',
            details: readError.message
          });
          console.log('❌ ERRO: Falha ao ler dados do banco');
        } else if (readBack.initial_data === testData) {
          console.log('✅ Leitura do banco - OK');
          report.database_status.read_write_test = 'PASSED';
        } else {
          report.issues_found.push({
            severity: 'CRITICAL',
            area: 'Data Consistency',
            issue: 'Dados não persistem corretamente',
            details: `Escrito: "${testData}", Lido: "${readBack.initial_data}"`
          });
          console.log('❌ ERRO: Dados não persistem corretamente');
        }
      }
    }

    // 6. Gerar recomendações
    console.log('\n💡 6. GERANDO RECOMENDAÇÕES...');
    
    if (report.issues_found.length === 0) {
      report.recommendations.push('Sistema aparenta estar funcionando corretamente. Verificar logs do navegador para problemas de frontend.');
    } else {
      const criticalIssues = report.issues_found.filter(i => i.severity === 'CRITICAL');
      const highIssues = report.issues_found.filter(i => i.severity === 'HIGH');
      
      if (criticalIssues.length > 0) {
        report.recommendations.push('URGENTE: Resolver problemas críticos de conectividade/persistência de dados');
      }
      
      if (highIssues.length > 0) {
        report.recommendations.push('Verificar e corrigir problemas de estrutura de dados e arquivos');
      }
      
      report.recommendations.push('Verificar configurações do Supabase (.env)');
      report.recommendations.push('Testar manualmente a interface do usuário');
      report.recommendations.push('Verificar logs do console do navegador');
    }

  } catch (error) {
    console.log('❌ ERRO GERAL:', error.message);
    report.issues_found.push({
      severity: 'CRITICAL',
      area: 'General',
      issue: 'Erro durante diagnóstico',
      details: error.message
    });
  }

  // 7. Salvar relatório
  console.log('\n💾 7. SALVANDO RELATÓRIO...');
  const reportPath = path.join(process.cwd(), 'diagnostic-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Relatório salvo em: ${reportPath}`);

  // 8. Exibir resumo
  console.log('\n📋 RESUMO DO DIAGNÓSTICO');
  console.log('=' .repeat(50));
  console.log(`🔍 Total de problemas encontrados: ${report.issues_found.length}`);
  
  if (report.issues_found.length > 0) {
    console.log('\n❌ PROBLEMAS ENCONTRADOS:');
    report.issues_found.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.severity}] ${issue.area}: ${issue.issue}`);
      console.log(`   Detalhes: ${issue.details}`);
    });
  }
  
  console.log('\n💡 RECOMENDAÇÕES:');
  report.recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });
  
  console.log('\n🏁 DIAGNÓSTICO CONCLUÍDO');
  return report;
}

// Executar diagnóstico
generateDiagnosticReport()
  .then(() => {
    console.log('\n✅ Diagnóstico executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro durante diagnóstico:', error);
    process.exit(1);
  });