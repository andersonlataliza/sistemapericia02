// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface Database {
  public: {
    Tables: {
      processes: {
        Row: {
          id: string;
          process_number: string;
          claimant_name: string;
          defendant_name: string;
          court: string | null;
          inspection_date: string | null;
          inspection_address: string | null;
          inspection_city: string | null;
          inspection_time: string | null;
          objective: string | null;
          methodology: string | null;
          activities_description: string | null;
          workplace_characteristics: any;
          collective_protection: string | null;
          epcs: string | null;
          epis: any;
          insalubrity_analysis: string | null;
          insalubrity_results: string | null;
          periculosity_analysis: string | null;
          periculosity_results: string | null;
          periculosity_concept: string | null;
          flammable_definition: string | null;
          conclusion: string | null;
          cover_data: any;
          identifications: any;
          claimant_data: any;
          defendant_data: any;
          initial_data: string | null;
          defense_data: string | null;
          diligence_data: any;
          documents_presented: any;
          attendees: any;
          report_config: any;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          professional_title: string | null;
          registration_number: string | null;
        };
      };
      risk_agents: {
        Row: {
          id: string;
          process_id: string;
          agent_type: string;
          agent_name: string;
          description: string | null;
          exposure_level: string | null;
          measurement_method: string | null;
          measurement_value: number | null;
          measurement_unit: string | null;
          tolerance_limit: number | null;
          tolerance_unit: string | null;
          risk_level: string | null;
          insalubrity_degree: string | null;
          periculosity_applicable: boolean | null;
          notes: string | null;
          evidence_photos: any;
          created_at: string;
          updated_at: string;
        };
      };
      questionnaires: {
        Row: {
          id: string;
          process_id: string;
          party: string;
          question_number: number;
          question: string;
          answer: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reports: {
        Row: {
          id: string;
          process_id: string;
          report_content: string | null;
          conclusion: string | null;
          insalubrity_grade: string | null;
          periculosity_identified: boolean | null;
          generated_at: string;
        };
        Insert: {
          process_id: string;
          report_content?: string | null;
          conclusion?: string | null;
          insalubrity_grade?: string | null;
          periculosity_identified?: boolean | null;
        };
      };
    };
  };
}

interface ReportRequest {
  processId: string;
  reportType: 'insalubridade' | 'periculosidade' | 'completo';
  testMode?: boolean;
}

// Utility functions for data formatting
function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => 
        typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)
      ).join('\n');
    }
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n');
  }
  return String(value);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

