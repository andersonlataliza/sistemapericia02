import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface InsalubrityResultsSectionProps {
  value: string;
  onChange: (value: string) => void;
  onGenerateLLM?: () => Promise<void>;
  rowsInAnalysis?: { annex: number; agent: string; exposure?: string; obs?: string }[];
  templates?: { id: string; name: string; nr15_annexes?: number[]; nr15_enquadramento?: boolean; text?: string }[];
  onApplyTemplate?: (t: any) => void;
  onCreateTemplate?: () => void;
  onManageTemplates?: () => void;
  evaluations?: {
    annex?: number;
    agent?: string;
    evaluation_type?: string;
    intensity?: string;
    tolerance_limit?: string;
  }[];
  onEvaluationsChange?: (
    next: {
      annex?: number;
      agent?: string;
      evaluation_type?: string;
      intensity?: string;
      tolerance_limit?: string;
    }[],
  ) => void;
  images?: { dataUrl: string; caption?: string }[];
  onImagesChange?: (next: { dataUrl: string; caption?: string }[]) => void;
}

const NR15_AGENTS: Record<number, string> = {
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

export default function InsalubrityResultsSection({
  value,
  onChange,
  rowsInAnalysis,
  templates,
  onApplyTemplate,
  onCreateTemplate,
  onManageTemplates,
  evaluations,
  onEvaluationsChange,
  images,
  onImagesChange,
}: InsalubrityResultsSectionProps) {
  const rows = rowsInAnalysis || [];
  const canEditEvaluations = typeof onEvaluationsChange === "function";
  const emitEvaluations = (
    next: {
      annex?: number;
      agent?: string;
      evaluation_type?: string;
      intensity?: string;
      tolerance_limit?: string;
    }[],
  ) => {
    if (!canEditEvaluations) return;
    onEvaluationsChange?.(next);
  };
  const [byAnnex, setByAnnex] = useState<Record<number, string>>({});
  const [freeText, setFreeText] = useState<string>("");
  const [tplId, setTplId] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const currentImages = useMemo(() => (Array.isArray(images) ? images : []).filter((x) => x && String((x as any).dataUrl || '').trim()), [images]);
  const currentEvaluations = useMemo(() => {
    const raw = Array.isArray(evaluations) ? evaluations : [];
    return raw
      .map((e) => ({
        annex: typeof e?.annex === "number" ? e.annex : undefined,
        agent: String(e?.agent || "").trim(),
        evaluation_type: String(e?.evaluation_type || "").trim(),
        intensity: String(e?.intensity || "").trim(),
        tolerance_limit: String(e?.tolerance_limit || "").trim(),
      }));
  }, [evaluations]);
  const availableTemplates = useMemo(() => {
    const list = Array.isArray(templates) ? templates : [];
    return list;
  }, [templates]);
  const selectedTpl = useMemo(() => availableTemplates.find((t) => t.id === tplId) || null, [availableTemplates, tplId]);
  const defaultBody = (r: { annex: number; agent: string; exposure?: string; obs?: string }) => {
    const exp = r.exposure ? `Exposição: ${r.exposure}` : "Exposição: Não ocorre exposição";
    const obs = r.obs ? ` | Obs: ${r.obs}` : "";
    return `Anexo ${r.annex} — ${r.agent} | ${exp}${obs}`;
  };

  const evalBlockHeader = "Dados da tabela (NR-15):";
  const buildEvaluationBlock = (
    annex: number,
    list: { annex?: number; agent?: string; evaluation_type?: string; intensity?: string; tolerance_limit?: string }[],
  ) => {
    const clean = (Array.isArray(list) ? list : [])
      .map((e) => ({
        agent: String(e?.agent || "").trim(),
        evaluation_type: String(e?.evaluation_type || "").trim(),
        intensity: String(e?.intensity || "").trim(),
        tolerance_limit: String(e?.tolerance_limit || "").trim(),
      }))
      .filter((e) => e.agent || e.evaluation_type || e.intensity || e.tolerance_limit);

    if (clean.length === 0) return "";

    const lines: string[] = [evalBlockHeader];
    if (clean.length === 1) {
      const e = clean[0];
      const agent = e.agent || NR15_AGENTS[annex] || "";
      if (agent) lines.push(`Agente: ${agent}`);
      if (e.evaluation_type) lines.push(`Avaliação: ${e.evaluation_type}`);
      if (e.intensity) lines.push(`Intensidade: ${e.intensity}`);
      if (e.tolerance_limit) lines.push(`Limite de tolerância: ${e.tolerance_limit}`);
    } else {
      clean.forEach((e) => {
        const agent = e.agent || NR15_AGENTS[annex] || "";
        const parts = [
          e.evaluation_type ? `Avaliação: ${e.evaluation_type}` : "",
          e.intensity ? `Intensidade: ${e.intensity}` : "",
          e.tolerance_limit ? `Limite: ${e.tolerance_limit}` : "",
        ].filter(Boolean);
        lines.push(`• ${[agent, ...parts].filter(Boolean).join(" | ")}`);
      });
    }

    return lines.length > 1 ? lines.join("\n") : "";
  };
  const upsertEvaluationBlock = (text: string, block: string) => {
    const blk = String(block || "").trim();
    if (!blk) return String(text || "").trim();

    const srcLines = String(text || "").split(/\r?\n/);
    const out: string[] = [];
    let insertAt: number | null = null;

    const isHeader = (ln: string) => String(ln || "").trim() === evalBlockHeader;
    const isBlockLine = (ln: string) => {
      const t = String(ln || "").trim();
      if (!t) return true;
      if (/^(agente|avaliaç(?:ão|ao)|intensidade|limite(?: de tolerância)?|limite)\s*:/i.test(t)) return true;
      if (/^[-•]\s+/.test(t)) return true;
      return false;
    };

    for (let i = 0; i < srcLines.length; i++) {
      const ln = srcLines[i];
      if (!isHeader(ln)) {
        out.push(ln);
        continue;
      }

      if (insertAt == null) insertAt = out.length;

      i++;
      while (i < srcLines.length && isBlockLine(srcLines[i])) i++;
      while (i < srcLines.length && String(srcLines[i] || "").trim() === "") i++;
      i--;
    }

    const next = [...out];
    const blockLines = blk.split(/\r?\n/);

    if (insertAt == null) {
      const base = next.join("\n").trim();
      return [base, blk].filter(Boolean).join("\n\n").trim();
    }

    if (insertAt > 0 && String(next[insertAt - 1] || "").trim() !== "") {
      next.splice(insertAt, 0, "");
      insertAt += 1;
    }

    next.splice(insertAt, 0, ...blockLines);

    const afterIdx = insertAt + blockLines.length;
    if (afterIdx < next.length && String(next[afterIdx] || "").trim() !== "") {
      next.splice(afterIdx, 0, "");
    }

    return next.join("\n").trim();
  };
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
    const parts = rows.map((r) => {
      const head = `Resultado Anexo ${r.annex} — ${r.agent}`;
      const body = String(byAnnex[r.annex] || defaultBody(r)).trim();
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
          if (saved && (!next[r.annex] || next[r.annex] === defaultBody(r))) {
            next[r.annex] = saved;
          }
        });
        return next;
      });
    }
  }, [rows.length, value]);

  useEffect(() => {
    if (!rows.length) return;

    const by = new Map<number, { annex?: number; agent?: string; evaluation_type?: string; intensity?: string; tolerance_limit?: string }[]>();
    currentEvaluations.forEach((e) => {
      if (typeof e?.annex !== "number") return;
      const n = Number(e.annex);
      if (!Number.isFinite(n) || n <= 0) return;
      const curr = by.get(n) || [];
      curr.push(e);
      by.set(n, curr);
    });

    setByAnnex((prev) => {
      let next: Record<number, string> = prev;
      rows.forEach((r) => {
        const evs = by.get(Number(r.annex)) || [];
        const block = buildEvaluationBlock(Number(r.annex), evs);
        if (!block) return;

        const existing = String(next[r.annex] || "").trim();
        const base = existing || defaultBody(r);
        const updated = upsertEvaluationBlock(base, block);
        if (updated !== base) {
          if (next === prev) next = { ...prev };
          next[r.annex] = updated;
        }
      });
      return next;
    });
  }, [rows.length, rows, currentEvaluations]);
  useEffect(() => {
    if (rows.length) {
      setByAnnex((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          if (!next[r.annex]) next[r.annex] = defaultBody(r);
        });
        return next;
      });
    }
    if (rows.length) onChange(combined);
  }, [combined, rows.length]);

  useEffect(() => {
    if (!rows.length) {
      setFreeText(String(value || ""));
    }
  }, [rows.length, value]);

  const buildImageDataUrl = async (file: File): Promise<string> => {
    const toDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    const createBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("Falha ao processar imagem"));
              return;
            }
            resolve(b);
          },
          type,
          quality,
        );
      });

    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const hasAlpha = await (async () => {
      if (!file.type.includes("png")) return false;
      try {
        const sampleW = 64;
        const sampleH = 64;
        const c = document.createElement("canvas");
        c.width = sampleW;
        c.height = sampleH;
        const cx = c.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
        if (!cx) return false;
        cx.drawImage(bmp, 0, 0, sampleW, sampleH);
        const img = cx.getImageData(0, 0, sampleW, sampleH);
        const d = img.data;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] !== 255) return true;
        }
        return false;
      } catch {
        return false;
      }
    })();
    const maxSide0 = 1400;
    const maxBytes = 650 * 1024;
    let maxSide = maxSide0;
    let w0 = bmp.width || 1;
    let h0 = bmp.height || 1;

    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado");
      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, w, h);

      const outputType = file.type.includes("png") && hasAlpha ? "image/png" : "image/jpeg";

      if (outputType === "image/png") {
        const blob = await createBlob(canvas, outputType);
        if (blob.size <= maxBytes || maxSide <= 900) {
          return await toDataUrl(blob);
        }
        maxSide = Math.max(900, Math.round(maxSide * 0.85));
        continue;
      }

      let quality = 0.92;
      for (let qTry = 0; qTry < 5; qTry++) {
        const blob = await createBlob(canvas, outputType, quality);
        if (blob.size <= maxBytes || quality <= 0.78) {
          return await toDataUrl(blob);
        }
        quality = Math.max(0.78, quality - 0.06);
      }

      maxSide = Math.max(900, Math.round(maxSide * 0.85));
    }

    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = Math.max(1, Math.round((bmp.width || 1) * 0.6));
    fallbackCanvas.height = Math.max(1, Math.round((bmp.height || 1) * 0.6));
    const fallbackCtx = fallbackCanvas.getContext("2d");
    if (!fallbackCtx) throw new Error("Canvas não suportado");
    fallbackCtx.drawImage(bmp, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
    const fallbackBlob = await createBlob(fallbackCanvas, "image/jpeg", 0.82);
    return await toDataUrl(fallbackBlob);
  };

  const handlePickedImages = async (files: File[]) => {
    const picked = Array.from(files || []).filter(Boolean);
    if (!picked.length) return;
    setImageLoading(true);
    try {
      const built: { dataUrl: string; caption?: string }[] = [];
      for (const f of picked) {
        try {
          const dataUrl = await buildImageDataUrl(f);
          if (dataUrl) built.push({ dataUrl, caption: "" });
        } catch {}
      }
      if (built.length > 0) {
        const next = [...currentImages, ...built];
        onImagesChange?.(next);
      }
    } finally {
      setImageLoading(false);
      try {
        if (imageInputRef.current) imageInputRef.current.value = "";
      } catch {}
      try {
        if (cameraInputRef.current) cameraInputRef.current.value = "";
      } catch {}
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>16. Resultados das Avaliações de Insalubridade</CardTitle>
        {(availableTemplates.length > 0 || !!onCreateTemplate || !!onManageTemplates) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={tplId} onValueChange={(v) => setTplId(v)}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Selecionar template (NR-15)" />
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
                  const annexSet = new Set((selectedTpl.nr15_annexes || []).map(Number));
                  const targets = rows.filter(r => annexSet.has(Number(r.annex)));
                  if (targets.length > 0) {
                    setByAnnex(prev => {
                      const next = { ...prev };
                      targets.forEach(r => {
                        const eq = selectedTpl.nr15_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                        const body = `${eq}\n${selectedTpl.text || ""}`.trim();
                        next[r.annex] = body;
                      });
                      return next;
                    });
                  } else {
                    const eq = selectedTpl.nr15_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                    const body = `${eq}\n${selectedTpl.text || ""}`.trim();
                    setFreeText(prev => [String(prev || '').trim(), body].filter(Boolean).join('\n\n'));
                    onChange([String(value || '').trim(), body].filter(Boolean).join('\n\n'));
                  }
                } else {
                  const eq = selectedTpl.nr15_enquadramento ? "Enquadramento: Sim" : "Enquadramento: Não";
                  const body = `${eq}\n${selectedTpl.text || ""}`.trim();
                  setFreeText(prev => [String(prev || '').trim(), body].filter(Boolean).join('\n\n'));
                  onChange([String(value || '').trim(), body].filter(Boolean).join('\n\n'));
                }
                try { onApplyTemplate?.(selectedTpl); } catch {}
              }}
            >Aplicar Template</Button>
            {!!onManageTemplates && (
              <Button type="button" size="sm" variant="outline" onClick={onManageTemplates}>Editar Templates</Button>
            )}
            {!!onCreateTemplate && (
              <Button type="button" size="sm" onClick={onCreateTemplate}>Novo Template</Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Avaliações (NR-15)</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEditEvaluations}
              onClick={() => {
                if (!canEditEvaluations) return;
                emitEvaluations([
                  ...currentEvaluations,
                  { annex: undefined, agent: "", evaluation_type: "", intensity: "", tolerance_limit: "" },
                ]);
              }}
            >
              Adicionar
            </Button>
          </div>
          {!canEditEvaluations && (
            <p className="text-sm text-muted-foreground">Atualize a aplicação para habilitar a edição desta tabela.</p>
          )}
            {currentEvaluations.length > 0 ? (
              <div className="space-y-2">
                {currentEvaluations.map((ev, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-5">
                    <div className="space-y-1">
                      <Label>Anexo (NR-15)</Label>
                      <Select
                        disabled={!canEditEvaluations}
                        value={ev.annex ? String(ev.annex) : ""}
                        onValueChange={(v) => {
                          if (!canEditEvaluations) return;
                          const annex = v ? Number(v) : undefined;
                          const next = currentEvaluations.map((x, i) => {
                            if (i !== idx) return x;
                            const shouldAutoAgent = !String(x.agent || "").trim() || x.agent === (NR15_AGENTS[x.annex || 0] || "");
                            const nextAgent = annex && shouldAutoAgent ? (NR15_AGENTS[annex] || x.agent) : x.agent;
                            return { ...x, annex, agent: nextAgent };
                          });
                          emitEvaluations(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 14 }).map((_, i) => {
                            const n = i + 1;
                            return (
                              <SelectItem key={n} value={String(n)}>
                                {`Anexo ${n}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Agente</Label>
                      <Select
                        disabled={!canEditEvaluations}
                        value={ev.agent || ""}
                        onValueChange={(v) => {
                          if (!canEditEvaluations) return;
                          const next = currentEvaluations.map((x, i) => (i === idx ? { ...x, agent: v } : x));
                          emitEvaluations(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NR15_AGENTS).map(([annex, agent]) => (
                            <SelectItem key={annex} value={agent}>
                              {agent}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Avaliação</Label>
                      <Select
                        disabled={!canEditEvaluations}
                        value={ev.evaluation_type || ""}
                        onValueChange={(v) => {
                          if (!canEditEvaluations) return;
                          const next = currentEvaluations.map((x, i) => (i === idx ? { ...x, evaluation_type: v } : x));
                          emitEvaluations(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Qualitativa">Qualitativa</SelectItem>
                          <SelectItem value="Quantitativa">Quantitativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Intensidade</Label>
                      <Input
                        disabled={!canEditEvaluations}
                        className="h-9"
                        value={ev.intensity || ""}
                        onChange={(e) => {
                          if (!canEditEvaluations) return;
                          const next = currentEvaluations.map((x, i) => (i === idx ? { ...x, intensity: e.target.value } : x));
                          emitEvaluations(next);
                        }}
                        placeholder="Ex.: 85 dB(A)"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Limite de tolerância</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canEditEvaluations}
                          onClick={() => {
                            if (!canEditEvaluations) return;
                            const next = currentEvaluations.filter((_, i) => i !== idx);
                            emitEvaluations(next);
                          }}
                        >
                          Remover
                        </Button>
                      </div>
                      <Input
                        disabled={!canEditEvaluations}
                        className="h-9"
                        value={ev.tolerance_limit || ""}
                        onChange={(e) => {
                          if (!canEditEvaluations) return;
                          const next = currentEvaluations.map((x, i) => (i === idx ? { ...x, tolerance_limit: e.target.value } : x));
                          emitEvaluations(next);
                        }}
                        placeholder="Ex.: 85 dB(A)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma avaliação adicionada.</p>
            )}
        </div>
        {rows.length === 0 ? (
          <div>
            <Label htmlFor="insalubrityResults">Resultados e Conclusões sobre Insalubridade</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-2">Mencione os 14 anexos da NR-15 conforme aplicável para avaliar a exposição</p>
            <Textarea id="insalubrityResults" value={freeText || value || ""} onChange={(e) => { setFreeText(e.target.value); onChange(e.target.value); }} placeholder="Descreva os resultados das avaliações considerando os anexos da NR-15..." className="min-h-[200px] mt-2" />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <Card key={r.annex} className="border">
                <CardHeader>
                  <CardTitle>{`Resultado Anexo ${r.annex} — ${r.agent}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea value={byAnnex[r.annex] || ""} onChange={(e) => setByAnnex((prev) => ({ ...prev, [r.annex]: e.target.value }))} placeholder="Descreva o resultado desta avaliação" className="min-h-[140px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!!onImagesChange && (
          <div className="space-y-2">
            <Label>Imagem (opcional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={imageLoading}
                onChange={async (e) => handlePickedImages(Array.from(e.target.files || []))}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={imageLoading}
                onClick={() => cameraInputRef.current?.click()}
              >
                Tirar foto (celular)
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                disabled={imageLoading}
                onChange={async (e) => handlePickedImages(Array.from(e.target.files || []))}
              />
            </div>
            {currentImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentImages.map((it, idx) => (
                  <div key={`${idx}-${it.dataUrl.slice(0, 24)}`} className="border rounded p-2">
                    <div className="aspect-video bg-muted rounded overflow-hidden">
                      <img src={it.dataUrl} alt={`Imagem ${idx + 1} do item 16`} className="w-full h-full object-cover" />
                    </div>
                    <div className="mt-2 space-y-1">
                      <Label>Legenda (opcional)</Label>
                      <Input
                        type="text"
                        value={String(it.caption || "")}
                        onChange={(e) => {
                          const next = currentImages.map((x, i) => i === idx ? { ...x, caption: e.target.value } : x);
                          onImagesChange(next);
                        }}
                        placeholder="Ex.: Figura 1 — Detalhe do agente insalubre"
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = currentImages.filter((_, i) => i !== idx);
                          onImagesChange(next);
                          try {
                            if (imageInputRef.current) imageInputRef.current.value = "";
                          } catch {}
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
