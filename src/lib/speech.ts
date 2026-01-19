export type SpeechHandle = { stop: () => void; isActive: boolean };

export function isSpeechRecognitionAvailable(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition)
    );
  } catch {
    return false;
  }
}

interface StartOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  onResult?: (text: string) => void;
  onError?: (error: any) => void;
  onInterim?: (text: string) => void;
}

export function startSpeechRecognition(opts: StartOptions = {}): SpeechHandle | null {
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const recog = new SR();
  recog.lang = opts.lang ?? "pt-BR";
  recog.interimResults = !!opts.interimResults;
  recog.continuous = opts.continuous ?? true;

  recog.onresult = (event: any) => {
    try {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = (result[0]?.transcript || "");
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (interimText && opts.onInterim) {
        opts.onInterim(interimText);
      }
      if (finalText && opts.onResult) {
        opts.onResult(finalText);
      }
    } catch (e) {
      opts.onError?.(e);
    }
  };

  recog.onerror = (e: any) => {
    opts.onError?.(e);
  };

  try {
    recog.start();
    return { stop: () => { try { recog.stop(); } catch {} }, isActive: true };
  } catch (e) {
    opts.onError?.(e);
    return null;
  }
}