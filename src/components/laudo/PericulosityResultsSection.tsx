import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PericulosityResultsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PericulosityResultsSection({ value, onChange }: PericulosityResultsSectionProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>19. Resultados das Avaliações de Periculosidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="periculosityResults">
            Resultados e Conclusões sobre Periculosidade
          </Label>
          <Textarea
            id="periculosityResults"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva os resultados das avaliações de periculosidade e se houve exposição..."
            className="min-h-[200px] mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}