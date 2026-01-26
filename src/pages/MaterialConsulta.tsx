import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import FileUpload from "@/components/storage/FileUpload";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookOpen, Check, ChevronDown, ChevronUp, Download, Eye, Folder, Loader2, Pencil, RefreshCcw, Search, Trash2, X } from "lucide-react";

type MaterialDoc = {
  id: string;
  theme: string;
  fileName: string;
  displayName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
};

type TechnicalBulletin = {
  id: string;
  epi: string;
  ca: string;
  protection_type: string;
  estimated_lifetime: string | null;
  attachment_path: string;
  attachment_name: string;
  created_at: string;
};

type FispqRecord = {
  id: string;
  product_identification: string | null;
  hazard_identification: string | null;
  composition: string | null;
  nr15_annex: string | null;
  tolerance_limit: string | null;
  skin_absorption_risk: string | null;
  flash_point: string | null;
  protection_measures_required: string | null;
  attachment_path: string;
  attachment_name: string;
  extracted_text: string | null;
  created_at: string;
  __local?: boolean;
};

type CalibrationCertificate = {
  id: string;
  equipment_name: string;
  model: string;
  manufacturer: string;
  attachment_path: string;
  attachment_name: string;
  created_at: string;
  __local?: boolean;
};

type IrrRecord = {
  id: string;
  representative_controversy: string;
  theme_type: "insalubridade" | "periculosidade";
  legal_thesis: string;
  attachment_path: string;
  attachment_name: string;
  created_at: string;
  __local?: boolean;
};

type TechnicalNoteRecord = {
  id: string;
  subject: string;
  technical_note: string;
  attachment_path: string;
  attachment_name: string;
  created_at: string;
  __local?: boolean;
};

type SumulaRecord = {
  id: string;
  sumula_number: string;
  legal_issue: string;
  attachment_path: string;
  attachment_name: string;
  created_at: string;
  __local?: boolean;
};

type FispqEditDraft = {
  product_identification: string;
  hazard_identification: string;
  composition: string;
  nr15_annex: string;
  tolerance_limit: string;
  skin_absorption_risk: string;
  flash_point: string;
  protection_measures_required: string;
  extracted_text: string;
};

const sanitizePathSegment = (value: string) => {
  const trimmed = String(value || "").trim();
  const base = trimmed || "Geral";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
};

