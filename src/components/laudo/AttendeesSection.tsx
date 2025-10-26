import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractAttendeesFromAudioLLM } from "@/lib/llm";

interface Attendee {
  name: string;
  function: string;
  company?: string;
  obs?: string;
}

interface AttendeesSectionProps {
  value: Attendee[];
  onChange: (value: Attendee[]) => void;
}

export default function AttendeesSection({ value, onChange }: AttendeesSectionProps) {
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

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        await processAudioBlob(blob);
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setStatusLabel("Gravando áudio...");
    } catch (err: any) {
      toast({ title: "Falha ao acessar microfone", description: err?.message ?? "Verifique permissões de áudio.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    setIsRecording(false);
    setStatusLabel("");
  };

  const processAudioBlob = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusLabel("Processando áudio...");
    try {
      const file = new File([blob], `gravacao-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      const items = await extractAttendeesFromAudioLLM(file);
      if (!items || items.length === 0) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_ACTIVITIES_URL no .env", variant: "destructive" });
        return;
      }
      const newEntries = items.map((n) => ({ name: n, function: "", company: "", obs: "" }));
      onChange([...
        attendees,
        ...newEntries,
      ]);
      toast({ title: "Entrevistados extraídos", description: "Pessoas adicionadas a partir do áudio gravado." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível extrair entrevistados.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setStatusLabel("");
    }
  };

  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsProcessing(true);
    setStatusLabel("Processando arquivo de áudio...");
    try {
      const items = await extractAttendeesFromAudioLLM(file);
      if (!items || items.length === 0) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_ACTIVITIES_URL no .env", variant: "destructive" });
        return;
      }
      const newEntries = items.map((n) => ({ name: n, function: "", company: "", obs: "" }));
      onChange([...
        attendees,
        ...newEntries,
      ]);
      toast({ title: "Entrevistados extraídos", description: "Pessoas adicionadas a partir do áudio." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível extrair entrevistados.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setStatusLabel("");
    }
  };

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
            <Button type="button" onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? "destructive" : "secondary"} disabled={isProcessing}>
              {isRecording ? "Parar gravação" : "Gravar áudio"}
            </Button>
            <Input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" onChange={handleAudioFile} disabled={isRecording || isProcessing} />
            { (isRecording || isProcessing) && (
              <span className="text-xs text-muted-foreground">{statusLabel || (isRecording ? "Gravando..." : "Processando...")}</span>
            )}
          </div>
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