import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

interface DefenseDataSectionProps {
  value: string;
  onChange: (value: string) => void;
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
      "exposição ocupacional",
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
      "incapacidade laboral",
      "inss",
    ],
  } as const;

  const keywords = requiredKeywords[type].map((k) => k.toLowerCase());

  // Função MUITO restritiva - deve conter palavra-chave obrigatória e não conter exclusões
  const isStrictlyRelevant = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    const hasRequiredKeyword = keywords.some((keyword) => lowerContent.includes(keyword));
    if (!hasRequiredKeyword) return false;

    // Exclui conteúdo que claramente não é do tipo (palavras de exclusão)
    const exclusionWords = [
      "valor da causa",
      "valor atribuído",
      "procedente deferindo",
      "r$ ",
      "reais",
      "sentença",
      "processo",
      "juiz",
      "tribunal",
      "recurso",
      "apelação",
      "embargos",
      "decisão judicial",
      "código civil",
      "clt",
      "artigo",
      "parágrafo",
      "inciso",
      "documento assinado",
      "número do documento",
      "instância",
    ];
    const hasExclusionWords = exclusionWords.some((word) => lowerContent.includes(word));
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

  // Remove duplicatas, filtra por tamanho e ordena por relevância
  const uniqueContent = Array.from(new Set(relevantContent))
    .filter((content) => content.length > 50)
    .sort((a, b) => {
      const aMatches = keywords.filter((k) => a.toLowerCase().includes(k)).length;
      const bMatches = keywords.filter((k) => b.toLowerCase().includes(k)).length;
      return bMatches - aMatches;
    })
    .slice(0, 5);

  if (uniqueContent.length === 0) return "";

  const header = `Trechos extraídos (tipo: ${type})`;
  return [header, "", ...uniqueContent].join("\n\n");
}

export default function DefenseDataSection({ value, onChange }: DefenseDataSectionProps) {
  const [extractTypes, setExtractTypes] = useState<ExtractType[]>(["insalubridade"]);
  const extractByTypes = (text: string, types: ExtractType[]): string => {
    const sanitizedTypes = Array.from(new Set(types));
    if (sanitizedTypes.length === 0) return "";
    const parts = sanitizedTypes
      .map((t) => extractByType(text, t))
      .filter((p) => p && p.trim().length > 0);
    return parts.join("\n\n---\n\n");
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

        const extracted = extractByTypes(text, extractTypes);
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
            Selecione um ou mais tipos. A extração é local e heurística. O arquivo não é salvo; apenas os trechos identificados são inseridos abaixo. Aceita PDF, DOCX e TXT.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defenseFile">Enviar arquivo da contestação</Label>
          <Input id="defenseFile" type="file" accept=".txt,.docx,.pdf" onChange={handleFileInput} />
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
