import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, Eye, AlertCircle, UserPlus } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Tables, Json } from "@/integrations/supabase/types";
import { validateCPFWithMessage, formatCPF, cleanCPF } from "@/utils/cpfUtils";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface Permissions {
  view_processes: boolean;
  view_documents: boolean;
  view_reports: boolean;
  view_payment: boolean;
  professional?: {
    profession?: string;
    council_number?: string;
    council_registry?: string;
  };
}

type LinkedUser = Omit<Tables<'linked_users'>, 'permissions'> & {
  permissions: Permissions;
};

interface ProcessAccess {
  id: string;
  process_id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
}

interface FormData {
  cpf: string;
  name: string;
  email: string;
  phone: string;
  permissions: Permissions;
  profession?: string;
  council_number?: string;
  council_registry?: string;
}

export default function LinkedUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<LinkedUser | null>(null);
  const [selectedLinkedUser, setSelectedLinkedUser] = useState<LinkedUser | null>(null);
  const [processAccess, setProcessAccess] = useState<ProcessAccess[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    cpf: '',
    name: '',
    email: '',
    phone: '',
    permissions: {
      view_processes: true,
      view_documents: false,
      view_reports: false,
      view_payment: false,
    },
    profession: '',
    council_number: '',
    council_registry: ''
  });

  const loadLinkedUsers = useCallback(async (ownerUserId?: string) => {
    try {
      const ownerId = ownerUserId || user?.id;
      if (!ownerId) return;

      const { data, error } = await supabase
        .from('linked_users')
        .select('*')
        .eq('owner_user_id', ownerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalizePermissions = (p: any): Permissions => ({
        view_processes: Boolean(p?.view_processes ?? true),
        view_documents: Boolean(p?.view_documents ?? false),
        view_reports: Boolean(p?.view_reports ?? false),
        view_payment: Boolean(p?.view_payment ?? false),
        professional: {
          profession: p?.professional?.profession ?? '',
          council_number: p?.professional?.council_number ?? '',
          council_registry: p?.professional?.council_registry ?? '',
        },
      });

      const normalized = (data || []).map((u) => ({
        ...u,
        permissions: normalizePermissions(u.permissions as any),
      }));

      setLinkedUsers(normalized as LinkedUser[]);
    } catch (error) {
      console.error('Error loading linked users:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários vinculados.",
        variant: "destructive",
      });
    }
  }, [toast, user?.id]);

  const loadProcesses = useCallback(async (ownerUserId?: string) => {
    try {
      const ownerId = ownerUserId || user?.id;
      if (!ownerId) return;

      const { data, error } = await supabase
        .from('processes')
        .select('id, process_number, claimant_name, defendant_name, status')
        .eq('user_id', ownerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProcesses(data || []);
    } catch (error) {
      console.error('Error loading processes:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const authUser = await getAuthenticatedUser();
        if (!authUser) {
          navigate('/');
          return;
        }
        setUser(authUser);

        await Promise.all([
          loadLinkedUsers(authUser.id),
          loadProcesses(authUser.id)
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [loadLinkedUsers, loadProcesses, navigate, toast]);

  const loadProcessAccess = async (linkedUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('process_access')
        .select(`
          id,
          process_id,
          processes!inner(
            process_number,
            claimant_name,
            defendant_name
          )
        `)
        .eq('linked_user_id', linkedUserId);

      if (error) throw error;
      
      const accessData = data?.map(item => ({
        id: item.id,
        process_id: item.process_id,
        process_number: (item.processes as any).process_number,
        claimant_name: (item.processes as any).claimant_name,
        defendant_name: (item.processes as any).defendant_name,
      })) || [];
      
      setProcessAccess(accessData);
      setSelectedProcesses(accessData.map(item => item.process_id));
    } catch (error) {
      console.error('Error loading process access:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cpfValidation = validateCPFWithMessage(formData.cpf);
    if (!cpfValidation.isValid) {
      toast({
        title: "CPF Inválido",
        description: cpfValidation.message,
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Por favor, informe o nome do usuário.",
        variant: "destructive",
      });
      return;
    }

    try {
      const cleanedCPF = cleanCPF(formData.cpf);
      const currentUser = user || (await getAuthenticatedUser());
      
      if (editingUser) {
        const { error } = await supabase
          .from('linked_users')
          .update({
            linked_user_cpf: cleanedCPF,
            linked_user_name: formData.name,
            linked_user_email: formData.email || null,
            linked_user_phone: formData.phone || null,
            permissions: ({
              ...formData.permissions,
              professional: {
                profession: formData.profession || '',
                council_number: formData.council_number || '',
                council_registry: formData.council_registry || '',
              }
            } as unknown) as Json,
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Usuário vinculado atualizado com sucesso!",
        });
      } else {
        if (!currentUser) {
          toast({
            title: "Erro",
            description: "Usuário não autenticado.",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from('linked_users')
          .insert({
            owner_user_id: currentUser.id,
            linked_user_cpf: cleanedCPF,
            linked_user_name: formData.name,
            linked_user_email: formData.email || null,
            linked_user_phone: formData.phone || null,
            permissions: ({
              ...formData.permissions,
              professional: {
                profession: formData.profession || '',
                council_number: formData.council_number || '',
                council_registry: formData.council_registry || '',
              }
            } as unknown) as Json,
          });

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Usuário vinculado cadastrado com sucesso!",
        });
      }

      await loadLinkedUsers();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving linked user:', error);
      
      if (error.code === '23505') {
        toast({
          title: "CPF já cadastrado",
          description: "Este CPF já está vinculado à sua conta.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao salvar usuário vinculado. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = (linkedUser: LinkedUser) => {
    setEditingUser(linkedUser);
    setFormData({
      cpf: formatCPF(linkedUser.linked_user_cpf),
      name: linkedUser.linked_user_name,
      email: linkedUser.linked_user_email || '',
      phone: linkedUser.linked_user_phone || '',
      permissions: linkedUser.permissions,
      profession: linkedUser.permissions?.professional?.profession || '',
      council_number: linkedUser.permissions?.professional?.council_number || '',
      council_registry: linkedUser.permissions?.professional?.council_registry || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (linkedUser: LinkedUser) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${linkedUser.linked_user_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('linked_users')
        .delete()
        .eq('id', linkedUser.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Usuário vinculado excluído com sucesso!",
      });

      await loadLinkedUsers();
    } catch (error) {
      console.error('Error deleting linked user:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir usuário vinculado.",
        variant: "destructive",
      });
    }
  };

  const handleManageAccess = async (linkedUser: LinkedUser) => {
    setSelectedLinkedUser(linkedUser);
    await loadProcessAccess(linkedUser.id);
    setIsAccessDialogOpen(true);
  };

  const handleSaveAccess = async () => {
    if (!selectedLinkedUser || !user) return;

    try {
      // Remove acessos existentes
      await supabase
        .from('process_access')
        .delete()
        .eq('linked_user_id', selectedLinkedUser.id);

      // Adiciona novos acessos
      if (selectedProcesses.length > 0) {
        const accessData = selectedProcesses.map(processId => ({
          process_id: processId,
          linked_user_id: selectedLinkedUser.id,
          granted_by: user.id
        }));

        const { error } = await supabase
          .from('process_access')
          .insert(accessData);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Acessos atualizados com sucesso!",
      });

      setIsAccessDialogOpen(false);
    } catch (error) {
      console.error('Error saving access:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar acessos.",
        variant: "destructive",
      });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({
      cpf: '',
      name: '',
      email: '',
      phone: '',
      permissions: {
        view_processes: true,
        view_documents: false,
        view_reports: false,
        view_payment: false,
      },
      profession: '',
      council_number: '',
      council_registry: ''
    });
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, cpf: formatted }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando usuários vinculados...</p>
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
              <Button onClick={() => navigate('/')}>
                Fazer Login
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
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Usuários Vinculados</h1>
            <p className="text-muted-foreground">
              Gerencie usuários que podem visualizar seus processos através do CPF
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Como o usuário vinculado acessa o sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>1) Aqui você cadastra o CPF e define permissões de visualização.</div>
            <div>2) O usuário vinculado cria o próprio login e senha na tela inicial do sistema.</div>
            <div>3) Ele deve usar o mesmo CPF no cadastro para que os processos apareçam.</div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {linkedUsers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum usuário vinculado</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Cadastre usuários para que eles possam visualizar seus processos através do CPF.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Usuário
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {linkedUsers.map((linkedUser) => (
                <Card key={linkedUser.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {linkedUser.linked_user_name}
                          <Badge variant={linkedUser.status === 'active' ? 'default' : 'secondary'}>
                            {linkedUser.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          CPF: {formatCPF(linkedUser.linked_user_cpf)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageAccess(linkedUser)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Acessos
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(linkedUser)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(linkedUser)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Email</Label>
                        <p className="text-sm text-muted-foreground">
                          {linkedUser.linked_user_email || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Telefone</Label>
                        <p className="text-sm text-muted-foreground">
                          {linkedUser.linked_user_phone || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Permissões</Label>
                        <div className="flex gap-2 mt-1">
                          {linkedUser.permissions.view_processes && (
                            <Badge variant="outline" className="text-xs">Processos</Badge>
                          )}
                          {linkedUser.permissions.view_documents && (
                            <Badge variant="outline" className="text-xs">Documentos</Badge>
                          )}
                          {linkedUser.permissions.view_reports && (
                            <Badge variant="outline" className="text-xs">Relatórios</Badge>
                          )}
                          {linkedUser.permissions.view_payment && (
                            <Badge variant="outline" className="text-xs">Pagamento</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Dialog para cadastro/edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuário Vinculado' : 'Novo Usuário Vinculado'}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do usuário e configure as permissões.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3 rounded-md border p-4">
                <h4 className="text-base font-semibold">Dados Pessoais</h4>
                <Separator className="bg-muted-foreground my-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={handleCPFChange}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome completo do usuário"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email (usuário de login)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Login e senha não são criados nesta tela. O usuário vinculado deve criar a própria conta na tela inicial do sistema e informar o mesmo CPF.
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <h4 className="text-base font-semibold">Dados Profissionais</h4>
                <Separator className="bg-muted-foreground my-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="profession">Profissão</Label>
                    <Input
                      id="profession"
                      value={formData.profession}
                      onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                      placeholder="Ex.: Médico, Engenheiro, Advogado"
                    />
                  </div>

                  <div>
                    <Label htmlFor="council_number">Nº do Conselho de Classe</Label>
                    <Input
                      id="council_number"
                      value={formData.council_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, council_number: e.target.value }))}
                      placeholder="Ex.: CRM 123456/SP, CREA 000000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="council_registry">Cadastro do Conselho de Classe</Label>
                    <Input
                      id="council_registry"
                      value={formData.council_registry}
                      onChange={(e) => setFormData(prev => ({ ...prev, council_registry: e.target.value }))}
                      placeholder="Identificador de cadastro no conselho"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <h4 className="text-base font-semibold">Permissões</h4>
                <Separator className="bg-muted-foreground my-2" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_processes" className="text-sm">Visualizar Processos</Label>
                    <Switch
                      id="view_processes"
                      checked={formData.permissions.view_processes}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, view_processes: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_documents" className="text-sm">Visualizar Documentos</Label>
                    <Switch
                      id="view_documents"
                      checked={formData.permissions.view_documents}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, view_documents: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_reports" className="text-sm">Visualizar Relatórios</Label>
                    <Switch
                      id="view_reports"
                      checked={formData.permissions.view_reports}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, view_reports: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_payment" className="text-sm">Visualizar Pagamento</Label>
                    <Switch
                      id="view_payment"
                      checked={formData.permissions.view_payment}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, view_payment: checked }
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="sticky bottom-0 bg-background border-t pt-3 z-10">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingUser ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para gerenciar acessos */}
        <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Gerenciar Acessos - {selectedLinkedUser?.linked_user_name}
              </DialogTitle>
              <DialogDescription>
                Selecione quais processos este usuário pode visualizar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              
              <div className="max-h-60 overflow-y-auto space-y-2">
                {processes.map((process) => (
                  <div key={process.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={process.id}
                      checked={selectedProcesses.includes(process.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProcesses(prev => [...prev, process.id]);
                        } else {
                          setSelectedProcesses(prev => prev.filter(id => id !== process.id));
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor={process.id} className="text-sm cursor-pointer">
                      <span className="font-medium">{process.process_number}</span>
                      <br />
                      <span className="text-muted-foreground">
                        {process.claimant_name} vs {process.defendant_name}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <DialogFooter className="sticky bottom-0 bg-background border-t pt-3 z-10">
              <Button type="button" variant="outline" onClick={() => setIsAccessDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAccess}>
                Salvar Acessos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
