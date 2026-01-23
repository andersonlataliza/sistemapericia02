import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Scale, LogOut, User, Users, Lock, Menu, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import NotificationToast from "@/components/notifications/NotificationToast";
import { isAdmin } from "@/utils/adminUtils";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function Navbar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string>("");
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
        let linked = Boolean((session?.user as any)?.user_metadata?.is_linked);
        if (session?.user?.id) {
          try {
            const { data: linkedAccess, error: linkedError } = await supabase
              .from("linked_users")
              .select("id")
              .eq("auth_user_id", session.user.id)
              .eq("status", "active")
              .limit(1);
            if (!linkedError) linked = linked || Boolean(linkedAccess && linkedAccess.length > 0);
          } catch {
          }
        }
        setIsLinked(linked);

        const { data, error } = await supabase.rpc("is_admin");
        if (error) {
          setAdminEnabled(false);
          return;
        }
        setAdminEnabled(Boolean(data));
      } catch {
        setAdminEnabled(false);
      }
    };

    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/");
  };

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      <NotificationToast />
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">SPD</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1">
              <Link to="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link to="/agendamento">
                <Button variant="ghost">Agendamento</Button>
              </Link>
              <Link to="/processos">
                <Button variant="ghost">Processos</Button>
              </Link>
              {!isLinked && (
                <Link to="/configuracao-relatorio">
                  <Button variant="ghost">Configuração do Relatório</Button>
                </Link>
              )}
              <Link to="/material-consulta">
                <Button variant="ghost">Material de Consulta</Button>
              </Link>
              {!isLinked && (
                <Link to="/usuarios-vinculados">
                  <Button variant="ghost">Usuários Vinculados</Button>
                </Link>
              )}
              {(adminEnabled || isAdmin(userEmail)) && (
                <Link to="/pagamento">
                  <Button variant="ghost">Pagamento</Button>
                </Link>
              )}
              {(adminEnabled || isAdmin(userEmail)) && (
                <Link to="/admin/usuarios">
                  <Button variant="ghost">Admin</Button>
                </Link>
              )}
              <Link to="/novo-processo">
                <Button variant="default">Novo Processo</Button>
              </Link>
            </div>

            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Abrir menu">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Navegue para as seções do sistema.
                  </SheetDescription>
                  <div className="flex flex-col gap-2 mt-8">
                    <Button variant="ghost" className="justify-start" onClick={() => navigate("/dashboard")}>Dashboard</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => navigate("/agendamento")}>Agendamento</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => navigate("/processos")}>Processos</Button>
                    {!isLinked && (
                      <Button variant="ghost" className="justify-start" onClick={() => navigate("/configuracao-relatorio")}>Configuração do Relatório</Button>
                    )}
                    <Button variant="ghost" className="justify-start" onClick={() => navigate("/material-consulta")}>Material de Consulta</Button>
                    {!isLinked && (
                      <Button variant="ghost" className="justify-start" onClick={() => navigate("/usuarios-vinculados")}>Usuários Vinculados</Button>
                    )}
                    {(adminEnabled || isAdmin(userEmail)) && (
                      <Button variant="ghost" className="justify-start" onClick={() => navigate("/pagamento")}>Pagamento</Button>
                    )}
                    {(adminEnabled || isAdmin(userEmail)) && (
                      <Button variant="ghost" className="justify-start" onClick={() => navigate("/admin/usuarios")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Admin
                      </Button>
                    )}
                    <Button variant="default" className="justify-start" onClick={() => navigate("/novo-processo")}>Novo Processo</Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <NotificationCenter />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {userEmail.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Minha Conta</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/perfil")}>
                  <User className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/perfil#alterar-senha")}>
                  <Lock className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
