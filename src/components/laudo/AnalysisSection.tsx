import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AnalysisSectionProps {
  insalubrity: string;
  periculosity: string;
  onInsalubrityChange: (value: string) => void;
  onPericulosityChange: (value: string) => void;
  onAnnexesInAnalysis?: (rows: AnnexRow[]) => void;
  onNR16AnnexesInAnalysis?: (rows: AnnexRow[]) => void;
  onUpdateNR15AnnexExposure?: (rows: AnnexRow[]) => void;
  onUpdateNR16AnnexExposure?: (rows: AnnexRow[]) => void;
  onTablesChanged?: (nr15: AnnexRow[], nr16: AnnexRow[]) => void;
  showNR15Tables?: boolean;
  showNR16Tables?: boolean;
  onIncludeNR15Table?: () => void;
  onIncludeNR16Table?: () => void;
  onRemoveNR15Table?: () => void;
  onRemoveNR16Table?: () => void;
  initialNR15?: AnnexRow[];
  initialNR16?: AnnexRow[];
}

type AnnexRow = {
  annex: number;
  agent: string;
  exposure: "Em análise" | "Não ocorre exposição" | "Ocorre exposição" | "Revogado";
  obs: string;
};

const defaultAnnexesNR15: AnnexRow[] = [
  { annex: 1, agent: "Ruído Contínuo ou Intermitente", exposure: "Não ocorre exposição", obs: "85 dB (A); Análise no item 10." },
  { annex: 2, agent: "Ruídos de Impacto", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 3, agent: "Calor", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 4, agent: "Iluminamento", exposure: "Não ocorre exposição", obs: "Revogado pela Portaria MTPS 3.751/1990" },
  { annex: 5, agent: "Radiação Ionizante", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 6, agent: "Trabalho Sob Condição Hiperbárica", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 7, agent: "Radiação não Ionizante", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 8, agent: "Vibrações", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 9, agent: "Frio", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 10, agent: "Umidade", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 11, agent: "Agentes Químicos I", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 12, agent: "Poeiras e Minerais", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 13, agent: "Agentes Químicos II", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 14, agent: "Agentes Biológicos", exposure: "Não ocorre exposição", obs: "------------" },
];

const defaultAnnexesNR16: AnnexRow[] = [
  { annex: 1, agent: "Explosivos", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 2, agent: "Inflamáveis", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 3, agent: "Exposição à energia elétrica", exposure: "Não ocorre exposição", obs: "------------" },
  { annex: 4, agent: "Segurança pessoal/patrimonial (roubos/assaltos)", exposure: "Não ocorre exposição", obs: "------------" },
];

