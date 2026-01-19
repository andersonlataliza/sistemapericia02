import { useEffect, useState } from "react";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import Navbar from "@/components/layout/Navbar";
import StatsCard from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Clock, CheckCircle, AlertCircle, Eye, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useProcessStatistics } from "@/hooks/use-api";

// Sanitização: remove trechos "ADVOGADO:"/"ADVOGADA:" acoplados ao nome
const sanitizeLawyerFromName = (name: any): string => {
  const s = String(name || "");
  return s
    .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

type Process = Tables<'processes'> & {
  _is_linked?: boolean;
  _linked_permissions?: any;
};

export default function Dashboard() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { statistics, loading: statsLoading, refetch: refetchStats } = useProcessStatistics();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    process_number: "",
    claimant_name: "",
    defendant_name: "",
    inspection_date: ""
  });

const startEdit = (p: Process) => {
  setEditingId(p.id);
  setEditDraft({
    process_number: p.process_number,
    claimant_name: p.claimant_name,
    defendant_name: p.defendant_name,
    inspection_date: p.inspection_date ? new Date(p.inspection_date).toISOString().slice(0, 10) : ""
  });
};

const cancelEdit = () => {
  setEditingId(null);
};

const saveEdit = async () => {
  if (!editingId) return;

  if (!editDraft.process_number.trim() || !editDraft.claimant_name.trim() || !editDraft.defendant_name.trim()) {
    toast({
      title: "Campos obrigatórios",
      description: "Preencha número do processo, reclamante e reclamada.",
      variant: "destructive",
    });
    return;
  }

  try {
    const updatePayload = {
      process_number: editDraft.process_number,
      claimant_name: editDraft.claimant_name,
      defendant_name: sanitizeLawyerFromName(editDraft.defendant_name),
      inspection_date: editDraft.inspection_date ? new Date(editDraft.inspection_date).toISOString() : null,
    };

    const { error } = await supabase
      .from("processes")
      .update(updatePayload)
      .eq("id", editingId);

    if (error) throw error;

    setProcesses((prev) =>
      prev.map((p) => (p.id === editingId ? { ...p, ...updatePayload } : p))
    );

    toast({
      title: "Processo atualizado",
      description: "Os dados foram salvos com sucesso.",
    });

    setEditingId(null);
  } catch (err: any) {
    toast({
      title: "Erro ao salvar",
      description: err.message,
      variant: "destructive",
    });
  }
};

  useEffect(() => {
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para carregar seus processos.",
          variant: "destructive",
        });
        return;
      }

      // Buscar processos próprios do usuário (limitado a 5 para o dashboard)
      const { data: ownProcesses, error: ownError } = await supabase
        .from("processes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (ownError) throw ownError;

      // Buscar processos acessíveis através de usuários vinculados (somente se CPF estiver disponível)
      const userCpf = (user.user_metadata && typeof user.user_metadata.cpf === 'string') ? user.user_metadata.cpf : null;
      const { data: linkedAccess, error: linkedError } = userCpf
        ? await supabase
            .from("linked_users")
            .select(`
              id,
              owner_user_id,
              permissions,
              process_access!inner(
                process_id,
                processes!inner(*)
              )
            `)
            .eq("linked_user_cpf", userCpf)
            .eq("status", "active")
        : { data: [], error: null } as any;

      if (linkedError && linkedError.code !== 'PGRST116') {
        console.warn("Erro ao buscar processos vinculados:", linkedError);
      }

      // Combinar processos próprios com processos acessíveis
      let allProcesses = ownProcesses || [];
      
      if (linkedAccess && linkedAccess.length > 0) {
        const linkedProcesses = linkedAccess.flatMap(access => 
          access.process_access?.map(pa => ({
            ...(pa.processes as any),
            _is_linked: true,
            _linked_permissions: access.permissions
          })) || []
        );
        
        // Evitar duplicatas e limitar a 5 processos no total
        const ownProcessIds = new Set(allProcesses.map(p => p.id));
        const uniqueLinkedProcesses = linkedProcesses.filter(p => !ownProcessIds.has(p.id));
        
        allProcesses = [...allProcesses, ...uniqueLinkedProcesses]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5); // Limitar a 5 processos para o dashboard
      }

      setProcesses(allProcesses);
      
      // Recarregar estatísticas após buscar processos
      refetchStats();
    } catch (error) {
      console.error("Erro ao buscar processos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const },
      in_progress: { label: "Em Andamento", variant: "default" as const },
      active: { label: "Em Andamento", variant: "default" as const },
      completed: { label: "Concluído", variant: "default" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Não agendada";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral dos seus processos e perícias
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard title="Total de Processos" value={statistics?.total || 0} icon={FileText} />
          <StatsCard title="Pendentes" value={statistics?.pending || 0} icon={Clock} />
          <StatsCard title="Em Andamento" value={statistics?.in_progress || 0} icon={AlertCircle} />
          <StatsCard title="Concluídos" value={statistics?.completed || 0} icon={CheckCircle} />
        </div>

        {/* Nova seção de estatísticas avançadas */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Taxa de Conclusão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {Number(statistics?.completion_rate ?? 0).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Percentual de processos concluídos
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Estatísticas Mensais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(statistics?.monthly ?? []).slice(-3).map((month, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{month.month}</span>
                      <span className="font-semibold">{month.count} processos</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Processos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {processes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem processos cadastrados
                </p>
                <Button onClick={() => navigate("/novo-processo")}>
                  Criar Primeiro Processo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {processes.map((process) => (
                  <div
                    key={process.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    {editingId === process.id ? (
                      <div className="flex w-full items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <Input
                            value={editDraft.process_number}
                            onChange={(e) => setEditDraft({ ...editDraft, process_number: e.target.value })}
                            placeholder="Número do processo"
                          />
                          <Input
                            value={editDraft.claimant_name}
                            onChange={(e) => setEditDraft({ ...editDraft, claimant_name: e.target.value })}
                            placeholder="Reclamante"
                          />
                          <Input
                            value={editDraft.defendant_name}
                            onChange={(e) => setEditDraft({ ...editDraft, defendant_name: e.target.value })}
                            placeholder="Reclamada"
                          />
                          <div className="text-xs text-muted-foreground">
                            Perícia:
                            <Input
                              type="date"
                              value={editDraft.inspection_date || ""}
                              onChange={(e) => setEditDraft({ ...editDraft, inspection_date: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(process.status)}
                          <Button size="sm" variant="default" onClick={saveEdit}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{process.process_number}</p>
                            {(process as any)._is_linked && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                Vinculado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {process.claimant_name} vs {process.defendant_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Perícia: {formatDate(process.inspection_date)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(process.status)}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/processo/${process.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(process)}
                          >
                            Editar
                          </Button>
                        </div>
                      </>
                    )}
                    </div>
                ))}
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate("/processos")}
                >
                  Ver Todos os Processos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
