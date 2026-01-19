import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface DiligenceData {
  location?: string;
  date?: string; // ISO format yyyy-mm-dd
  time?: string; // HH:mm
  description?: string;
  useProof?: boolean;
  proofImage?: string; // data URL
}

interface DiligencesSectionProps {
  value: DiligenceData[];
  onChange: (value: DiligenceData[]) => void;
  processData?: {
    inspection_address?: string | null;
    inspection_city?: string | null;
    inspection_date?: string | null;
    inspection_time?: string | null;
  };
}

export default function DiligencesSection({ value, onChange, processData }: DiligencesSectionProps) {
  const addDiligence = () => {
    // Construir o local automaticamente a partir dos dados do processo
    let autoLocation = "";
    if (processData?.inspection_address && processData?.inspection_city) {
      autoLocation = `${processData.inspection_address}, ${processData.inspection_city}`;
    } else if (processData?.inspection_address) {
      autoLocation = processData.inspection_address;
    } else if (processData?.inspection_city) {
      autoLocation = processData.inspection_city;
    }

    // Usar a data da perícia se disponível
    const autoDate = processData?.inspection_date ? new Date(processData.inspection_date).toISOString().slice(0, 10) : "";
    
    // Usar o horário da perícia se disponível
    const autoTime = processData?.inspection_time || "";

    onChange([
      ...value,
      { 
        location: autoLocation, 
        date: autoDate, 
        time: autoTime, 
        description: "", 
        useProof: false, 
        proofImage: "" 
      },
    ]);
  };

  const removeDiligence = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  const updateField = (index: number, field: keyof DiligenceData, val: string | boolean) => {
    const next = [...value];
    next[index] = { ...next[index], [field]: val } as DiligenceData;
    onChange(next);
  };

  // Helpers para exibir Local e Data conforme imagem
  const formatDatePtBrExt = (dateStr?: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const monthName = months[parseInt(m, 10) - 1] || "";
    return `${d?.padStart(2,"0")} de ${monthName} de ${y}`;
  };
  const formatTimePtBr = (timeStr?: string) => {
    if (!timeStr) return "";
    const [hh, mm] = timeStr.split(":");
    return `${hh}h${mm}min`;
  };
  const formatDateTime = (d?: DiligenceData) => {
    if (!d || !d.date) return "";
    const base = formatDatePtBrExt(d.date);
    return `${base}${d.time ? ` às ${formatTimePtBr(d.time)}` : ""}`;
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>7.  Diligências / Vistorias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Para avaliação das condições em que trabalhava a Reclamante, foi realizada
            vistoria em seu local de trabalho, nas dependências da Reclamada, para
            atingirmos o adequado encaminhamento e correta interpretação final deste
            Laudo Pericial, sem subjetivismo e com embasamento técnico legal.
          </p>
          <p>
            Realizou-se primeiramente o inquérito preliminar, item administrativo obrigatório
            em qualquer perícia trabalhista, prestando todas as informações necessárias e
            esclarecimentos de ordem prática, os profissionais abaixo relacionados, além da ouvida
            de outros trabalhadores presentes nas áreas ou postos de trabalho, visando com isto
            caracterizar itens básicos relativos ao objetivo desta avaliação.
          </p>
          {value.length === 0 ? (
            <ul className="list-none space-y-1">
              <li>
                <span className="font-semibold">Local:</span>{" "}
                {"_____________________________"}
              </li>
              <li>
                <span className="font-semibold">Data:</span>{" "}
                {"_____________________________"}
              </li>
            </ul>
          ) : (
            <div className="space-y-3">
              {value.map((d, idx) => (
                <div key={`headline-${idx}`} className="space-y-1">
                  <p className="text-sm font-medium">Diligência #{idx + 1}</p>
                  <ul className="list-none space-y-1">
                    <li>
                      <span className="font-semibold">Local:</span>{" "}
                      {d.location || "_____________________________"}
                    </li>
                    <li>
                      <span className="font-semibold">Data:</span>{" "}
                      {formatDateTime(d) || "_____________________________"}
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={addDiligence}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Diligência/Vistoria
          </Button>
        </div>

        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma diligência cadastrada. Adicione a primeira acima.
          </p>
        ) : (
          <div className="space-y-4">
            {value.map((d, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">Diligência #{idx + 1}</p>
                    <p className="text-xs text-muted-foreground">Preencha os campos abaixo</p>
                  </div>
                  <Button
                    onClick={() => removeDiligence(idx)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs" htmlFor={`loc-${idx}`}>Local</Label>
                    <Input
                      id={`loc-${idx}`}
                      value={d.location || ""}
                      onChange={(e) => updateField(idx, "location", e.target.value)}
                      placeholder="Endereço/Setor/Unidade"
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`date-${idx}`}>Data</Label>
                    <Input
                      id={`date-${idx}`}
                      type="date"
                      value={d.date || ""}
                      onChange={(e) => updateField(idx, "date", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`time-${idx}`}>Horário</Label>
                    <Input
                      id={`time-${idx}`}
                      type="time"
                      value={d.time || ""}
                      onChange={(e) => updateField(idx, "time", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs" htmlFor={`desc-${idx}`}>Descrição / Observações</Label>
                  <Textarea
                    id={`desc-${idx}`}
                    value={d.description || ""}
                    onChange={(e) => updateField(idx, "description", e.target.value)}
                    placeholder="Descreva o que foi realizado durante a diligência..."
                    className="min-h-[120px] mt-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`use-proof-${idx}`}
                      checked={!!d.useProof}
                      onCheckedChange={(checked) => updateField(idx, "useProof", !!checked)}
                    />
                    <label htmlFor={`use-proof-${idx}`} className="text-sm cursor-pointer">
                      Utilizar comprovante de agendamento (caso necessário)
                    </label>
                  </div>

                  {d.useProof ? (
                    <div
                      className="border rounded-md p-3 text-sm"
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (const item of items) {
                          if (item.type.startsWith("image/")) {
                            const file = item.getAsFile();
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                updateField(idx, "proofImage", reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                            e.preventDefault();
                            break;
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs">Comprovante de agendamento</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateField(idx, "proofImage", "")}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              updateField(idx, "proofImage", reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        {d.proofImage ? (
                          <img
                            src={d.proofImage}
                            alt="Comprovante de agendamento"
                            className="max-h-48 rounded-md border"
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Cole uma imagem aqui (Ctrl+V) ou envie um arquivo.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Campo opcional: habilite acima caso necessário.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}