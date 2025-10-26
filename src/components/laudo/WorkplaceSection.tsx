import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkplaceData {
  area?: string;
  ceiling_height?: string;
  floor?: string;
  construction?: string[];
  roofing?: string[];
  flooring?: string[];
  walls?: string[];
  lighting?: string[];
  ventilation?: string[];
  special_condition_type?: "none" | "ceu_aberto" | "veiculo" | "outra";
  special_condition_description?: string;
}

interface WorkplaceSectionProps {
  value: WorkplaceData;
  onChange: (value: WorkplaceData) => void;
}

export default function WorkplaceSection({ value, onChange }: WorkplaceSectionProps) {
  const updateField = (field: keyof WorkplaceData, newValue: any) => {
    onChange({ ...value, [field]: newValue });
  };

  const toggleArrayValue = (field: keyof WorkplaceData, item: string) => {
    const currentArray = (value[field] as string[]) || [];
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    updateField(field, newArray);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>11. Características do Local de Trabalho</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Condição do Local de Trabalho</Label>
          <Select
            value={value.special_condition_type || "none"}
            onValueChange={(val) => updateField("special_condition_type", val as WorkplaceData["special_condition_type"])}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a condição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Usar tabela padrão</SelectItem>
              <SelectItem value="ceu_aberto">Céu aberto</SelectItem>
              <SelectItem value="veiculo">Veículo</SelectItem>
              <SelectItem value="outra">Outra condição</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(value.special_condition_type || "none") === "none" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="area">Área Superior (m²)</Label>
                <Input
                  id="area"
                  value={value.area || ""}
                  onChange={(e) => updateField("area", e.target.value)}
                  placeholder="Ex: 1000"
                />
              </div>
              <div>
                <Label htmlFor="ceiling">Pé-direito (metros)</Label>
                <Input
                  id="ceiling"
                  value={value.ceiling_height || ""}
                  onChange={(e) => updateField("ceiling_height", e.target.value)}
                  placeholder="Ex: 8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Construção</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {["Alvenaria", "Pré-moldada", "Metálica", "Madeira", "Lona"].map((item) => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`const-${item}`}
                      checked={(value.construction || []).includes(item)}
                      onCheckedChange={() => toggleArrayValue("construction", item)}
                    />
                    <label htmlFor={`const-${item}`} className="text-sm cursor-pointer">
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cobertura</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {["Fibrocimento", "Alumínio", "Laje Concreto", "Metálica", "Telhas"].map((item) => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`roof-${item}`}
                      checked={(value.roofing || []).includes(item)}
                      onCheckedChange={() => toggleArrayValue("roofing", item)}
                    />
                    <label htmlFor={`roof-${item}`} className="text-sm cursor-pointer">
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Iluminação</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {["Natural", "LED", "Vapor metálico", "Halógena", "Fluorescente", "Incandescente"].map((item) => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`light-${item}`}
                      checked={(value.lighting || []).includes(item)}
                      onCheckedChange={() => toggleArrayValue("lighting", item)}
                    />
                    <label htmlFor={`light-${item}`} className="text-sm cursor-pointer">
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ventilação</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {["Natural", "Ar-condicionado split", "Ar-condicionado central", "Ventilador", "Exaustor"].map((item) => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`vent-${item}`}
                      checked={(value.ventilation || []).includes(item)}
                      onCheckedChange={() => toggleArrayValue("ventilation", item)}
                    />
                    <label htmlFor={`vent-${item}`} className="text-sm cursor-pointer">
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="special-desc">Descrição da Condição</Label>
            <Textarea
              id="special-desc"
              value={value.special_condition_description || ""}
              onChange={(e) => updateField("special_condition_description", e.target.value)}
              placeholder="Ex.: Atividade realizada a céu aberto/veículo/condição específica. Descreva estruturas, proteção, iluminação, ventilação e demais aspectos relevantes."
              className="min-h-[160px]"
            />
            <p className="text-xs text-muted-foreground">A tabela padrão fica desabilitada quando uma condição especial é selecionada.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
