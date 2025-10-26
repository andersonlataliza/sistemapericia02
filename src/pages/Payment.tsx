import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Eye, FileText, Save, StickyNote, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Process {
  id: string;
  process_number: string;
  claimant_name: string | null;
  defendant_name: string | null;
  inspection_date: string | null;
  determined_value: number | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  payment_due_date: string | null;
  payment_notes: string | null;
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("processes")
        .select(
          "id, process_number, claimant_name, defendant_name, inspection_date, determined_value, payment_status, payment_amount, payment_date, payment_due_date, payment_notes"
        )
        .order("updated_at", { ascending: false });
      if (error) {
        toast({ title: "Erro ao carregar processos", description: (error as any).message, variant: "destructive" });
      } else {
        setProcesses(data as Process[]);
      }
      setLoading(false);
    };
    fetchData();
  }, [toast]);

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
      toast({ title: "Erro ao salvar pagamento", description: (error as any).message, variant: "destructive" });
      return;
    }

    setProcesses((prev) => prev.map((p) => (p.id === paymentTargetId ? { ...p, ...updatePayload } as Process : p)));

    toast({ title: "Pagamento atualizado", description: "Status e valores salvos com sucesso." });
    setPaymentDialogOpen(false);
    setPaymentTargetId(null);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Controle de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor="search">Busca</Label>
                <Input id="search" placeholder="Número, Reclamante ou Reclamada" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Status do Pagamento</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p>Carregando processos...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Nenhum processo encontrado para os filtros atuais.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((p) => (
              <Card key={p.id} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{p.process_number}</h3>
                        {p.payment_status && getPaymentStatusBadge(p.payment_status)}
                      </div>
                      <p className="text-sm text-muted-foreground"><span className="font-medium">Reclamante:</span> {p.claimant_name || "-"}</p>
                      <p className="text-sm text-muted-foreground"><span className="font-medium">Reclamada:</span> {p.defendant_name || "-"}</p>
                      {p.determined_value && (
                        <p className="text-sm text-muted-foreground"><span className="font-medium">Valor Determinado:</span> {formatCurrency(p.determined_value)}</p>
                      )}
                      {p.payment_amount && (
                        <p className="text-sm text-muted-foreground"><span className="font-medium">Valor Pago:</span> {formatCurrency(p.payment_amount)}</p>
                      )}
                      {p.payment_date && (
                        <p className="text-sm text-muted-foreground"><span className="font-medium">Data do Pagamento:</span> {formatDate(p.payment_date)}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => navigate(`/processo/${p.id}`)}>
                        <Eye className="w-4 h-4 mr-2" /> Visualizar
                      </Button>
                      <Button onClick={() => openPayment(p)}>
                        <Wallet className="w-4 h-4 mr-2" /> Pagamento
                      </Button>
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
                  <Select value={paymentDraft.payment_status} onValueChange={(v) => setPaymentDraft({ ...paymentDraft, payment_status: v })}>
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
                      onChange={(e) => setPaymentDraft({ ...paymentDraft, payment_amount: parseFloat(e.target.value) || 0 })}
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
                <Save className="w-4 h-4 mr-2" /> Salvar Pagamento
              </Button>
              <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}