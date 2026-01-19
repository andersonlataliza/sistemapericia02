import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { supabase, getAuthenticatedUser, validateAndRecoverSession } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Eye, FileText, Save, Wallet, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/integrations/supabase/types";
import { isAdmin } from "@/utils/adminUtils";

type ProcessRow = Database['public']['Tables']['processes']['Row'];

interface Process {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  inspection_date: string | null;
  determined_value: number | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  payment_due_date: string | null;
  payment_notes: string | null;
}

interface PaymentDraft {
  payment_status: string;
  payment_amount: number | null;
  payment_date: string;
  payment_due_date: string;
  payment_notes: string;
}

const formatCurrency = (n?: number | null) => {
  if (n == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

export default function Payment() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminEnabled, setAdminEnabled] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTargetId, setPaymentTargetId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    payment_status: "pending",
    payment_amount: 0,
    payment_date: "",
    payment_due_date: "",
    payment_notes: "",
  });

  useEffect(() => {
    // Verificar autenticação primeiro usando o novo sistema
    const checkAuth = async () => {
      try {
        console.log('Checking authentication...');
        
        // Primeiro validar e recuperar a sessão
        const session = await validateAndRecoverSession();
        if (!session) {
          console.log('No valid session found');
          toast({ 
            title: "Sessão Expirada", 
            description: "Faça login novamente para continuar.", 
            variant: "destructive" 
          });
          navigate('/');
          return;
        }

        // Obter o usuário autenticado
        const user = await getAuthenticatedUser();
        if (!user) {
          console.log('No authenticated user found');
          toast({ 
            title: "Erro de Autenticação", 
            description: "Não foi possível verificar sua identidade. Faça login novamente.", 
            variant: "destructive" 
          });
          navigate('/');
          return;
        }

        console.log('Authentication successful for user:', user.id);
        setUser(user);

        try {
          const { data, error } = await supabase.rpc('is_admin');
          if (error) {
            setAdminEnabled(isAdmin(user.email));
          } else {
            setAdminEnabled(Boolean(data));
          }
        } catch {
          setAdminEnabled(isAdmin(user.email));
        }
      } catch (error) {
        console.error('Erro crítico ao verificar autenticação:', error);
        toast({ 
          title: "Erro de Conexão", 
          description: "Verifique sua conexão com a internet.", 
          variant: "destructive" 
        });
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [toast, navigate]);

  useEffect(() => {
    if (!user || authLoading) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Usar a nova função de autenticação robusta
        const currentUser = await getAuthenticatedUser();
        
        if (!currentUser) {
          console.error('Usuário não autenticado');
          toast({ 
            title: "Erro de Autenticação", 
            description: "Sessão expirada. Faça login novamente.", 
            variant: "destructive" 
          });
          return;
        }

        console.log('Fetching processes for user:', currentUser.id);

        // Consulta com colunas de pagamento; se falhar por coluna inexistente, faz fallback
        let data: ProcessRow[] | null = null;
        let selectError: any = null;
        {
          const { data: rows, error } = await supabase
            .from("processes")
            .select(
              "id, process_number, claimant_name, defendant_name, inspection_date, determined_value, payment_status, payment_amount, payment_date, payment_due_date, payment_notes"
            )
            .order("updated_at", { ascending: false });
          data = rows as any;
          selectError = error;
        }
        // Fallback para esquemas sem colunas de pagamento (erro 42703: undefined_column)
        if (selectError && (selectError.code === '42703' || /does not exist|undefined column/i.test(selectError.message))) {
          console.warn('Colunas de pagamento ausentes no schema. Aplicando fallback básico.');
          const { data: rows, error } = await supabase
            .from("processes")
            .select("id, process_number, claimant_name, defendant_name, inspection_date, determined_value")
            .order("updated_at", { ascending: false });
          if (!error) {
            data = (rows || []).map((item: any) => ({
              ...item,
              payment_status: null,
              payment_amount: null,
              payment_date: null,
              payment_due_date: null,
              payment_notes: null,
            })) as any;
            // Avisar uma vez sobre limitações
            toast({
              title: "Campos de pagamento não encontrados",
              description: "O schema atual não possui colunas de pagamento. Exibindo dados sem pagamento.",
              variant: "default",
            });
          } else {
            selectError = error;
          }
        }

        if (selectError) {
          console.error('Erro detalhado ao carregar processos:', {
            message: selectError.message,
            details: selectError.details,
            hint: selectError.hint,
            code: selectError.code
          });
          
          // Verificar se é erro de RLS ou permissão
          if (selectError.code === 'PGRST116' || selectError.message.includes('permission')) {
            toast({ 
              title: "Erro de Permissão", 
              description: "Você não tem permissão para acessar estes dados. Verifique suas credenciais.", 
              variant: "destructive" 
            });
          } else if (selectError.code === '42P01') {
            toast({ 
              title: "Erro de Configuração", 
              description: "Tabela não encontrada. Entre em contato com o suporte.", 
              variant: "destructive" 
            });
          } else {
            toast({ 
              title: "Erro ao carregar processos", 
              description: `${selectError.message} (Código: ${selectError.code || 'N/A'})`, 
              variant: "destructive" 
            });
          }
        } else {
          console.log('Processos carregados com sucesso:', data?.length || 0);
          
          // Se não há dados, criar dados de exemplo
          if (!data || data.length === 0) {
            console.log('No processes found, creating sample data...');
            const sampleCreated = await createSampleData(currentUser.id);
            
            if (sampleCreated) {
              // Recarregar os dados após criar os exemplos
              // Recarregar com mesmas regras (inclui fallback)
              let newData: ProcessRow[] | null = null;
              {
                const { data: rows, error } = await supabase
                  .from("processes")
                  .select(
                    "id, process_number, claimant_name, defendant_name, inspection_date, determined_value, payment_status, payment_amount, payment_date, payment_due_date, payment_notes"
                  )
                  .order("updated_at", { ascending: false });
                if (error && (error.code === '42703' || /does not exist|undefined column/i.test(error.message))) {
                  const { data: rows2 } = await supabase
                    .from("processes")
                    .select("id, process_number, claimant_name, defendant_name, inspection_date, determined_value")
                    .order("updated_at", { ascending: false });
                  newData = (rows2 || []).map((item: any) => ({
                    ...item,
                    payment_status: null,
                    payment_amount: null,
                    payment_date: null,
                    payment_due_date: null,
                    payment_notes: null,
                  })) as any;
                } else {
                  newData = rows as any;
                }
              }
              
              if (newData) {
                setProcesses(newData.map((item: ProcessRow) => ({
                  id: item.id,
                  process_number: item.process_number,
                  claimant_name: item.claimant_name,
                  defendant_name: item.defendant_name,
                  inspection_date: item.inspection_date,
                  determined_value: item.determined_value,
                  payment_status: item.payment_status,
                  payment_amount: item.payment_amount,
                  payment_date: item.payment_date,
                  payment_due_date: item.payment_due_date,
                  payment_notes: item.payment_notes,
                }) as Process));
                toast({
                  title: "Dados de exemplo criados",
                  description: "Alguns processos de exemplo foram criados para demonstração.",
                });
              }
            }
          } else {
            setProcesses(data.map((item: ProcessRow) => ({
              id: item.id,
              process_number: item.process_number,
              claimant_name: item.claimant_name,
              defendant_name: item.defendant_name,
              inspection_date: item.inspection_date,
              determined_value: item.determined_value,
              payment_status: item.payment_status,
              payment_amount: item.payment_amount,
              payment_date: item.payment_date,
              payment_due_date: item.payment_due_date,
              payment_notes: item.payment_notes,
            }) as Process));
          }
        }
      } catch (error) {
        console.error('Erro crítico na requisição:', error);
        toast({ 
          title: "Erro de Conexão", 
          description: "Não foi possível carregar os processos. Verifique sua conexão.", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [toast, user, authLoading]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return processes.filter((p) => {
      const matchesSearch = !s ||
        p.process_number?.toLowerCase().includes(s) ||
        p.claimant_name?.toLowerCase().includes(s) ||
        p.defendant_name?.toLowerCase().includes(s);
      const matchesStatus = statusFilter === "all" || (p.payment_status || "pending") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [processes, search, statusFilter]);

  const receivedStats = useMemo(() => {
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();

    let receivedMonth = 0;
    let receivedYear = 0;
    let countMonth = 0;
    let countYear = 0;

    for (const p of processes) {
      if ((p.payment_status || "pending") !== "paid") continue;
      const rawAmount = p.payment_amount;
      const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount || 0);

      const rawDate = p.payment_date;
      if (!rawDate) continue;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) continue;

      if (d.getFullYear() === nowYear) {
        receivedYear += amount;
        countYear += 1;
        if (d.getMonth() === nowMonth) {
          receivedMonth += amount;
          countMonth += 1;
        }
      }
    }

    return {
      now,
      receivedMonth,
      receivedYear,
      countMonth,
      countYear,
    };
  }, [processes]);

  const openPayment = (p: Process) => {
    setPaymentTargetId(p.id);
    setPaymentDraft({
      payment_status: p.payment_status || "pending",
      payment_amount: p.payment_amount || 0,
      payment_date: p.payment_date ? new Date(p.payment_date).toISOString().slice(0, 10) : "",
      payment_due_date: p.payment_due_date || "",
      payment_notes: p.payment_notes || "",
    });
    setPaymentDialogOpen(true);
  };

  const savePayment = async () => {
    if (!paymentTargetId) return;

    // Usar a nova função de autenticação robusta
    const currentUser = await getAuthenticatedUser();
    
    if (!currentUser) {
      console.error('Usuário não autenticado');
      toast({ 
        title: "Erro de Autenticação", 
        description: "Sessão expirada. Faça login novamente.", 
        variant: "destructive" 
      });
      return;
    }

    const updatePayload: TablesUpdate<'processes'> = {
      payment_status: paymentDraft.payment_status,
      payment_amount: paymentDraft.payment_amount,
      payment_date: paymentDraft.payment_date ? new Date(paymentDraft.payment_date).toISOString() : null,
      payment_due_date: paymentDraft.payment_due_date || null,
      payment_notes: paymentDraft.payment_notes,
    };

    try {
      console.log('Saving payment for process:', paymentTargetId, 'user:', currentUser.id);
      
      const { error } = await supabase
        .from("processes")
        .update(updatePayload)
        .eq("id", paymentTargetId);

      if (error) {
        console.error('Erro ao salvar pagamento:', error);
        toast({ 
          title: "Erro ao salvar pagamento", 
          description: error.message || "Erro desconhecido", 
          variant: "destructive" 
        });
        return;
      }

      setProcesses((prev) => prev.map((p) => (p.id === paymentTargetId ? { ...p, ...updatePayload } as Process : p)));

      toast({ 
        title: "Pagamento atualizado", 
        description: "Status e valores salvos com sucesso." 
      });
      setPaymentDialogOpen(false);
      setPaymentTargetId(null);
    } catch (error) {
      console.error('Erro na requisição de pagamento:', error);
      toast({ 
        title: "Erro de Conexão", 
        description: "Não foi possível salvar o pagamento.", 
        variant: "destructive" 
      });
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const },
      partial: { label: "Parcial", variant: "default" as const },
      paid: { label: "Pago", variant: "default" as const },
      overdue: { label: "Vencido", variant: "destructive" as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Verificando autenticação...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar erro se não autenticado
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
              <p className="text-muted-foreground mb-4">Você precisa estar logado para acessar esta página.</p>
              <Button onClick={() => navigate('/')}>
                Fazer Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se o usuário é administrador
  if (!(adminEnabled || isAdmin(user.email))) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground mb-4">
                Esta página é restrita apenas para administradores do sistema.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Voltar ao Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Controle Manual de Pagamentos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Marque os processos que foram pagos e adicione informações de pagamento
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="search">Buscar Processo</Label>
                <Input 
                  id="search" 
                  placeholder="Número do processo ou nome" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label>Filtrar por Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Não Pago</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-muted-foreground">
                  <p><strong>{filtered.length}</strong> processo(s) encontrado(s)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">
              Valores recebidos com base em pagamentos confirmados (status: Pago)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">
                  Recebido no mês ({receivedStats.now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})
                </div>
                <div className="mt-1 text-2xl font-semibold text-foreground">
                  {formatCurrency(receivedStats.receivedMonth)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {receivedStats.countMonth} pagamento(s) confirmado(s)
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Recebido no ano ({receivedStats.now.getFullYear()})</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">
                  {formatCurrency(receivedStats.receivedYear)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {receivedStats.countYear} pagamento(s) confirmado(s)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">Carregando processos...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum processo encontrado</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== "all" 
                  ? "Tente ajustar os filtros de busca." 
                  : "Não há processos cadastrados ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((p) => (
              <Card key={p.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-primary">{p.process_number}</h3>
                        {p.payment_status && getPaymentStatusBadge(p.payment_status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Reclamante:</span> {p.claimant_name || "Não informado"}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Reclamada:</span> {p.defendant_name || "Não informado"}
                        </p>
                        
                        {p.determined_value && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Valor Determinado:</span> {formatCurrency(p.determined_value)}
                          </p>
                        )}
                        
                        {p.payment_amount && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Valor Pago:</span> {formatCurrency(p.payment_amount)}
                          </p>
                        )}
                        
                        {p.payment_date && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Data do Pagamento:</span> {formatDate(p.payment_date)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 lg:flex-col lg:w-auto">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/processo/${p.id}`)}
                        className="flex-1 lg:flex-none"
                      >
                        <Eye className="w-4 h-4 mr-2" /> Ver Processo
                      </Button>
                      <Button 
                        onClick={() => openPayment(p)}
                        size="sm"
                        className="flex-1 lg:flex-none"
                      >
                        <Wallet className="w-4 h-4 mr-2" /> 
                        {p.payment_status === 'paid' ? 'Editar' : 'Marcar'} Pagamento
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Controle de Pagamento
              </DialogTitle>
              <DialogDescription>
                Marque como pago e adicione as informações do pagamento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Status e Valor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_status">Status do Pagamento *</Label>
                  <Select 
                    value={paymentDraft.payment_status} 
                    onValueChange={(v) => setPaymentDraft({ ...paymentDraft, payment_status: v })}
                  >
                    <SelectTrigger id="payment_status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Não Pago</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment_amount">Valor Pago</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentDraft.payment_amount || ''}
                      onChange={(e) => setPaymentDraft({ 
                        ...paymentDraft, 
                        payment_amount: e.target.value ? parseFloat(e.target.value) : 0 
                      })}
                      placeholder="0,00"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Data do Pagamento */}
              <div className="space-y-2">
                <Label htmlFor="payment_date">Data do Pagamento</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="payment_date"
                    type="date"
                    value={paymentDraft.payment_date || ''}
                    onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_date: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Documento de Identificação */}
              <div className="space-y-2">
                <Label htmlFor="payment_due_date">Documento de Identificação do Pagamento</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="payment_due_date"
                    type="text"
                    value={paymentDraft.payment_due_date || ''}
                    onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_due_date: e.target.value })}
                    placeholder="Ex: Número do comprovante, PIX, transferência..."
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Número do comprovante, código PIX, número da transferência, etc.
                </p>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="payment_notes">Observações</Label>
                <Textarea
                  id="payment_notes"
                  value={paymentDraft.payment_notes || ''}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_notes: e.target.value })}
                  placeholder="Informações adicionais sobre o pagamento..."
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>
            
            <DialogFooter className="sticky bottom-0 bg-background border-t pt-3 z-10 gap-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={savePayment}>
                <Save className="w-4 h-4 mr-2" /> 
                Salvar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

  // Função para criar dados de exemplo se não existirem
  const createSampleData = async (userId: string) => {
    console.log('Creating sample data for user:', userId);
    
    const sampleProcesses = [
      {
        user_id: userId,
        process_number: '2024-001-001',
        claimant_name: 'João Silva',
        defendant_name: 'Empresa ABC Ltda',
        inspection_date: '2024-01-15',
        determined_value: 15000.00,
        payment_status: 'pending',
        payment_amount: 15000.00,
        payment_due_date: '2024-02-15',
        payment_notes: 'Perícia técnica em equipamentos industriais'
      },
      {
        user_id: userId,
        process_number: '2024-001-002',
        claimant_name: 'Maria Santos',
        defendant_name: 'Construtora XYZ S.A.',
        inspection_date: '2024-01-20',
        determined_value: 25000.00,
        payment_status: 'paid',
        payment_amount: 25000.00,
        payment_due_date: '2024-02-20',
        payment_notes: 'Avaliação de danos estruturais'
      },
      {
        user_id: userId,
        process_number: '2024-001-003',
        claimant_name: 'Pedro Oliveira',
        defendant_name: 'Seguradora DEF',
        inspection_date: '2024-01-25',
        determined_value: 8500.00,
        payment_status: 'overdue',
        payment_amount: 8500.00,
        payment_due_date: '2024-02-25',
        payment_notes: 'Perícia veicular - colisão'
      }
    ];

    try {
      // Tenta inserir com colunas de pagamento (schema completo)
      const { data, error } = await supabase
        .from('processes')
        .insert(sampleProcesses as any[])
        .select();

      if (error) {
        // Se colunas não existem no schema atual, faz fallback para inserir apenas colunas básicas
        const isUndefinedColumn = error.code === '42703' || /undefined column|does not exist/i.test(error.message);
        const isTableMissing = error.code === '42P01' || /relation .* does not exist/i.test(error.message);

        if (isUndefinedColumn) {
          console.warn('Colunas de pagamento ausentes ao inserir exemplos. Aplicando fallback sem colunas de pagamento.');
          const basicProcesses = sampleProcesses.map((p) => ({
            user_id: p.user_id,
            process_number: p.process_number,
            claimant_name: p.claimant_name,
            defendant_name: p.defendant_name,
            inspection_date: p.inspection_date,
            determined_value: p.determined_value,
          }));

          const { data: dataBasic, error: errorBasic } = await supabase
            .from('processes')
            .insert(basicProcesses)
            .select();

          if (errorBasic) {
            console.error('Erro ao criar dados de exemplo (fallback):', errorBasic);
            return false;
          }

          console.log('Dados de exemplo (básicos) criados com sucesso:', dataBasic);
          return true;
        }

        if (isTableMissing) {
          console.error('Tabela processes não encontrada ao inserir exemplos. Verifique migrações do banco.');
          return false;
        }

        console.error('Erro ao criar dados de exemplo:', error);
        return false;
      }

      console.log('Dados de exemplo criados com sucesso:', data);
      return true;
    } catch (error) {
      console.error('Erro ao inserir dados de exemplo:', error);
      return false;
    }
  };
