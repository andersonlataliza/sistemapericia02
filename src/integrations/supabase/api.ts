import { supabase } from './client';
import { exportReportAsPdf, exportReportAsDocx } from "@/lib/export";

// Tipos para as APIs
export interface ProcessStatistics {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  monthly: Array<{ month: string; count: number }>;
  completion_rate: number;
}

export interface SearchProcessesParams {
  searchTerm?: string;
  status?: string;
  court?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchProcessesResponse {
  processes: Array<Record<string, any>>;
  total: number;
  page: number;
  totalPages: number;
}

export interface ValidateProcessParams {
  processNumber?: string;
  claimantName?: string;
  defendantName?: string;
  processId?: string;
}

export interface ValidateProcessResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProcessProgress {
  processId: string;
  progress: number;
  completedSteps: string[];
  nextSteps: string[];
  details: {
    hasBasicData: boolean;
    hasRiskAgents: boolean;
    hasQuestionnaires: boolean;
    hasDocuments: boolean;
    hasReports: boolean;
  };
}

export interface GenerateReportParams {
  processId: string;
  reportType: 'insalubridade' | 'periculosidade' | 'completo';
}

export interface GenerateReportResponse {
  success: boolean;
  reportId?: string;
  downloadUrl?: string;
  message: string;
}

export interface DocumentProcessorParams {
  documentId: string;
  processId: string;
}

export interface DocumentProcessorResponse {
  success: boolean;
  extractedText?: string;
  documentType?: string;
  keyInformation?: Record<string, any>;
  suggestions?: string[];
  message: string;
}

export interface BusinessValidationParams {
  type: 'process' | 'risk_agent' | 'document' | 'report' | 'profile';
  data: Record<string, any>;
  processId?: string;
}

export interface BusinessValidationResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface NotificationParams {
  type?: 'custom' | 'deadline_check';
  message?: string;
  processId?: string;
  markAsRead?: boolean;
  notificationId?: string;
}

export interface NotificationResponse {
  success: boolean;
  notifications?: Array<{
    id: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    processId?: string;
  }>;
  message: string;
}

export interface AdminCreateUserParams {
  email: string;
  password: string;
  fullName?: string;
  cpf?: string;
  phone?: string;
  makeAdmin?: boolean;
  blocked?: boolean;
  blockedReason?: string;
}

export interface AdminCreateUserResponse {
  success: boolean;
  user?: { id: string; email: string };
  error?: string;
}

export interface AdminDeleteUserParams {
  userId: string;
}

export interface AdminDeleteUserResponse {
  success: boolean;
  error?: string;
}

export interface DeleteProcessResponse {
  success: boolean;
  message: string;
  removedFiles?: number;
  storageWarnings?: string[];
}

// Classe para gerenciar as chamadas das Edge Functions
export class SupabaseAPI {

  private static async authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  
  // Estatísticas de processos
  static async getProcessStatistics(): Promise<ProcessStatistics> {
    const useEdge = ((import.meta as any).env?.VITE_USE_EDGE_STATS === 'true');
    if (useEdge) {
      try {
        const { data, error } = await supabase.functions.invoke('process-statistics', {
          method: 'GET'
        });

        if (error) throw error;
        const payload: any = data;
        const stats = (payload && typeof payload === 'object' && 'data' in payload)
          ? payload.data
          : payload;

        const normalized: ProcessStatistics = {
          total: Number(stats?.total ?? 0),
          pending: Number(stats?.pending ?? 0),
          in_progress: Number(stats?.in_progress ?? 0),
          completed: Number(stats?.completed ?? 0),
          monthly: Array.isArray(stats?.monthly)
            ? stats.monthly
            : (() => {
                const now = new Date();
                const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const count = typeof stats?.monthly === 'number' ? Number(stats.monthly) : 0;
                return [{ month: key, count }];
              })(),
          completion_rate: typeof stats?.completion_rate === 'number'
            ? Number(stats.completion_rate)
            : (Number(stats?.total ?? 0) > 0
                ? Number((((Number(stats?.completed ?? 0)) / Number(stats?.total ?? 0)) * 100).toFixed(2))
                : 0),
        };

        return normalized;
      } catch {}
    }

    // Fallback local: contar estados, tratando 'active' como 'in_progress'
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: processes, error: processesError } = await supabase
      .from('processes')
      .select('id, status, created_at')
      .eq('user_id', user.id);

