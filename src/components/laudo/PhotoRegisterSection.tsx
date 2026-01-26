import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

type PhotoItem = {
  id: string;
  type: "url" | "storage";
  url?: string; // direct image url (e.g., Google Fotos)
  file_path?: string; // Supabase storage path
  signed_url?: string; // preview url for private buckets
  caption?: string;
};

interface PhotoRegisterSectionProps {
  processId: string;
  value: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
}

export default function PhotoRegisterSection({ processId, value, onChange }: PhotoRegisterSectionProps) {
  const [items, setItems] = useState<PhotoItem[]>(Array.isArray(value) ? value : []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrOpen, setQrOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setItems(Array.isArray(value) ? value : []);
  }, [value]);

  const updateAndPropagate = (next: PhotoItem[]) => {
    setItems(next);
    onChange(next);
  };

  const quickPhotoUrl = useMemo(() => {
    try {
      return `${window.location.origin}/processo/${processId}?tab=laudo#registro-fotografico`;
    } catch {
      return "";
    }
  }, [processId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!qrOpen) return;
      if (!quickPhotoUrl) {
        if (active) setQrDataUrl("");
        return;
      }
      try {
        const url = await QRCode.toDataURL(quickPhotoUrl, { margin: 1, width: 280 });
        if (active) setQrDataUrl(url);
      } catch {
        if (active) setQrDataUrl("");
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [quickPhotoUrl, qrOpen]);

  const isProbablyDirectImageUrl = (raw: string) => {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();

      if (host.includes("googleusercontent.com")) return true;
      if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)) return true;
      if (u.searchParams.has("raw")) return true;
      return false;
    } catch {
      return false;
    }
  };


  const sanitizeName = (s: string) => s.replace(/[^a-zA-Z0-9.-]/g, "_");

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;

    const createBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("Falha ao compactar imagem"));
              return;
            }
            resolve(b);
          },
          type,
          quality,
        );
      });

    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const maxDim0 = 2048;
    const maxBytes = 900 * 1024;
    const maxDim = Math.max(bmp.width || 1, bmp.height || 1);
    const shouldProcess = file.size > 500 * 1024 || maxDim > maxDim0 || file.type.includes("png");
    if (!shouldProcess) return file;

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

    const outputType = file.type.includes("png") && hasAlpha ? "image/png" : "image/jpeg";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const outputName = outputType === "image/png" ? `${baseName}.png` : `${baseName}.jpg`;

    let maxSide = maxDim0;
    for (let attempt = 0; attempt < 7; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(bmp.width || 1, bmp.height || 1));
      const w = Math.max(1, Math.round((bmp.width || 1) * scale));
      const h = Math.max(1, Math.round((bmp.height || 1) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado");
      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, w, h);

      if (outputType === "image/png") {
        const blob = await createBlob(canvas, outputType);
        const out = new File([blob], outputName, { type: outputType });
        if (out.size <= maxBytes || maxSide <= 1400) return out.size < file.size ? out : file;
        maxSide = Math.max(1400, Math.round(maxSide * 0.85));
        continue;
      }

      let quality = 0.92;
      for (let qTry = 0; qTry < 6; qTry++) {
        const blob = await createBlob(canvas, outputType, quality);
        const out = new File([blob], outputName, { type: outputType });
        if (out.size <= maxBytes || quality <= 0.80) {
          return out.size < file.size ? out : file;
        }
        quality = Math.max(0.80, quality - 0.05);
      }

      maxSide = Math.max(1400, Math.round(maxSide * 0.85));
    }

    return file;
  };

  const handleFiles = async (filesList: FileList | null) => {
    try {
      if (!filesList || filesList.length === 0) return;
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        toast({ title: "Sessão expirada", description: "Entre novamente para anexar fotos.", variant: "destructive" });
        return;
      }
      const formatErr = (e: any) => {
        try {
          const parts = [e?.name, e?.statusCode, e?.message, e?.error].filter(Boolean);
          return parts.join(" | ");
        } catch {
          return String(e);
        }
      };
      try {
        const prefix = `${user.id}/${processId}/photos`;
        const { error: accessErr } = await supabase.storage.from("process-documents").list(prefix, { limit: 1 });
        if (accessErr) {
          toast({ title: "Sem acesso ao Storage", description: formatErr(accessErr), variant: "destructive" });
          return;
        }
      } catch (preflightErr: any) {
        toast({ title: "Falha ao verificar acesso ao Storage", description: formatErr(preflightErr), variant: "destructive" });
        return;
      }
      const added: PhotoItem[] = [];
      for (const file of Array.from(filesList)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImage(file);
        const ts = Date.now();
        const path = `${user.id}/${processId}/photos/${ts}_${sanitizeName(compressed.name)}`;
        const { data, error } = await supabase.storage
          .from("process-documents")
          .upload(path, compressed, { cacheControl: "3600", upsert: false });
        if (error) {
          toast({ title: "Erro no upload", description: formatErr(error), variant: "destructive" });
          throw error;
        }
        try {
          await supabase.from("documents").insert({
            process_id: processId,
            name: compressed.name,
            file_path: data.path,
            file_size: compressed.size,
            file_type: compressed.type,
            category: "photo",
            description: null,
          });
        } catch {}
        let signed_url: string | undefined;
        try {
          const { data: sign } = await supabase.storage.from("process-documents").createSignedUrl(data.path, 60 * 60 * 24 * 7);
          signed_url = sign?.signedUrl;
        } catch (signErr: any) {
          toast({ title: "Falha ao gerar link", description: formatErr(signErr) });
        }
        added.push({ id: Math.random().toString(36).slice(2), type: "storage", file_path: data.path, signed_url, caption: "" });
      }
      if (added.length > 0) {
        updateAndPropagate([...items, ...added]);
        toast({ title: "Fotos anexadas", description: `${added.length} foto(s) enviada(s) com compressão.` });
      }
    } catch (err: any) {
      const d = err?.statusCode || err?.message ? `${err?.statusCode || ''} ${err?.message || ''}`.trim() : "Erro ao processar/imprimir imagens.";
      toast({ title: "Falha ao anexar fotos", description: d, variant: "destructive" });
    } finally {
      try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {}
      try { if (cameraInputRef.current) cameraInputRef.current.value = ""; } catch {}
    }
  };

  const removeItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    updateAndPropagate(next);
  };

  const gridCols = useMemo(() => {
    const len = items.length;
    if (len >= 3) return "md:grid-cols-3";
    if (len === 2) return "md:grid-cols-2";
    return "md:grid-cols-2";
  }, [items.length]);

  return (
    <Card id="registro-fotografico" className="shadow-card">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>12.1. Registro fotográfico</CardTitle>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={!quickPhotoUrl}>
                <QrCode className="h-4 w-4 mr-2" />
                QR Code
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>QR Code do registro fotográfico</DialogTitle>
                <DialogDescription>Abra este item no celular para anexar fotos rapidamente.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="h-[280px] w-[280px] rounded border bg-background object-contain" />
                ) : (
                  <div className="h-[280px] w-[280px] rounded border bg-background flex items-center justify-center text-xs text-muted-foreground">
                    Gerando QR...
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <Label>Selecionar imagens (com compressão)</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
              <Button type="button" variant="secondary" onClick={() => cameraInputRef.current?.click()}>
                Tirar foto (celular)
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Imagens são reduzidas e enviadas para o armazenamento, evitando arquivos pesados.</p>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
          {items.map((it) => {
            const src = it.type === "url"
              ? (it.url && isProbablyDirectImageUrl(it.url) ? it.url : undefined)
              : (it.signed_url || undefined);
            return (
              <div key={it.id} className="border rounded p-2">
                <div className="aspect-video bg-muted rounded overflow-hidden">
                  {src ? (
                    <img src={src} alt={it.caption || "Foto"} className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Prévia indisponível</div>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <Label>Comentário</Label>
                  <Textarea value={it.caption || ""} onChange={(e) => {
                    const next = items.map((x) => x.id === it.id ? { ...x, caption: e.target.value } : x);
                    updateAndPropagate(next);
                  }} placeholder="Escreva observações sobre esta foto" />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => removeItem(it.id)}>Remover</Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
