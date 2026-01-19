import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState } from "react";

interface ConclusionSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ConclusionSection({ value, onChange }: ConclusionSectionProps) {
  const [insalubrity, setInsalubrity] = useState<string>("");
  const [periculosity, setPericulosity] = useState<string>("nao");
  const [period, setPeriod] = useState<string>("");
  const [writeMode, setWriteMode] = useState<string>("append");

  const generateConclusion = () => {
    const header =
      "Considerando a visita pericial realizada, as informações obtidas, os\n" +
      "fatos observados e as análises efetuadas, conclui-se, que as atividades desempenhadas pelo(a) reclamante, foram:";

    let insalText = "";
    const periodText = period.trim() ? ` por ${period.trim()}` : "";
    switch (insalubrity) {
      case "minimo":
        insalText = `Foram insalubres em grau mínimo (10%)${periodText}`;
        break;
      case "medio":
        insalText = `Foram insalubres em grau médio (20%)${periodText}`;
        break;
      case "maximo":
        insalText = `Foram insalubres em grau máximo (40%)${periodText}`;
        break;
      case "none":
      default:
        insalText = "Não foram insalubres";
    }

    const pericText = periculosity === "sim" ? "Foram perigosas" : "Não foram perigosas";

    const body = `${header}\n\n${insalText}.\n\n${pericText}.`;

    const newValue = writeMode === "replace" ? body : `${value ? value + "\n\n" : ""}${body}`;
    onChange(newValue);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>21. Conclusão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Insalubridade</Label>
            <Select value={insalubrity} onValueChange={setInsalubrity}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o grau de insalubridade" />
              </SelectTrigger>
              <SelectContent>
                {/* Item não pode ter value="" no Radix Select */}
                <SelectItem value="none">Sem insalubridade</SelectItem>
                <SelectItem value="minimo">Insalubridade de Grau Mínimo (10%)</SelectItem>
                <SelectItem value="medio">Insalubridade de Grau Médio (20%)</SelectItem>
                <SelectItem value="maximo">Insalubridade de Grau Máximo (40%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Periculosidade</Label>
            <Select value={periculosity} onValueChange={setPericulosity}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a periculosidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não Periculosa</SelectItem>
                <SelectItem value="sim">Periculosa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Período (opcional)</Label>
            <Input
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Ex.: 5 meses"
            />
          </div>

          <div className="space-y-2">
            <Label>Modo de escrita</Label>
            <Select value={writeMode} onValueChange={setWriteMode}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha como inserir o texto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="append">Acrescentar ao texto existente</SelectItem>
                <SelectItem value="replace">Substituir o texto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={generateConclusion} variant="secondary">
            Gerar texto da conclusão
          </Button>
        </div>

        <div>
          <Label htmlFor="conclusion">Conclusão do Laudo Pericial</Label>
          <Textarea
            id="conclusion"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Conclusão objetiva indicando períodos, graus e agentes identificados..."
            className="min-h-[150px] mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}
