import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { supabase, getAuthenticatedUser, validateAndRecoverSession } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Plus, Shield, Trash2, UserCheck, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/integrations/supabase/types";
import { SupabaseAPI } from "@/integrations/supabase/api";
import { isAdmin } from "@/utils/adminUtils";
import { validateCPFWithMessage, cleanCPF } from "@/utils/cpfUtils";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type AdminUserRow = Pick<
  ProfileRow,
  "id" | "full_name" | "email" | "phone" | "created_at" | "is_blocked" | "blocked_at" | "blocked_reason"
>;

type AdminDatabaseUsageRow = {
  db_size_bytes: number | null;
  processes_table_bytes: number | null;
};

type AdminUserUsageRow = {
  user_id: string;
  processes_count: number | null;
  processes_bytes: number | null;
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

const formatBytes = (bytes?: number | null) => {
  const n = typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0;
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let v = n;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : idx === 1 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[idx]}`;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [blockingSupported, setBlockingSupported] = useState(true);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  const [usageLoading, setUsageLoading] = useState(false);
  const [dbUsage, setDbUsage] = useState<AdminDatabaseUsageRow | null>(null);
  const [usersUsage, setUsersUsage] = useState<Record<string, AdminUserUsageRow>>({});
  const [usageSupported, setUsageSupported] = useState(() => {
    try {
      return sessionStorage.getItem('admin_usage_rpc_missing') === '1' ? false : true;
    } catch {
      return true;
    }
  });
  const [usageNotInstalledToastShown, setUsageNotInstalledToastShown] = useState(() => {
    try {
      return sessionStorage.getItem('admin_usage_rpc_missing_toast') === '1';
    } catch {
      return false;
    }
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<AdminUserRow | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    email: "",
    password: "",
    fullName: "",
    cpf: "",
    phone: "",
    makeAdmin: false,
  });
  const [creating, setCreating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await validateAndRecoverSession();
        if (!session) {
          toast({
            title: "Sessão Expirada",
            description: "Faça login novamente para continuar.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        const u = await getAuthenticatedUser();
        if (!u) {
          toast({
            title: "Erro de Autenticação",
            description: "Não foi possível verificar sua identidade. Faça login novamente.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setUser(u);

        try {
          const { data, error } = await supabase.rpc('is_admin');
          if (error) {
            setAdminEnabled(isAdmin(u.email));
          } else {
            setAdminEnabled(Boolean(data));
          }
        } catch {
          setAdminEnabled(isAdmin(u.email));
        }
      } catch (error) {
        toast({
          title: "Erro de Conexão",
          description: "Verifique sua conexão com a internet.",
          variant: "destructive",
        });
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [toast, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await SupabaseAPI.adminListUsers();
      
      if (!response.success) {
        throw new Error(response.error || "Falha ao listar usuários");
      }

      // Normalizar dados vindos da Edge Function
      const normalized = (response.users || []).map((r: any) => ({
        id: r.id,
        full_name: r.full_name ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        created_at: r.created_at ?? null,
        is_blocked: r.is_blocked ?? false,
        blocked_at: r.blocked_at ?? null,
        blocked_reason: r.blocked_reason ?? null,
        ...r // preserva outros campos que possam vir
      }));

      setUsers(normalized as AdminUserRow[]);
      
      setBlockingSupported(response.blockingSupported !== false);
    } catch (error: any) {
      try {
        const trySelect = async (select: string, orderByCreatedAt: boolean) => {
          let q = supabase.from("profiles").select(select);
          if (orderByCreatedAt) {
            q = q.order("created_at", { ascending: false });
          }
          const { data, error } = await q;
          return { data, error };
        };

        const isMissingColumnError = (e: any) => {
          const msg = String(e?.message || "");
          const code = String(e?.code || "");
          return code === '42703' || /does not exist|undefined column|column\s+.+\s+does not exist/i.test(msg);
        };

        const candidates = [
          { select: "id, full_name, email, phone, created_at", order: true },
          { select: "id, full_name, phone, created_at", order: true },
          { select: "id, full_name, created_at", order: true },
          { select: "id, full_name, email, phone", order: false },
          { select: "id, full_name, phone", order: false },
          { select: "id, full_name", order: false },
          { select: "id", order: false },
        ];

        let rows: any[] | null = null;
        for (const c of candidates) {
          const { data, error } = await trySelect(c.select, c.order);
          if (!error) {
            rows = (data || []) as any[];
            break;
          }
          if (!isMissingColumnError(error)) {
            break;
          }
        }

        if (rows) {
          const normalizedFallback = (rows || []).map((r: any) => ({
            id: r.id,
            full_name: r.full_name ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
            created_at: r.created_at ?? null,
            is_blocked: false,
            blocked_at: null,
            blocked_reason: null,
          }));
          setUsers(normalizedFallback as AdminUserRow[]);
          setBlockingSupported(false);
          return;
        }
      } catch {}

      console.error("Erro em fetchUsers:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: error?.message || "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAdmins = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('admin_users').select('user_id');
      if (error) {
        return;
      }
      setAdminUserIds(new Set((data || []).map((r: any) => r.user_id)));
    } catch {}
  }, []);

  const fetchUsage = useCallback(async (opts?: { force?: boolean }) => {
    if (!usageSupported && !opts?.force) {
      return;
    }
    setUsageLoading(true);
    try {
      const [{ data: dbData, error: dbError }, { data: usersData, error: usersError }] = await Promise.all([
        supabase.rpc('admin_database_usage'),
        supabase.rpc('admin_users_usage'),
      ]);

      if (dbError) {
        throw dbError;
      }
      if (usersError) {
        throw usersError;
      }

      const row = Array.isArray(dbData) ? (dbData[0] as any) : (dbData as any);
      if (row) {
        setDbUsage({
          db_size_bytes: (row as any).db_size_bytes ?? null,
          processes_table_bytes: (row as any).processes_table_bytes ?? null,
        });
      } else {
        setDbUsage(null);
      }

      const map: Record<string, AdminUserUsageRow> = {};
      (Array.isArray(usersData) ? usersData : []).forEach((r: any) => {
        if (!r?.user_id) return;
        map[String(r.user_id)] = {
          user_id: String(r.user_id),
          processes_count: (r as any).processes_count ?? null,
          processes_bytes: (r as any).processes_bytes ?? null,
        };
      });
      setUsersUsage(map);

      if (!usageSupported) {
        setUsageSupported(true);
      }
      if (usageNotInstalledToastShown) {
        setUsageNotInstalledToastShown(false);
      }
      try {
        sessionStorage.removeItem('admin_usage_rpc_missing');
        sessionStorage.removeItem('admin_usage_rpc_missing_toast');
      } catch {}
    } catch (error: any) {
      const msg = String(error?.message || "");
      const details = String(error?.details || "");
      const hint = String(error?.hint || "");
      const raw = `${msg} ${details} ${hint}`.toLowerCase();
      const status = (error as any)?.status ?? (error as any)?.statusCode;
      const isMissingRpc =
        status === 404 ||
        raw.includes('could not find the function') ||
        raw.includes('schema cache') ||
        raw.includes('not found') ||
        raw.includes('404');

      setDbUsage(null);
      setUsersUsage({});

      if (isMissingRpc) {
        setUsageSupported(false);
        try {
          sessionStorage.setItem('admin_usage_rpc_missing', '1');
        } catch {}
        if (!usageNotInstalledToastShown) {
          setUsageNotInstalledToastShown(true);
          try {
            sessionStorage.setItem('admin_usage_rpc_missing_toast', '1');
          } catch {}
          toast({
            title: 'Uso do banco indisponível',
            description: 'As funções de uso (admin_database_usage/admin_users_usage) ainda não foram instaladas no Supabase.',
          });
        }
        return;
      }

      toast({
        title: 'Uso do banco indisponível',
        description: error?.message || 'Não foi possível carregar os dados de uso.',
        variant: 'destructive',
      });
    } finally {
      setUsageLoading(false);
    }
  }, [toast, usageSupported, usageNotInstalledToastShown]);

  useEffect(() => {
    if (!user || authLoading) return;
    fetchUsers();
    fetchAdmins();
    fetchUsage();
  }, [user, authLoading, fetchUsers, fetchAdmins, fetchUsage]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !s ||
        u.email?.toLowerCase().includes(s) ||
        u.full_name?.toLowerCase().includes(s) ||
        u.phone?.toLowerCase().includes(s);
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "blocked" ? u.is_blocked : !u.is_blocked);
      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const openBlockDialog = (row: AdminUserRow) => {
    setDialogTarget(row);
    setBlockReason(row.blocked_reason || "");
    setDialogOpen(true);
  };

  const openDeleteDialog = (row: AdminUserRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const deleteUser = async () => {
    if (!deleteTarget || !user) return;

    if (user.id === deleteTarget.id) {
      toast({
        title: "Ação não permitida",
        description: "Não é possível deletar o próprio usuário.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const res = await SupabaseAPI.adminDeleteUser({ userId: deleteTarget.id });
      if (!res?.success) {
        throw new Error(res?.error || "Falha ao deletar usuário");
      }

      toast({
        title: "Usuário deletado",
        description: deleteTarget.email || deleteTarget.full_name || "Usuário removido.",
      });

      setDeleteOpen(false);
      setDeleteTarget(null);
      await fetchAdmins();
      await fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar usuário",
        description: error?.message || "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const saveBlockStatus = async (nextBlocked: boolean) => {
    if (!dialogTarget) return;

    if (!blockingSupported) {
      toast({
        title: "Funcionalidade indisponível",
        description: "O banco ainda não tem os campos de bloqueio em profiles.",
        variant: "destructive",
      });
      return;
    }

    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      toast({ title: "Erro de Autenticação", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updatePayload: TablesUpdate<"profiles"> = nextBlocked
        ? {
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_reason: blockReason || "Bloqueado pelo administrador",
            blocked_by: currentUser.id,
          }
        : {
            is_blocked: false,
            blocked_at: null,
            blocked_reason: null,
            blocked_by: null,
          };

      const { error } = await supabase.from("profiles").update(updatePayload).eq("id", dialogTarget.id);
      if (error) {
        toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" });
        return;
      }

      setUsers((prev) => prev.map((p) => (p.id === dialogTarget.id ? ({ ...p, ...updatePayload } as any) : p)));

      toast({
        title: nextBlocked ? "Usuário bloqueado" : "Usuário desbloqueado",
        description: nextBlocked ? "Acesso do usuário foi bloqueado." : "Acesso do usuário foi liberado.",
      });

      setDialogOpen(false);
      setDialogTarget(null);
      setBlockReason("");
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao atualizar usuário", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    const email = createDraft.email.trim().toLowerCase();
    const password = createDraft.password;
    if (!email || !email.includes('@')) {
      toast({ title: 'Email inválido', description: 'Informe um email válido.', variant: 'destructive' });
      return;
    }
    if (!password || password.length < 6) {
      toast({ title: 'Senha inválida', description: 'Senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }

    // Validação de CPF
    let cpfToSend: string | undefined = undefined;
    if (createDraft.cpf && createDraft.cpf.trim()) {
      const cpfRes = validateCPFWithMessage(createDraft.cpf);
      if (!cpfRes.isValid) {
        toast({ title: 'CPF inválido', description: cpfRes.message, variant: 'destructive' });
        return;
      }
      cpfToSend = cleanCPF(createDraft.cpf);
    }

    setCreating(true);
    try {
      const res = await SupabaseAPI.adminCreateUser({
        email,
        password,
        fullName: createDraft.fullName.trim() || undefined,
        cpf: cpfToSend,
        phone: createDraft.phone.trim() || undefined,
        makeAdmin: Boolean(createDraft.makeAdmin),
      });

      if (!res?.success) {
        toast({ title: 'Erro ao criar usuário', description: res?.error || 'Falha ao criar usuário', variant: 'destructive' });
        return;
      }

      // Workaround: Forçar criação do perfil caso trigger falhe
      if (res.user?.id) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: res.user.id,
          email: email,
          full_name: createDraft.fullName.trim() || null,
          phone: createDraft.phone.trim() || null,
          updated_at: new Date().toISOString(),
        });
        if (profileError) {
          console.error("Aviso: Falha ao criar perfil manual:", profileError);
        }
      }

      toast({ title: 'Usuário criado', description: email });
      setCreateOpen(false);
      setCreateDraft({ email: '', password: '', fullName: '', cpf: '', phone: '', makeAdmin: false });
      await fetchUsers();
      await fetchAdmins();
    } catch (error: any) {
      toast({ title: 'Erro', description: error?.message || 'Falha ao criar usuário', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleAdmin = async (target: AdminUserRow) => {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser) {
      toast({ title: 'Erro de Autenticação', description: 'Sessão expirada. Faça login novamente.', variant: 'destructive' });
      return;
    }

    if (currentUser.id === target.id) {
      toast({ title: 'Ação não permitida', description: 'Não é possível alterar seu próprio perfil de admin.', variant: 'destructive' });
      return;
    }

    const isTargetAdmin = adminUserIds.has(target.id);
    try {
      if (isTargetAdmin) {
        const { error } = await supabase.from('admin_users').delete().eq('user_id', target.id);
        if (error) {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          return;
        }
      } else {
        const { error } = await supabase
          .from('admin_users')
          .insert({ user_id: target.id, email: target.email || null, created_by: currentUser.id });
        if (error) {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          return;
        }
      }

      await fetchAdmins();
      toast({ title: 'Permissão atualizada', description: isTargetAdmin ? 'Admin removido.' : 'Admin concedido.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error?.message || 'Falha ao atualizar admin', variant: 'destructive' });
    }
  };

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
              <Button onClick={() => navigate("/")}>Fazer Login</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!(adminEnabled || isAdmin(user.email))) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground mb-4">Esta página é restrita apenas para administradores.</p>
              <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
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
              <Shield className="w-5 h-5" />
              Administração de Usuários
            </CardTitle>
            <p className="text-sm text-muted-foreground">Gerencie acesso e bloqueio por inadimplência.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="search">Buscar</Label>
                <Input
                  id="search"
                  placeholder="Nome, email ou telefone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={statusFilter === "all" ? "default" : "outline"}
                    onClick={() => setStatusFilter("all")}
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant={statusFilter === "active" ? "default" : "outline"}
                    onClick={() => setStatusFilter("active")}
                  >
                    Ativos
                  </Button>
                  <Button
                    type="button"
                    variant={statusFilter === "blocked" ? "default" : "outline"}
                    onClick={() => setStatusFilter("blocked")}
                  >
                    Bloqueados
                  </Button>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong>{filtered.length}</strong> usuário(s)
                  </p>
                  <p>
                    Banco: <strong>{usageSupported ? (usageLoading ? 'Carregando...' : formatBytes(dbUsage?.db_size_bytes)) : 'Indisponível'}</strong>
                  </p>
                  <p>
                    Tabela processos: <strong>{usageSupported ? (usageLoading ? 'Carregando...' : formatBytes(dbUsage?.processes_table_bytes)) : 'Indisponível'}</strong>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={async () => { await fetchUsers(); await fetchAdmins(); await fetchUsage({ force: true }); }} disabled={loading}>
                    Atualizar
                  </Button>
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar usuário
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Carregando usuários...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const u = usageSupported ? usersUsage[row.id] : undefined;
                    const count = u?.processes_count ?? 0;
                    const bytes = u?.processes_bytes ?? 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.full_name || "-"}</TableCell>
                        <TableCell>{row.email || "-"}</TableCell>
                        <TableCell>{row.phone || "-"}</TableCell>
                        <TableCell>{formatDate(row.created_at)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              <strong>{usageSupported ? count : '-'}</strong> processo(s)
                            </div>
                            <div className="text-muted-foreground">{usageSupported ? formatBytes(bytes) : 'Indisponível'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {adminUserIds.has(row.id) ? <Badge>Sim</Badge> : <Badge variant="secondary">Não</Badge>}
                        </TableCell>
                        <TableCell>
                          {row.is_blocked ? <Badge variant="destructive">Bloqueado</Badge> : <Badge variant="secondary">Ativo</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              type="button"
                              variant={adminUserIds.has(row.id) ? "outline" : "secondary"}
                              onClick={() => toggleAdmin(row)}
                              disabled={user.id === row.id}
                            >
                              {adminUserIds.has(row.id) ? "Remover admin" : "Tornar admin"}
                            </Button>
                            <Button
                              type="button"
                              variant={row.is_blocked ? "outline" : "destructive"}
                              onClick={() => openBlockDialog(row)}
                            >
                              {row.is_blocked ? (
                                <span className="inline-flex items-center gap-2">
                                  <UserCheck className="w-4 h-4" />
                                  Desbloquear
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <UserX className="w-4 h-4" />
                                  Bloquear
                                </span>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => openDeleteDialog(row)}
                              disabled={user.id === row.id}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                Deletar
                              </span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar usuário</DialogTitle>
              <DialogDescription>O usuário já nasce vinculado ao próprio perfil.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  value={createDraft.email}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@dominio.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password">Senha inicial</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createDraft.password}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, password: e.target.value }))}
                  placeholder="mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-name">Nome</Label>
                <Input
                  id="create-name"
                  value={createDraft.fullName}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, fullName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="create-cpf">CPF</Label>
                  <Input
                    id="create-cpf"
                    value={createDraft.cpf}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, cpf: e.target.value }))}
                    placeholder="00000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-phone">Telefone</Label>
                  <Input
                    id="create-phone"
                    value={createDraft.phone}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">Administrador</div>
                  <div className="text-sm text-muted-foreground">Permitir acesso ao painel e pagamentos.</div>
                </div>
                <Button
                  type="button"
                  variant={createDraft.makeAdmin ? "default" : "outline"}
                  onClick={() => setCreateDraft((p) => ({ ...p, makeAdmin: !p.makeAdmin }))}
                >
                  {createDraft.makeAdmin ? "Sim" : "Não"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button type="button" onClick={createUser} disabled={creating}>
                {creating ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogTarget?.is_blocked ? "Desbloquear usuário" : "Bloquear usuário"}
              </DialogTitle>
              <DialogDescription>
                {dialogTarget?.email || dialogTarget?.full_name || "Usuário"}
              </DialogDescription>
            </DialogHeader>

            {!dialogTarget?.is_blocked && (
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo do bloqueio</Label>
                <Textarea
                  id="reason"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ex.: Pagamento em atraso"
                />
              </div>
            )}

            {dialogTarget?.is_blocked && dialogTarget.blocked_reason && (
              <div className="space-y-2">
                <Label>Motivo atual</Label>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{dialogTarget.blocked_reason}</div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              {dialogTarget?.is_blocked ? (
                <Button type="button" onClick={() => saveBlockStatus(false)} disabled={saving}>
                  {saving ? "Salvando..." : "Desbloquear"}
                </Button>
              ) : (
                <Button type="button" variant="destructive" onClick={() => saveBlockStatus(true)} disabled={saving}>
                  {saving ? "Salvando..." : "Bloquear"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deletar usuário</DialogTitle>
              <DialogDescription>
                {deleteTarget?.email || deleteTarget?.full_name || "Usuário"}
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm text-muted-foreground">
              Essa ação remove o usuário e os dados vinculados.
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={deleteUser} disabled={deleting}>
                {deleting ? "Deletando..." : "Deletar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
