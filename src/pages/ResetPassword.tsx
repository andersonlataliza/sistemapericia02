import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });
    return () => { data.subscription.unsubscribe(); };
  }, []);

  const sendResetEmail = async () => {
    if (!email) {
      toast({ title: "Erro", description: "Informe o email", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      toast({ title: "Email enviado", description: "Verifique sua caixa de entrada." });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao enviar email", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas devem coincidir", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Senha atualizada", description: "Faça login com a nova senha." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao atualizar senha", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Reset de Senha
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {isRecovery ? "Defina sua nova senha" : "Envie o link de recuperação"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isRecovery && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite o email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-3 pt-4">
                <Button onClick={sendResetEmail} disabled={isLoading} className="w-full">
                  {isLoading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
                <Button onClick={() => navigate("/")} variant="ghost" className="w-full">
                  Voltar ao Login
                </Button>
              </div>
            </>
          )}
          {isRecovery && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Nova Senha
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirmar Senha
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-3 pt-4">
                <Button onClick={updatePassword} disabled={isLoading} className="w-full">
                  {isLoading ? "Salvando..." : "Definir nova senha"}
                </Button>
                <Button onClick={() => navigate("/")} variant="ghost" className="w-full">
                  Voltar ao Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
