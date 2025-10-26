export type InitialExtractType = "insalubridade" | "periculosidade" | "acidentario";

/**
 * Calls a configurable LLM-backed endpoint to extract only the requested parts
 * of an initial petition text. Returns a plain string content or null if the
 * endpoint is not configured or cannot be reached.
 *
 * Expected response: { content: string } or { paragraphs: string[] }
 */
export async function extractInitialByLLM(text: string, type: InitialExtractType): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_EXTRACT_URL;
    if (!endpoint) return null;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, type }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({}));
    const content: unknown = (data?.content ?? (Array.isArray(data?.paragraphs) ? data.paragraphs.join("\n\n") : null));
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function transcribeAudioLLM(audioFile: File): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_AUDIO_TRANSCRIPTION_URL;
    if (!endpoint) return null;

    const formData = new FormData();
    formData.append("audio", audioFile);

    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => ({} as any));
    const transcription: unknown = (data?.transcription as unknown) ?? (data?.text as unknown) ?? (data?.content as unknown);
    if (typeof transcription === "string" && transcription.trim()) {
      return transcription.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractActivitiesFromAudioLLM(file: File): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_AUDIO_ACTIVITIES_URL;
    if (!endpoint) return null;

    const form = new FormData();
    form.append("file", file);
    form.append("task", "activities");

    const res = await fetch(endpoint, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({} as any));
    const content: unknown = (
      (data?.content as unknown) ??
      (Array.isArray(data?.items) ? (data.items as string[]).join("\n") : null)
    );
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractAttendeesFromAudioLLM(file: File): Promise<string[] | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_AUDIO_ACTIVITIES_URL;
    if (!endpoint) return null;

    const form = new FormData();
    form.append("file", file);
    form.append("task", "attendees");

    const res = await fetch(endpoint, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({} as any));
    const items: unknown = (
      (data?.items as unknown) ??
      (typeof data?.content === "string" ? (data.content as string).split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : null)
    );

    if (Array.isArray(items) && items.every((x) => typeof x === "string")) {
      return (items as string[]).map((s) => s.trim()).filter(Boolean);
    }
    return null;
  } catch {
    return null;
  }
}

export interface InsalubrityAnnexInput {
  annex: number;
  agent: string;
  obs?: string;
}

export interface EPIInput {
  equipment: string;
  protection: string;
  ca: string;
}

/**
 * Calls a configurable LLM-backed endpoint to evaluate insalubrity for annexes,
 * considering EPIs context. Returns a plain string content or null if not configured.
 *
 * Expected response: { content: string } | { paragraphs: string[] } | { results: string }
 */

function buildInsalubrityPrompt(annexes: InsalubrityAnnexInput[], epis: EPIInput[]): string {
  const annexesList = annexes
    .map((a) => `Anexo ${a.annex} — ${a.agent}${a.obs ? ` | Obs: ${a.obs}` : ""}`)
    .join("\n");
  const episList = (epis && epis.length > 0)
    ? epis.map((e) => `EPI: ${e.equipment} | Proteção: ${e.protection} | CA: ${e.ca}`).join("\n")
    : "Nenhum EPI informado.";

  return (
    `Você é um perito do trabalho. Baseie sua análise na Portaria nº 3214/78 e na NR-15 (anexos informados).\n` +
    `Objetivo: avaliar insalubridade considerando anexos e EPIs, e produzir parecer técnico estruturado em português (pt-BR).\n\n` +
    `Dados fornecidos:\n` +
    `Anexos NR-15 analisados:\n${annexesList || "(sem anexos)"}\n\n` +
    `EPIs considerados:\n${episList}\n\n` +
    `Instruções:\n` +
    `- Cite explicitamente os anexos da NR-15 aplicáveis e seus requisitos.\n` +
    `- Avalie a exposição e a caracterização do agente conforme a NR-15.\n` +
    `- Analise a eficácia dos EPIs informados, considerando o CA e a proteção declarada.\n` +
    `- Conclua o grau de insalubridade (mínimo/médio/máximo) e se os EPIs neutralizam ou eliminam o agente.\n` +
    `- Se não houver anexo aplicável, conclua pela inexistência de insalubridade.\n` +
    `- Inclua fundamentação normativa: “Conforme a Portaria nº 3214/78 e a NR-15”.\n` +
    `- Formate o resultado em seções: Fundamentação normativa; Exposição; EPIs e neutralização; Conclusão; Observações (se necessário).\n` +
    `- Mantenha tom técnico, objetivo e sem opiniões genéricas.`
  );
}

