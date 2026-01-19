import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MethodologySectionProps {
  value: string;
  onChange: (value: string) => void;
  templates?: { id: string; name: string; text: string }[];
  onApplyTemplate?: (t: { id: string; name: string; text: string }) => void;
  onCreateTemplate?: () => void;
  onManageTemplates?: () => void;
}

export default function MethodologySection({ value, onChange, templates, onApplyTemplate, onCreateTemplate, onManageTemplates }: MethodologySectionProps) {
  const inferType = (v: string): "nr15" | "nr16" | "both" => {
    const lower = (v || "").toLowerCase();
    const has15 = lower.includes("nr-15") || lower.includes("nr15");
    const has16 = lower.includes("nr-16") || lower.includes("nr16");
    if (has15 && has16) return "both";
    if (has16) return "nr16";
    return "nr15";
  };
  const [nrType, setNrType] = useState<"nr15" | "nr16" | "both">(inferType(value || ""));
  const [tplId, setTplId] = useState<string>("");
  const list = Array.isArray(templates) ? templates : [];
  const selectedTpl = list.find((t) => t.id === tplId) || null;

  const generateText = (t: "nr15" | "nr16" | "both") => {
    const nrLabel = t === "nr15" ? "NR-15" : t === "nr16" ? "NR-16" : "NR-15 e NR-16";
    return (
      "Na entrevista e visita aos locais e instalações onde a reclamante laborou para a reclamada, " +
      "foram efetuados levantamentos dos riscos potenciais que geraram perigo à trabalhadora, " +
      `de acordo com a ${nrLabel} da Portaria 3.214/78.`
    );
  };

  const handleTypeChange = (t: "nr15" | "nr16" | "both") => {
    setNrType(t);
    onChange(generateText(t));
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle>9. Metodologia de Avaliação</CardTitle>
          {(!!onManageTemplates || !!onCreateTemplate) && (
            <div className="flex items-center gap-2">
              {!!onManageTemplates && (
                <Button type="button" size="sm" variant="outline" onClick={onManageTemplates}>Editar Templates</Button>
              )}
              {!!onCreateTemplate && (
                <Button type="button" size="sm" onClick={onCreateTemplate}>Novo Template</Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tplId} onValueChange={(v) => setTplId(v)}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Selecionar template" />
              </SelectTrigger>
              <SelectContent>
                {list.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={!selectedTpl}
              onClick={() => {
                if (!selectedTpl) return;
                onApplyTemplate?.(selectedTpl);
              }}
            >Aplicar Template</Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Tipo de NR</Label>
            <Select value={nrType} onValueChange={(v) => handleTypeChange(v as "nr15" | "nr16" | "both") }>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione NR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nr15">NR-15 (Insalubridade)</SelectItem>
                <SelectItem value="nr16">NR-16 (Periculosidade)</SelectItem>
                <SelectItem value="both">Ambos (NR-15 e NR-16)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="methodology">Metodologia utilizada na perícia</Label>
          <Textarea
            id="methodology"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Na entrevista e visita aos locais e instalações onde a reclamante laborou..."
            className="min-h-[120px] mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            A seleção acima aplica um texto padrão que você pode ajustar livremente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
