import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import StatsCard from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Clock, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Process {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  status: string;
  inspection_date: string | null;
  created_at: string;
}

export default function Dashboard() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
const { toast } = useToast();
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
      defendant_name: editDraft.defendant_name,
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
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      setProcesses(data || []);

      // Calcular estatísticas
      const { count: totalCount } = await supabase
        .from("processes")
        .select("*", { count: "exact", head: true });

      const { count: pendingCount } = await supabase
        .from("processes")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: inProgressCount } = await supabase
        .from("processes")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress");

      const { count: completedCount } = await supabase
        .from("processes")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      setStats({
        total: totalCount || 0,
        pending: pendingCount || 0,
        in_progress: inProgressCount || 0,
        completed: completedCount || 0,
      });
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

  if (loading) {
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
          <StatsCard title="Total de Processos" value={stats.total} icon={FileText} />
          <StatsCard title="Pendentes" value={stats.pending} icon={Clock} />
          <StatsCard title="Em Andamento" value={stats.in_progress} icon={AlertCircle} />
          <StatsCard title="Concluídos" value={stats.completed} icon={CheckCircle} />
        </div>

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
                          <p className="font-medium">{process.process_number}</p>
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
