import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface FlammableDefinitionSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FlammableDefinitionSection({ value, onChange }: FlammableDefinitionSectionProps) {
  const insertNR20Definition = () => {
    const sentence = "De acordo com a NR 20, os líquidos inflamáveis possuem ponto de fulgor de < 60°C.";
    onChange(sentence);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>18. Definição de Materiais Inflamáveis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="flammableDefinition">Definição e Classificação</Label>
          <Textarea
            id="flammableDefinition"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva a definição e classificação de materiais inflamáveis..."
            className="min-h-[150px] mt-2"
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={insertNR20Definition}>
            Inserir referência NR-20 (ponto de fulgor {"<"} 60°C)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
