-- Seed data for the Pericia Automata system
-- This file contains sample data for testing and development

-- Clear existing data (in order due to foreign key constraints)
DELETE FROM risk_agents;
DELETE FROM questionnaires;
DELETE FROM reports;
DELETE FROM documents;
DELETE FROM processes;
DELETE FROM profiles;

-- Insert sample profiles
INSERT INTO profiles (id, full_name, avatar_url) VALUES
('11111111-1111-1111-1111-111111111111', 'Dr. João Silva - Administrador', NULL),
('22222222-2222-2222-2222-222222222222', 'Dra. Maria Santos - Perita Judicial', NULL),
('33333333-3333-3333-3333-333333333333', 'Carlos Oliveira - Advogado', NULL);

-- Insert sample processes
INSERT INTO processes (
    id,
    user_id,
    process_number,
    claimant_name,
    defendant_name,
    court,
    status,
    inspection_date,
    inspection_address,
    inspection_time,
    inspection_notes,
    inspection_duration_minutes,
    inspection_reminder_minutes,
    inspection_status,
    determined_value,
    payment_status,
    payment_amount,
    payment_date,
    payment_notes,
    payment_due_date,
    expert_fee,
    objective,
    initial_data,
    defense_data,
    methodology,
    activities_description,
    epcs,
    collective_protection,
    insalubrity_analysis,
    insalubrity_results,
    periculosity_analysis,
    periculosity_concept,
    periculosity_results,
    flammable_definition,
    conclusion
) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    '0001234-56.2024.5.02.0001',
    'José da Silva',
    'Metalúrgica ABC Ltda.',
    '1ª Vara do Trabalho de São Paulo',
    'active',
    CURRENT_DATE + INTERVAL '7 days',
    'Rua Industrial, 123 - Distrito Industrial, São Paulo - SP',
    '14:00',
    'Inspeção para avaliação de agentes de risco no setor de soldagem',
    120,
    30,
    'scheduled_confirmed',
    15000.00,
    'partial',
    7500.00,
    CURRENT_DATE - INTERVAL '10 days',
    'Primeira parcela paga via PIX',
    CURRENT_DATE + INTERVAL '30 days',
    3000.00,
    'Avaliar exposição a agentes físicos, químicos e de acidentes no ambiente de trabalho do reclamante',
    'Reclamante trabalhou como soldador na empresa reclamada por 8 anos, alegando exposição a fumos metálicos, ruído excessivo e calor.',
    'Empresa nega exposição habitual e permanente aos agentes alegados, informando uso de EPIs adequados.',
    'Metodologia baseada na NHO-01 para ruído, NHO-08 para fumos metálicos e NR-16 para periculosidade.',
    'Soldagem de estruturas metálicas em ambiente industrial, com uso de eletrodo revestido e MIG/MAG.',
    'Capacete de soldador, luvas de raspa, avental de raspa, botina de segurança',
    'Exaustor localizado no posto de soldagem, ventilação geral diluidora',
    'Identificados fumos metálicos (ferro, manganês, cromo) acima dos limites de tolerância da NR-15.',
    'Caracterizada insalubridade em grau médio (20%) pela exposição a fumos metálicos.',
    'Identificado manuseio de gases inflamáveis (acetileno, GLP) em área de risco.',
    'Atividade enquadrada no Anexo 2 da NR-16 - manuseio de inflamáveis líquidos e gasosos.',
    'Caracterizada periculosidade (30%) pelo manuseio habitual de gases inflamáveis.',
    'Gases inflamáveis são substâncias que se inflamam facilmente em contato com fontes de ignição.',
    'Caracterizada insalubridade em grau médio e periculosidade. Recomenda-se melhoria nos sistemas de ventilação.'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    '0005678-90.2024.5.02.0002',
    'Maria Fernanda Costa',
    'Hospital São Lucas S.A.',
    '2ª Vara do Trabalho de São Paulo',
    'completed',
    CURRENT_DATE - INTERVAL '30 days',
    'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    '09:00',
    'Avaliação de agentes biológicos e químicos em ambiente hospitalar',
    180,
    60,
    'completed',
    12000.00,
    'paid',
    12000.00,
    CURRENT_DATE - INTERVAL '5 days',
    'Pagamento integral realizado',
    CURRENT_DATE - INTERVAL '15 days',
    2500.00,
    'Avaliar exposição a agentes biológicos e químicos no setor de enfermagem',
    'Reclamante trabalhou como enfermeira por 5 anos, alegando exposição a materiais biológicos contaminados.',
    'Hospital contesta alegações, informando protocolos rigorosos de biossegurança.',
    'Avaliação qualitativa baseada na NR-32 e quantitativa para agentes químicos conforme NR-15.',
    'Assistência de enfermagem em UTI, manuseio de materiais perfurocortantes.',
    'Luvas de procedimento, máscara cirúrgica, óculos de proteção, jaleco',
    'Cabine de segurança biológica, sistema de ventilação com filtros HEPA',
    'Confirmada exposição a agentes biológicos classe 3.',
    'Caracterizada insalubridade em grau médio (20%) por agentes biológicos.',
    'Não identificados agentes de periculosidade conforme NR-16.',
    'Não aplicável.',
    'Não caracterizada periculosidade.',
    'Não aplicável.',
    'Caracterizada insalubridade em grau médio por exposição a agentes biológicos.'
);

