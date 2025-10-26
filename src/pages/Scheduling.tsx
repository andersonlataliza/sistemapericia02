import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, CalendarDays, MapPin, CalendarPlus, ExternalLink } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ProcessRow {
  id: string;
  process_number: string;
  claimant_name: string;
  defendant_name: string;
  status: string;
  inspection_date: string | null;
  inspection_address: string | null;
  inspection_time?: string | null;
  inspection_notes?: string | null;
  inspection_duration_minutes?: number | null;
  inspection_reminder_minutes?: number | null;
  inspection_status?: string | null;
}

export default function Scheduling() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ProcessRow[]>([]);
  const [filter, setFilter] = useState("");
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(false);
  const [showNoDate, setShowNoDate] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  const loadProcesses = async () => {
    setLoading(true);
    // Tenta carregar com os novos campos; se der erro de coluna inexistente, faz fallback
    let { data, error } = await supabase
      .from("processes")
      .select(
        "id, process_number, claimant_name, defendant_name, status, inspection_date, inspection_address, inspection_time, inspection_notes, inspection_duration_minutes, inspection_reminder_minutes, inspection_status"
      )
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback sem os novos campos
      const fb = await supabase
        .from("processes")
        .select("id, process_number, claimant_name, defendant_name, status, inspection_date, inspection_address")
        .order("created_at", { ascending: false });
      if (fb.error) {
        toast({ title: "Erro ao carregar", description: fb.error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      data = fb.data;
    }
    setRows((data || []) as ProcessRow[]);
    setLoading(false);
  };

  const updateRow = (id: string, field: keyof ProcessRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveSchedule = async (id: string) => {
    setSavingIds((prev) => [...prev, id]);
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    const payloadFull: any = {
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

    let { error } = await supabase.from("processes").update(payloadFull).eq("id", id);
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

  // Exportação ICS
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
    if (!row.inspection_date) return null;
    const start = toICSDate(row.inspection_date, row.inspection_time);
    const durMin = row.inspection_duration_minutes || 60;
    const d = new Date(row.inspection_date);
    const [th, tm] = (row.inspection_time || "09:00").split(":");
    d.setHours(parseInt(th, 10), parseInt(tm, 10) + durMin, 0, 0);
    const end = toICSDate(d.toISOString().slice(0, 10), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
    if (!start || !end) return null;
    const text = encodeURIComponent(`Vistoria — ${row.process_number}`);
    const details = encodeURIComponent(
      `${row.claimant_name} vs ${row.defendant_name}${row.inspection_notes ? `\n\nObs: ${row.inspection_notes}` : ""}`
    );
    const location = encodeURIComponent(row.inspection_address || "");
    return `https://calendar.google.com/calendar/u/0/r/eventedit?text=${text}&details=${details}&location=${location}&dates=${start}/${end}`;
  };

  const exportICS = () => {
    const events = filtered
      .filter((r) => r.inspection_date)
      .map((r) => {
        const dtstart = toICSDate(r.inspection_date, r.inspection_time) || "";
        const duration = r.inspection_duration_minutes || 60;
        const d = new Date(r.inspection_date || new Date());
        const [th, tm] = (r.inspection_time || "09:00").split(":");
        d.setHours(parseInt(th, 10), parseInt(tm, 10) + duration, 0, 0);
        const dtend = toICSDate(d.toISOString().slice(0, 10), `${pad(d.getHours())}:${pad(d.getMinutes())}`) || "";
        const summary = `Vistoria — ${r.process_number}`;
        const description = `${r.claimant_name} vs ${r.defendant_name}${r.inspection_notes ? `\n\nObs: ${r.inspection_notes}` : ""}`;
        const location = r.inspection_address || "";
        const uid = `${r.id}@spd`;
        const alarm =
          typeof r.inspection_reminder_minutes === "number" && r.inspection_reminder_minutes > 0
            ? `\nBEGIN:VALARM\nTRIGGER:-PT${r.inspection_reminder_minutes}M\nACTION:DISPLAY\nDESCRIPTION:Lembrete\nEND:VALARM`
            : "";
        return `BEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtstart}\nDTSTART:${dtstart}\nDTEND:${dtend}\nSUMMARY:${summary}\nDESCRIPTION:${description}\nLOCATION:${location}${alarm}\nEND:VEVENT`;
      });

    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SPD//Scheduling//PT-BR\n${events.join("\n")}\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agenda-spd-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      in_progress: { label: "Em Andamento", variant: "default" },
      completed: { label: "Concluído", variant: "default" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const conf = map[status] || map.pending;
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

  const filtered = rows
    .filter((r) => {
      const t = `${r.process_number} ${r.claimant_name} ${r.defendant_name}`.toLowerCase();
      return t.includes(filter.toLowerCase());
    })
    .filter((r) => (showOnlyScheduled ? !!r.inspection_date : true))
    .filter((r) => (showNoDate ? !r.inspection_date : true));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agendamento de Vistoria</h1>
          <div className="flex items-center gap-3">
            <Button variant={showOnlyScheduled ? "default" : "ghost"} onClick={() => setShowOnlyScheduled((v) => !v)}>
              Somente agendados
            </Button>
            <Button variant={showNoDate ? "default" : "ghost"} onClick={() => setShowNoDate((v) => !v)}>
              Sem data definida
            </Button>
            <Button onClick={exportICS}>
              <CalendarPlus className="w-4 h-4 mr-2" /> Exportar .ics
            </Button>
            <div className="w-64">
              <Input placeholder="Filtrar por número, partes..." value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          </div>
        </div>

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
                          {toGoogleCalendarURL(row) && (
                            <a
                              className="text-sm text-primary inline-flex items-center gap-1"
                              href={toGoogleCalendarURL(row) || "#"}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="w-4 h-4" /> Adicionar ao Google Calendar
                            </a>
                          )}
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

                    <div className="flex justify-end mt-4">
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
      </div>
    </div>
  );
}