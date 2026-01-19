import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PericulosityConceptSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PericulosityConceptSection({ value, onChange }: PericulosityConceptSectionProps) {
  const referenceText = `O conceito de Periculosidade é regido pela Consolidação das Leis do Trabalho (CLT) em seu artigo 193 que estabelece:
São consideradas atividades ou operações perigosas, na forma da regulamentação aprovada pelo Ministério do Trabalho e Emprego, aquelas que, por sua natureza ou métodos de trabalho, impliquem risco acentuado em virtude de exposição permanente do trabalhador a:
I - Inflamáveis, explosivos ou energia elétrica; (Incluído pela Lei nº 12.740, de2012)
II - roubos ou outras espécies de violência física nas atividades profissionais de segurança pessoal ou patrimonial. (Incluído pela Lei nº 12.740, de 2012)
§ 1º - O trabalho em condições de periculosidade assegura ao empregado um adicional de 30% (trinta por cento) sobre o salário sem os acréscimos resultantes de gratificações, prêmios ou participações nos lucros da empresa. (Incluído pela Lei nº 6.514, de 22.12.1977)
§ 2º - O empregado poderá optar pelo adicional de insalubridade que porventura lhe seja devido. (Incluído pela Lei nº 6.514, de 22.12.1977)
§ 3º Serão descontados ou compensados do adicional outros da mesma natureza eventualmente já concedidos ao vigilante por meio de acordo coletivo. (Incluído pela Lei nº 12.740, de 2012).
§ 4º São também consideradas perigosas as atividades de trabalhador em motocicleta. (Incluído pela Lei nº 12.997, de 2014).`;

  const insertReference = () => {
    const next = String(value || "").trim()
      ? `${value}\n\n${referenceText}`
      : referenceText;
    onChange(next);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>17. Conceito de Periculosidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="periculosityConcept">Definição e Conceitos</Label>
          <Textarea
            id="periculosityConcept"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva os conceitos de periculosidade conforme a NR-16..."
            className="min-h-[150px] mt-2 leading-[1.5]"
          />
          <div className="flex justify-end mt-2">
            <Button type="button" variant="secondary" onClick={insertReference}>
              Inserir referência de texto
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}