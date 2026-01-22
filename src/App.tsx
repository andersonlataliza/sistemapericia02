import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import AuthForm from "./components/auth/AuthForm";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import NewProcess from "./pages/NewProcess";
import ProcessDetail from "./pages/ProcessDetail";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Scheduling from "./pages/Scheduling";
import Payment from "./pages/Payment";
import LinkedUsers from "./pages/LinkedUsers";
import ResetPassword from "./pages/ResetPassword";
import { TesteImagemPDF } from "./components/teste-imagem-pdf";
import ReportConfigPage from "./pages/ReportConfigPage";
import MaterialConsulta from "./pages/MaterialConsulta";
import AdminUsers from "./pages/AdminUsers";
import Blocked from "./pages/Blocked";
import { isAdmin } from "@/utils/adminUtils";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const isBlockedEffective = isBlocked && !isAdminUser;
  const isLinkedUser = Boolean((session?.user as any)?.user_metadata?.is_linked);

  const loginRedirect = () => {
    try {
      const to = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      return `/?redirect=${encodeURIComponent(to)}`;
    } catch {
      return "/";
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadBlockStatus = async () => {
      if (!session?.user?.id) {
        setIsBlocked(false);
        setIsAdminUser(false);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        try {
          const { data: adminData, error: adminError } = await supabase.rpc("is_admin");
          if (adminError) {
            setIsAdminUser(Boolean(session?.user?.email && isAdmin(session.user.email)));
          } else {
            setIsAdminUser(Boolean(adminData));
          }
        } catch {
          setIsAdminUser(Boolean(session?.user?.email && isAdmin(session.user.email)));
        }

        const { data } = await supabase
          .from("profiles")
          .select("is_blocked")
          .eq("id", session.user.id)
          .maybeSingle();
        setIsBlocked(Boolean(data?.is_blocked));
      } finally {
        setProfileLoading(false);
      }
    };

    loadBlockStatus();
  }, [session?.user?.id]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <Toaster />
          <Sonner />
          {/* Habilita future flags do React Router v7 para transições e splat */}
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route
                path="/"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <Navigate to="/dashboard" />) : <AuthForm />}
              />
              <Route path="/bloqueado" element={session ? <Blocked /> : <Navigate to="/" />} />
              <Route
                path="/dashboard"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <Dashboard />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/agendamento"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <Scheduling />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/processos"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <Processes />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/pagamento"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <Payment />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/admin/usuarios"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <AdminUsers />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/novo-processo"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <NewProcess />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/processo/:id"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <ProcessDetail />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/perfil"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <Profile />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/usuarios-vinculados"
                element={
                  session
                    ? (isBlockedEffective
                        ? <Navigate to="/bloqueado" />
                        : (isLinkedUser ? <Navigate to="/dashboard" /> : <LinkedUsers />))
                    : <Navigate to={loginRedirect()} />
                }
              />
              <Route
                path="/reset-password"
                element={<ResetPassword />}
              />
              <Route
                path="/teste-pdf"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <TesteImagemPDF />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/configuracao-relatorio"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <ReportConfigPage />) : <Navigate to={loginRedirect()} />}
              />
              <Route
                path="/material-consulta"
                element={session ? (isBlockedEffective ? <Navigate to="/bloqueado" /> : <MaterialConsulta />) : <Navigate to={loginRedirect()} />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
