import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

interface DefendantDataSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DefendantDataSection({ value, onChange }: DefendantDataSectionProps) {
  const [branch, setBranch] = useState("");
  const [risk, setRisk] = useState("");

  const buildText = (b: string, r: string) => {
    const branchText = b?.trim() || "[ramo de atuação]";
    const riskText = r?.trim() || "[grau]";
    return (
      `A Reclamada atua no ramo de ${branchText}, ` +
      `sendo enquadrada no grau de risco “${riskText}”, ` +
      `segundo a classificação de atividades constantes da NR-4, Portaria n° 3214/78 do MTE.`
    );
  };

  useEffect(() => {
    // Evita sobrescrever o valor existente ao montar a página.
    // Só atualiza o texto gerado quando pelo menos um dos campos foi preenchido.
    if (branch !== "" || risk !== "") {
      onChange(buildText(branch, risk));
    }
  }, [branch, risk]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>3. Dados da Reclamada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="companyBranch">Ramo de atuação da empresa</Label>
            <Input
              id="companyBranch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Ex: Fabricação de artefatos de material plástico..."
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="riskDegree">Grau de risco (NR-4)</Label>
            <Input
              id="riskDegree"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              placeholder="Ex: 3"
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="defendantData">Texto gerado</Label>
          <Textarea
            id="defendantData"
            value={value || buildText(branch, risk)}
            readOnly
            className="min-h-[120px] mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Edite apenas os campos acima; o texto é montado automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}