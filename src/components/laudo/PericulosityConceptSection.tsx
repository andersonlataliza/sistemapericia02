import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PericulosityConceptSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PericulosityConceptSection({ value, onChange }: PericulosityConceptSectionProps) {
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
            className="min-h-[150px] mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}