function formatTime(timeString: string | null): string {
  if (!timeString) return '';
  try {
    // Handle both HH:MM and HH:MM:SS formats
    const timeParts = timeString.split(':');
    if (timeParts.length >= 2) {
      return `${timeParts[0]}:${timeParts[1]}`;
    }
    return timeString;
  } catch {
    return timeString;
  }
}

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    console.log('🚀 Iniciando geração de relatório');
    
    // Parse request
    const body = await req.json();
    const { processId, reportType, testMode }: ReportRequest = body;
    
    console.log('📋 Parâmetros:', { processId, reportType, testMode });

    if (!processId) {
      throw new Error('processId é obrigatório');
    }

    if (!reportType || !['insalubridade', 'periculosidade', 'completo'].includes(reportType)) {
      throw new Error('reportType deve ser: insalubridade, periculosidade ou completo');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    const authHeader = req.headers.get('Authorization');
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Get user authentication
    let userId: string | null = null;
    if (!testMode && authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch (error) {
        console.log('⚠️ Erro de autenticação:', error);
      }
    }

    // Fetch process data with comprehensive query
    console.log('🔍 Buscando dados do processo...');
    let processData;
    
    if (testMode) {
      // Mock data for testing
      processData = {
        id: processId,
        process_number: '0001234-56.2024.5.02.0001',
        claimant_name: 'João da Silva Santos',
        defendant_name: 'Empresa Industrial LTDA',
        court: '1ª Vara do Trabalho de São Paulo',
        inspection_date: '2024-01-15',
        inspection_address: 'Rua das Indústrias, 123',
        inspection_city: 'São Paulo',
        inspection_time: '14:00',
        objective: 'Avaliar as condições de trabalho e identificar agentes de risco.',
        methodology: 'Vistoria técnica conforme normas regulamentadoras.',
        activities_description: 'Operação de máquinas industriais.',
        workplace_characteristics: {
          area: '500m²',
          ventilation: 'Natural',
          lighting: 'Artificial'
        },
        collective_protection: 'Exaustores e ventiladores industriais.',
        epcs: 'Sistema de ventilação local exaustora.',
        epis: [
          { name: 'Protetor auricular', ca: '12345', provided: true },
          { name: 'Máscara respiratória', ca: '67890', provided: true }
        ],
        insalubrity_analysis: 'Análise detalhada dos agentes insalubres.',
        insalubrity_results: 'Constatada insalubridade grau médio.',
        periculosity_analysis: 'Análise dos agentes periculosos.',
        periculosity_results: 'Não constatada periculosidade.',
        periculosity_concept: 'Conceito técnico de periculosidade conforme NR-16.',
        flammable_definition: 'Definição de materiais inflamáveis conforme normas.',
        conclusion: 'Conclusão técnica do laudo pericial.',
        cover_data: {
          peritoName: 'Dr. João Perito',
          professionalTitle: 'Engenheiro de Segurança',
          registrationNumber: 'CREA 123456'
        },
        identifications: {
          processNumber: '0001234-56.2024.5.02.0001',
          claimantName: 'João da Silva Santos',
          defendantName: 'Empresa Industrial LTDA',
          court: '1ª Vara do Trabalho de São Paulo'
        },
        claimant_data: {
          name: 'João da Silva Santos',
          positions: ['Operador de máquinas', 'Auxiliar de produção']
        },
        defendant_data: {
          name: 'Empresa Industrial LTDA',
          cnpj: '12.345.678/0001-90',
          address: 'Rua das Indústrias, 123'
        },
        initial_data: 'Dados da petição inicial do processo.',
        defense_data: 'Dados da contestação da reclamada.',
        diligence_data: [
          {
            date: '2024-01-15',
            location: 'Rua das Indústrias, 123',
            city: 'São Paulo',
            time: '14:00'
          }
        ],
        documents_presented: [
          'PPRA da empresa',
          'PCMSO atualizado',
          'Certificados de EPIs'
        ],
        attendees: [
          'João da Silva Santos - Reclamante',
          'Maria Santos - Representante da empresa'
        ],
        report_config: {
          header: {
            peritoName: 'Dr. João Perito',
            professionalTitle: 'Engenheiro de Segurança',
            registrationNumber: 'CREA 123456'
          },
          footer: {
            contactEmail: 'joao.perito@email.com',
            showPageNumbers: true
          }
        },
        user_id: 'test-user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
      };
    } else {
      // Real database query
      let query = supabase
        .from('processes')
        .select(`
          id,
          process_number,
          claimant_name,
          defendant_name,
          court,
          inspection_date,
          inspection_address,
          inspection_city,
          inspection_time,
          objective,
          methodology,
          activities_description,
          workplace_characteristics,
          collective_protection,
          epcs,
          epis,
          insalubrity_analysis,
          insalubrity_results,
          periculosity_analysis,
          periculosity_results,
          periculosity_concept,
          flammable_definition,
          conclusion,
          cover_data,
          identifications,
          claimant_data,
          defendant_data,
          initial_data,
          defense_data,
          diligence_data,
          documents_presented,
          attendees,
          report_config,
          user_id,
          created_at,
          updated_at
        `)
        .eq('id', processId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error('❌ Erro na query:', error);
        throw new Error(`Erro ao buscar processo: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Processo não encontrado: ${processId}`);
      }

      processData = data;
    }

    console.log('✅ Dados do processo carregados');

    // Fetch expert profile
    let profile = null;
    if (userId && !testMode) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        profile = profileData;
      } catch (error) {
        console.log('⚠️ Erro ao buscar perfil:', error);
      }
    }

    // Default profile
    if (!profile) {
      profile = {
        id: 'default',
        full_name: processData.cover_data?.peritoName || 'Perito Responsável',
        professional_title: processData.cover_data?.professionalTitle || 'Engenheiro de Segurança do Trabalho',
        registration_number: processData.cover_data?.registrationNumber || 'CREA 000000'
      };
    }

    // Fetch risk agents
    let riskAgents = [];
    if (!testMode) {
      try {
        const { data } = await supabase
          .from('risk_agents')
          .select('*')
          .eq('process_id', processId);
        riskAgents = data || [];
      } catch (error) {
        console.log('⚠️ Erro ao buscar agentes de risco:', error);
      }
    } else {
      // Mock risk agents
      riskAgents = [
        {
          id: 'test-1',
          process_id: processId,
          agent_type: 'Físico',
          agent_name: 'Ruído',
          description: 'Ruído contínuo de máquinas',
          measurement_value: 88,
          measurement_unit: 'dB(A)',
          tolerance_limit: 85,
          tolerance_unit: 'dB(A)',
          exposure_level: 'Acima do limite',
          risk_level: 'Médio',
          insalubrity_degree: 'médio',
          periculosity_applicable: false,
          notes: 'Conforme NR-15'
        }
      ];
    }

    // Fetch questionnaires
    let questionnaires = [];
    if (!testMode) {
      try {
        const { data } = await supabase
          .from('questionnaires')
          .select('*')
          .eq('process_id', processId)
          .order('party', { ascending: true })
          .order('question_number', { ascending: true });
        questionnaires = data || [];
      } catch (error) {
        console.log('⚠️ Erro ao buscar quesitos:', error);
      }
    } else {
      // Mock questionnaires
      questionnaires = [
        {
          id: 'test-q1',
          process_id: processId,
          party: 'claimant',
          question_number: 1,
          question: 'A reclamante trabalhou exposta a agentes nocivos?',
          answer: 'Sim, conforme vistoria técnica.',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];
    }

    console.log('📊 Dados coletados:', {
      riskAgents: riskAgents.length,
      questionnaires: questionnaires.length
    });

    // Generate report content
    let reportContent = '';

    // Header
    reportContent += `LAUDO PERICIAL TRABALHISTA\n\n`;

    // Basic process information
    reportContent += `IDENTIFICAÇÃO DO PROCESSO\n`;
    reportContent += `Processo: ${processData.process_number || 'Não informado'}\n`;
    reportContent += `Requerente: ${processData.claimant_name || 'Não informado'}\n`;
    reportContent += `Requerido: ${processData.defendant_name || 'Não informado'}\n`;
    if (processData.court) reportContent += `Vara: ${processData.court}\n`;
    reportContent += `\n`;

    // Expert identification
    reportContent += `IDENTIFICAÇÃO DO PERITO\n`;
    reportContent += `Nome: ${profile.full_name}\n`;
    if (profile.professional_title) reportContent += `Título: ${profile.professional_title}\n`;
    if (profile.registration_number) reportContent += `Registro: ${profile.registration_number}\n`;
    reportContent += `\n`;

    // 1. IDENTIFICAÇÕES
    if (processData.identifications) {
      reportContent += `1. IDENTIFICAÇÕES\n`;
      const identifications = processData.identifications;
      if (typeof identifications === 'object' && identifications !== null) {
        Object.entries(identifications).forEach(([key, value]) => {
          if (value) reportContent += `${key}: ${value}\n`;
        });
      } else if (identifications) {
        reportContent += `${identifications}\n`;
      }
      reportContent += `\n`;
    }

    // 2. DADOS DA RECLAMANTE
    reportContent += `2. DADOS DA RECLAMANTE\n`;
    const claimantData = processData.claimant_data;
    if (typeof claimantData === 'object' && claimantData !== null) {
      if (claimantData.name) reportContent += `Nome: ${claimantData.name}\n`;
      if (claimantData.positions && Array.isArray(claimantData.positions)) {
        reportContent += `Cargos exercidos:\n`;
        claimantData.positions.forEach((position: any, index: number) => {
          if (position && typeof position === 'object') {
            const title = position.title ? String(position.title) : '';
            const period = position.period ? String(position.period) : '';
            const obs = position.obs ? String(position.obs) : '';
            const parts: string[] = [];
            if (title) parts.push(`Função: ${title}`);
            if (period) parts.push(`Período: ${period}`);
            if (obs) parts.push(`Obs: ${obs}`);
            reportContent += `${index + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(position)}\n`;
          } else {
            reportContent += `${index + 1}. ${position}\n`;
          }
        });
      }
      // Add other claimant data fields
      Object.entries(claimantData).forEach(([key, value]) => {
        if (key !== 'name' && key !== 'positions' && value) {
          reportContent += `${key}: ${value}\n`;
        }
      });
    } else if (claimantData) {
      reportContent += `${claimantData}\n`;
    } else {
      reportContent += `Não informado\n`;
    }
    reportContent += `\n`;

    // 3. DADOS DA RECLAMADA
    reportContent += `3. DADOS DA RECLAMADA\n`;
    reportContent += `${formatValue(processData.defendant_data) || 'Não informado'}\n\n`;

    // 4. OBJETIVO
    reportContent += `4. OBJETIVO\n`;
    reportContent += `${processData.objective || 'Não informado'}\n\n`;

    // 5. DADOS DA INICIAL
    reportContent += `5. DADOS DA INICIAL\n`;
    reportContent += `${processData.initial_data || 'Não informado'}\n\n`;

    // 6. DADOS DA CONTESTAÇÃO DA RECLAMADA
    reportContent += `6. DADOS DA CONTESTAÇÃO DA RECLAMADA\n`;
    reportContent += `${processData.defense_data || 'Não informado'}\n\n`;

    // 7. DILIGÊNCIAS / VISTORIAS
    if (processData.diligence_data || processData.inspection_date) {
      reportContent += `7. DILIGÊNCIAS / VISTORIAS\n`;
      
      if (processData.diligence_data && Array.isArray(processData.diligence_data)) {
        processData.diligence_data.forEach((diligence: any, index: number) => {
          reportContent += `Vistoria ${index + 1}:\n`;
          if (diligence.date) reportContent += `Data: ${formatDate(diligence.date)}\n`;
          if (diligence.location) reportContent += `Local: ${diligence.location}\n`;
          if (diligence.city) reportContent += `Cidade: ${diligence.city}\n`;
          if (diligence.time) reportContent += `Horário: ${formatTime(diligence.time)}\n`;
          if (diligence.description) reportContent += `Descrição: ${diligence.description}\n`;
          reportContent += `\n`;
        });
      } else {
        // Fallback to inspection data from process
        if (processData.inspection_date) reportContent += `Data: ${formatDate(processData.inspection_date)}\n`;
        if (processData.inspection_address) reportContent += `Local: ${processData.inspection_address}\n`;
        if (processData.inspection_city) reportContent += `Cidade: ${processData.inspection_city}\n`;
        if (processData.inspection_time) reportContent += `Horário: ${formatTime(processData.inspection_time)}\n`;
      }
      reportContent += `\n`;
    }

    // 8. ACOMPANHANTES / ENTREVISTADOS
    if (processData.attendees) {
      reportContent += `8. ACOMPANHANTES / ENTREVISTADOS\n`;
      if (Array.isArray(processData.attendees)) {
        processData.attendees.forEach((attendee: any, index: number) => {
          if (attendee && typeof attendee === 'object') {
            const parts: string[] = [];
            if (attendee.name) parts.push(`Nome: ${attendee.name}`);
            if (attendee.function) parts.push(`Função: ${attendee.function}`);
            if (attendee.company) parts.push(`Empresa: ${attendee.company}`);
            if (attendee.obs) parts.push(`Obs: ${attendee.obs}`);
            reportContent += `${index + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(attendee)}\n`;
          } else {
            reportContent += `${index + 1}. ${attendee}\n`;
          }
        });
      } else {
        reportContent += `${processData.attendees}\n`;
      }
      reportContent += `\n`;
    }

    // 9. METODOLOGIA
    reportContent += `9. METODOLOGIA\n`;
    reportContent += `${processData.methodology || 'Não informado'}\n\n`;

    // 10. DOCUMENTAÇÕES APRESENTADAS
    reportContent += `10. DOCUMENTAÇÕES APRESENTADAS\n`;
    if (processData.documents_presented) {
      if (Array.isArray(processData.documents_presented)) {
        processData.documents_presented.forEach((doc: any, index: number) => {
          if (doc && typeof doc === 'object') {
            const name = doc.name ? String(doc.name) : '';
            const presented = typeof doc.presented === 'boolean' ? (doc.presented ? 'Sim' : 'Não') : '';
            const obs = doc.obs ? String(doc.obs) : '';
            const parts: string[] = [];
            if (name) parts.push(name);
            if (presented) parts.push(`Apresentado: ${presented}`);
            if (obs) parts.push(`Obs: ${obs}`);
            reportContent += `${index + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(doc)}\n`;
          } else {
            reportContent += `${index + 1}. ${doc}\n`;
          }
        });
      } else {
        reportContent += `${processData.documents_presented}\n`;
      }
    } else {
      reportContent += `Não informado\n`;
    }
    reportContent += `\n`;

    // 11. CARACTERÍSTICAS DO LOCAL DE TRABALHO
    reportContent += `11. CARACTERÍSTICAS DO LOCAL DE TRABALHO\n`;
    reportContent += `${formatValue(processData.workplace_characteristics) || 'Não informado'}\n\n`;

    // 12. ATIVIDADES DA RECLAMANTE
    reportContent += `12. ATIVIDADES DA RECLAMANTE\n`;
    reportContent += `${processData.activities_description || 'Não informado'}\n\n`;

    // 13. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)
    reportContent += `13. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)\n`;
    // Introdução dedicada para EPIs
    {
      const introDefault = "Para função exercida pela Reclamante a empresa realizava a entrega dos seguintes equipamentos de proteção individual - E.P.I. (Art. 166 da CLT e NR-6, item 6.2 da Portaria nº 3214/78 do MTE):";
      const introText = String((processData as any).epi_intro || (processData as any).epi_introduction || introDefault).trim();
      if (introText) {
        reportContent += introText + `\n\n`;
      }
    }
    if (processData.epis) {
      if (Array.isArray(processData.epis)) {
        processData.epis.forEach((epi: any, index: number) => {
          const equipment = String(epi?.equipment ?? epi?.name ?? epi ?? '').trim();
          const protection = String(epi?.protection ?? epi?.desc ?? epi?.observation ?? '').trim();
          const ca = String(epi?.ca ?? '').trim();
          const parts: string[] = [];
          if (equipment) parts.push(`${index + 1}. ${equipment}`);
          if (ca) parts.push(`(CA: ${ca})`);
          if (protection) parts.push(`- Proteção: ${protection}`);
          reportContent += parts.join(' ') + `\n`;
        });
      } else {
        reportContent += `${processData.epis}\n`;
      }
    } else {
      reportContent += `Não informado\n`;
    }
    reportContent += `\n`;

    // 14. EQUIPAMENTOS DE PROTEÇÃO COLETIVA (EPCs)
    reportContent += `14. EQUIPAMENTOS DE PROTEÇÃO COLETIVA (EPCs)\n`;
    {
      const epcItems: string[] = [];
      const collectFrom = (txt?: string | null) => {
        const t = (txt || '').trim();
        if (!t) return;
        const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let inSelected = false;
        lines.forEach((l) => {
          if (/EPCs selecionados:/i.test(l)) { inSelected = true; return; }
          const m = l.match(/^[-•]\s*(.+)$/);
          if ((inSelected && m) || m) {
            epcItems.push(m[1].trim());
          }
        });
      };
      collectFrom(processData.epcs);
      collectFrom(processData.collective_protection);

      if (epcItems.length) {
        epcItems.forEach((item, i) => {
          reportContent += `${i + 1}. ${item}\n`;
        });
      } else {
        const single = (processData.epcs || processData.collective_protection || '').trim();
        reportContent += single ? `${single}\n` : `Não informado\n`;
      }
    }
    reportContent += `\n`;

    // 15. ANÁLISE DOS AGENTES DE RISCO
    if (processData.insalubrity_analysis || processData.periculosity_analysis || riskAgents.length > 0) {
      reportContent += `15. ANÁLISE DOS AGENTES DE RISCO\n`;
      
      if (processData.insalubrity_analysis) {
        reportContent += `Análise de Insalubridade:\n${processData.insalubrity_analysis}\n\n`;
      }
      
      if (processData.periculosity_analysis) {
        reportContent += `Análise de Periculosidade:\n${processData.periculosity_analysis}\n\n`;
      }

      if (riskAgents.length > 0) {
        reportContent += `Agentes de Risco Identificados:\n`;
        riskAgents.forEach((agent: any, index: number) => {
          reportContent += `${index + 1}. ${agent.agent_name} (${agent.agent_type})\n`;
          if (agent.description) reportContent += `   Descrição: ${agent.description}\n`;
          if (agent.measurement_value && agent.measurement_unit) {
            reportContent += `   Medição: ${agent.measurement_value} ${agent.measurement_unit}\n`;
          }
          if (agent.tolerance_limit && agent.tolerance_unit) {
            reportContent += `   Limite: ${agent.tolerance_limit} ${agent.tolerance_unit}\n`;
          }
          if (agent.risk_level) reportContent += `   Nível de Risco: ${agent.risk_level}\n`;
          if (agent.notes) reportContent += `   Observações: ${agent.notes}\n`;
          reportContent += `\n`;
        });
      }
      reportContent += `\n`;
    }

    // 16. RESULTADOS DAS AVALIAÇÕES DE INSALUBRIDADE
    reportContent += `16. RESULTADOS DAS AVALIAÇÕES DE INSALUBRIDADE\n`;
    reportContent += `${processData.insalubrity_results || 'Não informado'}\n\n`;

    // 17. CONCEITO DE PERICULOSIDADE
    reportContent += `17. CONCEITO DE PERICULOSIDADE\n`;
    reportContent += `${processData.periculosity_concept || 'Não informado'}\n\n`;

    // 18. DEFINIÇÃO DE MATERIAIS INFLAMÁVEIS
    reportContent += `18. DEFINIÇÃO DE MATERIAIS INFLAMÁVEIS\n`;
    reportContent += `${processData.flammable_definition || 'Não informado'}\n\n`;

    // 19. RESULTADOS DAS AVALIAÇÕES DE PERICULOSIDADE
    reportContent += `19. RESULTADOS DAS AVALIAÇÕES DE PERICULOSIDADE\n`;
    reportContent += `${processData.periculosity_results || 'Não informado'}\n\n`;

    // 20. QUESITOS DA PERÍCIA
    reportContent += `20. QUESITOS DA PERÍCIA\n`;
    if (questionnaires.length > 0) {
      const partiesByName = {
        'claimant': 'QUESITOS DA RECLAMANTE',
        'defendant': 'QUESITOS DA RECLAMADA',
        'judge': 'QUESITOS DO JUÍZO'
      };

      const groupedQuestionnaires = questionnaires.reduce((acc: any, q: any) => {
        if (!acc[q.party]) acc[q.party] = [];
        acc[q.party].push(q);
        return acc;
      }, {});

      Object.entries(groupedQuestionnaires).forEach(([party, questions]: [string, any]) => {
        reportContent += `\n${partiesByName[party as keyof typeof partiesByName] || party.toUpperCase()}:\n`;
        questions.forEach((q: any) => {
          reportContent += `${q.question_number}. ${q.question}\n`;
          if (q.answer) {
            reportContent += `Resposta: ${q.answer}\n`;
          }
          reportContent += `\n`;
        });
      });
    } else {
      reportContent += `Não informado\n`;
    }
    reportContent += `\n`;

    // 21. CONCLUSÃO
    reportContent += `21. CONCLUSÃO\n`;
    reportContent += `${processData.conclusion || 'Não informado'}\n\n`;

    // Generate conclusion and grades based on analysis
    let conclusion = processData.conclusion || '';
    let insalubrityGrade: string | null = null;
    let periculosityIdentified: boolean | null = null;

    // Extract grades from results if available
    if (processData.insalubrity_results) {
      if (processData.insalubrity_results.toLowerCase().includes('grau máximo')) {
        insalubrityGrade = 'máximo';
      } else if (processData.insalubrity_results.toLowerCase().includes('grau médio')) {
        insalubrityGrade = 'médio';
      } else if (processData.insalubrity_results.toLowerCase().includes('grau mínimo')) {
        insalubrityGrade = 'mínimo';
      }
    }

    if (processData.periculosity_results) {
      periculosityIdentified = processData.periculosity_results.toLowerCase().includes('constatad');
    }

    // Save report to database
    if (!testMode) {
      try {
        const { error: saveError } = await supabase
          .from('reports')
          .insert({
            process_id: processId,
            report_content: reportContent,
            conclusion: conclusion,
            insalubrity_grade: insalubrityGrade,
            periculosity_identified: periculosityIdentified,
          });

        if (saveError) {
          console.error('❌ Erro ao salvar relatório:', saveError);
        } else {
          console.log('✅ Relatório salvo no banco de dados');
        }
      } catch (saveError) {
        console.error('❌ Erro ao salvar relatório:', saveError);
      }
    }

    console.log('✅ Relatório gerado com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reportContent,
          conclusion,
          insalubrityGrade,
          periculosityIdentified,
          processData: {
            process_number: processData.process_number,
            claimant_name: processData.claimant_name,
            defendant_name: processData.defendant_name,
          },
          statistics: {
            riskAgentsCount: riskAgents.length,
            questionnairesCount: questionnaires.length,
            sectionsGenerated: 21,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na função generate-report:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor',
        details: error.stack || 'Sem detalhes adicionais',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});