-- =====================================================
-- MIGRATION: Comprehensive Seeders for Sistema de Perícia
-- Created: 2025-01-02
-- Description: Carga completa de dados de exemplo para o sistema
-- =====================================================

-- =====================================================
-- 1. SAMPLE USERS AND PROFILES
-- =====================================================

-- Note: Users are created through Supabase Auth, but we can insert profiles
-- These UUIDs should match actual auth.users entries or be created through the application

-- Sample profiles (these would be created automatically when users sign up)
-- For demonstration purposes, we'll use fixed UUIDs that should be replaced with real ones

DO $$
DECLARE
    admin_user_id UUID := '11111111-1111-1111-1111-111111111111';
    perito_user_id UUID := '22222222-2222-2222-2222-222222222222';
    cliente_user_id UUID := '33333333-3333-3333-3333-333333333333';
    perito2_user_id UUID := '44444444-4444-4444-4444-444444444444';
    cliente2_user_id UUID := '55555555-5555-5555-5555-555555555555';
BEGIN
    -- Insert sample profiles (only if they don't exist)
    INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
    VALUES 
        (admin_user_id, 'Dr. João Silva - Administrador', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', NOW() - INTERVAL '30 days', NOW()),
        (perito_user_id, 'Dra. Maria Santos - Perita Judicial', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face', NOW() - INTERVAL '25 days', NOW()),
        (cliente_user_id, 'Carlos Oliveira - Advogado', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', NOW() - INTERVAL '20 days', NOW()),
        (perito2_user_id, 'Dr. Roberto Lima - Engenheiro de Segurança', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face', NOW() - INTERVAL '15 days', NOW()),
        (cliente2_user_id, 'Ana Costa - Consultora Jurídica', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face', NOW() - INTERVAL '10 days', NOW())
    ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. SAMPLE PROCESSES
-- =====================================================

    -- Insert comprehensive sample processes
    INSERT INTO public.processes (
        id, user_id, process_number, claimant_name, defendant_name, court, status,
        inspection_date, inspection_address, inspection_time, inspection_notes,
        inspection_duration_minutes, inspection_reminder_minutes, inspection_status,
        determined_value, payment_status, payment_amount, payment_date, payment_notes,
        payment_due_date, expert_fee, objective, initial_data, defense_data,
        methodology, activities_description, insalubrity_analysis, insalubrity_results,
        periculosity_analysis, periculosity_concept, periculosity_results,
        flammable_definition, conclusion,
        cover_data, identifications, claimant_data, defendant_data,
        workplace_characteristics, epis, diligence_data, documents_presented, attendees,
        created_at, updated_at
    ) VALUES 
    (
        gen_random_uuid(), perito_user_id,
        '0001234-56.2024.5.02.0001',
        'José da Silva',
        'Metalúrgica ABC Ltda.',
        '1ª Vara do Trabalho de São Paulo',
        'active',
        NOW() + INTERVAL '7 days',
        'Rua Industrial, 123 - Distrito Industrial, São Paulo - SP',
        '14:00',
        'Inspeção para avaliação de agentes de risco no setor de soldagem',
        120,
        30,
        'scheduled_confirmed',
        15000.00,
        'partial',
        7500.00,
        CURRENT_DATE - INTERVAL '5 days',
        'Primeira parcela paga via PIX',
        CURRENT_DATE + INTERVAL '30 days',
        3000.00,
        'Avaliar exposição a agentes físicos, químicos e de acidentes no ambiente de trabalho do reclamante',
        'Reclamante trabalhou como soldador na empresa reclamada por 8 anos, alegando exposição a fumos metálicos, ruído excessivo e calor. Pleiteia adicional de insalubridade e periculosidade.',
        'Empresa nega exposição habitual e permanente aos agentes alegados, informando uso de EPIs adequados e controles ambientais eficazes.',
        'Metodologia baseada na NHO-01 para ruído, NHO-08 para fumos metálicos e NR-16 para periculosidade. Medições quantitativas com equipamentos calibrados.',
        'Soldagem de estruturas metálicas em ambiente industrial, com uso de eletrodo revestido e MIG/MAG. Jornada de 8 horas diárias.',
        'Identificados fumos metálicos (ferro, manganês, cromo) acima dos limites de tolerância da NR-15. Ruído contínuo de 88 dB(A) - dentro dos limites. Calor radiante significativo próximo ao forno.',
        'Caracterizada insalubridade em grau médio (20%) pela exposição a fumos metálicos. Não caracterizada insalubridade por ruído.',
        'Identificado manuseio de gases inflamáveis (acetileno, GLP) em área de risco. Presença de materiais combustíveis e fontes de ignição.',
        'Atividade enquadrada no Anexo 2 da NR-16 - manuseio de inflamáveis líquidos e gasosos.',
        'Caracterizada periculosidade (30%) pelo manuseio habitual de gases inflamáveis em área de risco.',
        'Gases inflamáveis são substâncias que se inflamam facilmente em contato com fontes de ignição, apresentando risco de explosão.',
        'Caracterizada insalubridade em grau médio e periculosidade. Recomenda-se melhoria nos sistemas de ventilação e controle rigoroso de EPIs.',
        '{"cidade": "São Paulo", "data": "' || TO_CHAR(NOW(), 'DD/MM/YYYY') || '", "perito": "Dra. Maria Santos", "crea": "SP-123456", "titulo": "Engenheira de Segurança do Trabalho"}',
        '{"numero_processo": "0001234-56.2024.5.02.0001", "vara": "1ª Vara do Trabalho de São Paulo", "reclamante": "José da Silva", "reclamada": "Metalúrgica ABC Ltda."}',
        '{"nome": "José da Silva", "cpf": "123.456.789-00", "cargo": "Soldador", "periodo": "01/2016 a 12/2023", "salario": "R$ 2.800,00", "endereco": "Rua das Flores, 456 - Vila Nova, São Paulo - SP"}',
        '{"razao_social": "Metalúrgica ABC Ltda.", "cnpj": "12.345.678/0001-90", "endereco": "Rua Industrial, 123 - Distrito Industrial, São Paulo - SP", "atividade": "Fabricação de estruturas metálicas", "representante": "Carlos Alberto - Gerente de RH"}',
        '{"area_total": "2.500 m²", "pe_direito": "8 metros", "construcao": "Alvenaria e estrutura metálica", "ventilacao": "Natural e forçada", "iluminacao": "Natural e artificial LED", "temperatura": "Ambiente + calor radiante", "umidade": "60-70%"}',
        '[{"tipo": "Máscara PFF2", "ca": "12345", "uso": "Obrigatório", "estado": "Adequado"}, {"tipo": "Óculos de segurança", "ca": "67890", "uso": "Obrigatório", "estado": "Adequado"}, {"tipo": "Luvas de couro", "ca": "54321", "uso": "Obrigatório", "estado": "Desgastadas"}]',
        '[{"data": "' || TO_CHAR(NOW() - INTERVAL '2 days', 'DD/MM/YYYY') || '", "atividade": "Vistoria inicial", "observacoes": "Reconhecimento do ambiente e atividades"}, {"data": "' || TO_CHAR(NOW() + INTERVAL '7 days', 'DD/MM/YYYY') || '", "atividade": "Medições quantitativas", "observacoes": "Agendada"}]',
        '[{"documento": "PPRA 2024", "tipo": "Programa", "relevancia": "Alto"}, {"documento": "LTCAT", "tipo": "Laudo", "relevancia": "Alto"}, {"documento": "Fichas de EPI", "tipo": "Controle", "relevancia": "Médio"}]',
        '[{"nome": "Carlos Alberto", "cargo": "Gerente de RH", "empresa": "Metalúrgica ABC"}, {"nome": "João Técnico", "cargo": "Técnico de Segurança", "empresa": "Metalúrgica ABC"}]',
        NOW() - INTERVAL '15 days',
        NOW()
    ),
    (
        gen_random_uuid(), perito_user_id,
        '0005678-90.2024.5.02.0002',
        'Maria Fernanda Costa',
        'Hospital São Lucas S.A.',
        '2ª Vara do Trabalho de São Paulo',
        'completed',
        NOW() - INTERVAL '30 days',
        'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
        '09:00',
        'Avaliação de agentes biológicos e químicos em ambiente hospitalar',
        180,
        60,
        'completed',
        12000.00,
        'paid',
        12000.00,
        CURRENT_DATE - INTERVAL '10 days',
        'Pagamento integral realizado',
        CURRENT_DATE - INTERVAL '15 days',
        2500.00,
        'Avaliar exposição a agentes biológicos e químicos no setor de enfermagem',
        'Reclamante trabalhou como enfermeira por 5 anos, alegando exposição a materiais biológicos contaminados e produtos químicos de limpeza.',
        'Hospital contesta alegações, informando protocolos rigorosos de biossegurança e fornecimento adequado de EPIs.',
        'Avaliação qualitativa baseada na NR-32 e quantitativa para agentes químicos conforme NR-15.',
        'Assistência de enfermagem em UTI, manuseio de materiais perfurocortantes, medicamentos e produtos de limpeza hospitalar.',
        'Confirmada exposição a agentes biológicos classe 3. Produtos químicos dentro dos limites aceitáveis.',
        'Caracterizada insalubridade em grau médio (20%) por agentes biológicos.',
        'Não identificados agentes de periculosidade conforme NR-16.',
        'Não aplicável.',
        'Não caracterizada periculosidade.',
        'Não aplicável.',
        'Caracterizada insalubridade em grau médio por exposição a agentes biológicos. Protocolos de segurança adequados.',
        '{"cidade": "São Paulo", "data": "' || TO_CHAR(NOW() - INTERVAL '20 days', 'DD/MM/YYYY') || '", "perito": "Dra. Maria Santos", "crea": "SP-123456", "titulo": "Engenheira de Segurança do Trabalho"}',
        '{"numero_processo": "0005678-90.2024.5.02.0002", "vara": "2ª Vara do Trabalho de São Paulo", "reclamante": "Maria Fernanda Costa", "reclamada": "Hospital São Lucas S.A."}',
        '{"nome": "Maria Fernanda Costa", "cpf": "987.654.321-00", "cargo": "Enfermeira", "periodo": "03/2019 a 08/2024", "salario": "R$ 4.200,00", "endereco": "Rua da Saúde, 789 - Centro, São Paulo - SP"}',
        '{"razao_social": "Hospital São Lucas S.A.", "cnpj": "98.765.432/0001-10", "endereco": "Av. Paulista, 1000 - Bela Vista, São Paulo - SP", "atividade": "Serviços hospitalares", "representante": "Dra. Ana Paula - Diretora Técnica"}',
        '{"area_total": "15.000 m²", "pe_direito": "3 metros", "construcao": "Concreto armado", "ventilacao": "Ar condicionado central", "iluminacao": "Artificial LED", "temperatura": "22°C ± 2°C", "umidade": "50-60%"}',
        '[{"tipo": "Luvas de procedimento", "ca": "11111", "uso": "Obrigatório", "estado": "Adequado"}, {"tipo": "Máscara cirúrgica", "ca": "22222", "uso": "Obrigatório", "estado": "Adequado"}, {"tipo": "Óculos de proteção", "ca": "33333", "uso": "Quando necessário", "estado": "Adequado"}]',
        '[{"data": "' || TO_CHAR(NOW() - INTERVAL '35 days', 'DD/MM/YYYY') || '", "atividade": "Vistoria do ambiente", "observacoes": "UTI e setores de enfermagem"}, {"data": "' || TO_CHAR(NOW() - INTERVAL '30 days', 'DD/MM/YYYY') || '", "atividade": "Análise de protocolos", "observacoes": "Revisão de procedimentos de biossegurança"}]',
        '[{"documento": "PPRA Hospitalar", "tipo": "Programa", "relevancia": "Alto"}, {"documento": "PCMSO", "tipo": "Programa", "relevancia": "Alto"}, {"documento": "Protocolos de Biossegurança", "tipo": "Procedimento", "relevancia": "Alto"}]',
        '[{"nome": "Dra. Ana Paula", "cargo": "Diretora Técnica", "empresa": "Hospital São Lucas"}, {"nome": "Enfª. Carla", "cargo": "Supervisora de Enfermagem", "empresa": "Hospital São Lucas"}]',
        NOW() - INTERVAL '45 days',
        NOW() - INTERVAL '20 days'
    ),
    (
        gen_random_uuid(), perito2_user_id,
        '0009876-54.2024.5.03.0001',
        'Roberto Machado',
        'Construções XYZ Ltda.',
        '1ª Vara do Trabalho de Belo Horizonte',
        'active',
        NOW() + INTERVAL '14 days',
        'Rua dos Construtores, 500 - Industrial, Belo Horizonte - MG',
        '08:00',
        'Avaliação de riscos em obra de construção civil',
        240,
        45,
        'scheduled_pending',
        20000.00,
        'pending',
        0.00,
        NULL,
        'Aguardando primeira parcela',
        CURRENT_DATE + INTERVAL '15 days',
        4000.00,
        'Avaliar condições de segurança e exposição a agentes de risco em obra de construção civil',
        'Reclamante trabalhou como pedreiro por 3 anos, alegando exposição a poeira de sílica, ruído de equipamentos e risco de acidentes.',
        'Empresa alega cumprimento de todas as normas de segurança, fornecimento de EPIs e treinamentos regulares.',
        'Avaliação baseada na NR-18, NR-15 e NR-16. Medições de ruído, poeira respirável e análise de riscos de acidentes.',
        'Construção de edifício residencial, atividades de alvenaria, concretagem e acabamento.',
        'Em elaboração - aguardando vistoria.',
        'Aguardando medições.',
        'Em elaboração - aguardando vistoria.',
        'Aguardando análise.',
        'Aguardando medições.',
        'Aguardando definição.',
        'Laudo em elaboração.',
        '{"cidade": "Belo Horizonte", "data": "' || TO_CHAR(NOW(), 'DD/MM/YYYY') || '", "perito": "Dr. Roberto Lima", "crea": "MG-987654", "titulo": "Engenheiro de Segurança do Trabalho"}',
        '{"numero_processo": "0009876-54.2024.5.03.0001", "vara": "1ª Vara do Trabalho de Belo Horizonte", "reclamante": "Roberto Machado", "reclamada": "Construções XYZ Ltda."}',
        '{"nome": "Roberto Machado", "cpf": "456.789.123-00", "cargo": "Pedreiro", "periodo": "01/2021 a 06/2024", "salario": "R$ 2.200,00", "endereco": "Rua das Pedras, 321 - Barreiro, Belo Horizonte - MG"}',
        '{"razao_social": "Construções XYZ Ltda.", "cnpj": "45.678.912/0001-30", "endereco": "Rua dos Construtores, 500 - Industrial, Belo Horizonte - MG", "atividade": "Construção de edifícios", "representante": "Eng. Paulo Santos - Responsável Técnico"}',
        '{"area_total": "5.000 m²", "pe_direito": "Variável", "construcao": "Concreto armado", "ventilacao": "Natural", "iluminacao": "Natural", "temperatura": "Ambiente", "umidade": "Variável"}',
        '[{"tipo": "Capacete de segurança", "ca": "99999", "uso": "Obrigatório", "estado": "Novo"}, {"tipo": "Botina de segurança", "ca": "88888", "uso": "Obrigatório", "estado": "Adequado"}, {"tipo": "Cinto de segurança", "ca": "77777", "uso": "Trabalho em altura", "estado": "Adequado"}]',
        '[{"data": "' || TO_CHAR(NOW() + INTERVAL '14 days', 'DD/MM/YYYY') || '", "atividade": "Vistoria programada", "observacoes": "Avaliação completa da obra"}]',
        '[{"documento": "PCMAT", "tipo": "Programa", "relevancia": "Alto"}, {"documento": "Projeto de segurança", "tipo": "Projeto", "relevancia": "Alto"}]',
        '[{"nome": "Eng. Paulo Santos", "cargo": "Responsável Técnico", "empresa": "Construções XYZ"}, {"nome": "José Mestre", "cargo": "Mestre de Obras", "empresa": "Construções XYZ"}]',
        NOW() - INTERVAL '5 days',
        NOW()
    );

-- =====================================================
-- 3. SAMPLE RISK AGENTS
-- =====================================================

    -- Insert risk agents for the processes
    INSERT INTO public.risk_agents (
        process_id, agent_type, agent_name, description, exposure_level,
        measurement_method, measurement_value, measurement_unit,
        tolerance_limit, tolerance_unit, risk_level, insalubrity_degree,
        periculosity_applicable, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'chemical',
        'Fumos Metálicos',
        'Fumos de ferro, manganês e cromo provenientes da soldagem',
        'Acima do limite',
        'Gravimetria - NHO-08',
        2.5,
        'mg/m³',
        1.0,
        'mg/m³',
        'high',
        'medium',
        false,
        'Medição realizada na zona respiratória do trabalhador durante soldagem',
        NOW() - INTERVAL '10 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.risk_agents (
        process_id, agent_type, agent_name, description, exposure_level,
        measurement_method, measurement_value, measurement_unit,
        tolerance_limit, tolerance_unit, risk_level, insalubrity_degree,
        periculosity_applicable, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'physical',
        'Ruído Contínuo',
        'Ruído gerado por equipamentos industriais e processo de soldagem',
        'Dentro do limite',
        'Audiodosimetria - NHO-01',
        88.0,
        'dB(A)',
        85.0,
        'dB(A)',
        'medium',
        NULL,
        false,
        'Medição durante jornada completa de trabalho',
        NOW() - INTERVAL '10 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.risk_agents (
        process_id, agent_type, agent_name, description, exposure_level,
        measurement_method, measurement_value, measurement_unit,
        tolerance_limit, tolerance_unit, risk_level, insalubrity_degree,
        periculosity_applicable, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'accident',
        'Gases Inflamáveis',
        'Manuseio de acetileno e GLP para soldagem e corte',
        'Presente',
        'Análise qualitativa',
        NULL,
        NULL,
        NULL,
        NULL,
        'high',
        NULL,
        true,
        'Enquadramento no Anexo 2 da NR-16',
        NOW() - INTERVAL '10 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    -- Risk agents for hospital process
    INSERT INTO public.risk_agents (
        process_id, agent_type, agent_name, description, exposure_level,
        measurement_method, measurement_value, measurement_unit,
        tolerance_limit, tolerance_unit, risk_level, insalubrity_degree,
        periculosity_applicable, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'biological',
        'Agentes Biológicos Classe 3',
        'Vírus, bactérias e outros microrganismos patogênicos',
        'Presente',
        'Análise qualitativa - NR-32',
        NULL,
        NULL,
        NULL,
        NULL,
        'high',
        'medium',
        false,
        'Exposição confirmada em ambiente de UTI',
        NOW() - INTERVAL '40 days',
        NOW() - INTERVAL '20 days'
    FROM public.processes p 
    WHERE p.process_number = '0005678-90.2024.5.02.0002'
    LIMIT 1;

-- =====================================================
-- 4. SAMPLE QUESTIONNAIRES
-- =====================================================

    -- Insert sample questionnaires
    INSERT INTO public.questionnaires (
        process_id, party, question_number, question, answer, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'judge',
        1,
        'O reclamante estava exposto habitualmente a agentes insalubres durante sua jornada de trabalho?',
        'Sim. Conforme medições realizadas, o reclamante estava exposto a fumos metálicos acima dos limites de tolerância estabelecidos pela NR-15, caracterizando insalubridade em grau médio.',
        'Resposta baseada em medições quantitativas',
        NOW() - INTERVAL '8 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.questionnaires (
        process_id, party, question_number, question, answer, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'judge',
        2,
        'A atividade exercida pelo reclamante se enquadra nas hipóteses de periculosidade previstas na NR-16?',
        'Sim. A atividade de soldagem com manuseio habitual de gases inflamáveis (acetileno e GLP) se enquadra no Anexo 2 da NR-16, caracterizando periculosidade.',
        'Enquadramento legal confirmado',
        NOW() - INTERVAL '8 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.questionnaires (
        process_id, party, question_number, question, answer, notes, created_at, updated_at
    )
    SELECT 
        p.id,
        'claimant',
        1,
        'Quais EPIs eram fornecidos pela empresa e qual era a frequência de troca?',
        'A empresa fornecia máscara PFF2, óculos de segurança e luvas de couro. A troca das máscaras era semanal, dos óculos quando danificados, e das luvas mensalmente.',
        'Informação do reclamante',
        NOW() - INTERVAL '12 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

-- =====================================================
-- 5. SAMPLE DOCUMENTS
-- =====================================================

    -- Insert sample document metadata
    INSERT INTO public.documents (
        process_id, name, description, file_path, file_size, file_type,
        category, is_confidential, uploaded_by, created_at, updated_at
    )
    SELECT 
        p.id,
        'PPRA_Metalurgica_ABC_2024.pdf',
        'Programa de Prevenção de Riscos Ambientais da empresa reclamada',
        'process-documents/' || p.user_id::text || '/PPRA_Metalurgica_ABC_2024.pdf',
        2048576,
        'application/pdf',
        'evidence',
        false,
        p.user_id,
        NOW() - INTERVAL '15 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.documents (
        process_id, name, description, file_path, file_size, file_type,
        category, is_confidential, uploaded_by, created_at, updated_at
    )
    SELECT 
        p.id,
        'Medicoes_Ruido_Soldagem.pdf',
        'Relatório de medições de ruído no setor de soldagem',
        'process-documents/' || p.user_id::text || '/Medicoes_Ruido_Soldagem.pdf',
        1536000,
        'application/pdf',
        'measurement',
        false,
        p.user_id,
        NOW() - INTERVAL '10 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.documents (
        process_id, name, description, file_path, file_size, file_type,
        category, is_confidential, uploaded_by, created_at, updated_at
    )
    SELECT 
        p.id,
        'Fotos_Ambiente_Trabalho.zip',
        'Fotografias do ambiente de trabalho e atividades do reclamante',
        'process-documents/' || p.user_id::text || '/Fotos_Ambiente_Trabalho.zip',
        5242880,
        'application/zip',
        'photo',
        false,
        p.user_id,
        NOW() - INTERVAL '8 days',
        NOW()
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

-- =====================================================
-- 6. SAMPLE REPORTS
-- =====================================================

    -- Insert sample reports
    INSERT INTO public.reports (
        process_id, report_type, title, content, status, version,
        file_path, file_size, file_type, generated_at, created_at, updated_at
    )
    SELECT 
        p.id,
        'preliminary',
        'Laudo Pericial Preliminar - Processo ' || p.process_number,
        'Laudo pericial preliminar elaborado após vistoria inicial. Identificados agentes de risco que serão objeto de medições quantitativas.',
        'approved',
        1,
        'reports/' || p.user_id::text || '/laudo_preliminar_' || p.id::text || '.pdf',
        3072000,
        'application/pdf',
        NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '5 days'
    FROM public.processes p 
    WHERE p.process_number = '0001234-56.2024.5.02.0001'
    LIMIT 1;

    INSERT INTO public.reports (
        process_id, report_type, title, content, status, version,
        file_path, file_size, file_type, generated_at, delivered_at, created_at, updated_at
    )
    SELECT 
        p.id,
        'final',
        'Laudo Pericial Definitivo - Processo ' || p.process_number,
        'Laudo pericial definitivo com conclusões sobre insalubridade e periculosidade baseado em medições quantitativas e análise técnica.',
        'delivered',
        1,
        'reports/' || p.user_id::text || '/laudo_final_' || p.id::text || '.pdf',
        4608000,
        'application/pdf',
        NOW() - INTERVAL '25 days',
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '45 days',
        NOW() - INTERVAL '20 days'
    FROM public.processes p 
    WHERE p.process_number = '0005678-90.2024.5.02.0002'
    LIMIT 1;

END $$;

-- =====================================================
-- 7. ADDITIONAL SAMPLE DATA FOR SYSTEM CONFIGURATION
-- =====================================================

-- Create a view for common risk agents (for dropdowns and suggestions)
CREATE OR REPLACE VIEW public.common_risk_agents AS
SELECT DISTINCT 
    agent_type,
    agent_name,
    COUNT(*) as usage_count
FROM public.risk_agents 
GROUP BY agent_type, agent_name
ORDER BY agent_type, usage_count DESC;

-- Create a view for process statistics
CREATE OR REPLACE VIEW public.process_statistics AS
SELECT 
    COUNT(*) as total_processes,
    COUNT(*) FILTER (WHERE status = 'active') as active_processes,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_processes,
    COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_payments,
    COUNT(*) FILTER (WHERE payment_status = 'overdue') as overdue_payments,
    COALESCE(SUM(payment_amount), 0) as total_payments_received,
    COALESCE(SUM(determined_value), 0) as total_determined_value,
    COALESCE(AVG(expert_fee), 0) as average_expert_fee
FROM public.processes;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.common_risk_agents IS 'View com agentes de risco mais comuns para sugestões no sistema';
COMMENT ON TABLE public.process_statistics IS 'View com estatísticas gerais dos processos para dashboard';

-- =====================================================
-- END OF COMPREHENSIVE SEEDERS
-- =====================================================