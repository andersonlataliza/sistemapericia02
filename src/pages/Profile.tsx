import { useEffect, useState } from "react";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
 

export default function Profile() {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const { toast } = useToast();
  const [pwdLoading, setPwdLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = await getAuthenticatedUser();
      if (!user) throw new Error("Usuário não autenticado");

      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || "");
        setProfessionalTitle(data.professional_title || "");
        setRegistrationNumber(data.registration_number || "");
        setPhone(data.phone || "");
      }
    } catch (error: any) {
      console.error("Erro ao carregar perfil:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await getAuthenticatedUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          professional_title: professionalTitle,
          registration_number: registrationNumber,
          phone,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Meu Perfil</h1>
            <p className="text-muted-foreground">
              Gerencie suas informações profissionais
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="professionalTitle">Título Profissional</Label>
                  <Input
                    id="professionalTitle"
                    placeholder="Ex: Engenheiro de Segurança do Trabalho"
                    value={professionalTitle}
                    onChange={(e) => setProfessionalTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registro Profissional</Label>
                  <Input
                    id="registrationNumber"
                    placeholder="Ex: CREA 5063101637-SP"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            </CardContent>
          </Card>

 

          <Card className="shadow-card" id="alterar-senha">
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={pwdLoading}
                  onClick={async () => {
                    if (!newPassword || newPassword !== confirmPassword) {
                      toast({ title: "Erro", description: "As senhas devem coincidir", variant: "destructive" });
                      return;
                    }
                    setPwdLoading(true);
                    try {
                      const user = await getAuthenticatedUser();
                      if (!user || !user.email) throw new Error("Sessão inválida");
                      if (!currentPassword) throw new Error("Informe a senha atual");
                      const { error: reauthError } = await supabase.auth.signInWithPassword({
                        email: user.email,
                        password: currentPassword,
                      });
                      if (reauthError) throw new Error("Senha atual incorreta");
                      const { error } = await supabase.auth.updateUser({ password: newPassword });
                      if (error) throw error;
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      toast({ title: "Senha atualizada", description: "Sua senha foi alterada com sucesso." });
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Falha ao atualizar senha";
                      toast({ title: "Erro", description: message, variant: "destructive" });
                    } finally {
                      setPwdLoading(false);
                    }
                  }}
                >
                  {pwdLoading ? "Salvando..." : "Atualizar Senha"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
