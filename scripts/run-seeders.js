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

// Usuários de teste
const testUsers = [
    {
        email: 'admin@pericia.com',
        password: 'admin123456',
        full_name: 'Dr. João Silva - Administrador'
    },
    {
        email: 'perito@pericia.com', 
        password: 'perito123456',
        full_name: 'Dra. Maria Santos - Perita Judicial'
    },
    {
        email: 'cliente@pericia.com',
        password: 'cliente123456', 
        full_name: 'Carlos Oliveira - Cliente'
    }
];

async function runSeeders() {
    try {
        console.log('🌱 Iniciando execução dos seeders...');
        console.log(`📡 Conectando ao Supabase: ${supabaseUrl}`);
        
        // Criar usuários de teste e inserir dados
        await createTestUsersAndData();
        
        console.log('\n✅ Seeders executados com sucesso!');
        
        // Verificar se os dados foram inseridos
        await verifyData();
        
    } catch (error) {
        console.error('❌ Erro ao executar seeders:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

async function createTestUsersAndData() {
    console.log('👤 Criando usuários de teste e inserindo dados...');
    
    const userIds = [];
    
    // Criar cada usuário e seus dados
    for (const user of testUsers) {
        try {
            console.log(`\n📧 Processando usuário: ${user.email}`);
            
            // Tentar fazer login primeiro (caso o usuário já exista)
            let authResult = await supabase.auth.signInWithPassword({
                email: user.email,
                password: user.password
            });
            
            // Se o login falhar, criar o usuário
            if (authResult.error) {
                console.log(`   ➕ Criando novo usuário: ${user.email}`);
                authResult = await supabase.auth.signUp({
                    email: user.email,
                    password: user.password,
                    options: {
                        data: {
                            full_name: user.full_name
                        }
                    }
                });
                
                if (authResult.error) {
                    console.error(`   ❌ Erro ao criar usuário ${user.email}:`, authResult.error.message);
                    continue;
                }
            }
            
            if (authResult.data.user) {
                const userId = authResult.data.user.id;
                userIds.push(userId);
                console.log(`   ✅ Usuário autenticado: ${userId}`);
                
                // Inserir/atualizar profile
                await insertProfile(userId, user.full_name);
                
                // Se for o primeiro usuário (admin), criar processos de exemplo
                if (userIds.length === 1) {
                    await insertSampleProcesses(userId);
                }
            }
            
        } catch (error) {
            console.error(`   ❌ Erro ao processar usuário ${user.email}:`, error.message);
        }
    }
    
    console.log(`\n✅ Processados ${userIds.length} usuários`);
}

async function insertProfile(userId, fullName) {
    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                full_name: fullName
            });
            
        if (error) {
            console.error(`   ⚠️  Aviso ao inserir profile:`, error.message);
        } else {
            console.log(`   👤 Profile criado/atualizado`);
        }
    } catch (error) {
        console.error(`   ❌ Erro ao inserir profile:`, error.message);
    }
}

async function insertSampleProcesses(userId) {
    console.log(`   📋 Inserindo processos de exemplo para usuário ${userId}`);
    
    const processes = [
        {
            user_id: userId,
            process_number: '1234567-89.2024.5.02.0001',
            claimant_name: 'João da Silva',
            defendant_name: 'Empresa ABC Ltda',
            court: '2ª Vara do Trabalho de São Paulo',
            status: 'agendado',
            inspection_date: '2024-12-15',
            inspection_address: 'Rua das Indústrias, 123 - São Paulo/SP',
            inspection_time: '14:00',
            inspection_notes: 'Inspeção no setor de produção',
            inspection_duration_minutes: 120,
            inspection_reminder_minutes: 60,
            inspection_status: 'pendente',
            payment_status: 'pendente',
            payment_amount: 2500.00,
            payment_notes: 'Honorários periciais',
            expert_fee: 2500.00,
            objective: 'Avaliar condições de trabalho e exposição a agentes nocivos',
            initial_data: 'Trabalhador exposto a ruído e produtos químicos',
            methodology: 'Inspeção visual, medições ambientais e análise documental',
            activities_description: 'Operação de máquinas industriais',
            conclusion: 'Pendente de inspeção'
        },
        {
            user_id: userId,
            process_number: '9876543-21.2024.5.02.0002', 
            claimant_name: 'Maria Oliveira',
            defendant_name: 'Indústria XYZ S.A.',
            court: '5ª Vara do Trabalho de São Paulo',
            status: 'em_andamento',
            inspection_date: '2024-11-20',
            inspection_address: 'Av. Industrial, 456 - São Paulo/SP',
            inspection_time: '09:00',
            inspection_notes: 'Inspeção no setor químico',
            inspection_duration_minutes: 180,
            inspection_reminder_minutes: 30,
            inspection_status: 'realizada',
            payment_status: 'pago',
            payment_amount: 3000.00,
            payment_date: '2024-11-25',
            payment_notes: 'Pagamento efetuado via transferência',
            expert_fee: 3000.00,
            objective: 'Avaliar exposição a agentes químicos',
            initial_data: 'Trabalhadora do setor de tintas',
            methodology: 'Medições de vapores químicos e análise de EPIs',
            activities_description: 'Preparação e aplicação de tintas industriais',
            insalubrity_analysis: 'Exposição a solventes orgânicos',
            insalubrity_results: 'Grau médio confirmado',
            conclusion: 'Insalubridade grau médio comprovada'
        }
    ];
    
    try {
        const { data: _data, error } = await supabase
            .from('processes')
            .insert(processes);
            
        if (error) {
            console.error(`   ❌ Erro ao inserir processos:`, error.message);
        } else {
            console.log(`   ✅ ${processes.length} processos inseridos`);
        }
    } catch (error) {
        console.error(`   ❌ Erro ao inserir processos:`, error.message);
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
        
    } catch (error) {
        console.error('❌ Erro na verificação:', error.message);
    }
}

// Executar seeders
runSeeders();