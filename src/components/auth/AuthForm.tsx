import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Scale, AlertCircle, CheckCircle } from "lucide-react";

export default function AuthForm() {
  const navigate = useNavigate();
  const [isLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
    cpf?: string;
  }>({});
  const [validationSuccess, setValidationSuccess] = useState<{
    email?: boolean;
    password?: boolean;
    fullName?: boolean;
    cpf?: boolean;
  }>({});
  const { toast } = useToast();

  const redirectTarget = (() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("redirect");
      if (!raw) return "";
      const decoded = decodeURIComponent(raw);
      return decoded.startsWith("/") ? decoded : "";
    } catch {
      return "";
    }
  })();

  // Validações em tempo real
  useEffect(() => {
    const validateFields = () => {
      const errors: typeof validationErrors = {};
      const success: typeof validationSuccess = {};

      // Validação de email
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.email = "Email deve ter um formato válido";
        } else {
          success.email = true;
        }
      }

      // Validação de senha
      if (password) {
        if (password.length < 6) {
          errors.password = "Senha deve ter pelo menos 6 caracteres";
        } else {
          success.password = true;
        }
      }


      setValidationErrors(errors);
      setValidationSuccess(success);
    };

    const debounceTimer = setTimeout(validateFields, 300);
    return () => clearTimeout(debounceTimer);
  }, [email, password, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      toast({
        title: "Configuração do Supabase ausente",
        description: "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) e reinicie o servidor.",
        variant: "destructive",
      });
      return;
    }
    
    // Validação final antes do envio
    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: "Dados inválidos",
        description: "Corrija os erros antes de continuar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Login realizado com sucesso",
          description: "Bem-vindo de volta!",
        });

        navigate(redirectTarget || "/dashboard", { replace: true });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Informe seu email", description: "Digite o email para enviar o link de recuperação.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      toast({ title: "Email enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Falha ao enviar email de recuperação", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Sistema Pericial Digital</CardTitle>
          <CardDescription>
            Entre com suas credenciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`pr-10 ${validationErrors.email ? 'border-red-500' : validationSuccess.email ? 'border-green-500' : ''}`}
                />
                {validationSuccess.email && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {validationErrors.email && (
                  <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
              </div>
              {validationErrors.email && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationErrors.email}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`pr-10 ${validationErrors.password ? 'border-red-500' : validationSuccess.password ? 'border-green-500' : ''}`}
                />
                {validationSuccess.password && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {validationErrors.password && (
                  <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
              </div>
              {validationErrors.password && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationErrors.password}</AlertDescription>
                </Alert>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Processando..." : isLogin ? "Entrar" : "Criar Conta"}
            </Button>
            {isLogin && (
              <Button type="button" variant="link" className="w-full" onClick={handleForgotPassword}>
                Esqueci minha senha
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
