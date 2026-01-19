import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface IdentificationData {
  processNumber?: string;
  claimantName?: string;
  defendantName?: string;
  court?: string;
}

interface IdentificationsSectionProps {
  value: IdentificationData;
  onChange: (value: IdentificationData) => void;
  courtOptions?: string[];
}

export default function IdentificationsSection({ value, onChange, courtOptions }: IdentificationsSectionProps) {
  const updateField = (field: keyof IdentificationData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>1. Identificações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="processNumber">Número do Processo</Label>
          <Input
            id="processNumber"
            value={value.processNumber || ''}
            onChange={(e) => updateField('processNumber', e.target.value)}
            placeholder="Ex: 1000899-21.2025.5.02.0261"
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="claimantName">Reclamante</Label>
          <Input
            id="claimantName"
            value={value.claimantName || ''}
            onChange={(e) => updateField('claimantName', e.target.value)}
            placeholder="Nome do reclamante"
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="defendantName">Reclamada</Label>
          <Input
            id="defendantName"
            value={value.defendantName || ''}
            onChange={(e) => updateField('defendantName', e.target.value)}
            placeholder="Nome da reclamada"
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="court">Vara / Tribunal</Label>
          {Array.isArray(courtOptions) && courtOptions.length > 0 ? (
            <Select
              value={value.court || undefined}
              onValueChange={(v) => updateField('court', v)}
            >
              <SelectTrigger id="court">
                <SelectValue placeholder="Selecione a vara/tribunal" />
              </SelectTrigger>
              <SelectContent>
                {courtOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="court"
              value={value.court || ''}
              onChange={(e) => updateField('court', e.target.value)}
              placeholder="Ex: 01ª Vara do Trabalho de Diadema"
              className="mt-2"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
