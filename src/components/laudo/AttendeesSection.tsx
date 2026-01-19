import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractAttendeesFromAudioLLM, transcribeAudioLLM } from "@/lib/llm";

interface Attendee {
  name: string;
  function: string;
  company?: string;
  obs?: string;
}

interface AttendeesSectionProps {
  value: Attendee[];
  onChange: (value: Attendee[]) => void;
  processId?: string;
}

export default function AttendeesSection({ value, onChange, processId: _processId }: AttendeesSectionProps) {
  const attendees = value || [];

  const addAttendee = () => {
    onChange([...attendees, { name: '', function: '', company: '', obs: '' }]);
  };

  const removeAttendee = (index: number) => {
    onChange(attendees.filter((_, i) => i !== index));
  };

  const updateAttendee = (index: number, field: keyof Attendee, fieldValue: string) => {
    const updated = [...attendees];
    updated[index] = { ...updated[index], [field]: fieldValue };
    onChange(updated);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const [transcriptionText, setTranscriptionText] = useState<string>("");

  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsProcessing(true);
    setStatusLabel("Processando arquivo de áudio...");
    try {
      const text = await transcribeAudioLLM(file);
      if (text && text.trim()) {
        setTranscriptionText(text.trim());
        const names = extractNamesFromText(text);
        if (names.length > 0) {
          const newEntries = names.map((n) => ({ name: n, function: "", company: "", obs: "" }));
          onChange([...attendees, ...newEntries]);
          toast({ title: "Pessoas extraídas do texto", description: "Nomes adicionados a partir do áudio." });
          return;
        }
      }

      const items = await extractAttendeesFromAudioLLM(file);
      if (!items || items.length === 0) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_ACTIVITIES_URL no .env", variant: "destructive" });
        return;
      }
      const newEntries = items.map((n) => ({ name: n, function: "", company: "", obs: "" }));
      onChange([...attendees, ...newEntries]);
      toast({ title: "Entrevistados extraídos", description: "Pessoas adicionadas a partir do áudio." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível extrair entrevistados.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setStatusLabel("");
    }
  };

  // Heurística simples para extrair nomes de um texto transcrito.
  function extractNamesFromText(text: string): string[] {
    const candidates = text
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
    const nameLike = candidates.filter((s) => /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(s));
    // Deduplicar e normalizar
    const unique = Array.from(new Set(nameLike.map((s) => s.replace(/\s+/g, ' ').trim())));
    return unique.slice(0, 10);
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>8. Acompanhantes / Entrevistados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={addAttendee} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Pessoa
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Extrair a partir de áudio (LLM)</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" onChange={handleAudioFile} disabled={isProcessing} />
            {isProcessing && (
              <span className="text-xs text-muted-foreground">{statusLabel || "Processando..."}</span>
            )}
          </div>
          { transcriptionText && (
            <div className="mt-2">
              <Label className="text-xs">Transcrição do áudio</Label>
              <Textarea value={transcriptionText} onChange={(e) => setTranscriptionText(e.target.value)} className="min-h-[80px] mt-1" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Se configurado, o arquivo é enviado ao endpoint LLM para transcrição e extração de nomes de entrevistados. O áudio não é salvo.
          </p>
        </div>

        {attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma pessoa adicionada ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {attendees.map((attendee, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-medium">Pessoa {index + 1}</h4>
                  <Button
                    onClick={() => removeAttendee(index)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={attendee.name}
                      onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                      placeholder="Nome completo"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Função</Label>
                    <Input
                      value={attendee.function}
                      onChange={(e) => updateAttendee(index, 'function', e.target.value)}
                      placeholder="Ex: Assistente técnico"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Empresa</Label>
                    <Input
                      value={attendee.company || ''}
                      onChange={(e) => updateAttendee(index, 'company', e.target.value)}
                      placeholder="Empresa (opcional)"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input
                      value={attendee.obs || ''}
                      onChange={(e) => updateAttendee(index, 'obs', e.target.value)}
                      placeholder="Observações (opcional)"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
