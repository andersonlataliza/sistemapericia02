import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractActivitiesFromAudioLLM } from "@/lib/llm";

interface ActivitiesSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ActivitiesSection({ value, onChange }: ActivitiesSectionProps) {
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
      const extracted = await extractActivitiesFromAudioLLM(file);
      if (!extracted) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_ACTIVITIES_URL no .env", variant: "destructive" });
        return;
      }
      const newValue = [value?.trim(), extracted.trim()].filter(Boolean).join("\n\n");
      onChange(newValue);
      toast({ title: "Atividades extraídas", description: "Conteúdo inserido a partir do áudio gravado." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível extrair atividades.", variant: "destructive" });
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
      const extracted = await extractActivitiesFromAudioLLM(file);
      if (!extracted) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_ACTIVITIES_URL no .env", variant: "destructive" });
        return;
      }
      const newValue = [value?.trim(), extracted.trim()].filter(Boolean).join("\n\n");
      onChange(newValue);
      toast({ title: "Atividades extraídas", description: "Conteúdo inserido a partir do áudio." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível extrair atividades.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setStatusLabel("");
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>12. Atividades da Reclamante</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="activities">Descrição detalhada das atividades</Label>
          <Textarea
            id="activities"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Descreva as atividades exercidas pela reclamante, incluindo tarefas, equipamentos utilizados, frequência..."
            className="min-h-[200px] mt-2"
          />
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
            Se configurado, o arquivo é enviado ao endpoint LLM para transcrição e extração das atividades. O áudio não é salvo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
