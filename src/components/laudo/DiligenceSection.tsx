import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DiligenceData {
  location?: string;
  date?: string;
  time?: string;
  description?: string;
}

interface DiligenceSectionProps {
  value: DiligenceData;
  onChange: (value: DiligenceData) => void;
}

export default function DiligenceSection({ value, onChange }: DiligenceSectionProps) {
  const updateField = (field: keyof DiligenceData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>7. Diligência</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="diligenceLocation">Local da Vistoria</Label>
          <Input
            id="diligenceLocation"
            value={value.location || ''}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="Ex: Rua José Bonifácio, nº 1166 - Diadema - CEP: 09.980-150"
            className="mt-2"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="diligenceDate">Data</Label>
            <Input
              id="diligenceDate"
              type="date"
              value={value.date || ''}
              onChange={(e) => updateField('date', e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="diligenceTime">Horário</Label>
            <Input
              id="diligenceTime"
              type="time"
              value={value.time || ''}
              onChange={(e) => updateField('time', e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="diligenceDescription">Descrição da Diligência</Label>
          <Textarea
            id="diligenceDescription"
            value={value.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Descreva o que foi realizado durante a diligência..."
            className="min-h-[120px] mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}