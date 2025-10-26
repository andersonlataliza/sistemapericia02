import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState } from "react";

interface MethodologySectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MethodologySection({ value, onChange }: MethodologySectionProps) {
  const inferType = (v: string): "nr15" | "nr16" | "both" => {
    const lower = (v || "").toLowerCase();
    const has15 = lower.includes("nr-15") || lower.includes("nr15");
    const has16 = lower.includes("nr-16") || lower.includes("nr16");
    if (has15 && has16) return "both";
    if (has16) return "nr16";
    return "nr15";
  };
  const [nrType, setNrType] = useState<"nr15" | "nr16" | "both">(inferType(value || ""));

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
        <CardTitle>9. Metodologia de Avaliação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
