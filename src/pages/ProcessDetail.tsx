import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FileText, Upload, AlertCircle, ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ObjectiveSection from "@/components/laudo/ObjectiveSection";
import MethodologySection from "@/components/laudo/MethodologySection";
import WorkplaceSection from "@/components/laudo/WorkplaceSection";
import ActivitiesSection from "@/components/laudo/ActivitiesSection";
import EPISection from "@/components/laudo/EPISection";
import AnalysisSection from "@/components/laudo/AnalysisSection";
import ConclusionSection from "@/components/laudo/ConclusionSection";
import IdentificationsSection from "@/components/laudo/IdentificationsSection";
import ClaimantDataSection from "@/components/laudo/ClaimantDataSection";
import DefendantDataSection from "@/components/laudo/DefendantDataSection";
import InitialDataSection from "@/components/laudo/InitialDataSection";
import DefenseDataSection from "@/components/laudo/DefenseDataSection";
import DiligencesSection from "@/components/laudo/DiligencesSection";
import DocumentsSection from "@/components/laudo/DocumentsSection";
import CollectiveProtectionSection from "@/components/laudo/CollectiveProtectionSection";
import InsalubrityResultsSection from "@/components/laudo/InsalubrityResultsSection";
import PericulosityConceptSection from "@/components/laudo/PericulosityConceptSection";
import FlammableDefinitionSection from "@/components/laudo/FlammableDefinitionSection";
import PericulosityResultsSection from "@/components/laudo/PericulosityResultsSection";
import AttendeesSection from "@/components/laudo/AttendeesSection";
import QuestionnairesSection from "@/components/laudo/QuestionnairesSection";
import CoverSection from "@/components/laudo/CoverSection";
import { evaluateInsalubrityByLLM } from "@/lib/llm";

interface Process {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  court: string | null;
  status: string;
  inspection_date: string | null;
  inspection_address: string | null;
  inspection_time?: string | null;
  inspection_notes?: string | null;
  inspection_duration_minutes?: number | null;
  inspection_reminder_minutes?: number | null;
  inspection_status?: string | null;
  created_at: string;
  cover_data?: any;
  identifications?: any;
  claimant_data?: any;
  defendant_data?: string | null;
  objective?: string | null;
  initial_data?: string | null;
  defense_data?: string | null;
  diligence_data?: any[];
  methodology?: string | null;
  documents_presented?: any;
  attendees?: any;
  workplace_characteristics?: any;
  activities_description?: string | null;
  epis?: any;
  epcs?: string | null;
  collective_protection?: string | null;
  insalubrity_analysis?: string | null;
  insalubrity_results?: string | null;
  periculosity_concept?: string | null;
  flammable_definition?: string | null;
  periculosity_analysis?: string | null;
  periculosity_results?: string | null;
  conclusion?: string | null;
}

