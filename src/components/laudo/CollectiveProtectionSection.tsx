import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface CollectiveProtectionSectionProps {
  value: string;
  onChange: (value: string) => void;
}

const defaultOptions = [
  "Equipamentos de combate a incêndio",
  "Enclausuramento",
  "Ventilação exaustora",
  "Sinalização",
];

export default function CollectiveProtectionSection({ value, onChange }: CollectiveProtectionSectionProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [others, setOthers] = useState<string[]>([]);
  const [newOther, setNewOther] = useState<string>("");

  const toggleOption = (opt: string) => {
    setSelected((prev) => (prev.includes(opt) ? prev.filter((i) => i !== opt) : [...prev, opt]));
  };

  const addOther = () => {
    const item = newOther.trim();
    if (!item) return;
    if (!others.includes(item)) setOthers((prev) => [...prev, item]);
    setNewOther("");
  };

  const removeOther = (item: string) => {
    setOthers((prev) => prev.filter((i) => i !== item));
    setSelected((prev) => prev.filter((i) => i !== item));
  };

  const insertSelectionIntoDescription = () => {
    if (selected.length === 0) return;
    const block = `\n\nEPCs selecionados:\n${selected.map((s) => `- ${s}`).join("\n")}`;
    onChange(`${value}${block}`);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>14. Equipamentos de Proteção Coletiva (EPCs)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Selecione EPCs disponíveis</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {defaultOptions.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox id={`epc-${opt}`} checked={selected.includes(opt)} onCheckedChange={() => toggleOption(opt)} />
                <label htmlFor={`epc-${opt}`} className="text-sm cursor-pointer">
                  {opt}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Outros (cadastrar e selecionar)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Barreira física, isolamento, alarme de gás..."
              value={newOther}
              onChange={(e) => setNewOther(e.target.value)}
            />
            <Button type="button" onClick={addOther} variant="secondary">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          {others.length > 0 && (
            <div className="space-y-2">
              {others.map((item) => (
                <div key={item} className="flex items-center justify-between border rounded-md p-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`other-${item}`}
                      checked={selected.includes(item)}
                      onCheckedChange={() => toggleOption(item)}
                    />
                    <label htmlFor={`other-${item}`} className="text-sm cursor-pointer">
                      {item}
                    </label>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOther(item)} aria-label={`Remover ${item}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="collectiveProtection">Descrição dos EPCs</Label>
          <Textarea
            id="collectiveProtection"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva os equipamentos de proteção coletiva disponíveis no local de trabalho..."
            className="min-h-[150px] mt-2"
          />
          <div className="flex justify-end">
            <Button type="button" onClick={insertSelectionIntoDescription} disabled={selected.length === 0}>
              Transferir seleção para a descrição
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}