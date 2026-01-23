import { useCallback, useEffect, useState, useMemo } from "react";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Search, Plus, Save, Filter, X, Trash2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from "@/components/ui/command";
import { Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/integrations/supabase/api";

const sanitizeLawyerFromName = (name: string | undefined): string => {
  const s = String(name || "");
  return s
    .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

type Process = Tables<'processes'> & {
  _is_linked?: boolean;
  _linked_permissions?: unknown;
};

export default function Processes() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados para busca avançada
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    status: "",
    court: "",
    date_from: "",
    date_to: "",
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    process_number: "",
    claimant_name: "",
    defendant_name: "",
    court: "",
    inspection_date: "",
    status: "pending",
  });
  const [statusTab, setStatusTab] = useState<"pending" | "in_progress" | "completed">("in_progress");
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [courtUsage, setCourtUsage] = useState<Record<string, number>>({});
  const courts = useMemo(() => {
    const set = new Set<string>();
    processes.forEach((p) => {
      const c = String(p.court || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [processes]);
  const courtCounts = useMemo(() => {
    const m = new Map<string, number>();
    processes.forEach((p) => {
      const c = String(p.court || "").trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [processes]);
  const filteredCourtCounts = useMemo(() => {
    const m = new Map<string, number>();
    filteredProcesses.forEach((p) => {
      const c = String(p.court || "").trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [filteredProcesses]);
  const courtsSorted = useMemo(() => {
    const arr = courts.slice();
    arr.sort((a, b) => {
      const ua = courtUsage[a] || 0;
      const ub = courtUsage[b] || 0;
      if (ua !== ub) return ub - ua;
      const ca = courtCounts.get(a) || 0;
      const cb = courtCounts.get(b) || 0;
      if (ca !== cb) return cb - ca;
      return a.localeCompare(b, "pt-BR");
    });
    return arr;
  }, [courts, courtUsage, courtCounts]);

  const hasActiveFilters = useCallback(() => {
    return Object.values(advancedFilters).some(value => value !== "") || selectedCourts.length > 0;
  }, [advancedFilters, selectedCourts.length]);

  const performAdvancedSearch = useCallback(() => {
    const term = searchTerm.trim().toLowerCase();

    const parseDateOnly = (value?: string | null) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const createdFrom = parseDateOnly(advancedFilters.date_from);
    const createdTo = parseDateOnly(advancedFilters.date_to);
    if (createdTo) createdTo.setHours(23, 59, 59, 999);

    const selectedCourtsNormalized = selectedCourts.map((c) => c.toLowerCase());
    const courtText = advancedFilters.court.trim().toLowerCase();

    const filtered = processes
      .filter((p) => {
        const processNumber = String(p.process_number || '').toLowerCase();
        const claimant = String(p.claimant_name || '').toLowerCase();
        const defendant = sanitizeLawyerFromName(p.defendant_name).toLowerCase();
        const court = String(p.court || '').toLowerCase();

        const matchesTerm =
          !term ||
          processNumber.includes(term) ||
          claimant.includes(term) ||
          defendant.includes(term) ||
          court.includes(term);

        const matchesCourtText = !courtText || court.includes(courtText);
        const matchesCourtPick =
          selectedCourtsNormalized.length === 0 ||
          selectedCourtsNormalized.some((c) => court.includes(c));

        const status = String(p.status || '');
        const filterStatus = advancedFilters.status;
        const matchesStatus =
          !filterStatus ||
          status === filterStatus ||
          (filterStatus === 'in_progress' && status === 'active');

        const createdAt = parseDateOnly(p.created_at);
        const matchesCreatedFrom = !createdFrom || (createdAt != null && createdAt >= createdFrom);
        const matchesCreatedTo = !createdTo || (createdAt != null && createdAt <= createdTo);

        return (
          matchesTerm &&
          matchesCourtText &&
          matchesCourtPick &&
          matchesStatus &&
          matchesCreatedFrom &&
          matchesCreatedTo
        );
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    setFilteredProcesses(filtered);
  }, [advancedFilters, processes, searchTerm, selectedCourts]);

  const clearFilters = () => {
    setSearchTerm("");
    setAdvancedFilters({
      status: "",
      court: "",
      date_from: "",
      date_to: "",
    });
    setShowAdvancedSearch(false);
    setSelectedCourts([]);
  };

  const fetchProcesses = useCallback(async () => {
    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para listar os processos.",
          variant: "destructive",
        });
        return;
      }
      setUserId(user.id);

      const { data: linkedAccess, error: linkedError } = await supabase
        .from("linked_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("status", "active")
        .limit(1);

      if (linkedError && linkedError.code !== "PGRST116") {
        console.warn("Erro ao buscar usuário vinculado:", linkedError);
      }

      const isLinked = Boolean(linkedAccess && linkedAccess.length > 0);

      const isMissingColumnError = (e: any) => {
        const msg = String(e?.message || "");
        const details = String(e?.details || "");
        const hint = String(e?.hint || "");
        const code = String(e?.code || "");
        const status = Number(e?.status || e?.statusCode || 0);
        const raw = `${msg} ${details} ${hint}`.toLowerCase();
        return (
          status === 400 && raw.includes("created_by") && (raw.includes("does not exist") || raw.includes("could not find") || raw.includes("undefined column"))
        ) || (
          code === "42703" ||
          code === "PGRST204" ||
          (/does not exist|undefined column|column\s+.+\s+does not exist|could not find the/i.test(msg) && raw.includes("created_by"))
        );
      };

      let listData: any[] | null = null;
      let listError: any = null;
      if (isLinked) {
        const res = await supabase
          .from("processes")
          .select("*")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });
        listData = res.data as any;
        listError = res.error as any;
        if (listError && isMissingColumnError(listError)) {
          toast({
            title: "Atualização do banco pendente",
            description: "A coluna created_by ainda não existe no Supabase. Aplique as migrations para habilitar o isolamento de processos do vinculado.",
            variant: "destructive",
          });
          listData = [];
          listError = null;
        }
      } else {
        const res = await supabase
          .from("processes")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        listData = res.data as any;
        listError = res.error as any;
      }

      if (listError) throw listError;

      setProcesses((listData || []) as any);
      setFilteredProcesses((listData || []) as any);
    } catch (error) {
      console.error("Erro ao buscar processos:", error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  useEffect(() => {
    if (searchTerm || hasActiveFilters()) {
      performAdvancedSearch();
    } else {
      setFilteredProcesses(processes);
    }
  }, [searchTerm, processes, hasActiveFilters, performAdvancedSearch]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`court_usage_${userId}`);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") {
        setCourtUsage(parsed as Record<string, number>);
      }
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(`court_usage_${userId}`, JSON.stringify(courtUsage));
    } catch (e) {
      console.error(e);
    }
  }, [courtUsage, userId]);

  const startEdit = (p: Process) => {
    if (p._is_linked) return;
    setEditingId(p.id);
    setEditDraft({
      process_number: p.process_number,
      claimant_name: p.claimant_name,
      defendant_name: p.defendant_name,
      court: p.court || "",
      inspection_date: p.inspection_date ? new Date(p.inspection_date).toISOString().slice(0, 10) : "",
      status: p.status,
    });
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
    });
  };

  const deleteEditingProcess = useCallback(async () => {
    if (!editingId) return;
    try {
      setDeleting(true);
      const res = await api.deleteProcess(editingId);
      const warnings = Array.isArray((res as any)?.storageWarnings) ? (res as any).storageWarnings : [];
      setProcesses((prev) => prev.filter((p) => p.id !== editingId));
      setFilteredProcesses((prev) => prev.filter((p) => p.id !== editingId));
      toast({
        title: "Exclusão concluída",
        description: warnings.length > 0 ? "Processo excluído, mas alguns arquivos podem não ter sido removidos." : "Processo excluído definitivamente.",
        variant: warnings.length > 0 ? "destructive" : undefined,
      });
      cancelEdit();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e?.message || "Falha ao excluir o processo", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [editingId, toast]);

  const saveEdit = async () => {
    if (!editingId) return;

    const updatePayload = {
      process_number: editDraft.process_number,
      claimant_name: editDraft.claimant_name,
      defendant_name: sanitizeLawyerFromName(editDraft.defendant_name),
      court: editDraft.court || null,
      status: editDraft.status,
      inspection_date: editDraft.inspection_date ? new Date(editDraft.inspection_date).toISOString() : null,
    };

    const { error } = await supabase
      .from("processes")
      .update(updatePayload)
      .eq("id", editingId);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: (error as { message?: string })?.message || "Não foi possível salvar as alterações",
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
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, reclamante ou reclamada..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center justify-between">
              <Collapsible open={showAdvancedSearch} onOpenChange={setShowAdvancedSearch}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros Avançados
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Filtros Avançados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="status-filter">Status</Label>
                          <Select
                            value={advancedFilters.status}
                            onValueChange={(value) => setAdvancedFilters({...advancedFilters, status: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Todos os status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Todos</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="court-filter">Vara</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {selectedCourts.map((c) => (
                              <Badge key={c} variant="outline" className="flex items-center gap-1">
                                {c} ({filteredCourtCounts.get(c) ?? courtCounts.get(c) ?? 0})
                                <button
                                  aria-label="Remover vara"
                                  onClick={() => setSelectedCourts((prev) => prev.filter((x) => x !== c))}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" id="court-filter">
                                Selecionar varas
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                              <div className="flex items-center justify-between p-2 border-b">
                                <span className="text-sm text-muted-foreground">Sugestões</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCourts([])}
                                >
                                  Limpar varas
                                </Button>
                              </div>
                              <Command>
                                <CommandInput placeholder="Pesquisar varas..." />
                                <CommandList>
                                  <CommandEmpty>Nenhuma vara encontrada</CommandEmpty>
                                  <CommandGroup heading="Varas">
                                    {courtsSorted.map((c) => {
                                      const isSelected = selectedCourts.includes(c);
                                      const count = courtCounts.get(c) || 0;
                                      return (
                                        <CommandItem
                                          key={c}
                                          onSelect={() => {
                                            setSelectedCourts((prev) =>
                                              prev.includes(c)
                                                ? prev.filter((x) => x !== c)
                                                : [...prev, c]
                                            );
                                            setCourtUsage((prev) => ({
                                              ...prev,
                                              [c]: (prev[c] || 0) + 1,
                                            }));
                                          }}
                                        >
                                          <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                          {c}
                                          <CommandShortcut>{count}</CommandShortcut>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <Input
                            placeholder="Busca textual por vara"
                            value={advancedFilters.court}
                            onChange={(e) => setAdvancedFilters({ ...advancedFilters, court: e.target.value })}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label htmlFor="date-from">Data Inicial</Label>
                          <Input
                            id="date-from"
                            type="date"
                            value={advancedFilters.date_from}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, date_from: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="date-to">Data Final</Label>
                          <Input
                            id="date-to"
                            type="date"
                            value={advancedFilters.date_to}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, date_to: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={performAdvancedSearch} disabled={loading}>
                          <Search className="w-4 h-4 mr-2" />
                          Buscar
                        </Button>
                        <Button variant="outline" onClick={clearFilters}>
                          <X className="w-4 h-4 mr-2" />
                          Limpar Filtros
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {(hasActiveFilters() || searchTerm) && (
                <div className="text-sm text-muted-foreground">
                  {filteredProcesses.length} processo(s) encontrado(s)
                </div>
              )}
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
          (() => {
            const pendingList = filteredProcesses.filter((p) => p.status === "pending");
            const inProgressList = filteredProcesses.filter((p) => p.status === "in_progress" || p.status === "active");
            const completedList = filteredProcesses.filter((p) => p.status === "completed");
            const countByCourt = (list: Process[]) => {
              const m = new Map<string, number>();
              for (const p of list) {
                const c = String(p.court || "").trim();
                if (!c) continue;
                m.set(c, (m.get(c) || 0) + 1);
              }
              return m;
            };
            const mapPending = countByCourt(pendingList);
            const mapProgress = countByCourt(inProgressList);
            const mapCompleted = countByCourt(completedList);
            const allCourts = Array.from(new Set<string>([
              ...Array.from(mapPending.keys()),
              ...Array.from(mapProgress.keys()),
              ...Array.from(mapCompleted.keys()),
            ]));
            const summaryRows = allCourts.map((court) => {
              const pending = mapPending.get(court) || 0;
              const in_progress = mapProgress.get(court) || 0;
              const completed = mapCompleted.get(court) || 0;
              const total = pending + in_progress + completed;
              return { court, pending, in_progress, completed, total };
            }).sort((a, b) => b.total - a.total);
            const displayRows = (selectedCourts.length > 0
              ? summaryRows.filter((r) => selectedCourts.includes(r.court))
              : summaryRows.slice(0, 6));
            const renderList = (list: Process[]) => (
              <div className="grid grid-cols-1 gap-4">
                {list.map((process) => (
                  <Card key={process.id} className="shadow-card hover:shadow-elevated transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        {editingId === process.id ? (
                          <div className="flex-1 space-y-3">
                            <div className="space-y-1">
                              <Label htmlFor="edit_process_number">Número do processo</Label>
                              <Input
                                id="edit_process_number"
                                value={editDraft.process_number}
                                onChange={(e) => setEditDraft({ ...editDraft, process_number: e.target.value })}
                                placeholder="0000000-00.0000.0.00.0000"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="edit_claimant_name">Reclamante</Label>
                                <Input
                                  id="edit_claimant_name"
                                  value={editDraft.claimant_name}
                                  onChange={(e) => setEditDraft({ ...editDraft, claimant_name: e.target.value })}
                                  placeholder="Nome do(a) reclamante"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="edit_defendant_name">Reclamado(a)</Label>
                                <Input
                                  id="edit_defendant_name"
                                  value={editDraft.defendant_name}
                                  onChange={(e) => setEditDraft({ ...editDraft, defendant_name: e.target.value })}
                                  placeholder="Nome do(a) reclamado(a)"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="edit_court">Vara / Tribunal</Label>
                                {(() => {
                                  const raw = (process as { report_config?: unknown }).report_config;
                                  let rc: Record<string, unknown> = {};
                                  try {
                                    rc = typeof raw === "object" && raw ? raw : JSON.parse(String(raw || "{}"));
                                  } catch {
                                    rc = {};
                                  }
                                  const options: string[] = Array.isArray((rc as { court_options?: unknown }).court_options)
                                    ? (((rc as { court_options?: unknown }).court_options as string[]) || [])
                                    : [];
                                  return options.length > 0 ? (
                                    <Select
                                      value={editDraft.court || undefined}
                                      onValueChange={(v) => setEditDraft({ ...editDraft, court: v })}
                                    >
                                      <SelectTrigger id="edit_court">
                                        <SelectValue placeholder="Selecione" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {options.map((opt) => (
                                          <SelectItem key={opt} value={opt}>
                                            {opt}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      id="edit_court"
                                      value={editDraft.court}
                                      onChange={(e) => setEditDraft({ ...editDraft, court: e.target.value })}
                                      placeholder="Ex.: 3ª Vara do Trabalho"
                                    />
                                  );
                                })()}
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="edit_inspection_date">Data da perícia</Label>
                                <Input
                                  id="edit_inspection_date"
                                  type="date"
                                  value={editDraft.inspection_date}
                                  onChange={(e) => setEditDraft({ ...editDraft, inspection_date: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="edit_status">Status do processo</Label>
                                <Select value={editDraft.status} onValueChange={(v) => setEditDraft({ ...editDraft, status: v })}>
                                  <SelectTrigger id="edit_status">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                                    <SelectItem value="completed">Concluído</SelectItem>
                                    <SelectItem value="cancelled">Cancelado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold">{process.process_number}</h3>
                              {getStatusBadge(process.status)}
                              {process._is_linked && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  Acesso Vinculado
                                </Badge>
                              )}
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


                              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" disabled={deleting}>
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir processo definitivamente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação é irreversível. O processo e todos os dados relacionados serão removidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={deleteEditingProcess}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      disabled={deleting}
                                    >
                                      {deleting ? "Excluindo..." : "Excluir definitivamente"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
                              {!process._is_linked && (
                                <Button variant="ghost" onClick={() => startEdit(process)}>
                                  Editar
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
            return (
              <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as "pending" | "in_progress" | "completed")}>
                {displayRows.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-foreground/80">Totais por Vara</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {displayRows.map((r) => (
                        <Badge key={r.court} variant="outline" className="text-xs">
                          {r.court} • N {r.pending} • A {r.in_progress} • C {r.completed} ({r.total})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">Novos ({pendingList.length})</TabsTrigger>
                  <TabsTrigger value="in_progress">Em Andamento ({inProgressList.length})</TabsTrigger>
                  <TabsTrigger value="completed">Concluídos ({completedList.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">{renderList(pendingList)}</TabsContent>
                <TabsContent value="in_progress">{renderList(inProgressList)}</TabsContent>
                <TabsContent value="completed">{renderList(completedList)}</TabsContent>
              </Tabs>
            );
          })()
        )}

      </div>
    </div>
  );
}