    if (processesError) throw new Error('Falha ao carregar estatísticas dos processos');

    const total = processes?.length || 0;
    const pending = (processes || []).filter(p => p.status === 'pending').length || 0;
    const inProgressRaw = (processes || []).filter(p => p.status === 'in_progress').length || 0;
    const activeRaw = (processes || []).filter(p => p.status === 'active').length || 0;
    const in_progress = inProgressRaw + activeRaw;
    const completed = (processes || []).filter(p => p.status === 'completed').length || 0;

    const monthlyStatsMap = new Map<string, number>();
    (processes || []).forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyStatsMap.set(key, (monthlyStatsMap.get(key) || 0) + 1);
    });
    const monthly = Array.from(monthlyStatsMap.entries()).map(([month, count]) => ({ month, count }));

    const completion_rate = total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0;

    return {
      total,
      pending,
      in_progress,
      completed,
      monthly,
      completion_rate,
    };
  }

  // Busca avançada de processos
  static async searchProcesses(params: SearchProcessesParams): Promise<SearchProcessesResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('search-processes', {
        method: 'POST',
        body: params
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro na busca de processos:', error);
      throw new Error('Falha na busca de processos');
    }
  }

  // Validação de processo
  static async validateProcess(params: ValidateProcessParams): Promise<ValidateProcessResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('validate-process', {
        method: 'POST',
        body: params
      });

      if (error) throw error;

      // Normaliza a resposta da Edge Function, que pode vir como { success, data }
      const payload: any = data;
      const inner: any = (payload && typeof payload === 'object' && 'data' in payload)
        ? payload.data
        : payload;

      const isValid: boolean = inner?.isValid ?? inner?.valid ?? false;
      const errors: string[] = Array.isArray(inner?.errors) ? inner.errors : [];
      const warnings: string[] = Array.isArray(inner?.warnings) ? inner.warnings : [];

      return { isValid, errors, warnings };
    } catch (error) {
      console.error('Erro na validação do processo:', error);
      throw new Error('Falha na validação do processo');
    }
  }

  // Progresso do processo
  static async getProcessProgress(processId: string): Promise<ProcessProgress> {
    const useEdge = ((import.meta as any).env?.VITE_USE_EDGE_PROGRESS === 'true');
    if (useEdge) {
      try {
        const { data, error } = await supabase.functions.invoke('process-progress', {
          method: 'POST',
          body: { processId }
        });
        if (error) throw error;
        return data;
      } catch {}
    }

    try {
      const { data: proc, error: procErr } = await supabase
        .from('processes')
        .select('id, objective, methodology, workplace_characteristics, insalubrity_results, periculosity_results, conclusion')
        .eq('id', processId)
        .single();
      if (procErr) throw procErr;

      const steps = [
        { key: 'objective', label: 'Objetivo' },
        { key: 'methodology', label: 'Metodologia' },
        { key: 'workplace_characteristics', label: 'Ambiente de Trabalho' },
        { key: 'insalubrity_results', label: 'Resultados de Insalubridade' },
        { key: 'periculosity_results', label: 'Resultados de Periculosidade' },
        { key: 'conclusion', label: 'Conclusão' },
      ] as const;
      const completed = steps.filter(s => !!(proc as any)?.[s.key]).map(s => s.label);
      const next = steps.filter(s => !(proc as any)?.[s.key]).map(s => s.label);
      const progress = steps.length > 0 ? (completed.length / steps.length) * 100 : 0;

      return {
        processId,
        progress,
        completedSteps: completed,
        nextSteps: next,
        details: {
          hasBasicData: !!proc?.objective || !!proc?.methodology || !!proc?.workplace_characteristics,
          hasRiskAgents: false,
          hasQuestionnaires: false,
          hasDocuments: false,
          hasReports: false,
        },
      };
    } catch {
      return {
        processId,
        progress: 0,
        completedSteps: [],
        nextSteps: [],
        details: {
          hasBasicData: false,
          hasRiskAgents: false,
          hasQuestionnaires: false,
          hasDocuments: false,
          hasReports: false,
        },
      };
    }
  }

  // Geração de relatórios
  static async generateReport(params: GenerateReportParams): Promise<GenerateReportResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        method: 'POST',
        body: params
      });
      if (!error && data && typeof data === 'object' && (data as any).success) {
        const payload: any = data;
        const message = typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message
          : 'Relatório gerado';

        return {
          ...payload,
          success: true,
          message,
        } as any;
      }
    } catch {}

    const { processId, reportType } = params;
    const { data: proc, error: procErr } = await supabase
      .from('processes')
      .select('*')
      .eq('id', processId)
      .single();
    if (procErr || !proc) {
      return { success: false, message: 'Falha ao carregar dados do processo para geração local' };
    }
    const { data: questionnairesData } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('process_id', processId)
      .order('party', { ascending: true })
      .order('question_number', { ascending: true });

    const claimantQuesitos = (questionnairesData || []).filter((q: any) => q.party === 'claimant');
    const respondentQuesitos = (questionnairesData || []).filter((q: any) => q.party === 'defendant');
    const judgeQuesitos = (questionnairesData || []).filter((q: any) => q.party === 'judge');

    const parseJson = (v: any) => {
      try {
        return typeof v === 'string' ? JSON.parse(v || '{}') : (v || {});
      } catch {
        return {};
      }
    };
    const parseArr = (v: any) => {
      try {
        const x = typeof v === 'string' ? JSON.parse(v || '[]') : (v || []);
        return Array.isArray(x) ? x : [];
      } catch {
        return [];
      }
    };

    const processForReport: any = {
      process_number: proc.process_number,
      claimant_name: proc.claimant_name,
      defendant_name: proc.defendant_name,
      court: proc.court,
      objective: proc.objective || '',
      methodology: proc.methodology || '',
      workplace_characteristics: parseJson(proc.workplace_characteristics),
      activities_description: proc.activities_description || '',
      insalubrity_analysis: proc.insalubrity_analysis || '',
      insalubrity_results: proc.insalubrity_results || '',
      periculosity_analysis: proc.periculosity_analysis || '',
      periculosity_results: proc.periculosity_results || '',
      conclusion: proc.conclusion || '',
      cover_data: parseJson(proc.cover_data),
      identifications: parseJson(proc.identifications),
      claimant_data: parseJson(proc.claimant_data),
      defendant_data: proc.defendant_data || '',
      initial_data: proc.initial_data || '',
      defense_data: proc.defense_data || '',
      diligence_data: parseArr(proc.diligence_data),
      collective_protection: proc.collective_protection || '',
      periculosity_concept: proc.periculosity_concept || '',
      flammable_definition: proc.flammable_definition || '',
      epis: parseArr(proc.epis),
      attendees: parseArr(proc.attendees),
      documents_presented: parseArr(proc.documents_presented),
      discordances_presented: proc.discordances_presented || '',
      inspection_date: proc.inspection_date,
      inspection_address: proc.inspection_address,
      inspection_time: proc.inspection_time,
      inspection_city: proc.inspection_city,
      report_config: parseJson(proc.report_config),
      claimant_questions: claimantQuesitos,
      respondent_questions: respondentQuesitos,
      judge_questions: judgeQuesitos,
      quesitos_reclamante: claimantQuesitos,
      quesitos_reclamada: respondentQuesitos,
      id: proc.id,
    };

    const text = 'Laudo gerado localmente.';
    const url = await exportReportAsPdf(text, processForReport, { returnUrl: true, reportType });
    return { success: true, message: 'Relatório gerado localmente', downloadUrl: url } as any;
  }

  // Processamento de documentos
  static async processDocument(params: DocumentProcessorParams): Promise<DocumentProcessorResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('document-processor', {
        method: 'POST',
        body: params
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro no processamento do documento:', error);
      throw new Error('Falha no processamento do documento');
    }
  }

  // Validações de negócio
  static async validateBusinessRules(params: BusinessValidationParams): Promise<BusinessValidationResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('business-validations', {
        method: 'POST',
        body: params
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro na validação de regras de negócio:', error);
      throw new Error('Falha na validação de regras de negócio');
    }
  }

  // Sistema de notificações
  static async manageNotifications(params: NotificationParams = {}): Promise<NotificationResponse> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Usuário não autenticado', notifications: [] };
    }

    const isMarkRead = Boolean(params.markAsRead && params.notificationId);
    const isCustom = params.type === 'custom' && typeof params.message === 'string' && params.message.trim().length > 0;

    try {
      if (isMarkRead) {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', params.notificationId as string)
          .eq('user_id', user.id);

        if (error) throw error;
        return { success: true, message: 'Notificação marcada como lida', notifications: [] };
      }

      if (isCustom) {
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            title: 'Notificação do Sistema',
            message: params.message!.trim(),
            type: 'custom',
            read: false,
            process_id: params.processId || null,
          } as any);

        if (error) throw error;
        return { success: true, message: 'Notificação enviada', notifications: [] };
      }

      const { data: rows, error } = await supabase
        .from('notifications')
        .select('id, message, type, read, created_at, process_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const notifications = (rows || []).map((n: any) => ({
        id: String(n.id),
        message: String(n.message || ''),
        type: String(n.type || 'info'),
        isRead: Boolean(n.read),
        createdAt: String(n.created_at),
        processId: n.process_id ? String(n.process_id) : undefined,
      }));

      return { success: true, message: 'OK', notifications };
    } catch {
      try {
        const { data, error } = await supabase.functions.invoke('notifications', {
          method: 'POST',
          body: params
        });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Erro no sistema de notificações:', error);
        return { success: false, message: 'Falha no sistema de notificações', notifications: [] };
      }
    }
  }

  // Métodos de conveniência para notificações
  static async getNotifications(): Promise<NotificationResponse> {
    return this.manageNotifications({ type: 'deadline_check' });
  }

  static async markNotificationAsRead(notificationId: string): Promise<NotificationResponse> {
    return this.manageNotifications({ 
      markAsRead: true, 
      notificationId 
    });
  }

  static async sendCustomNotification(message: string, processId?: string): Promise<NotificationResponse> {
    return this.manageNotifications({ 
      type: 'custom', 
      message, 
      processId 
    });
  }

  static async deleteProcess(processId: string): Promise<DeleteProcessResponse> {
    const pid = String(processId || '').trim();
    if (!pid) throw new Error('Processo inválido');

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('Sessão expirada');

    const { data: proc, error: procErr } = await supabase
      .from('processes')
      .select('id, user_id')
      .eq('id', pid)
      .single();
    if (procErr || !proc) throw (procErr as any) || new Error('Processo não encontrado');

    if (String((proc as any).user_id || '') !== String(user.id)) {
      throw new Error('Sem permissão para excluir este processo');
    }

    const prefix = `${user.id}/${pid}/`;
    const storageWarnings: string[] = [];
    const filePaths = new Set<string>();

    const collectPaths = (value: any) => {
      const stack = [value];
      while (stack.length > 0) {
        const curr = stack.pop();
        if (!curr) continue;
        if (typeof curr === 'string') {
          const s = curr.trim();
          if (s && s.startsWith(prefix)) filePaths.add(s);
          continue;
        }
        if (Array.isArray(curr)) {
          for (const v of curr) stack.push(v);
          continue;
        }
        if (typeof curr === 'object') {
          for (const v of Object.values(curr as any)) stack.push(v);
        }
      }
    };

    try {
      const { data: docs, error } = await supabase
        .from('documents')
        .select('file_path')
        .eq('process_id', pid);
      if (error) throw error;
      (docs || []).forEach((d: any) => collectPaths(d?.file_path));
    } catch (e: any) {
      storageWarnings.push(`Falha ao listar documentos: ${e?.message || 'erro'}`);
    }

    try {
      const { data: reps, error } = await supabase
        .from('reports')
        .select('file_path')
        .eq('process_id', pid);
      if (error) throw error;
      (reps || []).forEach((r: any) => collectPaths(r?.file_path));
    } catch (e: any) {
      storageWarnings.push(`Falha ao listar relatórios: ${e?.message || 'erro'}`);
    }

    try {
      const { data: qs, error } = await supabase
        .from('questionnaires')
        .select('attachments')
        .eq('process_id', pid);
      if (error) throw error;
      (qs || []).forEach((q: any) => collectPaths(q?.attachments));
    } catch (e: any) {
      storageWarnings.push(`Falha ao listar anexos de quesitos: ${e?.message || 'erro'}`);
    }

    try {
      const { data: ras, error } = await supabase
        .from('risk_agents')
        .select('evidence_photos')
        .eq('process_id', pid);
      if (error) throw error;
      (ras || []).forEach((ra: any) => collectPaths(ra?.evidence_photos));
    } catch (e: any) {
      storageWarnings.push(`Falha ao listar evidências de agentes: ${e?.message || 'erro'}`);
    }

    const paths = Array.from(filePaths);
    let removedFiles = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      try {
        const { error } = await supabase.storage.from('process-documents').remove(batch);
        if (error) throw error;
        removedFiles += batch.length;
      } catch (e: any) {
        storageWarnings.push(`Falha ao remover arquivos (${batch.length}): ${e?.message || 'erro'}`);
      }
    }

    const steps: Array<PromiseLike<{ error: any }>> = [
      supabase.from('process_access').delete().eq('process_id', pid),
      supabase.from('schedule_email_receipts').delete().eq('process_id', pid),
      supabase.from('notifications').delete().eq('process_id', pid),
      supabase.from('questionnaires').delete().eq('process_id', pid),
      supabase.from('reports').delete().eq('process_id', pid),
      supabase.from('risk_agents').delete().eq('process_id', pid),
      supabase.from('documents').delete().eq('process_id', pid),
    ];
    for (const p of steps) {
      const res: any = await p;
      if (res?.error) throw res.error;
    }

    const { error: delProcErr } = await supabase
      .from('processes')
      .delete()
      .eq('id', pid)
      .eq('user_id', user.id);
    if (delProcErr) throw delProcErr;

    return {
      success: true,
      message: 'Processo excluído definitivamente',
      removedFiles,
      storageWarnings: storageWarnings.length ? storageWarnings : undefined,
    };
  }

  static async adminCreateUser(params: AdminCreateUserParams): Promise<AdminCreateUserResponse> {
    const headers = await this.authHeaders();
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      method: 'POST',
      body: params,
      headers,
    });

    if (error) {
      console.error('Erro na função admin-create-user:', error);
      let errorMsg = error.message;
      // Tentativa de obter mensagem de erro detalhada se disponível no contexto do erro
      if (error instanceof Error && 'context' in error) {
        try {
           const ctx = (error as any).context;
           if (ctx && typeof ctx.json === 'function') {
             const body = await ctx.json();
             if (body && body.error) errorMsg = body.error;
           }
        } catch {}
      }
      throw new Error(errorMsg || 'Falha ao criar usuário');
    }

    return data as AdminCreateUserResponse;
  }

  static async adminListUsers(): Promise<{ success: boolean; users: any[]; blockingSupported?: boolean; error?: string }> {
    const headers = await this.authHeaders();
    const { data, error } = await supabase.functions.invoke('admin-list-users', {
      method: 'POST',
      headers,
    });

    if (error) {
       console.error('Erro na função admin-list-users:', error);
       let errorMsg = error.message;
       if (error instanceof Error && 'context' in error) {
         try {
           const ctx = (error as any).context;
           if (ctx && typeof ctx.json === 'function') {
             const body = await ctx.json();
             if (body && typeof body.error === 'string' && body.error.trim()) {
               errorMsg = body.error;
             }
           }
         } catch {}
       }
       throw new Error(errorMsg || 'Falha ao listar usuários');
    }

    return data;
  }

  static async adminDeleteUser(params: AdminDeleteUserParams): Promise<AdminDeleteUserResponse> {
    const headers = await this.authHeaders();
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      method: 'POST',
      body: params,
      headers,
    });

    if (error) {
      console.error('Erro na função admin-delete-user:', error);
      let errorMsg = error.message;
      if (error instanceof Error && 'context' in error) {
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body && typeof body.error === 'string' && body.error.trim()) {
              errorMsg = body.error;
            }
          }
        } catch {}
      }
      throw new Error(errorMsg || 'Falha ao deletar usuário');
    }

    return data as AdminDeleteUserResponse;
  }
}

// Exportar instância padrão
export const api = SupabaseAPI;
