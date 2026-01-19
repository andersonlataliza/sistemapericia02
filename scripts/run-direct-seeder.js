import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

async function runDirectSeeder() {
    try {
        console.log('🌱 Iniciando execução do seeder direto...');
        console.log(`📡 Conectando ao Supabase: ${supabaseUrl}`);
        
        // Limpar dados existentes
        await clearExistingData();
        
        // Inserir dados de exemplo
        await insertSampleData();
        
        console.log('✅ Seeder executado com sucesso!');
        
        // Verificar se os dados foram inseridos
        await verifyData();
        
    } catch (error) {
        console.error('❌ Erro ao executar seeder:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

async function clearExistingData() {
    console.log('🧹 Limpando dados existentes...');
    
    const tables = ['risk_agents', 'questionnaires', 'reports', 'documents', 'processes', 'profiles'];
    
    for (const table of tables) {
        try {
            const { error } = await supabase
                .from(table)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
            
            if (error) {
                console.log(`   ⚠️  Aviso ao limpar ${table}: ${error.message}`);
            } else {
                console.log(`   ✅ Tabela ${table} limpa`);
            }
        } catch (error) {
            console.log(`   ⚠️  Aviso ao limpar ${table}: ${error.message}`);
        }
    }
}

async function insertSampleData() {
    console.log('📝 Inserindo dados de exemplo...');
    
    // Inserir profiles (usando IDs de usuários existentes)
    console.log('   👥 Inserindo profiles...');
    
    // Primeiro, vamos verificar se há usuários existentes
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    
    if (!existingUsers || existingUsers.users.length === 0) {
        console.log('   ⚠️  Nenhum usuário encontrado no auth.users. Pulando inserção de profiles.');
        return;
    }
    
    const profiles = existingUsers.users.slice(0, 3).map((user, index) => ({
        id: user.id,
        full_name: `Usuário ${index + 1} - ${user.email || 'Sem email'}`,
        avatar_url: null
    }));
    
    const { error: profilesError } = await supabase
        .from('profiles')
        .insert(profiles);
    
    if (profilesError) {
        console.error('   ❌ Erro ao inserir profiles:', profilesError.message);
    } else {
        console.log(`   ✅ ${profiles.length} profiles inseridos`);
    }
    
    // Inserir processos
    console.log('   📋 Inserindo processos...');
    
    if (profiles.length === 0) {
        console.log('   ⚠️  Nenhum profile disponível. Pulando inserção de processos.');
        return;
    }
    
    const processes = [
        {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            process_number: 'PROC-2024-001',
            user_id: profiles[0].id,
            claimant_name: 'João Silva',
            defendant_name: 'Empresa ABC Ltda',
            court: 'TRT 2ª Região',
            status: 'active',
            inspection_date: '2024-01-15T10:00:00Z',
            inspection_address: 'Rua das Indústrias, 123 - São Paulo/SP',
            activities_description: 'O requerente exercia a função de operador, desenvolvendo atividades relacionadas ao processo produtivo da empresa, incluindo operação de equipamentos, manuseio de materiais e cumprimento de procedimentos operacionais estabelecidos.'
        },
        {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            process_number: 'PROC-2024-002',
            user_id: profiles[0].id,
            claimant_name: 'Maria Santos',
            defendant_name: 'Indústria XYZ S.A.',
            court: 'TRT 15ª Região',
            status: 'active',
            inspection_date: '2024-02-20T14:00:00Z',
            inspection_address: 'Av. Industrial, 456 - Campinas/SP',
            activities_description: 'A requerente trabalhava como técnica de laboratório, realizando análises químicas, preparação de amostras e manutenção de equipamentos laboratoriais, com exposição a diversos agentes químicos durante sua jornada de trabalho.'
        }
    ];
    
    const { error: processesError } = await supabase
        .from('processes')
        .insert(processes);
    
    if (processesError) {
        console.error('   ❌ Erro ao inserir processes:', processesError.message);
    } else {
        console.log(`   ✅ ${processes.length} processos inseridos`);
    }
    
    // Inserir agentes de risco
    console.log('   ⚠️  Inserindo agentes de risco...');
    
    if (processes.length === 0) {
        console.log('   ⚠️  Nenhum processo disponível. Pulando inserção de agentes de risco.');
        return;
    }
    
    const riskAgents = [
        {
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            process_id: processes[0].id,
            agent_type: 'chemical',
            agent_name: 'Benzeno',
            exposure_level: 'high',
            protection_measures: 'Uso de EPI adequado, ventilação local exaustora',
            health_effects: 'Pode causar leucemia e outros problemas hematológicos',
            measurement_method: 'Cromatografia gasosa',
            tolerance_limit: '1 ppm (TWA)',
            exposure_time: '8 horas diárias'
        },
        {
            id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            process_id: processes[1].id,
            agent_type: 'physical',
            agent_name: 'Ruído',
            exposure_level: 'medium',
            protection_measures: 'Protetor auricular, isolamento acústico',
            health_effects: 'Perda auditiva induzida por ruído (PAIR)',
            measurement_method: 'Dosimetria de ruído',
            tolerance_limit: '85 dB(A) para 8h',
            exposure_time: '8 horas diárias'
        },
        {
            id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            process_id: processes[0].id,
            agent_type: 'ergonomic',
            agent_name: 'Levantamento de peso',
            exposure_level: 'high',
            protection_measures: 'Treinamento em ergonomia, equipamentos auxiliares',
            health_effects: 'Lesões na coluna vertebral, LER/DORT',
            measurement_method: 'Análise ergonômica do trabalho',
            tolerance_limit: 'Máximo 23kg para homens',
            exposure_time: 'Durante toda jornada'
        }
    ];
    
    const { error: riskError } = await supabase
        .from('risk_agents')
        .insert(riskAgents);
    
    if (riskError) {
        console.error('   ❌ Erro ao inserir risk_agents:', riskError.message);
    } else {
        console.log(`   ✅ ${riskAgents.length} agentes de risco inseridos`);
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
            riskAgents?.forEach(agent => {
                console.log(`   - ${agent.agent_name || agent.agent_type} (${agent.agent_type})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na verificação:', error.message);
    }
}

// Executar seeder direto
runDirectSeeder();