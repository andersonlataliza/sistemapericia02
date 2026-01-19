import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractDocumentTextOCR, evaluateEpiReplacementPeriodByLLM } from "@/lib/llm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EPI {
  equipment: string;
  protection: string;
  ca: string;
}

interface EPIReplacementRow {
  equipment: string;
  ca: string;
  delivery_date: string;
}

type EPIOcrStructuredItem = {
  equipment?: string;
  ca?: string;
  protection?: string;
  deliveries?: string[];
};

type EPIOcrStructuredPayload = {
  epis?: EPIOcrStructuredItem[];
};

type EPIReplacementTemplate = {
  id: string;
  name: string;
  text: string;
};

type EPIUsefulLifeItem = {
  equipment: string;
  ca: string;
  estimated_life: string;
};

type TrainingAudit = {
  training_evidence?: boolean | null;
  training_observation?: string;
  ca_certificate?: boolean | null;
  inspection?: boolean | null;
  inspection_observation?: string;
};

interface EPISectionProps {
  value: EPI[];
  onChange: (value: EPI[]) => void;
  introText?: string;
  onIntroTextChange?: (value: string) => void;
  includeReplacementPeriodicity?: boolean;
  onIncludeReplacementPeriodicityChange?: (value: boolean) => void;
  evaluateImprescribedOnly?: boolean;
  onEvaluateImprescribedOnlyChange?: (value: boolean) => void;
  processDistributionDateISO?: string;
  replacementPeriodicityText?: string;
  onReplacementPeriodicityTextChange?: (value: string) => void;
  replacementPeriodicityRows?: EPIReplacementRow[];
  onReplacementPeriodicityRowsChange?: (rows: EPIReplacementRow[]) => void;
  replacementPeriodicityTemplates?: EPIReplacementTemplate[];
  onReplacementPeriodicityTemplatesChange?: (templates: EPIReplacementTemplate[]) => void;
  replacementPeriodicityUsefulLifeItems?: EPIUsefulLifeItem[];
  onReplacementPeriodicityUsefulLifeItemsChange?: (items: EPIUsefulLifeItem[]) => void;
  trainingAudit?: TrainingAudit;
  onTrainingAuditChange?: (value: TrainingAudit) => void;
  employmentPeriodLabel?: string;
  employmentPeriodDays?: number;
  employmentPeriodStartISO?: string;
  employmentPeriodEndISO?: string;
}

