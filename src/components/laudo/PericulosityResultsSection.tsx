import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
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
  images?: { dataUrl: string; caption?: string }[];
  onImagesChange?: (next: { dataUrl: string; caption?: string }[]) => void;
}

export default function PericulosityResultsSection({ value, onChange, rowsInAnalysis, templates, onApplyTemplate, onCreateTemplate, onManageTemplates, images, onImagesChange }: PericulosityResultsSectionProps) {
  const rows = rowsInAnalysis || [];
  const [byAnnex, setByAnnex] = useState<Record<number, string>>({});
  const [freeText, setFreeText] = useState<string>("");
  const [tplId, setTplId] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const currentImages = useMemo(() => (Array.isArray(images) ? images : []).filter((x) => x && String((x as any).dataUrl || '').trim()), [images]);
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
                      <img src={it.dataUrl} alt={`Imagem ${idx + 1} do item 19`} className="w-full h-full object-cover" />
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
                        placeholder="Ex.: Figura 2 — Condição perigosa observada"
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
