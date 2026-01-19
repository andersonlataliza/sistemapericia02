import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runSeeder() {
    try {
        console.log('🌱 Iniciando execução do seeder simples...');
        console.log(`📡 Conectando ao Supabase: ${supabaseUrl}`);

        // Limpar dados existentes
        console.log('🧹 Limpando dados existentes...');
        
        const tablesToClean = ['risk_agents', 'questionnaires', 'reports', 'documents', 'processes', 'profiles'];
        
        for (const table of tablesToClean) {
            const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) {
                console.log(`   ⚠️  Erro ao limpar ${table}: ${error.message}`);
            } else {
                console.log(`   ✅ Tabela ${table} limpa`);
            }
        }

        // Inserir dados de exemplo
        console.log('📝 Inserindo dados de exemplo...');
        
        // Inserir profiles com IDs fixos (simulando usuários)
        console.log('   👥 Inserindo profiles...');
        const profiles = [
            {
                id: '11111111-1111-1111-1111-111111111111',
                full_name: 'Dr. João Silva - Perito Judicial',
                avatar_url: null
            },
            {
                id: '22222222-2222-2222-2222-222222222222',
                full_name: 'Dra. Maria Santos - Engenheira de Segurança',
                avatar_url: null
            }
        ];

        const { error: profilesError } = await supabase
            .from('profiles')
            .insert(profiles);

        if (profilesError) {
            console.error('❌ Erro ao inserir profiles:', profilesError);
            return;
        }
        console.log('   ✅ Profiles inseridos com sucesso');

        // Inserir processos
        console.log('   📋 Inserindo processos...');
        const processes = [
            {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                process_number: 'PROC-2024-001',
                user_id: '11111111-1111-1111-1111-111111111111',
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
                user_id: '22222222-2222-2222-2222-222222222222',
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
            console.error('❌ Erro ao inserir processos:', processesError);
            return;
        }
        console.log('   ✅ Processos inseridos com sucesso');

        // Inserir agentes de risco
        console.log('   ⚠️  Inserindo agentes de risco...');
        const riskAgents = [
            {
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                process_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                agent_type: 'chemical',
                agent_name: 'Solventes Orgânicos',
                description: 'Exposição a vapores de solventes durante atividades de limpeza',
                exposure_level: 'medium',
                measurement_method: 'Bomba de amostragem pessoal',
                measurement_value: 15.5,
                measurement_unit: 'ppm',
                tolerance_limit: 20.0,
                tolerance_unit: 'ppm',
                risk_level: 'medium',
                insalubrity_degree: 'medium',
                periculosity_applicable: false,
                notes: 'Medição realizada durante período de maior exposição'
            },
            {
                id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                process_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                agent_type: 'physical',
                agent_name: 'Ruído Contínuo',
                description: 'Ruído gerado por equipamentos industriais',
                exposure_level: 'high',
                measurement_method: 'Dosimetria',
                measurement_value: 88.5,
                measurement_unit: 'dB(A)',
                tolerance_limit: 85.0,
                tolerance_unit: 'dB(A)',
                risk_level: 'high',
                insalubrity_degree: 'medium',
                periculosity_applicable: false,
                notes: 'Superação do limite de tolerância'
            }
        ];

        const { error: riskAgentsError } = await supabase
            .from('risk_agents')
            .insert(riskAgents);

        if (riskAgentsError) {
            console.error('❌ Erro ao inserir agentes de risco:', riskAgentsError);
            return;
        }
        console.log('   ✅ Agentes de risco inseridos com sucesso');

        console.log('✅ Seeder executado com sucesso!');

        // Verificar dados inseridos
        console.log('\n🔍 Verificando dados inseridos...');
        
        const { data: profilesData } = await supabase.from('profiles').select('*');
        console.log(`👥 Profiles encontrados: ${profilesData?.length || 0}`);
        profilesData?.forEach(profile => {
            console.log(`   - ${profile.full_name}`);
        });

        const { data: processesData } = await supabase.from('processes').select('*');
        console.log(`📋 Processos encontrados: ${processesData?.length || 0}`);
        processesData?.forEach(process => {
            console.log(`   - ${process.process_number}: ${process.claimant_name}`);
        });

        const { data: riskAgentsData } = await supabase.from('risk_agents').select('*');
        console.log(`⚠️  Agentes de risco encontrados: ${riskAgentsData?.length || 0}`);
        riskAgentsData?.forEach(agent => {
            console.log(`   - ${agent.agent_name} (${agent.agent_type})`);
        });

    } catch (error) {
        console.error('❌ Erro durante execução do seeder:', error);
        process.exit(1);
    }
}

runSeeder();