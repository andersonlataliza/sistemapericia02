import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractInitialByLLM } from "@/lib/llm";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

interface InitialDataSectionProps {
  value: string;
  onChange: (value: string) => void;
  onFlagsChange?: (flags: { show_nr15_item15?: boolean; show_nr16_item15?: boolean }) => void;
}

type ExtractType = "insalubridade" | "periculosidade" | "acidentario";

function extractByType(text: string, type: ExtractType): string {
  if (!text?.trim()) return "";

  // Normaliza o texto para melhor processamento
  const normalizedText = text.replace(/\s+/g, " ").trim();
  
  // Divide em parágrafos e frases
  const paragraphs = text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);

  const sentences = normalizedText
    .split(/(?<=[\.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  // Palavras-chave OBRIGATÓRIAS para cada tipo
  const requiredKeywords = {
    insalubridade: [
      "insalubridade",
      "insalubre", 
      "nr-15",
      "nr15",
      "adicional de insalubridade",
      "agente químico",
      "agente físico", 
      "agente fisico",
      "agente biológico",
      "limite de tolerância",
      "ruído",
      "calor",
      "poeira",
      "solvente",
      "benzeno",
      "ambiente insalubre",
      "exposição ocupacional"
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
      "atividade perigosa",
      "risco de explosão",
      "exposição periculosa"
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
      "incapacidade laboral",
      "inss"
    ],
  } as const;

  const keywords = requiredKeywords[type].map(k => k.toLowerCase());

  // Função MUITO restritiva - deve conter palavra-chave obrigatória
  const isStrictlyRelevant = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    
    // DEVE conter pelo menos uma palavra-chave obrigatória
    const hasRequiredKeyword = keywords.some(keyword => lowerContent.includes(keyword));
    
    if (!hasRequiredKeyword) return false;

    // Exclui conteúdo que claramente não é do tipo (palavras de exclusão)
    const exclusionWords = [
      "valor da causa", "valor atribuído", "procedente deferindo", 
      "r$ ", "reais", "sentença", "processo", "juiz", "tribunal",
      "recurso", "apelação", "embargos", "decisão judicial",
      "código civil", "clt", "artigo", "parágrafo", "inciso",
      "documento assinado", "número do documento", "instância"
    ];
    
    const hasExclusionWords = exclusionWords.some(word => lowerContent.includes(word));
    if (hasExclusionWords) return false;

    return true;
  };

  const relevantContent: string[] = [];

  // Primeiro: busca em parágrafos
  for (const paragraph of paragraphs) {
    if (isStrictlyRelevant(paragraph)) {
      relevantContent.push(paragraph);
    }
  }

  // Se não encontrou parágrafos relevantes, busca em frases
  if (relevantContent.length === 0) {
    for (const sentence of sentences) {
      if (isStrictlyRelevant(sentence)) {
        relevantContent.push(sentence);
      }
    }
  }

  // Remove duplicatas e limita o tamanho
  const uniqueContent = Array.from(new Set(relevantContent))
    .filter(content => content.length > 50) // Conteúdo substancial
    .sort((a, b) => {
      // Ordena por quantidade de palavras-chave encontradas
      const aMatches = keywords.filter(k => a.toLowerCase().includes(k)).length;
      const bMatches = keywords.filter(k => b.toLowerCase().includes(k)).length;
      return bMatches - aMatches;
    })
    .slice(0, 5); // Máximo 5 trechos mais relevantes

  if (uniqueContent.length === 0) return "";

  const header = `Trechos extraídos (tipo: ${type})`;
  return [header, "", ...uniqueContent].join("\n\n");
}

export default function InitialDataSection({ value, onChange, onFlagsChange }: InitialDataSectionProps) {
  const [extractTypes, setExtractTypes] = useState<ExtractType[]>(["insalubridade"]);
  const [rawText, setRawText] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const loadingTaskRef = useRef<any>(null);
  const cancelRef = useRef(false);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const indeterminateTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const extractByTypes = (text: string, types: ExtractType[]): string => {
    const sanitizedTypes = Array.from(new Set(types));
    if (sanitizedTypes.length === 0) return "";
    const parts = sanitizedTypes
      .map((t) => extractByType(text, t))
      .filter((p) => p && p.trim().length > 0);
    return parts.join("\n\n---\n\n");
  };

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
        const chunks: string[] = [];
        for (const t of extractTypes) {
          const llmExtracted = await extractInitialByLLM(text, t);
          const filteredLLM = llmExtracted ? extractByType(llmExtracted, t) : "";
          chunks.push(filteredLLM || extractByType(text, t));
        }
        extracted = chunks.filter((c) => c && c.trim()).join("\n\n---\n\n");
      } catch {
        extracted = extractByTypes(text, extractTypes);
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
    if (extractTypes.length === 0) {
      toast({ title: "Seleção vazia", description: "Selecione um ou mais tipos." });
      return;
    }
    const extracted = extractByTypes(rawText, extractTypes);
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
        const chunks: string[] = [];
        for (const t of extractTypes) {
          const llmExtracted = await extractInitialByLLM(text, t);
          const filteredLLM = llmExtracted ? extractByType(llmExtracted, t) : "";
          chunks.push(filteredLLM || extractByType(text, t));
        }
        extracted = chunks.filter((c) => c && c.trim()).join("\n\n---\n\n");
      } catch {
        extracted = extractByTypes(text, extractTypes);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="flex items-center space-x-2 border rounded p-2">
              <Checkbox
                checked={extractTypes.includes("insalubridade")}
                onCheckedChange={(checked) => {
                  setExtractTypes((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add("insalubridade");
                    else next.delete("insalubridade");
                    return Array.from(next);
                  });
                  if (typeof checked === "boolean") {
                    onFlagsChange?.({ show_nr15_item15: checked });
                  }
                }}
              />
              <span>Insalubridade</span>
            </label>
            <label className="flex items-center space-x-2 border rounded p-2">
              <Checkbox
                checked={extractTypes.includes("periculosidade")}
                onCheckedChange={(checked) => {
                  setExtractTypes((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add("periculosidade");
                    else next.delete("periculosidade");
                    return Array.from(next);
                  });
                  if (typeof checked === "boolean") {
                    onFlagsChange?.({ show_nr16_item15: checked });
                  }
                }}
              />
              <span>Periculosidade</span>
            </label>
            <label className="flex items-center space-x-2 border rounded p-2">
              <Checkbox
                checked={extractTypes.includes("acidentario")}
                onCheckedChange={(checked) => {
                  setExtractTypes((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add("acidentario");
                    else next.delete("acidentario");
                    return Array.from(next);
                  });
                }}
              />
              <span>Acidentário</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione um ou mais tipos. Se configurado, usa LLM para extração; caso contrário, heurística local. O arquivo não é salvo; apenas os trechos identificados são inseridos abaixo. Aceita PDF, DOCX e TXT.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {isExtracting && (
              <Button type="button" variant="outline" onClick={cancelExtraction}>
                Cancelar extração
              </Button>
            )}
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