-- Insert sample risk agents
INSERT INTO risk_agents (
    id,
    process_id,
    agent_type,
    agent_name,
    description,
    exposure_level,
    measurement_method,
    measurement_value,
    measurement_unit,
    tolerance_limit,
    tolerance_unit,
    risk_level,
    insalubrity_degree,
    periculosity_applicable,
    notes
) VALUES
-- Risk agents for first process (Metalúrgica)
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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
    'Medição realizada na zona respiratória do trabalhador durante soldagem'
),
(
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'physical',
    'Ruído Contínuo',
    'Ruído gerado por equipamentos industriais e processo de soldagem',
    'Acima do limite',
    'Audiodosimetria - NHO-01',
    88.5,
    'dB(A)',
    85.0,
    'dB(A)',
    'medium',
    'medium',
    false,
    'Medição durante jornada completa de trabalho'
),
(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'accident',
    'Gases Inflamáveis',
    'Acetileno e GLP utilizados no processo de soldagem',
    'Presente',
    'Avaliação qualitativa',
    NULL,
    NULL,
    NULL,
    NULL,
    'high',
    NULL,
    true,
    'Manuseio habitual de gases inflamáveis conforme NR-16'
),
-- Risk agents for second process (Hospital)
(
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
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
    'Exposição confirmada em ambiente de UTI'
),
(
    'gggggggg-gggg-gggg-gggg-gggggggggggg',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'chemical',
    'Formaldeído',
    'Vapores de formaldeído em laboratório de anatomia patológica',
    'Dentro do limite',
    'Cromatografia gasosa',
    0.8,
    'ppm',
    1.6,
    'ppm',
    'low',
    NULL,
    false,
    'Medição pontual em laboratório'
);

-- Insert sample questionnaires
INSERT INTO questionnaires (
    id,
    process_id,
    user_id,
    title,
    description,
    questions,
    responses,
    status
) VALUES
(
    'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Questionário de Exposição Ocupacional - Soldagem',
    'Avaliação detalhada da exposição a agentes de risco no processo de soldagem',
    '[
        {
            "id": 1,
            "question": "Qual o tempo de exposição diária aos fumos de soldagem?",
            "type": "multiple_choice",
            "options": ["Menos de 2h", "2-4h", "4-6h", "Mais de 6h"]
        },
        {
            "id": 2,
            "question": "Quais EPIs são utilizados durante a soldagem?",
            "type": "checkbox",
            "options": ["Máscara de soldador", "Luvas de raspa", "Avental", "Respirador"]
        },
        {
            "id": 3,
            "question": "Descreva o sistema de ventilação do local",
            "type": "text"
        }
    ]'::jsonb,
    '[
        {
            "question_id": 1,
            "answer": "Mais de 6h"
        },
        {
            "question_id": 2,
            "answer": ["Máscara de soldador", "Luvas de raspa", "Avental"]
        },
        {
            "question_id": 3,
            "answer": "Ventilação natural insuficiente, sem exaustão localizada"
        }
    ]'::jsonb,
    'completed'
);

-- Insert sample documents
INSERT INTO documents (
    id,
    process_id,
    user_id,
    name,
    type,
    file_path,
    file_size,
    mime_type,
    description,
    tags
) VALUES
(
    'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Laudo Técnico - Soldagem.pdf',
    'report',
    '/documents/laudos/laudo_soldagem_001.pdf',
    2048576,
    'application/pdf',
    'Laudo técnico pericial sobre exposição a agentes de risco na soldagem',
    '["laudo", "soldagem", "insalubridade", "periculosidade"]'::jsonb
),
(
    'jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Relatório Biossegurança.pdf',
    'report',
    '/documents/laudos/relatorio_biosseguranca_002.pdf',
    1536000,
    'application/pdf',
    'Relatório de avaliação de biossegurança em ambiente hospitalar',
    '["biossegurança", "hospital", "agentes biológicos"]'::jsonb
);

-- Insert sample reports
INSERT INTO reports (
    id,
    process_id,
    user_id,
    title,
    content,
    report_type,
    status,
    generated_at
) VALUES
(
    'kkkkkkkk-kkkk-kkkk-kkkk-kkkkkkkkkkkk',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Laudo Pericial - Processo 0001234-56.2024.5.02.0001',
    'LAUDO TÉCNICO PERICIAL

PROCESSO: 0001234-56.2024.5.02.0001
RECLAMANTE: José da Silva
RECLAMADA: Metalúrgica ABC Ltda.

1. OBJETIVO
Avaliar exposição a agentes físicos, químicos e de acidentes no ambiente de trabalho do reclamante.

2. METODOLOGIA
Metodologia baseada na NHO-01 para ruído, NHO-08 para fumos metálicos e NR-16 para periculosidade.

3. CONCLUSÃO
Caracterizada insalubridade em grau médio e periculosidade. Recomenda-se melhoria nos sistemas de ventilação.',
    'technical_report',
    'completed',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
);

-- Create views for common queries
CREATE OR REPLACE VIEW common_risk_agents AS
SELECT 
    agent_name,
    agent_type,
    COUNT(*) as frequency,
    AVG(CASE WHEN measurement_value IS NOT NULL THEN measurement_value END) as avg_measurement,
    measurement_unit
FROM risk_agents 
GROUP BY agent_name, agent_type, measurement_unit
ORDER BY frequency DESC;

CREATE OR REPLACE VIEW process_statistics AS
SELECT 
    status,
    COUNT(*) as total_processes,
    AVG(determined_value) as avg_determined_value,
    AVG(expert_fee) as avg_expert_fee
FROM processes 
GROUP BY status;

-- Insert some additional test data for better coverage
INSERT INTO profiles (id, full_name, avatar_url) VALUES
('44444444-4444-4444-4444-444444444444', 'Dr. Roberto Lima - Engenheiro de Segurança', NULL),
('55555555-5555-5555-5555-555555555555', 'Ana Costa - Consultora Jurídica', NULL);

-- Success message
SELECT 'Seed data inserted successfully!' as message;