export default function ProcessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [annexesMarkedForLLM, setAnnexesMarkedForLLM] = useState<number[]>([]);
  const [annexesForInsalubrityLLM, setAnnexesForInsalubrityLLM] = useState<{ annex: number; agent: string; obs?: string }[]>([]);

  useEffect(() => {
    if (id) {
      fetchProcess();
    }
  }, [id]);

  const fetchProcess = async () => {
    try {
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Convert Json types to proper JavaScript types
      const processData = {
        ...data,
        identifications: data.identifications || {},
        claimant_data: data.claimant_data || {},
        diligence_data: Array.isArray(data.diligence_data)
          ? data.diligence_data
          : data.diligence_data
          ? [data.diligence_data]
          : [],
        documents_presented: Array.isArray(data.documents_presented) ? data.documents_presented : [],
        attendees: Array.isArray(data.attendees) ? data.attendees : [],
        epis: Array.isArray(data.epis) ? data.epis : [],
        workplace_characteristics: data.workplace_characteristics || {},
      };
      setProcess(processData as Process);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar processo",
        description: error.message,
        variant: "destructive",
      });
      navigate("/processos");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const },
      in_progress: { label: "Em Andamento", variant: "default" as const },
      completed: { label: "Concluído", variant: "default" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Não definida";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handleSave = async () => {
    if (!process) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("processes")
        .update({
          cover_data: process.cover_data,
          identifications: process.identifications,
          claimant_data: process.claimant_data,
          defendant_data: process.defendant_data,
          objective: process.objective,
          initial_data: process.initial_data,
          defense_data: process.defense_data,
          diligence_data: process.diligence_data,
          methodology: process.methodology,
          documents_presented: process.documents_presented,
          attendees: process.attendees,
          workplace_characteristics: process.workplace_characteristics,
          activities_description: process.activities_description,
          epis: process.epis,
          epcs: process.epcs,
          collective_protection: process.collective_protection,
          insalubrity_analysis: process.insalubrity_analysis,
          insalubrity_results: process.insalubrity_results,
          periculosity_concept: process.periculosity_concept,
          flammable_definition: process.flammable_definition,
          periculosity_analysis: process.periculosity_analysis,
          periculosity_results: process.periculosity_results,
          conclusion: process.conclusion,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Laudo salvo",
        description: "As informações do laudo foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveProcessMeta = async () => {
    if (!process) return;
    setSaving(true);
    try {
      const payloadFull: any = {
        process_number: process.process_number,
        claimant_name: process.claimant_name,
        defendant_name: process.defendant_name,
        court: process.court,
        status: process.status,
        inspection_date: process.inspection_date ? new Date(process.inspection_date).toISOString() : null,
        inspection_address: process.inspection_address,
        inspection_time: process.inspection_time || null,
        inspection_notes: process.inspection_notes || null,
        inspection_duration_minutes: typeof process.inspection_duration_minutes === "number" ? process.inspection_duration_minutes : (process.inspection_duration_minutes ? parseInt(String(process.inspection_duration_minutes), 10) : null),
        inspection_reminder_minutes: typeof process.inspection_reminder_minutes === "number" ? process.inspection_reminder_minutes : (process.inspection_reminder_minutes ? parseInt(String(process.inspection_reminder_minutes), 10) : null),
        inspection_status: process.inspection_status || null,
      };
  
      let { error } = await supabase
        .from("processes")
        .update(payloadFull)
        .eq("id", id);
  
      if (error) {
        const payloadFallback = {
          process_number: payloadFull.process_number,
          claimant_name: payloadFull.claimant_name,
          defendant_name: payloadFull.defendant_name,
          court: payloadFull.court,
          status: payloadFull.status,
          inspection_date: payloadFull.inspection_date,
          inspection_address: payloadFull.inspection_address,
        };
        const fb = await supabase.from("processes").update(payloadFallback).eq("id", id);
        if (fb.error) throw fb.error;
      }
  
      toast({
        title: "Dados do processo salvos",
        description: "As informações do processo foram atualizadas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar dados do processo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateProcess = (field: keyof Process, value: any) => {
    if (process) {
      setProcess({ ...process, [field]: value });
    }
  };

  const handleAnnexesInAnalysis = async (rows: { annex: number; agent: string; obs?: string }[]) => {
    try {
      const newRows = rows.filter((r) => !annexesMarkedForLLM.includes(r.annex));
      if (newRows.length === 0) return;
      setAnnexesMarkedForLLM((prev) => [...prev, ...newRows.map((r) => r.annex)]);
      setAnnexesForInsalubrityLLM((prev) => {
        const map = new Map(prev.map((r) => [r.annex, r]));
        newRows.forEach((r) => map.set(r.annex, r));
        return Array.from(map.values());
      });

      const baseResults = process?.insalubrity_results || "";
      const header = "\n\nResultados das Avaliações de Insalubridade (Gerado automaticamente via IA):\n";
      const listText = newRows.map((r) => `- Anexo ${r.annex} — ${r.agent} (Em análise)`).join("\n");
      let appended = header + listText + "\n";

      const epis = Array.isArray(process?.epis) ? process!.epis : [];
      const content = await evaluateInsalubrityByLLM(
        newRows.map((r) => ({ annex: r.annex, agent: r.agent, obs: r.obs || "" })),
        epis
      );

      if (content) {
        appended += "\n" + content + "\n";
        toast({ title: "Avaliação LLM inserida", description: "Seção 16 atualizada com base nos EPIs." });
      } else {
        appended += "\n[LLM não configurada ou indisponível. Configure VITE_LLM_INSALUBRITY_EVAL_URL]\n";
        toast({ title: "LLM indisponível", description: "Configure VITE_LLM_INSALUBRITY_EVAL_URL no .env.", variant: "destructive" });
      }

      updateProcess("insalubrity_results", baseResults + appended);
    } catch (error: any) {
      toast({ title: "Erro na avaliação LLM", description: error?.message ?? "Falha ao avaliar anexos.", variant: "destructive" });
    }
  };

  const generateInsalubrityLLM = async () => {
    try {
      const rows = annexesForInsalubrityLLM;
      if (!rows || rows.length === 0) {
        toast({ title: "Sem dados para IA", description: "Marque anexos da NR-15 como 'Em análise' na seção 15.", variant: "destructive" });
        return;
      }

      const baseResults = process?.insalubrity_results || "";
      const header = "\n\nParecer de Insalubridade (IA consolidado):\n";
      const listText = rows.map((r) => `- Anexo ${r.annex} — ${r.agent}${r.obs ? ` | Obs: ${r.obs}` : ""}`).join("\n");
      let appended = header + listText + "\n";

      const epis = Array.isArray(process?.epis) ? process!.epis : [];
      const content = await evaluateInsalubrityByLLM(
        rows.map((r) => ({ annex: r.annex, agent: r.agent, obs: r.obs || "" })),
        epis
      );

      if (content) {
        appended += "\n" + content + "\n";
        updateProcess("insalubrity_results", baseResults + appended);
        toast({ title: "Parecer IA gerado", description: "Seção 16 consolidada com IA e EPIs." });
      } else {
        appended += "\n[LLM não configurada ou indisponível. Configure VITE_LLM_INSALUBRITY_EVAL_URL]\n";
        updateProcess("insalubrity_results", baseResults + appended);
        toast({ title: "LLM indisponível", description: "Configure VITE_LLM_INSALUBRITY_EVAL_URL no .env.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro na IA", description: error?.message ?? "Falha ao gerar parecer consolidado.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!process) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/processos")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{process.process_number}</h1>
              {getStatusBadge(process.status)}
            </div>
            <p className="text-muted-foreground">
              {process.claimant_name} vs {process.defendant_name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vara Trabalhista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{process.court || "Não informada"}</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Data da Perícia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{formatDate(process.inspection_date)}</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Data de Criação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{formatDate(process.created_at)}</p>
            </CardContent>
          </Card>
        </div>

        {process.inspection_address && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Endereço da Perícia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{process.inspection_address}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="laudo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
             <TabsTrigger value="processo">Processo</TabsTrigger>
             <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
             <TabsTrigger value="laudo">Laudo</TabsTrigger>
             <TabsTrigger value="laudo-automatico">Laudo Automático</TabsTrigger>
             <TabsTrigger value="agentes">Agentes de Risco</TabsTrigger>
             <TabsTrigger value="documentos">Documentos</TabsTrigger>
           </TabsList>

           <TabsContent value="processo" className="space-y-6">
             <Card className="shadow-card">
               <CardHeader>
                 <CardTitle>Dados do Processo</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Número do Processo</p>
                     <Input
                       value={process.process_number}
                       onChange={(e) => updateProcess("process_number", e.target.value)}
                       placeholder="Ex: 0001234-56.2024.5.01.0001"
                     />
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Vara</p>
                     <Input
                       value={process.court || ""}
                       onChange={(e) => updateProcess("court", e.target.value)}
                       placeholder="Vara do Trabalho"
                     />
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Reclamante</p>
                     <Input
                       value={process.claimant_name}
                       onChange={(e) => updateProcess("claimant_name", e.target.value)}
                       placeholder="Nome do reclamante"
                     />
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Reclamada</p>
                     <Input
                       value={process.defendant_name}
                       onChange={(e) => updateProcess("defendant_name", e.target.value)}
                       placeholder="Nome da reclamada"
                     />
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Data da Perícia</p>
                     <Input
                       type="date"
                       value={process.inspection_date ? new Date(process.inspection_date).toISOString().slice(0, 10) : ""}
                       onChange={(e) => updateProcess("inspection_date", e.target.value)}
                     />
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Status</p>
                     <Select value={process.status} onValueChange={(v) => updateProcess("status", v)}>
                       <SelectTrigger>
                         <SelectValue placeholder="Selecione o status" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="pending">Pendente</SelectItem>
                         <SelectItem value="in_progress">Em Andamento</SelectItem>
                         <SelectItem value="completed">Concluído</SelectItem>
                         <SelectItem value="cancelled">Cancelado</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="md:col-span-2">
                     <p className="text-sm text-muted-foreground mb-1">Endereço da Perícia</p>
                     <Input
                       value={process.inspection_address || ""}
                       onChange={(e) => updateProcess("inspection_address", e.target.value)}
                       placeholder="Rua, número, bairro, cidade"
                     />
                   </div>
                 </div>
                 <div className="flex justify-end">
                   <Button onClick={saveProcessMeta} disabled={saving}>
                     <Save className="w-4 h-4 mr-2" />
                     {saving ? "Salvando..." : "Salvar Dados"}
                   </Button>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="agendamento" className="space-y-6">
             <Card className="shadow-card">
               <CardHeader>
                 <CardTitle>Agendamento de Processo</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Data da Perícia</p>
                     <Input
                       type="date"
                       value={process.inspection_date ? new Date(process.inspection_date).toISOString().slice(0, 10) : ""}
                       onChange={(e) => updateProcess("inspection_date", e.target.value)}
                     />
                   </div>
                   <div>
                     <p className="text-sm text-muted-foreground mb-1">Horário</p>
                     <Input
                       type="time"
                       value={process.inspection_time || ""}
                       onChange={(e) => updateProcess("inspection_time", e.target.value)}
                     />
                   </div>
                 <div>
                   <p className="text-sm text-muted-foreground mb-1">Duração (min)</p>
                   <Input
                     type="number"
                     min={15}
                     step={5}
                     value={process?.inspection_duration_minutes ?? ""}
                     onChange={(e) => updateProcess("inspection_duration_minutes", e.target.value ? parseInt(e.target.value, 10) : null)}
                   />
                 </div>
                 <div>
                   <p className="text-sm text-muted-foreground mb-1">Lembrete</p>
                   <Input
                     type="number"
                     min={0}
                     step={5}
                     value={process?.inspection_reminder_minutes ?? ""}
                     onChange={(e) => updateProcess("inspection_reminder_minutes", e.target.value ? parseInt(e.target.value, 10) : null)}
                   />
                 </div>
                <div className="md:col-span-1 md:col-start-3">
                 <p className="text-sm text-muted-foreground mb-1">Endereço</p>
                 <Input
                   value={process.inspection_address || ""}
                   placeholder="Rua, número, bairro, cidade"
                   onChange={(e) => updateProcess("inspection_address", e.target.value)}
                 />
               </div>
             </div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
  <div>
    <p className="text-sm text-muted-foreground mb-1">Status do Agendamento</p>
    <Input
      value={process?.inspection_status || ""}
      placeholder="scheduled_pending, scheduled_confirmed, rescheduled, cancelled"
      onChange={(e) => updateProcess("inspection_status", e.target.value)}
    />
  </div>
</div>
             <div className="mt-4">
               <p className="text-sm text-muted-foreground mb-1">Observações</p>
               <Input
                 value={process.inspection_notes || ""}
                 placeholder="Informações adicionais, contato, acesso, etc."
                 onChange={(e) => updateProcess("inspection_notes", e.target.value)}
               />
             </div>

             <div className="flex justify-end mt-4">
               <Button onClick={saveProcessMeta} disabled={saving}>
                 {saving ? "Salvando..." : "Salvar Agendamento"}
               </Button>
             </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="laudo">
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Laudo"}
                </Button>
              </div>

              {/* Capa sem numeração */}
              <CoverSection
                value={process.cover_data || {}}
                onChange={(v) => updateProcess("cover_data", v)}
                identifications={process.identifications || {}}
              />

              {/* 1. Identificações */}
              <IdentificationsSection
                value={process.identifications || {}}
                onChange={(v) => updateProcess("identifications", v)}
              />

              {/* 2. Dados da Reclamante */}
              <ClaimantDataSection
                value={process.claimant_data || { fullName: process.claimant_name || "", positions: [] }}
                onChange={(v) => updateProcess("claimant_data", v)}
              />

              {/* 3. Dados da Reclamada */}
              <DefendantDataSection
                value={process.defendant_data || ""}
                onChange={(v) => updateProcess("defendant_data", v)}
              />

              {/* 4. Objetivo */}
              <ObjectiveSection
                value={process.objective || ""}
                onChange={(v) => updateProcess("objective", v)}
              />

              {/* 5. Dados da Inicial */}
              <InitialDataSection
                value={process.initial_data || ""}
                onChange={(v) => updateProcess("initial_data", v)}
              />

              {/* 6. Dados da Contestação */}
              <DefenseDataSection
                value={process.defense_data || ""}
                onChange={(v) => updateProcess("defense_data", v)}
              />

              {/* 7. Diligências */}
              <DiligencesSection
                value={process.diligence_data || []}
                onChange={(v) => updateProcess("diligence_data", v)}
              />

              {/* 8. Acompanhantes */}
              <AttendeesSection
                value={process.attendees || []}
                onChange={(v) => updateProcess("attendees", v)}
                processId={process.id}
              />

              {/* 9. Metodologia */}
              <MethodologySection
                value={process.methodology || ""}
                onChange={(v) => updateProcess("methodology", v)}
              />

              {/* 10. Documentações Apresentadas */}
              <DocumentsSection
                value={process.documents_presented || []}
                onChange={(v) => updateProcess("documents_presented", v)}
              />

              {/* 11. Características do Local de Trabalho */}
              <WorkplaceSection
                value={process.workplace_characteristics || {}}
                onChange={(v) => updateProcess("workplace_characteristics", v)}
              />

              {/* 12. Atividades da Reclamante */}
              <ActivitiesSection
                value={process.activities_description || ""}
                onChange={(v) => updateProcess("activities_description", v)}
              />

              {/* 13. EPIs */}
              <EPISection
                value={process.epis || []}
                onChange={(v) => updateProcess("epis", v)}
                introText={process.activities_description || ""}
                onIntroTextChange={(v) => updateProcess("activities_description", v)}
              />

              {/* 14. EPCs */}
              <CollectiveProtectionSection
                value={process.collective_protection || ""}
                onChange={(v) => updateProcess("collective_protection", v)}
              />

              {/* 15. Análises de Insalubridade e Periculosidade */}
              <AnalysisSection
                insalubrity={process.insalubrity_analysis || ""}
                periculosity={process.periculosity_analysis || ""}
                onInsalubrityChange={(v) => updateProcess("insalubrity_analysis", v)}
                onPericulosityChange={(v) => updateProcess("periculosity_analysis", v)}
                onAnnexesInAnalysis={handleAnnexesInAnalysis}
              />

              {/* 16. Resultados das Avaliações de Insalubridade */}
              <InsalubrityResultsSection
                value={process.insalubrity_results || ""}
                onChange={(v) => updateProcess("insalubrity_results", v)}
                onGenerateLLM={generateInsalubrityLLM}
              />

              {/* 17. Conceito de Periculosidade */}
              <PericulosityConceptSection
                value={process.periculosity_concept || ""}
                onChange={(v) => updateProcess("periculosity_concept", v)}
              />

              {/* 18. Definição de Materiais Inflamáveis */}
              <FlammableDefinitionSection
                value={process.flammable_definition || ""}
                onChange={(v) => updateProcess("flammable_definition", v)}
              />

              {/* 19. Resultados das Avaliações de Periculosidade */}
              <PericulosityResultsSection
                value={process.periculosity_results || ""}
                onChange={(v) => updateProcess("periculosity_results", v)}
              />

              {/* 20. Quesitos da Perícia */}
              <QuestionnairesSection processId={process.id} />

              {/* 21. Conclusão */}
              <ConclusionSection
                value={process.conclusion || ""}
                onChange={(v) => updateProcess("conclusion", v)}
              />

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Laudo"}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="laudo-automatico" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Laudo Automático</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Visualização consolidada do laudo com base nos dados e nos resultados automáticos (LLM), quando configurado. Esta aba é somente leitura e não altera a aba Laudo.
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold">Resultados de Insalubridade</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{process.insalubrity_results || "Sem conteúdo"}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Resultados de Periculosidade</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{process.periculosity_results || "Sem conteúdo"}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Conclusão</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{process.conclusion || "Sem conteúdo"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

           <TabsContent value="documentos">
             <Card className="shadow-card">
               <CardHeader>
                 <CardTitle>Documentos do Processo</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-center py-12">
                   <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                   <p className="text-muted-foreground mb-4">
                     Nenhum documento enviado ainda
                   </p>
                   <Button>
                     <Upload className="w-4 h-4 mr-2" />
                     Enviar Documentos
                   </Button>
                   <p className="text-xs text-muted-foreground mt-4">
                     Formatos aceitos: PDF, DOCX, JPG, PNG
                   </p>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="agentes">
             <Card className="shadow-card">
               <CardHeader>
                 <CardTitle>Agentes de Risco Identificados</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-center py-12">
                   <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                   <p className="text-muted-foreground mb-4">
                     Nenhum agente de risco cadastrado
                   </p>
                   <p className="text-sm text-muted-foreground">
                     Os agentes serão extraídos automaticamente dos documentos enviados
                   </p>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>

         </Tabs>
      </div>
    </div>
  );
}
