import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
}

export default function QuestionnairesSection({ processId }: QuestionnairesSectionProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkInput, setBulkInput] = useState<Record<string, string>>({
    claimant: "",
    judge: "",
    defendant: "",
  });
  const { toast } = useToast();

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
      const promises = questionnaires.map((q) => {
        if (q.id) {
          return supabase
            .from("questionnaires")
            .update({
              question: q.question,
              answer: q.answer,
              question_number: q.question_number,
            })
            .eq("id", q.id);
        } else {
          return supabase
            .from("questionnaires")
            .insert({
              process_id: processId,
              party: q.party,
              question_number: q.question_number,
              question: q.question,
              answer: q.answer,
            });
        }
      });

      await Promise.all(promises);
      
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

  const handleBulkPaste = (party: string) => {
    const pasted = bulkInput[party] || "";
    if (!pasted.trim()) {
      toast({ title: "Nada para extrair", description: "Cole o texto com a numeração dos quesitos." });
      return;
    }
    const items = extractQuestionsFromText(pasted);
    if (items.length === 0) {
      toast({
        title: "Nenhum quesito detectado",
        description: "Verifique a numeração (ex.: 1), 2., 3 -).",
      });
      return;
    }
    addExtractedToParty(party, items);
    toast({ title: "Quesitos extraídos", description: `Adicionados ${items.length} quesitos.` });
    setBulkInput((prev) => ({ ...prev, [party]: "" }));
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
      } else {
        toast({ title: "Formato não suportado", description: "Use DOCX ou TXT.", variant: "destructive" });
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

      addExtractedToParty(party, items);
      toast({ title: "Quesitos extraídos", description: `Adicionados ${items.length} quesitos.` });
    } finally {
      // não salvar arquivo; limpar input
      e.target.value = "";
    }
  };

  const renderPartyQuestions = (party: string, partyLabel: string) => {
    const partyQuestions = getQuestionsByParty(party);
    const startIndex = questionnaires.findIndex(q => q.party === party && 
      q.question_number === (partyQuestions[0]?.question_number || 1));

    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="space-y-2">
            <Label className="text-xs">Colar Quesitos (em massa)</Label>
            <Textarea
              value={bulkInput[party] || ""}
              onChange={(e) => setBulkInput((prev) => ({ ...prev, [party]: e.target.value }))}
              placeholder={"Ex.:\n1) Pergunta do quesito...\n2. Outro quesito...\n3 - Mais um..."}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">O arquivo não será salvo; apenas extração local do texto.</p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => handleFileInput(party, e)}
                className="max-w-xs"
              />
              <Button onClick={() => handleBulkPaste(party)} size="sm" variant="secondary">
                Extrair e adicionar
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => addQuestion(party)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Quesito
          </Button>
        </div>

        {partyQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum quesito adicionado para {partyLabel}.
          </p>
        ) : (
          <div className="space-y-4">
            {partyQuestions.map((q, idx) => {
              const globalIndex = questionnaires.indexOf(q);
              
              return (
                <div key={globalIndex} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Label className="text-xs">Número do Quesito</Label>
                      <Input
                        type="number"
                        value={q.question_number}
                        onChange={(e) => updateQuestion(globalIndex, 'question_number', parseInt(e.target.value))}
                        className="mt-1 w-24"
                      />
                    </div>
                    <Button
                      onClick={() => removeQuestion(q.id, globalIndex)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Pergunta</Label>
                    <Textarea
                      value={q.question}
                      onChange={(e) => updateQuestion(globalIndex, 'question', e.target.value)}
                      placeholder="Digite a pergunta do quesito..."
                      className="mt-1 min-h-[80px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Resposta</Label>
                    <Textarea
                      value={q.answer}
                      onChange={(e) => updateQuestion(globalIndex, 'answer', e.target.value)}
                      placeholder="Digite a resposta do quesito..."
                      className="mt-1 min-h-[100px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        <Button onClick={saveQuestionnaires} className="w-full">
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