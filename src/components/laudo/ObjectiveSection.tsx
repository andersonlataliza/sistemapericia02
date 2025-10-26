import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ObjectiveSectionProps {
  value: string;
  onChange: (value: string) => void;
}

type ObjectiveType = "insalubridade" | "periculosidade" | "ambos";

const generateObjectiveText = (type: ObjectiveType): string => {
  const normativa = type === "insalubridade" ? "NR-15" : type === "periculosidade" ? "NR-16" : "NR-15 e NR-16";
  const natureza = type === "insalubridade" ? "insalubres" : type === "periculosidade" ? "periculosas" : "insalubres e periculosas";
  return (
    `O presente trabalho da perícia tem por objetivo verificar a existência ou não de condições ` +
    `que se possam caracterizar as atividades desenvolvidas pela Reclamante, em ${natureza}, ` +
    `nos termos da Portaria nº 3214/78 do Ministério do Trabalho, em suas Normas Regulamentadoras – ${normativa}.`
  );
};

const detectTypeFromText = (text: string): ObjectiveType => {
  const t = (text || "").toLowerCase();
  const has15 = t.includes("nr-15") || t.includes("insalubr");
  const has16 = t.includes("nr-16") || t.includes("periculos");
  if (has15 && has16) return "ambos";
  if (has15) return "insalubridade";
  if (has16) return "periculosidade";
  return "ambos";
};

export default function ObjectiveSection({ value, onChange }: ObjectiveSectionProps) {
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>("ambos");

  useEffect(() => {
    setObjectiveType(detectTypeFromText(value));
  }, [value]);

  const handleTypeChange = (newType: ObjectiveType) => {
    setObjectiveType(newType);
    // Atualiza o texto automaticamente com o modelo correspondente
    onChange(generateObjectiveText(newType));
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>4. Objetivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="objective-type">Tipo de objetivo</Label>
            <Select value={objectiveType} onValueChange={(v) => handleTypeChange(v as ObjectiveType)}>
              <SelectTrigger id="objective-type" className="mt-1">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insalubridade">Insalubridade (NR-15)</SelectItem>
                <SelectItem value="periculosidade">Periculosidade (NR-16)</SelectItem>
                <SelectItem value="ambos">Ambos (NR-15 e NR-16)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="objective">Descreva o objetivo da perícia</Label>
          <Textarea
            id="objective"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex: Avaliar as condições de trabalho e a exposição a agentes insalubres e/ou periculosos, nos termos da Portaria nº 3214/78 (NR-15 e NR-16)."
            className="min-h-[120px] mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            O texto é gerado automaticamente conforme a seleção, mas você pode editar livremente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
