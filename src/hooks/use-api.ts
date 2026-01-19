import { useState, useEffect, useCallback } from 'react';
import { 
  SupabaseAPI, 
  ProcessStatistics, 
  SearchProcessesParams, 
  SearchProcessesResponse,
  ValidateProcessParams,
  ValidateProcessResponse,
  ProcessProgress,
  GenerateReportParams,
  GenerateReportResponse,
  DocumentProcessorParams,
  DocumentProcessorResponse,
  BusinessValidationParams,
  BusinessValidationResponse,
  NotificationResponse
} from '../integrations/supabase/api';
import { useToast } from './use-toast';

// Hook para estatísticas de processos
export const useProcessStatistics = () => {
  const [statistics, setStatistics] = useState<ProcessStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await SupabaseAPI.getProcessStatistics();
      setStatistics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return { statistics, loading, error, refetch: fetchStatistics };
};

// Hook para busca de processos
export const useSearchProcesses = () => {
  const [results, setResults] = useState<SearchProcessesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const searchProcesses = useCallback(async (params: SearchProcessesParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await SupabaseAPI.searchProcesses(params);
      setResults(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na busca';
      setError(errorMessage);
      toast({
        title: "Erro na busca",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { results, loading, error, searchProcesses };
};

// Hook para validação de processo
export const useProcessValidation = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const validateProcess = useCallback(async (params: ValidateProcessParams): Promise<ValidateProcessResponse | null> => {
    setLoading(true);
    
    try {
      const result = await SupabaseAPI.validateProcess(params);
      
      if (!result.isValid) {
        result.errors.forEach(error => {
          toast({
            title: "Erro de validação",
            description: error,
            variant: "destructive",
          });
        });
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          toast({
            title: "Aviso",
            description: warning,
            variant: "default",
          });
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na validação';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { validateProcess, loading };
};

// Hook para progresso do processo
export const useProcessProgress = (processId: string) => {
  const [progress, setProgress] = useState<ProcessProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProgress = useCallback(async () => {
    if (!processId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await SupabaseAPI.getProcessProgress(processId);
      setProgress(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar progresso';
      setError(errorMessage);
      console.warn('useProcessProgress: falha ao carregar progresso, usando fallback silencioso.', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [processId, toast]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return { progress, loading, error, refetch: fetchProgress };
};

// Hook para geração de relatórios
export const useReportGeneration = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateReport = useCallback(async (params: GenerateReportParams): Promise<GenerateReportResponse | null> => {
    setLoading(true);
    
    try {
      const result = await SupabaseAPI.generateReport(params);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: result.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na geração do relatório';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { generateReport, loading };
};

// Hook para processamento de documentos
export const useDocumentProcessor = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const processDocument = useCallback(async (params: DocumentProcessorParams): Promise<DocumentProcessorResponse | null> => {
    setLoading(true);
    
    try {
      const result = await SupabaseAPI.processDocument(params);
      
      if (result.success) {
        toast({
          title: "Documento processado",
          description: result.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Erro no processamento",
          description: result.message,
          variant: "destructive",
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro no processamento do documento';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { processDocument, loading };
};

// Hook para validações de negócio
export const useBusinessValidation = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const validateBusinessRules = useCallback(async (params: BusinessValidationParams): Promise<BusinessValidationResponse | null> => {
    setLoading(true);
    
    try {
      const result = await SupabaseAPI.validateBusinessRules(params);
      
      if (!result.isValid) {
        result.errors.forEach(error => {
          toast({
            title: "Erro de validação",
            description: error,
            variant: "destructive",
          });
        });
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          toast({
            title: "Aviso",
            description: warning,
            variant: "default",
          });
        });
      }

      if (result.suggestions.length > 0) {
        result.suggestions.forEach(suggestion => {
          toast({
            title: "Sugestão",
            description: suggestion,
            variant: "default",
          });
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na validação';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { validateBusinessRules, loading };
};

// Hook para notificações
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationResponse['notifications']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await SupabaseAPI.getNotifications();
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar notificações';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await SupabaseAPI.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev?.map(n => n.id === notificationId ? { ...n, isRead: true } : n) || []
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao marcar como lida';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast]);

  const sendNotification = useCallback(async (message: string, processId?: string) => {
    try {
      const result = await SupabaseAPI.sendCustomNotification(message, processId);
      if (result.success) {
        toast({
          title: "Notificação enviada",
          description: result.message,
          variant: "default",
        });
        fetchNotifications(); // Recarregar notificações
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar notificação';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { 
    notifications, 
    loading, 
    error, 
    refetch: fetchNotifications, 
    markAsRead, 
    sendNotification 
  };
};