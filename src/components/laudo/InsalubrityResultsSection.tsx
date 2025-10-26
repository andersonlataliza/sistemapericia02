import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface InsalubrityResultsSectionProps {
  value: string;
  onChange: (value: string) => void;
  onGenerateLLM?: () => Promise<void>;
}

export default function InsalubrityResultsSection({ value, onChange, onGenerateLLM }: InsalubrityResultsSectionProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>16. Resultados das Avaliações de Insalubridade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="insalubrityResults">
            Resultados e Conclusões sobre Insalubridade
          </Label>
          <p className="text-sm text-muted-foreground mt-1 mb-2">
            Mencione os 14 anexos da NR-15 conforme aplicável para avaliar a exposição
          </p>
          <Textarea
            id="insalubrityResults"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva os resultados das avaliações considerando os anexos da NR-15..."
            className="min-h-[200px] mt-2"
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onGenerateLLM} disabled={!onGenerateLLM}>
            Gerar parecer via IA (NR-15 + EPIs)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}