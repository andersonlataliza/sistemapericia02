import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Search, Plus, Save, Wallet, CalendarDays, FileText, StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Process {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  status: string;
  inspection_date: string | null;
  court: string | null;
  created_at: string;
  determined_value?: number;
  payment_status?: string;
  payment_amount?: number;
  payment_date?: string | null;
  payment_notes?: string;
  payment_due_date?: string | null;
}

export default function Processes() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    process_number: "",
    claimant_name: "",
    defendant_name: "",
    court: "",
    inspection_date: "",
    status: "pending",
    determined_value: 0,
    payment_status: "pending",
    payment_amount: 0,
    payment_date: "",
    payment_notes: "",
    payment_due_date: "",
  });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTargetId, setPaymentTargetId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({
    payment_status: "pending",
    payment_amount: 0,
    payment_date: "",
    payment_due_date: "",
    payment_notes: "",
  });

  useEffect(() => {
    fetchProcesses();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = processes.filter(
        (p) =>
          p.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.defendant_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProcesses(filtered);
    } else {
      setFilteredProcesses(processes);
    }
  }, [searchTerm, processes]);

  const fetchProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProcesses(data || []);
      setFilteredProcesses(data || []);
    } catch (error) {
      console.error("Erro ao buscar processos:", error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (p: Process) => {
    setEditingId(p.id);
    setEditDraft({
      process_number: p.process_number,
      claimant_name: p.claimant_name,
      defendant_name: p.defendant_name,
      court: p.court || "",
      inspection_date: p.inspection_date ? new Date(p.inspection_date).toISOString().slice(0, 10) : "",
      status: p.status,
      determined_value: p.determined_value || 0,
      payment_status: p.payment_status || "pending",
      payment_amount: p.payment_amount || 0,
      payment_date: p.payment_date ? new Date(p.payment_date).toISOString().slice(0, 10) : "",
      payment_notes: p.payment_notes || "",
      payment_due_date: p.payment_due_date || "",
    });
  };

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

    const updatePayload = {
      payment_status: paymentDraft.payment_status,
      payment_amount: paymentDraft.payment_amount,
      payment_date: paymentDraft.payment_date ? new Date(paymentDraft.payment_date).toISOString() : null,
      payment_due_date: paymentDraft.payment_due_date || null,
      payment_notes: paymentDraft.payment_notes,
    };

    const { error } = await supabase
      .from("processes")
      .update(updatePayload)
      .eq("id", paymentTargetId);

    if (error) {
      toast({
        title: "Erro ao salvar pagamento",
        description: (error as any).message || "Não foi possível atualizar o pagamento",
        variant: "destructive",
      });
      return;
    }

    setProcesses((prev) => prev.map((p) => (p.id === paymentTargetId ? { ...p, ...updatePayload } : p)));
    setFilteredProcesses((prev) => prev.map((p) => (p.id === paymentTargetId ? { ...p, ...updatePayload } : p)));

    toast({
      title: "Pagamento atualizado",
      description: "Status e valores salvos com sucesso.",
    });

    setPaymentDialogOpen(false);
    setPaymentTargetId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({
      process_number: "",
      claimant_name: "",
      defendant_name: "",
      court: "",
      inspection_date: "",
      status: "pending",
      determined_value: 0,
      payment_status: "pending",
      payment_amount: 0,
      payment_date: "",
      payment_notes: "",
      payment_due_date: "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const updatePayload = {
      process_number: editDraft.process_number,
      claimant_name: editDraft.claimant_name,
      defendant_name: editDraft.defendant_name,
      court: editDraft.court || null,
      status: editDraft.status,
      inspection_date: editDraft.inspection_date ? new Date(editDraft.inspection_date).toISOString() : null,
      determined_value: editDraft.determined_value,
      payment_status: editDraft.payment_status,
      payment_amount: editDraft.payment_amount,
      payment_date: editDraft.payment_date ? new Date(editDraft.payment_date).toISOString() : null,
      payment_notes: editDraft.payment_notes,
      payment_due_date: editDraft.payment_due_date || null,
    };

    const { error } = await supabase
      .from("processes")
      .update(updatePayload)
      .eq("id", editingId);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: (error as any).message || "Não foi possível salvar as alterações",
        variant: "destructive",
      });
      return;
    }

    setProcesses((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updatePayload } : p)));
    setFilteredProcesses((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updatePayload } : p)));

    toast({
      title: "Processo atualizado",
      description: "As informações foram salvas com sucesso.",
    });

    cancelEdit();
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Não agendada";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Processos</h1>
            <p className="text-muted-foreground">Gerencie todos os seus processos</p>
          </div>
          <Button onClick={() => navigate("/novo-processo")}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Processo
          </Button>
        </div>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, reclamante ou reclamada..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {filteredProcesses.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "Nenhum processo encontrado" : "Você ainda não tem processos cadastrados"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => navigate("/novo-processo")}>
                    Criar Primeiro Processo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProcesses.map((process) => (
              <Card key={process.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {editingId === process.id ? (
                      <div className="flex-1 space-y-3">
                        <Input
                          value={editDraft.process_number}
                          onChange={(e) => setEditDraft({ ...editDraft, process_number: e.target.value })}
                          placeholder="Número do processo"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input
                            value={editDraft.court}
                            onChange={(e) => setEditDraft({ ...editDraft, court: e.target.value })}
                            placeholder="Vara"
                          />
                          <Input
                            type="date"
                            value={editDraft.inspection_date}
                            onChange={(e) => setEditDraft({ ...editDraft, inspection_date: e.target.value })}
                          />
                          <Select value={editDraft.status} onValueChange={(v) => setEditDraft({ ...editDraft, status: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={editDraft.determined_value}
                            onChange={(e) => setEditDraft({ ...editDraft, determined_value: parseFloat(e.target.value) || 0 })}
                            placeholder="Valor Determinado (R$)"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={editDraft.payment_amount}
                            onChange={(e) => setEditDraft({ ...editDraft, payment_amount: parseFloat(e.target.value) || 0 })}
                            placeholder="Valor Pago (R$)"
                          />
                          <Select value={editDraft.payment_status} onValueChange={(v) => setEditDraft({ ...editDraft, payment_status: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Status Pagamento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="partial">Parcial</SelectItem>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="overdue">Vencido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            type="date"
                            value={editDraft.payment_date}
                            onChange={(e) => setEditDraft({ ...editDraft, payment_date: e.target.value })}
                            placeholder="Data do Pagamento"
                          />
                          <Input
                            type="text"
                            value={editDraft.payment_due_date}
                            onChange={(e) => setEditDraft({ ...editDraft, payment_due_date: e.target.value })}
                            placeholder="Número do documento de pagamento"
                          />
                        </div>
                        <Input
                          value={editDraft.payment_notes}
                          onChange={(e) => setEditDraft({ ...editDraft, payment_notes: e.target.value })}
                          placeholder="Observações sobre o pagamento"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold">{process.process_number}</h3>
                          {getStatusBadge(process.status)}
                          {process.payment_status && getPaymentStatusBadge(process.payment_status)}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium">Reclamante:</span> {process.claimant_name}
                          </p>
                          <p>
                            <span className="font-medium">Reclamada:</span> {process.defendant_name}
                          </p>
                          {process.court && (
                            <p>
                              <span className="font-medium">Vara:</span> {process.court}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Data da Perícia:</span>{" "}
                            {formatDate(process.inspection_date)}
                          </p>
                          {process.determined_value && (
                            <p>
                              <span className="font-medium">Valor Determinado:</span>{" "}
                              {formatCurrency(process.determined_value)}
                            </p>
                          )}
                          {process.payment_amount && (
                            <p>
                              <span className="font-medium">Valor Pago:</span>{" "}
                              {formatCurrency(process.payment_amount)}
                            </p>
                          )}
                          {process.payment_date && (
                            <p>
                              <span className="font-medium">Data do Pagamento:</span>{" "}
                              {formatDate(process.payment_date)}
                            </p>
                          )}
                          {process.payment_due_date && (
                            <p>
                              <span className="font-medium">Documento de Pagamento:</span>{" "}
                              {process.payment_due_date}
                            </p>
                          )}
                          {process.payment_notes && (
                            <p>
                              <span className="font-medium">Obs. Pagamento:</span> {process.payment_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {editingId === process.id ? (
                        <>
                          <Button onClick={saveEdit}>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar
                          </Button>
                          <Button variant="ghost" onClick={cancelEdit}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/processo/${process.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </Button>
                          <Button variant="ghost" onClick={() => startEdit(process)}>
                            Editar
                          </Button>
                          <Button onClick={() => openPayment(process)}>
                            <Wallet className="w-4 h-4 mr-2" />
                            Pagamento
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pagamento do Processo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="payment_status">Status do Pagamento</Label>
                  <Select
                    value={paymentDraft.payment_status}
                    onValueChange={(v) => setPaymentDraft({ ...paymentDraft, payment_status: v })}
                  >
                    <SelectTrigger id="payment_status">
                      <SelectValue placeholder="Status Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_amount">Valor</Label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      value={paymentDraft.payment_amount}
                      onChange={(e) =>
                        setPaymentDraft({ ...paymentDraft, payment_amount: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Valor (R$)"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_date">Data do Pagamento</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="payment_date"
                      type="date"
                      value={paymentDraft.payment_date}
                      onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_date: e.target.value })}
                      placeholder="Data do Pagamento"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="payment_due_date">Número de documento de identificação para pagamento</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="payment_due_date"
                      type="text"
                      value={paymentDraft.payment_due_date}
                      onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_due_date: e.target.value })}
                      placeholder="Número do documento"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_notes">Observações</Label>
                  <div className="relative">
                    <StickyNote className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Textarea
                      id="payment_notes"
                      value={paymentDraft.payment_notes}
                      onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_notes: e.target.value })}
                      placeholder="Observações"
                      className="pl-9 min-h-[110px]"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={savePayment}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Pagamento
              </Button>
              <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
