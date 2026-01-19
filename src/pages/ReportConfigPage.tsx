import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
 
import { useToast } from "@/hooks/use-toast";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import ReportConfigSection, { ReportConfig } from "@/components/laudo/ReportConfigSection";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

type ProcessLite = {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  report_config: unknown;
};

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

const safeParseJson = <T,>(value: unknown, fallback: T): T => {
  try {
    if (value == null) return fallback;
    if (typeof value === "string" && value.trim() !== "") return JSON.parse(value) as T;
    if (typeof value === "object") return value as T;
    return fallback;
  } catch {
    return fallback;
  }
};

export default function ReportConfigPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const [config, setConfig] = useState<ReportConfig>({
    header: {
      peritoName: "PERITO JUDICIAL",
      professionalTitle: "ENGENHEIRO CIVIL",
      registrationNumber: "CREA",
      customText: "",
      imageDataUrl: "",
      imageUrl: "",
      imageWidth: 150,
      imageHeight: 40,
      imageAlign: "left",
      fillPage: true,
      spacingBelow: 30,
    },
    footer: {
      contactEmail: "contato@perito.com.br",
      customText: "",
      showPageNumbers: true,
      imageDataUrl: "",
      imageUrl: "",
      imageWidth: 150,
      imageHeight: 40,
      imageAlign: "left",
      fillPage: true,
    },
    signature: {
      imageDataUrl: "",
      imageUrl: "",
      imageWidth: 180,
      imageHeight: 80,
      imageAlign: "center",
    },
  });
  const [saving, setSaving] = useState(false);
  const [newCourt, setNewCourt] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const user = await getAuthenticatedUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: own, error: ownErr } = await supabase
          .from("processes")
          .select("id, process_number, claimant_name, defendant_name, report_config")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (ownErr) throw ownErr;
        const list = (own || []) as ProcessLite[];
        if (list.length > 0) {
          const first = list[0];
          setConfig(safeParseJson<ReportConfig>(first.report_config, config));
        } else {
          try {
            const user = await getAuthenticatedUser();
            if (user) {
              const raw = localStorage.getItem(`pericia_global_report_config_${user.id}`);
              const parsed = raw ? JSON.parse(raw) : null;
              if (parsed && typeof parsed === "object") {
                setConfig({ ...config, ...parsed });
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await getAuthenticatedUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: list, error: listErr } = await supabase
        .from("processes")
        .select("id, report_config")
        .eq("user_id", user.id);
      if (listErr) throw listErr;

      const updates = (list || []).map((p: { id: string; report_config?: unknown }) => {
        const curr = safeParseJson<Record<string, Json>>(p.report_config, {});
        const rcCourtsRaw = curr["court_options"];
        const rcCourts = Array.isArray(rcCourtsRaw)
          ? (rcCourtsRaw as Json[]).filter((x): x is string => typeof x === "string")
          : [];
        const nextCourtOptions = Array.isArray(config.court_options) ? config.court_options : rcCourts;
        const nextRc: Json = { ...curr, header: config.header, footer: config.footer, court_options: nextCourtOptions } as Json;
        return supabase.from("processes").update({ report_config: nextRc }).eq("id", p.id).select("id");
      });
      const results = await Promise.all(updates);
      const count = results.reduce((acc, r) => {
        const data = (r as { data?: unknown }).data;
        return acc + (Array.isArray(data) ? data.length : 0);
      }, 0);
      toast({ title: "Cabeçalho e rodapé aplicados", description: `Atualizado em ${count} processo(s).` });
      try {
        const user = await getAuthenticatedUser();
        if (user) {
          localStorage.setItem(`pericia_global_report_config_${user.id}`, JSON.stringify(config));
        }
      } catch (e) {
        console.error(e);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-4">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Configuração do Relatório</CardTitle>
              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Aplicar a todos"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ReportConfigSection value={config} onChange={setConfig} />
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-lg">Vara / Tribunal de Atuação</h3>
              <p className="text-sm text-muted-foreground">Cadastre os tribunais e varas para aparecerem nas listagens e seletores.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 1ª Vara do Trabalho de São Paulo"
                  value={newCourt}
                  onChange={(e) => setNewCourt(e.target.value)}
                />
                <Button
                  onClick={() => {
                    const val = String(newCourt || "").trim();
                    if (!val) return;
                    const list = Array.isArray(config.court_options) ? config.court_options : [];
                    if (list.includes(val)) return;
                    setConfig({ ...config, court_options: [...list, val] });
                    setNewCourt("");
                    toast({ title: "Adicionado", description: "Vara/Tribunal incluído na lista." });
                  }}
                >
                  Adicionar
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.isArray(config.court_options) && config.court_options.length > 0 ? (
                  config.court_options.map((opt: string) => (
                    <div key={opt} className="flex items-center gap-1 border rounded-md px-2 py-1">
                      <span className="text-sm">{opt}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const list = Array.isArray(config.court_options) ? config.court_options : [];
                          const next = list.filter((x: string) => x !== opt);
                          setConfig({ ...config, court_options: next });
                          toast({ title: "Removido", description: "Item removido da lista." });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma vara/tribunal configurada.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
