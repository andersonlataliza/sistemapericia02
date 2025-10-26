import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { extractDocumentTextOCR, evaluateEpiReplacementPeriodByLLM, evaluateEpiUsageByLLM, extractActivitiesFromAudioLLM, transcribeAudioLLM } from "@/lib/llm";

interface EPI {
  equipment: string;
  protection: string;
  ca: string;
}

interface EPISectionProps {
  value: EPI[];
  onChange: (value: EPI[]) => void;
  introText?: string;
  onIntroTextChange?: (value: string) => void;
}

export default function EPISection({ value, onChange, introText, onIntroTextChange }: EPISectionProps) {
  const defaultIntro =
    "Para função exercida pela Reclamante a empresa realizava a entrega dos seguintes equipamentos de proteção individual - E.P.I. (Art. 166 da CLT e NR-6, item 6.2 da Portaria nº 3214/78 do MTE):";
  const intro = (introText === undefined || introText === "") ? defaultIntro : introText;
  const [introValue, setIntroValue] = useState(intro);

  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrStatusLabel, setOcrStatusLabel] = useState("");
  const [periodicityResult, setPeriodicityResult] = useState<string>("");

  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioStatusLabel, setAudioStatusLabel] = useState("");
  const [epiUsageResult, setEpiUsageResult] = useState<string>("");

  // Estados para gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [recordingStatusLabel, setRecordingStatusLabel] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const addEPI = () => {
    onChange([...value, { equipment: "", protection: "", ca: "" }]);
  };

  const removeEPI = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateEPI = (index: number, field: keyof EPI, newValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  const mapToEPIInput = () => value.map((e) => ({ equipment: e.equipment, protection: e.protection, ca: e.ca }));

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsProcessingOCR(true);
    setOcrStatusLabel("Processando arquivo por OCR...");
    try {
      const text = await extractDocumentTextOCR(file);
      if (!text) {
        toast({ title: "OCR não disponível", description: "Configure VITE_OCR_URL ou envie um PDF com texto selecionável.", variant: "destructive" });
        return;
      }
      const evaluated = await evaluateEpiReplacementPeriodByLLM(text, mapToEPIInput());
      if (!evaluated) {
        toast({ title: "LLM de periodicidade indisponível", description: "Configure VITE_LLM_EPI_PERIODICITY_URL no .env.", variant: "destructive" });
        setPeriodicityResult(text);
        return;
      }
      setPeriodicityResult(evaluated);
      toast({ title: "Periodicidade avaliada", description: "Resultado gerado a partir do documento por OCR." });
    } catch (err: any) {
      toast({ title: "Falha na avaliação por OCR", description: err?.message ?? "Erro ao processar o arquivo.", variant: "destructive" });
    } finally {
      setIsProcessingOCR(false);
      setOcrStatusLabel("");
    }
  };

  const processAudioBlob = async (blob: Blob) => {
    setIsProcessingAudio(true);
    setAudioStatusLabel("Processando áudio...");
    
    try {
      const activities = await extractActivitiesFromAudioLLM(blob);
      
      if (activities && activities.length > 0) {
        setAudioStatusLabel("Avaliando uso de EPIs...");
        const epiUsage = await evaluateEpiUsageByLLM(activities, value);
        setEpiUsageResult(epiUsage);
        setAudioStatusLabel("Processamento concluído!");
        
        toast({
          title: "Áudio processado com sucesso",
          description: "As atividades foram extraídas e o uso de EPIs foi avaliado.",
        });
      } else {
        setAudioStatusLabel("Nenhuma atividade encontrada no áudio");
        toast({
          title: "Nenhuma atividade encontrada",
          description: "Não foi possível extrair atividades do áudio fornecido.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
      setAudioStatusLabel("Erro ao processar áudio");
      toast({
        title: "Erro ao processar áudio",
        description: "Ocorreu um erro ao processar o arquivo de áudio.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const extension = (mimeType.split('/')[1] || 'webm');
        const file = new File([blob], `recording.${extension}`, { type: mimeType });
        setAudioBlob(file);
        
        // Transcrever automaticamente
        setIsProcessingRecording(true);
        setRecordingStatusLabel("Transcrevendo áudio...");
        
        try {
          const transcription = await transcribeAudioLLM(file);
          setTranscriptionResult(transcription);
          setRecordingStatusLabel("Transcrição concluída!");
          
          toast({
            title: "Áudio transcrito com sucesso",
            description: "O áudio foi transcrito automaticamente.",
          });
        } catch (error) {
          console.error("Erro ao transcrever áudio:", error);
          setRecordingStatusLabel("Erro na transcrição");
          toast({
            title: "Erro na transcrição",
            description: "Ocorreu um erro ao transcrever o áudio.",
            variant: "destructive",
          });
        } finally {
          setIsProcessingRecording(false);
        }

        // Parar todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatusLabel("Gravando...");
      
      toast({
        title: "Gravação iniciada",
        description: "Fale sobre os EPIs utilizados.",
      });
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast({
        title: "Erro ao iniciar gravação",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingStatusLabel("Finalizando gravação...");
    }
  };

  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsProcessingAudio(true);
    setAudioStatusLabel("Processando áudio de tarefas...");
    try {
      const activities = await extractActivitiesFromAudioLLM(file);
      if (!activities) {
        toast({ title: "Audio LLM não configurado", description: "Defina VITE_LLM_AUDIO_ACTIVITIES_URL no .env", variant: "destructive" });
        return;
      }
      const evaluated = await evaluateEpiUsageByLLM(activities, mapToEPIInput());
      if (!evaluated) {
        toast({ title: "LLM de uso de EPIs indisponível", description: "Configure VITE_LLM_EPI_USAGE_URL no .env.", variant: "destructive" });
        setEpiUsageResult(activities);
        return;
      }
      setEpiUsageResult(evaluated);
      toast({ title: "Utilização de EPIs avaliada", description: "Resultado gerado a partir do áudio de tarefas." });
    } catch (err: any) {
      toast({ title: "Falha ao processar áudio", description: err?.message ?? "Não foi possível avaliar utilização de EPIs.", variant: "destructive" });
    } finally {
      setIsProcessingAudio(false);
      setAudioStatusLabel("");
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>13. Equipamentos de Proteção Individual (EPIs)</CardTitle>
        <Button onClick={addEPI} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar EPI
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="epi-intro">Introdução (editável)</Label>
          <Textarea
            id="epi-intro"
            value={introValue}
            onChange={(e) => {
              setIntroValue(e.target.value);
              onIntroTextChange?.(e.target.value);
            }}
            className="min-h-[60px]"
          />
        </div>
        <p className="text-sm">{introValue}</p>

        {value.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum EPI cadastrado. Clique em "Adicionar EPI" para começar.
          </p>
        ) : (
          value.map((epi, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
              <div className="md:col-span-1">
                <Label htmlFor={`epi-equipment-${index}`}>Equipamento</Label>
                <Input
                  id={`epi-equipment-${index}`}
                  value={epi.equipment}
                  onChange={(e) => updateEPI(index, "equipment", e.target.value)}
                  placeholder="Ex: Protetor auricular"
                />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor={`epi-protection-${index}`}>Proteção</Label>
                <Input
                  id={`epi-protection-${index}`}
                  value={epi.protection}
                  onChange={(e) => updateEPI(index, "protection", e.target.value)}
                  placeholder="Ex: Ruído"
                />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor={`epi-ca-${index}`}>CA</Label>
                <Input
                  id={`epi-ca-${index}`}
                  value={epi.ca}
                  onChange={(e) => updateEPI(index, "ca", e.target.value)}
                  placeholder="Nº CA"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeEPI(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}

        <div className="space-y-2">
          <Label>Periodicidade de trocas (OCR de documento)</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="file" accept="application/pdf,image/*,.png,.jpg,.jpeg" onChange={handleOcrFile} disabled={isProcessingOCR} />
            {isProcessingOCR && (
              <span className="text-xs text-muted-foreground">{ocrStatusLabel || "Processando..."}</span>
            )}
          </div>
          <Textarea value={periodicityResult} onChange={(e) => setPeriodicityResult(e.target.value)} placeholder="Resultado da avaliação de periodicidade" className="min-h-[140px]" />
          <p className="text-xs text-muted-foreground">O arquivo é enviado ao OCR (se configurado) ou extraído via PDFJS para texto. Em seguida, o LLM avalia a periodicidade das trocas dos EPIs.</p>
        </div>

        <div className="space-y-2">
          <Label>Utilização de EPIs a partir de áudio de tarefas</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" onChange={handleAudioFile} disabled={isProcessingAudio} />
            {isProcessingAudio && (
              <span className="text-xs text-muted-foreground">{audioStatusLabel || "Processando..."}</span>
            )}
          </div>
          <Textarea value={epiUsageResult} onChange={(e) => setEpiUsageResult(e.target.value)} placeholder="Resultado da avaliação de utilização de EPIs" className="min-h-[140px]" />
          <p className="text-xs text-muted-foreground">O áudio é transcrito e as atividades são analisadas pelo LLM para inferir EPIs requeridos e sinalizações/condições de uso.</p>
        </div>

        <div className="space-y-2">
          <Label>Gravação de áudio com transcrição automática</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingRecording}
              variant={isRecording ? "destructive" : "default"}
            >
              {isRecording ? "Parar Gravação" : "Iniciar Gravação"}
            </Button>
            {(isRecording || isProcessingRecording) && (
              <span className="text-xs text-muted-foreground">{recordingStatusLabel || "Processando..."}</span>
            )}
          </div>
          {transcriptionResult && (
            <div className="space-y-2">
              <Label>Transcrição do áudio</Label>
              <Textarea 
                value={transcriptionResult} 
                onChange={(e) => setTranscriptionResult(e.target.value)} 
                placeholder="A transcrição aparecerá aqui..." 
                className="min-h-[100px]" 
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">Grave um áudio falando sobre os EPIs utilizados. O sistema irá transcrever automaticamente o que foi dito.</p>
        </div>
      </CardContent>
    </Card>
  );
}
