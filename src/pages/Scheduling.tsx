import { useEffect, useMemo, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Mail, MessageCircle, Save, CalendarDays, MapPin, ExternalLink } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

const ALL = "__ALL__";

type ProcessDbRow = Database['public']['Tables']['processes']['Row'];

interface ProcessRow {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  claimant_email?: string | null;
  defendant_email?: string | null;
  status: string;
  inspection_date: string | null;
  inspection_address: string | null;
  inspection_city?: string | null;
  inspection_time?: string | null;
  inspection_notes?: string | null;
  inspection_duration_minutes?: number | null;
  inspection_reminder_minutes?: number | null;
  inspection_status?: string | null;
  court?: string | null;
}

export default function Scheduling() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ProcessRow[]>([]);
  const [filter, setFilter] = useState("");
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(false);
  const [showNoDate, setShowNoDate] = useState(false);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState<ProcessRow | null>(null);
  const [messageMode, setMessageMode] = useState<"whatsapp" | "email">("whatsapp");

  const [scheduleContactName, setScheduleContactName] = useState<string>("");
  const [scheduleContactPhone, setScheduleContactPhone] = useState<string>("");
  const [scheduleMessageText, setScheduleMessageText] = useState<string>("");

  const [scheduleClaimantEmail, setScheduleClaimantEmail] = useState<string>("");
  const [scheduleDefendantEmail, setScheduleDefendantEmail] = useState<string>("");
  const [scheduleEmailSubject, setScheduleEmailSubject] = useState<string>("");
  const [scheduleEmailBody, setScheduleEmailBody] = useState<string>("");
  const [scheduleEmailReceipts, setScheduleEmailReceipts] = useState<any[]>([]);

  function normalizeEmail(v: string) {
    return String(v || "").trim().toLowerCase();
  }

  function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  const openMessageDialog = useCallback((row: ProcessRow, mode: "whatsapp" | "email") => {
    setMessageTarget(row);
    setMessageMode(mode);
    setMessageOpen(true);

    const defaultName = String(row.claimant_name || row.defendant_name || "").trim();
    setScheduleContactName(defaultName);
    setScheduleContactPhone("");
    setScheduleMessageText(buildScheduleMessage(row, defaultName));

    setScheduleClaimantEmail(normalizeEmail(String(row.claimant_email || "")));
    setScheduleDefendantEmail(normalizeEmail(String(row.defendant_email || "")));
    setScheduleEmailBody(buildScheduleMessage(row, defaultName));
    setScheduleEmailSubject(`Agendamento/Confirmação de Perícia — Processo ${String(row.process_number || "").trim()}`.trim());
    setScheduleEmailReceipts([]);
  }, []);

  function toPtDate(dateStr?: string | null) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return "";
    }
  }

  function buildScheduleMessage(p: ProcessRow, contactName: string) {
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

  const openWhatsApp = useCallback(() => {
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
  }, [scheduleContactPhone, scheduleMessageText, toast]);

  const copyScheduleMessage = useCallback(async () => {
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
  }, [scheduleMessageText, toast]);

  const refreshScheduleEmailReceipts = useCallback(async (processId?: string) => {
    const pid = String(processId || messageTarget?.id || "").trim();
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
  }, [messageTarget?.id]);

  const sendScheduleEmail = useCallback(async (recipients: Array<{ role: string; email: string }>) => {
    const pid = String(messageTarget?.id || "").trim();
    if (!pid) return;

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
          processId: pid,
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
        await refreshScheduleEmailReceipts(pid);
      } else {
        toast({ title: "Falha ao enviar", description: String(data?.error || "Falha inesperada"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Falha ao enviar", description: getFunctionErrorMessage(e), variant: "destructive" });
    }
  }, [messageTarget?.id, refreshScheduleEmailReceipts, scheduleEmailBody, scheduleEmailSubject, toast]);

  useEffect(() => {
    if (!messageOpen) return;
    if (!messageTarget) return;
    if (messageMode !== "email") return;
    void refreshScheduleEmailReceipts(messageTarget.id);
  }, [messageOpen, messageMode, messageTarget, refreshScheduleEmailReceipts]);

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

  // Tornar filtros mutuamente exclusivos
  const toggleOnlyScheduled = () => {
    setShowOnlyScheduled((prev) => {
      const next = !prev;
      if (next) setShowNoDate(false);
      return next;
    });
  };

  const toggleNoDate = () => {
    setShowNoDate((prev) => {
      const next = !prev;
      if (next) setShowOnlyScheduled(false);
      return next;
    });
  };

  const pickStr = (obj: unknown, key: string): string | null => {
    if (obj && typeof obj === "object" && obj !== null) {
      const val = (obj as Record<string, unknown>)[key];
      return typeof val === "string" ? val : null;
    }
    return null;
  };

  const loadProcesses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("processes")
      .select("id, process_number, claimant_name, defendant_name, claimant_email, defendant_email, status, inspection_date, inspection_address, inspection_city, inspection_time, inspection_notes, inspection_duration_minutes, inspection_reminder_minutes, inspection_status, court")
      .order("created_at", { ascending: false });
  
    if (error) {
      const fb = await supabase
        .from("processes")
        .select("id, process_number, claimant_name, defendant_name, claimant_email, defendant_email, status, inspection_date, inspection_address, inspection_city, court")
        .order("created_at", { ascending: false });
      if (fb.error) {
        toast({ title: "Erro ao carregar", description: fb.error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      setRows((fb.data || []).map((item: ProcessDbRow) => ({
        id: item.id,
        process_number: item.process_number,
        claimant_name: item.claimant_name,
        defendant_name: item.defendant_name,
        claimant_email: pickStr(item, "claimant_email"),
        defendant_email: pickStr(item, "defendant_email"),
        status: item.status || '',
        inspection_date: item.inspection_date,
        inspection_address: item.inspection_address,
        inspection_city: pickStr(item, "inspection_city"),
        court: pickStr(item, "court"),
        inspection_time: null,
        inspection_notes: null,
        inspection_duration_minutes: null,
        inspection_reminder_minutes: null,
        inspection_status: null,
      }) as ProcessRow));
    } else {
      setRows((data || []).map((item: ProcessDbRow) => ({
        id: item.id,
        process_number: item.process_number,
        claimant_name: item.claimant_name,
        defendant_name: item.defendant_name,
        claimant_email: pickStr(item, "claimant_email"),
        defendant_email: pickStr(item, "defendant_email"),
        status: item.status || '',
        inspection_date: item.inspection_date,
        inspection_address: item.inspection_address,
        inspection_city: pickStr(item, "inspection_city"),
        court: pickStr(item, "court"),
        inspection_time: item.inspection_time || null,
        inspection_notes: item.inspection_notes || null,
        inspection_duration_minutes: item.inspection_duration_minutes || null,
        inspection_reminder_minutes: item.inspection_reminder_minutes || null,
        inspection_status: item.inspection_status || null,
      }) as ProcessRow));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);

  const updateRow = (id: string, field: keyof ProcessRow, value: string | number | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveSchedule = async (id: string) => {
    setSavingIds((prev) => [...prev, id]);
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    const payloadFull: {
      inspection_date: string | null;
      inspection_address: string | null;
      inspection_time: string | null;
      inspection_notes: string | null;
      inspection_duration_minutes: number | null;
      inspection_reminder_minutes: number | null;
      inspection_status: string | null;
    } = {
      inspection_date: row.inspection_date ? new Date(row.inspection_date).toISOString() : null,
      inspection_address: row.inspection_address || null,
      inspection_time: row.inspection_time || null,
      inspection_notes: row.inspection_notes || null,
      inspection_duration_minutes:
        typeof row.inspection_duration_minutes === "number"
          ? row.inspection_duration_minutes
          : row.inspection_duration_minutes
          ? parseInt(String(row.inspection_duration_minutes), 10)
          : null,
      inspection_reminder_minutes:
        typeof row.inspection_reminder_minutes === "number"
          ? row.inspection_reminder_minutes
          : row.inspection_reminder_minutes
          ? parseInt(String(row.inspection_reminder_minutes), 10)
          : null,
      inspection_status: row.inspection_status || null,
    };

    const { error } = await supabase.from("processes").update(payloadFull).eq("id", id);
    if (error) {
      // Se as colunas novas não existirem, salva apenas data/endereço
      const payloadFallback = {
        inspection_date: payloadFull.inspection_date,
        inspection_address: payloadFull.inspection_address,
      };
      const fb = await supabase.from("processes").update(payloadFallback).eq("id", id);
      if (fb.error) {
        toast({ title: "Erro ao salvar", description: fb.error.message, variant: "destructive" });
      } else {
        toast({ title: "Agendamento salvo", description: `Processo ${row.process_number} atualizado (sem horário/observações).` });
      }
    } else {
      toast({ title: "Agendamento salvo", description: `Processo ${row.process_number} atualizado.` });
    }
    setSavingIds((prev) => prev.filter((x) => x !== id));
  };

  const isSaving = (id: string) => savingIds.includes(id);

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

  const toGoogleCalendarURL = (row: ProcessRow) => {
    const text = encodeURIComponent(`Vistoria — ${row.process_number}`);
    const details = encodeURIComponent(
      `${row.claimant_name} vs ${row.defendant_name}${row.inspection_notes ? `\n\nObs: ${row.inspection_notes}` : ""}`
    );
    const location = encodeURIComponent(row.inspection_address || "");
    let url = `https://calendar.google.com/calendar/u/0/r/eventedit?text=${text}&details=${details}&location=${location}`;
    if (row.inspection_date) {
      const start = toICSDate(row.inspection_date, row.inspection_time);
      const durMin = row.inspection_duration_minutes || 60;
      const d = new Date(row.inspection_date);
      const [th, tm] = (row.inspection_time || "09:00").split(":");
      d.setHours(parseInt(th, 10), parseInt(tm, 10) + durMin, 0, 0);
      const end = toICSDate(d.toISOString().slice(0, 10), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
      if (start && end) url += `&dates=${start}/${end}`;
    }
    return url;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "Ativo", variant: "default" },
      completed: { label: "Concluído", variant: "default" },
      cancelled: { label: "Cancelado", variant: "destructive" },
      archived: { label: "Arquivado", variant: "secondary" },
    };
    const conf = map[status] || map.active;
    return <Badge variant={conf.variant}>{conf.label}</Badge>;
  };

  const scheduleBadge = (s?: string | null) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      scheduled_pending: { label: "Agendamento Pendente", variant: "secondary" },
      scheduled_confirmed: { label: "Agendamento Confirmado", variant: "default" },
      rescheduled: { label: "Reagendado", variant: "default" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const conf = (s && map[s]) || map.scheduled_pending;
    return <Badge variant={conf.variant}>{conf.label}</Badge>;
  };

  const [cityFilter, setCityFilter] = useState<string>(ALL);
  const [courtFilter, setCourtFilter] = useState<string>(ALL);
  const cityOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const c = String(r.inspection_city || "").trim();
      if (c) s.add(c);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);
  const courtOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const c = String(r.court || "").trim();
      if (c) s.add(c);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);
  const cityCounts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const c = String(r.inspection_city || "").trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [rows]);
  const courtCounts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const c = String(r.court || "").trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [rows]);
  const filtered = rows
    .filter((r) => {
      const t = `${r.process_number} ${r.claimant_name} ${r.defendant_name}`.toLowerCase();
      return t.includes(filter.toLowerCase());
    })
    .filter((r) => (showOnlyScheduled ? !!r.inspection_date : true))
    .filter((r) => (showNoDate ? !r.inspection_date : true))
    .filter((r) => (cityFilter !== ALL ? String(r.inspection_city || "").toLowerCase().includes(cityFilter.toLowerCase()) : true))
    .filter((r) => (courtFilter !== ALL ? String(r.court || "").toLowerCase().includes(courtFilter.toLowerCase()) : true))
    .filter((r) => {
      if (selectedCities.length === 0) return true;
      const cityStr = String(r.inspection_city || "").toLowerCase();
      return selectedCities.some((c) => cityStr.includes(c.toLowerCase()));
    })
    .filter((r) => {
      if (selectedCourts.length === 0) return true;
      const courtStr = String(r.court || "").toLowerCase();
      return selectedCourts.some((c) => courtStr.includes(c.toLowerCase()));
    });
  const filteredCityCounts = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const c = String(r.inspection_city || "").trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [filtered]);
  const filteredCourtCounts = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const c = String(r.court || "").trim();
      if (!c) return;
      m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [filtered]);
  const citiesSorted = useMemo(() => {
    const arr = cityOptions.slice();
    arr.sort((a, b) => {
      const ca = cityCounts.get(a) || 0;
      const cb = cityCounts.get(b) || 0;
      if (ca !== cb) return cb - ca;
      return a.localeCompare(b, "pt-BR");
    });
    return arr;
  }, [cityOptions, cityCounts]);
  const courtsSorted = useMemo(() => {
    const arr = courtOptions.slice();
    arr.sort((a, b) => {
      const ca = courtCounts.get(a) || 0;
      const cb = courtCounts.get(b) || 0;
      if (ca !== cb) return cb - ca;
      return a.localeCompare(b, "pt-BR");
    });
    return arr;
  }, [courtOptions, courtCounts]);

  const clearExtraFilters = () => {
    setCityFilter(ALL);
    setCourtFilter(ALL);
    setSelectedCities([]);
    setSelectedCourts([]);
  };

  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [suggestStartDate, setSuggestStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [suggestMaxPerDay, setSuggestMaxPerDay] = useState<number>(4);
  const [suggestOnlyNoDate, setSuggestOnlyNoDate] = useState<boolean>(true);
  const [suggestUseProximity, setSuggestUseProximity] = useState<boolean>(true);
  const [suggestBusy, setSuggestBusy] = useState<boolean>(false);
  const geocodeMemory = useMemo(() => new Map<string, { lat: number; lon: number } | null>(), []);

  const fnv1a = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  };

  const getAddressQuery = (r: ProcessRow) => {
    const addr = String(r.inspection_address || "").trim();
    const city = String(r.inspection_city || "").trim();
    const court = String(r.court || "").trim();
    const parts = [addr, city || court, "Brasil"].filter(Boolean);
    const q = parts.join(", ").trim();
    return q || null;
  };

  const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  };

  const geocodeAddress = useCallback(async (query: string) => {
    const normalized = String(query || "").trim();
    if (!normalized) return null;

    if (geocodeMemory.has(normalized)) return geocodeMemory.get(normalized) ?? null;

    const storageKey = `pa_geocode_v1_${fnv1a(normalized.toLowerCase())}`;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const lat = Number(parsed?.lat);
        const lon = Number(parsed?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const hit = { lat, lon };
          geocodeMemory.set(normalized, hit);
          return hit;
        }
      }
    } catch {
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(normalized)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        geocodeMemory.set(normalized, null);
        return null;
      }
      const data: any = await res.json().catch(() => null);
      const first = Array.isArray(data) ? data[0] : null;
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        geocodeMemory.set(normalized, null);
        return null;
      }
      const hit = { lat, lon };
      geocodeMemory.set(normalized, hit);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify({ lat, lon }));
        }
      } catch {
      }
      return hit;
    } catch {
      geocodeMemory.set(normalized, null);
      return null;
    }
  }, [geocodeMemory]);

  const buildDirectionsUrl = (stops: string[]) => {
    const cleaned = (Array.isArray(stops) ? stops : []).map((s) => String(s || "").trim()).filter(Boolean);
    if (cleaned.length < 2) return null;
    const origin = cleaned[0];
    const destination = cleaned[cleaned.length - 1];
    const waypoints = cleaned.slice(1, -1);
    const base = "https://www.google.com/maps/dir/?api=1";
    const params = new URLSearchParams();
    params.set("origin", origin);
    params.set("destination", destination);
    if (waypoints.length > 0) {
      const wp = waypoints.length > 1 ? [`optimize:true`, ...waypoints].join("|") : waypoints[0];
      params.set("waypoints", wp);
    }
    params.set("travelmode", "driving");
    return `${base}&${params.toString()}`;
  };

  const suggestAgenda = useCallback(async () => {
    const base = filtered;
    const maxPerDay = Math.max(1, Number(suggestMaxPerDay) || 1);
    const start = String(suggestStartDate || "").trim();
    if (!start) {
      toast({ title: "Data inicial inválida", description: "Informe uma data inicial para distribuir os agendamentos.", variant: "destructive" });
      return;
    }
    const candidates = base.filter((r) => (suggestOnlyNoDate ? !r.inspection_date : true));
    if (candidates.length === 0) {
      toast({ title: "Sem itens", description: "Nenhuma perícia encontrada para sugerir agenda com os filtros atuais." });
      return;
    }

    setSuggestBusy(true);
    try {
      const items = candidates.map((r) => {
        const group = String(r.inspection_city || r.court || "").trim();
        const addr = String(r.inspection_address || "").trim();
        return { r, group, addr, q: getAddressQuery(r) };
      });

      let ordered: ProcessRow[] = [];

      if (suggestUseProximity) {
        const withGeo = await Promise.all(
          items.map(async (it) => {
            if (!it.q) return { ...it, geo: null as { lat: number; lon: number } | null };
            const geo = await geocodeAddress(it.q);
            return { ...it, geo };
          })
        );

        const geocoded = withGeo.filter((x) => x.geo);
        const notGeocoded = withGeo.filter((x) => !x.geo);

        if (geocoded.length >= 2) {
          const remaining = geocoded.slice();
          const route: typeof geocoded = [];
          route.push(remaining.shift()!);
          while (remaining.length > 0) {
            const last = route[route.length - 1].geo!;
            let bestIdx = 0;
            let bestDist = Number.POSITIVE_INFINITY;
            for (let i = 0; i < remaining.length; i++) {
              const d = haversineKm(last, remaining[i].geo!);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
              }
            }
            route.push(remaining.splice(bestIdx, 1)[0]);
          }

          const orderedGeocoded = route.map((x) => x.r);
          const orderedMissing = notGeocoded
            .sort((a, b) => {
              const ga = a.group.localeCompare(b.group, "pt-BR");
              if (ga !== 0) return ga;
              const aa = a.addr.localeCompare(b.addr, "pt-BR");
              if (aa !== 0) return aa;
              return String(a.r.process_number || "").localeCompare(String(b.r.process_number || ""), "pt-BR");
            })
            .map((x) => x.r);

          ordered = [...orderedGeocoded, ...orderedMissing];
        }
      }

      if (ordered.length === 0) {
        ordered = items
          .sort((a, b) => {
            const ga = a.group.localeCompare(b.group, "pt-BR");
            if (ga !== 0) return ga;
            const aa = a.addr.localeCompare(b.addr, "pt-BR");
            if (aa !== 0) return aa;
            return String(a.r.process_number || "").localeCompare(String(b.r.process_number || ""), "pt-BR");
          })
          .map((x) => x.r);
      }

      const startDateObj = new Date(`${start}T00:00:00`);
      if (Number.isNaN(startDateObj.getTime())) {
        toast({ title: "Data inicial inválida", description: "Não foi possível interpretar a data inicial.", variant: "destructive" });
        return;
      }

      const updates = new Map<string, string>();
      let day = startDateObj;
      let count = 0;
      let usedDays = 1;
      for (const r of ordered) {
        if (count >= maxPerDay) {
          const next = new Date(day);
          next.setDate(next.getDate() + 1);
          day = next;
          count = 0;
          usedDays += 1;
        }
        updates.set(r.id, format(day, "yyyy-MM-dd"));
        count += 1;
      }

      setRows((prev) => prev.map((r) => (updates.has(r.id) ? { ...r, inspection_date: updates.get(r.id)! } : r)));

      toast({
        title: "Sugestão aplicada",
        description: `${ordered.length} perícia(s) distribuída(s) em ${usedDays} dia(s). Clique em “Salvar Agendamento” em cada item.`,
      });
    } finally {
      setSuggestBusy(false);
    }
  }, [filtered, suggestMaxPerDay, suggestOnlyNoDate, suggestStartDate, suggestUseProximity, geocodeAddress, toast]);

  const byDate = useMemo(() => {
    const m = new Map<string, ProcessRow[]>();
    filtered.forEach((r) => {
      if (!r.inspection_date) return;
      const key = new Date(r.inspection_date).toISOString().slice(0, 10);
      const arr = m.get(key) || [];
      arr.push(r);
      m.set(key, arr);
    });
    return m;
  }, [filtered]);
  const eventDates = useMemo(() => {
    return Array.from(byDate.keys()).map((k) => {
      const [y, mm, dd] = k.split("-");
      return new Date(parseInt(y, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
    });
  }, [byDate]);
  const selectedKey = selectedDay ? selectedDay.toISOString().slice(0, 10) : "";
  const eventsForSelectedDay = selectedKey ? byDate.get(selectedKey) || [] : [];

  const openSelectedDayRoute = useCallback(() => {
    const stops = (eventsForSelectedDay || [])
      .map((r) => {
        const q = getAddressQuery(r);
        return q ? q.replace(/,\s*Brasil\s*$/i, "") : null;
      })
      .filter(Boolean) as string[];

    const url = buildDirectionsUrl(stops);
    if (!url) {
      toast({ title: "Rota indisponível", description: "Informe ao menos 2 endereços para gerar a rota." });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [eventsForSelectedDay, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agendamento de Vistoria</h1>
          <div className="flex items-center gap-3">
            <Button variant={showOnlyScheduled ? "default" : "ghost"} onClick={toggleOnlyScheduled}>
              Somente agendados
            </Button>
            <Button variant={showNoDate ? "default" : "ghost"} onClick={toggleNoDate}>
              Sem data definida
            </Button>
            <div className="w-64">
              <Input placeholder="Filtrar por número, partes..." value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Municípios</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedCities.map((c) => (
                <Badge key={c} variant="outline" className="flex items-center gap-1">
                  {c} ({filteredCityCounts.get(c) ?? cityCounts.get(c) ?? 0})
                  <button aria-label="Remover cidade" onClick={() => setSelectedCities((prev) => prev.filter((x) => x !== c))}>×</button>
                </Badge>
              ))}
              {selectedCities.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCities([])}>Limpar cidades</Button>
              )}
            </div>
            <Command>
              <CommandInput placeholder="Pesquisar municípios..." />
              <CommandList>
                <CommandEmpty>Nenhum município encontrado</CommandEmpty>
                <CommandGroup heading="Municípios">
                  {citiesSorted.map((c) => {
                    const isSelected = selectedCities.includes(c);
                    const count = cityCounts.get(c) || 0;
                    return (
                      <CommandItem
                        key={c}
                        onSelect={() => {
                          setSelectedCities((prev) =>
                            prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                          );
                        }}
                      >
                        {isSelected ? "✓ " : ""}{c} {count > 0 ? `(${count})` : ""}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Varas</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedCourts.map((c) => (
                <Badge key={c} variant="outline" className="flex items-center gap-1">
                  {c} ({filteredCourtCounts.get(c) ?? courtCounts.get(c) ?? 0})
                  <button aria-label="Remover vara" onClick={() => setSelectedCourts((prev) => prev.filter((x) => x !== c))}>×</button>
                </Badge>
              ))}
              {selectedCourts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCourts([])}>Limpar varas</Button>
              )}
            </div>
            <Command>
              <CommandInput placeholder="Pesquisar varas..." />
              <CommandList>
                <CommandEmpty>Nenhuma vara encontrada</CommandEmpty>
                <CommandGroup heading="Varas">
                  {courtsSorted.map((c) => {
                    const isSelected = selectedCourts.includes(c);
                    const count = courtCounts.get(c) || 0;
                    return (
                      <CommandItem
                        key={c}
                        onSelect={() => {
                          setSelectedCourts((prev) =>
                            prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                          );
                        }}
                      >
                        {isSelected ? "✓ " : ""}{c} {count > 0 ? `(${count})` : ""}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Calendário de Serviços</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
              <div className="w-full lg:w-56">
                <p className="text-sm text-muted-foreground mb-1">Data inicial</p>
                <Input type="date" value={suggestStartDate} onChange={(e) => setSuggestStartDate(e.target.value)} />
              </div>
              <div className="w-full lg:w-40">
                <p className="text-sm text-muted-foreground mb-1">Máx. por dia</p>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={String(suggestMaxPerDay)}
                  onChange={(e) => setSuggestMaxPerDay(Math.max(1, parseInt(e.target.value || "1", 10) || 1))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={suggestOnlyNoDate ? "default" : "outline"}
                  onClick={() => setSuggestOnlyNoDate((v) => !v)}
                >
                  Apenas sem data
                </Button>
                <Button
                  type="button"
                  variant={suggestUseProximity ? "default" : "outline"}
                  onClick={() => setSuggestUseProximity((v) => !v)}
                >
                  Usar proximidade
                </Button>
                <Button type="button" onClick={suggestAgenda} disabled={suggestBusy || loading}>
                  {suggestBusy ? "Sugerindo..." : "Sugerir agenda"}
                </Button>
              </div>
            </div>
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DayPicker
                    mode="single"
                    selected={selectedDay}
                    onSelect={setSelectedDay}
                    locale={ptBR}
                    modifiers={{ agendado: eventDates }}
                    modifiersClassNames={{ agendado: "bg-primary/10 font-semibold rounded" }}
                  />
                </div>
                <div className="lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedDay ? `Serviços em ${format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}` : "Selecione um dia"}
                    </p>
                    <Badge variant="outline">{eventsForSelectedDay.length} item(s)</Badge>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={openSelectedDayRoute} disabled={eventsForSelectedDay.length < 2}>
                      Abrir rota no Maps
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {eventsForSelectedDay.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum serviço agendado.</p>
                    ) : (
                      eventsForSelectedDay.map((row) => {
                        const startLabel = row.inspection_time || "09:00";
                        const dur = row.inspection_duration_minutes || 60;
                        const [h, m] = startLabel.split(":");
                        const d = new Date(row.inspection_date || new Date());
                        d.setHours(parseInt(h || "9", 10), parseInt(m || "0", 10) + dur);
                        const endLabel = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        const locationText = [row.inspection_address || "", row.inspection_city || ""].filter(Boolean).join(", ");
                        return (
                          <div key={row.id} className="rounded border p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{row.process_number}</p>
                              {scheduleBadge(row.inspection_status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {startLabel}–{endLabel} • {row.claimant_name} vs {row.defendant_name}
                            </p>
                            <p className="text-sm mt-1 flex items-center gap-2">
                              <MapPin className="w-4 h-4" /> {locationText || "Local não informado"}
                            </p>
                            {locationText && (
                              <div className="mt-2">
                                <a
                                  className="text-xs text-primary inline-flex items-center gap-1"
                                  href={`https://www.google.com/maps/search/?q=${encodeURIComponent(locationText)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="w-3 h-3" /> Abrir no Maps
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Demandas judiciais</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">Nenhum processo encontrado.</p>
            ) : (
              <div className="space-y-4">
                {filtered.map((row) => (
                  <div key={row.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{row.process_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.claimant_name} vs {row.defendant_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(row.status)}
                        {scheduleBadge(row.inspection_status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                          <CalendarDays className="w-4 h-4" /> Data da Perícia
                        </p>
                        <Input
                          type="date"
                          value={row.inspection_date ? new Date(row.inspection_date).toISOString().slice(0, 10) : ""}
                          onChange={(e) => updateRow(row.id, "inspection_date", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Horário</p>
                        <Input
                          type="time"
                          value={row.inspection_time || ""}
                          onChange={(e) => updateRow(row.id, "inspection_time", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Duração (min)</p>
                        <Input
                          type="number"
                          min={15}
                          step={5}
                          value={row.inspection_duration_minutes ?? ""}
                          onChange={(e) => updateRow(row.id, "inspection_duration_minutes", e.target.value ? parseInt(e.target.value, 10) : null)}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Lembrete</p>
                        <Select
                          value={String(row.inspection_reminder_minutes ?? "0")}
                          onValueChange={(v) => updateRow(row.id, "inspection_reminder_minutes", v ? parseInt(v, 10) : null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Minutos antes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sem lembrete</SelectItem>
                            <SelectItem value="5">5 min</SelectItem>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> Endereço
                        </p>
                        <Input
                          value={row.inspection_address || ""}
                          placeholder="Rua, número, bairro, cidade"
                          onChange={(e) => updateRow(row.id, "inspection_address", e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                          <a
                            className="text-sm text-primary inline-flex items-center gap-1"
                            href={`https://www.google.com/maps/search/?q=${encodeURIComponent(row.inspection_address || "")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="w-4 h-4" /> Abrir no Maps
                          </a>
                          <a
                            className="text-sm text-primary inline-flex items-center gap-1"
                            href={toGoogleCalendarURL(row)}
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
                        <Select value={row.inspection_status || "scheduled_pending"} onValueChange={(v) => updateRow(row.id, "inspection_status", v)}>
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

                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-1">Observações</p>
                      <Input
                        value={row.inspection_notes || ""}
                        placeholder="Informações adicionais, contato, acesso, etc."
                        onChange={(e) => updateRow(row.id, "inspection_notes", e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => openMessageDialog(row, "whatsapp")}
                          disabled={isSaving(row.id)}>
                          <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                        </Button>
                        <Button type="button" variant="outline" onClick={() => openMessageDialog(row, "email")}
                          disabled={isSaving(row.id)}>
                          <Mail className="w-4 h-4 mr-2" /> E-mail
                        </Button>
                      </div>
                      <Button onClick={() => saveSchedule(row.id)} disabled={isSaving(row.id)}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving(row.id) ? "Salvando..." : "Salvar Agendamento"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={messageOpen}
          onOpenChange={(open) => {
            setMessageOpen(open);
            if (!open) setMessageTarget(null);
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Mensagens{messageTarget ? ` — Processo ${String(messageTarget.process_number || "").trim()}` : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={messageMode === "whatsapp" ? "default" : "outline"} onClick={() => setMessageMode("whatsapp")}
                disabled={!messageTarget}>
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button type="button" variant={messageMode === "email" ? "default" : "outline"} onClick={() => setMessageMode("email")}
                disabled={!messageTarget}>
                <Mail className="w-4 h-4 mr-2" /> E-mail
              </Button>
            </div>

            {!messageTarget ? (
              <p className="text-sm text-muted-foreground">Selecione um processo para enviar mensagem.</p>
            ) : messageMode === "whatsapp" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nome do contato</p>
                    <Input value={scheduleContactName} onChange={(e) => setScheduleContactName(e.target.value)} placeholder="Ex.: João" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Telefone (WhatsApp)</p>
                    <Input value={scheduleContactPhone} onChange={(e) => setScheduleContactPhone(e.target.value)} placeholder="Ex.: 11999999999" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const name = String(scheduleContactName || messageTarget.claimant_name || messageTarget.defendant_name || "").trim();
                      setScheduleContactName(name);
                      setScheduleMessageText(buildScheduleMessage(messageTarget, name));
                      toast({ title: "Mensagem gerada", description: "Texto preenchido com os dados do agendamento." });
                    }}
                  >
                    Gerar mensagem
                  </Button>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Mensagem</p>
                  <Textarea
                    value={scheduleMessageText}
                    onChange={(e) => setScheduleMessageText(e.target.value)}
                    className="min-h-[160px]"
                    placeholder="Digite a mensagem que será enviada ao contato..."
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={copyScheduleMessage}>
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                  </Button>
                  <Button type="button" onClick={openWhatsApp}>
                    Abrir WhatsApp
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">E-mail do reclamante</p>
                    <Input
                      value={scheduleClaimantEmail}
                      onChange={(e) => setScheduleClaimantEmail(normalizeEmail(e.target.value))}
                      placeholder="ex.: reclamante@email.com"
                      inputMode="email"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">E-mail da reclamada</p>
                    <Input
                      value={scheduleDefendantEmail}
                      onChange={(e) => setScheduleDefendantEmail(normalizeEmail(e.target.value))}
                      placeholder="ex.: reclamada@email.com"
                      inputMode="email"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const defaultName = String(scheduleContactName || messageTarget.claimant_name || messageTarget.defendant_name || "").trim();
                        setScheduleContactName(defaultName);
                        setScheduleEmailBody(buildScheduleMessage(messageTarget, defaultName));
                        if (!String(scheduleEmailSubject || "").trim()) {
                          const baseSubject = `Agendamento/Confirmação de Perícia — Processo ${String(messageTarget.process_number || "").trim()}`.trim();
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
                    className="min-h-[180px]"
                    placeholder="Digite a mensagem do e-mail..."
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => refreshScheduleEmailReceipts(messageTarget.id)}>
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
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
