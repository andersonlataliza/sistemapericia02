import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface PericulosityResultsSectionProps {
  value: string;
  onChange: (value: string) => void;
  rowsInAnalysis?: { annex: number; agent: string; obs?: string }[];
  templates?: { id: string; name: string; nr16_annexes?: number[]; nr16_enquadramento?: boolean; text?: string }[];
  onApplyTemplate?: (t: any) => void;
  onCreateTemplate?: () => void;
  onManageTemplates?: () => void;
}

export default function PericulosityResultsSection({ value, onChange, rowsInAnalysis, templates, onApplyTemplate, onCreateTemplate, onManageTemplates }: PericulosityResultsSectionProps) {
  const rows = rowsInAnalysis || [];
  const [byAnnex, setByAnnex] = useState<Record<number, string>>({});
  const [freeText, setFreeText] = useState<string>("");
  const [tplId, setTplId] = useState<string>("");
  const availableTemplates = useMemo(() => {
    const list = Array.isArray(templates) ? templates : [];
    return list;
  }, [templates]);
  const selectedTpl = useMemo(() => availableTemplates.find((t) => t.id === tplId) || null, [availableTemplates, tplId]);
  const extractByAnnex = (text: string): Record<number, string> => {
    const lines = String(text || "").split(/\r?\n/);
    const map: Record<number, string> = {};
    let current: number | null = null;
    let buffer: string[] = [];
    const flush = () => {
      if (current != null) map[current] = buffer.join("\n").trim();
      current = null;
      buffer = [];
    };
    for (const line of lines) {
      const m = line.match(/^Resultado\s+Anexo\s*(\d+)\s*[—-]/i);
      if (m) {
        flush();
        current = parseInt(m[1], 10);
        continue;
      }
      buffer.push(line);
    }
    flush();
    return map;
  };
  const combined = useMemo(() => {
    if (!rows.length) return value || "";
    const filled = rows.filter((r) => String(byAnnex[r.annex] || "").trim());
    const parts = filled.map((r) => {
      const head = `Resultado Anexo ${r.annex} — ${r.agent}`;
      const body = String(byAnnex[r.annex] || "").trim();
      return `${head}\n\n${body}`;
    });
    return parts.join("\n\n");
  }, [rows, byAnnex, value]);
  useEffect(() => {
    if (rows.length && String(value || "").trim()) {
      const parsed = extractByAnnex(String(value || ""));
      setByAnnex((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          const saved = parsed[r.annex];
          if (saved && !next[r.annex]) next[r.annex] = saved;
        });
        return next;
      });
    }
  }, [rows.length, value]);
  useEffect(() => {
    if (rows.length && combined.trim()) onChange(combined);
  }, [combined]);
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>19. Resultados das Avaliações de Periculosidade</CardTitle>
        {(availableTemplates.length > 0 || !!onCreateTemplate || !!onManageTemplates) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={tplId} onValueChange={(v) => setTplId(v)}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Selecionar template (NR-16)" />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={!selectedTpl}
              onClick={() => {
                if (!selectedTpl) return;
                if (rows.length > 0) {
                  const annexSet = new Set((selectedTpl.nr16_annexes || []).map(Number));
                  const targets = rows.filter(r => annexSet.has(Number(r.annex)));
                  if (targets.length > 0) {
                    setByAnnex(prev => {
                      const next = { ...prev };
                      targets.forEach(r => {
                        const eq = selectedTpl.nr16_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                        const body = `${eq}\n${selectedTpl.text || ""}`.trim();
                        next[r.annex] = body;
                      });
                      return next;
                    });
                } else {
                  const eq = selectedTpl.nr16_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                  const body = `${eq}\n${selectedTpl.text || ""}`.trim();
                  setFreeText(prev => [String(prev || '').trim(), body].filter(Boolean).join('\n\n'));
                  onChange([String(value || '').trim(), body].filter(Boolean).join('\n\n'));
                }
              } else {
                const eq = selectedTpl.nr16_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                const body = `${eq}\n${selectedTpl.text || ""}`.trim();
                setFreeText(prev => [String(prev || '').trim(), body].filter(Boolean).join('\n\n'));
                onChange([String(value || '').trim(), body].filter(Boolean).join('\n\n'));
              }
            }}
            >Aplicar Template</Button>
            {!!onCreateTemplate && (
              <Button type="button" size="sm" variant="outline" onClick={onCreateTemplate}>Novo Template</Button>
            )}
            {!!onManageTemplates && (
              <Button type="button" size="sm" variant="secondary" onClick={onManageTemplates}>Editar Templates</Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <div>
            <Label htmlFor="periculosityResults">
              Resultados e Conclusões sobre Periculosidade
            </Label>
            <Textarea
              id="periculosityResults"
              value={freeText || value || ""}
              onChange={(e) => { setFreeText(e.target.value); onChange(e.target.value); }}
              placeholder="Descreva os resultados das avaliações de periculosidade e se houve exposição..."
              className="min-h-[200px] mt-2"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <Card key={r.annex} className="border">
                <CardHeader>
                  <CardTitle>{`Resultado Anexo ${r.annex} — ${r.agent}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={byAnnex[r.annex] || ""}
                    onChange={(e) => setByAnnex((prev) => ({ ...prev, [r.annex]: e.target.value }))}
                    placeholder="Descreva o resultado desta avaliação"
                    className="min-h-[140px]"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
