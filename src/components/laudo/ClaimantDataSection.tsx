import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Position {
  title: string;
  period: string;
  obs?: string;
}

interface ClaimantData {
  name?: string;
  positions?: Position[];
}

interface ClaimantDataSectionProps {
  value: ClaimantData;
  onChange: (value: ClaimantData) => void;
  syncedFromProcess?: boolean;
}

export default function ClaimantDataSection({ value, onChange, syncedFromProcess }: ClaimantDataSectionProps) {
  const positions = value.positions || [];

  const addPosition = () => {
    onChange({
      ...value,
      positions: [...positions, { title: '', period: '', obs: '' }]
    });
  };

  const removePosition = (index: number) => {
    onChange({
      ...value,
      positions: positions.filter((_, i) => i !== index)
    });
  };

  const updatePosition = (index: number, field: keyof Position, fieldValue: string) => {
    const updatedPositions = [...positions];
    updatedPositions[index] = { ...updatedPositions[index], [field]: fieldValue };
    onChange({ ...value, positions: updatedPositions });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>2. Dados da(o) Reclamante</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="claimantFullName">Nome Completo</Label>
            {syncedFromProcess && (
              <Badge variant="secondary" className="text-[10px]">Sincronizado do processo</Badge>
            )}
          </div>
          <Input
            id="claimantFullName"
            value={value.name || ''}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Nome completo do reclamante"
            className="mt-2"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Funções e Períodos Laborais</Label>
            <Button onClick={addPosition} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Função
            </Button>
          </div>

          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma função adicionada.</p>
          ) : (
            <div className="space-y-3">
              {positions.map((position, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium">Função {index + 1}</h4>
                    <Button
                      onClick={() => removePosition(index)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Função</Label>
                      <Input
                        value={position.title}
                        onChange={(e) => updatePosition(index, 'title', e.target.value)}
                        placeholder="Ex: Auxiliar de produção"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Período</Label>
                      <Input
                        value={position.period}
                        onChange={(e) => updatePosition(index, 'period', e.target.value)}
                        placeholder="Ex: 01/04/2024 a 31/10/2024"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input
                      value={position.obs || ''}
                      onChange={(e) => updatePosition(index, 'obs', e.target.value)}
                      placeholder="Observações (opcional)"
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