const sanitizeFileBaseName = (value: string) => {
  const normalized = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return sanitizePathSegment(normalized);
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const extractDisplayName = (fileName: string) => {
  const nameNoExt = fileName.replace(/\.[^/.]+$/, "");
  const withoutTs = nameNoExt.replace(/^\d+_/, "");
  const candidate = withoutTs.replace(/_/g, " ").trim();
  return candidate || fileName;
};

const extractBetween = (text: string, startMatchers: RegExp[], endMatchers: RegExp[]) => {
  const src = String(text || "");
  const starts = startMatchers
    .map((re) => {
      const m = re.exec(src);
      return m ? { index: m.index, end: m.index + m[0].length } : null;
    })
    .filter(Boolean) as Array<{ index: number; end: number }>;

  if (!starts.length) return null;
  starts.sort((a, b) => a.index - b.index);
  const start = starts[0];
  const rest = src.slice(start.end);

  const endCandidates = endMatchers
    .map((re) => {
      const m = re.exec(rest);
      return m ? m.index : null;
    })
    .filter((x) => typeof x === "number") as number[];

  const endRel = endCandidates.length ? Math.min(...endCandidates) : rest.length;
  const out = rest.slice(0, endRel).trim();
  return out || null;
};

const parseFispqFromText = (text: string) => {
  const src = String(text || "");

  const product = extractBetween(
    src,
    [/^\s*1\s*[\.-]\s*identifica[cç][aã]o[\s\S]{0,60}$/im, /identifica[cç][aã]o\s+do\s+produto/i],
    [/^\s*2\s*[\.-]\s*/im, /^\s*2\s*\./im, /^\s*2\s*-/im],
  );

  const hazard = extractBetween(
    src,
    [/^\s*2\s*[\.-]\s*identifica[cç][aã]o[\s\S]{0,60}$/im, /identifica[cç][aã]o\s+de\s+perigo/i, /identifica[cç][aã]o\s+de\s+perigos/i],
    [/^\s*3\s*[\.-]\s*/im, /^\s*3\s*\./im, /^\s*3\s*-/im],
  );

  const composition = extractBetween(
    src,
    [/^\s*3\s*[\.-]\s*composi[cç][aã]o[\s\S]{0,80}$/im, /composi[cç][aã]o/i],
    [/^\s*4\s*[\.-]\s*/im, /^\s*4\s*\./im, /^\s*4\s*-/im],
  );

  const protectionMeasuresRequired = extractBetween(
    src,
    [
      /^\s*8\s*[\.-]\s*controle\s+de\s+exposi[cç][aã]o\/?prote[cç][aã]o\s+individual[\s\S]{0,80}$/im,
      /controle\s+de\s+exposi[cç][aã]o\s*\/?\s*prote[cç][aã]o\s+individual/i,
      /medidas\s+de\s+prote[cç][aã]o\s+requerid[ao]s?/i,
      /prote[cç][aã]o\s+respirat[oó]ria/i,
      /equipamentos?\s+de\s+prote[cç][aã]o\s+individual/i,
    ],
    [/^\s*9\s*[\.-]\s*/im, /^\s*9\s*\./im, /^\s*9\s*-/im],
  );

  const flashMatch = src.match(/ponto\s+de\s+fulgor\s*[:\-]?\s*([^\n\r]+)/i);
  const flashPoint = flashMatch ? String(flashMatch[1] || "").trim() : null;

  const tolMatch = src.match(
    /(limite[s]?\s+de\s+(toler[aâ]ncia|exposi[cç][aã]o)|TLV\b|TWA\b)\s*[:\-]?\s*([^\n\r]+)/i,
  );
  const toleranceLimit = tolMatch ? String(tolMatch[3] || tolMatch[0] || "").trim() : null;

  const skinMatch = src.match(/((?:absor[cç][aã]o\s+(?:cut[aâ]nea|pela\s+pele)|via\s+cut[aâ]nea)[^\n\r]*)/i);
  const skinAbsorptionRisk = skinMatch ? String(skinMatch[1] || "").trim() : null;

  const annex = (() => {
    const has13 = /anexo\s*(13\b|xiii\b)/i.test(src);
    const has11 = /anexo\s*(11\b|xi\b)/i.test(src);
    if (has11 && has13) return "11 e 13";
    if (has13) return "13";
    if (has11) return "11";
    return null;
  })();

  const cap = (s: string | null) => {
    const v = String(s || "").trim();
    if (!v) return null;
    return v.length > 2000 ? v.slice(0, 2000).trim() : v;
  };

  return {
    product_identification: cap(product),
    hazard_identification: cap(hazard),
    composition: cap(composition),
    nr15_annex: annex,
    tolerance_limit: cap(toleranceLimit),
    skin_absorption_risk: cap(skinAbsorptionRisk),
    flash_point: cap(flashPoint),
    protection_measures_required: cap(protectionMeasuresRequired),
  };
};

const getLocalFispqStorageKey = (userId: string) => `local_fispq_records_${userId}`;

const readLocalFispqs = (userId: string): FispqRecord[] => {
  try {
    const raw = localStorage.getItem(getLocalFispqStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .map((r: any) => {
        const id = typeof r?.id === "string" ? r.id : "";
        const created_at = typeof r?.created_at === "string" ? r.created_at : "";
        const attachment_path = typeof r?.attachment_path === "string" ? r.attachment_path : "";
        const attachment_name = typeof r?.attachment_name === "string" ? r.attachment_name : "";
        if (!id || !created_at || !attachment_path || !attachment_name) return null;
        return {
          id,
          product_identification: typeof r?.product_identification === "string" ? r.product_identification : null,
          hazard_identification: typeof r?.hazard_identification === "string" ? r.hazard_identification : null,
          composition: typeof r?.composition === "string" ? r.composition : null,
          nr15_annex: typeof r?.nr15_annex === "string" ? r.nr15_annex : null,
          tolerance_limit: typeof r?.tolerance_limit === "string" ? r.tolerance_limit : null,
          skin_absorption_risk: typeof r?.skin_absorption_risk === "string" ? r.skin_absorption_risk : null,
          flash_point: typeof r?.flash_point === "string" ? r.flash_point : null,
          protection_measures_required: typeof r?.protection_measures_required === "string" ? r.protection_measures_required : null,
          attachment_path,
          attachment_name,
          extracted_text: typeof r?.extracted_text === "string" ? r.extracted_text : null,
          created_at,
          __local: true,
        } as FispqRecord;
      })
      .filter(Boolean) as FispqRecord[];

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  } catch {
    return [];
  }
};

const writeLocalFispqs = (userId: string, items: FispqRecord[]) => {
  try {
    const serialized = items.map(({ __local, ...rest }) => rest);
    localStorage.setItem(getLocalFispqStorageKey(userId), JSON.stringify(serialized));
  } catch {
  }
};

const addLocalFispq = (userId: string, record: FispqRecord) => {
  const existing = readLocalFispqs(userId);
  const next = [{ ...record, __local: true }, ...existing];
  writeLocalFispqs(userId, next);
  return next;
};

const removeLocalFispq = (userId: string, id: string) => {
  const existing = readLocalFispqs(userId);
  const next = existing.filter((x) => x.id !== id);
  writeLocalFispqs(userId, next);
  return next;
};

const updateLocalFispq = (userId: string, record: FispqRecord) => {
  const existing = readLocalFispqs(userId);
  const next = existing.map((x) => (x.id === record.id ? { ...record, __local: true } : x));
  writeLocalFispqs(userId, next);
  return next;
};

const getLocalCalibrationStorageKey = (userId: string) => `local_calibration_certificates_${userId}`;

const readLocalCalibrations = (userId: string): CalibrationCertificate[] => {
  try {
    const raw = localStorage.getItem(getLocalCalibrationStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .map((r: any) => {
        const id = typeof r?.id === "string" ? r.id : "";
        const created_at = typeof r?.created_at === "string" ? r.created_at : "";
        const attachment_path = typeof r?.attachment_path === "string" ? r.attachment_path : "";
        const attachment_name = typeof r?.attachment_name === "string" ? r.attachment_name : "";
        const equipment_name = typeof r?.equipment_name === "string" ? r.equipment_name : "";
        const model = typeof r?.model === "string" ? r.model : "";
        const manufacturer = typeof r?.manufacturer === "string" ? r.manufacturer : "";
        if (!id || !created_at || !attachment_path || !attachment_name || !equipment_name || !model || !manufacturer) return null;
        return {
          id,
          equipment_name,
          model,
          manufacturer,
          attachment_path,
          attachment_name,
          created_at,
          __local: true,
        } as CalibrationCertificate;
      })
      .filter(Boolean) as CalibrationCertificate[];

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  } catch {
    return [];
  }
};

const writeLocalCalibrations = (userId: string, items: CalibrationCertificate[]) => {
  try {
    const serialized = items.map(({ __local, ...rest }) => rest);
    localStorage.setItem(getLocalCalibrationStorageKey(userId), JSON.stringify(serialized));
  } catch {
  }
};

const addLocalCalibration = (userId: string, record: CalibrationCertificate) => {
  const existing = readLocalCalibrations(userId);
  const next = [{ ...record, __local: true }, ...existing];
  writeLocalCalibrations(userId, next);
  return next;
};

const removeLocalCalibration = (userId: string, id: string) => {
  const existing = readLocalCalibrations(userId);
  const next = existing.filter((x) => x.id !== id);
  writeLocalCalibrations(userId, next);
  return next;
};

const getLocalIrrStorageKey = (userId: string) => `local_irr_records_${userId}`;

const readLocalIrrs = (userId: string): IrrRecord[] => {
  try {
    const raw = localStorage.getItem(getLocalIrrStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .map((r: any) => {
        const id = typeof r?.id === "string" ? r.id : "";
        const created_at = typeof r?.created_at === "string" ? r.created_at : "";
        const attachment_path = typeof r?.attachment_path === "string" ? r.attachment_path : "";
        const attachment_name = typeof r?.attachment_name === "string" ? r.attachment_name : "";
        const representative_controversy = typeof r?.representative_controversy === "string" ? r.representative_controversy : "";
        const theme_type = r?.theme_type === "insalubridade" || r?.theme_type === "periculosidade" ? r.theme_type : "";
        const legal_thesis = typeof r?.legal_thesis === "string" ? r.legal_thesis : "";
        if (!id || !created_at || !attachment_path || !attachment_name || !representative_controversy || !theme_type || !legal_thesis) return null;
        return {
          id,
          representative_controversy,
          theme_type,
          legal_thesis,
          attachment_path,
          attachment_name,
          created_at,
          __local: true,
        } as IrrRecord;
      })
      .filter(Boolean) as IrrRecord[];

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  } catch {
    return [];
  }
};

const writeLocalIrrs = (userId: string, items: IrrRecord[]) => {
  try {
    const serialized = items.map(({ __local, ...rest }) => rest);
    localStorage.setItem(getLocalIrrStorageKey(userId), JSON.stringify(serialized));
  } catch {
  }
};

const addLocalIrr = (userId: string, record: IrrRecord) => {
  const existing = readLocalIrrs(userId);
  const next = [{ ...record, __local: true }, ...existing];
  writeLocalIrrs(userId, next);
  return next;
};

const removeLocalIrr = (userId: string, id: string) => {
  const existing = readLocalIrrs(userId);
  const next = existing.filter((x) => x.id !== id);
  writeLocalIrrs(userId, next);
  return next;
};

const getLocalTechnicalNotesStorageKey = (userId: string) => `local_technical_notes_${userId}`;

const readLocalTechnicalNotes = (userId: string): TechnicalNoteRecord[] => {
  try {
    const raw = localStorage.getItem(getLocalTechnicalNotesStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .map((r: any) => {
        const id = typeof r?.id === "string" ? r.id : "";
        const created_at = typeof r?.created_at === "string" ? r.created_at : "";
        const attachment_path = typeof r?.attachment_path === "string" ? r.attachment_path : "";
        const attachment_name = typeof r?.attachment_name === "string" ? r.attachment_name : "";
        const subject = typeof r?.subject === "string" ? r.subject : "";
        const technical_note = typeof r?.technical_note === "string" ? r.technical_note : "";
        if (!id || !created_at || !attachment_path || !attachment_name || !subject || !technical_note) return null;
        return {
          id,
          subject,
          technical_note,
          attachment_path,
          attachment_name,
          created_at,
          __local: true,
        } as TechnicalNoteRecord;
      })
      .filter(Boolean) as TechnicalNoteRecord[];

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  } catch {
    return [];
  }
};

const writeLocalTechnicalNotes = (userId: string, items: TechnicalNoteRecord[]) => {
  try {
    const serialized = items.map(({ __local, ...rest }) => rest);
    localStorage.setItem(getLocalTechnicalNotesStorageKey(userId), JSON.stringify(serialized));
  } catch {
  }
};

const addLocalTechnicalNote = (userId: string, record: TechnicalNoteRecord) => {
  const existing = readLocalTechnicalNotes(userId);
  const next = [{ ...record, __local: true }, ...existing];
  writeLocalTechnicalNotes(userId, next);
  return next;
};

const removeLocalTechnicalNote = (userId: string, id: string) => {
  const existing = readLocalTechnicalNotes(userId);
  const next = existing.filter((x) => x.id !== id);
  writeLocalTechnicalNotes(userId, next);
  return next;
};

const getLocalSumulaStorageKey = (userId: string) => `local_sumula_records_${userId}`;

const readLocalSumulas = (userId: string): SumulaRecord[] => {
  try {
    const raw = localStorage.getItem(getLocalSumulaStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .map((r: any) => {
        const id = typeof r?.id === "string" ? r.id : "";
        const created_at = typeof r?.created_at === "string" ? r.created_at : "";
        const attachment_path = typeof r?.attachment_path === "string" ? r.attachment_path : "";
        const attachment_name = typeof r?.attachment_name === "string" ? r.attachment_name : "";
        const sumula_number = typeof r?.sumula_number === "string" ? r.sumula_number : "";
        const legal_issue = typeof r?.legal_issue === "string" ? r.legal_issue : "";
        if (!id || !created_at || !attachment_path || !attachment_name || !sumula_number || !legal_issue) return null;
        return {
          id,
          sumula_number,
          legal_issue,
          attachment_path,
          attachment_name,
          created_at,
          __local: true,
        } as SumulaRecord;
      })
      .filter(Boolean) as SumulaRecord[];

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  } catch {
    return [];
  }
};

const writeLocalSumulas = (userId: string, items: SumulaRecord[]) => {
  try {
    const serialized = items.map(({ __local, ...rest }) => rest);
    localStorage.setItem(getLocalSumulaStorageKey(userId), JSON.stringify(serialized));
  } catch {
  }
};

const addLocalSumula = (userId: string, record: SumulaRecord) => {
  const existing = readLocalSumulas(userId);
  const next = [{ ...record, __local: true }, ...existing];
  writeLocalSumulas(userId, next);
  return next;
};

const removeLocalSumula = (userId: string, id: string) => {
  const existing = readLocalSumulas(userId);
  const next = existing.filter((x) => x.id !== id);
  writeLocalSumulas(userId, next);
  return next;
};

export default function MaterialConsulta() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"arquivos" | "boletins" | "fispq" | "calibracao" | "irr" | "nota-tecnica" | "sumula">("arquivos");

  const [materialOwnerId, setMaterialOwnerId] = useState<string | null>(null);

  const [theme, setTheme] = useState("Geral");
  const [customName, setCustomName] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<MaterialDoc[]>([]);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState("");
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);

  const [bulletinLoading, setBulletinLoading] = useState(true);
  const [bulletins, setBulletins] = useState<TechnicalBulletin[]>([]);
  const [bulletinQuery, setBulletinQuery] = useState("");
  const [missingBulletinsTableWarned, setMissingBulletinsTableWarned] = useState(() => {
    try {
      return localStorage.getItem("missing_table_manufacturer_technical_bulletins") === "1";
    } catch {
      return false;
    }
  });
  const [bulletinDraft, setBulletinDraft] = useState({
    epi: "",
    ca: "",
    protection_type: "",
    estimated_lifetime: "",
  });
  const [deletingBulletinId, setDeletingBulletinId] = useState<string | null>(null);

  const [fispqLoading, setFispqLoading] = useState(true);
  const [fispqs, setFispqs] = useState<FispqRecord[]>([]);
  const [fispqQuery, setFispqQuery] = useState("");
  const [missingFispqTableWarned, setMissingFispqTableWarned] = useState(() => {
    try {
      return localStorage.getItem("missing_table_fispq_records") === "1";
    } catch {
      return false;
    }
  });
  const [fispqDraft, setFispqDraft] = useState({
    product_identification: "",
    hazard_identification: "",
    composition: "",
    nr15_annex: "",
    tolerance_limit: "",
    skin_absorption_risk: "",
    flash_point: "",
    protection_measures_required: "",
    attachment_path: "",
    attachment_name: "",
    extracted_text: "",
  });
  const [savingFispq, setSavingFispq] = useState(false);
  const [deletingFispqId, setDeletingFispqId] = useState<string | null>(null);
  const [expandedFispqId, setExpandedFispqId] = useState<string | null>(null);
  const [editingFispqId, setEditingFispqId] = useState<string | null>(null);
  const [editingFispqDraft, setEditingFispqDraft] = useState<FispqEditDraft>({
    product_identification: "",
    hazard_identification: "",
    composition: "",
    nr15_annex: "",
    tolerance_limit: "",
    skin_absorption_risk: "",
    flash_point: "",
    protection_measures_required: "",
    extracted_text: "",
  });
  const [updatingFispqId, setUpdatingFispqId] = useState<string | null>(null);

  const [calibrationLoading, setCalibrationLoading] = useState(true);
  const [calibrations, setCalibrations] = useState<CalibrationCertificate[]>([]);
  const [calibrationQuery, setCalibrationQuery] = useState("");
  const [missingCalibrationTableWarned, setMissingCalibrationTableWarned] = useState(() => {
    try {
      return localStorage.getItem("missing_table_calibration_certificates") === "1";
    } catch {
      return false;
    }
  });
  const [calibrationDraft, setCalibrationDraft] = useState({
    equipment_name: "",
    model: "",
    manufacturer: "",
  });
  const [deletingCalibrationId, setDeletingCalibrationId] = useState<string | null>(null);

  const [irrLoading, setIrrLoading] = useState(true);
  const [irrs, setIrrs] = useState<IrrRecord[]>([]);
  const [irrQuery, setIrrQuery] = useState("");
  const [missingIrrTableWarned, setMissingIrrTableWarned] = useState(() => {
    try {
      return localStorage.getItem("missing_table_irr_records") === "1";
    } catch {
      return false;
    }
  });
  const [irrDraft, setIrrDraft] = useState({
    representative_controversy: "",
    theme_type: "" as "" | "insalubridade" | "periculosidade",
    legal_thesis: "",
  });
  const [deletingIrrId, setDeletingIrrId] = useState<string | null>(null);

  const [technicalNotesLoading, setTechnicalNotesLoading] = useState(true);
  const [technicalNotes, setTechnicalNotes] = useState<TechnicalNoteRecord[]>([]);
  const [technicalNoteQuery, setTechnicalNoteQuery] = useState("");
  const [missingTechnicalNotesTableWarned, setMissingTechnicalNotesTableWarned] = useState(() => {
    try {
      return localStorage.getItem("missing_table_technical_notes") === "1";
    } catch {
      return false;
    }
  });
  const [technicalNoteDraft, setTechnicalNoteDraft] = useState({
    subject: "",
    technical_note: "",
  });
  const [deletingTechnicalNoteId, setDeletingTechnicalNoteId] = useState<string | null>(null);

  const [sumulasLoading, setSumulasLoading] = useState(true);
  const [sumulas, setSumulas] = useState<SumulaRecord[]>([]);
  const [sumulaQuery, setSumulaQuery] = useState("");
  const [missingSumulaTableWarned, setMissingSumulaTableWarned] = useState(() => {
    try {
      return localStorage.getItem("missing_table_sumula_records") === "1";
    } catch {
      return false;
    }
  });
  const [sumulaDraft, setSumulaDraft] = useState({
    sumula_number: "",
    legal_issue: "",
  });
  const [deletingSumulaId, setDeletingSumulaId] = useState<string | null>(null);

  const startEditFispq = (f: FispqRecord) => {
    setExpandedFispqId(f.id);
    setEditingFispqId(f.id);
    setEditingFispqDraft({
      product_identification: f.product_identification || "",
      hazard_identification: f.hazard_identification || "",
      composition: f.composition || "",
      nr15_annex: f.nr15_annex || "",
      tolerance_limit: f.tolerance_limit || "",
      skin_absorption_risk: f.skin_absorption_risk || "",
      flash_point: f.flash_point || "",
      protection_measures_required: f.protection_measures_required || "",
      extracted_text: f.extracted_text || "",
    });
  };

  const cancelEditFispq = () => {
    setEditingFispqId(null);
  };

  const saveEditFispq = async (f: FispqRecord) => {
    const product = String(editingFispqDraft.product_identification || "").trim();
    if (!product) {
      toast({ title: "Campo obrigatório", description: "Preencha Identificação do produto.", variant: "destructive" });
      return;
    }

    const vOrNull = (v: string) => {
      const s = String(v || "").trim();
      return s ? s : null;
    };

    setUpdatingFispqId(f.id);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");
      const userId = userRes.user.id;

      const updated: FispqRecord = {
        ...f,
        product_identification: vOrNull(editingFispqDraft.product_identification),
        hazard_identification: vOrNull(editingFispqDraft.hazard_identification),
        composition: vOrNull(editingFispqDraft.composition),
        nr15_annex: vOrNull(editingFispqDraft.nr15_annex),
        tolerance_limit: vOrNull(editingFispqDraft.tolerance_limit),
        skin_absorption_risk: vOrNull(editingFispqDraft.skin_absorption_risk),
        flash_point: vOrNull(editingFispqDraft.flash_point),
        protection_measures_required: vOrNull(editingFispqDraft.protection_measures_required),
        extracted_text: vOrNull(editingFispqDraft.extracted_text),
        __local: f.__local,
      };

      if (f.__local) {
        updateLocalFispq(userId, updated);
        setFispqs((prev) => prev.map((x) => (x.id === f.id ? updated : x)));
        setEditingFispqId(null);
        toast({ title: "Salvo", description: "FISPQ atualizada." });
        return;
      }

      const { error } = await supabase
        .from("fispq_records")
        .update({
          product_identification: updated.product_identification,
          hazard_identification: updated.hazard_identification,
          composition: updated.composition,
          nr15_annex: updated.nr15_annex,
          tolerance_limit: updated.tolerance_limit,
          skin_absorption_risk: updated.skin_absorption_risk,
          flash_point: updated.flash_point,
          protection_measures_required: updated.protection_measures_required,
          extracted_text: updated.extracted_text,
        })
        .eq("id", f.id);

      if (error) throw error;

      setFispqs((prev) => prev.map((x) => (x.id === f.id ? updated : x)));
      setEditingFispqId(null);
      toast({ title: "Salvo", description: "FISPQ atualizada." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar alterações";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setUpdatingFispqId(null);
    }
  };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

      const userId = userRes.user.id;
      const userMetadata = (userRes.user as any)?.user_metadata;

      const ownerId = await (async () => {
        const metaOwner = typeof userMetadata?.linked_owner_id === "string" ? String(userMetadata.linked_owner_id) : "";
        try {
          const { data, error } = await supabase
            .from("linked_users")
            .select("owner_user_id")
            .eq("auth_user_id", userId)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();

          if (!error && data?.owner_user_id) return String(data.owner_user_id);
        } catch {
        }
        return metaOwner || userId;
      })();

      setMaterialOwnerId(ownerId);

      const root = `${ownerId}/material-consulta`;

      const { data: themeEntries, error: themesErr } = await supabase.storage.from("process-documents").list(root, {
        limit: 200,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

      if (themesErr) {
        const msg = String((themesErr as any)?.message || "");
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("does not exist")) {
          setDocs([]);
          return;
        }
        throw themesErr;
      }

      const themeNames = (themeEntries || []).map((x) => x.name).filter(Boolean);
      const perTheme = await Promise.all(
        themeNames.map(async (t) => {
          const { data: files, error } = await supabase.storage.from("process-documents").list(`${root}/${t}`, {
            limit: 500,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
          });
          if (error) return { theme: t, files: [] as any[] };
          return { theme: t, files: files || [] };
        }),
      );

      const next: MaterialDoc[] = perTheme.flatMap(({ theme, files }) => {
        return files
          .filter((f: any) => Boolean(f?.metadata))
          .map((f: any) => {
            const fileName = String(f.name || "");
            const filePath = `${root}/${theme}/${fileName}`;
            return {
              id: filePath,
              theme,
              fileName,
              displayName: extractDisplayName(fileName),
              filePath,
              fileSize: Number(f?.metadata?.size || 0),
              fileType: String(f?.metadata?.mimetype || "application/octet-stream"),
              createdAt: String(f?.created_at || f?.updated_at || new Date().toISOString()),
            };
          });
      });

      setDocs(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar materiais";
      toast({ title: "Erro", description: message, variant: "destructive" });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const fetchBulletins = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    setBulletinLoading(true);
    if (missingBulletinsTableWarned && !force) {
      setBulletinLoading(false);
      return;
    }
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("manufacturer_technical_bulletins")
        .select("id, epi, ca, protection_type, estimated_lifetime, attachment_path, attachment_name, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBulletins((data || []) as any);

      if (missingBulletinsTableWarned) {
        setMissingBulletinsTableWarned(false);
        try {
          localStorage.removeItem("missing_table_manufacturer_technical_bulletins");
        } catch {
        }
      }
    } catch (e) {
      const anyErr = e as any;
      const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);

      if (status === 404) {
        setBulletins([]);
        if (!missingBulletinsTableWarned) {
          setMissingBulletinsTableWarned(true);
          try {
            localStorage.setItem("missing_table_manufacturer_technical_bulletins", "1");
          } catch {
          }
          toast({
            title: "Tabela não encontrada",
            description: "A tabela manufacturer_technical_bulletins não existe no Supabase. Aplique as migrations 20260112000001_manufacturer_technical_bulletins.sql e 20260112000002_add_estimated_lifetime_to_bulletins.sql.",
            variant: "destructive",
          });
        }
      } else {
        const message = e instanceof Error ? e.message : "Erro ao carregar boletins";
        toast({ title: "Erro", description: message, variant: "destructive" });
        setBulletins([]);
      }
    } finally {
      setBulletinLoading(false);
    }
  }, [missingBulletinsTableWarned, toast]);

  const fetchFispqs = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    setFispqLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

      const userId = userRes.user.id;
      const ownerId = materialOwnerId || userId;
      if (missingFispqTableWarned && !force) {
        setFispqs(readLocalFispqs(userId));
        return;
      }

      const { data, error } = await supabase
        .from("fispq_records")
        .select(
          "id, product_identification, hazard_identification, composition, nr15_annex, tolerance_limit, skin_absorption_risk, flash_point, protection_measures_required, attachment_path, attachment_name, extracted_text, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const localBefore = readLocalFispqs(userId);
      if (localBefore.length > 0) {
        const payload = localBefore.map((r) => ({
          user_id: ownerId,
          product_identification: r.product_identification,
          hazard_identification: r.hazard_identification,
          composition: r.composition,
          nr15_annex: r.nr15_annex,
          tolerance_limit: r.tolerance_limit,
          skin_absorption_risk: r.skin_absorption_risk,
          flash_point: r.flash_point,
          protection_measures_required: r.protection_measures_required,
          attachment_path: r.attachment_path,
          attachment_name: r.attachment_name,
          extracted_text: r.extracted_text,
        }));

        const { error: syncErr } = await supabase.from("fispq_records").insert(payload);
        if (!syncErr) {
          writeLocalFispqs(userId, []);
        }
      }

      const localAfter = readLocalFispqs(userId);
      const remoteRows = ((data || []) as any[]).map((r) => ({ ...r, __local: false }));
      const combined = [...localAfter, ...(remoteRows as any)];
      combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFispqs(combined as any);

      if (missingFispqTableWarned) {
        setMissingFispqTableWarned(false);
        try {
          localStorage.removeItem("missing_table_fispq_records");
        } catch {
        }
      }
    } catch (e) {
      const anyErr = e as any;
      const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);

      if (status === 404) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const userId = userRes?.user?.id;
          if (userId) {
            setFispqs(readLocalFispqs(userId));
          } else {
            setFispqs([]);
          }
        } catch {
          setFispqs([]);
        }
        if (!missingFispqTableWarned) {
          setMissingFispqTableWarned(true);
          try {
            localStorage.setItem("missing_table_fispq_records", "1");
          } catch {
          }
          toast({
            title: "Tabela não encontrada",
            description: "A tabela fispq_records não existe no Supabase. Aplique a migration 20260112000003_fispq_records.sql.",
            variant: "destructive",
          });
        }
      } else {
        const message = e instanceof Error ? e.message : "Erro ao carregar FISPQs";
        toast({ title: "Erro", description: message, variant: "destructive" });
        setFispqs([]);
      }
    } finally {
      setFispqLoading(false);
    }
  }, [materialOwnerId, missingFispqTableWarned, toast]);

  const fetchCalibrations = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      setCalibrationLoading(true);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

        const userId = userRes.user.id;
        const ownerId = materialOwnerId || userId;

        if (missingCalibrationTableWarned && !force) {
          setCalibrations(readLocalCalibrations(userId));
          return;
        }

        const { data, error } = await supabase
          .from("calibration_certificates")
          .select("id, equipment_name, model, manufacturer, attachment_path, attachment_name, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const localBefore = readLocalCalibrations(userId);
        if (localBefore.length > 0) {
          const payload = localBefore.map((r) => ({
            user_id: ownerId,
            equipment_name: r.equipment_name,
            model: r.model,
            manufacturer: r.manufacturer,
            attachment_path: r.attachment_path,
            attachment_name: r.attachment_name,
          }));

          const { error: syncErr } = await supabase.from("calibration_certificates").insert(payload);
          if (!syncErr) {
            writeLocalCalibrations(userId, []);
          }
        }

        const localAfter = readLocalCalibrations(userId);
        const remoteRows = ((data || []) as any[]).map((r) => ({ ...r, __local: false }));
        const combined = [...localAfter, ...(remoteRows as any)];
        combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCalibrations(combined as any);

        if (missingCalibrationTableWarned) {
          setMissingCalibrationTableWarned(false);
          try {
            localStorage.removeItem("missing_table_calibration_certificates");
          } catch {
          }
        }
      } catch (e) {
        const anyErr = e as any;
        const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);

        if (status === 404) {
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const userId = userRes?.user?.id;
            if (userId) {
              setCalibrations(readLocalCalibrations(userId));
            } else {
              setCalibrations([]);
            }
          } catch {
            setCalibrations([]);
          }
          if (!missingCalibrationTableWarned) {
            setMissingCalibrationTableWarned(true);
            try {
              localStorage.setItem("missing_table_calibration_certificates", "1");
            } catch {
            }
            toast({
              title: "Tabela não encontrada",
              description: "A tabela calibration_certificates não existe no Supabase. Aplique a migration 20260126000001_calibration_certificates.sql para habilitar a sincronização.",
              variant: "destructive",
            });
          }
        } else {
          const message = e instanceof Error ? e.message : "Erro ao carregar certificados";
          toast({ title: "Erro", description: message, variant: "destructive" });
          setCalibrations([]);
        }
      } finally {
        setCalibrationLoading(false);
      }
    },
    [materialOwnerId, missingCalibrationTableWarned, toast],
  );

  const fetchIrrs = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      setIrrLoading(true);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

        const userId = userRes.user.id;
        const ownerId = materialOwnerId || userId;

        if (missingIrrTableWarned && !force) {
          setIrrs(readLocalIrrs(userId));
          return;
        }

        const { data, error } = await supabase
          .from("irr_records")
          .select("id, representative_controversy, theme_type, legal_thesis, attachment_path, attachment_name, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const localBefore = readLocalIrrs(userId);
        if (localBefore.length > 0) {
          const payload = localBefore.map((r) => ({
            user_id: ownerId,
            representative_controversy: r.representative_controversy,
            theme_type: r.theme_type,
            legal_thesis: r.legal_thesis,
            attachment_path: r.attachment_path,
            attachment_name: r.attachment_name,
          }));

          const { error: syncErr } = await supabase.from("irr_records").insert(payload);
          if (!syncErr) {
            writeLocalIrrs(userId, []);
          }
        }

        const localAfter = readLocalIrrs(userId);
        const remoteRows = ((data || []) as any[]).map((r) => ({ ...r, __local: false }));
        const combined = [...localAfter, ...(remoteRows as any)];
        combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setIrrs(combined as any);

        if (missingIrrTableWarned) {
          setMissingIrrTableWarned(false);
          try {
            localStorage.removeItem("missing_table_irr_records");
          } catch {
          }
        }
      } catch (e) {
        const anyErr = e as any;
        const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);

        if (status === 404) {
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const userId = userRes?.user?.id;
            if (userId) {
              setIrrs(readLocalIrrs(userId));
            } else {
              setIrrs([]);
            }
          } catch {
            setIrrs([]);
          }
          if (!missingIrrTableWarned) {
            setMissingIrrTableWarned(true);
            try {
              localStorage.setItem("missing_table_irr_records", "1");
            } catch {
            }
            toast({
              title: "Tabela não encontrada",
              description: "A tabela irr_records não existe no Supabase. Aplique a migration 20260126000002_irr_records.sql.",
              variant: "destructive",
            });
          }
        } else {
          const message = e instanceof Error ? e.message : "Erro ao carregar IRR";
          toast({ title: "Erro", description: message, variant: "destructive" });
          setIrrs([]);
        }
      } finally {
        setIrrLoading(false);
      }
    },
    [materialOwnerId, missingIrrTableWarned, toast],
  );

  const fetchTechnicalNotes = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      setTechnicalNotesLoading(true);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

        const userId = userRes.user.id;
        const ownerId = materialOwnerId || userId;

        if (missingTechnicalNotesTableWarned && !force) {
          setTechnicalNotes(readLocalTechnicalNotes(userId));
          return;
        }

        const { data, error } = await supabase
          .from("technical_notes")
          .select("id, subject, technical_note, attachment_path, attachment_name, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const localBefore = readLocalTechnicalNotes(userId);
        if (localBefore.length > 0) {
          const payload = localBefore.map((r) => ({
            user_id: ownerId,
            subject: r.subject,
            technical_note: r.technical_note,
            attachment_path: r.attachment_path,
            attachment_name: r.attachment_name,
          }));

          const { error: syncErr } = await supabase.from("technical_notes").insert(payload);
          if (!syncErr) {
            writeLocalTechnicalNotes(userId, []);
          }
        }

        const localAfter = readLocalTechnicalNotes(userId);
        const remoteRows = ((data || []) as any[]).map((r) => ({ ...r, __local: false }));
        const combined = [...localAfter, ...(remoteRows as any)];
        combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTechnicalNotes(combined as any);

        if (missingTechnicalNotesTableWarned) {
          setMissingTechnicalNotesTableWarned(false);
          try {
            localStorage.removeItem("missing_table_technical_notes");
          } catch {
          }
        }
      } catch (e) {
        const anyErr = e as any;
        const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);
        const rawMessage =
          typeof anyErr?.message === "string"
            ? anyErr.message
            : typeof anyErr?.error === "string"
              ? anyErr.error
              : "";
        const rawDetails = typeof anyErr?.details === "string" ? anyErr.details : "";
        const lower = `${rawMessage} ${rawDetails}`.toLowerCase();
        const looksLike404 = status === 404 || (lower.includes("404") && lower.includes("technical_notes"));

        if (looksLike404) {
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const userId = userRes?.user?.id;
            if (userId) {
              setTechnicalNotes(readLocalTechnicalNotes(userId));
            } else {
              setTechnicalNotes([]);
            }
          } catch {
            setTechnicalNotes([]);
          }
          if (!missingTechnicalNotesTableWarned) {
            setMissingTechnicalNotesTableWarned(true);
            try {
              localStorage.setItem("missing_table_technical_notes", "1");
            } catch {
            }
            toast({
              title: "Tabela não encontrada",
              description: "A tabela technical_notes não existe no Supabase. Aplique a migration 20260126000003_technical_notes.sql.",
              variant: "destructive",
            });
          }
        } else {
          const message = e instanceof Error ? e.message : "Erro ao carregar Nota Técnica";
          toast({ title: "Erro", description: message, variant: "destructive" });
          setTechnicalNotes([]);
        }
      } finally {
        setTechnicalNotesLoading(false);
      }
    },
    [materialOwnerId, missingTechnicalNotesTableWarned, toast],
  );

  const fetchSumulas = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      setSumulasLoading(true);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

        const userId = userRes.user.id;
        const ownerId = materialOwnerId || userId;

        if (missingSumulaTableWarned && !force) {
          setSumulas(readLocalSumulas(userId));
          return;
        }

        const { data, error } = await supabase
          .from("sumula_records")
          .select("id, sumula_number, legal_issue, attachment_path, attachment_name, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const localBefore = readLocalSumulas(userId);
        if (localBefore.length > 0) {
          const payload = localBefore.map((r) => ({
            user_id: ownerId,
            sumula_number: r.sumula_number,
            legal_issue: r.legal_issue,
            attachment_path: r.attachment_path,
            attachment_name: r.attachment_name,
          }));

          const { error: syncErr } = await supabase.from("sumula_records").insert(payload);
          if (!syncErr) {
            writeLocalSumulas(userId, []);
          }
        }

        const localAfter = readLocalSumulas(userId);
        const remoteRows = ((data || []) as any[]).map((r) => ({ ...r, __local: false }));
        const combined = [...localAfter, ...(remoteRows as any)];
        combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSumulas(combined as any);

        if (missingSumulaTableWarned) {
          setMissingSumulaTableWarned(false);
          try {
            localStorage.removeItem("missing_table_sumula_records");
          } catch {
          }
        }
      } catch (e) {
        const anyErr = e as any;
        const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);
        const rawMessage =
          typeof anyErr?.message === "string"
            ? anyErr.message
            : typeof anyErr?.error === "string"
              ? anyErr.error
              : "";
        const rawDetails = typeof anyErr?.details === "string" ? anyErr.details : "";
        const lower = `${rawMessage} ${rawDetails}`.toLowerCase();
        const looksLike404 = status === 404 || (lower.includes("404") && lower.includes("sumula_records"));

        if (looksLike404) {
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const userId = userRes?.user?.id;
            if (userId) {
              setSumulas(readLocalSumulas(userId));
            } else {
              setSumulas([]);
            }
          } catch {
            setSumulas([]);
          }
          if (!missingSumulaTableWarned) {
            setMissingSumulaTableWarned(true);
            try {
              localStorage.setItem("missing_table_sumula_records", "1");
            } catch {
            }
            toast({
              title: "Tabela não encontrada",
              description: "A tabela sumula_records não existe no Supabase. Aplique a migration 20260126000004_sumula_records.sql.",
              variant: "destructive",
            });
          }
        } else {
          const message = e instanceof Error ? e.message : "Erro ao carregar Súmulas";
          toast({ title: "Erro", description: message, variant: "destructive" });
          setSumulas([]);
        }
      } finally {
        setSumulasLoading(false);
      }
    },
    [materialOwnerId, missingSumulaTableWarned, toast],
  );

  useEffect(() => {
    if (activeTab === "boletins") {
      if (!missingBulletinsTableWarned) fetchBulletins();
    }
    if (activeTab === "fispq") {
      fetchFispqs();
    }
    if (activeTab === "calibracao") {
      fetchCalibrations();
    }
    if (activeTab === "irr") {
      fetchIrrs();
    }
    if (activeTab === "nota-tecnica") {
      fetchTechnicalNotes();
    }
    if (activeTab === "sumula") {
      fetchSumulas();
    }
  }, [
    activeTab,
    fetchBulletins,
    fetchCalibrations,
    fetchFispqs,
    fetchIrrs,
    fetchSumulas,
    fetchTechnicalNotes,
    missingBulletinsTableWarned,
    missingCalibrationTableWarned,
    missingFispqTableWarned,
    missingIrrTableWarned,
    missingSumulaTableWarned,
    missingTechnicalNotesTableWarned,
  ]);


  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      return (
        d.displayName.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.theme.toLowerCase().includes(q)
      );
    });
  }, [docs, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, MaterialDoc[]>();
    for (const d of filteredDocs) {
      const key = d.theme || "Geral";
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDocs]);

  const filteredBulletins = useMemo(() => {
    const q = bulletinQuery.trim().toLowerCase();
    if (!q) return bulletins;
    return bulletins.filter((b) => {
      return (
        String(b.epi || "").toLowerCase().includes(q) ||
        String(b.ca || "").toLowerCase().includes(q) ||
        String(b.protection_type || "").toLowerCase().includes(q) ||
        String(b.estimated_lifetime || "").toLowerCase().includes(q) ||
        String(b.attachment_name || "").toLowerCase().includes(q)
      );
    });
  }, [bulletins, bulletinQuery]);

  const filteredFispqs = useMemo(() => {
    const q = fispqQuery.trim().toLowerCase();
    if (!q) return fispqs;
    return fispqs.filter((f) => {
      return (
        String(f.product_identification || "").toLowerCase().includes(q) ||
        String(f.hazard_identification || "").toLowerCase().includes(q) ||
        String(f.composition || "").toLowerCase().includes(q) ||
        String(f.nr15_annex || "").toLowerCase().includes(q) ||
        String(f.tolerance_limit || "").toLowerCase().includes(q) ||
        String(f.skin_absorption_risk || "").toLowerCase().includes(q) ||
        String(f.flash_point || "").toLowerCase().includes(q) ||
        String(f.protection_measures_required || "").toLowerCase().includes(q) ||
        String(f.attachment_name || "").toLowerCase().includes(q)
      );
    });
  }, [fispqs, fispqQuery]);

  const filteredCalibrations = useMemo(() => {
    const q = calibrationQuery.trim().toLowerCase();
    if (!q) return calibrations;
    return calibrations.filter((c) => {
      return (
        String(c.equipment_name || "").toLowerCase().includes(q) ||
        String(c.model || "").toLowerCase().includes(q) ||
        String(c.manufacturer || "").toLowerCase().includes(q) ||
        String(c.attachment_name || "").toLowerCase().includes(q)
      );
    });
  }, [calibrations, calibrationQuery]);

  const filteredIrrs = useMemo(() => {
    const q = irrQuery.trim().toLowerCase();
    if (!q) return irrs;
    return irrs.filter((r) => {
      return (
        String(r.representative_controversy || "").toLowerCase().includes(q) ||
        String(r.theme_type || "").toLowerCase().includes(q) ||
        String(r.legal_thesis || "").toLowerCase().includes(q) ||
        String(r.attachment_name || "").toLowerCase().includes(q)
      );
    });
  }, [irrs, irrQuery]);

  const filteredTechnicalNotes = useMemo(() => {
    const q = technicalNoteQuery.trim().toLowerCase();
    if (!q) return technicalNotes;
    return technicalNotes.filter((n) => {
      return (
        String(n.subject || "").toLowerCase().includes(q) ||
        String(n.technical_note || "").toLowerCase().includes(q) ||
        String(n.attachment_name || "").toLowerCase().includes(q)
      );
    });
  }, [technicalNotes, technicalNoteQuery]);

  const filteredSumulas = useMemo(() => {
    const q = sumulaQuery.trim().toLowerCase();
    if (!q) return sumulas;
    return sumulas.filter((s) => {
      return (
        String(s.sumula_number || "").toLowerCase().includes(q) ||
        String(s.legal_issue || "").toLowerCase().includes(q) ||
        String(s.attachment_name || "").toLowerCase().includes(q)
      );
    });
  }, [sumulas, sumulaQuery]);

  const previewDoc = async (doc: MaterialDoc) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(doc.filePath, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadDoc = async (doc: MaterialDoc) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(doc.filePath);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteDoc = async (doc: MaterialDoc) => {
    try {
      setDeletingPath(doc.filePath);
      const { error } = await supabase.storage.from("process-documents").remove([doc.filePath]);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast({ title: "Removido", description: `"${doc.displayName}" foi excluído.` });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingPath(null);
    }
  };

  const startRenameDoc = (doc: MaterialDoc) => {
    setEditingDocId(doc.id);
    setEditingDocName(doc.displayName);
  };

  const cancelRenameDoc = () => {
    setEditingDocId(null);
    setEditingDocName("");
  };

  const saveRenameDoc = async (doc: MaterialDoc) => {
    const display = String(editingDocName || "").trim();
    if (!display) {
      toast({ title: "Campo obrigatório", description: "Preencha o nome do arquivo.", variant: "destructive" });
      return;
    }

    if (display === doc.displayName) {
      cancelRenameDoc();
      return;
    }

    setRenamingDocId(doc.id);
    try {
      const ext = (() => {
        const idx = doc.fileName.lastIndexOf(".");
        return idx >= 0 ? doc.fileName.slice(idx) : "";
      })();
      const prefix = (() => {
        const m = /^\d+_/.exec(doc.fileName);
        return m ? m[0] : "";
      })();

      const base = sanitizeFileBaseName(display) || "Arquivo";
      const dir = doc.filePath.slice(0, doc.filePath.lastIndexOf("/"));

      let movedName = "";
      let movedPath = "";

      for (let attempt = 0; attempt < 10; attempt++) {
        const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
        const nextName = `${prefix}${base}${suffix}${ext}`;
        const nextPath = `${dir}/${nextName}`;
        const { error } = await supabase.storage.from("process-documents").move(doc.filePath, nextPath);
        if (!error) {
          movedName = nextName;
          movedPath = nextPath;
          break;
        }

        const status = Number((error as any)?.statusCode || (error as any)?.status || 0);
        const msg = String((error as any)?.message || "").toLowerCase();
        const conflict = status === 409 || msg.includes("exist") || msg.includes("already");
        if (!conflict) throw error;
      }

      if (!movedPath) throw new Error("Não foi possível renomear: destino já existe.");

      setDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                id: movedPath,
                fileName: movedName,
                filePath: movedPath,
                displayName: extractDisplayName(movedName),
              }
            : d,
        ),
      );
      cancelRenameDoc();
      toast({ title: "Renomeado", description: "Nome do arquivo atualizado." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao renomear";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setRenamingDocId(null);
    }
  };

  const previewBulletinAttachment = async (b: TechnicalBulletin) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(b.attachment_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadBulletinAttachment = async (b: TechnicalBulletin) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(b.attachment_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = b.attachment_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteBulletin = async (b: TechnicalBulletin) => {
    try {
      setDeletingBulletinId(b.id);

      const { error: storageErr } = await supabase.storage.from("process-documents").remove([b.attachment_path]);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase.from("manufacturer_technical_bulletins").delete().eq("id", b.id);
      if (dbErr) throw dbErr;

      setBulletins((prev) => prev.filter((x) => x.id !== b.id));
      toast({ title: "Removido", description: "Boletim técnico excluído." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingBulletinId(null);
    }
  };

  const previewFispqAttachment = async (f: FispqRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(f.attachment_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadFispqAttachment = async (f: FispqRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(f.attachment_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = f.attachment_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteFispq = async (f: FispqRecord) => {
    try {
      setDeletingFispqId(f.id);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");
      const userId = userRes.user.id;

      const { error: storageErr } = await supabase.storage.from("process-documents").remove([f.attachment_path]);
      if (storageErr) throw storageErr;

      if (f.__local) {
        removeLocalFispq(userId, f.id);
        setFispqs((prev) => prev.filter((x) => x.id !== f.id));
        toast({ title: "Removido", description: "FISPQ excluída." });
        return;
      }

      const { error: dbErr } = await supabase.from("fispq_records").delete().eq("id", f.id);
      if (dbErr) throw dbErr;

      setFispqs((prev) => prev.filter((x) => x.id !== f.id));
      toast({ title: "Removido", description: "FISPQ excluída." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingFispqId(null);
    }
  };

  const previewCalibrationAttachment = async (c: CalibrationCertificate) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(c.attachment_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadCalibrationAttachment = async (c: CalibrationCertificate) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(c.attachment_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = c.attachment_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteCalibration = async (c: CalibrationCertificate) => {
    try {
      setDeletingCalibrationId(c.id);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");
      const userId = userRes.user.id;

      const { error: storageErr } = await supabase.storage.from("process-documents").remove([c.attachment_path]);
      if (storageErr) throw storageErr;

      if (c.__local) {
        removeLocalCalibration(userId, c.id);
        setCalibrations((prev) => prev.filter((x) => x.id !== c.id));
        toast({ title: "Removido", description: "Certificado excluído." });
        return;
      }

      const { error: dbErr } = await supabase.from("calibration_certificates").delete().eq("id", c.id);
      if (dbErr) throw dbErr;

      setCalibrations((prev) => prev.filter((x) => x.id !== c.id));
      toast({ title: "Removido", description: "Certificado excluído." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingCalibrationId(null);
    }
  };

  const previewIrrAttachment = async (r: IrrRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(r.attachment_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadIrrAttachment = async (r: IrrRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(r.attachment_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = r.attachment_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteIrr = async (r: IrrRecord) => {
    try {
      setDeletingIrrId(r.id);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");
      const userId = userRes.user.id;

      const { error: storageErr } = await supabase.storage.from("process-documents").remove([r.attachment_path]);
      if (storageErr) throw storageErr;

      if (r.__local) {
        removeLocalIrr(userId, r.id);
        setIrrs((prev) => prev.filter((x) => x.id !== r.id));
        toast({ title: "Removido", description: "IRR excluído." });
        return;
      }

      const { error: dbErr } = await supabase.from("irr_records").delete().eq("id", r.id);
      if (dbErr) throw dbErr;

      setIrrs((prev) => prev.filter((x) => x.id !== r.id));
      toast({ title: "Removido", description: "IRR excluído." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingIrrId(null);
    }
  };

  const previewTechnicalNoteAttachment = async (n: TechnicalNoteRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(n.attachment_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadTechnicalNoteAttachment = async (n: TechnicalNoteRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(n.attachment_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = n.attachment_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteTechnicalNote = async (n: TechnicalNoteRecord) => {
    try {
      setDeletingTechnicalNoteId(n.id);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");
      const userId = userRes.user.id;

      const { error: storageErr } = await supabase.storage.from("process-documents").remove([n.attachment_path]);
      if (storageErr) throw storageErr;

      if (n.__local) {
        removeLocalTechnicalNote(userId, n.id);
        setTechnicalNotes((prev) => prev.filter((x) => x.id !== n.id));
        toast({ title: "Removido", description: "Nota técnica excluída." });
        return;
      }

      const { error: dbErr } = await supabase.from("technical_notes").delete().eq("id", n.id);
      if (dbErr) throw dbErr;

      setTechnicalNotes((prev) => prev.filter((x) => x.id !== n.id));
      toast({ title: "Removido", description: "Nota técnica excluída." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingTechnicalNoteId(null);
    }
  };

  const previewSumulaAttachment = async (s: SumulaRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(s.attachment_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao visualizar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const downloadSumulaAttachment = async (s: SumulaRecord) => {
    try {
      const { data, error } = await supabase.storage.from("process-documents").download(s.attachment_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = s.attachment_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao baixar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const deleteSumula = async (s: SumulaRecord) => {
    try {
      setDeletingSumulaId(s.id);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");
      const userId = userRes.user.id;

      const { error: storageErr } = await supabase.storage.from("process-documents").remove([s.attachment_path]);
      if (storageErr) throw storageErr;

      if (s.__local) {
        removeLocalSumula(userId, s.id);
        setSumulas((prev) => prev.filter((x) => x.id !== s.id));
        toast({ title: "Removido", description: "Súmula excluída." });
        return;
      }

      const { error: dbErr } = await supabase.from("sumula_records").delete().eq("id", s.id);
      if (dbErr) throw dbErr;

      setSumulas((prev) => prev.filter((x) => x.id !== s.id));
      toast({ title: "Removido", description: "Súmula excluída." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setDeletingSumulaId(null);
    }
  };

  const discardFispqDraft = async () => {
    const attachmentPath = String(fispqDraft.attachment_path || "").trim();
    try {
      if (attachmentPath) {
        await supabase.storage.from("process-documents").remove([attachmentPath]);
      }
    } finally {
      setFispqDraft({
        product_identification: "",
        hazard_identification: "",
        composition: "",
        nr15_annex: "",
        tolerance_limit: "",
        skin_absorption_risk: "",
        flash_point: "",
        protection_measures_required: "",
        attachment_path: "",
        attachment_name: "",
        extracted_text: "",
      });
    }
  };

  const saveFispqDraft = async () => {
    const product = fispqDraft.product_identification.trim();
    const attachmentPath = fispqDraft.attachment_path.trim();
    const attachmentName = fispqDraft.attachment_name.trim();

    if (!attachmentPath || !attachmentName) {
      toast({ title: "Anexo obrigatório", description: "Anexe o documento da FISPQ para salvar.", variant: "destructive" });
      return;
    }

    if (!product) {
      toast({ title: "Campo obrigatório", description: "Preencha Identificação do produto.", variant: "destructive" });
      return;
    }

    setSavingFispq(true);
    let userId: string | null = null;
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

      userId = userRes.user.id;

      const ownerId = materialOwnerId || userId;

      const vOrNull = (v: string) => {
        const s = String(v || "").trim();
        return s ? s : null;
      };

      const localRecord: FispqRecord = {
        id: (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random()}`,
        product_identification: vOrNull(fispqDraft.product_identification),
        hazard_identification: vOrNull(fispqDraft.hazard_identification),
        composition: vOrNull(fispqDraft.composition),
        nr15_annex: vOrNull(fispqDraft.nr15_annex),
        tolerance_limit: vOrNull(fispqDraft.tolerance_limit),
        skin_absorption_risk: vOrNull(fispqDraft.skin_absorption_risk),
        flash_point: vOrNull(fispqDraft.flash_point),
        protection_measures_required: vOrNull(fispqDraft.protection_measures_required),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        extracted_text: vOrNull(fispqDraft.extracted_text),
        created_at: new Date().toISOString(),
        __local: true,
      };

      if (missingFispqTableWarned) {
        const nextLocal = addLocalFispq(userId, localRecord);
        setFispqs(nextLocal);
        toast({
          title: "Salvo localmente",
          description: "A tabela fispq_records ainda não está disponível no Supabase. A FISPQ foi registrada localmente e será sincronizada quando a tabela existir.",
        });
        setFispqDraft({
          product_identification: "",
          hazard_identification: "",
          composition: "",
          nr15_annex: "",
          tolerance_limit: "",
          skin_absorption_risk: "",
          flash_point: "",
          protection_measures_required: "",
          attachment_path: "",
          attachment_name: "",
          extracted_text: "",
        });
        return;
      }

      const { error: preErr } = await supabase.from("fispq_records").select("id", { head: true }).limit(1);
      if (preErr) {
        const status = Number((preErr as any)?.status || (preErr as any)?.statusCode || 0);
        if (status === 404) {
          setMissingFispqTableWarned(true);
          try {
            localStorage.setItem("missing_table_fispq_records", "1");
          } catch {
          }
          const nextLocal = addLocalFispq(userId, localRecord);
          setFispqs(nextLocal);
          toast({
            title: "Salvo localmente",
            description: "A tabela fispq_records não existe no Supabase. A FISPQ foi registrada localmente e será sincronizada quando a migration for aplicada.",
          });
          setFispqDraft({
            product_identification: "",
            hazard_identification: "",
            composition: "",
            nr15_annex: "",
            tolerance_limit: "",
            skin_absorption_risk: "",
            flash_point: "",
            protection_measures_required: "",
            attachment_path: "",
            attachment_name: "",
            extracted_text: "",
          });
          return;
        }
        throw preErr;
      }

      const { error } = await supabase.from("fispq_records").insert({
        user_id: ownerId,
        product_identification: vOrNull(fispqDraft.product_identification),
        hazard_identification: vOrNull(fispqDraft.hazard_identification),
        composition: vOrNull(fispqDraft.composition),
        nr15_annex: vOrNull(fispqDraft.nr15_annex),
        tolerance_limit: vOrNull(fispqDraft.tolerance_limit),
        skin_absorption_risk: vOrNull(fispqDraft.skin_absorption_risk),
        flash_point: vOrNull(fispqDraft.flash_point),
        protection_measures_required: vOrNull(fispqDraft.protection_measures_required),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        extracted_text: vOrNull(fispqDraft.extracted_text),
      });

      if (error) throw error;

      toast({ title: "Salvo", description: "FISPQ cadastrada." });
      setFispqDraft({
        product_identification: "",
        hazard_identification: "",
        composition: "",
        nr15_annex: "",
        tolerance_limit: "",
        skin_absorption_risk: "",
        flash_point: "",
        protection_measures_required: "",
        attachment_path: "",
        attachment_name: "",
        extracted_text: "",
      });
      await fetchFispqs({ force: true });
    } catch (e) {
      const anyErr = e as any;
      const status = Number(anyErr?.status || anyErr?.statusCode || anyErr?.cause?.status || 0);
      const rawMessage =
        typeof anyErr?.message === "string"
          ? anyErr.message
          : typeof anyErr?.error === "string"
            ? anyErr.error
            : "Erro ao salvar FISPQ";

      if (status === 404) {
        if (!missingFispqTableWarned) {
          setMissingFispqTableWarned(true);
          try {
            localStorage.setItem("missing_table_fispq_records", "1");
          } catch {
          }
        }

        if (userId) {
          const vOrNull = (v: string) => {
            const s = String(v || "").trim();
            return s ? s : null;
          };
          const localRecord: FispqRecord = {
            id: (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random()}`,
            product_identification: vOrNull(fispqDraft.product_identification),
            hazard_identification: vOrNull(fispqDraft.hazard_identification),
            composition: vOrNull(fispqDraft.composition),
            nr15_annex: vOrNull(fispqDraft.nr15_annex),
            tolerance_limit: vOrNull(fispqDraft.tolerance_limit),
            skin_absorption_risk: vOrNull(fispqDraft.skin_absorption_risk),
            flash_point: vOrNull(fispqDraft.flash_point),
            protection_measures_required: vOrNull(fispqDraft.protection_measures_required),
            attachment_path: attachmentPath,
            attachment_name: attachmentName,
            extracted_text: vOrNull(fispqDraft.extracted_text),
            created_at: new Date().toISOString(),
            __local: true,
          };
          const nextLocal = addLocalFispq(userId, localRecord);
          setFispqs(nextLocal);
          setFispqDraft({
            product_identification: "",
            hazard_identification: "",
            composition: "",
            nr15_annex: "",
            tolerance_limit: "",
            skin_absorption_risk: "",
            flash_point: "",
            protection_measures_required: "",
            attachment_path: "",
            attachment_name: "",
            extracted_text: "",
          });
          toast({
            title: "Salvo localmente",
            description: "O Supabase retornou 404 para fispq_records. A FISPQ foi registrada localmente e será sincronizada quando a migration for aplicada.",
          });
        } else {
          toast({
            title: "Tabela não encontrada",
            description: "O endpoint /rest/v1/fispq_records retornou 404. Aplique a migration 20260112000003_fispq_records.sql no Supabase.",
            variant: "destructive",
          });
        }
      } else if (status === 401 || status === 403 || /no api key/i.test(rawMessage)) {
        toast({
          title: "Sem credenciais",
          description: "Recarregue a página e faça login novamente. Se persistir, verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro", description: rawMessage, variant: "destructive" });
      }
    } finally {
      setSavingFispq(false);
    }
  };

  const pathPrefix = useMemo(() => {
    return `material-consulta/${sanitizePathSegment(theme)}`;
  }, [theme]);

  const getTargetFileName = useCallback(
    (file: File) => {
      const ext = (() => {
        const idx = file.name.lastIndexOf(".");
        return idx >= 0 ? file.name.slice(idx) : "";
      })();

      const baseRaw = String(customName || "").trim();
      const baseNoExt = baseRaw ? baseRaw.replace(/\.[^/.]+$/, "") : file.name.replace(/\.[^/.]+$/, "");
      return `${baseNoExt}${ext}`;
    },
    [customName],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-4 space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Material de Consulta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
              <TabsList>
                <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
                <TabsTrigger value="boletins">Boletins técnicos</TabsTrigger>
                <TabsTrigger value="fispq">FISPQ</TabsTrigger>
                <TabsTrigger value="calibracao">Certificado de calibração</TabsTrigger>
                <TabsTrigger value="irr">IRR</TabsTrigger>
                <TabsTrigger value="nota-tecnica">Nota Técnica</TabsTrigger>
                <TabsTrigger value="sumula">Súmula</TabsTrigger>
              </TabsList>

              <TabsContent value="arquivos" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tema">Tema</Label>
                    <div className="relative">
                      <Folder className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="tema"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="pl-9"
                        placeholder="Ex: Normas, Jurisprudência, Modelos"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nome">Nome do arquivo (opcional)</Label>
                    <Input
                      id="nome"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex: NR-15 Anexo 13 (Agentes Químicos)"
                    />
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix={pathPrefix}
                  getTargetFileName={getTargetFileName}
                  acceptedFileTypes={[
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "image/jpeg",
                    "image/png",
                    "image/jpg",
                    "text/plain",
                  ]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={false}
                  onUploadComplete={async () => {
                    setCustomName("");
                    await fetchDocs();
                  }}
                />
              </TabsContent>

              <TabsContent value="boletins" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulletin-epi">EPI</Label>
                    <Input
                      id="bulletin-epi"
                      value={bulletinDraft.epi}
                      onChange={(e) => setBulletinDraft((p) => ({ ...p, epi: e.target.value }))}
                      placeholder="Ex.: Protetor auricular"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulletin-ca">CA</Label>
                    <Input
                      id="bulletin-ca"
                      value={bulletinDraft.ca}
                      onChange={(e) => setBulletinDraft((p) => ({ ...p, ca: e.target.value }))}
                      placeholder="Ex.: 12345"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulletin-protection">Tipo de proteção</Label>
                    <Input
                      id="bulletin-protection"
                      value={bulletinDraft.protection_type}
                      onChange={(e) => setBulletinDraft((p) => ({ ...p, protection_type: e.target.value }))}
                      placeholder="Ex.: Auditiva"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulletin-lifetime">Vida útil estimada</Label>
                    <Input
                      id="bulletin-lifetime"
                      value={bulletinDraft.estimated_lifetime}
                      onChange={(e) => setBulletinDraft((p) => ({ ...p, estimated_lifetime: e.target.value }))}
                      placeholder="Ex.: 6 meses, 2 anos, 10.000 h"
                    />
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix="boletins-tecnicos"
                  acceptedFileTypes={[
                    "application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "image/*",
                  ]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={false}
                  onUploadComplete={async (attachmentPath, attachmentName) => {
                    const epi = bulletinDraft.epi.trim();
                    const ca = bulletinDraft.ca.trim();
                    const protectionType = bulletinDraft.protection_type.trim();
                    const estimatedLifetime = bulletinDraft.estimated_lifetime.trim();

                    if (!epi || !ca || !protectionType) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha EPI, CA e Tipo de proteção antes de anexar.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const { data: userRes, error: userErr } = await supabase.auth.getUser();
                    if (userErr || !userRes.user) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
                      return;
                    }

                    const ownerId = materialOwnerId || userRes.user.id;

                    const { error } = await supabase.from("manufacturer_technical_bulletins").insert({
                      user_id: ownerId,
                      epi,
                      ca,
                      protection_type: protectionType,
                      estimated_lifetime: estimatedLifetime ? estimatedLifetime : null,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                    });

                    if (error) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: error.message, variant: "destructive" });
                      return;
                    }

                    setBulletinDraft({ epi: "", ca: "", protection_type: "", estimated_lifetime: "" });
                    await fetchBulletins({ force: true });
                  }}
                />
              </TabsContent>

              <TabsContent value="fispq" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fispq-product">Identificação do produto</Label>
                    <Input
                      id="fispq-product"
                      value={fispqDraft.product_identification}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, product_identification: e.target.value }))}
                      placeholder="Ex.: Tolueno, Álcool etílico"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Catalogado no anexo 11 / 13 da NR-15</Label>
                    <Select
                      value={fispqDraft.nr15_annex || "none"}
                      onValueChange={(v) => setFispqDraft((p) => ({ ...p, nr15_annex: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="11">Anexo 11</SelectItem>
                        <SelectItem value="13">Anexo 13</SelectItem>
                        <SelectItem value="11 e 13">Anexo 11 e 13</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fispq-hazard">Identificação de perigo</Label>
                    <Textarea
                      id="fispq-hazard"
                      value={fispqDraft.hazard_identification}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, hazard_identification: e.target.value }))}
                      className="min-h-[110px]"
                      placeholder="Perigos, frases H/P, pictogramas, etc."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fispq-composition">Composição</Label>
                    <Textarea
                      id="fispq-composition"
                      value={fispqDraft.composition}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, composition: e.target.value }))}
                      className="min-h-[110px]"
                      placeholder="Ingredientes, CAS, concentrações, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fispq-tolerance">Limite de tolerância</Label>
                    <Input
                      id="fispq-tolerance"
                      value={fispqDraft.tolerance_limit}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, tolerance_limit: e.target.value }))}
                      placeholder="Ex.: TLV-TWA 20 ppm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fispq-skin">Risco de absorção pela pele</Label>
                    <Input
                      id="fispq-skin"
                      value={fispqDraft.skin_absorption_risk}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, skin_absorption_risk: e.target.value }))}
                      placeholder="Ex.: Sim (via cutânea)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fispq-flash">Ponto de fulgor</Label>
                    <Input
                      id="fispq-flash"
                      value={fispqDraft.flash_point}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, flash_point: e.target.value }))}
                      placeholder="Ex.: 12°C"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fispq-protection">Medida de proteção requerida</Label>
                    <Textarea
                      id="fispq-protection"
                      value={fispqDraft.protection_measures_required}
                      onChange={(e) => setFispqDraft((p) => ({ ...p, protection_measures_required: e.target.value }))}
                      className="min-h-[110px]"
                      placeholder="Ex.: EPI/EPC, proteção respiratória, luvas, óculos, ventilação local, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Documento (compacto)</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={fispqDraft.attachment_path ? "default" : "secondary"}>
                        {fispqDraft.attachment_name ? fispqDraft.attachment_name : "Nenhum anexo"}
                      </Badge>
                      {fispqDraft.attachment_path ? (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={saveFispqDraft} disabled={savingFispq}>
                            {savingFispq ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={discardFispqDraft} disabled={savingFispq}>
                            Descartar
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix="fispq"
                  acceptedFileTypes={[
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "text/plain",
                    "application/zip",
                    "application/x-zip-compressed",
                  ]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={true}
                  onUploadComplete={async (attachmentPath, attachmentName, extractedText) => {
                    const parsed = extractedText ? parseFispqFromText(extractedText) : null;
                    setFispqDraft((p) => {
                      const next = {
                        ...p,
                        attachment_path: attachmentPath,
                        attachment_name: attachmentName,
                        extracted_text: extractedText ? extractedText : p.extracted_text,
                      };
                      if (!parsed) return next;
                      return {
                        ...next,
                        product_identification: next.product_identification.trim()
                          ? next.product_identification
                          : parsed.product_identification || next.product_identification,
                        hazard_identification: next.hazard_identification.trim()
                          ? next.hazard_identification
                          : parsed.hazard_identification || next.hazard_identification,
                        composition: next.composition.trim() ? next.composition : parsed.composition || next.composition,
                        nr15_annex: next.nr15_annex.trim() ? next.nr15_annex : parsed.nr15_annex || next.nr15_annex,
                        tolerance_limit: next.tolerance_limit.trim()
                          ? next.tolerance_limit
                          : parsed.tolerance_limit || next.tolerance_limit,
                        skin_absorption_risk: next.skin_absorption_risk.trim()
                          ? next.skin_absorption_risk
                          : parsed.skin_absorption_risk || next.skin_absorption_risk,
                        flash_point: next.flash_point.trim() ? next.flash_point : parsed.flash_point || next.flash_point,
                        protection_measures_required: next.protection_measures_required.trim()
                          ? next.protection_measures_required
                          : parsed.protection_measures_required || next.protection_measures_required,
                      };
                    });
                  }}
                />
              </TabsContent>

              <TabsContent value="calibracao" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calibration-equipment">Nome do equipamento</Label>
                    <Input
                      id="calibration-equipment"
                      value={calibrationDraft.equipment_name}
                      onChange={(e) => setCalibrationDraft((p) => ({ ...p, equipment_name: e.target.value }))}
                      placeholder="Ex.: Dosímetro, Decibelímetro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="calibration-model">Modelo</Label>
                    <Input
                      id="calibration-model"
                      value={calibrationDraft.model}
                      onChange={(e) => setCalibrationDraft((p) => ({ ...p, model: e.target.value }))}
                      placeholder="Ex.: 01dB, 824"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="calibration-manufacturer">Fabricante</Label>
                    <Input
                      id="calibration-manufacturer"
                      value={calibrationDraft.manufacturer}
                      onChange={(e) => setCalibrationDraft((p) => ({ ...p, manufacturer: e.target.value }))}
                      placeholder="Ex.: 3M, Brüel & Kjær"
                    />
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix="calibracao"
                  acceptedFileTypes={["application/pdf"]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={false}
                  onUploadComplete={async (attachmentPath, attachmentName) => {
                    const equipmentName = calibrationDraft.equipment_name.trim();
                    const model = calibrationDraft.model.trim();
                    const manufacturer = calibrationDraft.manufacturer.trim();

                    if (!equipmentName || !model || !manufacturer) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha Nome do equipamento, Modelo e Fabricante antes de anexar.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const { data: userRes, error: userErr } = await supabase.auth.getUser();
                    if (userErr || !userRes.user) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
                      return;
                    }

                    const userId = userRes.user.id;
                    const ownerId = materialOwnerId || userId;

                    const localRecord: CalibrationCertificate = {
                      id: (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random()}`,
                      equipment_name: equipmentName,
                      model,
                      manufacturer,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                      created_at: new Date().toISOString(),
                      __local: true,
                    };

                    if (missingCalibrationTableWarned) {
                      const nextLocal = addLocalCalibration(userId, localRecord);
                      setCalibrations(nextLocal);
                      toast({
                        title: "Salvo localmente",
                        description:
                          "A tabela calibration_certificates ainda não está disponível no Supabase. O certificado foi registrado localmente e será sincronizado quando a tabela existir.",
                      });
                      setCalibrationDraft({ equipment_name: "", model: "", manufacturer: "" });
                      return;
                    }

                    const { error: preErr } = await supabase
                      .from("calibration_certificates")
                      .select("id", { head: true })
                      .limit(1);

                    if (preErr) {
                      const status = Number((preErr as any)?.status || (preErr as any)?.statusCode || 0);
                      if (status === 404) {
                        setMissingCalibrationTableWarned(true);
                        try {
                          localStorage.setItem("missing_table_calibration_certificates", "1");
                        } catch {
                        }
                        const nextLocal = addLocalCalibration(userId, localRecord);
                        setCalibrations(nextLocal);
                        toast({
                          title: "Salvo localmente",
                          description:
                            "A tabela calibration_certificates não existe no Supabase. O certificado foi registrado localmente e será sincronizado quando a migration 20260126000001_calibration_certificates.sql for aplicada.",
                        });
                        setCalibrationDraft({ equipment_name: "", model: "", manufacturer: "" });
                        return;
                      }
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: preErr.message, variant: "destructive" });
                      return;
                    }

                    const { error } = await supabase.from("calibration_certificates").insert({
                      user_id: ownerId,
                      equipment_name: equipmentName,
                      model,
                      manufacturer,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                    });

                    if (error) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: error.message, variant: "destructive" });
                      return;
                    }

                    setCalibrationDraft({ equipment_name: "", model: "", manufacturer: "" });
                    await fetchCalibrations({ force: true });
                  }}
                />
              </TabsContent>

              <TabsContent value="irr" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="irr-representative">Representativo da controvérsia</Label>
                    <Input
                      id="irr-representative"
                      value={irrDraft.representative_controversy}
                      onChange={(e) => setIrrDraft((p) => ({ ...p, representative_controversy: e.target.value }))}
                      placeholder="Ex.: IRR Tema 0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Select value={irrDraft.theme_type || "none"} onValueChange={(v) => setIrrDraft((p) => ({ ...p, theme_type: v === "none" ? "" : (v as any) }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        <SelectItem value="insalubridade">Insalubridade</SelectItem>
                        <SelectItem value="periculosidade">Periculosidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="irr-legal-thesis">Tese / Questão Jurídica</Label>
                    <Textarea
                      id="irr-legal-thesis"
                      value={irrDraft.legal_thesis}
                      onChange={(e) => setIrrDraft((p) => ({ ...p, legal_thesis: e.target.value }))}
                      className="min-h-[160px]"
                      placeholder="Descreva a tese ou questão jurídica"
                    />
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix="irr"
                  acceptedFileTypes={["application/pdf"]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={false}
                  onUploadComplete={async (attachmentPath, attachmentName) => {
                    const representativeControversy = irrDraft.representative_controversy.trim();
                    const themeType = irrDraft.theme_type;
                    const legalThesis = irrDraft.legal_thesis.trim();

                    if (!representativeControversy || !themeType || !legalThesis) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha Representativo da controvérsia, Tema e Tese/Questão Jurídica antes de anexar.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const { data: userRes, error: userErr } = await supabase.auth.getUser();
                    if (userErr || !userRes.user) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
                      return;
                    }

                    const userId = userRes.user.id;
                    const ownerId = materialOwnerId || userId;

                    const localRecord: IrrRecord = {
                      id: (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random()}`,
                      representative_controversy: representativeControversy,
                      theme_type: themeType,
                      legal_thesis: legalThesis,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                      created_at: new Date().toISOString(),
                      __local: true,
                    };

                    if (missingIrrTableWarned) {
                      const nextLocal = addLocalIrr(userId, localRecord);
                      setIrrs(nextLocal);
                      toast({
                        title: "Salvo localmente",
                        description:
                          "A tabela irr_records ainda não está disponível no Supabase. O IRR foi registrado localmente e será sincronizado quando a tabela existir.",
                      });
                      setIrrDraft({ representative_controversy: "", theme_type: "", legal_thesis: "" });
                      return;
                    }

                    const { error: preErr } = await supabase.from("irr_records").select("id", { head: true }).limit(1);
                    if (preErr) {
                      const status = Number((preErr as any)?.status || (preErr as any)?.statusCode || 0);
                      if (status === 404) {
                        setMissingIrrTableWarned(true);
                        try {
                          localStorage.setItem("missing_table_irr_records", "1");
                        } catch {
                        }
                        const nextLocal = addLocalIrr(userId, localRecord);
                        setIrrs(nextLocal);
                        toast({
                          title: "Salvo localmente",
                          description:
                            "A tabela irr_records não existe no Supabase. O IRR foi registrado localmente e será sincronizado quando a migration 20260126000002_irr_records.sql for aplicada.",
                        });
                        setIrrDraft({ representative_controversy: "", theme_type: "", legal_thesis: "" });
                        return;
                      }

                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: preErr.message, variant: "destructive" });
                      return;
                    }

                    const { error } = await supabase.from("irr_records").insert({
                      user_id: ownerId,
                      representative_controversy: representativeControversy,
                      theme_type: themeType,
                      legal_thesis: legalThesis,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                    });

                    if (error) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: error.message, variant: "destructive" });
                      return;
                    }

                    setIrrDraft({ representative_controversy: "", theme_type: "", legal_thesis: "" });
                    await fetchIrrs({ force: true });
                  }}
                />
              </TabsContent>

              <TabsContent value="nota-tecnica" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="technical-note-subject">Assunto</Label>
                    <Input
                      id="technical-note-subject"
                      value={technicalNoteDraft.subject}
                      onChange={(e) => setTechnicalNoteDraft((p) => ({ ...p, subject: e.target.value }))}
                      placeholder="Ex.: Critério de enquadramento, metodologia"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="technical-note-body">Nota técnica</Label>
                    <Textarea
                      id="technical-note-body"
                      value={technicalNoteDraft.technical_note}
                      onChange={(e) => setTechnicalNoteDraft((p) => ({ ...p, technical_note: e.target.value }))}
                      className="min-h-[160px]"
                      placeholder="Descreva a nota técnica"
                    />
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix="nota-tecnica"
                  acceptedFileTypes={["application/pdf"]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={false}
                  onUploadComplete={async (attachmentPath, attachmentName) => {
                    const subject = technicalNoteDraft.subject.trim();
                    const technicalNote = technicalNoteDraft.technical_note.trim();

                    if (!subject || !technicalNote) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha Assunto e Nota técnica antes de anexar.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const { data: userRes, error: userErr } = await supabase.auth.getUser();
                    if (userErr || !userRes.user) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
                      return;
                    }

                    const userId = userRes.user.id;
                    const ownerId = materialOwnerId || userId;

                    const localRecord: TechnicalNoteRecord = {
                      id: (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random()}`,
                      subject,
                      technical_note: technicalNote,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                      created_at: new Date().toISOString(),
                      __local: true,
                    };

                    if (missingTechnicalNotesTableWarned) {
                      const nextLocal = addLocalTechnicalNote(userId, localRecord);
                      setTechnicalNotes(nextLocal);
                      toast({
                        title: "Salvo localmente",
                        description:
                          "A tabela technical_notes ainda não está disponível no Supabase. A nota técnica foi registrada localmente e será sincronizada quando a tabela existir.",
                      });
                      setTechnicalNoteDraft({ subject: "", technical_note: "" });
                      return;
                    }

                    const { error: preErr } = await supabase.from("technical_notes").select("id", { head: true }).limit(1);
                    if (preErr) {
                      const status = Number((preErr as any)?.status || (preErr as any)?.statusCode || 0);
                      if (status === 404) {
                        setMissingTechnicalNotesTableWarned(true);
                        try {
                          localStorage.setItem("missing_table_technical_notes", "1");
                        } catch {
                        }
                        const nextLocal = addLocalTechnicalNote(userId, localRecord);
                        setTechnicalNotes(nextLocal);
                        toast({
                          title: "Salvo localmente",
                          description:
                            "A tabela technical_notes não existe no Supabase. A nota técnica foi registrada localmente e será sincronizada quando a migration 20260126000003_technical_notes.sql for aplicada.",
                        });
                        setTechnicalNoteDraft({ subject: "", technical_note: "" });
                        return;
                      }

                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: preErr.message, variant: "destructive" });
                      return;
                    }

                    const { error } = await supabase.from("technical_notes").insert({
                      user_id: ownerId,
                      subject,
                      technical_note: technicalNote,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                    });

                    if (error) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: error.message, variant: "destructive" });
                      return;
                    }

                    setTechnicalNoteDraft({ subject: "", technical_note: "" });
                    await fetchTechnicalNotes({ force: true });
                  }}
                />
              </TabsContent>

              <TabsContent value="sumula" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sumula-number">Número da súmula</Label>
                    <Input
                      id="sumula-number"
                      value={sumulaDraft.sumula_number}
                      onChange={(e) => setSumulaDraft((p) => ({ ...p, sumula_number: e.target.value }))}
                      placeholder="Ex.: 331"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="sumula-legal-issue">Assunto / questão jurídica</Label>
                    <Textarea
                      id="sumula-legal-issue"
                      value={sumulaDraft.legal_issue}
                      onChange={(e) => setSumulaDraft((p) => ({ ...p, legal_issue: e.target.value }))}
                      className="min-h-[130px]"
                      placeholder="Descreva o tema/questão jurídica"
                    />
                  </div>
                </div>

                <FileUpload
                  bucketName="process-documents"
                  targetUserId={materialOwnerId || undefined}
                  pathPrefix="sumula"
                  acceptedFileTypes={["application/pdf"]}
                  maxFileSize={50 * 1024 * 1024}
                  multiple={false}
                  enableTextExtraction={false}
                  onUploadComplete={async (attachmentPath, attachmentName) => {
                    const sumulaNumber = sumulaDraft.sumula_number.trim();
                    const legalIssue = sumulaDraft.legal_issue.trim();

                    if (!sumulaNumber || !legalIssue) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha Número da súmula e Assunto / questão jurídica antes de anexar.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const { data: userRes, error: userErr } = await supabase.auth.getUser();
                    if (userErr || !userRes.user) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
                      return;
                    }

                    const userId = userRes.user.id;
                    const ownerId = materialOwnerId || userId;

                    const localRecord: SumulaRecord = {
                      id: (globalThis.crypto as any)?.randomUUID
                        ? (globalThis.crypto as any).randomUUID()
                        : `${Date.now()}_${Math.random()}`,
                      sumula_number: sumulaNumber,
                      legal_issue: legalIssue,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                      created_at: new Date().toISOString(),
                      __local: true,
                    };

                    if (missingSumulaTableWarned) {
                      const nextLocal = addLocalSumula(userId, localRecord);
                      setSumulas(nextLocal);
                      toast({
                        title: "Salvo localmente",
                        description:
                          "A tabela sumula_records ainda não está disponível no Supabase. A súmula foi registrada localmente e será sincronizada quando a tabela existir.",
                      });
                      setSumulaDraft({ sumula_number: "", legal_issue: "" });
                      return;
                    }

                    const { error: preErr } = await supabase.from("sumula_records").select("id", { head: true }).limit(1);
                    if (preErr) {
                      const status = Number((preErr as any)?.status || (preErr as any)?.statusCode || 0);
                      if (status === 404) {
                        setMissingSumulaTableWarned(true);
                        try {
                          localStorage.setItem("missing_table_sumula_records", "1");
                        } catch {
                        }
                        const nextLocal = addLocalSumula(userId, localRecord);
                        setSumulas(nextLocal);
                        toast({
                          title: "Salvo localmente",
                          description:
                            "A tabela sumula_records não existe no Supabase. A súmula foi registrada localmente e será sincronizada quando a migration 20260126000004_sumula_records.sql for aplicada.",
                        });
                        setSumulaDraft({ sumula_number: "", legal_issue: "" });
                        return;
                      }

                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: preErr.message, variant: "destructive" });
                      return;
                    }

                    const { error } = await supabase.from("sumula_records").insert({
                      user_id: ownerId,
                      sumula_number: sumulaNumber,
                      legal_issue: legalIssue,
                      attachment_path: attachmentPath,
                      attachment_name: attachmentName,
                    });

                    if (error) {
                      await supabase.storage.from("process-documents").remove([attachmentPath]);
                      toast({ title: "Erro", description: error.message, variant: "destructive" });
                      return;
                    }

                    setSumulaDraft({ sumula_number: "", legal_issue: "" });
                    await fetchSumulas({ force: true });
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {activeTab === "arquivos" ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por tema ou nome"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredDocs.length} arquivo(s)</Badge>
                <Button variant="outline" onClick={fetchDocs} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {loading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : grouped.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhum material cadastrado.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {grouped.map(([t, list]) => (
                  <Card key={t} className="shadow-card">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Folder className="w-5 h-5" />
                          {t}
                        </span>
                        <Badge variant="secondary">{list.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {list.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                          >
                            <div className="min-w-0 flex-1">
                              {editingDocId === doc.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingDocName}
                                    onChange={(e) => setEditingDocName(e.target.value)}
                                    placeholder="Nome do arquivo"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={renamingDocId === doc.id}
                                    onClick={() => saveRenameDoc(doc)}
                                    title="Salvar"
                                  >
                                    {renamingDocId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={renamingDocId === doc.id} onClick={cancelRenameDoc} title="Cancelar">
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="font-medium truncate">{doc.displayName}</div>
                              )}
                              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                                <span>{formatFileSize(doc.fileSize)}</span>
                                <span>•</span>
                                <span>{new Date(doc.createdAt).toLocaleDateString("pt-BR")}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={editingDocId === doc.id || renamingDocId === doc.id}
                                onClick={() => startRenameDoc(doc)}
                                title="Renomear"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => previewDoc(doc)} title="Visualizar">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc)} title="Baixar">
                                <Download className="w-4 h-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={deletingPath === doc.filePath}
                                    title="Excluir"
                                  >
                                    {deletingPath === doc.filePath ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir "{doc.displayName}"?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteDoc(doc)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "boletins" ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={bulletinQuery}
                  onChange={(e) => setBulletinQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por EPI, CA, tipo ou vida útil"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredBulletins.length} boletim(ns)</Badge>
                <Button variant="outline" onClick={() => fetchBulletins({ force: true })} disabled={bulletinLoading}>
                  {bulletinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {bulletinLoading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : filteredBulletins.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhum boletim cadastrado.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBulletins.map((b) => (
                  <Card key={b.id} className="shadow-card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{b.epi}</div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                            <span>CA: {b.ca}</span>
                            <span>•</span>
                            <span>{b.protection_type}</span>
                            {b.estimated_lifetime ? (
                              <>
                                <span>•</span>
                                <span>Vida útil: {b.estimated_lifetime}</span>
                              </>
                            ) : null}
                            <span>•</span>
                            <span>{new Date(b.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{b.attachment_name}</div>
                        </div>

                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => previewBulletinAttachment(b)} title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadBulletinAttachment(b)} title="Baixar">
                            <Download className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deletingBulletinId === b.id}
                                title="Excluir"
                              >
                                {deletingBulletinId === b.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o boletim "{b.epi}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteBulletin(b)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "calibracao" ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={calibrationQuery}
                  onChange={(e) => setCalibrationQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por equipamento, modelo, fabricante ou arquivo"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredCalibrations.length} certificado(s)</Badge>
                <Button variant="outline" onClick={() => fetchCalibrations({ force: true })} disabled={calibrationLoading}>
                  {calibrationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {calibrationLoading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : filteredCalibrations.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhum certificado cadastrado.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredCalibrations.map((c) => (
                  <Card key={c.id} className="shadow-card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.equipment_name}</div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                            <span>Modelo: {c.model}</span>
                            <span>•</span>
                            <span>{c.manufacturer}</span>
                            <span>•</span>
                            <span>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                            {c.__local ? (
                              <>
                                <span>•</span>
                                <Badge variant="outline">Local</Badge>
                              </>
                            ) : null}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{c.attachment_name}</div>
                        </div>

                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => previewCalibrationAttachment(c)} title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadCalibrationAttachment(c)} title="Baixar">
                            <Download className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={deletingCalibrationId === c.id} title="Excluir">
                                {deletingCalibrationId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o certificado "{c.equipment_name}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteCalibration(c)} className="bg-red-600 hover:bg-red-700">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "irr" ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={irrQuery}
                  onChange={(e) => setIrrQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por controvérsia, tema, tese ou arquivo"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredIrrs.length} IRR(s)</Badge>
                <Button variant="outline" onClick={() => fetchIrrs({ force: true })} disabled={irrLoading}>
                  {irrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {irrLoading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : filteredIrrs.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhum IRR cadastrado.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredIrrs.map((r) => (
                  <Card key={r.id} className="shadow-card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{r.representative_controversy}</div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                            <span>{r.theme_type === "insalubridade" ? "Insalubridade" : "Periculosidade"}</span>
                            <span>•</span>
                            <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                            {r.__local ? (
                              <>
                                <span>•</span>
                                <Badge variant="outline">Local</Badge>
                              </>
                            ) : null}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{r.legal_thesis}</div>
                          <div className="text-sm text-muted-foreground truncate">{r.attachment_name}</div>
                        </div>

                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => previewIrrAttachment(r)} title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadIrrAttachment(r)} title="Baixar">
                            <Download className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={deletingIrrId === r.id} title="Excluir">
                                {deletingIrrId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o IRR "{r.representative_controversy}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteIrr(r)} className="bg-red-600 hover:bg-red-700">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "nota-tecnica" ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={technicalNoteQuery}
                  onChange={(e) => setTechnicalNoteQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por assunto, nota ou arquivo"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredTechnicalNotes.length} nota(s)</Badge>
                <Button variant="outline" onClick={() => fetchTechnicalNotes({ force: true })} disabled={technicalNotesLoading}>
                  {technicalNotesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {technicalNotesLoading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : filteredTechnicalNotes.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhuma nota técnica cadastrada.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredTechnicalNotes.map((n) => (
                  <Card key={n.id} className="shadow-card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{n.subject}</div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                            <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                            {n.__local ? (
                              <>
                                <span>•</span>
                                <Badge variant="outline">Local</Badge>
                              </>
                            ) : null}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{n.technical_note}</div>
                          <div className="text-sm text-muted-foreground truncate">{n.attachment_name}</div>
                        </div>

                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => previewTechnicalNoteAttachment(n)} title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadTechnicalNoteAttachment(n)} title="Baixar">
                            <Download className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={deletingTechnicalNoteId === n.id} title="Excluir">
                                {deletingTechnicalNoteId === n.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a nota técnica "{n.subject}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTechnicalNote(n)} className="bg-red-600 hover:bg-red-700">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "sumula" ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={sumulaQuery}
                  onChange={(e) => setSumulaQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por número, assunto ou arquivo"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredSumulas.length} súmula(s)</Badge>
                <Button variant="outline" onClick={() => fetchSumulas({ force: true })} disabled={sumulasLoading}>
                  {sumulasLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {sumulasLoading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : filteredSumulas.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhuma súmula cadastrada.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredSumulas.map((s) => (
                  <Card key={s.id} className="shadow-card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">Súmula {s.sumula_number}</div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                            <span>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                            {s.__local ? (
                              <>
                                <span>•</span>
                                <Badge variant="outline">Local</Badge>
                              </>
                            ) : null}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{s.legal_issue}</div>
                          <div className="text-sm text-muted-foreground truncate">{s.attachment_name}</div>
                        </div>

                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => previewSumulaAttachment(s)} title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadSumulaAttachment(s)} title="Baixar">
                            <Download className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={deletingSumulaId === s.id} title="Excluir">
                                {deletingSumulaId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a súmula "{s.sumula_number}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSumula(s)} className="bg-red-600 hover:bg-red-700">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={fispqQuery}
                  onChange={(e) => setFispqQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Pesquisar por produto, anexo, limites ou arquivo"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{filteredFispqs.length} FISPQ(s)</Badge>
                <Button variant="outline" onClick={() => fetchFispqs({ force: true })} disabled={fispqLoading}>
                  {fispqLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {fispqLoading ? (
              <Card className="shadow-card">
                <CardContent className="py-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando...</span>
                </CardContent>
              </Card>
            ) : filteredFispqs.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-10 text-center text-muted-foreground">Nenhuma FISPQ cadastrada.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredFispqs.map((f) => (
                  <Card key={f.id} className="shadow-card">
                    <CardContent
                      className="pt-6 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedFispqId((prev) => (prev === f.id ? null : f.id))}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedFispqId((prev) => (prev === f.id ? null : f.id));
                        }
                      }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {f.product_identification || f.attachment_name || "FISPQ"}
                          </div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                            {f.nr15_annex ? (
                              <>
                                <span>NR-15 Anexo {f.nr15_annex}</span>
                                <span>•</span>
                              </>
                            ) : null}
                            {f.flash_point ? (
                              <>
                                <span>P. fulgor: {f.flash_point}</span>
                                <span>•</span>
                              </>
                            ) : null}
                            <span>{new Date(f.created_at).toLocaleDateString("pt-BR")}</span>
                            {f.__local ? (
                              <>
                                <span>•</span>
                                <Badge variant="outline">Local</Badge>
                              </>
                            ) : null}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{f.attachment_name}</div>
                        </div>

                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-xs">Detalhes</span>
                          {expandedFispqId === f.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>

                        <div className="flex items-center gap-1 justify-end">
                          {expandedFispqId === f.id ? (
                            editingFispqId === f.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={updatingFispqId === f.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveEditFispq(f);
                                  }}
                                  title="Salvar alterações"
                                >
                                  {updatingFispqId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={updatingFispqId === f.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEditFispq();
                                  }}
                                  title="Cancelar edição"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditFispq(f);
                                }}
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )
                          ) : null}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              previewFispqAttachment(f);
                            }}
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFispqAttachment(f);
                            }}
                            title="Baixar"
                          >
                            <Download className="w-4 h-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deletingFispqId === f.id}
                                title="Excluir"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {deletingFispqId === f.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a FISPQ "{f.product_identification || f.attachment_name}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteFispq(f)} className="bg-red-600 hover:bg-red-700">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {expandedFispqId === f.id ? (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {editingFispqId === f.id ? (
                            <>
                              <div className="space-y-2">
                                <Label>Identificação do produto</Label>
                                <Input
                                  value={editingFispqDraft.product_identification}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, product_identification: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Catalogado no anexo 11 / 13 da NR-15</Label>
                                <Select
                                  value={editingFispqDraft.nr15_annex || "none"}
                                  onValueChange={(v) => setEditingFispqDraft((p) => ({ ...p, nr15_annex: v === "none" ? "" : v }))}
                                >
                                  <SelectTrigger onClick={(e) => e.stopPropagation()}>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Não informado</SelectItem>
                                    <SelectItem value="11">Anexo 11</SelectItem>
                                    <SelectItem value="13">Anexo 13</SelectItem>
                                    <SelectItem value="11 e 13">Anexo 11 e 13</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Limite de tolerância</Label>
                                <Input
                                  value={editingFispqDraft.tolerance_limit}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, tolerance_limit: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Risco de absorção pela pele</Label>
                                <Input
                                  value={editingFispqDraft.skin_absorption_risk}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, skin_absorption_risk: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Ponto de fulgor</Label>
                                <Input
                                  value={editingFispqDraft.flash_point}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, flash_point: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Arquivo</div>
                                <div className="text-sm whitespace-pre-wrap">{f.attachment_name || "—"}</div>
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label>Identificação de perigo</Label>
                                <Textarea
                                  value={editingFispqDraft.hazard_identification}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, hazard_identification: e.target.value }))}
                                  className="min-h-[110px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label>Composição</Label>
                                <Textarea
                                  value={editingFispqDraft.composition}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, composition: e.target.value }))}
                                  className="min-h-[110px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label>Medida de proteção requerida</Label>
                                <Textarea
                                  value={editingFispqDraft.protection_measures_required}
                                  onChange={(e) =>
                                    setEditingFispqDraft((p) => ({ ...p, protection_measures_required: e.target.value }))
                                  }
                                  className="min-h-[110px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label>Texto extraído</Label>
                                <Textarea
                                  value={editingFispqDraft.extracted_text}
                                  onChange={(e) => setEditingFispqDraft((p) => ({ ...p, extracted_text: e.target.value }))}
                                  className="min-h-[140px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Identificação do produto</div>
                                <div className="text-sm whitespace-pre-wrap">{f.product_identification || "—"}</div>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">NR-15 (Anexo)</div>
                                <div className="text-sm whitespace-pre-wrap">{f.nr15_annex || "—"}</div>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Limite de tolerância</div>
                                <div className="text-sm whitespace-pre-wrap">{f.tolerance_limit || "—"}</div>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Risco de absorção pela pele</div>
                                <div className="text-sm whitespace-pre-wrap">{f.skin_absorption_risk || "—"}</div>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Ponto de fulgor</div>
                                <div className="text-sm whitespace-pre-wrap">{f.flash_point || "—"}</div>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Arquivo</div>
                                <div className="text-sm whitespace-pre-wrap">{f.attachment_name || "—"}</div>
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                <div className="text-xs font-medium text-muted-foreground">Identificação de perigo</div>
                                <div className="text-sm whitespace-pre-wrap">{f.hazard_identification || "—"}</div>
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                <div className="text-xs font-medium text-muted-foreground">Composição</div>
                                <div className="text-sm whitespace-pre-wrap">{f.composition || "—"}</div>
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                <div className="text-xs font-medium text-muted-foreground">Medida de proteção requerida</div>
                                <div className="text-sm whitespace-pre-wrap">{f.protection_measures_required || "—"}</div>
                              </div>

                              {f.extracted_text ? (
                                <div className="md:col-span-2">
                                  <details className="rounded-md border p-3 bg-muted/20" onClick={(e) => e.stopPropagation()}>
                                    <summary className="text-sm cursor-pointer select-none">Texto extraído</summary>
                                    <div className="mt-2 text-sm whitespace-pre-wrap">{f.extracted_text}</div>
                                  </details>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
