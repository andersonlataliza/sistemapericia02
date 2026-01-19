import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { transcribeAudioLLM, proofreadTextLLM } from "@/lib/llm";
import { isSpeechRecognitionAvailable, startSpeechRecognition, SpeechHandle } from "@/lib/speech";

interface DiscordancesSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DiscordancesSection({ value, onChange }: DiscordancesSectionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionHandleRef = useRef<SpeechHandle | null>(null);
  const usingSpeechRef = useRef<boolean>(false);
  const speechBufferRef = useRef<string>("");
  const interimBufferRef = useRef<string>("");
  const [transcriptionText, setTranscriptionText] = useState<string>("");

  const startRecording = async () => {
    try {
      if (isSpeechRecognitionAvailable()) {
        usingSpeechRef.current = true;
        setIsRecording(true);
        setStatusLabel("Transcrevendo pelo navegador...");
        recognitionHandleRef.current = startSpeechRecognition({
          lang: "pt-BR",
          continuous: true,
          interimResults: true,
          onInterim: (partial) => {
            interimBufferRef.current = partial || "";
            const display = [speechBufferRef.current, interimBufferRef.current].filter(Boolean).join(" ");
            setTranscriptionText(display);
          },
          onResult: (text) => {
            const finalText = (text || "").trim();
            if (!finalText) return;
            speechBufferRef.current = [speechBufferRef.current, finalText].filter(Boolean).join(" ");
            interimBufferRef.current = "";
            setTranscriptionText(speechBufferRef.current);
            onChange((value ? value + "\n" : "") + finalText);
          },
          onError: (err) => {
            const code = (err?.error || err?.name || "").toString();
            const hint = code.includes("not-allowed") || code.includes("service-not-allowed")
              ? "Permissão negada. Autorize o microfone nas permissões do navegador."
              : (err?.message || "Verifique permissões de microfone e HTTPS/localhost");
            toast({ title: "Falha no reconhecimento de voz", description: hint, variant: "destructive" });
            try {
              const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
              const hasMediaRecorder = typeof window !== "undefined" && typeof (window as any).MediaRecorder !== "undefined";
              if (hasMediaDevices && hasMediaRecorder) {
                usingSpeechRef.current = false;
                (async () => {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  const recorder = new MediaRecorder(stream);
                  chunksRef.current = [];
                  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) { chunksRef.current.push(e.data); } };
                  recorder.onstop = async () => {
                    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                    chunksRef.current = [];
                    await processAudioBlob(blob);
                    try { stream.getTracks().forEach((t) => t.stop()); } catch {}
                  };
                  mediaRecorderRef.current = recorder;
                  recorder.start();
                  setStatusLabel("Gravando áudio...");
                })().catch(() => {});
              }
            } catch {}
          }
        });
        return;
      }
      const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
      const hasMediaRecorder = typeof window !== "undefined" && typeof (window as any).MediaRecorder !== "undefined";
      if (!hasMediaDevices || !hasMediaRecorder) {
        toast({
          title: "Gravação de áudio não suportada",
          description: "Seu navegador/ambiente não suporta MediaRecorder. Use o upload de arquivo.",
          variant: "destructive",
        });
        return;
      }

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
      const message = typeof err?.message === "string" && err.message.trim() ? err.message.trim() : "Verifique permissões de áudio e se está em localhost/https.";
      toast({ title: "Falha ao acessar microfone", description: message, variant: "destructive" });
    }
  };

  const stopRecording = () => {
    try {
      if (usingSpeechRef.current) {
        recognitionHandleRef.current?.stop();
        usingSpeechRef.current = false;
      } else {
        mediaRecorderRef.current?.stop();
      }
    } catch {}
    setIsRecording(false);
    setStatusLabel("");
  };

  const processAudioBlob = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusLabel("Processando áudio...");
    try {
      const file = new File([blob], `gravacao-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      const text = await transcribeAudioLLM(file);
      if (!text) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_TRANSCRIPTION_URL no .env", variant: "destructive" });
        return;
      }
      setTranscriptionText(String(text).trim());
      const newValue = [value?.trim(), String(text).trim()].filter(Boolean).join("\n\n");
      onChange(newValue);
      toast({ title: "Transcrição concluída", description: "Texto inserido a partir do áudio gravado." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível transcrever o áudio.", variant: "destructive" });
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
      const text = await transcribeAudioLLM(file);
      if (!text) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_TRANSCRIPTION_URL no .env", variant: "destructive" });
        return;
      }
      setTranscriptionText(String(text).trim());
      const newValue = [value?.trim(), String(text).trim()].filter(Boolean).join("\n\n");
      onChange(newValue);
      toast({ title: "Transcrição concluída", description: "Conteúdo inserido a partir do áudio." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível transcrever o áudio.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setStatusLabel("");
    }
  };

  const exportTranscriptionAppend = () => {
    const text = (transcriptionText || "").trim();
    if (!text) {
      toast({ title: "Nada para exportar", description: "A transcrição está vazia.", variant: "destructive" });
      return;
    }
    const newValue = [value?.trim(), text].filter(Boolean).join("\n\n");
    onChange(newValue);
    toast({ title: "Exportado (anexado)", description: "Transcrição adicionada às discordâncias apresentadas." });
  };

  const exportTranscriptionReplace = () => {
    const text = (transcriptionText || "").trim();
    if (!text) {
      toast({ title: "Nada para exportar", description: "A transcrição está vazia.", variant: "destructive" });
      return;
    }
    onChange(text);
    toast({ title: "Exportado (substituído)", description: "Discordâncias substituídas pela transcrição." });
  };

  const clearTranscription = () => {
    setTranscriptionText("");
    try {
      speechBufferRef.current = "";
      if (typeof (interimBufferRef as any)?.current !== "undefined") {
        (interimBufferRef as any).current = "";
      }
    } catch {}
    toast({ title: "Transcrição limpa", description: "Você pode iniciar uma nova gravação." });
  };

  const proofreadDescription = async () => {
    const text = (value || "").trim();
    if (!text) {
      toast({ title: "Nada para revisar", description: "Digite as discordâncias apresentadas antes de revisar.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setStatusLabel("Revisando texto...");
    try {
      const reviewed = await proofreadTextLLM(text);
      if (!reviewed) {
        toast({ title: "LLM de revisão não configurado", description: "Defina VITE_LLM_TEXT_PROOFREAD_URL no .env", variant: "destructive" });
        return;
      }
      onChange(String(reviewed).trim());
      toast({ title: "Texto revisado", description: "Ortografia e gramática corrigidas pela IA." });
    } catch (err: any) {
      toast({ title: "Falha na revisão", description: err?.message ?? "Não foi possível revisar o texto.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setStatusLabel("");
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>12.2. Discordâncias apresentadas pela reclamada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="discordances">Discordâncias apresentadas pela reclamada</Label>
            <Textarea
            id="discordances"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            placeholder="Liste as discordâncias alegadas pela reclamada em relação às atividades, condições de trabalho, EPIs/EPCs, medições, resultados, ou qualquer outro ponto do laudo."
            className="min-h-[200px] mt-2"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <Button type="button" onClick={proofreadDescription} variant="default" disabled={isProcessing || isRecording}>
              Revisar texto (IA)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">A IA corrige ortografia e melhora a clareza da redação.</p>
        </div>

        <div className="space-y-2">
          <Label>Gravação de áudio com transcrição automática</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Button type="button" onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? "destructive" : "secondary"} disabled={isProcessing}>
              {isRecording ? "Parar gravação" : "Gravar áudio"}
            </Button>
            <Input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" onChange={handleAudioFile} disabled={isRecording || isProcessing} />
            { (isRecording || isProcessing) && (
              <span className="text-xs text-muted-foreground">{statusLabel || (isRecording ? "Gravando..." : "Processando...")}</span>
            )}
          </div>
          <div className="space-y-2">
            <Label>Transcrição do áudio</Label>
            <Textarea
              value={transcriptionText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTranscriptionText(e.target.value)}
              placeholder="A transcrição aparecerá aqui..."
              className="min-h-[100px]"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={exportTranscriptionAppend} variant="default" disabled={isProcessing || isRecording}>
                Exportar (Anexar)
              </Button>
              <Button type="button" onClick={exportTranscriptionReplace} variant="secondary" disabled={isProcessing || isRecording}>
                Exportar (Substituir)
              </Button>
              <Button type="button" onClick={clearTranscription} variant="outline" disabled={isProcessing || isRecording}>
                Limpar transcrição
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Grave um áudio descrevendo as discordâncias. O sistema irá transcrever automaticamente o que foi dito.</p>
        </div>
      </CardContent>
    </Card>
  );
}