/**
 * Calls a configurable LLM-backed endpoint to evaluate insalubrity for annexes,
 * considering EPIs context. Returns a plain string content or null if not configured.
 *
 * Expected response: { content: string } | { paragraphs: string[] } | { results: string }
 */
export async function evaluateInsalubrityByLLM(
  annexes: InsalubrityAnnexInput[],
  epis: EPIInput[]
): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_INSALUBRITY_EVAL_URL;
    if (!endpoint) return null;

    const prompt = buildInsalubrityPrompt(annexes, epis);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annexes, epis, prompt }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({} as any));
    const content: unknown = (
      (data?.content as unknown) ??
      (Array.isArray(data?.paragraphs) ? (data.paragraphs as string[]).join("\n\n") : null) ??
      (data?.results as unknown)
    );

    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    return null;
  } catch {
    return null;
  }
}

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

export async function extractDocumentTextOCR(file: File): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_OCR_URL;
    if (endpoint) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({} as any));
      const text: unknown = (data?.text as unknown) ?? (data?.content as unknown) ?? (Array.isArray(data?.paragraphs) ? (data.paragraphs as string[]).join("\n\n") : null);
      if (typeof text === "string" && text.trim()) return text.trim();
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      // @ts-expect-error - pdfjs types
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
      return text || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function evaluateEpiReplacementPeriodByLLM(text: string, epis: EPIInput[]): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_EPI_PERIODICITY_URL;
    if (!endpoint) return null;

    const episList = (epis && epis.length > 0)
      ? epis.map((e) => `EPI: ${e.equipment} | Proteção: ${e.protection} | CA: ${e.ca}`).join("\n")
      : "Nenhum EPI informado.";

    const prompt = (
      `Você é um perito do trabalho. Avalie a periodicidade de trocas dos EPIs fornecidos, com base na NR-6 e em documentos anexados.\n` +
      `Objetivo: produzir um parecer técnico sobre periodicidade de substituição/inspeção e validade, com recomendações claras.\n\n` +
      `EPIs considerados:\n${episList}\n\n` +
      `Instruções:\n` +
      `- Identifique periodicidade sugerida pelo documento. Caso ausente, proponha periodicidade com base em boas práticas.\n` +
      `- Considere o CA, vida útil e condições de uso/limpeza/manutenção.\n` +
      `- Cite fundamentação normativa: “Conforme a Portaria nº 3214/78 e a NR-6”.\n` +
      `- Formate em seções: Normas; Itens avaliados; Periodicidade recomendada; Observações.\n`
    );

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, epis, prompt }),
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => ({} as any));
    const content: unknown = (data?.content as unknown) ?? (Array.isArray(data?.paragraphs) ? (data.paragraphs as string[]).join("\n\n") : null) ?? (data?.results as unknown);
    if (typeof content === "string" && content.trim()) return content.trim();
    return null;
  } catch {
    return null;
  }
}

export async function evaluateEpiUsageByLLM(activitiesText: string, epis: EPIInput[]): Promise<string | null> {
  try {
    const endpoint = (import.meta as any).env?.VITE_LLM_EPI_USAGE_URL;
    if (!endpoint) return null;

    const episList = (epis && epis.length > 0)
      ? epis.map((e) => `EPI: ${e.equipment} | Proteção: ${e.protection} | CA: ${e.ca}`).join("\n")
      : "Nenhum EPI informado.";

    const prompt = (
      `Você é um perito do trabalho. A partir da descrição das atividades/áudio transcrito, infira a possível utilização dos EPIs mediante sinalização/instruções.\n` +
      `Objetivo: indicar quais EPIs devem ser utilizados, quando e por qual sinalização/requisito, fundamentando na NR-6 e boas práticas.\n\n` +
      `EPIs considerados:\n${episList}\n\n` +
      `Instruções:\n` +
      `- Relacione tarefas com EPIs adequados, apontando gatilhos/sinalizações (placas, avisos, procedimentos).\n` +
      `- Destaque situações obrigatórias e recomendadas, com justificativas.\n` +
      `- Cite fundamentação normativa: “Conforme a Portaria nº 3214/78 e a NR-6”.\n` +
      `- Formate em seções: Tarefas; EPIs requeridos; Sinalização/condições; Observações.\n`
    );

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activities: activitiesText, epis, prompt }),
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => ({} as any));
    const content: unknown = (data?.content as unknown) ?? (Array.isArray(data?.paragraphs) ? (data.paragraphs as string[]).join("\n\n") : null) ?? (data?.results as unknown);
    if (typeof content === "string" && content.trim()) return content.trim();
    return null;
  } catch {
    return null;
  }
}