export default function AnalysisSection({
  insalubrity,
  periculosity,
  onInsalubrityChange,
  onPericulosityChange,
  onAnnexesInAnalysis,
  onNR16AnnexesInAnalysis,
  onUpdateNR15AnnexExposure,
  onUpdateNR16AnnexExposure,
  onTablesChanged,
  showNR15Tables = false,
  showNR16Tables = false,
  onIncludeNR15Table,
  onIncludeNR16Table,
  onRemoveNR15Table,
  onRemoveNR16Table,
  initialNR15,
  initialNR16,
}: AnalysisSectionProps) {
  const [annexesNR15, setAnnexesNR15] = useState<AnnexRow[]>(defaultAnnexesNR15);
  const [annexesNR16, setAnnexesNR16] = useState<AnnexRow[]>(defaultAnnexesNR16);

  const exposureOptions: AnnexRow["exposure"][] = ["Em análise", "Não ocorre exposição", "Ocorre exposição", "Revogado"];

  useEffect(() => {
    onTablesChanged?.(annexesNR15, annexesNR16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const has15 = Array.isArray(initialNR15) && initialNR15.length > 0;
      const has16 = Array.isArray(initialNR16) && initialNR16.length > 0;
      if (has15) {
        setAnnexesNR15(initialNR15 as AnnexRow[]);
      }
      if (has16) {
        setAnnexesNR16(initialNR16 as AnnexRow[]);
      }
      if (has15 || has16) {
        onTablesChanged?.(has15 ? (initialNR15 as AnnexRow[]) : annexesNR15, has16 ? (initialNR16 as AnnexRow[]) : annexesNR16);
        try {
          const analyze15 = (has15 ? (initialNR15 as AnnexRow[]) : annexesNR15).filter((r) => r.exposure === "Em análise");
          if (analyze15.length) onAnnexesInAnalysis?.(analyze15);
          const analyze16 = (has16 ? (initialNR16 as AnnexRow[]) : annexesNR16).filter((r) => r.exposure === "Em análise");
          if (analyze16.length) onNR16AnnexesInAnalysis?.(analyze16);
        } catch {}
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNR15, initialNR16]);

  const updateExposureNR15 = (index: number, value: AnnexRow["exposure"]) => {
    setAnnexesNR15((prev) => {
      const next = [...prev];
      const was = next[index].exposure;
      next[index] = { ...next[index], exposure: value };
      onUpdateNR15AnnexExposure?.([next[index]]);
      onTablesChanged?.(next, annexesNR16);
      if (value === "Em análise" && was !== "Em análise") {
        onAnnexesInAnalysis?.([next[index]]);
      }
      return next;
    });
  };

  const updateObsNR15 = (index: number, value: string) => {
    setAnnexesNR15((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], obs: value };
      onUpdateNR15AnnexExposure?.([next[index]]);
      onTablesChanged?.(next, annexesNR16);
      return next;
    });
  };

  const updateExposureNR16 = (index: number, value: AnnexRow["exposure"]) => {
    setAnnexesNR16((prev) => {
      const next = [...prev];
      const was = next[index].exposure;
      next[index] = { ...next[index], exposure: value };
      onUpdateNR16AnnexExposure?.([next[index]]);
      onTablesChanged?.(annexesNR15, next);
      if (value === "Em análise" && was !== "Em análise") {
        onNR16AnnexesInAnalysis?.([next[index]]);
      }
      return next;
    });
  };

  const updateObsNR16 = (index: number, value: string) => {
    setAnnexesNR16((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], obs: value };
      onUpdateNR16AnnexExposure?.([next[index]]);
      onTablesChanged?.(annexesNR15, next);
      return next;
    });
  };

  const tableToText = (title: string, rows: AnnexRow[]) => {
    const header = `\n\n${title}:\n`;
    const lines = rows
      .map((r) => `- Anexo ${r.annex} — ${r.agent} | Exposição: ${r.exposure} | Obs: ${r.obs || "------------"}`)
      .join("\n");
    return header + lines + "\n";
  };

  const summaryFromRows = (title: string, rows: AnnexRow[]) => {
    const counts = rows.reduce(
      (acc, r) => {
        acc[r.exposure] = (acc[r.exposure] || 0) + 1;
        return acc;
      },
      {} as Record<AnnexRow["exposure"], number>
    );
    const occurs = rows.filter((r) => r.exposure === "Ocorre exposição");
    const analyzing = rows.filter((r) => r.exposure === "Em análise");
    const header = `\n\nResumo ${title}:\n`;
    const lines = [
      `- Ocorre exposição: ${counts["Ocorre exposição"] || 0}`,
      `- Em análise: ${counts["Em análise"] || 0}`,
      `- Não ocorre exposição: ${counts["Não ocorre exposição"] || 0}`,
      `- Revogado: ${counts["Revogado"] || 0}`,
      occurs.length ? `Itens com 'Ocorre exposição':\n${occurs.map((r) => `  - Anexo ${r.annex} — ${r.agent}`).join("\n")}` : undefined,
      analyzing.length ? `Itens 'Em análise':\n${analyzing.map((r) => `  - Anexo ${r.annex} — ${r.agent}`).join("\n")}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    return header + lines + "\n";
  };

  const insertNR15TableIntoAnalysis = () => {
    onInsalubrityChange(insalubrity + tableToText("Tabela NR-15 (Anexos e Exposição)", annexesNR15));
  };

  const insertNR15SummaryIntoAnalysis = () => {
    onInsalubrityChange(insalubrity + summaryFromRows("NR-15", annexesNR15));
  };

  const insertNR16TableIntoAnalysis = () => {
    onPericulosityChange(periculosity + tableToText("Tabela NR-16 (Anexos e Exposição)", annexesNR16));
  };

  const insertNR16SummaryIntoAnalysis = () => {
    onPericulosityChange(periculosity + summaryFromRows("NR-16", annexesNR16));
  };

  const rows16Analyzing = annexesNR16.filter((r) => r.exposure === "Em análise");

  const filteredInsalubrity = useMemo(() => {
    const text = String(insalubrity || "").trim();
    if (!text) return "";
    const meaningful = text.split(/\r?\n/).filter((l) => l.trim());
    if (!meaningful.length) return "";
    const allAuto = meaningful.every((l) => /^Análise\s+Anexo\s*\d+\s*[—-]/i.test(l));
    return allAuto ? "" : insalubrity;
  }, [insalubrity]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>15. Análises de Insalubridade e Periculosidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="insalubrity" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="insalubrity">Insalubridade</TabsTrigger>
            <TabsTrigger value="periculosity">Periculosidade</TabsTrigger>
          </TabsList>

          <TabsContent value="insalubrity" className="space-y-6">
            <div>
              <Label htmlFor="insalubrity">Análise de Insalubridade</Label>
              <Textarea
                id="insalubrity"
                value={filteredInsalubrity}
                onChange={(e) => onInsalubrityChange(e.target.value)}
                placeholder="Descreva a análise da exposição a agentes insalubres, conforme NR-15..."
                className="min-h-[200px] mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Tabela de anexos e exposição (NR-15)</Label>
              <p className="text-xs text-muted-foreground">Estado inicial: Não ocorre exposição</p>
              <div className="flex justify-end mb-2">
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setAnnexesNR15(defaultAnnexesNR15);
                  onUpdateNR15AnnexExposure?.(defaultAnnexesNR15);
                  onTablesChanged?.(defaultAnnexesNR15, annexesNR16);
                }}>Resetar para padrão (NR-15)</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anexo</TableHead>
                    <TableHead>Agentes</TableHead>
                    <TableHead>Exposição</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annexesNR15.map((row, idx) => (
                    <TableRow key={row.annex}>
                      <TableCell>{`Anexo ${row.annex}`}</TableCell>
                      <TableCell>{row.agent}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <Select value={row.exposure} onValueChange={(v) => updateExposureNR15(idx, v as AnnexRow["exposure"]) }>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {exposureOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.obs}
                          onChange={(e) => updateObsNR15(idx, e.target.value)}
                          placeholder="------------"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button type="button" onClick={() => { onTablesChanged?.(annexesNR15, annexesNR16); onIncludeNR15Table?.(); }}>
                  Transferir tabela para o laudo
                </Button>
                <Button type="button" variant="outline" onClick={() => { onRemoveNR15Table?.(); }}>
                  Remover tabela do laudo
                </Button>
                <Button type="button" variant="secondary" onClick={insertNR15TableIntoAnalysis}>
                  Transferir tabela para o texto
                </Button>
                <Button type="button" onClick={insertNR15SummaryIntoAnalysis}>
                  Gerar resumo automático
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="periculosity" className="space-y-6">
            <div>
              <Label htmlFor="periculosity">Análise de Periculosidade</Label>
              <Textarea
                id="periculosity"
                value={periculosity}
                onChange={(e) => onPericulosityChange(e.target.value)}
                placeholder="Descreva a análise da exposição a agentes periculosos, conforme NR-16..."
                className="min-h-[200px] mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Tabela de anexos e exposição (NR-16)</Label>
              <p className="text-xs text-muted-foreground">Estado inicial: Não ocorre exposição</p>
              <div className="flex justify-end mb-2">
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setAnnexesNR16(defaultAnnexesNR16);
                  onUpdateNR16AnnexExposure?.(defaultAnnexesNR16);
                  onTablesChanged?.(annexesNR15, defaultAnnexesNR16);
                }}>Resetar para padrão (NR-16)</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anexo</TableHead>
                    <TableHead>Agentes</TableHead>
                    <TableHead>Exposição</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annexesNR16.map((row, idx) => (
                    <TableRow key={row.annex}>
                      <TableCell>{`Anexo ${row.annex}`}</TableCell>
                      <TableCell>{row.agent}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <Select value={row.exposure} onValueChange={(v) => updateExposureNR16(idx, v as AnnexRow["exposure"]) }>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {exposureOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.obs}
                          onChange={(e) => updateObsNR16(idx, e.target.value)}
                          placeholder="------------"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button type="button" onClick={() => { onTablesChanged?.(annexesNR15, annexesNR16); onIncludeNR16Table?.(); }}>
                  Transferir tabela para o laudo
                </Button>
                <Button type="button" variant="outline" onClick={() => { onRemoveNR16Table?.(); }}>
                  Remover tabela do laudo
                </Button>
                <Button type="button" variant="secondary" onClick={insertNR16TableIntoAnalysis}>
                  Transferir tabela para o texto
                </Button>
                <Button type="button" onClick={insertNR16SummaryIntoAnalysis}>
                  Gerar resumo automático
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
