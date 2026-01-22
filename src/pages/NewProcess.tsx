import { useState, useEffect } from "react";
import { supabase, getAuthenticatedUser } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProcessValidation } from "@/hooks/use-api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function NewProcess() {
  const [loading, setLoading] = useState(false);
  const [processNumber, setProcessNumber] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [defendantName, setDefendantName] = useState("");
  const [court, setCourt] = useState("");
  const [distributionDate, setDistributionDate] = useState("");
  const [inspectionDate, setInspectionDate] = useState<Date>();
  const [inspectionAddress, setInspectionAddress] = useState("");
  const [city, setCity] = useState("");
  const [initialType, setInitialType] = useState<"insalubridade" | "periculosidade" | "acidentario">("insalubridade");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [validationSuccess, setValidationSuccess] = useState<Record<string, boolean>>({});
  const [courtOptions, setCourtOptions] = useState<string[]>([]);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { validateProcess, loading: validationLoading } = useProcessValidation();

  // Sanitização: remove trechos "ADVOGADO:"/"ADVOGADA:" acoplados ao nome
  const sanitizeLawyerFromName = (name: unknown): string => {
    const s = String(name || "");
    return s
      .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  useEffect(() => {
    const loadCourtOptions = async () => {
      try {
        const user = await getAuthenticatedUser();
        if (!user) return;

        let ownerIdForLookup = user.id;
        try {
          const { data: linkedRow } = await supabase
            .from("linked_users")
            .select("owner_user_id")
            .eq("auth_user_id", user.id)
            .eq("status", "active")
            .maybeSingle();
          if (linkedRow?.owner_user_id) ownerIdForLookup = linkedRow.owner_user_id;
        } catch {
          ownerIdForLookup = user.id;
        }

        const { data, error } = await supabase
          .from("processes")
          .select("court, report_config")
          .eq("user_id", ownerIdForLookup)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (error) return;
        const set = new Set<string>();
        (data || []).forEach((row) => {
          const c = String(row.court || "").trim();
          if (c) set.add(c);
          try {
            const raw = row.report_config as unknown;
            let cfg: Record<string, unknown> = {};
            if (typeof raw === "string" && raw.trim()) {
              cfg = JSON.parse(raw) as Record<string, unknown>;
            } else if (typeof raw === "object" && raw) {
              cfg = raw as Record<string, unknown>;
            }
            const optsUnknown = (cfg as { court_options?: unknown }).court_options;
            if (Array.isArray(optsUnknown)) {
              optsUnknown.forEach((v) => {
                if (typeof v === "string" && v.trim()) set.add(v.trim());
              });
            }
          } catch (e) {
            console.error(e);
          }
        });
        const arr = Array.from(set);
        arr.sort((a, b) => a.localeCompare(b, "pt-BR"));
        setCourtOptions(arr);
      } catch (e) {
        console.error(e);
      }
    };
    loadCourtOptions();
  }, []);

  // Validação em tempo real
  useEffect(() => {
    const validateField = async (field: string, value: string) => {
      const trimmed = value.trim();

      // Validações locais por campo para evitar mensagens trocadas
      switch (field) {
        case 'processNumber': {
          if (!trimmed) {
            setValidationErrors(prev => ({ ...prev, processNumber: 'Número do processo é obrigatório' }));
            setValidationSuccess(prev => ({ ...prev, processNumber: false }));
            return;
          }
          const cnjPattern = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
          if (!cnjPattern.test(trimmed)) {
            // Não bloqueia, apenas marca como inválido visualmente
            setValidationErrors(prev => ({ ...prev, processNumber: 'Formato CNJ inválido (NNNNNNN-NN.NNNN.N.NN.NNNN)' }));
            setValidationSuccess(prev => ({ ...prev, processNumber: false }));
          } else {
            setValidationErrors(prev => ({ ...prev, processNumber: '' }));
            setValidationSuccess(prev => ({ ...prev, processNumber: true }));
          }
          break;
        }
        case 'claimantName': {
          if (!trimmed) {
            setValidationErrors(prev => ({ ...prev, claimantName: 'Nome do(a) reclamante é obrigatório' }));
            setValidationSuccess(prev => ({ ...prev, claimantName: false }));
            return;
          }
          if (trimmed.length < 3) {
            setValidationErrors(prev => ({ ...prev, claimantName: 'Nome do(a) reclamante deve ter pelo menos 3 caracteres' }));
            setValidationSuccess(prev => ({ ...prev, claimantName: false }));
          } else {
            setValidationErrors(prev => ({ ...prev, claimantName: '' }));
            setValidationSuccess(prev => ({ ...prev, claimantName: true }));
          }
          break;
        }
        case 'defendantName': {
          if (!trimmed) {
            setValidationErrors(prev => ({ ...prev, defendantName: 'Nome do requerido é obrigatório' }));
            setValidationSuccess(prev => ({ ...prev, defendantName: false }));
            return;
          }
          if (trimmed.length < 3) {
            setValidationErrors(prev => ({ ...prev, defendantName: 'Nome do requerido deve ter pelo menos 3 caracteres' }));
            setValidationSuccess(prev => ({ ...prev, defendantName: false }));
          } else {
            setValidationErrors(prev => ({ ...prev, defendantName: '' }));
            setValidationSuccess(prev => ({ ...prev, defendantName: true }));
          }
          break;
        }
        case 'court': {
          if (!trimmed) {
            setValidationErrors(prev => ({ ...prev, court: 'Tribunal/Vara é obrigatório' }));
            setValidationSuccess(prev => ({ ...prev, court: false }));
          } else {
            setValidationErrors(prev => ({ ...prev, court: '' }));
            setValidationSuccess(prev => ({ ...prev, court: true }));
          }
          break;
        }
        default:
          break;
      }
    };

    const debounceTimer = setTimeout(() => {
      if (processNumber) validateField('processNumber', processNumber);
      if (claimantName) validateField('claimantName', claimantName);
      if (defendantName) validateField('defendantName', defendantName);
      if (court) validateField('court', court);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [processNumber, claimantName, defendantName, court, validateProcess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validação final antes do envio
      const finalValidation = await validateProcess({
        processNumber: processNumber,
        claimantName: claimantName,
        defendantName: defendantName,
      });

      if (!finalValidation.isValid) {
        toast({
          title: "Dados inválidos",
          description: finalValidation.errors?.join(', ') || "Verifique os dados informados",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const user = await getAuthenticatedUser();
      if (!user) throw new Error("Usuário não autenticado");

      let ownerUserId = user.id;
      try {
        const { data: linkedRow } = await supabase
          .from("linked_users")
          .select("owner_user_id")
          .eq("auth_user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        if (linkedRow?.owner_user_id) ownerUserId = linkedRow.owner_user_id;
      } catch {
        ownerUserId = user.id;
      }

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

      const defaultConfig = {
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
      };

      const { data: sampleCfg } = await supabase
        .from("processes")
        .select("report_config, updated_at")
        .eq("user_id", ownerUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rcForNew = safeParseJson(sampleCfg?.report_config, defaultConfig);

      const isMissingColumnError = (e: any) => {
        const msg = String(e?.message || "");
        const code = String(e?.code || "");
        return (
          code === "42703" ||
          code === "PGRST204" ||
          /does not exist|undefined column|column\s+.+\s+does not exist|could not find the/i.test(msg)
        );
      };

      const normalizeDateOnly = (v: string): string | null => {
        const s = String(v || "").trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return null;
      };

      const normalizeIsoDateTime = (d?: Date): string | null => {
        if (!d) return null;
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
        return d.toISOString();
      };

      const payloadFull = {
        process_number: processNumber,
        claimant_name: claimantName,
        defendant_name: sanitizeLawyerFromName(defendantName),
        court,
        distribution_date: normalizeDateOnly(distributionDate),
        inspection_date: normalizeIsoDateTime(inspectionDate),
        inspection_address: inspectionAddress,
        inspection_city: city,
        user_id: ownerUserId,
        report_config: rcForNew,
      };

      const payloadFallback = {
        process_number: processNumber,
        claimant_name: claimantName,
        defendant_name: sanitizeLawyerFromName(defendantName),
        court,
        inspection_date: normalizeIsoDateTime(inspectionDate),
        inspection_address: inspectionAddress,
        user_id: ownerUserId,
      };

      let inserted = await supabase
        .from("processes")
        .insert(payloadFull)
        .select()
        .single();

      if (inserted.error && isMissingColumnError(inserted.error)) {
        inserted = await supabase
          .from("processes")
          .insert(payloadFallback)
          .select()
          .single();
      }

      if (inserted.error) throw inserted.error;
      const data = inserted.data;

      toast({
        title: "Processo criado com sucesso",
        description: `Processo ${processNumber} foi cadastrado`,
      });

      navigate(`/processo/${data.id}`);
    } catch (error: unknown) {
      const err = error as any;
      const message =
        typeof err?.message === "string"
          ? `${err.message}${err?.code ? ` (Código: ${err.code})` : ""}${err?.details ? `\n${err.details}` : ""}`
          : error instanceof Error
          ? error.message
          : String(error);
      toast({
        title: "Erro ao criar processo",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Novo Processo</h1>
            <p className="text-muted-foreground">
              Cadastre um novo processo pericial trabalhista
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Dados do Processo</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="processNumber">Número do Processo *</Label>
                  <div className="relative">
                    <Input
                      id="processNumber"
                      placeholder="0000000-00.0000.0.00.0000"
                      value={processNumber}
                      onChange={(e) => setProcessNumber(e.target.value)}
                      required
                      className={`pr-10 ${validationErrors.processNumber ? 'border-red-500' : validationSuccess.processNumber ? 'border-green-500' : ''}`}
                    />
                    {validationLoading && processNumber && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                    {!validationLoading && validationSuccess.processNumber && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!validationLoading && validationErrors.processNumber && (
                      <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.processNumber && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{validationErrors.processNumber}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claimantName">Nome do(a) Reclamante *</Label>
                  <div className="relative">
                    <Input
                      id="claimantName"
                      placeholder="Nome completo do reclamante"
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                      required
                      className={`pr-10 ${validationErrors.claimantName ? 'border-red-500' : validationSuccess.claimantName ? 'border-green-500' : ''}`}
                    />
                    {validationLoading && claimantName && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                    {!validationLoading && validationSuccess.claimantName && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!validationLoading && validationErrors.claimantName && (
                      <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.claimantName && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{validationErrors.claimantName}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defendantName">Nome do(a) Reclamado(a) *</Label>
                  <div className="relative">
                    <Input
                      id="defendantName"
                      placeholder="Nome completo ou razão social"
                      value={defendantName}
                      onChange={(e) => setDefendantName(e.target.value)}
                      required
                      className={`pr-10 ${validationErrors.defendantName ? 'border-red-500' : validationSuccess.defendantName ? 'border-green-500' : ''}`}
                    />
                    {validationLoading && defendantName && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                    {!validationLoading && validationSuccess.defendantName && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!validationLoading && validationErrors.defendantName && (
                      <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.defendantName && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{validationErrors.defendantName}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="court">Tribunal/Vara *</Label>
                  <div className="relative">
                    {courtOptions.length > 0 ? (
                      <Select value={court} onValueChange={(v) => setCourt(v)}>
                        <SelectTrigger id="court">
                          <SelectValue placeholder="Selecione a vara/tribunal" />
                        </SelectTrigger>
                        <SelectContent>
                          {courtOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="court"
                        placeholder="Ex: 1ª Vara do Trabalho de São Paulo"
                        value={court}
                        onChange={(e) => setCourt(e.target.value)}
                        required
                        className={`pr-10 ${validationErrors.court ? 'border-red-500' : validationSuccess.court ? 'border-green-500' : ''}`}
                      />
                    )}
                    {validationLoading && court && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      </div>
                    )}
                    {!validationLoading && validationSuccess.court && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!validationLoading && validationErrors.court && (
                      <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.court && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{validationErrors.court}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distributionDate">Data da distribuição do processo</Label>
                  <Input
                    id="distributionDate"
                    type="date"
                    value={distributionDate}
                    onChange={(e) => setDistributionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data da Perícia</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {inspectionDate ? (
                          format(inspectionDate, "PPP", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={inspectionDate}
                        onSelect={setInspectionDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspectionAddress">Endereço da Perícia</Label>
                  <Textarea
                    id="inspectionAddress"
                    placeholder="Endereço completo onde será realizada a perícia"
                    value={inspectionAddress}
                    onChange={(e) => setInspectionAddress(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="Ex: Diadema"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Perícia</Label>
                  <RadioGroup
                    value={initialType}
                    onValueChange={(val) => setInitialType(val as "insalubridade" | "periculosidade" | "acidentario")}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2"
                  >
                    <div className="flex items-center space-x-2 border rounded p-2">
                      <RadioGroupItem value="insalubridade" id="tipo-insal" />
                      <Label htmlFor="tipo-insal">Insalubridade</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded p-2">
                      <RadioGroupItem value="periculosidade" id="tipo-peri" />
                      <Label htmlFor="tipo-peri">Periculosidade</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded p-2">
                      <RadioGroupItem value="acidentario" id="tipo-aci" />
                      <Label htmlFor="tipo-aci">Acidentário</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/processos")}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Criando..." : "Criar Processo"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
