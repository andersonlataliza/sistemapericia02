import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type TemplateItem = {
  id: string;
  name: string;
  nr15_annexes: number[];
  nr16_annexes: number[];
  nr15_enquadramento?: boolean;
  nr16_enquadramento?: boolean;
  text: string;
  category?: "insalubrity" | "periculosity" | "methodology";
};

interface TemplatesSectionProps {
  value: TemplateItem[];
  onChange: (next: TemplateItem[]) => void;
  onApplyInsalubrity?: (t: TemplateItem) => void;
  onApplyPericulosity?: (t: TemplateItem) => void;
  onApplyMethodology?: (t: TemplateItem) => void;
  onSave?: (templates: TemplateItem[]) => void;
  onClose?: () => void;
  mode?: "both" | "insalubrity" | "periculosity" | "methodology";
}

const NR15 = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];
const NR16 = [1,2,3,4];
const NR15_AGENTS: Record<number,string> = {
  1: "Ruído Contínuo ou Intermitente",
  2: "Ruídos de Impacto",
  3: "Calor",
  4: "Iluminamento",
  5: "Radiação Ionizante",
  6: "Trabalho Sob Condição Hiperbárica",
  7: "Radiação não Ionizante",
  8: "Vibrações",
  9: "Frio",
  10: "Umidade",
  11: "Agentes Químicos I",
  12: "Poeiras e Minerais",
  13: "Agentes Químicos II",
  14: "Agentes Biológicos",
};
const NR16_AGENTS: Record<number,string> = {
  1: "Explosivos",
  2: "Inflamáveis",
  3: "Exposição à energia elétrica",
  4: "Segurança pessoal/patrimonial (roubos/assaltos)",
};

export default function TemplatesSection({ value, onChange, onApplyInsalubrity, onApplyPericulosity, onApplyMethodology, onSave, onClose, mode = "both" }: TemplatesSectionProps) {
  const [selectedId, setSelectedId] = useState<string>(value[0]?.id || "");
  const selected = useMemo(() => value.find(t => t.id === selectedId) || null, [value, selectedId]);

  useEffect(() => {
    if (!Array.isArray(value) || value.length === 0) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!selectedId || !value.some((t) => t.id === selectedId)) {
      setSelectedId(value[0].id);
    }
  }, [value, selectedId]);

  const addTemplate = () => {
    const id = Math.random().toString(36).slice(2);
    const category: TemplateItem["category"] =
      mode === "insalubrity" ? "insalubrity" : mode === "periculosity" ? "periculosity" : mode === "methodology" ? "methodology" : undefined;
    const next: TemplateItem[] = [
      ...value,
      {
        id,
        name: "Novo Template",
        nr15_annexes: [],
        nr16_annexes: [],
        nr15_enquadramento: false,
        nr16_enquadramento: false,
        text: "",
        category,
      },
    ];
    onChange(next);
    setSelectedId(id);
    onSave?.(next);
  };

  const updateSelected = (patch: Partial<TemplateItem>) => {
    if (!selected) return;
    const next = value.map(t => t.id === selected.id ? { ...t, ...patch } : t);
    onChange(next);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = value.filter(t => t.id !== selected.id);
    onChange(next);
    setSelectedId(next[0]?.id || "");
    onSave?.(next);
  };

  const toggleArrayItem = (arr: number[], n: number) => (arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n]);

  return (
    <Card className="shadow-card">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">
            {mode === "methodology" ? "Templates da Metodologia (Item 9)" : mode === "insalubrity" ? "Templates de Insalubridade (Item 16)" : mode === "periculosity" ? "Templates de Periculosidade (Item 19)" : "Templates para Itens 16 e 19"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedId} onValueChange={(v) => setSelectedId(v)}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {value.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={addTemplate}>Novo</Button>
            {selected && <Button size="sm" variant="destructive" onClick={removeSelected}>Remover</Button>}
            <Button size="sm" onClick={() => onSave?.(value)}>Salvar Templates</Button>
            <Button size="sm" variant="secondary" onClick={() => { onSave?.(value); onClose?.(); }}>Salvar e Fechar</Button>
            <Button size="sm" variant="outline" onClick={() => onClose?.()}>Fechar</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tplName" className="text-xs">Nome do Template</Label>
                <Input id="tplName" value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} className="h-9" />
              </div>
              {mode !== "periculosity" && mode !== "methodology" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Enquadramento (NR-15)</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={!!selected.nr15_enquadramento} onCheckedChange={(v) => updateSelected({ nr15_enquadramento: !!v })} />
                    <span className="text-sm">Sim</span>
                  </div>
                </div>
              ) : (
                <div />
              )}
              {mode !== "insalubrity" && mode !== "methodology" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Enquadramento (NR-16)</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={!!selected.nr16_enquadramento} onCheckedChange={(v) => updateSelected({ nr16_enquadramento: !!v })} />
                    <span className="text-sm">Sim</span>
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>

            {mode !== "methodology" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mode !== "periculosity" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Anexos da Insalubridade (NR-15)</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {NR15.map(n => (
                        <label key={`nr15-${n}`} className="flex items-center gap-2 text-xs">
                          <Checkbox checked={selected.nr15_annexes.includes(n)} onCheckedChange={() => updateSelected({ nr15_annexes: toggleArrayItem(selected.nr15_annexes, n) })} />
                          <span>Anexo {n} — {NR15_AGENTS[n]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
                {mode !== "insalubrity" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Anexos da Periculosidade (NR-16)</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {NR16.map(n => (
                        <label key={`nr16-${n}`} className="flex items-center gap-2 text-xs">
                          <Checkbox checked={selected.nr16_annexes.includes(n)} onCheckedChange={() => updateSelected({ nr16_annexes: toggleArrayItem(selected.nr16_annexes, n) })} />
                          <span>Anexo {n} — {NR16_AGENTS[n]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="tplText" className="text-xs">Texto do Template</Label>
              <Textarea id="tplText" value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} placeholder={mode === "methodology" ? "Texto que será inserido na Metodologia (Item 9)" : "Texto que será anexado aos resultados dos itens 16 e/ou 19"} className="min-h-[120px]" />
            </div>

            <div className="flex items-center gap-2 justify-end">
              {mode === "methodology" ? (
                <Button size="sm" onClick={() => onApplyMethodology?.(selected)}>Aplicar no Item 9</Button>
              ) : (
                <>
                  {mode !== "periculosity" && (
                    <Button size="sm" onClick={() => onApplyInsalubrity?.(selected)}>Aplicar no Item 16</Button>
                  )}
                  {mode !== "insalubrity" && (
                    <Button size="sm" variant="outline" onClick={() => onApplyPericulosity?.(selected)}>Aplicar no Item 19</Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
