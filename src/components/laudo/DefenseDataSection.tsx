import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

interface DefenseDataSectionProps {
  value: string;
  onChange: (value: string) => void;
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
      // contexto: inclui parágrafos vizinhos curtos
      const prev = paragraphs[i - 1];
      const next = paragraphs[i + 1];
      if (prev && prev.length < 200 && !hasHit(prev)) hits.push(prev);
      if (next && next.length < 200 && !hasHit(next)) hits.push(next);
    }
  }

  // fallback: se nada detectado, tenta por frases
  let result = hits.filter(Boolean);
  if (result.length === 0) {
    const sentences = lower
      .split(/(?<=[\.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    result = sentences.filter((s) => hasHit(s));
  }

  if (result.length === 0) {
    return "";
  }

  const header = `Trechos extraídos (tipo: ${type})`;
  return [header, "", ...Array.from(new Set(result))].join("\n\n");
}

export default function DefenseDataSection({ value, onChange }: DefenseDataSectionProps) {
  const [extractType, setExtractType] = useState<ExtractType>("insalubridade");
  const [rawText, setRawText] = useState<string>("");

  const handleBulkExtract = () => {
    if (!rawText.trim()) {
      toast({
        title: "Nada para extrair",
        description: "Cole o texto da contestação ou envie um arquivo.",
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

  const handleTestPdf = async () => {
    try {
      const resp = await fetch("https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf");
      if (!resp.ok) throw new Error("Falha ao baixar PDF de exemplo");
      const arrayBuffer = await resp.arrayBuffer();

      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = (content.items || []).map((it: any) => it.str || "").join(" ");
        fullText += pageText + "\n\n";
      }
      const text = fullText.trim();
      if (!text) throw new Error("PDF sem texto visível");

      const extracted = extractByType(text, extractType);
      if (!extracted) {
        toast({
          title: "Nenhum trecho detectado",
          description: "Ajuste o tipo de extração.",
          variant: "destructive",
        });
        return;
      }
      onChange(extracted);
      toast({ title: "Teste concluído", description: "Conteúdo preenchido a partir do PDF de exemplo." });
    } catch (err: any) {
      toast({
        title: "Falha no teste de PDF",
        description: err?.message ?? "Erro ao extrair o PDF de exemplo.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("autoTestDefense") === "1") {
        void handleTestPdf();
      }
    } catch (e) {
      // ignore
    }
  }, []);

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
        text = await file.text();
      } else if (isDocx) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value || "";
        } catch (err: any) {
          toast({
            title: "Falha ao extrair DOCX",
            description: "Tente colar o texto ou enviar um arquivo TXT ou PDF.",
            variant: "destructive",
          });
          e.target.value = "";
          return;
        }
      } else if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as any;

          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = (content.items || []).map((it: any) => it.str || "").join(" ");
            fullText += pageText + "\n\n";
          }
          text = fullText.trim();
          if (!text) throw new Error("PDF sem texto visível");
        } catch (err: any) {
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

      const extracted = extractByType(text, extractType);
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
      // não salvar arquivo; limpar input
      e.target.value = "";
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>6. Dados da Contestação da Reclamada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>O que deve ser extraído?</Label>
          <RadioGroup
            value={extractType}
            onValueChange={(val) => setExtractType(val as ExtractType)}
            className="grid grid-cols-1 md:grid-cols-3 gap-2"
          >
            <div className="flex items-center space-x-2 border rounded p-2">
              <RadioGroupItem value="insalubridade" id="ex-insal" />
              <Label htmlFor="ex-insal">Insalubridade</Label>
            </div>
            <div className="flex items-center space-x-2 border rounded p-2">
              <RadioGroupItem value="periculosidade" id="ex-peri" />
              <Label htmlFor="ex-peri">Periculosidade</Label>
            </div>
            <div className="flex items-center space-x-2 border rounded p-2">
              <RadioGroupItem value="acidentario" id="ex-aci" />
              <Label htmlFor="ex-aci">Acidentário</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            A extração é local e heurística. O arquivo não é salvo; apenas os trechos identificados são inseridos abaixo. Aceita PDF, DOCX e TXT.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rawDefense">Colar texto da contestação (não salvo)</Label>
          <Textarea
            id="rawDefense"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Cole aqui o texto integral da contestação para extração..."
            className="min-h-[120px] mt-2"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleBulkExtract}>
              Extrair do texto colado
            </Button>
            <Button type="button" variant="outline" onClick={handleTestPdf}>
              Testar com PDF de exemplo
            </Button>
            <div className="flex items-center gap-2">
              <Input type="file" accept=".txt,.docx,.pdf" onChange={handleFileInput} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defenseData">Alegações extraídas / editáveis</Label>
          <Textarea
            id="defenseData"
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