export default function EPISection({
  value,
  onChange,
  introText,
  onIntroTextChange,
  includeReplacementPeriodicity,
  onIncludeReplacementPeriodicityChange,
  evaluateImprescribedOnly,
  onEvaluateImprescribedOnlyChange,
  processDistributionDateISO,
  replacementPeriodicityText,
  onReplacementPeriodicityTextChange,
  replacementPeriodicityRows,
  onReplacementPeriodicityRowsChange,
  replacementPeriodicityTemplates,
  onReplacementPeriodicityTemplatesChange,
  replacementPeriodicityUsefulLifeItems,
  onReplacementPeriodicityUsefulLifeItemsChange,
  trainingAudit,
  onTrainingAuditChange,
  employmentPeriodLabel,
  employmentPeriodDays,
  employmentPeriodStartISO,
  employmentPeriodEndISO,
}: EPISectionProps) {
  const defaultIntro =
    "Para função exercida pela Reclamante a empresa realizava a entrega dos seguintes equipamentos de proteção individual - E.P.I. (Art. 166 da CLT e NR-6, item 6.2 da Portaria nº 3214/78 do MTE):";
  const intro = (!introText || introText === "") ? defaultIntro : introText;
  const [introValue, setIntroValue] = useState(intro);

  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrStatusLabel, setOcrStatusLabel] = useState("");
  const [periodicityResult, setPeriodicityResult] = useState<string>("");

  const replacementEnabled = !!includeReplacementPeriodicity;
  const replacementText = String(replacementPeriodicityText || "");
  const replacementRows: EPIReplacementRow[] = Array.isArray(replacementPeriodicityRows) ? replacementPeriodicityRows : [];
  const replacementTemplates: EPIReplacementTemplate[] = Array.isArray(replacementPeriodicityTemplates) ? replacementPeriodicityTemplates : [];
  const usefulLifeItems: EPIUsefulLifeItem[] = Array.isArray(replacementPeriodicityUsefulLifeItems) ? replacementPeriodicityUsefulLifeItems : [];

  const mergedTrainingAudit: TrainingAudit = trainingAudit && typeof trainingAudit === "object" ? trainingAudit : {};
  const updateTrainingAudit = (patch: Partial<TrainingAudit>) => {
    onTrainingAuditChange?.({ ...mergedTrainingAudit, ...patch });
  };

  const [selectedReplacementTemplateId, setSelectedReplacementTemplateId] = useState<string>(replacementTemplates[0]?.id || "");
  const [replacementTemplateName, setReplacementTemplateName] = useState<string>("");

  const selectedReplacementTemplate = replacementTemplates.find((t) => t.id === selectedReplacementTemplateId) || null;

  useEffect(() => {
    if (!replacementTemplates.length) return;
    if (selectedReplacementTemplateId && replacementTemplates.some((t) => t.id === selectedReplacementTemplateId)) return;
    setSelectedReplacementTemplateId(replacementTemplates[0]?.id || "");
  }, [replacementTemplates, selectedReplacementTemplateId]);

  const applySelectedReplacementTemplate = () => {
    if (!selectedReplacementTemplate) return;
    onReplacementPeriodicityTextChange?.(String(selectedReplacementTemplate.text || ""));
  };

  const saveNewReplacementTemplate = () => {
    const name = replacementTemplateName.trim();
    if (!name) {
      toast({ title: "Informe um nome", description: "Defina um nome para o template." });
      return;
    }
    const id = Math.random().toString(36).slice(2);
    const next = [...replacementTemplates, { id, name, text: replacementText }];
    onReplacementPeriodicityTemplatesChange?.(next);
    setSelectedReplacementTemplateId(id);
    setReplacementTemplateName("");
    toast({ title: "Template criado", description: "Template adicionado aos templates de EPIs." });
  };

  const updateSelectedReplacementTemplate = () => {
    if (!selectedReplacementTemplate) return;
    const next = replacementTemplates.map((t) => (t.id === selectedReplacementTemplate.id ? { ...t, text: replacementText } : t));
    onReplacementPeriodicityTemplatesChange?.(next);
    toast({ title: "Template atualizado", description: "Texto do template selecionado foi atualizado." });
  };

  const normalize = (s: unknown) => String(s || "").trim();

  const keyEq = (s: unknown) => normalize(s).toLowerCase();

  const extractJsonObject = (raw: string) => {
    const text = String(raw || "");
    const start = text.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
    return null;
  };

  const parseOcrStructuredPayload = (evaluated: string): EPIOcrStructuredPayload | null => {
    const raw = String(evaluated || "");
    const marker = "DADOS_EPI_JSON:";
    const idx = raw.indexOf(marker);
    const fromMarker = idx >= 0 ? raw.slice(idx + marker.length).trim() : "";
    const jsonCandidate = extractJsonObject(fromMarker) || extractJsonObject(raw);
    if (!jsonCandidate) return null;
    try {
      const parsed: unknown = JSON.parse(jsonCandidate);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as EPIOcrStructuredPayload;
    } catch {
      return null;
    }
  };

  const toISODate = (raw: unknown) => {
    const s = normalize(raw);
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br1) return `${br1[3]}-${br1[2]}-${br1[1]}`;
    const br2 = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (br2) return `${br2[3]}-${br2[2]}-${br2[1]}`;
    const ymd = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    return null;
  };

  const mergeEpisFromOcr = (items: EPIOcrStructuredItem[]) => {
    const cleaned = items
      .map((it) => ({
        equipment: normalize(it?.equipment),
        ca: normalize(it?.ca),
        protection: normalize(it?.protection),
        deliveries: Array.isArray(it?.deliveries) ? it.deliveries.map((d) => normalize(d)).filter(Boolean) : [],
      }))
      .filter((it) => !!it.equipment);

    const nextEpis = [...value];
    let episChanged = false;
    cleaned.forEach((it) => {
      const eqKey = keyEq(it.equipment);
      const caKey = normalize(it.ca);
      const existingIndex = nextEpis.findIndex((e) => {
        const eEq = keyEq(e?.equipment);
        const eCa = normalize(e?.ca);
        if (!eEq) return false;
        if (eEq !== eqKey) return false;
        if (!caKey) return true;
        return !eCa || eCa === caKey;
      });
      if (existingIndex >= 0) {
        const prev = nextEpis[existingIndex];
        const next = {
          ...prev,
          equipment: prev.equipment?.trim() ? prev.equipment : it.equipment,
          ca: prev.ca?.trim() ? prev.ca : it.ca,
          protection: prev.protection?.trim() ? prev.protection : it.protection,
        };
        if (
          next.equipment !== prev.equipment ||
          next.ca !== prev.ca ||
          next.protection !== prev.protection
        ) {
          nextEpis[existingIndex] = next;
          episChanged = true;
        }
        return;
      }
      nextEpis.push({ equipment: it.equipment, ca: it.ca, protection: it.protection });
      episChanged = true;
    });

    if (episChanged) onChange(nextEpis);

    if (!onReplacementPeriodicityRowsChange) return;

    const nextRows = (() => {
      const existing = [...replacementRows];
      const existingKeys = new Set(
        existing
          .map((r) => {
            const eq = keyEq(r?.equipment);
            const ca = normalize(r?.ca);
            const dt = normalize(r?.delivery_date);
            if (!eq || !dt) return null;
            return `${eq}||${ca}||${dt}`;
          })
          .filter(Boolean) as string[]
      );

      const toAdd: EPIReplacementRow[] = [];
      cleaned.forEach((it) => {
        const eq = normalize(it.equipment);
        const eqKey = keyEq(eq);
        const ca = normalize(it.ca);
        const dates = it.deliveries.map((d) => toISODate(d)).filter(Boolean) as string[];
        dates.forEach((dt) => {
          const k = `${eqKey}||${ca}||${dt}`;
          if (existingKeys.has(k)) return;
          existingKeys.add(k);
          toAdd.push({ equipment: eq, ca, delivery_date: dt });
        });
      });

      if (!toAdd.length) return null;
      return [...existing, ...toAdd];
    })();

    if (nextRows) onReplacementPeriodicityRowsChange(nextRows);
  };

  const usefulLifeOptions = (() => {
    const map = new Map<string, { key: string; equipment: string; ca: string; label: string }>();
    const add = (equipmentRaw: unknown, caRaw: unknown) => {
      const equipment = normalize(equipmentRaw);
      const ca = normalize(caRaw);
      if (!equipment) return;
      if (!ca) return;
      const key = `${equipment}||${ca}`;
      if (map.has(key)) return;
      map.set(key, { key, equipment, ca, label: `${equipment} (CA ${ca})` });
    };
    replacementRows.forEach((r) => add(r?.equipment, r?.ca));
    value.forEach((e) => add((e as any)?.equipment || (e as any)?.name, (e as any)?.ca));
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  })();

  const [selectedUsefulLifeKey, setSelectedUsefulLifeKey] = useState<string>(usefulLifeOptions[0]?.key || "");

  useEffect(() => {
    if (!usefulLifeOptions.length) return;
    if (selectedUsefulLifeKey && usefulLifeOptions.some((o) => o.key === selectedUsefulLifeKey)) return;
    setSelectedUsefulLifeKey(usefulLifeOptions[0]?.key || "");
  }, [usefulLifeOptions, selectedUsefulLifeKey]);

  const addUsefulLifeItem = () => {
    const selected = usefulLifeOptions.find((o) => o.key === selectedUsefulLifeKey) || null;
    const equipment = normalize(selected?.equipment);
    const ca = normalize(selected?.ca);
    if (!equipment || !ca) {
      toast({ title: "Selecione um EPI", description: "Adicione ao menos um EPI para registrar a vida útil." });
      return;
    }
    if (usefulLifeItems.some((i) => normalize(i?.equipment) === equipment && normalize((i as any)?.ca) === ca)) {
      toast({ title: "EPI já adicionado", description: "Esse EPI já está na lista de vida útil." });
      return;
    }
    onReplacementPeriodicityUsefulLifeItemsChange?.([...usefulLifeItems, { equipment, ca, estimated_life: "" }]);
  };

  const removeUsefulLifeItem = (index: number) => {
    onReplacementPeriodicityUsefulLifeItemsChange?.(usefulLifeItems.filter((_, i) => i !== index));
  };

  const updateUsefulLifeItem = (index: number, field: keyof EPIUsefulLifeItem, newValue: string) => {
    const next = [...usefulLifeItems];
    next[index] = { ...next[index], [field]: newValue };
    onReplacementPeriodicityUsefulLifeItemsChange?.(next);
  };

  const parseUsefulLifeDays = (raw: string) => {
    const text = String(raw || "").toLowerCase();
    if (!text.trim()) return null;
    const pick = (re: RegExp) => {
      const m = text.match(re);
      if (!m) return 0;
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) ? n : 0;
    };
    const years = pick(/(\d+)\s*(ano|anos)\b/);
    const months = pick(/(\d+)\s*(m[eê]s|meses)\b/);
    const weeks = pick(/(\d+)\s*(semana|semanas)\b/);
    const days = pick(/(\d+)\s*(dia|dias)\b/);
    const total = years * 365 + months * 30 + weeks * 7 + days;
    return total > 0 ? total : null;
  };

  const daysToMonthsDaysLabel = (d: number) => {
    const days = Math.max(0, Math.round(d));
    const months = Math.floor(days / 30);
    const rem = days % 30;
    if (months > 0 && rem > 0) return `${months} mês(es) e ${rem} dia(s)`;
    if (months > 0) return `${months} mês(es)`;
    return `${rem} dia(s)`;
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

  const parseISODate = (s: string) => {
    const m = String(s || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const employmentStart = parseISODate(String(employmentPeriodStartISO || "").trim());
  const employmentEnd = parseISODate(String(employmentPeriodEndISO || "").trim());
  const distributionDate = parseISODate(String(processDistributionDateISO || "").trim());
  const imprescribedOnly = !!evaluateImprescribedOnly;

  const addDays = (base: Date, days: number) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + Math.trunc(days));
    return d;
  };

  const formatDateBRFromDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const effectivePeriod = (() => {
    if (!employmentStart || !employmentEnd) return { start: employmentStart, end: employmentEnd, label: employmentPeriodLabel || "" };
    if (!imprescribedOnly) return { start: employmentStart, end: employmentEnd, label: employmentPeriodLabel || "" };
    if (!distributionDate) return { start: employmentStart, end: employmentEnd, label: "Período imprescrito selecionado, mas sem data de distribuição" };
    const start5y = new Date(distributionDate.getFullYear() - 5, distributionDate.getMonth(), distributionDate.getDate());
    const start = start5y.getTime() > employmentStart.getTime() ? start5y : employmentStart;
    const end = employmentEnd;
    if (end.getTime() <= start.getTime()) return { start, end, label: "Período imprescrito selecionado, mas sem período válido" };
    const diffLabel = diffCalendarLabel(start, end);
    const range = `${formatDateBRFromDate(start)} a ${formatDateBRFromDate(end)}${diffLabel ? ` (${diffLabel})` : ""}`;
    return { start, end, label: `Imprescrito (últimos 5 anos): ${range}` };
  })();

  const diffDaysCeil = (start: Date, end: Date) => {
    const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  const deliveryEvaluation = (() => {
    const byEquipment = new Map<string, Array<{ ca: string; date: Date }>>();
    replacementRows.forEach((r) => {
      const equipment = normalize(r?.equipment);
      const ca = normalize(r?.ca);
      const dt = parseISODate(normalize(r?.delivery_date));
      if (!equipment || !dt) return;
      const list = byEquipment.get(equipment) || [];
      list.push({ ca, date: dt });
      byEquipment.set(equipment, list);
    });

    const getLifeDaysFor = (equipment: string, ca: string) => {
      const life = usefulLifeItems.find((i) => normalize(i?.equipment) === equipment && normalize((i as any)?.ca) === ca);
      return parseUsefulLifeDays(String((life as any)?.estimated_life || ""));
    };

    const buildBasisLabel = (equipment: string, usedDefault: boolean) => {
      const map = new Map<string, number>();
      usefulLifeItems
        .filter((i) => normalize(i?.equipment) === equipment)
        .forEach((i) => {
          const ca = normalize((i as any)?.ca);
          const days = parseUsefulLifeDays(String((i as any)?.estimated_life || ""));
          if (!ca || !days) return;
          map.set(ca, days);
        });

      if (!map.size) return "Base padrão: 6 meses";
      const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const shown = entries.slice(0, 3).map(([ca, days]) => `CA ${ca}: ${daysToMonthsDaysLabel(days)}`);
      const suffix = entries.length > shown.length ? ` | +${entries.length - shown.length}` : "";
      return `Vida útil por CA: ${shown.join(" | ")}${suffix}${usedDefault ? " | padrão: 6 meses" : ""}`;
    };

    const buildEquipmentLabel = (equipment: string, deliveries: Array<{ ca: string; date: Date }>) => {
      const cas = Array.from(new Set(deliveries.map((d) => normalize(d.ca)).filter(Boolean)));
      if (!cas.length) return equipment;
      if (cas.length === 1) return `${equipment} (CA ${cas[0]})`;
      const shown = cas.slice(0, 3);
      const suffix = cas.length > shown.length ? `, +${cas.length - shown.length}` : "";
      return `${equipment} (CAs: ${shown.join(", ")}${suffix})`;
    };

    const items = Array.from(byEquipment.entries())
      .map(([equipment, deliveries]) => {
        const sortedDeliveries = [...deliveries].sort((a, b) => a.date.getTime() - b.date.getTime());
        const periodStartMs = effectivePeriod.start ? effectivePeriod.start.getTime() : null;
        const periodEndMs = effectivePeriod.end ? effectivePeriod.end.getTime() : null;
        const deliveriesInPeriod = (() => {
          if (periodStartMs == null || periodEndMs == null) return sortedDeliveries;
          return sortedDeliveries.filter((d) => d.date.getTime() >= periodStartMs && d.date.getTime() <= periodEndMs);
        })();

        const datesForIntervals = (() => {
          const dates = deliveriesInPeriod.map((d) => d.date);
          if (periodStartMs == null || periodEndMs == null) return dates;
          const prev = sortedDeliveries.filter((d) => d.date.getTime() < periodStartMs).slice(-1)[0]?.date;
          if (prev) dates.unshift(prev);
          return dates;
        })()
          .sort((a, b) => a.getTime() - b.getTime())
          .filter((d, idx, arr) => idx === 0 || d.getTime() !== arr[idx - 1].getTime());

        const intervals = Array.from({ length: Math.max(0, datesForIntervals.length - 1) })
          .map((_, i) => {
            const from = datesForIntervals[i];
            const to = datesForIntervals[i + 1];
            const deltaDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
            if (!Number.isFinite(deltaDays) || deltaDays < 0) return null;
            return { from, to, days: deltaDays, label: diffCalendarLabel(from, to) };
          })
          .filter(Boolean) as Array<{ from: Date; to: Date; days: number; label: string }>;

        const avgIntervalDays = intervals.length ? intervals.reduce((a, b) => a + b.days, 0) / intervals.length : null;
        const employmentDays = typeof employmentPeriodDays === "number" && Number.isFinite(employmentPeriodDays) ? employmentPeriodDays : null;

        const representativeInterval = (() => {
          if (!intervals.length) return null;
          if (intervals.length === 1) return intervals[0];
          const avg = avgIntervalDays ?? intervals[0].days;
          return intervals.reduce((best, curr) => (Math.abs(curr.days - avg) < Math.abs(best.days - avg) ? curr : best), intervals[0]);
        })();

        const intervalLabel = (() => {
          if (representativeInterval) {
            if (intervals.length === 1) return representativeInterval.label;
            const avgLabel = avgIntervalDays == null ? "" : daysToMonthsDaysLabel(avgIntervalDays);
            return avgLabel ? `${representativeInterval.label} (média aprox.: ${avgLabel})` : representativeInterval.label;
          }
          if (periodStartMs != null && periodEndMs != null) {
            if (!deliveriesInPeriod.length) return "Sem entregas no período";
            if (deliveriesInPeriod.length === 1) return "Apenas 1 entrega";
          }
          if (typeof employmentDays === "number" && effectivePeriod.label && effectivePeriod.label.trim()) return `Apenas 1 entrega (período total: ${effectivePeriod.label})`;
          return sortedDeliveries.length ? "Apenas 1 entrega" : "Não informado";
        })();

        const insufficientRanges = (() => {
          if (!effectivePeriod.start || !effectivePeriod.end) return [] as Array<{ start: Date; end: Date }>;
          const start = effectivePeriod.start;
          const end = effectivePeriod.end;
          if (end.getTime() <= start.getTime()) return [] as Array<{ start: Date; end: Date }>;
          if (!sortedDeliveries.length) return [{ start, end }];

          const coverageIntervals: Array<{ start: Date; end: Date }> = [];
          sortedDeliveries.forEach((d) => {
            const lifeDays = getLifeDaysFor(equipment, normalize(d.ca)) ?? 180;
            const covStart = d.date.getTime() > start.getTime() ? d.date : start;
            const covEndRaw = addDays(d.date, lifeDays);
            const covEnd = covEndRaw.getTime() < end.getTime() ? covEndRaw : end;
            if (covEnd.getTime() > covStart.getTime()) coverageIntervals.push({ start: covStart, end: covEnd });
          });
          if (!coverageIntervals.length) return [{ start, end }];
          coverageIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

          const merged: Array<{ start: Date; end: Date }> = [];
          coverageIntervals.forEach((it) => {
            const last = merged[merged.length - 1];
            if (!last) {
              merged.push({ start: it.start, end: it.end });
              return;
            }
            if (it.start.getTime() <= last.end.getTime()) {
              if (it.end.getTime() > last.end.getTime()) last.end = it.end;
              return;
            }
            merged.push({ start: it.start, end: it.end });
          });

          const gaps: Array<{ start: Date; end: Date }> = [];
          let cursor = start;
          merged.forEach((it) => {
            if (it.start.getTime() > cursor.getTime()) gaps.push({ start: cursor, end: it.start });
            if (it.end.getTime() > cursor.getTime()) cursor = it.end;
          });
          if (end.getTime() > cursor.getTime()) gaps.push({ start: cursor, end });
          return gaps;
        })();

        const insufficientDays = insufficientRanges.reduce((acc, r) => acc + diffDaysCeil(r.start, r.end), 0);
        const insufficientLabel = (() => {
          if (!effectivePeriod.start || !effectivePeriod.end) return "Não informado";
          if (insufficientDays <= 0) return "—";
          const totalLabel = daysToMonthsDaysLabel(insufficientDays);
          const shown = insufficientRanges.slice(0, 3);
          const rangesLabel = shown.map((r) => `${formatDateBRFromDate(r.start)} a ${formatDateBRFromDate(r.end)}`).join(" | ");
          const suffix = insufficientRanges.length > shown.length ? ` | +${insufficientRanges.length - shown.length}` : "";
          return `${totalLabel}: ${rangesLabel}${suffix}`;
        })();

        const usedDefault = sortedDeliveries.some((d) => getLifeDaysFor(equipment, normalize(d.ca)) == null);
        const basis = buildBasisLabel(equipment, usedDefault);
        const status = insufficientDays > 0 ? "Insuficiente" : "Suficiente";

        return {
          equipment: buildEquipmentLabel(equipment, sortedDeliveries),
          deliveries: deliveriesInPeriod.length,
          intervalLabel,
          insufficientLabel,
          status,
          basis,
        };
      })
      .sort((a, b) => a.equipment.localeCompare(b.equipment));

    return items;
  })();

  const addReplacementRow = () => {
    onReplacementPeriodicityRowsChange?.([
      ...replacementRows,
      { equipment: "", ca: "", delivery_date: "" },
    ]);
  };

  const removeReplacementRow = (index: number) => {
    onReplacementPeriodicityRowsChange?.(replacementRows.filter((_, i) => i !== index));
  };

  const updateReplacementRow = (index: number, field: keyof EPIReplacementRow, newValue: string) => {
    const next = [...replacementRows];
    next[index] = { ...next[index], [field]: newValue };
    onReplacementPeriodicityRowsChange?.(next);
  };

  const addEPI = () => {
    onChange([...value, { equipment: "", protection: "", ca: "" }]);
  };

  const removeEPI = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateEPI = (index: number, field: keyof EPI, newValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  const mapToEPIInput = () => value.map((e) => ({ equipment: e.equipment, protection: e.protection, ca: e.ca }));

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsProcessingOCR(true);
    setOcrStatusLabel("Processando arquivo por OCR...");
    try {
      const text = await extractDocumentTextOCR(file);
      if (!text) {
        toast({ title: "OCR não disponível", description: "Configure VITE_OCR_URL ou envie um PDF com texto selecionável.", variant: "destructive" });
        return;
      }
      const evaluated = await evaluateEpiReplacementPeriodByLLM(text, mapToEPIInput());
      if (!evaluated) {
        toast({ title: "LLM de periodicidade indisponível", description: "Configure VITE_LLM_EPI_PERIODICITY_URL no .env.", variant: "destructive" });
        setPeriodicityResult(text);
        return;
      }
      setPeriodicityResult(evaluated);
      const structured = parseOcrStructuredPayload(evaluated);
      const items = Array.isArray(structured?.epis) ? (structured?.epis as EPIOcrStructuredItem[]) : [];
      const hasAny = items.some((it) => normalize(it?.equipment));
      if (hasAny) {
        mergeEpisFromOcr(items);
        const deliveriesCount = items.reduce((acc, it) => acc + (Array.isArray(it?.deliveries) ? it.deliveries.length : 0), 0);
        if (deliveriesCount > 0 && onIncludeReplacementPeriodicityChange) {
          onIncludeReplacementPeriodicityChange(true);
        }
        toast({
          title: "OCR aplicado nas tabelas",
          description: `${items.filter((it) => normalize(it?.equipment)).length} EPI(s) e ${deliveriesCount} entrega(s) processadas.`,
        });
      } else {
        toast({ title: "Periodicidade avaliada", description: "Resultado gerado a partir do documento por OCR." });
      }
    } catch (err: any) {
      toast({ title: "Falha na avaliação por OCR", description: err?.message ?? "Erro ao processar o arquivo.", variant: "destructive" });
    } finally {
      setIsProcessingOCR(false);
      setOcrStatusLabel("");
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>13. Equipamentos de Proteção Individual (EPIs)</CardTitle>
        <Button onClick={addEPI} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar EPI
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="epi-intro">Introdução (editável)</Label>
          <Textarea
            id="epi-intro"
            value={introValue}
            onChange={(e) => {
              setIntroValue(e.target.value);
              onIntroTextChange?.(e.target.value);
            }}
            className="min-h-[60px]"
          />
        </div>
        <p className="text-sm">{introValue}</p>

        {value.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum EPI cadastrado. Clique em "Adicionar EPI" para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border rounded-md">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 w-[40%]">Equipamento</th>
                  <th className="text-left p-2 w-[40%]">Proteção</th>
                  <th className="text-left p-2 w-[15%]">CA</th>
                  <th className="text-center p-2 w-[5%]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.map((epi, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2 align-middle">
                      <Label htmlFor={`epi-equipment-${index}`} className="sr-only">Equipamento</Label>
                      <Input
                        id={`epi-equipment-${index}`}
                        value={epi.equipment ?? (epi as any).name ?? ""}
                        onChange={(e) => updateEPI(index, "equipment", e.target.value)}
                        placeholder="Ex: Protetor auricular"
                      />
                    </td>
                    <td className="p-2 align-middle">
                      <Label htmlFor={`epi-protection-${index}`} className="sr-only">Proteção</Label>
                      <Input
                        id={`epi-protection-${index}`}
                        value={epi.protection ?? (epi as any).desc ?? (epi as any).observation ?? ""}
                        onChange={(e) => updateEPI(index, "protection", e.target.value)}
                        placeholder="Ex: Ruído"
                      />
                    </td>
                    <td className="p-2 align-middle">
                      <Label htmlFor={`epi-ca-${index}`} className="sr-only">CA</Label>
                      <Input
                        id={`epi-ca-${index}`}
                        value={epi.ca ?? ""}
                        onChange={(e) => updateEPI(index, "ca", e.target.value)}
                        placeholder="Nº CA"
                      />
                    </td>
                    <td className="p-2 text-center align-middle">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeEPI(index)}
                        aria-label={`Remover EPI ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="epi-replacement-periodicity"
              checked={replacementEnabled}
              onCheckedChange={(v) => onIncludeReplacementPeriodicityChange?.(!!v)}
            />
            <Label htmlFor="epi-replacement-periodicity">Incluir avaliação da periodicidade de trocas de EPIs</Label>
          </div>

          {replacementEnabled && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="epi-imprescribed-only"
                checked={imprescribedOnly}
                onCheckedChange={(v) => onEvaluateImprescribedOnlyChange?.(!!v)}
              />
              <Label htmlFor="epi-imprescribed-only">Avaliar apenas período imprescrito (últimos 5 anos)</Label>
            </div>
          )}

          {replacementEnabled && (
            <>
              <div className="space-y-2">
                <Label>Templates de avaliação</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selectedReplacementTemplateId} onValueChange={(v) => setSelectedReplacementTemplateId(v)}>
                    <SelectTrigger className="w-64 h-9">
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {replacementTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={applySelectedReplacementTemplate} disabled={!selectedReplacementTemplate}>
                    Aplicar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={updateSelectedReplacementTemplate} disabled={!selectedReplacementTemplate}>
                    Atualizar selecionado
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={replacementTemplateName}
                    onChange={(e) => setReplacementTemplateName(e.target.value)}
                    placeholder="Nome do novo template"
                    className="h-9 w-64"
                  />
                  <Button type="button" size="sm" onClick={saveNewReplacementTemplate}>
                    Salvar como novo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="epi-replacement-text">Avaliação (texto)</Label>
                <Textarea
                  id="epi-replacement-text"
                  value={replacementText}
                  onChange={(e) => onReplacementPeriodicityTextChange?.(e.target.value)}
                  placeholder="Descreva a periodicidade de troca dos EPIs por tipo, conforme registros e evidências."
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Vida útil estimada (por EPI/CA)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedUsefulLifeKey} onValueChange={(v) => setSelectedUsefulLifeKey(v)}>
                      <SelectTrigger className="w-64 h-9">
                        <SelectValue placeholder="Selecione um EPI" />
                      </SelectTrigger>
                      <SelectContent>
                        {usefulLifeOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={addUsefulLifeItem} disabled={!usefulLifeOptions.length}>
                      Adicionar
                    </Button>
                  </div>
                </div>
                {employmentPeriodLabel && employmentPeriodLabel.trim() && (
                  <p className="text-xs text-muted-foreground">Período considerado: {employmentPeriodLabel}</p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border rounded-md">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 w-[30%]">EPI</th>
                        <th className="text-left p-2 w-[15%]">CA</th>
                        <th className="text-left p-2 w-[50%]">Vida útil estimada</th>
                        <th className="text-center p-2 w-[5%]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usefulLifeItems.length === 0 ? (
                        <tr className="border-t">
                          <td className="p-2 text-sm text-muted-foreground" colSpan={4}>
                            Nenhum EPI selecionado.
                          </td>
                        </tr>
                      ) : (
                        usefulLifeItems.map((item, index) => (
                          <tr key={`${item.equipment}-${(item as any)?.ca || ""}-${index}`} className="border-t">
                            <td className="p-2 align-top">
                              <Input value={item.equipment} readOnly />
                            </td>
                            <td className="p-2 align-top">
                              <Input value={String((item as any)?.ca || "")} readOnly />
                            </td>
                            <td className="p-2 align-top">
                              <Textarea
                                value={item.estimated_life || ""}
                                onChange={(e) => updateUsefulLifeItem(index, "estimated_life", e.target.value)}
                                placeholder="Ex: Vida útil estimada de 6 meses; troca a cada 3 meses em caso de desgaste..."
                                className="min-h-[70px]"
                              />
                            </td>
                            <td className="p-2 text-center align-top">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeUsefulLifeItem(index)}
                                aria-label={`Remover vida útil ${index + 1}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Controle de entrega (por tipo)</Label>
                  <Button type="button" size="sm" onClick={addReplacementRow}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar linha
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border rounded-md">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 w-[55%]">Equipamento fornecido</th>
                        <th className="text-left p-2 w-[20%]">CA</th>
                        <th className="text-left p-2 w-[20%]">Data de entrega</th>
                        <th className="text-center p-2 w-[5%]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {replacementRows.length === 0 ? (
                        <tr className="border-t">
                          <td className="p-2 text-sm text-muted-foreground" colSpan={4}>
                            Nenhuma linha adicionada.
                          </td>
                        </tr>
                      ) : (
                        replacementRows.map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2 align-middle">
                              <Label htmlFor={`epi-repl-equipment-${index}`} className="sr-only">Equipamento fornecido</Label>
                              <Input
                                id={`epi-repl-equipment-${index}`}
                                value={row.equipment || ""}
                                onChange={(e) => updateReplacementRow(index, "equipment", e.target.value)}
                                placeholder="Ex: Luva nitrílica"
                              />
                            </td>
                            <td className="p-2 align-middle">
                              <Label htmlFor={`epi-repl-ca-${index}`} className="sr-only">CA</Label>
                              <Input
                                id={`epi-repl-ca-${index}`}
                                value={row.ca || ""}
                                onChange={(e) => updateReplacementRow(index, "ca", e.target.value)}
                                placeholder="Nº CA"
                              />
                            </td>
                            <td className="p-2 align-middle">
                              <Label htmlFor={`epi-repl-date-${index}`} className="sr-only">Data de entrega</Label>
                              <Input
                                id={`epi-repl-date-${index}`}
                                type="date"
                                value={row.delivery_date || ""}
                                onChange={(e) => updateReplacementRow(index, "delivery_date", e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-center align-middle">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeReplacementRow(index)}
                                aria-label={`Remover linha ${index + 1}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <Tabs defaultValue="auto" className="w-full">
                  <TabsList className="mb-3">
                    <TabsTrigger value="auto">Avaliação automática da periodicidade de entrega</TabsTrigger>
                    <TabsTrigger value="training-audit">Gestão de EPI</TabsTrigger>
                  </TabsList>

                  <TabsContent value="auto" className="space-y-2">
                    {effectivePeriod.label && String(effectivePeriod.label).trim() && (
                      <p className="text-xs text-muted-foreground">Período considerado: {effectivePeriod.label}</p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full border rounded-md">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 w-[35%]">EPI</th>
                            <th className="text-left p-2 w-[10%]">Entregas</th>
                            <th className="text-left p-2 w-[17%]">Intervalo entre entregas</th>
                            <th className="text-left p-2 w-[23%]">Período insuficiente (insalubre)</th>
                            <th className="text-left p-2 w-[15%]">Avaliação</th>
                            <th className="text-left p-2 w-[15%]">Base</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveryEvaluation.length === 0 ? (
                            <tr className="border-t">
                              <td className="p-2 text-sm text-muted-foreground" colSpan={6}>
                                Preencha “Data de entrega” no controle de entrega para calcular.
                              </td>
                            </tr>
                          ) : (
                            deliveryEvaluation.map((row) => (
                              <tr key={row.equipment} className="border-t">
                                <td className="p-2 align-top">{row.equipment}</td>
                                <td className="p-2 align-top">{row.deliveries}</td>
                                <td className="p-2 align-top">{row.intervalLabel}</td>
                                <td className="p-2 align-top">{row.insufficientLabel}</td>
                                <td className="p-2 align-top">{row.status}</td>
                                <td className="p-2 align-top">{row.basis}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="training-audit" className="space-y-6">
                    <div className="space-y-2">
                      <Label>Apresentada evidências de treinamento</Label>
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="training-evidence-yes"
                            checked={mergedTrainingAudit.training_evidence === true}
                            onCheckedChange={() => updateTrainingAudit({ training_evidence: true })}
                          />
                          <Label htmlFor="training-evidence-yes">Sim</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="training-evidence-no"
                            checked={mergedTrainingAudit.training_evidence === false}
                            onCheckedChange={() => updateTrainingAudit({ training_evidence: false })}
                          />
                          <Label htmlFor="training-evidence-no">Não</Label>
                        </div>
                      </div>
                      <Textarea
                        value={String(mergedTrainingAudit.training_observation || "")}
                        onChange={(e) => updateTrainingAudit({ training_observation: e.target.value })}
                        placeholder="Observações sobre evidências de treinamento"
                        className="min-h-[90px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Os equipamentos possuem certificado de aprovação</Label>
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="ca-certificate-yes"
                            checked={mergedTrainingAudit.ca_certificate === true}
                            onCheckedChange={() => updateTrainingAudit({ ca_certificate: true })}
                          />
                          <Label htmlFor="ca-certificate-yes">Sim</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="ca-certificate-no"
                            checked={mergedTrainingAudit.ca_certificate === false}
                            onCheckedChange={() => updateTrainingAudit({ ca_certificate: false })}
                          />
                          <Label htmlFor="ca-certificate-no">Não</Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Fiscalização</Label>
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="inspection-yes"
                            checked={mergedTrainingAudit.inspection === true}
                            onCheckedChange={() => updateTrainingAudit({ inspection: true })}
                          />
                          <Label htmlFor="inspection-yes">Sim</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="inspection-no"
                            checked={mergedTrainingAudit.inspection === false}
                            onCheckedChange={() => updateTrainingAudit({ inspection: false })}
                          />
                          <Label htmlFor="inspection-no">Não</Label>
                        </div>
                      </div>
                      <Textarea
                        value={String(mergedTrainingAudit.inspection_observation || "")}
                        onChange={(e) => updateTrainingAudit({ inspection_observation: e.target.value })}
                        placeholder="Observações sobre fiscalização"
                        className="min-h-[90px]"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Periodicidade de trocas (OCR de documento)</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="file" accept="application/pdf,image/*,.png,.jpg,.jpeg" onChange={handleOcrFile} disabled={isProcessingOCR} />
            {isProcessingOCR && (
              <span className="text-xs text-muted-foreground">{ocrStatusLabel || "Processando..."}</span>
            )}
          </div>
          <Textarea value={periodicityResult} onChange={(e) => setPeriodicityResult(e.target.value)} placeholder="Resultado da avaliação de periodicidade" className="min-h-[140px]" />
          <p className="text-xs text-muted-foreground">O arquivo é enviado ao OCR (se configurado) ou extraído via PDFJS para texto. Em seguida, o LLM avalia a periodicidade das trocas dos EPIs.</p>
        </div>
      </CardContent>
    </Card>
  );
}
