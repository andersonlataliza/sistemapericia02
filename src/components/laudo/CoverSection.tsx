import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface IdentificationData {
  processNumber?: string;
  claimantName?: string;
  defendantName?: string;
  court?: string;
}

interface CoverData {
  city?: string;
  coverDate?: string; // ISO date string: YYYY-MM-DD
  peritoName?: string;
  professionalTitle?: string;
  registrationNumber?: string;
  honorarios?: string; // ex: "03 (três) salários mínimos"
  judgeCourtLine?: string; // override header line if needed
}

interface CoverSectionProps {
  value: CoverData;
  onChange: (value: CoverData) => void;
  identifications?: IdentificationData;
  processMeta?: {
    inspection_date?: string | null;
    inspection_address?: string | null;
    inspection_city?: string | null;
  };
}

function formatDatePtBr(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function CoverSection({ value, onChange, identifications, processMeta }: CoverSectionProps) {
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [linkedLoaded, setLinkedLoaded] = useState(false);
  
  // Memoize onChange para evitar re-renders desnecessários
  const memoizedOnChange = useCallback(onChange, []);
  
  // Preenche automaticamente o cabeçalho do juízo com base na Vara da aba Processo/Identificações,
  // apenas quando o campo está vazio (não sobrescreve edições manuais)
  useEffect(() => {
    const court = (identifications?.court || "").trim();
    const current = (value.judgeCourtLine || "").trim();
    if (court && !current) {
      memoizedOnChange({ ...value, judgeCourtLine: `Excelentíssimo Senhor Doutor Juiz da ${court}.` });
    }
  }, [identifications?.court, value.judgeCourtLine]); // Removido onChange das dependências

  useEffect(() => {
    const loadProfileDefaults = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("full_name, professional_title, registration_number").eq("id", user.id).single();
        if (data) {
          const next: CoverData = { ...value };
          if (!next.peritoName && data.full_name) next.peritoName = data.full_name;
          if (!next.professionalTitle && data.professional_title) next.professionalTitle = data.professional_title;
          if (!next.registrationNumber && data.registration_number) next.registrationNumber = data.registration_number;
          if (!next.honorarios) next.honorarios = "03 (três) salários mínimos";
          if (!next.coverDate) next.coverDate = new Date().toISOString().substring(0, 10);
          memoizedOnChange(next);
        }
      } finally {
        setProfileLoaded(true);
      }
    };

    // Load once, and only if some core fields are missing
    if (!profileLoaded && (!value.peritoName || !value.professionalTitle || !value.registrationNumber)) {
      loadProfileDefaults();
    }
  }, [profileLoaded, value.peritoName, value.professionalTitle, value.registrationNumber]); // Removido 'value' e 'onChange' completos

  // Prefill city and date from process meta when available
  useEffect(() => {
    try {
      if (!processMeta) return;
      const next: CoverData = { ...value };
      let hasChanges = false;
      
      if (!next.coverDate && processMeta.inspection_date) {
        try {
          const d = new Date(processMeta.inspection_date);
          next.coverDate = d.toISOString().substring(0, 10);
          hasChanges = true;
        } catch {}
      }
      if (!next.city) {
        const cityDirect = (processMeta.inspection_city || "").trim();
        if (cityDirect) {
          next.city = cityDirect;
          hasChanges = true;
        } else if (processMeta.inspection_address) {
          const extractCityFromAddress = (address: string) => {
            const cleaned = String(address || "").trim();
            if (!cleaned) return "";
            const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
            const last = parts.length > 0 ? parts[parts.length - 1] : cleaned;
            const re = /^([A-Za-zÀ-ÿ'\s]+)\s*(?:-|\/)\s*([A-Z]{2})$/;
            const m = last.match(re);
            if (m) return m[1].trim();
            if (last.includes("-")) return last.split("-")[0].trim();
            if (last.includes("/")) return last.split("/")[0].trim();
            return last;
          };
          const extractedCity = extractCityFromAddress(String(processMeta.inspection_address));
          if (extractedCity) {
            next.city = extractedCity;
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        memoizedOnChange(next);
      }
    } catch {}
  }, [processMeta?.inspection_date, processMeta?.inspection_city, processMeta?.inspection_address, value.coverDate, value.city]); // Dependências específicas

  // Fallback to professional data from linked users when profile is incomplete
  useEffect(() => {
    const loadLinkedProfessional = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("linked_users")
          .select("linked_user_name, permissions")
          .eq("owner_user_id", user.id);
        if (!data || data.length === 0) return;

        const candidate = (data as any[]).find((u) => {
          const prof = u.permissions?.professional || {};
          return (prof.profession || prof.council_number || prof.council_registry);
        });
        if (!candidate) return;

        const prof = candidate.permissions?.professional || {};
        const next: CoverData = { ...value };
        let hasChanges = false;
        
        if (!next.peritoName && candidate.linked_user_name) {
          next.peritoName = candidate.linked_user_name;
          hasChanges = true;
        }
        if (!next.professionalTitle && prof.profession) {
          next.professionalTitle = prof.profession;
          hasChanges = true;
        }
        if (!next.registrationNumber && (prof.council_number || prof.council_registry)) {
          next.registrationNumber = prof.council_number || prof.council_registry;
          hasChanges = true;
        }
        if (hasChanges) {
          memoizedOnChange(next);
        }
      } finally {
        setLinkedLoaded(true);
      }
    };

    if (!linkedLoaded && (!value.peritoName || !value.professionalTitle || !value.registrationNumber)) {
      loadLinkedProfessional();
    }
  }, [linkedLoaded, value.peritoName, value.professionalTitle, value.registrationNumber]); // Dependências específicas

  const updateField = (field: keyof CoverData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const courtLine = value.judgeCourtLine || (identifications?.court ? `Excelentíssimo Senhor Doutor Juiz da ${identifications.court}.` : "Excelentíssimo Senhor Doutor Juiz da ____.");
  const processLine = identifications?.processNumber ? `Proc...: ${identifications.processNumber}` : "Proc...: __________";
  const claimantLine = identifications?.claimantName ? `Reclamante: ${identifications.claimantName}` : "Reclamante: __________";
  const defendantLine = identifications?.defendantName ? `Reclamada: ${identifications.defendantName}` : "Reclamada: __________";

  const bodyText = `${value.peritoName || "[Seu nome]"}, ${value.professionalTitle || "[Título]"}${value.registrationNumber ? ", " + value.registrationNumber : ""}, legalmente habilitado pelo CREA - CONSELHO REGIONAL DE ENGENHARIA, nomeado como PERITO JUDICIAL, vem à presença de V. Exa. apresentar o resultado do seu trabalho consistente do incluso LAUDO PERICIAL e solicitar o arbitramento de seus honorários profissionais em ${value.honorarios || "03 (três) salários mínimos"}, corrigidos monetariamente na data de seu efetivo pagamento.`;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Capa do Laudo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={value.city || ""} onChange={(e) => updateField("city", e.target.value)} placeholder="Ex: Diadema" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="coverDate">Data</Label>
            <Input id="coverDate" type="date" value={value.coverDate || ""} onChange={(e) => updateField("coverDate", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="honorarios">Honorários sugeridos</Label>
            <Input id="honorarios" value={value.honorarios || ""} onChange={(e) => updateField("honorarios", e.target.value)} placeholder="Ex: 03 (três) salários mínimos" className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="peritoName">Nome do Perito</Label>
            <Input id="peritoName" value={value.peritoName || ""} onChange={(e) => updateField("peritoName", e.target.value)} placeholder="Seu nome completo" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="professionalTitle">Título Profissional</Label>
            <Input id="professionalTitle" value={value.professionalTitle || ""} onChange={(e) => updateField("professionalTitle", e.target.value)} placeholder="Ex: Eng. de Segurança do Trabalho" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="registrationNumber">Registro Profissional</Label>
            <Input id="registrationNumber" value={value.registrationNumber || ""} onChange={(e) => updateField("registrationNumber", e.target.value)} placeholder="Ex: CREA 5063101637-SP" className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="judgeCourtLine">Cabeçalho do Juízo (opcional)</Label>
          <Input id="judgeCourtLine" value={value.judgeCourtLine || ""} onChange={(e) => updateField("judgeCourtLine", e.target.value)} placeholder="Ex: Excelentíssimo Senhor Doutor Juiz da 01ª Vara..." className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Se vazio, será gerado automaticamente a partir da Vara em Identificações.</p>
        </div>

        {/* Prévia formatada da capa */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-center font-semibold">{courtLine}</p>
          <div className="mt-4 space-y-1">
            <p>{processLine}</p>
            <p>{claimantLine}</p>
            <p>{defendantLine}</p>
          </div>

          <Textarea value={bodyText} readOnly className="min-h-[140px] mt-4" />

          <div className="mt-4">
            <p>{(value.city || "[Cidade]") + ", " + (formatDatePtBr(value.coverDate) || "[Data]")}</p>
          </div>

          <div className="mt-6 text-center">
            <p>Termos em que, para os devidos fins. Pede e espera deferimento.</p>
            <div className="mt-6">
              <p className="font-medium">{value.peritoName || "________________________"}</p>
              <p className="text-sm text-muted-foreground">{value.professionalTitle || ""}</p>
              <p className="text-sm text-muted-foreground">{value.registrationNumber || ""}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}