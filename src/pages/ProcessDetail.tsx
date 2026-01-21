import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, validateAndRecoverSession, getAuthenticatedUser } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText as _FileText, AlertCircle, ArrowLeft, Save, FileDown, ExternalLink, MapPin, X, MessageCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useReportGeneration, useProcessProgress, useBusinessValidation } from "@/hooks/use-api";
import { exportReportAsDocx, exportReportAsPdf, buildReportFilename } from "@/lib/export";
import ObjectiveSection from "@/components/laudo/ObjectiveSection";
import MethodologySection from "@/components/laudo/MethodologySection";
import WorkplaceSection from "@/components/laudo/WorkplaceSection";
import ActivitiesSection from "@/components/laudo/ActivitiesSection";
import DiscordancesSection from "@/components/laudo/DiscordancesSection";
import EPISection from "@/components/laudo/EPISection";
import AnalysisSection from "@/components/laudo/AnalysisSection";
import ConclusionSection from "@/components/laudo/ConclusionSection";
import TemplatesSection from "@/components/laudo/TemplatesSection";
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
import PhotoRegisterSection from "@/components/laudo/PhotoRegisterSection";
import { evaluateInsalubrityByLLM, EPIInput } from "@/lib/llm";
import FileUpload from "@/components/storage/FileUpload";
import DocumentViewer from "@/components/storage/DocumentViewer";

import { Tables } from "@/integrations/supabase/types";

type Process = Tables<'processes'> & {
  _is_linked?: boolean;
  _linked_permissions?: any;
};

function toPtDate(dateStr?: string | null) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function buildScheduleMessage(p: Process, contactName: string) {
  const name = String(contactName || "").trim();
  const processNumber = String(p.process_number || "").trim();
  const claimant = String(p.claimant_name || "").trim();
  const defendant = String(p.defendant_name || "").trim();
  const date = toPtDate(p.inspection_date);
  const time = String(p.inspection_time || "").trim();
  const address = String(p.inspection_address || "").trim();
  const mapsUrl = address ? `https://www.google.com/maps/search/?q=${encodeURIComponent(address)}` : "";

  const lines: string[] = [];
  lines.push(name ? `Olá, ${name}!` : "Olá!");
  lines.push("Estou entrando em contato para agendar/confirmar a perícia.");
  if (processNumber || claimant || defendant) {
    const parties = [claimant, defendant].filter(Boolean).join(" x ");
    lines.push(`Processo: ${[processNumber, parties].filter(Boolean).join(" — ")}`);
  }
  if (date || time) lines.push(`Data/Horário: ${[date, time].filter(Boolean).join(" às ")}`);
  if (address) lines.push(`Local: ${address}`);
  if (mapsUrl) lines.push(`Maps: ${mapsUrl}`);
  lines.push("");
  lines.push("Por gentileza, confirme a disponibilidade. Obrigado(a)!");
  return lines.join("\n").trim();
}

function normalizeWhatsappPhone(raw: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) return digits;
  return null;
}

function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

