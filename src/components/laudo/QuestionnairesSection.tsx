import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Questionnaire {
  id?: string;
  question_number: number;
  question: string;
  answer: string;
  party: string;
}

interface QuestionnairesSectionProps {
  processId: string;
  reportConfig?: any;
  onReportConfigChange?: (next: any) => void;
}

export default function QuestionnairesSection({ processId, reportConfig, onReportConfigChange }: QuestionnairesSectionProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkInput, setBulkInput] = useState<Record<string, string>>({
    claimant: "",
    judge: "",
    defendant: "",
  });
  const [extractedBox, setExtractedBox] = useState<Record<string, string>>({
    claimant: "",
    judge: "",
    defendant: "",
  });
  const { toast } = useToast();

  const parseRc = (rc: any) => {
    try {
      return typeof rc === "string" ? JSON.parse(rc || "{}") : (rc || {});
    } catch {
      return {};
    }
  };

  useEffect(() => {
    fetchQuestionnaires();
  }, [processId]);

  const fetchQuestionnaires = async () => {
    try {
      const { data, error } = await supabase
        .from("questionnaires")
        .select("*")
        .eq("process_id", processId)
        .order("party", { ascending: true })
        .order("question_number", { ascending: true });

      if (error) throw error;
      setQuestionnaires(data || []);

      let rc: any = parseRc(reportConfig);
      if (!reportConfig) {
        const { data: proc, error: procErr } = await supabase
          .from("processes")
          .select("report_config")
          .eq("id", processId)
          .single();
        if (procErr) throw procErr;
        rc = parseRc((proc as any)?.report_config);
      }
      const q = (rc as any)?.questionnaires || {};
      setExtractedBox({
        claimant: String(q?.claimantText || ""),
        defendant: String(q?.defendantText || ""),
        judge: String(q?.judgeText || ""),
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar quesitos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getQuestionsByParty = (party: string) => {
    return questionnaires.filter((q) => q.party === party);
  };

  const addQuestion = (party: string) => {
    const partyQuestions = getQuestionsByParty(party);
    const nextNumber = partyQuestions.length > 0 
      ? Math.max(...partyQuestions.map(q => q.question_number)) + 1 
      : 1;
    
    const newQuestion: Questionnaire = {
      question_number: nextNumber,
      question: '',
      answer: '',
      party,
    };
    
    setQuestionnaires([...questionnaires, newQuestion]);
  };

  const removeQuestion = async (id?: string, index?: number) => {
    if (id) {
      try {
        const { error } = await supabase
          .from("questionnaires")
          .delete()
          .eq("id", id);

        if (error) throw error;
        
        toast({
          title: "Quesito removido",
          description: "O quesito foi removido com sucesso.",
        });
      } catch (error: any) {
        toast({
          title: "Erro ao remover quesito",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    }
    
    setQuestionnaires(questionnaires.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Questionnaire, value: string | number) => {
    const updated = [...questionnaires];
    updated[index] = { ...updated[index], [field]: value };
    setQuestionnaires(updated);
  };

  const saveQuestionnaires = async () => {
    try {
      const results = await Promise.all(
        questionnaires.map((q) => {
          if (q.id) {
            return supabase
              .from("questionnaires")
              .update({
                question: q.question,
                answer: q.answer,
                question_number: q.question_number,
              })
              .eq("id", q.id);
          }
          return supabase
            .from("questionnaires")
            .insert({
              process_id: processId,
              party: q.party,
              question_number: q.question_number,
              question: q.question,
              answer: q.answer,
            });
        })
      );

      const firstErr = results.find((r: any) => r?.error)?.error;
      if (firstErr) throw firstErr;
      
      toast({
        title: "Quesitos salvos",
        description: "Os quesitos foram salvos com sucesso.",
      });
      
      fetchQuestionnaires();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar quesitos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const extractQuestionsFromText = (text: string) => {
    const normalized = text.replace(/\r/g, "");
    const matches = [...normalized.matchAll(/(?:^|\n)\s*(?:quesito\s*)?(\d+)[\.\)\-:\s]+/gi)];

    if (matches.length === 0) {
      const lines = normalized
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.map((l, idx) => ({ number: idx + 1, text: l }));
    }

    const items: { number: number; text: string }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? normalized.length : normalized.length;
      const chunk = normalized.slice(start, end).trim();
      const num = parseInt(matches[i][1], 10);
      const cleaned = chunk.replace(/^(?:quesito\s*)?\d+[\.\)\-:\s]+/i, "").trim();
      items.push({ number: Number.isFinite(num) ? num : i + 1, text: cleaned });
    }
    return items;
  };

  const persistQuestionnairesText = async (party: string, text: string) => {
    let rc: any = parseRc(reportConfig);
    if (!reportConfig) {
      const { data, error } = await supabase
        .from("processes")
        .select("report_config")
        .eq("id", processId)
        .single();
      if (error) throw error;
      rc = parseRc((data as any)?.report_config);
    }
    const nextRc = { ...rc, questionnaires: { ...(rc?.questionnaires || {}), [`${party}Text`]: text } };
    const { error: upErr } = await supabase.from("processes").update({ report_config: nextRc }).eq("id", processId);
    if (upErr) throw upErr;
    onReportConfigChange?.(nextRc);
  };

  const upsertExtractedItems = async (party: string, items: { number: number; text: string }[]) => {
    const { data: existing, error: fetchErr } = await supabase
      .from("questionnaires")
      .select("id, question_number, answer")
      .eq("process_id", processId)
      .eq("party", party);
    if (fetchErr) throw fetchErr;
    const map = new Map<number, { id: string; answer: string }>(
      (existing || []).map((r: any) => [Number(r.question_number), { id: String(r.id), answer: String(r.answer || "") }])
    );
    const inserts: any[] = [];
    const updates: { id: string; question_number: number; question: string; answer: string }[] = [];
    items.forEach((it) => {
      const existingRow = map.get(it.number);
      if (existingRow?.id) {
        updates.push({ id: existingRow.id, question_number: it.number, question: it.text, answer: existingRow.answer });
      } else {
        inserts.push({ process_id: processId, party, question_number: it.number, question: it.text, answer: "" });
      }
    });
    if (inserts.length) {
      const { error } = await supabase.from("questionnaires").insert(inserts);
      if (error) throw error;
    }
    if (updates.length) {
      const results = await Promise.all(
        updates.map((u) =>
          supabase
            .from("questionnaires")
            .update({ question: u.question, answer: u.answer, question_number: u.question_number })
            .eq("id", u.id)
        )
      );
      const anyErr = results.find((r: any) => r.error);
      if (anyErr) throw anyErr.error;
    }
  };

  const addExtractedToParty = (party: string, items: { number: number; text: string }[]) => {
    setQuestionnaires((curr) => {
      let lastNumber = curr
        .filter((q) => q.party === party)
        .reduce((m, q) => Math.max(m, q.question_number), 0);

      const newEntries: Questionnaire[] = items.map((it) => {
        const n = Number.isFinite(it.number) ? it.number : ++lastNumber;
        return {
          question_number: n,
          question: it.text,
          answer: "",
          party,
        };
      });
      return [...curr, ...newEntries];
    });
  };

  const saveBulkTextAsExtracted = async (
    party: string,
    rawText: string,
    options?: { clearBulk?: boolean }
  ) => {
    const pasted = rawText || "";
    if (!pasted.trim()) return;
    const items = extractQuestionsFromText(pasted);
    if (items.length === 0) {
      toast({
        title: "Nenhum quesito detectado",
        description: "Verifique a numeração (ex.: 1), 2., 3 -).",
      });
      return;
    }
    const consolidated = items.map((it, idx) => `${idx + 1}) ${it.text}`).join("\n");
    setExtractedBox((prev) => ({ ...prev, [party]: consolidated }));
    try {
      await persistQuestionnairesText(party, consolidated);
      await upsertExtractedItems(party, items);
      toast({ title: "Quesitos extraídos", description: "Conteúdo salvo e caixa única atualizada." });
      await fetchQuestionnaires();
    } catch (error: any) {
      toast({ title: "Erro ao salvar quesitos extraídos", description: error?.message ?? "Falha ao salvar.", variant: "destructive" });
    }
    if (options?.clearBulk) {
      setBulkInput((prev) => ({ ...prev, [party]: "" }));
    }
  };

  const handleBulkPaste = async (party: string) => {
    const pasted = bulkInput[party] || "";
    if (!pasted.trim()) {
      toast({ title: "Nada para extrair", description: "Cole o texto com a numeração dos quesitos." });
      return;
    }
    await saveBulkTextAsExtracted(party, pasted, { clearBulk: true });
  };

  const handleFileInput = async (party: string, e: React.ChangeEvent<HTMLInputElement>) => {
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
            description: "Tente colar o texto ou enviar um arquivo TXT.",
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

      const items = extractQuestionsFromText(text);
      if (items.length === 0) {
        toast({
          title: "Nenhum quesito detectado",
          description: "Verifique a numeração (ex.: 1), 2., 3 -).",
        });
        e.target.value = "";
        return;
      }

      const consolidated = items.map((it, idx) => `${idx + 1}) ${it.text}`).join("\n");
      setExtractedBox((prev) => ({ ...prev, [party]: consolidated }));
      try {
        await persistQuestionnairesText(party, consolidated);
        await upsertExtractedItems(party, items);
        toast({ title: "Quesitos extraídos", description: "Conteúdo salvo e caixa única atualizada." });
        await fetchQuestionnaires();
      } catch (error: any) {
        toast({ title: "Erro ao salvar quesitos extraídos", description: error?.message ?? "Falha ao salvar.", variant: "destructive" });
      }
    } finally {
      // não salvar arquivo; limpar input
      e.target.value = "";
    }
  };

  const renderPartyQuestions = (party: string, partyLabel: string) => {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="space-y-2">
            <Label className="text-xs">Colar Quesitos (em massa)</Label>
            <Textarea
              value={bulkInput[party] || ""}
              onChange={(e) => setBulkInput((prev) => ({ ...prev, [party]: e.target.value }))}
              onPaste={(e) => {
                const el = e.target as HTMLTextAreaElement;
                window.setTimeout(() => {
                  const nextVal = el?.value || "";
                  if (!String(nextVal).trim()) return;
                  void saveBulkTextAsExtracted(party, nextVal, { clearBulk: false });
                }, 0);
              }}
              placeholder={"Ex.:\n1) Pergunta do quesito...\n2. Outro quesito...\n3 - Mais um..."}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">O arquivo não será salvo; apenas extração local do texto.</p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".docx,.txt,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/pdf"
                onChange={(e) => handleFileInput(party, e)}
                className="max-w-xs"
              />
              <Button onClick={() => handleBulkPaste(party)} size="sm" variant="secondary">
                Extrair e adicionar
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Quesitos extraídos (caixa única)</Label>
          <Textarea
            value={extractedBox[party] || ""}
            onChange={async (e) => {
              const v = e.target.value;
              setExtractedBox((prev) => ({ ...prev, [party]: v }));
              try {
                await persistQuestionnairesText(party, v);
              } catch (error: any) {
                toast({ title: "Erro ao salvar caixa única", description: error?.message ?? "Falha ao salvar.", variant: "destructive" });
              }
            }}
            placeholder={`Quesitos da ${partyLabel} em caixa única...`}
            className="min-h-[160px]"
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>20. Quesitos da Perícia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando quesitos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="space-y-2">
        <CardTitle>20. Quesitos da Perícia</CardTitle>
        <Button
          onClick={async () => {
            try {
              const pending = ["claimant", "defendant", "judge"].filter((p) => String(bulkInput[p] || "").trim().length > 0);
              for (const p of pending) {
                await saveBulkTextAsExtracted(p, bulkInput[p] || "", { clearBulk: true });
              }

              const parties = ["claimant", "defendant", "judge"] as const;
              for (const party of parties) {
                const text = String(extractedBox[party] || "");
                if (!text.trim()) continue;
                const items = extractQuestionsFromText(text);
                await persistQuestionnairesText(party, text);
                await upsertExtractedItems(party, items);
              }
            } catch {
            }
            await saveQuestionnaires();
          }}
          className="w-full"
        >
          Salvar Quesitos
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="claimant" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="claimant">20.1 Reclamante</TabsTrigger>
            <TabsTrigger value="defendant">20.2 Reclamada(s)</TabsTrigger>
            <TabsTrigger value="judge">20.3 Juiz(a)</TabsTrigger>
          </TabsList>

          <TabsContent value="claimant">
            {renderPartyQuestions('claimant', 'Reclamante')}
          </TabsContent>

          <TabsContent value="defendant">
            {renderPartyQuestions('defendant', 'Reclamada(s)')}
          </TabsContent>

          <TabsContent value="judge">
            {renderPartyQuestions('judge', 'Juiz(a)')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
