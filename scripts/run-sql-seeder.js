import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias');
    console.log('Verifique o arquivo .env');
    process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSqlSeeder() {
    try {
        console.log('🌱 Iniciando execução do seeder SQL...');
        console.log(`📡 Conectando ao Supabase: ${supabaseUrl}`);
        
        // Ler o arquivo seed.sql
        const seedFilePath = path.join(process.cwd(), 'supabase', 'seed.sql');
        
        if (!fs.existsSync(seedFilePath)) {
            throw new Error(`Arquivo seed.sql não encontrado em: ${seedFilePath}`);
        }
        
        const sqlContent = fs.readFileSync(seedFilePath, 'utf8');
        console.log('📄 Arquivo seed.sql carregado');
        
        // Dividir o SQL em comandos individuais
        const sqlCommands = sqlContent
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        console.log(`📝 Executando ${sqlCommands.length} comandos SQL...`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < sqlCommands.length; i++) {
            const command = sqlCommands[i];
            
            if (command.toLowerCase().startsWith('delete') || 
                command.toLowerCase().startsWith('insert') ||
                command.toLowerCase().startsWith('create')) {
                
                try {
                    console.log(`   Executando comando ${i + 1}/${sqlCommands.length}...`);
                    
                    const { error } = await supabase.rpc('exec_sql', { 
                        sql_query: command 
                    });
                    
                    if (error) {
                        console.error(`   ❌ Erro no comando ${i + 1}:`, error.message);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                } catch (error) {
                    console.error(`   ❌ Erro no comando ${i + 1}:`, error.message);
                    errorCount++;
                }
            }
        }
        
        console.log(`\n📊 Resultado: ${successCount} sucessos, ${errorCount} erros`);
        
        if (errorCount === 0) {
            console.log('✅ Seeder SQL executado com sucesso!');
        } else {
            console.log('⚠️  Seeder SQL executado com alguns erros');
        }
        
        // Verificar se os dados foram inseridos
        await verifyData();
        
    } catch (error) {
        console.error('❌ Erro ao executar seeder SQL:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

async function verifyData() {
    console.log('\n🔍 Verificando dados inseridos...');
    
    try {
        // Verificar profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*');
            
        if (profilesError) {
            console.error('❌ Erro ao verificar profiles:', profilesError.message);
        } else {
            console.log(`👥 Profiles encontrados: ${profiles?.length || 0}`);
            profiles?.forEach(profile => {
                console.log(`   - ${profile.full_name} (${profile.id})`);
            });
        }
        
        // Verificar processes
        const { data: processes, error: processesError } = await supabase
            .from('processes')
            .select('*');
            
        if (processesError) {
            console.error('❌ Erro ao verificar processes:', processesError.message);
        } else {
            console.log(`📋 Processos encontrados: ${processes?.length || 0}`);
            processes?.forEach(process => {
                console.log(`   - ${process.process_number} - ${process.claimant_name}`);
            });
        }
        
        // Verificar risk_agents
        const { data: riskAgents, error: riskError } = await supabase
            .from('risk_agents')
            .select('*');
            
        if (riskError) {
            console.error('❌ Erro ao verificar risk_agents:', riskError.message);
        } else {
            console.log(`⚠️  Agentes de risco encontrados: ${riskAgents?.length || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Erro na verificação:', error.message);
    }
}

// Executar seeder SQL
runSqlSeeder();