function isValidEmail(raw: string) {
  const v = normalizeEmail(raw);
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function getFunctionErrorMessage(err: any) {
  const rawBody = err?.context?.body;
  if (rawBody) {
    if (typeof rawBody === "string") {
      try {
        const parsed = JSON.parse(rawBody);
        const msg = String(parsed?.error || parsed?.message || "").trim();
        if (msg) return msg;
      } catch {
        const msg = String(rawBody || "").trim();
        if (msg) return msg;
      }
    } else {
      const msg = String(rawBody?.error || rawBody?.message || "").trim();
      if (msg) return msg;
    }
  }
  return String(err?.message || "Falha inesperada");
}

// Funções auxiliares para conversão segura de tipos Json
function safeParseJson(json: any, defaultValue: any = {}) {
  if (!json) return defaultValue;
  if (typeof json === 'object') return json;
  if (typeof json === 'string') {
    try {
      return JSON.parse(json);
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

function safeParseArray(json: any, defaultValue: any[] = []): any[] {
  if (Array.isArray(json)) return json;
  if (!json) return defaultValue;
  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

function normalizeReportType(input: any): 'insalubridade' | 'periculosidade' | 'completo' | undefined {
  const v = String(input || '').trim();
  if (v === 'insalubridade' || v === 'periculosidade' || v === 'completo') return v;
  return undefined;
}

interface IdentificationData {
  processNumber?: string;
  claimantName?: string;
  defendantName?: string;
  court?: string;
}

interface ClaimantData {
  name?: string;
  positions?: any[];
}

export default function ProcessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { generateReport, loading: reportLoading } = useReportGeneration();
  const progressHook = useProcessProgress(id as string);
  const businessHook = useBusinessValidation();
  const [autoInsalPreview, setAutoInsalPreview] = useState<string>("");
  const [autoPeriPreview, setAutoPeriPreview] = useState<string>("");
  const [autoConcPreview, setAutoConcPreview] = useState<string>("");
  const [autoLoading, setAutoLoading] = useState<{ ins: boolean; peri: boolean; conc: boolean }>({ ins: false, peri: false, conc: false });
  const [viewMode, setViewMode] = useState<'manual' | 'auto' | 'side'>('manual');
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [riskAgents, setRiskAgents] = useState<any[]>([]);
  const [detectedInitialAgents, setDetectedInitialAgents] = useState<Array<{ agent_name: string; agent_type: string; risk_level?: string }>>([]);
  const [detectedDocumentAgents, setDetectedDocumentAgents] = useState<Array<{ agent_name: string; agent_type: string; risk_level?: string }>>([]);
  const [annexesMarkedForLLM, setAnnexesMarkedForLLM] = useState<number[]>([]);
  const [annexesForInsalubrityLLM, setAnnexesForInsalubrityLLM] = useState<{ annex: number; agent: string; exposure?: string; obs?: string }[]>([]);
  const [annexesForPericulosityLLM, setAnnexesForPericulosityLLM] = useState<{ annex: number; agent: string; obs?: string }[]>([]);
  const [claimantSynced, setClaimantSynced] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPericulosityTemplates, setShowPericulosityTemplates] = useState(false);
  const [showMethodologyTemplates, setShowMethodologyTemplates] = useState(false);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [globalTemplatesDisabled, setGlobalTemplatesDisabled] = useState<boolean>(false);
  const scheduleMessageInitRef = useRef(false);
  const scheduleEmailInitRef = useRef(false);
  const [scheduleContactName, setScheduleContactName] = useState<string>("");
  const [scheduleContactPhone, setScheduleContactPhone] = useState<string>("");
  const [scheduleMessageText, setScheduleMessageText] = useState<string>("");
  const [scheduleClaimantEmail, setScheduleClaimantEmail] = useState<string>("");
  const [scheduleDefendantEmail, setScheduleDefendantEmail] = useState<string>("");
  const [scheduleEmailSubject, setScheduleEmailSubject] = useState<string>("");
  const [scheduleEmailBody, setScheduleEmailBody] = useState<string>("");
  const [scheduleEmailReceipts, setScheduleEmailReceipts] = useState<any[]>([]);

  const handleSaveTemplatesOnly = async (nextTemplates?: any[]) => {
    try {
      const session = await validateAndRecoverSession();
      if (!session || !process) return;
      const rc = safeParseJson(process.report_config, {});
      const mergedRc = { ...rc } as any;
      if (Array.isArray(nextTemplates)) {
        mergedRc.templates = nextTemplates;
        updateProcess("report_config" as any, mergedRc);
      }
      const { error } = await supabase
        .from("processes")
        .update({ report_config: mergedRc })
        .eq("id", process.id);
      if (error) {
        toast({ title: "Erro ao salvar template", description: error.message, variant: "destructive" });
      } else {
        try {
          const list = (Array.isArray(nextTemplates) ? nextTemplates : ((mergedRc as any).templates || [])) as any[];
          if (Array.isArray(list) && list.length > 0) {
            const rows = list.map((t: any) => ({
              user_id: session.user.id,
              external_id: String(t.id || ""),
              name: String(t.name || "Sem nome"),
              text: String(t.text || ""),
              nr15_annexes: (Array.isArray(t.nr15_annexes) ? t.nr15_annexes : []),
              nr16_annexes: (Array.isArray(t.nr16_annexes) ? t.nr16_annexes : []),
              nr15_enquadramento: !!t.nr15_enquadramento,
              nr16_enquadramento: !!t.nr16_enquadramento,
            }));
            try { localStorage.setItem(`pericia_templates_${session.user.id}`, JSON.stringify(list)); } catch {}
            if (!globalTemplatesDisabled && localStorage.getItem('pericia_global_tpl_disabled') !== '1') {
              try {
                await (supabase as any)
                  .from("templates")
                  .upsert(rows, { onConflict: "user_id,external_id" });
              } catch (err: any) {
                setGlobalTemplatesDisabled(true);
                try { localStorage.setItem('pericia_global_tpl_disabled', '1'); } catch {}
                toast({ title: "Templates salvos localmente", description: "Publicação global indisponível (404).", variant: "destructive" });
              }
            }
            try { await fetchGlobalTemplates(); } catch {}
          }
        } catch {}
        toast({ title: "Template salvo", description: "Templates atualizados no processo." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar template", description: e?.message || "Falha inesperada", variant: "destructive" });
    }
  };

  const handleSaveMethodologyTemplatesOnly = async (nextTemplates?: any[]) => {
    try {
      const session = await validateAndRecoverSession();
      if (!session || !process) return;
      const rc = safeParseJson(process.report_config, {});
      const mergedRc = { ...rc } as any;
      if (Array.isArray(nextTemplates)) {
        mergedRc.methodology_templates = nextTemplates.map((t: any) => ({
          id: String(t.id || ""),
          name: String(t.name || "Sem nome"),
          text: String(t.text || ""),
        }));
        updateProcess("report_config" as any, mergedRc);
      }
      const { error } = await supabase
        .from("processes")
        .update({ report_config: mergedRc })
        .eq("id", process.id);
      if (error) {
        toast({ title: "Erro ao salvar template", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Template salvo", description: "Templates atualizados no processo." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar template", description: e?.message || "Falha inesperada", variant: "destructive" });
    }
  };

  const fetchGlobalTemplates = useCallback(async () => {
    try {
      const session = await validateAndRecoverSession();
      if (!session) return;
      const disabledFlag = localStorage.getItem('pericia_global_tpl_disabled') === '1';
      if (disabledFlag || globalTemplatesDisabled) {
        const raw = localStorage.getItem(`pericia_templates_${session.user.id}`);
        const parsed = raw ? JSON.parse(raw) : [];
        setGlobalTemplates(Array.isArray(parsed) ? parsed : []);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("templates")
        .select("*")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });
      if (error) {
        setGlobalTemplatesDisabled(true);
        try { localStorage.setItem('pericia_global_tpl_disabled', '1'); } catch {}
        const raw = localStorage.getItem(`pericia_templates_${session.user.id}`);
        const parsed = raw ? JSON.parse(raw) : [];
        setGlobalTemplates(Array.isArray(parsed) ? parsed : []);
        return;
      }
      const mapped = Array.isArray(data) ? data.map((row: any) => ({
        id: String(row.external_id || row.id),
        name: String(row.name || "Sem nome"),
        text: String(row.text || ""),
        nr15_annexes: Array.isArray(row.nr15_annexes) ? row.nr15_annexes : [],
        nr16_annexes: Array.isArray(row.nr16_annexes) ? row.nr16_annexes : [],
        nr15_enquadramento: !!row.nr15_enquadramento,
        nr16_enquadramento: !!row.nr16_enquadramento,
      })) : [];
      setGlobalTemplates(mapped);
      try { localStorage.setItem(`pericia_templates_${session.user.id}`, JSON.stringify(mapped)); } catch {}
    } catch {}
  }, [globalTemplatesDisabled]);

  const handleAddTemplate = async () => {
    try {
      if (!process) return;
      const rc = safeParseJson(process.report_config, {}) as any;
      const list = Array.isArray(rc.templates) ? rc.templates : [];
      const id = Math.random().toString(36).slice(2);
      const newTpl = { id, name: "Novo Template", text: "", nr15_annexes: [], nr16_annexes: [], nr15_enquadramento: false, nr16_enquadramento: false, category: "insalubrity" };
      const next = [newTpl, ...list];
      const nextRc = { ...rc, templates: next };
      updateProcess("report_config" as any, nextRc);
      setShowTemplates(true);
      await handleSaveTemplatesOnly(next);
    } catch {}
  };

  const handleAddPericulosityTemplate = async () => {
    try {
      if (!process) return;
      const rc = safeParseJson(process.report_config, {}) as any;
      const list = Array.isArray(rc.templates) ? rc.templates : [];
      const id = Math.random().toString(36).slice(2);
      const newTpl = { id, name: "Novo Template", text: "", nr15_annexes: [], nr16_annexes: [], nr15_enquadramento: false, nr16_enquadramento: false, category: "periculosity" };
      const next = [newTpl, ...list];
      const nextRc = { ...rc, templates: next };
      updateProcess("report_config" as any, nextRc);
      setShowPericulosityTemplates(true);
      await handleSaveTemplatesOnly(next);
    } catch {}
  };

  const handleAddMethodologyTemplate = async () => {
    try {
      if (!process) return;
      const rc = safeParseJson(process.report_config, {}) as any;
      const list = Array.isArray(rc.methodology_templates) ? rc.methodology_templates : [];
      const id = Math.random().toString(36).slice(2);
      const newTpl = { id, name: "Novo Template", text: "" };
      const next = [newTpl, ...list];
      const nextRc = { ...rc, methodology_templates: next };
      updateProcess("report_config" as any, nextRc);
      setShowMethodologyTemplates(true);
      await handleSaveMethodologyTemplatesOnly(next);
    } catch {}
  };
  
  const NR15_AGENTS: Record<number,string> = { 1:"Ruído Contínuo ou Intermitente",2:"Ruídos de Impacto",3:"Calor",4:"Iluminamento",5:"Radiação Ionizante",6:"Trabalho Sob Condição Hiperbárica",7:"Radiação não Ionizante",8:"Vibrações",9:"Frio",10:"Umidade",11:"Agentes Químicos I",12:"Poeiras e Minerais",13:"Agentes Químicos II",14:"Agentes Biológicos" };
  const NR16_AGENTS: Record<number,string> = { 1:"Explosivos",2:"Inflamáveis",3:"Exposição à energia elétrica",4:"Segurança pessoal/patrimonial (roubos/assaltos)" };

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toICSDate = (dateStr?: string | null, timeStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const h = timeStr ? parseInt(timeStr.split(":")[0] || "9", 10) : 9;
    const m = timeStr ? parseInt(timeStr.split(":")[1] || "0", 10) : 0;
    d.setHours(h, m, 0, 0);
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const HH = pad(d.getUTCHours());
    const MM = pad(d.getUTCMinutes());
    const SS = pad(d.getUTCSeconds());
    return `${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`;
  };
  const toGoogleCalendarURL = (p: Process | null) => {
    if (!p) return "https://calendar.google.com/calendar/u/0/r/eventedit";
    const text = encodeURIComponent(`Vistoria — ${p.process_number}`);
    const details = encodeURIComponent(
      `${p.claimant_name} vs ${p.defendant_name}${p.inspection_notes ? `\n\nObs: ${p.inspection_notes}` : ""}`
    );
    const location = encodeURIComponent(p.inspection_address || "");
    let url = `https://calendar.google.com/calendar/u/0/r/eventedit?text=${text}&details=${details}&location=${location}`;
    if (p.inspection_date) {
      const start = toICSDate(p.inspection_date, p.inspection_time);
      const durMin = p.inspection_duration_minutes || 60;
      const d = new Date(p.inspection_date);
      const [th, tm] = (p.inspection_time || "09:00").split(":");
      d.setHours(parseInt(th, 10), parseInt(tm, 10) + durMin, 0, 0);
      const end = toICSDate(d.toISOString().slice(0, 10), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
      if (start && end) url += `&dates=${start}/${end}`;
    }
    return url;
  };

  const openWhatsApp = () => {
    const phone = normalizeWhatsappPhone(scheduleContactPhone);
    const text = String(scheduleMessageText || "").trim();
    if (!phone) {
      toast({ title: "Telefone inválido", description: "Informe um telefone com DDD (ex.: 11999999999).", variant: "destructive" });
      return;
    }
    if (!text) {
      toast({ title: "Mensagem vazia", description: "Digite ou gere a mensagem antes de enviar.", variant: "destructive" });
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyScheduleMessage = async () => {
    const text = String(scheduleMessageText || "").trim();
    if (!text) {
      toast({ title: "Mensagem vazia", description: "Digite ou gere a mensagem antes de copiar.", variant: "destructive" });
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copiado", description: "Mensagem copiada para a área de transferência." });
        return;
      }
      throw new Error("Clipboard indisponível");
    } catch {
      toast({ title: "Falha ao copiar", description: "Copie manualmente o texto da mensagem.", variant: "destructive" });
    }
  };


  const refreshScheduleEmailReceipts = useCallback(async (processId?: string) => {
    const pid = String(processId || process?.id || "").trim();
    if (!pid) return;
    try {
      const { data, error } = await supabase
        .from("schedule_email_receipts")
        .select("*")
        .eq("process_id", pid)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setScheduleEmailReceipts(Array.isArray(data) ? data : []);
    } catch {
      setScheduleEmailReceipts([]);
    }
  }, [process?.id]);

  const sendScheduleEmail = useCallback(async (recipients: Array<{ role: string; email: string }>) => {
    if (!process?.id) return;

    const subject = String(scheduleEmailSubject || "").trim();
    const body = String(scheduleEmailBody || "").trim();
    if (!subject) {
      toast({ title: "Assunto vazio", description: "Informe o assunto do e-mail.", variant: "destructive" });
      return;
    }
    if (!body) {
      toast({ title: "Mensagem vazia", description: "Informe a mensagem do e-mail.", variant: "destructive" });
      return;
    }

    const validRecipients = (Array.isArray(recipients) ? recipients : [])
      .map((r) => ({ role: String(r?.role || "other"), email: normalizeEmail(r?.email || "") }))
      .filter((r) => isValidEmail(r.email));

    if (validRecipients.length === 0) {
      toast({ title: "E-mail inválido", description: "Informe ao menos um destinatário com e-mail válido.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-schedule-email", {
        body: {
          processId: process.id,
          recipients: validRecipients,
          subject,
          body,
        },
      });
      if (error) throw error;
      if (data?.success) {
        const failures = Array.isArray(data?.results) ? data.results.filter((r: any) => r && r.success === false) : [];
        const desc =
          failures.length > 0
            ? `Alguns envios falharam (${failures.length}). Verifique o status abaixo.`
            : "Envio registrado. A confirmação aparece quando o destinatário abrir/confirmar.";
        toast({ title: "Envio processado", description: desc, variant: failures.length > 0 ? "destructive" : undefined });
        await refreshScheduleEmailReceipts(process.id);
      } else {
        toast({ title: "Falha ao enviar", description: String(data?.error || "Falha inesperada"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Falha ao enviar", description: getFunctionErrorMessage(e), variant: "destructive" });
    }
  }, [process?.id, scheduleEmailBody, scheduleEmailSubject, toast, refreshScheduleEmailReceipts]);

  const fetchProcess = useCallback(async () => {
    try {
      console.log(`[DEBUG] Carregando processo com ID:`, id);
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      console.log(`[DEBUG] Dados brutos do banco:`, data);
      console.log(`[DEBUG] initial_data do banco:`, data.initial_data);
      console.log(`[DEBUG] report_config do banco:`, data.report_config);
      
      // Convert Json types to proper JavaScript types
      const processData = {
        ...data,
        identifications: safeParseJson(data.identifications),
        claimant_data: safeParseJson(data.claimant_data),
        diligence_data: safeParseArray(data.diligence_data),
        documents_presented: safeParseArray(data.documents_presented),
        attendees: safeParseArray(data.attendees),
        epis: safeParseArray(data.epis),
        workplace_characteristics: safeParseJson(data.workplace_characteristics),
        report_config: safeParseJson(data.report_config) || {
          header: {
            peritoName: "PERITO JUDICIAL",
            professionalTitle: "ENGENHEIRO CIVIL",
            registrationNumber: "CREA",
            customText: "",
            imageDataUrl: "",
            imageUrl: "",
            imageWidth: 150,
            imageHeight: 40,
            imageAlign: 'left'
          },
          footer: {
            contactEmail: "contato@perito.com.br",
            customText: "",
            showPageNumbers: true,
            imageDataUrl: "",
            imageUrl: "",
            imageWidth: 150,
            imageHeight: 40,
            imageAlign: 'left'
          }
        },
      };
      
      console.log(`[DEBUG] Dados processados:`, processData);
      console.log(`[DEBUG] initial_data processado:`, processData.initial_data);
      console.log(`[DEBUG] report_config processado:`, processData.report_config);
      
      setProcess(processData as Process);
    } catch (error: any) {
      console.log(`[DEBUG] Erro ao carregar processo:`, error);
      toast({
        title: "Erro ao carregar processo",
        description: error.message,
        variant: "destructive",
      });
      navigate("/processos");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    if (id) {
      fetchProcess();
    }
  }, [id, fetchProcess]);

  useEffect(() => {
    if (!process) return;
    const defaultName = String(process.claimant_name || process.defendant_name || "").trim();
    if (!scheduleMessageInitRef.current) {
      setScheduleContactName((prev) => (prev ? prev : defaultName));
      setScheduleMessageText((prev) => (prev ? prev : buildScheduleMessage(process, defaultName)));
      scheduleMessageInitRef.current = true;
    }

    if (!scheduleEmailInitRef.current) {
      const claimantEmail = String((process as any).claimant_email || "").trim();
      const defendantEmail = String((process as any).defendant_email || "").trim();
      const baseSubject = `Agendamento/Confirmação de Perícia — Processo ${String(process.process_number || "").trim()}`.trim();
      setScheduleClaimantEmail((prev) => (prev ? prev : claimantEmail));
      setScheduleDefendantEmail((prev) => (prev ? prev : defendantEmail));
      setScheduleEmailSubject((prev) => (prev ? prev : baseSubject));
      setScheduleEmailBody((prev) => (prev ? prev : buildScheduleMessage(process, defaultName)));
      scheduleEmailInitRef.current = true;
    }
  }, [process]);

  useEffect(() => {
    if (!process?.id) return;
    void refreshScheduleEmailReceipts(process.id);
  }, [process?.id, refreshScheduleEmailReceipts]);

  useEffect(() => {
    fetchGlobalTemplates();
  }, [fetchGlobalTemplates]);

  useEffect(() => {
    (async () => {
      if (!process) return;
      try {
        const session = await validateAndRecoverSession();
        const rc = safeParseJson(process.report_config, {}) as any;
        const list = ((rc.templates || []) as any[]) || [];
        if (Array.isArray(list) && list.length > 0 && globalTemplates.length === 0) {
          setGlobalTemplates(list);
          if (session?.user?.id) {
            try { localStorage.setItem(`pericia_templates_${session.user.id}`, JSON.stringify(list)); } catch {}
          }
        }
      } catch {}
    })();
  }, [process, globalTemplates.length]);

  // Sincroniza automaticamente a seção 1 (Identificações) com os dados já existentes
  // da aba Processo, quando a seção ainda está vazia. Também persiste no banco.
  useEffect(() => {
    if (!process) return;

    try {
      const ident = safeParseJson(process.identifications) as IdentificationData;
      const isEmpty = !ident.processNumber && !ident.claimantName && !ident.defendantName && !ident.court;

      const source = {
        processNumber: process.process_number || "",
        claimantName: process.claimant_name || "",
        defendantName: process.defendant_name || "",
        court: process.court || "",
      };

      const hasSource = Boolean(
        source.processNumber || source.claimantName || source.defendantName || source.court
      );

      if (isEmpty && hasSource) {
        // Atualiza estado local
        setProcess({ ...process, identifications: source });

        // Persiste silenciosamente no banco (sem toasts)
        void supabase
          .from("processes")
          .update({ identifications: source })
          .eq("id", process.id);
      }
    } catch {
      // ignora falhas silenciosas
    }
  }, [process]);

  // Sincroniza automaticamente a seção 2 (Dados da Reclamante) com o nome
  // já cadastrado na aba Processo, quando a seção estiver vazia. Persiste no banco.
  useEffect(() => {
    if (!process) return;

    try {
      const cd = safeParseJson(process.claimant_data) as ClaimantData;
      const isEmpty = !cd.name && (!cd.positions || cd.positions.length === 0);
      const sourceName = process.claimant_name || "";

      if (isEmpty && sourceName) {
        const payload = { name: sourceName, positions: [] };

        // Atualiza estado local
        setProcess({ ...process, claimant_data: payload });
        setClaimantSynced(true);

        // Persiste silenciosamente no banco
        void supabase
          .from("processes")
          .update({ claimant_data: payload })
          .eq("id", process.id);
      }
    } catch {
      // ignora falhas silenciosas
    }
  }, [process]);

  // Mantém a seção 2 sincronizada quando o nome da reclamante na aba Processo mudar.
  // Só atualiza se a seção 2 estiver vazia ou ainda refletindo o nome anterior
  // (evita sobrescrever edições manuais feitas na seção 2).
  const prevClaimantNameRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevClaimantNameRef.current;
    const current = process?.claimant_name || "";
    const processId = process?.id;
    const claimantData = process?.claimant_data;
    if (!processId) return;

    // Inicializa o valor anterior e não sincroniza na primeira execução
    if (prev === null) {
      prevClaimantNameRef.current = current;
      return;
    }

    // Detecta mudança no nome do processo
    if (prev !== current) {
      const cd = safeParseJson(claimantData) as ClaimantData;
      const positions = Array.isArray(cd.positions) ? cd.positions : [];
      const shouldSync = !cd.name || cd.name === (prev || "");

      if (shouldSync) {
        const payload = { name: current, positions };
        setProcess((curr) => (curr ? { ...curr, claimant_data: payload } : curr));
        setClaimantSynced(true);

        // Persiste silenciosamente no banco
        void supabase
          .from("processes")
          .update({ claimant_data: payload })
          .eq("id", processId);
      }

      // Atualiza referência do nome anterior
      prevClaimantNameRef.current = current;
    }
  }, [process?.claimant_name, process?.id, process?.claimant_data]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Ativo", variant: "default" as const },
      completed: { label: "Concluído", variant: "default" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
      archived: { label: "Arquivado", variant: "secondary" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
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

    // Garante sessão válida antes de qualquer operação de escrita
    const session = await validateAndRecoverSession();
    if (!session) {
      toast({ title: "Sessão expirada", description: "Entre novamente para salvar o laudo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      console.log(`[DEBUG] Salvando dados do laudo:`, process);
      console.log(`[DEBUG] initial_data sendo salvo:`, process.initial_data);
      console.log(`[DEBUG] report_config sendo salvo:`, process.report_config);
      try {
        const rc: any = process.report_config || {};
        console.log('[DEBUG] report_config lengths (antes do save):', {
          headerImageDataUrlLen: rc?.header?.imageDataUrl ? String(rc.header.imageDataUrl).length : 0,
          footerImageDataUrlLen: rc?.footer?.imageDataUrl ? String(rc.footer.imageDataUrl).length : 0,
          headerHasUrl: !!rc?.header?.imageUrl,
          footerHasUrl: !!rc?.footer?.imageUrl,
        });
      } catch {}
      
      // Sanitizar identifications (apenas campos relevantes)
      const ids = safeParseJson(process.identifications || {});
      const sanitizedIds = {
        ...ids,
        processNumber: ids.processNumber ?? process.process_number ?? undefined,
        claimantName: ids.claimantName ?? process.claimant_name ?? undefined,
        defendantName: sanitizeLawyerFromName(ids.defendantName ?? process.defendant_name ?? undefined),
      };

      try {
        const rc0 = safeParseJson(process.report_config, {}) as any;
        const hasTables = rc0 && rc0.analysis_tables && Array.isArray(rc0.analysis_tables.nr15) && Array.isArray(rc0.analysis_tables.nr16) && (rc0.analysis_tables.nr15.length > 0 || rc0.analysis_tables.nr16.length > 0);
        if (!hasTables) {
          try {
            const raw = localStorage.getItem(`pericia_tables_${process.user_id}_${process.id}`);
            const parsed = raw ? JSON.parse(raw) : {};
            if (parsed && (Array.isArray(parsed.nr15) || Array.isArray(parsed.nr16))) {
              const nextRc = { ...rc0, analysis_tables: { nr15: Array.isArray(parsed.nr15) ? parsed.nr15 : [], nr16: Array.isArray(parsed.nr16) ? parsed.nr16 : [] } };
              updateProcess("report_config" as any, nextRc);
            }
          } catch {}
        }
      } catch {}

      const { error } = await supabase
        .from("processes")
        .update({
          cover_data: process.cover_data,
          identifications: sanitizedIds,
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
          epi_intro: (process as any).epi_intro || null,
          activities_description: process.activities_description,
          discordances_presented: process.discordances_presented,
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
          report_config: process.report_config,
        })
        .eq("id", id);

      if (error) {
        console.log(`[DEBUG] Erro ao salvar laudo:`, error);
        const isUndefinedColumn = error.code === '42703' || /undefined column|does not exist|column.*epi_intro/i.test(error.message || '');
        if (isUndefinedColumn) {
          console.warn('Coluna epi_intro ausente. Aplicando fallback em activities_description.');
          const { error: fbError } = await supabase
            .from("processes")
            .update({
              cover_data: process.cover_data,
              identifications: sanitizedIds,
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
              activities_description: process.activities_description || (process as any).epi_intro || null,
              discordances_presented: process.discordances_presented,
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
              report_config: process.report_config,
            })
            .eq("id", id);
          if (fbError) {
            console.log(`[DEBUG] Erro no fallback ao salvar laudo:`, fbError);
            throw fbError;
          }
        } else {
          throw error;
        }
      }

      try {
        const sessionUser = session.user.id;
        const rcNow = safeParseJson(process.report_config, {}) as any;
        const list = Array.isArray(rcNow.templates) ? rcNow.templates : [];
        if (list.length > 0) {
          const rows = list.map((t: any) => ({
            user_id: sessionUser,
            external_id: String(t.id || ""),
            name: String(t.name || "Sem nome"),
            text: String(t.text || ""),
            nr15_annexes: (Array.isArray(t.nr15_annexes) ? t.nr15_annexes : []),
            nr16_annexes: (Array.isArray(t.nr16_annexes) ? t.nr16_annexes : []),
            nr15_enquadramento: !!t.nr15_enquadramento,
            nr16_enquadramento: !!t.nr16_enquadramento,
          }));
          if (!globalTemplatesDisabled && localStorage.getItem('pericia_global_tpl_disabled') !== '1') {
            try {
              await (supabase as any)
                .from("templates")
                .upsert(rows, { onConflict: "user_id,external_id" });
            } catch (err: any) {
              setGlobalTemplatesDisabled(true);
              try { localStorage.setItem('pericia_global_tpl_disabled', '1'); } catch {}
            }
          }
          try { localStorage.setItem(`pericia_templates_${sessionUser}`, JSON.stringify(list)); } catch {}
        }
        const tablesNow = rcNow.analysis_tables || {};
        try { localStorage.setItem(`pericia_tables_${process.user_id}_${process.id}`, JSON.stringify(tablesNow)); } catch {}
      } catch {}

      console.log(`[DEBUG] Laudo salvo com sucesso`);
      toast({
        title: "Laudo salvo",
        description: "As informações do laudo foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.log(`[DEBUG] Erro no handleSave:`, error);
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
      console.log(`[DEBUG] Salvando metadados do processo:`, process);
      const normalizeStatus = (s: any) => {
        const v = String(s || '').trim();
        if (!v) return null;
        if (v === 'in_progress' || v === 'pending') return 'active';
        if (v === 'canceled') return 'cancelled';
        if (v === 'active' || v === 'completed' || v === 'cancelled' || v === 'archived') return v;
        return 'active';
      };

      const isMissingColumnError = (e: any) => {
        const msg = String(e?.message || "");
        const code = String(e?.code || "");
        return (
          code === "42703" ||
          code === "PGRST204" ||
          /does not exist|undefined column|column\s+.+\s+does not exist|could not find the/i.test(msg)
        );
      };

      const normalizeDateOnly = (v: unknown): string | null => {
        const s = String(v || "").trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return null;
      };

      const normalizeIsoDateTime = (v: unknown): string | null => {
        const s = String(v || "").trim();
        if (!s) return null;
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString();
      };

      const claimantEmail = normalizeEmail((process as any).claimant_email || "");
      const defendantEmail = normalizeEmail((process as any).defendant_email || "");

      const payloadFull: any = {
        process_number: process.process_number,
        claimant_name: process.claimant_name,
        defendant_name: sanitizeLawyerFromName(process.defendant_name),
        court: process.court,
        status: normalizeStatus(process.status),
        distribution_date: normalizeDateOnly(process.distribution_date),
        inspection_date: normalizeIsoDateTime(process.inspection_date),
        inspection_address: process.inspection_address,
        inspection_time: process.inspection_time || null,
        inspection_notes: process.inspection_notes || null,
        inspection_duration_minutes: typeof process.inspection_duration_minutes === "number" ? process.inspection_duration_minutes : (process.inspection_duration_minutes ? parseInt(String(process.inspection_duration_minutes), 10) : null),
        inspection_reminder_minutes: typeof process.inspection_reminder_minutes === "number" ? process.inspection_reminder_minutes : (process.inspection_reminder_minutes ? parseInt(String(process.inspection_reminder_minutes), 10) : null),
        inspection_status: process.inspection_status || null,
        claimant_email: claimantEmail || null,
        defendant_email: defendantEmail || null,
      };
      
      console.log(`[DEBUG] Payload para salvar:`, payloadFull);
  
      let { error } = await supabase
        .from("processes")
        .update(payloadFull)
        .eq("id", id);
  
      if (error) {
        console.log(`[DEBUG] Erro no salvamento completo, tentando fallback:`, error);
        if (isMissingColumnError(error)) {
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
        } else {
          throw error;
        }
      } else {
        console.log(`[DEBUG] Metadados salvos com sucesso`);
        try {
          const rc: any = process.report_config || {};
          console.log('[DEBUG] report_config persisted lengths (apos save – na memória):', {
            headerImageDataUrlLen: rc?.header?.imageDataUrl ? String(rc.header.imageDataUrl).length : 0,
            footerImageDataUrlLen: rc?.footer?.imageDataUrl ? String(rc.footer.imageDataUrl).length : 0,
          });
        } catch {}
      }
  
      toast({
        title: "Dados do processo salvos",
        description: "As informações do processo foram atualizadas.",
      });
    } catch (error: any) {
      console.log(`[DEBUG] Erro ao salvar metadados:`, error);
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
      console.log(`[DEBUG] Atualizando campo ${field}:`, value);
      if (field === 'report_config') {
        try {
          const rc: any = value || {};
          console.log('[DEBUG] report_config lengths:', {
            headerImageDataUrlLen: rc?.header?.imageDataUrl ? String(rc.header.imageDataUrl).length : 0,
            footerImageDataUrlLen: rc?.footer?.imageDataUrl ? String(rc.footer.imageDataUrl).length : 0,
            headerImageUrl: rc?.header?.imageUrl || '',
            footerImageUrl: rc?.footer?.imageUrl || '',
          });
        } catch {}
      }
      setProcess({ ...process, [field]: value });
    }
  };

  useEffect(() => {
    if (!process) return;
    const rcKey = JSON.stringify(process.report_config || {});
    const timer = setTimeout(async () => {
      try {
        const session = await validateAndRecoverSession();
        if (!session) return;
        await supabase
          .from("processes")
          .update({ report_config: process.report_config })
          .eq("id", process.id);
      } catch {}
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.report_config && JSON.stringify(process.report_config)]);

  // Auto-salvar alterações de EPCs/Proteção Coletiva para evitar perda entre seleção e geração do laudo
  useEffect(() => {
    // Salva apenas quando houver processo carregado e mudança nesses campos
    if (!process) return;
    const timer = setTimeout(async () => {
      // Evita salvar se nada foi modificado
      const hasChanges = typeof process.epcs === 'string' || typeof process.collective_protection === 'string';
      if (!hasChanges) return;
      const session = await validateAndRecoverSession();
      if (!session) return;
      await handleSave();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.epcs, process?.collective_protection]);

  useEffect(() => {
    if (!process?.id) return;
    (async () => {
      const { data } = await supabase
        .from('risk_agents')
        .select('*')
        .eq('process_id', process.id)
        .order('created_at', { ascending: false });
      setRiskAgents(data || []);
    })();
  }, [process?.id]);

  const handleAnnexesInAnalysis = async (rows: { annex: number; agent: string; exposure?: string; obs?: string }[]) => {
    try {
      const newRows = rows.filter((r) => !annexesMarkedForLLM.includes(r.annex));
      if (newRows.length === 0) return;
      setAnnexesMarkedForLLM((prev) => [...prev, ...newRows.map((r) => r.annex)]);
      setAnnexesForInsalubrityLLM((prev) => {
        const map = new Map(prev.map((r) => [r.annex, r]));
        newRows.forEach((r) => map.set(r.annex, r));
        return Array.from(map.values());
      });
      toast({ title: "Anexos em análise", description: "Preencha os resultados no item 16 para cada anexo." });
    } catch (error: any) {
      toast({ title: "Erro na seleção de anexos", description: error?.message ?? "Falha ao registrar anexos.", variant: "destructive" });
    }
  };

  const updateNR15AnnexExposure = (rows: { annex: number; agent: string; exposure?: string; obs?: string }[]) => {
    setAnnexesForInsalubrityLLM((prev) => {
      const allowed = new Set(["Em análise", "Ocorre exposição"]);
      const map = new Map(prev.map((r) => [r.annex, r]));
      rows.forEach((r) => {
        const exp = r.exposure;
        if (exp && !allowed.has(exp)) {
          map.delete(r.annex);
        } else {
          const existing = map.get(r.annex) || { annex: r.annex, agent: r.agent };
          map.set(r.annex, { ...existing, agent: r.agent, exposure: exp, obs: r.obs });
        }
      });
      return Array.from(map.values());
    });
  };

  const handleNR16AnnexesInAnalysis = async (rows: { annex: number; agent: string; obs?: string }[]) => {
    try {
      const newRows = rows.filter((r) => !annexesMarkedForLLM.includes(r.annex));
      if (newRows.length === 0) return;
      setAnnexesMarkedForLLM((prev) => [...prev, ...newRows.map((r) => r.annex)]);
      setAnnexesForPericulosityLLM((prev) => {
        const map = new Map(prev.map((r) => [r.annex, r]));
        newRows.forEach((r) => map.set(r.annex, r));
        return Array.from(map.values());
      });
      toast({ title: "Anexos em análise", description: "Preencha os resultados no item 19 para cada anexo." });
    } catch (error: any) {
      toast({ title: "Erro na seleção de anexos", description: error?.message ?? "Falha ao registrar anexos.", variant: "destructive" });
    }
  };

  const updateNR16AnnexExposure = (rows: { annex: number; agent: string; exposure?: string; obs?: string }[]) => {
    setAnnexesForPericulosityLLM((prev) => {
      const allowed = new Set(["Em análise", "Ocorre exposição"]);
      const map = new Map(prev.map((r) => [r.annex, r]));
      rows.forEach((r) => {
        const exp = r.exposure;
        if (exp && !allowed.has(exp)) {
          map.delete(r.annex);
        } else {
          const existing = map.get(r.annex) || { annex: r.annex, agent: r.agent };
          map.set(r.annex, { ...existing, agent: r.agent, obs: r.obs });
        }
      });
      return Array.from(map.values());
    });
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

      const episRaw = Array.isArray(process?.epis) ? process!.epis : [];
      const epis: EPIInput[] = (episRaw as any[]).filter(Boolean).map((epi: any) => ({
        equipment: String(epi?.equipment ?? epi?.name ?? ""),
        protection: String(epi?.protection ?? epi?.desc ?? epi?.observation ?? ""),
        ca: String(epi?.ca ?? ""),
      }));
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

  const handleGenerateReport = async (reportType: 'insalubridade' | 'periculosidade' | 'completo') => {
    if (!process?.id) return;
    try {
      await handleSave();

      const { data: questionnairesData } = await supabase
        .from("questionnaires")
        .select("*")
        .eq("process_id", process.id)
        .order("party", { ascending: true })
        .order("question_number", { ascending: true });

      const claimantQuesitos = questionnairesData?.filter((q: any) => q.party === 'claimant') || [];
      const respondentQuesitos = questionnairesData?.filter((q: any) => q.party === 'defendant') || [];
      const judgeQuesitos = questionnairesData?.filter((q: any) => q.party === 'judge') || [];

      const { data: procCfgPdf } = await supabase
        .from("processes")
        .select("report_config")
        .eq("id", process.id)
        .single();

      const result = await generateReport({ processId: process.id, reportType });
      const ok = !!(result as any)?.success;
      if (!ok) {
        throw new Error((result as any)?.message || 'Falha ao gerar relatório');
      }

      const processForReport = {
        process_number: process.process_number,
        claimant_name: process.claimant_name,
        defendant_name: process.defendant_name,
        court: process.court,
        objective: process.objective || "",
        methodology: process.methodology || "",
        workplace_characteristics: safeParseJson(process.workplace_characteristics, {}),
        activities_description: process.activities_description || "",
        insalubrity_analysis: process.insalubrity_analysis || "",
        insalubrity_results: process.insalubrity_results || "",
        periculosity_analysis: process.periculosity_analysis || "",
        periculosity_results: process.periculosity_results || "",
        conclusion: process.conclusion || "",
        cover_data: safeParseJson(process.cover_data, {}),
        identifications: safeParseJson(process.identifications, {}),
        claimant_data: safeParseJson(process.claimant_data, {}),
        defendant_data: process.defendant_data || "",
        initial_data: process.initial_data || "",
        defense_data: process.defense_data || "",
        diligence_data: safeParseArray(process.diligence_data, []),
        collective_protection: process.collective_protection || "",
        periculosity_concept: process.periculosity_concept || "",
        flammable_definition: process.flammable_definition || "",
        epis: safeParseArray(process.epis, []),
        attendees: safeParseArray(process.attendees, []),
        documents_presented: safeParseArray(process.documents_presented, []),
        discordances_presented: process.discordances_presented || "",
        inspection_date: process.inspection_date,
        inspection_address: process.inspection_address,
        inspection_time: process.inspection_time,
        inspection_city: process.inspection_city,
        report_config: safeParseJson(procCfgPdf?.report_config, {}),
        claimant_questions: claimantQuesitos,
        respondent_questions: respondentQuesitos,
        judge_questions: judgeQuesitos,
        quesitos_reclamante: claimantQuesitos,
        quesitos_reclamada: respondentQuesitos,
      } as any;

      await exportReportAsPdf('', processForReport, { reportType });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar relatório', description: err?.message ?? 'Falha ao gerar relatório', variant: 'destructive' });
    }
  };

  const detectAgentsFromText = (text: string): Array<{ agent_name: string; agent_type: string; risk_level?: string }> => {
    const lower = String(text || '').toLowerCase();
    const found: Array<{ agent_name: string; agent_type: string; risk_level?: string }> = [];
    const add = (name: string, type: string, level?: string) => {
      if (!found.some(f => f.agent_name === name && f.agent_type === type)) found.push({ agent_name: name, agent_type: type, risk_level: level });
    };
    if (/(ru[ií]do|decibel|db\b)/.test(lower)) add('Ruído', 'insalubridade', 'alto');
    if (/(calor|temperatura|ibutg)/.test(lower)) add('Calor', 'insalubridade', 'médio');
    if (/(fumo|poeira|po[eé]iras|particulado|sílica)/.test(lower)) add('Poeiras/Particulados', 'insalubridade');
    if (/(solventes|benzeno|tolueno|xileno|agentes qu[ií]micos)/.test(lower)) add('Agentes Químicos', 'insalubridade');
    if (/(eletricidade|alta tens[aã]o|baixa tens[aã]o)/.test(lower)) add('Eletricidade', 'periculosidade', 'alto');
    if (/(inflam[aá]vel|g[aá]s|gpl|glp|combust[ií]vel|liquidos inflam[aá]veis)/.test(lower)) add('Inflamáveis', 'periculosidade', 'alto');
    if (/(explosivo|detonante|explos[aã]o)/.test(lower)) add('Explosivos', 'periculosidade', 'alto');
    if (/(radia[cç][ãa]o|ionizante|n[ãa]o ionizante)/.test(lower)) add('Radiação', 'insalubridade');
    return found;
  };

  const refreshDetectedAgents = async () => {
    if (!process?.id) return;
    try {
      const initialText = String(process.initial_data || "");
      const initialDetected = initialText ? detectAgentsFromText(initialText) : [];

      const { data: docs } = await supabase
        .from("documents")
        .select("name, description, file_type, file_path")
        .eq("process_id", process.id);
      const textPool = ((docs || []) as any[])
        .map((d) => `${d.name}\n${d.description || ''}`)
        .join("\n\n");
      const docDetected = textPool ? detectAgentsFromText(textPool) : [];

      setDetectedInitialAgents(initialDetected);
      setDetectedDocumentAgents(docDetected);
      toast({ title: "Detecções atualizadas", description: `${initialDetected.length + docDetected.length} risco(s) detectados` });
    } catch (err: any) {
      toast({ title: "Falha ao detectar riscos", description: err?.message ?? "Erro ao analisar a inicial e documentos.", variant: "destructive" });
    }
  };

  const getGeneratedContentOrFallback = (generated: any): string => {
    const content: string | undefined = generated?.data?.content || (generated as any)?.content;
    if (content && typeof content === "string" && content.trim()) return content;
    // Fallback: compõe texto completo do laudo a partir do estado atual (aba Laudo)
    try {
      const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : "");
      const fmtTime = (t?: string | null) => {
        if (!t) return "";
        const parts = String(t).split(":");
        return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : String(t);
      };

      let text = "LAUDO PERICIAL TRABALHISTA\n\n";

      // Identificação do processo
      text += `IDENTIFICAÇÃO DO PROCESSO\n`;
      text += `Processo: ${process.process_number || 'Não informado'}\n`;
      text += `Requerente: ${process.claimant_name || 'Não informado'}\n`;
      // Sanitizar possíveis trechos "ADVOGADO:" acoplados ao nome da reclamada
      const defendantSanitized = String(process.defendant_name || '')
        .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      text += `Requerido: ${defendantSanitized || 'Não informado'}\n`;
      if (process.court) text += `Vara: ${process.court}\n`;
      text += "\n";

      // 1. Identificações (apenas Número do Processo, Reclamante e Reclamada)
      if (process.identifications && typeof process.identifications === 'object') {
        text += `1. IDENTIFICAÇÕES\n`;
        const ids = process.identifications as Record<string, any>;
        const processNumber = ids.processNumber || process.process_number;
        const claimantName = ids.claimantName || process.claimant_name;
        const defendantName = ids.defendantName || process.defendant_name;
        if (processNumber) text += `Número do Processo: ${processNumber}\n`;
        if (claimantName) text += `Reclamante: ${claimantName}\n`;
        if (defendantName) text += `Reclamada: ${defendantName}\n`;
        text += `\n`;
      }

      // 2. Dados da(o) Reclamante
      text += `2. DADOS DA(O) RECLAMANTE\n`;
      const claimant = process.claimant_data as any;
      if (claimant && typeof claimant === 'object') {
        if (claimant.name) text += `Nome: ${claimant.name}\n`;
        if (Array.isArray(claimant.positions) && claimant.positions.length) {
          text += `Cargos exercidos:\n`;
          (claimant.positions as any[]).forEach((p, i) => {
            const title = p?.title ? String(p.title) : '';
            const period = p?.period ? String(p.period) : '';
            const obs = p?.obs ? String(p.obs) : '';
            const parts: string[] = [];
            if (title) parts.push(`Função: ${title}`);
            if (period) parts.push(`Período: ${period}`);
            if (obs) parts.push(`Obs: ${obs}`);
            text += `${i + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(p)}\n`;
          });
        }
        text += `\n`;
      } else {
        text += `${claimant || 'Não informado'}\n\n`;
      }

      // 3. Dados da Reclamada
      text += `3. DADOS DA RECLAMADA\n`;
      text += `${(process.defendant_data as any) || 'Não informado'}\n\n`;

      // 4. Objetivo
      text += `4. OBJETIVO\n`;
      text += `${process.objective || 'Não informado'}\n\n`;

      // 5. Dados da Inicial
      text += `5. DADOS DA INICIAL\n`;
      text += `${process.initial_data || 'Não informado'}\n\n`;

      // 6. Dados da Contestação
      text += `6. DADOS DA CONTESTAÇÃO DA RECLAMADA\n`;
      text += `${process.defense_data || 'Não informado'}\n\n`;

      // 7. Diligências / Vistorias
      if (process.diligence_data || process.inspection_date) {
        text += `7. DILIGÊNCIAS / VISTORIAS\n`;
        const dils = (process.diligence_data as any[]) || [];
        if (Array.isArray(dils) && dils.length > 0) {
          dils.forEach((d, idx) => {
            text += `Vistoria ${idx + 1}:\n`;
            if (d?.date) text += `Data: ${fmtDate(d.date)}\n`;
            if (d?.location) text += `Local: ${d.location}\n`;
            if (d?.city) text += `Cidade: ${d.city}\n`;
            if (d?.time) text += `Horário: ${fmtTime(d.time)}\n`;
            if (d?.description) text += `Descrição: ${d.description}\n`;
            text += `\n`;
          });
        } else {
          if (process.inspection_date) text += `Data: ${fmtDate(process.inspection_date)}\n`;
          if (process.inspection_address) text += `Local: ${process.inspection_address}\n`;
          if (process.inspection_city) text += `Cidade: ${process.inspection_city}\n`;
          if (process.inspection_time) text += `Horário: ${fmtTime(process.inspection_time)}\n`;
          text += `\n`;
        }
      }

      // 8. Acompanhantes / Entrevistados
      const attendees = (process.attendees as any[]) || [];
      if (Array.isArray(attendees) && attendees.length > 0) {
        text += `8. ACOMPANHANTES / ENTREVISTADOS\n`;
        attendees.forEach((a, i) => {
          if (a && typeof a === 'object') {
            const parts: string[] = [];
            if (a.name) parts.push(`Nome: ${a.name}`);
            if (a.function) parts.push(`Função: ${a.function}`);
            if (a.company) parts.push(`Empresa: ${a.company}`);
            if (a.obs) parts.push(`Obs: ${a.obs}`);
            text += `${i + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(a)}\n`;
          } else {
            text += `${i + 1}. ${a}\n`;
          }
        });
        text += `\n`;
      }

      // 9. Metodologia
      text += `9. METODOLOGIA\n`;
      text += `${process.methodology || 'Não informado'}\n\n`;

      // 10. Documentações apresentadas
      const docs = (process.documents_presented as any[]) || [];
      text += `10. DOCUMENTAÇÕES APRESENTADAS\n`;
      if (Array.isArray(docs) && docs.length > 0) {
        docs.forEach((doc, i) => {
          if (doc && typeof doc === 'object') {
            const name = doc.name ? String(doc.name) : '';
            const presented = typeof doc.presented === 'boolean' ? (doc.presented ? 'Sim' : 'Não') : '';
            const obs = doc.obs ? String(doc.obs) : '';
            const parts: string[] = [];
            if (name) parts.push(name);
            if (presented) parts.push(`Apresentado: ${presented}`);
            if (obs) parts.push(`Obs: ${obs}`);
            text += `${i + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(doc)}\n`;
          } else {
            text += `${i + 1}. ${doc}\n`;
          }
        });
      } else {
        text += `Não informado\n`;
      }
      text += `\n`;

      // 11. Características do local de trabalho
      text += `11. CARACTERÍSTICAS DO LOCAL DE TRABALHO\n`;
      text += `${process.workplace_characteristics ? JSON.stringify(process.workplace_characteristics, null, 2) : 'Não informado'}\n\n`;

      // 12. Atividades da Reclamante
      text += `12. ATIVIDADES DA RECLAMANTE\n`;
      text += `${process.activities_description || 'Não informado'}\n\n`;

      // 13. EPIs
      text += `13. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)\n`;
      {
        const introDefault = "Para função exercida pela Reclamante a empresa realizava a entrega dos seguintes equipamentos de proteção individual - E.P.I. (Art. 166 da CLT e NR-6, item 6.2 da Portaria nº 3214/78 do MTE):";
        const introText = String((process as any).epi_intro || (process as any).epi_introduction || introDefault).trim();
        if (introText) text += `${introText}\n\n`;
      }
      const epis = (process.epis as any[]) || [];
      if (Array.isArray(epis) && epis.length > 0) {
        epis.forEach((epi, i) => {
          if (epi && typeof epi === 'object') {
            const name = epi.name ? String(epi.name) : '';
            const ca = epi.ca ? String(epi.ca) : '';
            const parts: string[] = [];
            if (name) parts.push(name);
            if (ca) parts.push(`CA: ${ca}`);
            text += `${i + 1}. ${parts.length ? parts.join(' | ') : JSON.stringify(epi)}\n`;
          } else {
            text += `${i + 1}. ${epi}\n`;
          }
        });
      } else {
        text += `Não informado\n`;
      }
      text += `\n`;

      // 14. EPCs / Proteção coletiva
      text += `14. EQUIPAMENTOS DE PROTEÇÃO COLETIVA (EPCs)\n`;
      if (process.collective_protection) text += `${process.collective_protection}\n`;
      if (process.epcs && process.epcs !== process.collective_protection) text += `${process.epcs}\n`;
      if (!process.collective_protection && !process.epcs) text += `Não informado\n`;
      text += `\n`;

      // 21. Conclusão (mantém numeração do gerador remoto)
      text += `21. CONCLUSÃO\n`;
      text += `${process.conclusion || 'Não informado'}\n\n`;

      text += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
      return text;
    } catch {
      return "Laudo gerado.";
    }
  };

  // Função helper para verificar se há imagem de cabeçalho
  const hasHeaderImage = () => {
    const cfgRaw = (process as any).report_config;
    const cfg = (cfgRaw && typeof cfgRaw === 'object') ? cfgRaw : (safeParseJson(cfgRaw, {}) as any);
    const headerCfg = (cfg?.header || {}) as any;
    return !!(headerCfg.imageDataUrl && String(headerCfg.imageDataUrl).trim()) || !!(headerCfg.imageUrl && String(headerCfg.imageUrl).trim());
  };

  const getEffectiveReportType = (): 'insalubridade' | 'periculosidade' | 'completo' => {
    const rc = safeParseJson((process as any)?.report_config, {}) as any;
    const flags = (rc?.flags || {}) as any;
    const explicit = normalizeReportType(flags?.reportType);
    const tables = (rc?.analysis_tables || {}) as any;
    const rows15 = Array.isArray(tables?.nr15) ? tables.nr15 : [];
    const rows16 = Array.isArray(tables?.nr16) ? tables.nr16 : [];

    const hasSelected = (rows: any[]) =>
      rows.some((r) => {
        const exp = String(r?.exposure ?? '').trim();
        return exp === 'Em análise' || exp === 'Ocorre exposição';
      });

    const hasNr15Selected = hasSelected(rows15);
    const hasNr16Selected = hasSelected(rows16);

    if (explicit === 'completo') return 'completo';
    if (explicit === 'insalubridade' && hasNr16Selected) return 'completo';
    if (explicit === 'periculosidade' && hasNr15Selected) return 'completo';
    if (explicit) return explicit;

    const nr15Flag = typeof flags?.show_nr15_item15 === 'boolean' ? flags.show_nr15_item15 : undefined;
    const nr16Flag = typeof flags?.show_nr16_item15 === 'boolean' ? flags.show_nr16_item15 : undefined;
    if (nr15Flag === true && nr16Flag !== true) return 'insalubridade';
    if (nr16Flag === true && nr15Flag !== true) return 'periculosidade';

    const hasNr15 = hasNr15Selected;
    const hasNr16 = hasNr16Selected;

    const normText = (t: any) => {
      const s = String(t ?? '').trim();
      if (!s) return '';
      if (/^n[ãa]o\s+informado\.?$/i.test(s)) return '';
      return s;
    };

    const hasIns = !!normText((process as any)?.insalubrity_analysis) || !!normText((process as any)?.insalubrity_results) || hasNr15;
    const hasPer =
      !!normText((process as any)?.periculosity_analysis) ||
      !!normText((process as any)?.periculosity_concept) ||
      !!normText((process as any)?.periculosity_results) ||
      !!normText((process as any)?.flammable_definition) ||
      hasNr16;

    if (hasIns && !hasPer) return 'insalubridade';
    if (hasPer && !hasIns) return 'periculosidade';
    if (hasIns && hasPer) return 'completo';
    return 'insalubridade';
  };

  const handleExportDocx = async () => {
    if (!process?.id) return;
    await handleSave();
    // Aviso: imagem de cabeçalho ausente (prossegue mesmo assim)
    if (!hasHeaderImage()) {
      toast({
        title: "Exportando sem imagem de cabeçalho",
        description: "Você pode adicionar uma imagem em Configuração do Relatório → Cabeçalho.",
      });
    }

    const reportType = getEffectiveReportType();

    const { data: questionnairesData } = await supabase
      .from("questionnaires")
      .select("*")
      .eq("process_id", process.id)
      .order("party", { ascending: true })
      .order("question_number", { ascending: true });
    
    const claimantQuesitos = questionnairesData?.filter(q => q.party === 'claimant') || [];
    const respondentQuesitos = questionnairesData?.filter(q => q.party === 'defendant') || [];
    const judgeQuesitos = questionnairesData?.filter(q => q.party === 'judge') || [];
    const { data: procCfgDocx } = await supabase
      .from("processes")
      .select("report_config")
      .eq("id", process.id)
      .single();

    const generated = await generateReport({ processId: process.id, reportType });
    const text = getGeneratedContentOrFallback(generated);

    const processForReport = {
      process_number: process.process_number,
      claimant_name: process.claimant_name,
      defendant_name: process.defendant_name,
      court: process.court,
      objective: process.objective || "",
      methodology: process.methodology || "",
      workplace_characteristics: safeParseJson(process.workplace_characteristics, {}),
      activities_description: process.activities_description || "",
      insalubrity_analysis: process.insalubrity_analysis || "",
      insalubrity_results: process.insalubrity_results || "",
      periculosity_analysis: process.periculosity_analysis || "",
      periculosity_results: process.periculosity_results || "",
      conclusion: process.conclusion || "",
      cover_data: safeParseJson(process.cover_data, {}),
      identifications: safeParseJson(process.identifications, {}),
      claimant_data: safeParseJson(process.claimant_data, {}),
      defendant_data: process.defendant_data || "",
      initial_data: process.initial_data || "",
      defense_data: process.defense_data || "",
      diligence_data: safeParseArray(process.diligence_data, []),
      collective_protection: process.collective_protection || "",
      periculosity_concept: process.periculosity_concept || "",
      flammable_definition: process.flammable_definition || "",
      epis: safeParseArray(process.epis, []),
      attendees: safeParseArray(process.attendees, []),
      documents_presented: safeParseArray(process.documents_presented, []),
      discordances_presented: process.discordances_presented || "",
      inspection_date: process.inspection_date,
      inspection_address: process.inspection_address,
      inspection_time: process.inspection_time,
      inspection_city: process.inspection_city,
      report_config: safeParseJson(procCfgDocx?.report_config, {}),
      claimant_questions: claimantQuesitos,
      respondent_questions: respondentQuesitos,
      judge_questions: judgeQuesitos,
      quesitos_reclamante: claimantQuesitos,
      quesitos_reclamada: respondentQuesitos,
    } as any;
    await exportReportAsDocx(text, processForReport, { reportType });
  };

  const handleExportPdf = async () => {
    if (!process?.id) return;
    await handleSave();
    // Aviso: imagem de cabeçalho ausente (prossegue mesmo assim)
    if (!hasHeaderImage()) {
      toast({
        title: "Exportando sem imagem de cabeçalho",
        description: "Você pode adicionar uma imagem em Configuração do Relatório → Cabeçalho.",
      });
    }

    const reportType = getEffectiveReportType();

    const { data: questionnairesData } = await supabase
      .from("questionnaires")
      .select("*")
      .eq("process_id", process.id)
      .order("party", { ascending: true })
      .order("question_number", { ascending: true });
    
    const claimantQuesitos = questionnairesData?.filter(q => q.party === 'claimant') || [];
    const respondentQuesitos = questionnairesData?.filter(q => q.party === 'defendant') || [];
    const judgeQuesitos = questionnairesData?.filter(q => q.party === 'judge') || [];
    const { data: procCfgPdf } = await supabase
      .from("processes")
      .select("report_config")
      .eq("id", process.id)
      .single();
    const generated = await generateReport({ processId: process.id, reportType });
    const text = getGeneratedContentOrFallback(generated);
    const processForReport = {
      process_number: process.process_number,
      claimant_name: process.claimant_name,
      defendant_name: process.defendant_name,
      court: process.court,
      objective: process.objective || "",
      methodology: process.methodology || "",
      workplace_characteristics: safeParseJson(process.workplace_characteristics, {}),
      activities_description: process.activities_description || "",
      insalubrity_analysis: process.insalubrity_analysis || "",
      insalubrity_results: process.insalubrity_results || "",
      periculosity_analysis: process.periculosity_analysis || "",
      periculosity_results: process.periculosity_results || "",
      conclusion: process.conclusion || "",
      cover_data: safeParseJson(process.cover_data, {}),
      identifications: safeParseJson(process.identifications, {}),
      claimant_data: safeParseJson(process.claimant_data, {}),
      defendant_data: process.defendant_data || "",
      initial_data: process.initial_data || "",
      defense_data: process.defense_data || "",
      diligence_data: safeParseArray(process.diligence_data, []),
      collective_protection: process.collective_protection || "",
      periculosity_concept: process.periculosity_concept || "",
      flammable_definition: process.flammable_definition || "",
      epis: safeParseArray(process.epis, []),
      attendees: safeParseArray(process.attendees, []),
      documents_presented: safeParseArray(process.documents_presented, []),
      discordances_presented: process.discordances_presented || "",
      inspection_date: process.inspection_date,
      inspection_address: process.inspection_address,
      inspection_time: process.inspection_time,
      inspection_city: process.inspection_city,
      report_config: safeParseJson(procCfgPdf?.report_config, {}),
      claimant_questions: claimantQuesitos,
      respondent_questions: respondentQuesitos,
      judge_questions: judgeQuesitos,
      quesitos_reclamante: claimantQuesitos,
      quesitos_reclamada: respondentQuesitos,
    } as any;
    await exportReportAsPdf(text, processForReport, { reportType });
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

  const defaultTab = (() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("tab");
      const v = String(raw || "").trim();
      const allowed = new Set(["processo", "agendamento", "laudo", "laudo-automatico", "relatorios", "agentes", "documentos"]);
      return allowed.has(v) ? v : "laudo";
    } catch {
      return "laudo";
    }
  })();

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

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
             <TabsTrigger value="processo">Processo</TabsTrigger>
             <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
             <TabsTrigger value="laudo">Laudo</TabsTrigger>
             <TabsTrigger value="laudo-automatico">Progresso do Laudo</TabsTrigger>
             <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
             <TabsTrigger value="agentes">Agentes de Risco</TabsTrigger>
             <TabsTrigger value="documentos">Documentos</TabsTrigger>
           </TabsList>

          <TabsContent value="processo" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Dados do Processo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const courtOptions = Array.isArray(rc?.court_options) ? (rc.court_options as string[]) : [];
                  return (
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
                        <p className="text-sm text-muted-foreground mb-1">Vara / Tribunal</p>
                        {courtOptions.length > 0 ? (
                          <Select
                            value={(process.court || undefined) as any}
                            onValueChange={(v) => updateProcess("court", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a vara/tribunal" />
                            </SelectTrigger>
                            <SelectContent>
                              {courtOptions.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={process.court || ""}
                            onChange={(e) => updateProcess("court", e.target.value)}
                            placeholder="Vara do Trabalho"
                          />
                        )}
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
                        <p className="text-sm text-muted-foreground mb-1">Data da distribuição do processo</p>
                        <Input
                          type="date"
                          value={process.distribution_date || ""}
                          onChange={(e) => updateProcess("distribution_date", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                        <Select
                          value={(() => {
                            const v = String(process.status || "").trim();
                            if (v === "in_progress" || v === "pending") return "active";
                            if (v === "canceled") return "cancelled";
                            if (v === "active" || v === "completed" || v === "cancelled" || v === "archived") return v;
                            return "active";
                          })()}
                          onValueChange={(v) => updateProcess("status", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Em Andamento</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                            <SelectItem value="archived">Arquivado</SelectItem>
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
                  );
                })()}
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
                <div className="flex gap-2 mt-2">
                  <a
                    className="text-sm text-primary inline-flex items-center gap-1"
                    href={`https://www.google.com/maps/search/?q=${encodeURIComponent(process.inspection_address || "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir no Maps
                  </a>
                  <a
                    className="text-sm text-primary inline-flex items-center gap-1"
                    href={toGoogleCalendarURL(process)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Adicionar ao Google Calendar
                  </a>
                </div>
              </div>
            </div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
  <div>
    <p className="text-sm text-muted-foreground mb-1">Status do Agendamento</p>
    <Select
      value={process?.inspection_status || "scheduled_pending"}
      onValueChange={(v) => updateProcess("inspection_status", v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="scheduled_pending">Pendente</SelectItem>
        <SelectItem value="scheduled_confirmed">Confirmado</SelectItem>
        <SelectItem value="rescheduled">Reagendado</SelectItem>
        <SelectItem value="cancelled">Cancelado</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Mensagem para agendamento</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nome do contato</p>
                    <Input
                      value={scheduleContactName}
                      onChange={(e) => setScheduleContactName(e.target.value)}
                      placeholder="Ex.: Reclamante"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Telefone (WhatsApp)</p>
                    <Input
                      value={scheduleContactPhone}
                      onChange={(e) => setScheduleContactPhone(e.target.value)}
                      placeholder="Ex.: 11 99999-9999"
                      inputMode="tel"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!process) return;
                        const msg = buildScheduleMessage(process, scheduleContactName);
                        setScheduleMessageText(msg);
                        toast({ title: "Mensagem gerada", description: "Texto preenchido com os dados do agendamento." });
                      }}
                    >
                      Gerar mensagem
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={scheduleMessageText}
                  onChange={(e) => setScheduleMessageText(e.target.value)}
                  className="min-h-[140px]"
                  placeholder="Digite a mensagem que será enviada ao contato..."
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={copyScheduleMessage}>
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                  </Button>
                  <Button type="button" onClick={openWhatsApp}>
                    Abrir WhatsApp
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">E-mail para agendamento</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">E-mail do reclamante</p>
                    <Input
                      value={scheduleClaimantEmail}
                      onChange={(e) => {
                        const v = normalizeEmail(e.target.value);
                        setScheduleClaimantEmail(v);
                        updateProcess("claimant_email" as any, v || null);
                      }}
                      placeholder="ex.: reclamante@email.com"
                      inputMode="email"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">E-mail da reclamada</p>
                    <Input
                      value={scheduleDefendantEmail}
                      onChange={(e) => {
                        const v = normalizeEmail(e.target.value);
                        setScheduleDefendantEmail(v);
                        updateProcess("defendant_email" as any, v || null);
                      }}
                      placeholder="ex.: reclamada@email.com"
                      inputMode="email"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!process) return;
                        const defaultName = String(process.claimant_name || process.defendant_name || "").trim();
                        setScheduleEmailBody(buildScheduleMessage(process, defaultName));
                        if (!String(scheduleEmailSubject || "").trim()) {
                          const baseSubject = `Agendamento/Confirmação de Perícia — Processo ${String(process.process_number || "").trim()}`.trim();
                          setScheduleEmailSubject(baseSubject);
                        }
                        toast({ title: "Mensagem gerada", description: "Assunto e corpo preenchidos com os dados do agendamento." });
                      }}
                    >
                      Gerar e-mail
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Assunto</p>
                  <Input value={scheduleEmailSubject} onChange={(e) => setScheduleEmailSubject(e.target.value)} placeholder="Assunto do e-mail" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Corpo do e-mail</p>
                  <Textarea
                    value={scheduleEmailBody}
                    onChange={(e) => setScheduleEmailBody(e.target.value)}
                    className="min-h-[160px]"
                    placeholder="Digite a mensagem do e-mail..."
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => refreshScheduleEmailReceipts(process?.id)}>
                    Atualizar status
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => sendScheduleEmail([{ role: "claimant", email: scheduleClaimantEmail }])}>
                    Enviar para reclamante
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => sendScheduleEmail([{ role: "defendant", email: scheduleDefendantEmail }])}>
                    Enviar para reclamada
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      sendScheduleEmail([
                        { role: "claimant", email: scheduleClaimantEmail },
                        { role: "defendant", email: scheduleDefendantEmail },
                      ])
                    }
                  >
                    Enviar para ambos
                  </Button>
                </div>

                {Array.isArray(scheduleEmailReceipts) && scheduleEmailReceipts.length > 0 && (
                  <div className="border rounded-md p-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Enviado</TableHead>
                          <TableHead>Aberto</TableHead>
                          <TableHead>Confirmado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduleEmailReceipts.map((r: any) => {
                          const role = String(r?.recipient_role || "");
                          const toLabel = role === "claimant" ? "Reclamante" : role === "defendant" ? "Reclamada" : role || "Outro";
                          const email = String(r?.recipient_email || "");
                          const status = String(r?.status || "");
                          const hasOpen = !!r?.opened_at;
                          const hasConfirm = !!r?.confirmed_at;
                          const statusLabel = hasConfirm
                            ? "Confirmado"
                            : hasOpen
                              ? "Aberto"
                              : status === "sent"
                                ? "Enviado"
                                : status === "sending"
                                  ? "Enviando"
                                  : status === "error"
                                    ? "Erro"
                                    : status || "-";
                          const statusVariant = hasConfirm ? "default" : status === "error" ? "destructive" : "secondary";
                          const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "-");

                          return (
                            <TableRow key={String(r?.id || Math.random())}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{toLabel}</span>
                                  <span className="text-xs text-muted-foreground">{email}</span>
                                  {r?.error && <span className="text-xs text-destructive">{String(r.error)}</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{fmt(r?.sent_at)}</TableCell>
                              <TableCell className="text-sm">{fmt(r?.opened_at)}</TableCell>
                              <TableCell className="text-sm">{fmt(r?.confirmed_at)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
              <div className="flex justify-between gap-2 flex-wrap sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-2">
                <div />
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-sm text-muted-foreground">Tipo do laudo</span>
                    <Select
                      value={(() => {
                        const rc = safeParseJson(process.report_config, {}) as any;
                        const flags = (rc?.flags || {}) as any;
                        const explicit = normalizeReportType(flags?.reportType);
                        if (explicit) return explicit;
                        return getEffectiveReportType();
                      })()}
                      onValueChange={(v) => {
                        const rc = safeParseJson(process.report_config, {}) as any;
                        const nextRc = { ...rc, flags: { ...(rc?.flags || {}), reportType: v } };
                        updateProcess("report_config" as any, nextRc);
                      }}
                    >
                      <SelectTrigger className="w-48 h-9">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insalubridade">Insalubridade</SelectItem>
                        <SelectItem value="periculosidade">Periculosidade</SelectItem>
                        <SelectItem value="completo">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Laudo"}
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button variant="outline" onClick={handleExportDocx} disabled={!process?.id || reportLoading}>
                            <FileDown className="w-4 h-4 mr-2" /> Exportar DOCX
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Exportar laudo em formato DOCX
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button variant="outline" onClick={handleExportPdf} disabled={!process?.id || reportLoading}>
                            <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Exportar laudo em formato PDF
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Capa sem numeração */}
              <CoverSection
                value={safeParseJson(process.cover_data, {}) as any}
                onChange={(v) => updateProcess("cover_data", v)}
                identifications={safeParseJson(process.identifications, {}) as any}
                processMeta={{
                  inspection_date: process.inspection_date,
                  inspection_address: process.inspection_address,
                  inspection_city: process.inspection_city,
                }}
              />

              {/* 1. Identificações */}
              {(() => {
                const rc = safeParseJson(process.report_config, {}) as any;
                const courtOptions = Array.isArray(rc?.court_options) ? (rc.court_options as string[]) : [];
                return (
                  <IdentificationsSection
                value={{
                  processNumber: (safeParseJson(process.identifications, {}) as any).processNumber ?? process.process_number ?? "",
                  claimantName: (safeParseJson(process.identifications, {}) as any).claimantName ?? process.claimant_name ?? "",
                  defendantName: (safeParseJson(process.identifications, {}) as any).defendantName ?? process.defendant_name ?? "",
                  court: (safeParseJson(process.identifications, {}) as any).court ?? process.court ?? "",
                }}
                onChange={(v) => updateProcess("identifications", v)}
                courtOptions={courtOptions}
              />
                );
              })()}

              {/* 2. Dados da Reclamante */}
              <ClaimantDataSection
                value={{
                  name: (safeParseJson(process.claimant_data, {}) as any).name ?? process.claimant_name ?? "",
                  positions: (safeParseJson(process.claimant_data, {}) as any).positions ?? [],
                }}
                syncedFromProcess={claimantSynced}
                onChange={(v) => updateProcess("claimant_data", v)}
              />

              {/* 3. Dados da Reclamada */}
              <DefendantDataSection
                value={typeof process.defendant_data === "string" ? process.defendant_data : ""}
                onChange={(v) => updateProcess("defendant_data", v)}
              />

              {/* 4. Objetivo */}
              <ObjectiveSection
                value={typeof process.objective === "string" ? process.objective : ""}
                onChange={(v) => updateProcess("objective", v)}
              />

              {/* 5. Dados da Inicial */}
              <InitialDataSection
                value={process.initial_data || ""}
                onChange={(v) => updateProcess("initial_data", v)}
                onFlagsChange={(flags) => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const nextRc = { ...rc, flags: { ...(rc?.flags || {}), ...flags } };
                  updateProcess("report_config" as any, nextRc);
                }}
              />

              {/* 6. Dados da Contestação */}
              <DefenseDataSection
                value={process.defense_data || ""}
                onChange={(v) => updateProcess("defense_data", v)}
              />

              {/* 7. Diligências */}
              <DiligencesSection
                value={safeParseArray(process.diligence_data, []) as any}
                onChange={(v) => updateProcess("diligence_data", v)}
                processData={{
                  inspection_address: process.inspection_address,
                  inspection_city: process.inspection_city,
                  inspection_date: process.inspection_date,
                  inspection_time: process.inspection_time,
                }}
              />

              {/* 8. Acompanhantes */}
              <AttendeesSection
                value={safeParseArray(process.attendees, []) as any}
                onChange={(v) => updateProcess("attendees", v)}
                processId={process.id}
              />

              {/* 9. Metodologia */}
              <MethodologySection
                value={process.methodology || ""}
                onChange={(v) => updateProcess("methodology", v)}
                templates={(() => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const raw = Array.isArray(rc?.methodology_templates) ? rc.methodology_templates : [];
                  return raw.map((t: any) => ({
                    id: String(t?.id || ""),
                    name: String(t?.name || "Sem nome"),
                    text: String(t?.text || ""),
                  })).filter((t: any) => !!t.id);
                })()}
                onApplyTemplate={(t) => {
                  const prev = process.methodology || "";
                  const body = String(t?.text || "").trim();
                  const nextVal = [String(prev || "").trim(), body].filter(Boolean).join("\n\n");
                  updateProcess("methodology", nextVal);
                  try { toast({ title: "Template aplicado", description: "Conteúdo inserido no item 9." }); } catch {}
                }}
                onCreateTemplate={handleAddMethodologyTemplate}
                onManageTemplates={() => setShowMethodologyTemplates((v) => !v)}
              />

              {showMethodologyTemplates && (
                <div className="border rounded p-2">
                  <TemplatesSection
                    value={(() => {
                      const rc = safeParseJson(process.report_config, {}) as any;
                      const raw = Array.isArray(rc?.methodology_templates) ? rc.methodology_templates : [];
                      return raw.map((t: any) => ({
                        id: String(t?.id || Math.random().toString(36).slice(2)),
                        name: String(t?.name || "Sem nome"),
                        text: String(t?.text || ""),
                        nr15_annexes: [],
                        nr16_annexes: [],
                        nr15_enquadramento: false,
                        nr16_enquadramento: false,
                        category: "methodology" as const,
                      }));
                    })() as any}
                    onChange={(next) => {
                      const rc = safeParseJson(process.report_config, {}) as any;
                      const minimal = (Array.isArray(next) ? next : []).map((t: any) => ({
                        id: String(t.id || ""),
                        name: String(t.name || "Sem nome"),
                        text: String(t.text || ""),
                      }));
                      const nextRc = { ...rc, methodology_templates: minimal };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    onSave={(tpls: any[]) => handleSaveMethodologyTemplatesOnly(tpls)}
                    onClose={() => setShowMethodologyTemplates(false)}
                    onApplyMethodology={(t: any) => {
                      const prev = process.methodology || "";
                      const body = String(t?.text || "").trim();
                      const nextVal = [String(prev || "").trim(), body].filter(Boolean).join("\n\n");
                      updateProcess("methodology", nextVal);
                      try { toast({ title: "Template aplicado", description: "Conteúdo inserido no item 9." }); } catch {}
                    }}
                    mode="methodology"
                  />
                </div>
              )}

              {/* 10. Documentações Apresentadas */}
              <DocumentsSection
                value={safeParseArray(process.documents_presented, []) as any}
                onChange={(v) => updateProcess("documents_presented", v)}
              />

              {/* 11. Características do Local de Trabalho */}
              <WorkplaceSection
                value={safeParseJson(process.workplace_characteristics, {}) as any}
                onChange={(v) => updateProcess("workplace_characteristics", v)}
              />

              {/* 12. Atividades da Reclamante */}
              <ActivitiesSection
                value={process.activities_description || ""}
                onChange={(v) => updateProcess("activities_description", v)}
              />

              {/* 12.1. Registro fotográfico */}
              {(() => {
                const rc = safeParseJson(process.report_config, {}) as any;
                const photos = Array.isArray(rc?.photo_register) ? rc.photo_register : [];
                return (
                  <PhotoRegisterSection
                    processId={process.id}
                    value={photos}
                    onChange={(items) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const nextRc = { ...curr, photo_register: items };
                      updateProcess("report_config" as any, nextRc);
                    }}
                  />
                );
              })()}

              {/* 12.1. Discordâncias apresentadas */}
              <DiscordancesSection
                value={process.discordances_presented || ""}
                onChange={(v) => updateProcess("discordances_presented", v)}
              />

              {/* 13. EPIs */}
              {(() => {
                const rc = safeParseJson(process.report_config, {}) as any;
                const cfg = rc?.epi_replacement_periodicity || {};
                const enabled = !!cfg?.enabled;
                const imprescritoOnly = !!cfg?.imprescrito_only;
                const text = String(cfg?.text || "");
                const rows = Array.isArray(cfg?.rows) ? cfg.rows : [];
                const templates = Array.isArray(cfg?.templates) ? cfg.templates : [];
                const usefulLifeItems = Array.isArray(cfg?.useful_life_items) ? cfg.useful_life_items : [];
                const trainingAudit = safeParseJson(cfg?.training_audit, {}) as any;

                const parseBRDate = (s: string) => {
                  const m = String(s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                  if (!m) return null;
                  const dd = parseInt(m[1], 10);
                  const mm = parseInt(m[2], 10);
                  const yyyy = parseInt(m[3], 10);
                  const d = new Date(yyyy, mm - 1, dd);
                  return Number.isNaN(d.getTime()) ? null : d;
                };

                const extractPeriodRange = (raw: any) => {
                  const matches = String(raw || "").match(/\b\d{2}\/\d{2}\/\d{4}\b/g);
                  if (!matches || matches.length < 2) return null;
                  const startStr = matches[0];
                  const endStr = matches[1];
                  const start = parseBRDate(startStr);
                  const end = parseBRDate(endStr);
                  if (!start || !end) return null;
                  return { startStr, endStr, start, end };
                };

                const daysInMonth = (year: number, monthIndex0: number) => {
                  return new Date(year, monthIndex0 + 1, 0).getDate();
                };

                const diffCalendarParts = (start: Date, end: Date) => {
                  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
                  if (b.getTime() < a.getTime()) return { years: 0, months: 0, days: 0 };

                  let years = b.getFullYear() - a.getFullYear();
                  let months = b.getMonth() - a.getMonth();
                  let days = b.getDate() - a.getDate();

                  if (days < 0) {
                    months -= 1;
                    let borrowYear = b.getFullYear();
                    let borrowMonth = b.getMonth() - 1;
                    if (borrowMonth < 0) {
                      borrowMonth = 11;
                      borrowYear -= 1;
                    }
                    days += daysInMonth(borrowYear, borrowMonth);
                  }
                  if (months < 0) {
                    years -= 1;
                    months += 12;
                  }

                  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
                };

                const diffCalendarLabel = (start: Date, end: Date) => {
                  const { years, months, days } = diffCalendarParts(start, end);
                  const parts: string[] = [];
                  if (years) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
                  if (months) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
                  if (days || parts.length === 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
                  if (parts.length === 1) return parts[0];
                  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
                  return `${parts[0]}, ${parts[1]} e ${parts[2]}`;
                };

                const claimant = safeParseJson(process.claimant_data, {}) as any;
                const positions = Array.isArray(claimant?.positions) ? claimant.positions : [];
                let minStart: Date | null = null;
                let minStartStr = "";
                let maxEnd: Date | null = null;
                let maxEndStr = "";
                positions.forEach((p: any) => {
                  const range = extractPeriodRange(p?.period);
                  if (!range) return;
                  if (!minStart || range.start.getTime() < minStart.getTime()) {
                    minStart = range.start;
                    minStartStr = range.startStr;
                  }
                  if (!maxEnd || range.end.getTime() > maxEnd.getTime()) {
                    maxEnd = range.end;
                    maxEndStr = range.endStr;
                  }
                });
                const employmentPeriodDays = (() => {
                  if (!minStart || !maxEnd) return "";
                  const ms = maxEnd.getTime() - minStart.getTime();
                  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
                  return days;
                })();

                const employmentPeriodLabel = (() => {
                  if (!minStart || !maxEnd) return "";
                  const diffLabel = diffCalendarLabel(minStart, maxEnd);
                  return `${minStartStr} a ${maxEndStr}${diffLabel ? ` (${diffLabel})` : ""}`;
                })();
                return (
                  <EPISection
                    value={safeParseArray(process.epis, []) as any}
                    onChange={(v) => updateProcess("epis", v)}
                    introText={(process as any).epi_intro || ""}
                    onIntroTextChange={(v) => updateProcess("epi_intro" as any, v)}
                    includeReplacementPeriodicity={enabled}
                    onIncludeReplacementPeriodicityChange={(v) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, enabled: !!v } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    evaluateImprescribedOnly={imprescritoOnly}
                    onEvaluateImprescribedOnlyChange={(v) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, imprescrito_only: !!v } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    processDistributionDateISO={process.distribution_date || ""}
                    replacementPeriodicityText={text}
                    onReplacementPeriodicityTextChange={(v) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, text: v } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    replacementPeriodicityRows={rows}
                    onReplacementPeriodicityRowsChange={(nextRows) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, rows: nextRows } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    replacementPeriodicityTemplates={templates}
                    onReplacementPeriodicityTemplatesChange={(nextTemplates) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, templates: nextTemplates } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    replacementPeriodicityUsefulLifeItems={usefulLifeItems}
                    onReplacementPeriodicityUsefulLifeItemsChange={(nextItems) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, useful_life_items: nextItems } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    trainingAudit={trainingAudit}
                    onTrainingAuditChange={(nextTrainingAudit) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const prev = curr?.epi_replacement_periodicity || {};
                      const nextRc = { ...curr, epi_replacement_periodicity: { ...prev, training_audit: nextTrainingAudit } };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    employmentPeriodLabel={employmentPeriodLabel}
                    employmentPeriodDays={typeof employmentPeriodDays === "number" ? employmentPeriodDays : undefined}
                    employmentPeriodStartISO={minStart ? `${minStart.getFullYear()}-${String(minStart.getMonth() + 1).padStart(2, "0")}-${String(minStart.getDate()).padStart(2, "0")}` : ""}
                    employmentPeriodEndISO={maxEnd ? `${maxEnd.getFullYear()}-${String(maxEnd.getMonth() + 1).padStart(2, "0")}-${String(maxEnd.getDate()).padStart(2, "0")}` : ""}
                  />
                );
              })()}

              {/* 14. EPCs */}
              <CollectiveProtectionSection
                value={process.collective_protection || ""}
                onChange={(v) => updateProcess("collective_protection", v)}
                epcsValue={process.epcs || ""}
                onEpcsChange={(v) => updateProcess("epcs", v)}
              />

              {/* 15. Análises de Insalubridade e Periculosidade */}
              <AnalysisSection
                insalubrity={process.insalubrity_analysis || ""}
                periculosity={process.periculosity_analysis || ""}
                onInsalubrityChange={(v) => updateProcess("insalubrity_analysis", v)}
                onPericulosityChange={(v) => updateProcess("periculosity_analysis", v)}
                onAnnexesInAnalysis={handleAnnexesInAnalysis}
                onNR16AnnexesInAnalysis={handleNR16AnnexesInAnalysis}
                onUpdateNR15AnnexExposure={updateNR15AnnexExposure}
                onUpdateNR16AnnexExposure={updateNR16AnnexExposure}
                onTablesChanged={(nr15, nr16) => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const nextRc = { ...rc, analysis_tables: { nr15, nr16 } };
                  updateProcess("report_config" as any, nextRc);
                  try { localStorage.setItem(`pericia_tables_${process.user_id}_${process.id}`, JSON.stringify({ nr15, nr16 })); } catch {}
                }}
                showNR15Tables={!!((typeof process.report_config === "string" ? safeParseJson(process.report_config, {}) : (process.report_config || {})) as any)?.flags?.show_nr15_item15}
                showNR16Tables={!!((typeof process.report_config === "string" ? safeParseJson(process.report_config, {}) : (process.report_config || {})) as any)?.flags?.show_nr16_item15}
                onIncludeNR15Table={() => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const nextRc = { ...rc, flags: { ...(rc?.flags || {}), include_nr15_item15_table: true } };
                  updateProcess("report_config" as any, nextRc);
                  toast({ title: "Tabela NR-15 anexada ao laudo", description: "A impressão usará o modelo de tabela." });
                }}
                onIncludeNR16Table={() => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const nextRc = { ...rc, flags: { ...(rc?.flags || {}), include_nr16_item15_table: true } };
                  updateProcess("report_config" as any, nextRc);
                  toast({ title: "Tabela NR-16 anexada ao laudo", description: "A impressão usará o modelo de tabela." });
                }}
                onRemoveNR15Table={() => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const flags = { ...(rc?.flags || {}) };
                  delete (flags as any).include_nr15_item15_table;
                  const nextRc = { ...rc, flags };
                  updateProcess("report_config" as any, nextRc);
                  toast({ title: "Tabela NR-15 removida do laudo" });
                }}
                onRemoveNR16Table={() => {
                  const rc = safeParseJson(process.report_config, {}) as any;
                  const flags = { ...(rc?.flags || {}) };
                  delete (flags as any).include_nr16_item15_table;
                  const nextRc = { ...rc, flags };
                  updateProcess("report_config" as any, nextRc);
                  toast({ title: "Tabela NR-16 removida do laudo" });
                }}
                initialNR15={((safeParseJson(process.report_config, {}) as any).analysis_tables?.nr15) || []}
                initialNR16={((safeParseJson(process.report_config, {}) as any).analysis_tables?.nr16) || []}
              />

              {/* 16. Resultados das Avaliações de Insalubridade */}
              {(() => {
                const rc = safeParseJson(process.report_config, {}) as any;
                const rcImgs = Array.isArray(rc?.item16_images) ? rc.item16_images : [];
                const legacyUrl = String(rc?.item16_imageDataUrl || "").trim();
                const legacyCaption = String(rc?.item16_imageCaption || "").trim();
                const item16Images = (rcImgs.length
                  ? rcImgs
                  : (legacyUrl ? [{ dataUrl: legacyUrl, caption: legacyCaption }] : [])) as any[];
                const processTemplates = ((rc.templates || []) as any[]) || [];
                const combinedMap: Record<string, any> = {};
                [...globalTemplates, ...processTemplates].forEach((t: any) => {
                  const key = String(t.id || t.external_id || t.name || Math.random());
                  if (!combinedMap[key]) combinedMap[key] = t;
                });
                const combinedTemplates = Object.values(combinedMap);
                return (
                  <InsalubrityResultsSection
                    value={process.insalubrity_results || ""}
                    onChange={(v) => updateProcess("insalubrity_results", v)}
                    onGenerateLLM={generateInsalubrityLLM}
                    rowsInAnalysis={annexesForInsalubrityLLM}
                    templates={combinedTemplates as any}
                    images={item16Images as any}
                    onImagesChange={(nextImages) => {
                      const curr = safeParseJson(process.report_config, {}) as any;
                      const nextRc = { ...curr, item16_images: nextImages } as any;
                      try { delete nextRc.item16_imageDataUrl; } catch { nextRc.item16_imageDataUrl = undefined; }
                      try { delete nextRc.item16_imageCaption; } catch { nextRc.item16_imageCaption = undefined; }
                      updateProcess("report_config" as any, nextRc);
                    }}
                    onCreateTemplate={handleAddTemplate}
                    onManageTemplates={() => setShowTemplates((v) => !v)}
                    onApplyTemplate={(t: any) => {
                      const prev = process.insalubrity_results || "";
                      const parts = (t.nr15_annexes || []).sort((a:number,b:number)=>a-b).map((n:number) => {
                        const agent = NR15_AGENTS[n] || `Anexo ${n}`;
                        const head = `Resultado Anexo ${n} — ${agent}`;
                        const eq = t.nr15_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                        const body = `${eq}\n${t.text || ""}`.trim();
                        return `${head}\n\n${body}`;
                      });
                      const combined = parts.join("\n\n");
                      const nextVal = [prev.trim(), combined.trim()].filter(Boolean).join("\n\n");
                      updateProcess("insalubrity_results", nextVal);
                      try {
                        const rowsForTable = (t.nr15_annexes || []).map((n:number) => ({ annex: n, agent: NR15_AGENTS[n] || `Anexo ${n}`, exposure: "Em análise" as const, obs: "" }));
                        updateNR15AnnexExposure(rowsForTable as any);
                        const rc = safeParseJson(process.report_config, {}) as any;
                        const curr = (rc.analysis_tables?.nr15 as any[]) || [];
                        const map = new Map<number, any>();
                        curr.forEach((r) => map.set(Number(r.annex), r));
                        rowsForTable.forEach((r) => {
                          const existing = map.get(Number(r.annex)) || { annex: r.annex, agent: r.agent, exposure: "Não ocorre exposição", obs: "" };
                          map.set(Number(r.annex), { ...existing, exposure: "Em análise", obs: existing.obs || "" });
                        });
                        const nextNr15 = Array.from(map.values()).sort((a,b)=>Number(a.annex)-Number(b.annex));
                        const nextRc = { ...rc, analysis_tables: { nr15: nextNr15, nr16: (rc.analysis_tables?.nr16 || []) } };
                        updateProcess("report_config" as any, nextRc);
                      } catch {}
                      try { toast({ title: "Template aplicado", description: "Conteúdo inserido no item 16." }); } catch {}
                    }}
                  />
                );
              })()}

              {showTemplates && (
                <div className="border rounded p-2 w-full">
                  <TemplatesSection
                    value={((safeParseJson(process.report_config, {}) as any).templates || []) as any}
                    onChange={(next) => {
                      const rc = safeParseJson(process.report_config, {}) as any;
                      const nextRc = { ...rc, templates: next };
                      updateProcess("report_config" as any, nextRc);
                    }}
                    onSave={(tpls: any[]) => handleSaveTemplatesOnly(tpls)}
                    onClose={() => setShowTemplates(false)}
                    onApplyInsalubrity={(t: any) => {
                      const prev = process.insalubrity_results || "";
                      const parts = (t.nr15_annexes || []).sort((a:number,b:number)=>a-b).map((n:number) => {
                        const agent = NR15_AGENTS[n] || `Anexo ${n}`;
                        const head = `Resultado Anexo ${n} — ${agent}`;
                        const eq = t.nr15_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                        const body = `${eq}\n${t.text || ""}`.trim();
                        return `${head}\n\n${body}`;
                      });
                      const combined = parts.join("\n\n");
                      const nextVal = [prev.trim(), combined.trim()].filter(Boolean).join("\n\n");
                      updateProcess("insalubrity_results", nextVal);
                      try {
                        const rowsForTable = (t.nr15_annexes || []).map((n:number) => ({ annex: n, agent: NR15_AGENTS[n] || `Anexo ${n}`, exposure: "Em análise" as const, obs: "" }));
                        updateNR15AnnexExposure(rowsForTable as any);
                        const rc = safeParseJson(process.report_config, {}) as any;
                        const curr = (rc.analysis_tables?.nr15 as any[]) || [];
                        const map = new Map<number, any>();
                        curr.forEach((r) => map.set(Number(r.annex), r));
                        rowsForTable.forEach((r) => {
                          const existing = map.get(Number(r.annex)) || { annex: r.annex, agent: r.agent, exposure: "Não ocorre exposição", obs: "" };
                          map.set(Number(r.annex), { ...existing, exposure: "Em análise", obs: existing.obs || "" });
                        });
                        const nextNr15 = Array.from(map.values()).sort((a,b)=>Number(a.annex)-Number(b.annex));
                        const nextRc = { ...rc, analysis_tables: { nr15: nextNr15, nr16: (rc.analysis_tables?.nr16 || []) } };
                        updateProcess("report_config" as any, nextRc);
                      } catch {}
                    }}
                    onApplyPericulosity={(t: any) => {
                      const prev = process.periculosity_results || "";
                      const parts = (t.nr16_annexes || []).sort((a:number,b:number)=>a-b).map((n:number) => {
                        const agent = NR16_AGENTS[n] || `Anexo ${n}`;
                        const head = `Resultado Anexo ${n} — ${agent}`;
                        const eq = t.nr16_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                        const body = `${eq}\n${t.text || ""}`.trim();
                        return `${head}\n\n${body}`;
                      });
                      const combined = parts.join("\n\n");
                      const nextVal = [prev.trim(), combined.trim()].filter(Boolean).join("\n\n");
                      updateProcess("periculosity_results", nextVal);
                    }}
                    mode="insalubrity"
                  />
                </div>
              )}

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
              {(() => {
                const rc = safeParseJson(process.report_config, {}) as any;
                const rcImgs = Array.isArray(rc?.item19_images) ? rc.item19_images : [];
                const legacyUrl = String(rc?.item19_imageDataUrl || "").trim();
                const legacyCaption = String(rc?.item19_imageCaption || "").trim();
                const item19Images = (rcImgs.length
                  ? rcImgs
                  : (legacyUrl ? [{ dataUrl: legacyUrl, caption: legacyCaption }] : [])) as any[];
                const processTemplates = ((rc.templates || []) as any[]) || [];
                const combinedMap: Record<string, any> = {};
                [...globalTemplates, ...processTemplates].forEach((t: any) => {
                  const key = String(t.id || t.external_id || t.name || Math.random());
                  if (!combinedMap[key]) combinedMap[key] = t;
                });
                const combinedTemplates = Object.values(combinedMap);
                const periculosityTemplates = combinedTemplates.filter((t: any) => {
                  if (t?.category === "periculosity") return true;
                  if (t?.nr16_enquadramento) return true;
                  return Array.isArray(t?.nr16_annexes) && t.nr16_annexes.length > 0;
                });
                return (
                  <>
                    <PericulosityResultsSection
                      value={process.periculosity_results || ""}
                      onChange={(v) => updateProcess("periculosity_results", v)}
                      rowsInAnalysis={annexesForPericulosityLLM}
                      templates={periculosityTemplates as any}
                      images={item19Images as any}
                      onImagesChange={(nextImages) => {
                        const curr = safeParseJson(process.report_config, {}) as any;
                        const nextRc = { ...curr, item19_images: nextImages } as any;
                        try { delete nextRc.item19_imageDataUrl; } catch { nextRc.item19_imageDataUrl = undefined; }
                        try { delete nextRc.item19_imageCaption; } catch { nextRc.item19_imageCaption = undefined; }
                        updateProcess("report_config" as any, nextRc);
                      }}
                      onApplyTemplate={(t: any) => {
                        const prev = process.periculosity_results || "";
                        const parts = (t.nr16_annexes || []).sort((a:number,b:number)=>a-b).map((n:number) => {
                          const agent = NR16_AGENTS[n] || `Anexo ${n}`;
                          const head = `Resultado Anexo ${n} — ${agent}`;
                          const eq = t.nr16_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                          const body = `${eq}\n${t.text || ""}`.trim();
                          return `${head}\n\n${body}`;
                        });
                        const combined = parts.join("\n\n");
                        const nextVal = [prev.trim(), combined.trim()].filter(Boolean).join("\n\n");
                        updateProcess("periculosity_results", nextVal);
                        try { toast({ title: "Template aplicado", description: "Conteúdo inserido no item 19." }); } catch {}
                      }}
                      onCreateTemplate={handleAddPericulosityTemplate}
                      onManageTemplates={() => setShowPericulosityTemplates((v) => !v)}
                    />

                    {showPericulosityTemplates && (
                      <div className="border rounded p-2">
                        <TemplatesSection
                          value={((safeParseJson(process.report_config, {}) as any).templates || []) as any}
                          onChange={(next) => {
                            const rc = safeParseJson(process.report_config, {}) as any;
                            const nextRc = { ...rc, templates: next };
                            updateProcess("report_config" as any, nextRc);
                          }}
                          onSave={(tpls: any[]) => handleSaveTemplatesOnly(tpls)}
                          onClose={() => setShowPericulosityTemplates(false)}
                          onApplyInsalubrity={() => {}}
                          onApplyPericulosity={(t: any) => {
                            const prev = process.periculosity_results || "";
                            const parts = (t.nr16_annexes || []).sort((a:number,b:number)=>a-b).map((n:number) => {
                              const agent = NR16_AGENTS[n] || `Anexo ${n}`;
                              const head = `Resultado Anexo ${n} — ${agent}`;
                              const eq = t.nr16_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                              const body = `${eq}\n${t.text || ""}`.trim();
                              return `${head}\n\n${body}`;
                            });
                            const combined = parts.join("\n\n");
                            const nextVal = [prev.trim(), combined.trim()].filter(Boolean).join("\n\n");
                            updateProcess("periculosity_results", nextVal);
                            try { toast({ title: "Template aplicado", description: "Conteúdo inserido no item 19." }); } catch {}
                          }}
                          mode="periculosity"
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              {/* 20. Quesitos da Perícia */}
              <QuestionnairesSection
                processId={process.id}
                reportConfig={process.report_config}
                onReportConfigChange={(next) => updateProcess("report_config" as any, next)}
              />

              {/* 21. Conclusão */}
              <ConclusionSection
                value={process.conclusion || ""}
                onChange={(v) => updateProcess("conclusion", v)}
              />

              <div className="sticky bottom-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t py-2">
                <div className="flex justify-end gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Laudo"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="laudo-automatico" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Progresso do Laudo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Pré-visualização automática em modo somente leitura</p>
                  <div className="flex items-center gap-2">
                    <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Exibição" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="auto">Automático</SelectItem>
                        <SelectItem value="side">Lado a lado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        const pid = process.id;
                        if (!pid) return;
                        await businessHook.validateBusinessRules({ type: 'report', data: {}, processId: pid });
                        await progressHook.refetch();
                      } catch {}
                    }}>Atualizar indicadores</Button>
                  </div>
                </div>

                {progressHook.progress && (
                  <div className="bg-muted/50 p-3 rounded">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span>{Math.round(progressHook.progress.progress)}%</span>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded">
                      <div className="h-2 bg-primary rounded" style={{ width: `${Math.min(100, Math.max(0, progressHook.progress.progress))}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{(progressHook.progress.completedSteps || []).join(' • ')}</div>
                  </div>
                )}

                {businessHook && Array.isArray((businessHook as any).suggestions) && (businessHook as any).suggestions.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded">
                    <p className="text-sm font-semibold">Sugestões</p>
                    <ul className="mt-1 text-sm text-muted-foreground space-y-1">
                      {((businessHook as any).suggestions as string[]).map((s, i) => (<li key={i}>• {s}</li>))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-base">Insalubridade</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className={viewMode === 'side' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
                        {(viewMode === 'manual' || viewMode === 'side') && (
                          <div>
                            <p className="text-xs font-semibold">Manual</p>
                            <p className="whitespace-pre-wrap leading-7 text-justify text-muted-foreground">{process.insalubrity_results || "Sem conteúdo"}</p>
                          </div>
                        )}
                        {(viewMode === 'auto' || viewMode === 'side') && (
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold">Automático</p>
                              <Button variant="outline" size="sm" disabled={autoLoading.ins} onClick={async () => {
                                setAutoLoading((p) => ({ ...p, ins: true }));
                                try {
                                  const annexes = (process.workplace_characteristics as any)?.nr15_annexes || [];
                                  const epis = (process.epis as any) || [];
                                  const text = await evaluateInsalubrityByLLM(annexes, epis as EPIInput[]);
                                  const preview = text || "Sem prévia disponível";
                                  setAutoInsalPreview(preview);
                                  if (text && String(text).trim()) {
                                    updateProcess("insalubrity_results", String(text).trim());
                                    await handleSave();
                                    try { toast({ title: "Resultado automático salvo", description: "Insalubridade atualizada." }); } catch {}
                                  }
                                } catch {
                                  setAutoInsalPreview("Sem prévia disponível");
                                } finally {
                                  setAutoLoading((p) => ({ ...p, ins: false }));
                                }
                              }}>{autoLoading.ins ? "Gerando..." : "Gerar prévia"}</Button>
                            </div>
                            <p className="whitespace-pre-wrap leading-7 text-justify text-muted-foreground">{autoInsalPreview || "Sem prévia"}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-base">Periculosidade</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className={viewMode === 'side' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
                        {(viewMode === 'manual' || viewMode === 'side') && (
                          <div>
                            <p className="text-xs font-semibold">Manual</p>
                            <p className="whitespace-pre-wrap leading-7 text-justify text-muted-foreground">{process.periculosity_results || "Sem conteúdo"}</p>
                          </div>
                        )}
                        {(viewMode === 'auto' || viewMode === 'side') && (
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold">Automático</p>
                              <Button variant="outline" size="sm" disabled={autoLoading.peri} onClick={async () => {
                                setAutoLoading((p) => ({ ...p, peri: true }));
                                try {
                                  const base = process.periculosity_analysis || process.periculosity_results || "";
                                  const preview = base && base.trim() ? base : "Sem prévia disponível";
                                  setAutoPeriPreview(preview);
                                  if (preview !== "Sem prévia disponível" && String(preview).trim()) {
                                    updateProcess("periculosity_results", String(preview).trim());
                                    await handleSave();
                                    try { toast({ title: "Resultado automático salvo", description: "Periculosidade atualizada." }); } catch {}
                                  }
                                } catch {
                                  setAutoPeriPreview("Sem prévia disponível");
                                } finally {
                                  setAutoLoading((p) => ({ ...p, peri: false }));
                                }
                              }}>{autoLoading.peri ? "Gerando..." : "Gerar prévia"}</Button>
                            </div>
                            <p className="whitespace-pre-wrap leading-7 text-justify text-muted-foreground">{autoPeriPreview || "Sem prévia"}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-base">Conclusão</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className={viewMode === 'side' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
                        {(viewMode === 'manual' || viewMode === 'side') && (
                          <div>
                            <p className="text-xs font-semibold">Manual</p>
                            <p className="whitespace-pre-wrap leading-7 text-justify text-muted-foreground">{process.conclusion || "Sem conteúdo"}</p>
                          </div>
                        )}
                        {(viewMode === 'auto' || viewMode === 'side') && (
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold">Automático</p>
                              <Button variant="outline" size="sm" disabled={autoLoading.conc} onClick={async () => {
                                setAutoLoading((p) => ({ ...p, conc: true }));
                                try {
                                  const base = process.conclusion || "";
                                  const head = "Considerando a visita pericial realizada, as informações obtidas, os fatos observados e as análises efetuadas, conclui-se, que as atividades desempenhadas pelo(a) reclamante, foram:";
                                  const preview = [head, base].filter(Boolean).join("\n\n");
                                  setAutoConcPreview(preview || "Sem prévia disponível");
                                } catch {
                                  setAutoConcPreview("Sem prévia disponível");
                                } finally {
                                  setAutoLoading((p) => ({ ...p, conc: false }));
                                }
                              }}>{autoLoading.conc ? "Gerando..." : "Gerar prévia"}</Button>
                            </div>
                            <p className="whitespace-pre-wrap leading-7 text-justify text-muted-foreground">{autoConcPreview || "Sem prévia"}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={async () => {
                    await handleExportDocx();
                  }}>Baixar prévia DOCX</Button>
                  <Button onClick={async () => {
                    await handleExportPdf();
                  }}>Baixar prévia PDF</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Geração de Relatórios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Gere relatórios técnicos baseados nos dados do laudo pericial. Os relatórios são gerados automaticamente em formato PDF.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                    <CardHeader className="text-center">
                      <FileDown className="w-8 h-8 mx-auto text-orange-500 mb-2" />
                      <CardTitle className="text-lg">Relatório de Insalubridade</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Relatório focado na análise de agentes insalubres e suas avaliações conforme NR-15.
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('insalubridade')}
                        disabled={reportLoading}
                        className="w-full"
                      >
                        {reportLoading ? "Gerando..." : "Gerar Relatório"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                    <CardHeader className="text-center">
                      <FileDown className="w-8 h-8 mx-auto text-red-500 mb-2" />
                      <CardTitle className="text-lg">Relatório de Periculosidade</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Relatório focado na análise de agentes periculosos e suas avaliações conforme NR-16.
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('periculosidade')}
                        disabled={reportLoading}
                        className="w-full"
                      >
                        {reportLoading ? "Gerando..." : "Gerar Relatório"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                    <CardHeader className="text-center">
                      <FileDown className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                      <CardTitle className="text-lg">Relatório Completo</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Relatório completo incluindo todas as seções do laudo pericial e análises técnicas.
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('completo')}
                        disabled={reportLoading}
                        className="w-full"
                      >
                        {reportLoading ? "Gerando..." : "Gerar Relatório"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Informações Importantes
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Os relatórios são gerados com base nos dados atuais do laudo</li>
                    <li>• Certifique-se de que todas as seções relevantes estão preenchidas</li>
                    <li>• O processo de geração pode levar alguns minutos</li>
                    <li>• Os relatórios são salvos automaticamente no sistema</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

           <TabsContent value="documentos" className="space-y-6">
             <FileUpload
               bucketName="process-documents"
               processId={process.id}
               acceptedFileTypes={['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg']}
               maxFileSize={50 * 1024 * 1024} // 50MB
               multiple={true}
               enableTextExtraction={true}
               onUploadComplete={(_, fileName) => {
                 toast({
                   title: 'Upload concluído',
                   description: `Arquivo "${fileName}" enviado com sucesso.`,
                 });
                 // Refresh document list
                 window.location.reload();
               }}
               onUploadError={(error) => {
                 toast({
                   title: 'Erro no upload',
                   description: error,
                   variant: 'destructive',
                 });
               }}
             />
             
             <DocumentViewer
               processId={process.id}
               bucketName="process-documents"
               onDocumentDeleted={() => {
                 toast({
                   title: 'Documento excluído',
                   description: 'O documento foi removido com sucesso.',
                 });
               }}
             />
           </TabsContent>

          <TabsContent value="agentes">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Agentes de Risco</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={async () => {
                      const { data, error } = await supabase
                        .from('risk_agents')
                        .select('*')
                        .eq('process_id', process.id)
                        .order('created_at', { ascending: false });
                      if (!error) setRiskAgents(data || []);
                      await refreshDetectedAgents();
                    }}>Atualizar</Button>
                    <Button onClick={async () => {
                      await refreshDetectedAgents();
                      const combined = [...detectedInitialAgents, ...detectedDocumentAgents];
                      const unique = combined.filter((item, idx, arr) => {
                        return idx === arr.findIndex((x) => x.agent_name === item.agent_name && x.agent_type === item.agent_type);
                      });
                      const existing = new Set((riskAgents || []).map((ra: any) => `${String(ra.agent_name)}|${String(ra.agent_type)}`));
                      const toInsert = unique.filter((c) => !existing.has(`${c.agent_name}|${c.agent_type}`));
                      if (toInsert.length > 0) {
                        for (const c of toInsert) {
                          await supabase
                            .from('risk_agents')
                            .insert({ process_id: process.id, agent_name: c.agent_name, agent_type: c.agent_type, risk_level: c.risk_level });
                        }
                      }
                      const { data } = await supabase
                        .from('risk_agents')
                        .select('*')
                        .eq('process_id', process.id)
                        .order('created_at', { ascending: false });
                      setRiskAgents(data || []);
                      toast({ title: 'Detecção concluída', description: `${toInsert.length} agente(s) inseridos` });
                    }}>Detectar automaticamente</Button>
                  </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Riscos mencionados na Inicial</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detectedInitialAgents.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhum risco detectado na inicial</span>
                      ) : (
                        detectedInitialAgents.map((a, i) => (
                          <Badge key={`init-${i}`} variant="secondary">{`${a.agent_name} (${a.agent_type})`}</Badge>
                        ))
                  )}
                    </div>
                  </div>

                  
                </div>

                
              </CardContent>
            </Card>
          </TabsContent>

         </Tabs>


      </div>
    </div>
  );
}
// Sanitização: remove trechos de advogado acoplados ao nome
const sanitizeLawyerFromName = (name: any): string => {
  const s = String(name || "");
  return s
    .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};
