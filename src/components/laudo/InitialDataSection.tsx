import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractInitialByLLM } from "@/lib/llm";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

interface InitialDataSectionProps {
  value: string;
  onChange: (value: string) => void;
  onTypeChange?: (value: "insalubridade" | "periculosidade" | "acidentario") => void;
}

type ExtractType = "insalubridade" | "periculosidade" | "acidentario";

function extractByType(text: string, type: ExtractType): string {
  if (!text?.trim()) return "";

  const lower = text.replace(/\s+/g, " ").trim();
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const kw = {
    insalubridade: [
      "insalubridade",
      "insalubre",
      "nr-15",
      "nr15",
      "adicional de insalubridade",
      "anexo",
      "agente químico",
      "agente fisico",
      "agente físico",
      "agente biológico",
      "limite de tolerância",
      "lt",
      "ruído",
      "calor",
      "poeira",
      "solvente",
      "benzeno",
      "epi",
      "epc",
    ],
    periculosidade: [
      "periculosidade",
      "periculoso",
      "nr-16",
      "nr16",
      "adicional de periculosidade",
      "inflamável",
      "explosivo",
      "energia elétrica",
      "eletricidade",
      "líquidos inflamáveis",
      "gases inflamáveis",
      "armazenamento",
      "manuseio",
      "perigo",
      "exposição periculosa",
    ],
    acidentario: [
      "acidentário",
      "acidentario",
      "acidentária",
      "acidente de trabalho",
      "cat",
      "comunicação de acidente",
      "benefício acidentário",
      "auxílio-doença",
      "auxilio-doenca",
      "ntep",
      "doença ocupacional",
      "doença do trabalho",
      "nexo causal",
      "lesão",
      "sinistro",
      "incapacidade",
    ],
  } as const;

  const keywords = kw[type].map((k) => k.toLowerCase());

  const hasHit = (p: string) => {
    const l = p.toLowerCase();
    return keywords.some((k) => l.includes(k));
  };

  const hits: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (hasHit(p)) {
      hits.push(p);
      const prev = paragraphs[i - 1];
      const next = paragraphs[i + 1];
      if (prev && prev.length < 200 && !hasHit(prev)) hits.push(prev);
      if (next && next.length < 200 && !hasHit(next)) hits.push(next);
    }
  }

  let result = hits.filter(Boolean);
  if (result.length === 0) {
    const sentences = lower
      .split(/(?<=[\.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    result = sentences.filter((s) => hasHit(s));
  }

  if (result.length === 0) return "";

  const header = `Trechos extraídos (tipo: ${type})`;
  return [header, "", ...Array.from(new Set(result))].join("\n\n");
}

export default function InitialDataSection({ value, onChange }: InitialDataSectionProps) {
  const [extractType, setExtractType] = useState<ExtractType>("insalubridade");
  const [rawText, setRawText] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const loadingTaskRef = useRef<any>(null);
  const cancelRef = useRef(false);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const indeterminateTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const cancelExtraction = async () => {
    cancelRef.current = true;
    try {
      await loadingTaskRef.current?.destroy?.();
    } catch {}
    if (indeterminateTimerRef.current != null) {
      clearInterval(indeterminateTimerRef.current);
      indeterminateTimerRef.current = null;
    }
    setIsExtracting(false);
    setProgress(0);
    setStatusLabel("");
    toast({ title: "Extração cancelada", description: "Processo interrompido pelo usuário." });
  };

  const extractPdfTextFromArrayBuffer = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    setIsExtracting(true);
    cancelRef.current = false;
    setProgress(0);
    setStatusLabel("Extraindo PDF...");
    startTimeRef.current = performance.now();
    let fullText = "";
    try {
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      // @ts-expect-error - pdfjs types
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      loadingTaskRef.current = loadingTask;
      const pdf = await loadingTask.promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelRef.current) {
          throw new Error("cancelled");
        }
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = (content.items || []).map((it: any) => it.str || "").join(" ");
        fullText += pageText + "\n\n";
        setProgress(i / pdf.numPages);
        const elapsed = Math.round((performance.now() - startTimeRef.current) / 1000);
        setStatusLabel(`Página ${i} de ${pdf.numPages} — ${elapsed}s`);
      }
      return fullText.trim();
    } finally {
      try {
        loadingTaskRef.current = null;
      } catch {}
      setIsExtracting(false);
      setStatusLabel("");
    }
  };

  const handleTestPdf = async () => {
    try {
      setTesting(true);
      const fetchWithRetry = async (url: string, retries = 2, delayMs = 500): Promise<Response> => {
        let lastErr: any = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const resp = await fetch(url);
            if (resp.ok) return resp;
            lastErr = new Error(`HTTP ${resp.status}`);
          } catch (err) {
            lastErr = err;
          }
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        throw lastErr ?? new Error("Falha ao baixar");
      };
      const resp = await fetchWithRetry("https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf");
      const arrayBuffer = await resp.arrayBuffer();
      const text = await extractPdfTextFromArrayBuffer(arrayBuffer);
      if (!text) throw new Error("PDF sem texto visível");

      let extracted = "";
      try {
        const llmExtracted = await extractInitialByLLM(text, extractType);
        extracted = llmExtracted ?? extractByType(text, extractType);
      } catch {
        extracted = extractByType(text, extractType);
      }

      if (!extracted) {
        toast({
          title: "Nenhum trecho detectado",
          description: "Ajuste o tipo de extração.",
          variant: "destructive",
        });
        return;
      }

      onChange(extracted);
      toast({
        title: "Teste concluído",
        description: "Conteúdo preenchido a partir do PDF de exemplo.",
      });
    } catch (err: any) {
      if (err?.message === "cancelled") {
        // cancelado pelo usuário
      } else {
        toast({
          title: "Falha no teste de PDF",
          description: err?.message ?? "Erro ao extrair o PDF de exemplo.",
          variant: "destructive",
        });
      }
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("autoTestInitial") === "1") {
        void handleTestPdf();
      }
    } catch {}
    return () => {
      cancelRef.current = true;
      try {
        loadingTaskRef.current?.destroy?.();
      } catch {}
      if (indeterminateTimerRef.current != null) {
        clearInterval(indeterminateTimerRef.current);
        indeterminateTimerRef.current = null;
      }
    };
  }, []);

  const handleBulkExtract = () => {
    if (!rawText.trim()) {
      toast({
        title: "Nada para extrair",
        description: "Cole o texto da inicial ou envie um arquivo.",
      });
      return;
    }
    const extracted = extractByType(rawText, extractType);
    if (!extracted) {
      toast({
        title: "Nenhum trecho detectado",
        description: "Ajuste o tipo de extração ou revise o texto.",
        variant: "destructive",
      });
      return;
    }
    onChange(extracted);
    toast({ title: "Extração concluída", description: "Conteúdo preenchido a partir do texto colado." });
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let text = "";
      const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
      const isDocx =
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (isTxt) {
        setIsExtracting(true);
        cancelRef.current = false;
        setProgress(0);
        setStatusLabel("Processando TXT...");
        if (indeterminateTimerRef.current != null) {
          clearInterval(indeterminateTimerRef.current);
        }
        indeterminateTimerRef.current = window.setInterval(() => setProgress((p) => Math.min(p + 0.15, 0.95)), 150);
        text = await file.text();
        if (indeterminateTimerRef.current != null) {
          clearInterval(indeterminateTimerRef.current);
          indeterminateTimerRef.current = null;
        }
        setProgress(1);
        setIsExtracting(false);
        setStatusLabel("");
        if (cancelRef.current) {
          e.target.value = "";
          return;
        }
      } else if (isDocx) {
        try {
          setIsExtracting(true);
          cancelRef.current = false;
          setProgress(0);
          setStatusLabel("Processando DOCX...");
          if (indeterminateTimerRef.current != null) {
            clearInterval(indeterminateTimerRef.current);
          }
          indeterminateTimerRef.current = window.setInterval(() => setProgress((p) => Math.min(p + 0.03, 0.9)), 200);
          const arrayBuffer = await file.arrayBuffer();
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value || "";
          if (indeterminateTimerRef.current != null) {
            clearInterval(indeterminateTimerRef.current);
            indeterminateTimerRef.current = null;
          }
          setProgress(1);
          setIsExtracting(false);
          setStatusLabel("");
          if (cancelRef.current) {
            e.target.value = "";
            return;
          }
        } catch (err: any) {
          if (indeterminateTimerRef.current != null) {
            clearInterval(indeterminateTimerRef.current);
            indeterminateTimerRef.current = null;
          }
          setIsExtracting(false);
          setStatusLabel("");
          toast({
            title: "Falha ao extrair DOCX",
            description: "Tente colar o texto ou enviar um arquivo TXT.",
            variant: "destructive",
          });
          e.target.value = "";
          return;
        }
      } else if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const extractedText = await extractPdfTextFromArrayBuffer(arrayBuffer);
          text = extractedText;
          if (!text) throw new Error("PDF sem texto visível");
        } catch (err: any) {
          if (err?.message === "cancelled") {
            e.target.value = "";
            return;
          }
          toast({
            title: "Falha ao extrair PDF",
            description: "Se o PDF for imagem, cole o texto manualmente ou use TXT/DOCX.",
            variant: "destructive",
          });
          e.target.value = "";
          return;
        }
      } else {
        toast({ title: "Formato não suportado", description: "Use PDF, DOCX ou TXT.", variant: "destructive" });
        e.target.value = "";
        return;
      }

      let extracted = "";
      try {
        const llmExtracted = await extractInitialByLLM(text, extractType);
        extracted = llmExtracted ?? extractByType(text, extractType);
      } catch {
        extracted = extractByType(text, extractType);
      }

      if (!extracted) {
        toast({
          title: "Nenhum trecho detectado",
          description: "Ajuste o tipo de extração ou revise o arquivo.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      onChange(extracted);
      toast({ title: "Extração concluída", description: "Conteúdo preenchido a partir do arquivo." });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>5. Dados da Inicial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>O que deve ser extraído?</Label>
          <RadioGroup
            value={extractType}
            onValueChange={(val) => {
              const t = val as ExtractType;
              setExtractType(t);
              onTypeChange?.(t);
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-2"
          >
            <div className="flex items-center space-x-2 border rounded p-2">
              <RadioGroupItem value="insalubridade" id="ini-insal" />
              <Label htmlFor="ini-insal">Insalubridade</Label>
            </div>
            <div className="flex items-center space-x-2 border rounded p-2">
              <RadioGroupItem value="periculosidade" id="ini-peri" />
              <Label htmlFor="ini-peri">Periculosidade</Label>
            </div>
            <div className="flex items-center space-x-2 border rounded p-2">
              <RadioGroupItem value="acidentario" id="ini-aci" />
              <Label htmlFor="ini-aci">Acidentário</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Se configurado, usa LLM para extração; caso contrário, heurística local. O arquivo não é salvo; apenas os trechos identificados são inseridos abaixo. Aceita PDF, DOCX e TXT.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rawInitial">Colar texto da inicial (não salvo)</Label>
          <Textarea
            id="rawInitial"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Cole aqui o texto integral da inicial para extração..."
            className="min-h-[120px] mt-2"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleBulkExtract}>
              Extrair do texto colado
            </Button>
            <Button type="button" variant="secondary" onClick={handleTestPdf} disabled={testing || isExtracting}>
              {testing || isExtracting ? "Testando PDF..." : "Testar com PDF de exemplo"}
            </Button>
            <Button type="button" variant="outline" onClick={cancelExtraction} disabled={!isExtracting}>
              Cancelar extração
            </Button>
            <div className="flex items-center gap-2">
              <Input type="file" accept=".txt,.docx,.pdf" onChange={handleFileInput} disabled={isExtracting} />
            </div>
            {isExtracting && (
              <div className="w-full max-w-sm">
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Math.round(progress * 100)}% {statusLabel}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="initialData">Alegações extraídas / editáveis</Label>
          <Textarea
            id="initialData"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Os trechos extraídos aparecerão aqui. Você pode editar antes de salvar o laudo."
            className="min-h-[150px] mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}