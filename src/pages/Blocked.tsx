import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogOut } from "lucide-react";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Blocked() {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getAuthenticatedUser();
        if (!user) {
          navigate("/");
          return;
        }

        const { data } = await supabase.from("profiles").select("blocked_reason").eq("id", user.id).maybeSingle();
        setReason(data?.blocked_reason ?? null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-xl mx-auto">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Acesso Bloqueado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Sua conta está temporariamente bloqueada. Entre em contato com o administrador para regularizar o acesso.
              </p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
              ) : reason ? (
                <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">{reason}</div>
              ) : null}
              <div className="flex justify-end">
                <Button onClick={handleLogout} variant="outline">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

