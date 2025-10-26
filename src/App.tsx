import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthForm from "./components/auth/AuthForm";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import NewProcess from "./pages/NewProcess";
import ProcessDetail from "./pages/ProcessDetail";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Scheduling from "./pages/Scheduling";
import Payment from "./pages/Payment";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Habilita future flags do React Router v7 para transições e splat */}
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route
              path="/"
              element={session ? <Navigate to="/dashboard" /> : <AuthForm />}
            />
            <Route
              path="/dashboard"
              element={session ? <Dashboard /> : <Navigate to="/" />}
            />
            <Route
              path="/agendamento"
              element={session ? <Scheduling /> : <Navigate to="/" />}
            />
            <Route
              path="/processos"
              element={session ? <Processes /> : <Navigate to="/" />}
            />
            <Route
              path="/pagamento"
              element={session ? <Payment /> : <Navigate to="/" />}
            />
            <Route
              path="/novo-processo"
              element={session ? <NewProcess /> : <Navigate to="/" />}
            />
            <Route
              path="/processo/:id"
              element={session ? <ProcessDetail /> : <Navigate to="/" />}
            />
            <Route
              path="/perfil"
              element={session ? <Profile /> : <Navigate to="/" />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
