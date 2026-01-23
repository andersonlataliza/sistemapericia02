import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Header, Footer, PageNumber, ImageRun, TableOfContents, PageBreak, HorizontalPositionAlign, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, VerticalPositionAlign, TextWrappingType, TabStopType, UnderlineType, SectionType } from "docx";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface ProcessData {
  process_number?: string;
  claimant_name?: string;
  defendant_name?: string;
  court?: string;
  objective?: string;
  methodology?: string;
  workplace_characteristics?: any;
  activities_description?: string;
  insalubrity_analysis?: string;
  insalubrity_results?: string;
  periculosity_analysis?: string;
  periculosity_results?: string;
  conclusion?: string;
  cover_data?: any;
  identifications?: any;
  claimant_data?: any;
  defendant_data?: any;
  initial_data?: string;
  defense_data?: string;
  diligence_data?: any;
  collective_protection?: string;
  periculosity_concept?: string;
  flammable_definition?: string;
  epis?: any[];
  attendees?: any[];
  documents_presented?: any[];
  discordances_presented?: string | any[];
  // Propriedades de inspeção
  inspection_date?: string | null;
  inspection_address?: string | null;
  inspection_time?: string | null;
  inspection_city?: string | null;
  // Configurações do relatório
  report_config?: {
    header?: {
      peritoName?: string;
      professionalTitle?: string;
      registrationNumber?: string;
      customText?: string;
      imageUrl?: string; // URL pública (ex: /logo.png em public/)
      imageDataUrl?: string; // DataURL base64 já carregado
      imageWidth?: number; // largura desejada em pontos
      imageHeight?: number; // altura desejada em pontos
      imageAlign?: 'left' | 'center' | 'right';
      fillPage?: boolean; // ocupa largura total da página sem margens
      spacingBelow?: number; // espaçamento abaixo do cabeçalho antes do conteúdo
    };
    footer?: {
      contactEmail?: string;
      customText?: string;
      showPageNumbers?: boolean;
      imageUrl?: string;
      imageDataUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      imageAlign?: 'left' | 'center' | 'right';
      fillPage?: boolean; // ocupa largura total da página sem margens
    };
  };
}

export function buildReportFilename(process: ProcessData, format: 'docx' | 'pdf'): string {
  const processNumber = process.process_number || 'processo';
  const sanitized = processNumber.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  return `laudo_${sanitized}_${timestamp}.${format}`;
}

function getDocxFlags(process: ProcessData): { includeToc: boolean; safeMode: boolean } {
  const parseRc = (rc: any) => { try { return typeof rc === 'string' ? JSON.parse(rc || '{}') : (rc || {}); } catch { return {}; } };
  const rc = parseRc((process as any).report_config);
  const flags = rc?.flags || {};
  return { includeToc: !!flags.include_docx_toc, safeMode: !!flags.docx_safe_mode };
}

// Converte DataURL para Uint8Array
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Carrega uma URL e retorna DataURL
async function loadUrlToDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; naturalWidth: number; naturalHeight: number }> {
  let target = url;
  let res = await fetch(target);
  if (!res.ok) {
    const refreshed = await (async () => {
      try {
        let u: URL;
        try { u = new URL(url); } catch { return null; }
        if (!u.hostname.includes("supabase.co")) return null;
        const base = "/storage/v1/object/";
        const idx = u.pathname.indexOf(base);
        if (idx === -1) return null;
        const after = u.pathname.slice(idx + base.length);
        const parts = after.split("/");
        let bucket = "";
        let objectPath = "";
        if (parts[0] === "sign" || parts[0] === "public") {
          bucket = parts[1];
          objectPath = parts.slice(2).join("/");
        } else if (parts[0] === "download") {
          if (parts[1] === "public") {
            bucket = parts[2];
            objectPath = parts.slice(3).join("/");
          } else {
            bucket = parts[1];
            objectPath = parts.slice(2).join("/");
          }
        } else {
          bucket = parts[0];
          objectPath = parts.slice(1).join("/");
        }
        if (!bucket || !objectPath) return null;
        const signed = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
        if ((signed as any)?.data?.signedUrl) return (signed as any).data.signedUrl as string;
        const pub = supabase.storage.from(bucket).getPublicUrl(objectPath);
        if ((pub as any)?.data?.publicUrl) return (pub as any).data.publicUrl as string;
        return null;
      } catch {
        return null;
      }
    })();
    if (refreshed) {
      target = refreshed;
      res = await fetch(target);
    }
  }
  if (!res.ok) throw new Error(`Falha ao carregar imagem: ${res.status}`);
  const blob = await res.blob();
  const format = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG";
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const dims = await new Promise<{ naturalWidth: number; naturalHeight: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ naturalWidth: img.naturalWidth || 0, naturalHeight: img.naturalHeight || 0 });
    img.src = dataUrl;
  });
  return { dataUrl, format, naturalWidth: dims.naturalWidth, naturalHeight: dims.naturalHeight };
}

// Obtém dimensões naturais a partir de um DataURL
async function getDataUrlDims(dataUrl: string): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ naturalWidth: img.naturalWidth || 0, naturalHeight: img.naturalHeight || 0 });
    img.src = dataUrl;
  });
}

// Detecta o tipo de mídia a partir do DataURL para o ImageRun
function getSupportedImageType(dataUrl: string): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  const lower = dataUrl.toLowerCase();
  if (lower.startsWith('data:image/png')) return 'png';
  if (lower.startsWith('data:image/jpeg') || lower.startsWith('data:image/jpg')) return 'jpg';
  if (lower.startsWith('data:image/gif')) return 'gif';
  if (lower.startsWith('data:image/bmp')) return 'bmp';
  return null;
}

function cmToPx(cm: number): number {
  return Math.round(cm * 96 / 2.54);
}

function cmToTwip(cm: number): number {
  return Math.round(cm * 1440 / 2.54);
}

function cmToPt(cm: number): number {
  return Math.round(cm * 72 / 2.54);
}

const DOCX_TABLE_BORDER = { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF" };
const DOCX_TABLE_BORDERS = {
  top: DOCX_TABLE_BORDER,
  bottom: DOCX_TABLE_BORDER,
  left: DOCX_TABLE_BORDER,
  right: DOCX_TABLE_BORDER,
  insideHorizontal: DOCX_TABLE_BORDER,
  insideVertical: DOCX_TABLE_BORDER,
};
const DOCX_TABLE_HEADER_FILL = "F2F2F2";
const DOCX_TABLE_CELL_MARGINS = { top: 120, bottom: 120, left: 160, right: 160 };

type DocxWidthType = (typeof WidthType)[keyof typeof WidthType];
type DocxAlignmentType = (typeof AlignmentType)[keyof typeof AlignmentType];

function docxCell(
  children: Paragraph[],
  options?: { header?: boolean; width?: { size: number; type: DocxWidthType } }
): TableCell {
  return new TableCell({
    children,
    width: options?.width,
    shading: options?.header ? { fill: DOCX_TABLE_HEADER_FILL } : undefined,
    margins: DOCX_TABLE_CELL_MARGINS,
  });
}

function docxCellText(
  text: string,
  options?: { bold?: boolean; size?: number; alignment?: DocxAlignmentType }
): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: String(text ?? ""), bold: options?.bold, size: options?.size ?? 24 })],
    alignment: options?.alignment ?? AlignmentType.LEFT,
    spacing: { after: 0, line: 360 },
  });
}

type AnnexResultChunk =
  | { kind: 'text'; text: string }
  | { kind: 'annex'; annex: number; title: string; lines: string[] };

function parseAnnexResultsChunks(raw: string): AnnexResultChunk[] {
  const text = String(raw || '').replace(/\r/g, '').trimEnd();
  if (!text.trim()) return [];

  const normalized = text.replace(/(\S)\s+(Resultado\s+Anexo\s*\d+\s*[—-])/gi, '$1\n\n$2');
  const chunks = normalized.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);

  const out: AnnexResultChunk[] = [];
  const headingRe = /^(?:Resultado\s+)?Anexo\s*(\d+)\s*[—-]\s*/i;

  for (const chunk of chunks) {
    const subChunks = chunk
      .split(/(?=Resultado\s+Anexo\s*\d+\s*[—-])/gi)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sc of subChunks) {
      const lines = sc.split(/\n/);
      const firstLine = String(lines[0] || '').trim();
      const m = firstLine.match(headingRe);
      if (!m) {
        out.push({ kind: 'text', text: sc });
        continue;
      }

      const annex = Number(m[1]);
      const afterPrefix = firstLine.slice(m[0].length).trim();
      const dupRe = new RegExp(`\\bAnexo\\s*${annex}\\s*[—-]\\s*`, 'i');
      const dupIdx = afterPrefix.search(dupRe);

      let themePart = afterPrefix;
      let tail = '';
      if (dupIdx >= 0) {
        themePart = afterPrefix.slice(0, dupIdx).trim();
        tail = afterPrefix.slice(dupIdx).trim();
        tail = tail.replace(new RegExp(`^Anexo\\s*${annex}\\s*[—-]\\s*[^|\\n]+`, 'i'), '').trim();
        tail = tail.replace(/^\|\s*/, '').trim();
      } else {
        const pipeIdx = afterPrefix.indexOf('|');
        if (pipeIdx >= 0) {
          themePart = afterPrefix.slice(0, pipeIdx).trim();
          tail = afterPrefix.slice(pipeIdx + 1).trim();
        } else {
          themePart = afterPrefix.split(/\n/)[0].trim();
          tail = afterPrefix.slice(themePart.length).trim();
        }
      }

      const title = themePart ? `Anexo ${annex} — ${themePart}`.trim() : `Anexo ${annex}`;
      const remainder = lines.slice(1).join('\n').trim();
      let body = [tail, remainder].filter(Boolean).join('\n').trim();
      body = body.replace(/\s*\|\s*/g, '\n');
      body = body.replace(/([^\n])\s+(Exposi[cç][aã]o:)/gi, '$1\n$2');
      body = body.replace(/([^\n])\s+(Obs:)/gi, '$1\n$2');
      body = body.replace(/([^\n])\s+(Observa[cç][aã]o(?:es)?:)/gi, '$1\n$2');
      body = body.replace(/([^\n])\s+(Enquadramento:)/gi, '$1\n$2');

      const bodyLines = body
        .split(/\n/)
        .map((l) => String(l || '').trim())
        .filter(Boolean)
        .filter((l) => !new RegExp(`^Anexo\\s*${annex}\\s*[—-]\\s*`, 'i').test(l));

      out.push({ kind: 'annex', annex, title, lines: bodyLines.length ? bodyLines : ['----------'] });
    }
  }

  const merged: AnnexResultChunk[] = [];
  const isDash = (lines: string[]) => lines.length === 1 && String(lines[0] || '').trim() === '----------';
  const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const normalizeLine = (l: string) => String(l || '').trim();

  for (const item of out) {
    if (item.kind !== 'annex') {
      merged.push(item);
      continue;
    }

    const last = merged[merged.length - 1];
    if (last?.kind !== 'annex' || last.annex !== item.annex) {
      merged.push(item);
      continue;
    }

    if (sameLines(last.lines, item.lines)) {
      continue;
    }

    if (isDash(last.lines) && !isDash(item.lines)) {
      merged[merged.length - 1] = item;
      continue;
    }

    if (!isDash(last.lines) && isDash(item.lines)) {
      continue;
    }

    const seen = new Set(last.lines.map(normalizeLine));
    const combined = [...last.lines];
    for (const ln of item.lines) {
      const key = normalizeLine(ln);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      combined.push(ln);
    }
    merged[merged.length - 1] = { ...last, lines: combined };
  }

  return merged;
}

function fitIntoBox(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number
): { width: number; height: number } {
  const bw = Math.max(1, Math.round(boxWidth));
  const bh = Math.max(1, Math.round(boxHeight));
  const nw = Math.max(0, Math.round(naturalWidth || 0));
  const nh = Math.max(0, Math.round(naturalHeight || 0));
  if (!nw || !nh) return { width: bw, height: bh };
  const scale = Math.min(bw / nw, bh / nh);
  return {
    width: Math.max(1, Math.round(nw * scale)),
    height: Math.max(1, Math.round(nh * scale)),
  };
}

const LAUDO_ITEM_IMAGE_BOX_CM = { width: 10, height: 6 };

function textToDocxParagraphs(
  raw: string,
  options?: { fontSize?: number; after?: number }
): (Paragraph | Table)[] {
  const fontSize = options?.fontSize ?? 24;
  const after = options?.after ?? 120;
  const text = String(raw || "").replace(/\r/g, "").trimEnd();
  if (!text.trim()) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "Não informado", size: fontSize })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after, line: 360 },
      }),
    ];
  }

  const parsed = parseAnnexResultsChunks(text);
  const hasAnnex = parsed.some((p) => p.kind === 'annex');

  const buildPlainParagraphs = (rawBlock: string): Paragraph[] => {
    const blocks = rawBlock
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n\s+\n/g, "\n\n").trim())
      .filter(Boolean);
    return blocks.map((b) => {
      const lines = b.split(/\n/);
      const isBullet = /^[-•]\s+/.test(lines[0] || "");
      const align = isBullet ? AlignmentType.LEFT : AlignmentType.JUSTIFIED;
      const children = lines
        .filter((l) => l != null)
        .map((line, idx) =>
          new TextRun({
            text: String(line),
            size: fontSize,
            break: idx === 0 ? undefined : 1,
          } as any)
        );
      return new Paragraph({
        children,
        alignment: align,
        spacing: { after, line: 360 },
      });
    });
  };

  if (!hasAnnex) {
    return buildPlainParagraphs(text);
  }

  const out: (Paragraph | Table)[] = [];
  parsed.forEach((p) => {
    if (p.kind === 'text') {
      out.push(...buildPlainParagraphs(p.text));
      return;
    }

    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        borders: DOCX_TABLE_BORDERS,
        rows: [
          new TableRow({
            children: [
              docxCell([
                new Paragraph({
                  children: [
                    new TextRun({
                      text: p.title,
                      size: fontSize,
                      bold: true,
                      underline: { type: UnderlineType.SINGLE },
                    } as any),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0, line: 360 },
                }),
              ]),
            ],
          }),
        ],
      })
    );

    const bodyRuns = p.lines.map((line, idx) =>
      new TextRun({
        text: String(line),
        size: fontSize,
        break: idx === 0 ? undefined : 1,
      } as any)
    );
    const mostlyShort = p.lines.length >= 2 && p.lines.every((l) => String(l).length <= 90);
    out.push(
      new Paragraph({
        children: bodyRuns,
        alignment: mostlyShort ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
        spacing: { after: 180, line: 360 },
      })
    );
  });

  return out;
}

async function createProfessionalHeader(process: ProcessData): Promise<Paragraph[]> {
  // Usar configurações personalizadas se disponíveis, senão usar cover_data como fallback
  const reportConfig = process.report_config?.header;
  const coverData = process.cover_data || {};
  
  const peritoName = reportConfig?.peritoName || coverData.peritoName || "PERITO JUDICIAL";
  const professionalTitle = reportConfig?.professionalTitle || coverData.professionalTitle || "ENGENHEIRO CIVIL";
  const registrationNumber = reportConfig?.registrationNumber || coverData.registrationNumber || "CREA";
  const customText = reportConfig?.customText || "";
  const headerAlign: 'left' | 'center' | 'right' = (reportConfig?.fillPage ? 'left' : (reportConfig?.imageAlign || 'left'));
  const alignMap = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  };
  
  const fillAll = !!reportConfig?.fillPage;
  const headerElements: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: peritoName.toUpperCase(),
          bold: true,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: professionalTitle.toUpperCase(),
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: registrationNumber.toUpperCase(),
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: customText ? 200 : 400 },
    }),
  ];

  if (fillAll) {
    headerElements.splice(0, headerElements.length);
  }

  // Adicionar texto personalizado se fornecido
  if (customText && !fillAll) {
    headerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: customText,
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  // Inserir imagem no início do cabeçalho, se configurada
  try {
    const flags = getDocxFlags(process);
    let dataUrl: string | undefined = flags.safeMode ? undefined : reportConfig?.imageDataUrl;
    let naturalWidth = 0;
    let naturalHeight = 0;
    if (!dataUrl && reportConfig?.imageUrl && !flags.safeMode) {
      const loaded = await loadUrlToDataUrl(reportConfig.imageUrl);
      dataUrl = loaded.dataUrl;
      naturalWidth = loaded.naturalWidth;
      naturalHeight = loaded.naturalHeight;
    }
    if (dataUrl) {
      const imgType = getSupportedImageType(dataUrl);
      if (!imgType) {
        return headerElements;
      }
      if (!naturalWidth || !naturalHeight) {
        const dims = await getDataUrlDims(dataUrl);
        naturalWidth = dims.naturalWidth;
        naturalHeight = dims.naturalHeight;
      }
      const fillPage = !!reportConfig?.fillPage;
      const desiredWpt = (reportConfig?.imageWidth as any) != null ? Number(reportConfig?.imageWidth as any) : 500;
      let desiredHpt = (reportConfig?.imageHeight as any) != null ? Number(reportConfig?.imageHeight as any) : undefined;
      if (!desiredHpt) {
        desiredHpt = naturalWidth && naturalHeight ? Math.round(desiredWpt * (naturalHeight / naturalWidth)) : 40;
      }

      // Converter pontos (pt) em pixels (px) para o DOCX
      let widthPx = Math.max(1, Math.round(desiredWpt * (96 / 72)));
      let heightPx = Math.max(1, Math.round((desiredHpt || 40) * (96 / 72)));

      // Preencher largura aproximada da página quando solicitado
      if (fillPage) {
        widthPx = cmToPx(21.2);
        heightPx = cmToPx(3.04);
      }

      const bytes = dataUrlToUint8Array(dataUrl);
      const imageRun = new ImageRun({
        data: bytes,
        transformation: { width: widthPx, height: heightPx },
        type: imgType,
        floating: fillPage ? {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: -cmToTwip(0.2) },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
          wrap: { type: TextWrappingType.NONE },
          margins: { left: 0, right: 0, top: 0, bottom: 0 },
          allowOverlap: true,
        } : undefined,
      });

      headerElements.unshift(
        new Paragraph({
          children: [imageRun],
          alignment: alignMap[headerAlign],
          spacing: { before: 0, after: 0 },
          indent: { left: 0, right: 0 },
        })
      );
    }
  } catch (e) {
    console.warn('Cabeçalho DOCX: falha ao inserir imagem', e);
  }

  return headerElements;
}

// 12.1. Registro fotográfico (DOCX)
async function createPhotoRegisterDocxSection(process: ProcessData): Promise<(Paragraph | Table)[]> {
  const photos: Array<{ id: string; type: 'url' | 'storage'; url?: string; file_path?: string; signed_url?: string; caption?: string }>
    = Array.isArray((process as any)?.report_config?.photo_register) ? ((process as any).report_config.photo_register as any[]) : [];
  const flags = getDocxFlags(process);

  const elements: (Paragraph | Table)[] = [];
  elements.push(
    new Paragraph({
      children: [new TextRun({ text: "12.1 REGISTRO FOTOGRÁFICO", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 200 },
    })
  );

  if (!Array.isArray(photos) || photos.length === 0) {
  elements.push(new Paragraph({ children: [new TextRun({ text: "Nenhuma foto adicionada.", size: 24 })] }));
    return elements;
  }

  const rows: TableRow[] = [];
  const makeCellForPhoto = async (p?: any): Promise<TableCell> => {
    const children: Paragraph[] = [];
    if (p) {
      const src = p.signed_url || p.url;
      if (!flags.safeMode && src) {
        try {
          const loaded = await loadUrlToDataUrl(src);
          const mediaType = getSupportedImageType(loaded.dataUrl);
          if (mediaType) {
            const targetPxW = 280;
            const targetPxH = loaded.naturalWidth && loaded.naturalHeight
              ? Math.round(targetPxW * (loaded.naturalHeight / loaded.naturalWidth))
              : 160;
            const bytes = dataUrlToUint8Array(loaded.dataUrl);
            const imgRun = new ImageRun({ data: bytes, transformation: { width: targetPxW, height: targetPxH }, type: mediaType });
            children.push(new Paragraph({ children: [imgRun], alignment: AlignmentType.CENTER }));
          }
        } catch {}
      }
      const cap = String(p.caption || "").trim();
      if (cap) children.push(new Paragraph({ children: [new TextRun({ text: cap, size: 24 })], alignment: AlignmentType.CENTER }));
    }
    return docxCell(children);
  };

  for (let i = 0; i < photos.length; i += 2) {
    const left = await makeCellForPhoto(photos[i]);
    const right = await makeCellForPhoto(photos[i + 1]);
    rows.push(new TableRow({ children: [left, right] }));
  }

  elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
  return elements;
}

function createProcessIdentification(process: ProcessData) {
  const identifications = process.identifications || {};
  const sanitizeLawyer = (name?: string) => {
    if (!name) return '';
    return String(name)
      .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };
  
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "1. IDENTIFICAÇÕES",
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Número do Processo: ${identifications.processNumber || process.process_number || 'N/A'}`,
          size: 24,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Reclamante: ${identifications.claimantName || process.claimant_name || 'N/A'}`,
          size: 24,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Reclamada: ${sanitizeLawyer(identifications.defendantName || process.defendant_name) || 'N/A'}`,
          size: 24,
        }),
      ],
      spacing: { after: 100 },
    }),
    // Sem campo de Vara do Trabalho conforme solicitação
    new Paragraph({ spacing: { after: 300 } }),
  ];
}

function createClaimantDataSection(process: ProcessData) {
  const claimantData = (typeof process.claimant_data === 'object' && process.claimant_data) ? process.claimant_data as any : {};
  const name = claimantData.name || process.claimant_name || 'Não informado';
  const positions = Array.isArray(claimantData.positions) ? claimantData.positions : [];

  const elements: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: "2. DADOS DA(O) RECLAMANTE",
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Nome Completo: ${name}`, size: 24 }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Funções e Períodos Laborais", bold: true, size: 24 }),
      ],
      spacing: { after: 100 },
    }),
  ];

  if (!positions.length) {
    elements.push(
      new Paragraph({
        children: [new TextRun({ text: "Nenhuma função adicionada.", size: 24 })],
        spacing: { after: 200 },
      })
    );
  } else {
    positions.forEach((p: any) => {
      const title = (p?.title || '').trim() || 'Não informado';
      const period = (p?.period || '').trim() || 'Não informado';
      const obs = (p?.obs || '').trim();
      const obsText = obs ? ` | Observações: ${obs}` : '';
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: `• Função: ${title} | Período: ${period}${obsText}`, size: 24 })],
          spacing: { after: 50 },
        })
      );
    });
    elements.push(new Paragraph({ spacing: { after: 200 } }));
  }

  return elements;
}

function createCoverDocxSection(process: ProcessData) {
  const headerCfg = process.report_config?.header || {};
  const coverData = process.cover_data || {};
  const peritoName = headerCfg.peritoName || coverData.peritoName || "PERITO JUDICIAL";
  const professionalTitle = headerCfg.professionalTitle || coverData.professionalTitle || "ENGENHEIRO CIVIL";
  const registrationNumber = headerCfg.registrationNumber || coverData.registrationNumber || "CREA";

  const id = (process.identifications || {}) as any;
  const processNumber = String(id.processNumber || (process as any).process_number || '').trim();
  const claimantName = String(id.claimantName || (process as any).claimant_name || '').trim();
  const defendantNameRaw = String(id.defendantName || (process as any).defendant_name || '').trim();
  const defendantName = defendantNameRaw.replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, '').replace(/\s{2,}/g, ' ').trim();

  const judgeCourtLine = (coverData.judgeCourtLine || '').trim();
  const courtText = String((process as any).court || '').trim();
  const courtLine = judgeCourtLine || (courtText ? `Excelentíssimo Senhor Doutor Juiz da ${courtText}.` : `Excelentíssimo Senhor Doutor Juiz da 1ª VARA DO TRABALHO DE ${(String((process as any).inspection_city || 'Diadema')).toUpperCase()} – SP.`);

  const honorarios = (coverData.honorarios || '03 (três) salários mínimos');
  const city = String(coverData.city || (process as any).inspection_city || '').trim() || 'Cidade';
  const dateIso = String(coverData.coverDate || '').trim();
  let datePt = '';
  try { if (dateIso) datePt = new Date(dateIso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch {}
  if (!datePt) { try { datePt = new Date().toLocaleDateString('pt-BR'); } catch {} }

  const bodyText = `${peritoName}, ${professionalTitle}${registrationNumber ? ", " + registrationNumber : ""}, legalmente habilitado pelo CREA - CONSELHO REGIONAL DE ENGENHARIA, nomeado como PERITO JUDICIAL, vem à presença de V. Exa. apresentar o resultado do seu trabalho consistente do incluso LAUDO PERICIAL e solicitar o arbitramento de seus honorários profissionais em ${honorarios}, corrigidos monetariamente na data de seu efetivo pagamento.`;

  const blocks: Paragraph[] = [];
  blocks.push(new Paragraph({ children: [ new TextRun({ text: courtLine, bold: true, size: 24 }) ], alignment: AlignmentType.CENTER, spacing: { before: cmToTwip(1), after: 80 } }));
  if (processNumber) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Proc...: ${processNumber}`, size: 24 }) ], alignment: AlignmentType.LEFT, spacing: { line: 360, after: 25 } }));
  if (claimantName) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Reclamante: ${claimantName}`, size: 24 }) ], alignment: AlignmentType.LEFT, spacing: { line: 360, after: 25 } }));
  if (defendantName) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Reclamada: ${defendantName}`, size: 24 }) ], alignment: AlignmentType.LEFT, spacing: { line: 360, after: cmToTwip(3) } }));

  blocks.push(new Paragraph({ children: [ new TextRun({ text: bodyText, size: 24 }) ], alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 20 } }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: `${city}, ${datePt}`, size: 24 }) ], alignment: AlignmentType.LEFT, spacing: { line: 360, after: 300 } }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: "Termos em que, para os devidos fins. Pede e espera deferimento.", size: 24 }) ], alignment: AlignmentType.LEFT, spacing: { line: 360, after: 500 } }));

  blocks.push(new Paragraph({ children: [ new TextRun({ text: "_________________________________", size: 24 }) ], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 30 } }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: peritoName, bold: true, size: 24 }) ], alignment: AlignmentType.CENTER }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: professionalTitle, size: 24 }) ], alignment: AlignmentType.CENTER }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: registrationNumber, size: 24 }) ], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));

  return blocks;
}

function createDefendantDataSection(process: ProcessData) {
  const defendantNameRaw = String(process.defendant_name || '').trim();
  const defendantName = defendantNameRaw
    .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'Não informado';
  const defendantData = typeof process.defendant_data === 'object' && process.defendant_data ? (process.defendant_data as any) : {};
  const defendantText = typeof (process as any).defendant_data === 'string' ? String((process as any).defendant_data).trim() : '';

  return [
    new Paragraph({
      children: [
        new TextRun({ text: "3. DADOS DA RECLAMADA", bold: true, size: 28 }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    ...(defendantText
      ? [
          new Paragraph({
            children: [ new TextRun({ text: defendantText, size: 24 }) ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, after: 200 },
          })
        ]
      : []),
    new Paragraph({
      children: [new TextRun({ text: `Razão Social: ${defendantName}`, size: 24 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `CNPJ: ${defendantData.cnpj || 'Não informado'}`, size: 24 })],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Endereço: ${defendantData.address || 'Não informado'}`, size: 24 })],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Atividade Principal: ${defendantData.mainActivity || 'Não informado'}`, size: 24 })],
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Representante Legal: ${defendantData.legalRepresentative || 'Não informado'}`, size: 24 })],
      spacing: { after: 200 },
    }),
  ];
}

async function createInsalubrityResultsSection(process: ProcessData, sectionNumber: number) {
  const results = process.insalubrity_results || "Não foram identificados agentes de risco que caracterizem insalubridade.";
  const flags = getDocxFlags(process);
  const rcAny: any = (() => {
    try {
      return typeof (process as any).report_config === 'string' ? JSON.parse((process as any).report_config || '{}') : ((process as any).report_config || {});
    } catch {
      return (process as any).report_config || {};
    }
  })();
  const item16Images = !flags.safeMode
    ? (Array.isArray(rcAny?.item16_images) ? rcAny.item16_images : [])
    : [];
  const legacy16Url = !flags.safeMode ? String(rcAny?.item16_imageDataUrl || "").trim() : "";
  const legacy16Caption = String(rcAny?.item16_imageCaption || "").trim();
  const normalized16Images: Array<{ dataUrl: string; caption?: string }> = (item16Images.length
    ? item16Images
    : (legacy16Url ? [{ dataUrl: legacy16Url, caption: legacy16Caption }] : []))
    .map((x: any) => ({ dataUrl: String(x?.dataUrl || '').trim(), caption: String(x?.caption || '').trim() }))
    .filter((x) => x.dataUrl);

  const resultParagraphs = textToDocxParagraphs(fixGrammar(results), { fontSize: 24, after: 120 });

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `${sectionNumber}. RESULTADOS DAS AVALIAÇÕES REFERENTES À INSALUBRIDADE`,
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),

    ...resultParagraphs,

    ...(normalized16Images.length
      ? (await (async () => {
          try {
            const makeCellForImage = async (img?: { dataUrl: string; caption?: string }): Promise<TableCell> => {
              const children: Paragraph[] = [];
              if (img?.dataUrl) {
                const mediaType = getSupportedImageType(img.dataUrl);
                if (mediaType) {
                  const dims = await getDataUrlDims(img.dataUrl);
                  const targetPxW = 280;
                  const targetPxH = dims?.naturalWidth && dims?.naturalHeight
                    ? Math.round(targetPxW * (dims.naturalHeight / dims.naturalWidth))
                    : 160;
                  const bytes = dataUrlToUint8Array(img.dataUrl);
                  const imgRun = new ImageRun({ data: bytes, transformation: { width: targetPxW, height: targetPxH }, type: mediaType });
                  children.push(new Paragraph({ children: [imgRun], alignment: AlignmentType.CENTER }));
                }
                const cap = String(img.caption || '').trim();
                if (cap) {
                  children.push(new Paragraph({ children: [new TextRun({ text: cap, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 120, line: 360 } }));
                }
              }
              return docxCell(children);
            };

            const rows: TableRow[] = [];
            for (let i = 0; i < normalized16Images.length; i += 2) {
              const left = await makeCellForImage(normalized16Images[i]);
              const right = await makeCellForImage(normalized16Images[i + 1]);
              rows.push(new TableRow({ children: [left, right] }));
            }

            return [
              new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }),
              new Paragraph({ spacing: { after: 200 } }),
            ];
          } catch {
            return [] as any[];
          }
        })())
      : []),
  ];

  return blocks;
}

function createAnnexTable() {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: DOCX_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          docxCell([docxCellText("Anexo", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
          docxCell([docxCellText("Agente de Risco", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
          docxCell([docxCellText("Situação", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
          docxCell([docxCellText("Observações", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
        ],
      }),
      new TableRow({
        children: [
          docxCell([docxCellText("Anexo 1", { alignment: AlignmentType.CENTER })]),
          docxCell([docxCellText("Ruído contínuo ou intermitente")]),
          docxCell([docxCellText("Não ocorre exposição", { alignment: AlignmentType.CENTER })]),
          docxCell([docxCellText("----------", { alignment: AlignmentType.CENTER })]),
        ],
      }),
      new TableRow({
        children: [
          docxCell([docxCellText("Anexo 7", { alignment: AlignmentType.CENTER })]),
          docxCell([docxCellText("Radiação não ionizante")]),
          docxCell([docxCellText("Não ocorre exposição", { alignment: AlignmentType.CENTER })]),
          docxCell([docxCellText("----------", { alignment: AlignmentType.CENTER })]),
        ],
      }),
      new TableRow({
        children: [
          docxCell([docxCellText("Anexo 8", { alignment: AlignmentType.CENTER })]),
          docxCell([docxCellText("Vibrações")]),
          docxCell([docxCellText("Não ocorre exposição", { alignment: AlignmentType.CENTER })]),
          docxCell([docxCellText("----------", { alignment: AlignmentType.CENTER })]),
        ],
      }),
    ],
  });
}

async function createFooterContact(process: ProcessData, options?: { showPageNumbers?: boolean }) {
  const reportConfig = process.report_config?.footer;
  const flags = getDocxFlags(process);

  const contactEmail = String(reportConfig?.contactEmail || "").trim();
  const customText = String(reportConfig?.customText || "").trim();
  const showPageNumbers = options?.showPageNumbers ?? (reportConfig?.showPageNumbers !== false);
  const footerAlign: 'left' | 'center' | 'right' = (reportConfig?.fillPage ? 'left' : (reportConfig?.imageAlign || 'left'));
  const fillPage = reportConfig?.fillPage !== false; // padrão preencher

  const footerElements: Paragraph[] = [];

  // Imagem de rodapé, se configurada
  try {
    let dataUrl: string | undefined = flags.safeMode ? undefined : reportConfig?.imageDataUrl;
    let naturalWidth = 0;
    let naturalHeight = 0;
    if (!dataUrl && reportConfig?.imageUrl && !flags.safeMode) {
      const loaded = await loadUrlToDataUrl(reportConfig.imageUrl);
      dataUrl = loaded.dataUrl;
      naturalWidth = loaded.naturalWidth;
      naturalHeight = loaded.naturalHeight;
    }
    if (dataUrl) {
      if (!naturalWidth || !naturalHeight) {
        const dims = await getDataUrlDims(dataUrl);
        naturalWidth = dims.naturalWidth;
        naturalHeight = dims.naturalHeight;
      }
      const desiredWpt = (reportConfig?.imageWidth as any) != null ? Number(reportConfig?.imageWidth as any) : 500;
      let desiredHpt = (reportConfig?.imageHeight as any) != null ? Number(reportConfig?.imageHeight as any) : undefined;
      if (!desiredHpt) desiredHpt = naturalWidth && naturalHeight ? Math.round(desiredWpt * (naturalHeight / naturalWidth)) : 40;
      let widthPx = Math.max(1, Math.round(desiredWpt * (96 / 72)));
      let heightPx = Math.max(1, Math.round((desiredHpt || 40) * (96 / 72)));
      if (fillPage) {
        widthPx = cmToPx(20.98);
        heightPx = cmToPx(3.04);
      }
      const bytes = dataUrlToUint8Array(dataUrl);
      const mediaType = getSupportedImageType(dataUrl);
      if (mediaType) {
        const imageRun = new ImageRun({
          data: bytes,
          transformation: { width: widthPx, height: heightPx },
          type: mediaType,
          floating: fillPage ? {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.LEFT },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.BOTTOM },
            wrap: { type: TextWrappingType.NONE },
            margins: { left: 0, right: 0, top: 0, bottom: 0 },
            allowOverlap: true,
          } : undefined,
        });
        footerElements.push(
          new Paragraph({
            children: [imageRun],
            alignment: footerAlign === 'center' ? AlignmentType.CENTER : footerAlign === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { before: 0, after: 0 },
            indent: { left: 0, right: 0 },
          })
        );
      }
    }
  } catch {
    // ignore
  }

  if (customText) {
    footerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: customText,
            size: 16,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
      })
    );
  }

  if (contactEmail) {
    footerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactEmail,
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: customText ? 100 : 300 },
      })
    );
  }

  // Adicionar numeração de páginas se habilitada
  if (showPageNumbers) {
    footerElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Página ",
            size: 24,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 24,
          }),
          new TextRun({
            text: " de ",
            size: 24,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
      })
    );
  }

  return footerElements;
}

// Adicionar novas funções para seções específicas do laudo
function createObjectiveSection(process: ProcessData) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "4. OBJETIVO",
          bold: true,
          size: 24,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: process.objective || "Avaliar as condições de trabalho e identificar a presença de agentes de risco que possam caracterizar insalubridade e/ou periculosidade.",
          size: 24,
        }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

function createMethodologySection(process: ProcessData) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "9. METODOLOGIA DE AVALIAÇÃO",
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: process.methodology || "Inspeção técnica no local de trabalho, análise documental, medições quantitativas quando aplicável, e avaliação conforme normas regulamentadoras vigentes.",
          size: 24,
        }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

function createWorkplaceCharacteristicsSection(process: ProcessData) {
  const blocks: (Paragraph | Table)[] = [];
  blocks.push(
    new Paragraph({
      children: [ new TextRun({ text: "11. CARACTERÍSTICAS DO LOCAL DE TRABALHO", bold: true, size: 28 }) ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  const wkcRaw = (process as any).workplace_characteristics
    || (process as any).caracteristicas_local
    || (process as any).workplace
    || (process as any).local_characteristics;

  if (wkcRaw && typeof wkcRaw === 'object' && !Array.isArray(wkcRaw)) {
    const specialType = String((wkcRaw as any).special_condition_type || 'none');
    const specialDesc = String((wkcRaw as any).special_condition_description || '').trim();
    const typeLabel = specialType === 'ceu_aberto' ? 'Céu aberto'
      : specialType === 'veiculo' ? 'Veículo'
      : specialType === 'outra' ? 'Outra condição'
      : 'Usar tabela padrão';
    if (specialType !== 'none') {
      blocks.push(new Paragraph({ children: [ new TextRun({ text: `Condição especial: ${typeLabel}.`, size: 24 }) ] }));
      blocks.push(new Paragraph({ children: [ new TextRun({ text: specialDesc || 'Não informado', size: 24 }) ], spacing: { after: 300, line: 360 }, alignment: AlignmentType.JUSTIFIED }));
    } else {
      const headers = ["Característica", "Detalhe"];
      const headerRow = new TableRow({
        children: [
          docxCell([docxCellText(headers[0], { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
          docxCell([docxCellText(headers[1], { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
        ],
      });

      const rows: TableRow[] = [headerRow];
      const joinArr = (arr?: any[]) => Array.isArray(arr) && arr.length ? arr.map((v) => String(v)).join(', ') : '';
      const pushRow = (label: string, value: any) => {
        const valStr = Array.isArray(value) ? joinArr(value) : String(value ?? '').trim();
        if (valStr) {
          rows.push(new TableRow({ children: [
            docxCell([docxCellText(label)]),
            docxCell([docxCellText(valStr)]),
          ] }));
        }
      };

      pushRow('Área superior (m²)', (wkcRaw as any).area);
      pushRow('Pé-direito (m)', (wkcRaw as any).ceiling_height);
      pushRow('Construção', joinArr((wkcRaw as any).construction));
      pushRow('Cobertura', joinArr((wkcRaw as any).roofing));
      pushRow('Iluminação', joinArr((wkcRaw as any).lighting));
      pushRow('Ventilação', joinArr((wkcRaw as any).ventilation));
      pushRow('Piso', (wkcRaw as any).floor);
      pushRow('Revestimento do piso', joinArr((wkcRaw as any).flooring));
      pushRow('Paredes', joinArr((wkcRaw as any).walls));

      if (rows.length === 1) {
        rows.push(new TableRow({ children: [
          docxCell([docxCellText('Não informado')]),
          docxCell([docxCellText('')]),
        ] }));
      }
      blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
    }
  } else if (typeof wkcRaw === 'string' && String(wkcRaw).trim()) {
    blocks.push(new Paragraph({ children: [ new TextRun({ text: String(wkcRaw).trim(), size: 24 }) ], spacing: { after: 300, line: 360 }, alignment: AlignmentType.JUSTIFIED }));
  } else if (Array.isArray(wkcRaw) && wkcRaw.length) {
    const headers = ["Característica", "Detalhe"];
    const headerRow = new TableRow({
      children: [
        docxCell([docxCellText(headers[0], { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
        docxCell([docxCellText(headers[1], { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
      ],
    });
    const rows: TableRow[] = [headerRow];
    (wkcRaw as any[]).forEach((item: any, idx: number) => {
      if (item && typeof item === 'object') {
        const name = item.name || item.nome || item.attribute || item.atributo || `Item ${idx + 1}`;
        const details = Object.entries(item)
          .filter(([k]) => !['name','nome','attribute','atributo'].includes(k))
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as any[]).join(', ') : String(v)}`)
          .join(' | ');
        rows.push(new TableRow({ children: [
          docxCell([docxCellText(String(name))]),
          docxCell([docxCellText(details || '')]),
        ] }));
      } else {
        rows.push(new TableRow({ children: [
          docxCell([docxCellText(`Item ${idx + 1}`)]),
          docxCell([docxCellText(String(item ?? ''))]),
        ] }));
      }
    });
    blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
  } else {
    blocks.push(new Paragraph({ children: [ new TextRun({ text: 'Não informado', size: 24 }) ] }));
  }

  return blocks;
}

function createActivitiesSection(process: ProcessData) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "12. ATIVIDADES DA(O) RECLAMANTE",
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: process.activities_description || "Atividades desenvolvidas pelo trabalhador não informadas.",
          size: 24,
        }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

// 5. Dados da Inicial (DOCX)
function createInitialDataSection(process: ProcessData) {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: "5. DADOS DA INICIAL", bold: true, size: 28 }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: process.initial_data || "Não informado", size: 24 }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

// 6. Dados da Contestação da Reclamada (DOCX)
function createDefenseDataSection(process: ProcessData) {
  const defenseText = (process.defense_data || "Não informado").trim();
  return [
    new Paragraph({
      children: [
        new TextRun({ text: "6. DADOS DA CONTESTAÇÃO DA RECLAMADA", bold: true, size: 28 }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: defenseText || "Não informado", size: 24 }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

function createDiligencesSection(process: ProcessData) {
  const blocks: Paragraph[] = [];
  blocks.push(
    new Paragraph({
      children: [ new TextRun({ text: "7. DILIGÊNCIAS / VISTORIAS", bold: true, size: 28 }) ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );
  blocks.push(
    new Paragraph({
      children: [ new TextRun({ text: "Para avaliação das condições em que trabalhava a Reclamante, foi realizada vistoria em seu local de trabalho, nas dependências da Reclamada, para atingirmos o adequado encaminhamento e correta interpretação final deste Laudo Pericial, sem subjetivismo e com embasamento técnico legal.", size: 24 }) ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    })
  );
  blocks.push(
    new Paragraph({
      children: [ new TextRun({ text: "Realizou-se primeiramente o inquérito preliminar, item administrativo obrigatório em qualquer perícia trabalhista, prestando todas as informações necessárias e esclarecimentos de ordem prática, os profissionais abaixo relacionados, além da ouvida de outros trabalhadores presentes nas áreas ou postos de trabalho, visando com isto caracterizar itens básicos relativos ao objetivo desta avaliação.", size: 24 }) ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    })
  );

  const dils = Array.isArray((process as any).diligence_data) ? ((process as any).diligence_data as any[]) : [];
  const fmtDate = (s?: string) => {
    if (!s) return "";
    try {
      const [y, m, d] = String(s).split("-");
      return `${d?.padStart(2,"0")}/${m?.padStart(2,"0")}/${y}`;
    } catch { return String(s); }
  };
  const fmtTime = (s?: string) => (s ? String(s) : "");

  if (dils.length > 0) {
    dils.forEach((d: any, idx: number) => {
      blocks.push(new Paragraph({ children: [ new TextRun({ text: `Vistoria ${idx + 1}:`, bold: true, size: 24 }) ] }));
      if (d?.location) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Local: ${String(d.location)}`, size: 24 }) ] }));
      if (d?.date) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Data: ${fmtDate(String(d.date))}`, size: 24 }) ] }));
      if (d?.time) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Horário: ${fmtTime(String(d.time))}`, size: 24 }) ] }));
      if (d?.description) blocks.push(new Paragraph({ children: [ new TextRun({ text: String(d.description), size: 24 }) ] , alignment: AlignmentType.JUSTIFIED }));
      blocks.push(new Paragraph({ spacing: { after: 100 } }));
    });
  } else {
    const iDate = (process as any).inspection_date;
    const iAddr = (process as any).inspection_address;
    const iCity = (process as any).inspection_city;
    const iTime = (process as any).inspection_time;
    if (iAddr) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Local: ${String(iAddr)}${iCity ? `, ${String(iCity)}` : ''}`, size: 24 }) ] }));
    if (iDate) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Data: ${fmtDate(String(iDate))}`, size: 24 }) ] }));
    if (iTime) blocks.push(new Paragraph({ children: [ new TextRun({ text: `Horário: ${fmtTime(String(iTime))}`, size: 24 }) ] }));
    if (!iAddr && !iDate && !iTime) blocks.push(new Paragraph({ children: [ new TextRun({ text: "Não informado", size: 24 }) ] }));
  }

  return blocks;
}

// 8. Acompanhantes / Entrevistados (DOCX) — tabela centralizada
function createAttendeesSection(process: ProcessData) {
  const attendees = (process as any).attendees || (process as any).acompanhamento;

  const headerRow = new TableRow({
    children: [
      docxCell(
        [docxCellText("Nome", { bold: true, alignment: AlignmentType.CENTER })],
        { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }
      ),
      docxCell(
        [docxCellText("Função", { bold: true, alignment: AlignmentType.CENTER })],
        { header: true, width: { size: 25, type: WidthType.PERCENTAGE } }
      ),
      docxCell(
        [docxCellText("Empresa", { bold: true, alignment: AlignmentType.CENTER })],
        { header: true, width: { size: 20, type: WidthType.PERCENTAGE } }
      ),
      docxCell(
        [docxCellText("Observações", { bold: true, alignment: AlignmentType.CENTER })],
        { header: true, width: { size: 20, type: WidthType.PERCENTAGE } }
      ),
    ],
  });

  const rows: TableRow[] = [headerRow];

  if (Array.isArray(attendees) && attendees.length) {
    attendees.forEach((p: any) => {
      rows.push(
        new TableRow({
          children: [
            docxCell([docxCellText(String(p?.name || p || ''))]),
            docxCell([docxCellText(String(p?.function || ''))]),
            docxCell([docxCellText(String(p?.company || ''))]),
            docxCell([docxCellText(String(p?.obs || ''))]),
          ],
        })
      );
    });
  } else if (typeof attendees === 'string' && attendees.trim()) {
      rows.push(
        new TableRow({
          children: [
            docxCell([docxCellText(String(attendees))]),
            docxCell([docxCellText("")]),
            docxCell([docxCellText("")]),
            docxCell([docxCellText("")]),
          ],
        })
      );
  } else {
      rows.push(
        new TableRow({
          children: [
            docxCell([docxCellText("Não informado")]),
            docxCell([docxCellText("")]),
            docxCell([docxCellText("")]),
            docxCell([docxCellText("")]),
          ],
        })
      );
  }

  return [
    new Paragraph({
      children: [new TextRun({ text: "8. ACOMPANHANTES / ENTREVISTADOS", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      alignment: AlignmentType.CENTER,
      borders: DOCX_TABLE_BORDERS,
    }),
  ];
}

// 7. Análise das condições de trabalho (DOCX)
function createWorkConditionsSection(process: ProcessData) {
  const workConditions = (process as any).work_conditions || (process as any).analise_condicoes || "Não informado";
  return [
    new Paragraph({
      children: [new TextRun({ text: "7. ANÁLISE DAS CONDIÇÕES DE TRABALHO", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: String(workConditions), size: 24 })],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

// 10. Documentações Apresentadas (DOCX)
function createClaimantActivitiesSection(process: ProcessData) {
  const docs = (process as any).documents_presented;
  const hasDocs = Array.isArray(docs) && docs.length > 0;
  const lines: string[] = [];

  if (hasDocs) {
    docs.forEach((d: any, idx: number) => {
      const titulo = d?.title || d?.titulo || d?.name || `Documento ${idx + 1}`;
      const tipo = d?.type || d?.tipo || undefined;
      const emissor = d?.issuer || d?.emissor || undefined;
      const data = d?.date || d?.data || undefined;
      const obs = d?.notes || d?.observacoes || undefined;

      let linha = `• ${String(titulo)}`;
      const detalhes: string[] = [];
      if (tipo) detalhes.push(`Tipo: ${String(tipo)}`);
      if (emissor) detalhes.push(`Emissor: ${String(emissor)}`);
      if (data) detalhes.push(`Data: ${String(data)}`);
      if (detalhes.length) linha += ` (${detalhes.join('; ')})`;
      lines.push(linha);
      if (obs) {
        lines.push(`  Observações: ${String(obs)}`);
      }
    });
  } else {
    lines.push("Não informado");
  }

  return [
    new Paragraph({
      children: [new TextRun({ text: "10. DOCUMENTAÇÕES APRESENTADAS", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    ...lines.map((l) => new Paragraph({ children: [new TextRun({ text: l, size: 24 })], spacing: { after: 120, line: 360 }, alignment: AlignmentType.JUSTIFIED })),
  ];
}

// 12.1. Discordâncias apresentadas (DOCX)
function createDiscordancesPresentedSection(process: ProcessData) {
  const discordances = (process as any).discordances_presented || (process as any).discordancias_apresentadas;
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: "12.2 DISCORDÂNCIAS APRESENTADAS PELA RECLAMADA", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 200 },
    })
  );

  if (Array.isArray(discordances) && discordances.length) {
    discordances.forEach((d: any) => {
      const txt = String(d?.text || d).trim();
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${txt || 'Não informado'}`, size: 24 })], spacing: { after: 120, line: 360 }, alignment: AlignmentType.JUSTIFIED }));
    });
  } else if (typeof discordances === 'string' && discordances.trim()) {
    paragraphs.push(
      new Paragraph({ children: [new TextRun({ text: String(discordances).trim(), size: 24 })], spacing: { after: 300, line: 360 }, alignment: AlignmentType.JUSTIFIED })
    );
  } else {
    paragraphs.push(
      new Paragraph({ children: [new TextRun({ text: 'Não informado', size: 24 })], spacing: { after: 120, line: 360 }, alignment: AlignmentType.JUSTIFIED })
    );
  }

  return paragraphs;
}

// 13. Equipamentos de proteção individual (DOCX)
function createEPISection(process: ProcessData) {
  const epis = (process as any).epis;
  const introDefault = "Para função exercida pela Reclamante a empresa realizava a entrega dos seguintes equipamentos de proteção individual - E.P.I. (Art. 166 da CLT e NR-6, item 6.2 da Portaria nº 3214/78 do MTE):";
const introText = String((process as any).epi_intro || (process as any).epi_introduction || introDefault);

  const parseRc = (rc: any) => {
    try {
      return typeof rc === "string" ? JSON.parse(rc || "{}") : (rc || {});
    } catch {
      return {};
    }
  };

  const formatDateBR = (raw: string) => {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };

  const formatDateBRFromDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const rc = parseRc((process as any).report_config);
  const replCfg = rc?.epi_replacement_periodicity || {};
  const replEnabled = !!replCfg?.enabled;
  const replText = String(replCfg?.text || "").trim();
  const replRows = Array.isArray(replCfg?.rows) ? replCfg.rows : [];
  const usefulLifeItems = Array.isArray(replCfg?.useful_life_items) ? replCfg.useful_life_items : [];
  const trainingAudit = (() => {
    const raw = (replCfg as any)?.training_audit;
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw || "{}") || {};
      } catch {
        return {};
      }
    }
    if (typeof raw === "object") return raw;
    return {};
  })();

  const parseBRDate = (s: string) => {
    const m = String(s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const extractPeriodRange = (raw: any) => {
    const matches = String(raw || "").match(/\b\d{2}\/\d{2}\/\d{4}\b/g);
    if (!matches || matches.length < 2) return null;
    const startStr = matches[0];
    const endStr = matches[1];
    const start = parseBRDate(startStr);
    const end = parseBRDate(endStr);
    if (!start || !end) return null;
    return { startStr, endStr, start, end };
  };

  const daysInMonth = (year: number, monthIndex0: number) => {
    return new Date(year, monthIndex0 + 1, 0).getDate();
  };

  const diffCalendarParts = (start: Date, end: Date) => {
    const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (b.getTime() < a.getTime()) return { years: 0, months: 0, days: 0 };

    let years = b.getFullYear() - a.getFullYear();
    let months = b.getMonth() - a.getMonth();
    let days = b.getDate() - a.getDate();

    if (days < 0) {
      months -= 1;
      let borrowYear = b.getFullYear();
      let borrowMonth = b.getMonth() - 1;
      if (borrowMonth < 0) {
        borrowMonth = 11;
        borrowYear -= 1;
      }
      days += daysInMonth(borrowYear, borrowMonth);
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
  };

  const diffCalendarLabel = (start: Date, end: Date) => {
    const { years, months, days } = diffCalendarParts(start, end);
    const parts: string[] = [];
    if (years) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
    if (months) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
    if (days || parts.length === 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
    return `${parts[0]}, ${parts[1]} e ${parts[2]}`;
  };

  const buildEmploymentPeriodInfo = () => {
    const claimant = (process as any).claimant_data;
    const parsed = (() => {
      try {
        return typeof claimant === "string" ? JSON.parse(claimant || "{}") : (claimant || {});
      } catch {
        return {};
      }
    })();
    const positions = Array.isArray((parsed as any)?.positions) ? (parsed as any).positions : [];
    let minStart: Date | null = null;
    let minStartStr = "";
    let maxEnd: Date | null = null;
    let maxEndStr = "";
    positions.forEach((p: any) => {
      const range = extractPeriodRange(p?.period);
      if (!range) return;
      if (!minStart || range.start.getTime() < minStart.getTime()) {
        minStart = range.start;
        minStartStr = range.startStr;
      }
      if (!maxEnd || range.end.getTime() > maxEnd.getTime()) {
        maxEnd = range.end;
        maxEndStr = range.endStr;
      }
    });
    if (!minStart || !maxEnd) return { label: "", days: null as number | null, start: null as Date | null, end: null as Date | null };
    const ms = maxEnd.getTime() - minStart.getTime();
    const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    const diffLabel = diffCalendarLabel(minStart, maxEnd);
    return { label: `${minStartStr} a ${maxEndStr}${diffLabel ? ` (${diffLabel})` : ""}`, days, start: minStart, end: maxEnd };
  };

  const employmentPeriodInfo = buildEmploymentPeriodInfo();
  const employmentPeriodLabel = employmentPeriodInfo.label;
  const employmentPeriodDays = employmentPeriodInfo.days;
  const employmentStart = employmentPeriodInfo.start;
  const employmentEnd = employmentPeriodInfo.end;

  const addDays = (base: Date, days: number) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + Math.trunc(days));
    return d;
  };

  const diffDaysCeil = (start: Date, end: Date) => {
    const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  const parseUsefulLifeDays = (raw: string) => {
    const text = String(raw || "").toLowerCase();
    if (!text.trim()) return null;
    const pick = (re: RegExp) => {
      const m = text.match(re);
      if (!m) return 0;
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) ? n : 0;
    };
    const years = pick(/(\d+)\s*(ano|anos)\b/);
    const months = pick(/(\d+)\s*(m[eê]s|meses)\b/);
    const weeks = pick(/(\d+)\s*(semana|semanas)\b/);
    const days = pick(/(\d+)\s*(dia|dias)\b/);
    const total = years * 365 + months * 30 + weeks * 7 + days;
    return total > 0 ? total : null;
  };

  const daysToMonthsDaysLabel = (d: number) => {
    const days = Math.max(0, Math.round(d));
    const months = Math.floor(days / 30);
    const rem = days % 30;
    if (months > 0 && rem > 0) return `${months} mês(es) e ${rem} dia(s)`;
    if (months > 0) return `${months} mês(es)`;
    return `${rem} dia(s)`;
  };

  const parseISODate = (s: string) => {
    const m = String(s || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const imprescritoOnly = !!replCfg?.imprescrito_only;
  const distributionDate = parseISODate(String((process as any).distribution_date || '').trim());

  const effectivePeriod = (() => {
    if (!employmentStart || !employmentEnd) return { start: employmentStart, end: employmentEnd, label: employmentPeriodLabel || '' };
    if (!imprescritoOnly) return { start: employmentStart, end: employmentEnd, label: employmentPeriodLabel || '' };
    if (!distributionDate) return { start: employmentStart, end: employmentEnd, label: 'Período imprescrito selecionado, mas sem data de distribuição' };
    const start5y = new Date(distributionDate.getFullYear() - 5, distributionDate.getMonth(), distributionDate.getDate());
    const start = start5y.getTime() > employmentStart.getTime() ? start5y : employmentStart;
    const end = employmentEnd;
    if (end.getTime() <= start.getTime()) return { start, end, label: 'Período imprescrito selecionado, mas sem período válido' };
    const diffLabel = diffCalendarLabel(start, end);
    const range = `${formatDateBRFromDate(start)} a ${formatDateBRFromDate(end)}${diffLabel ? ` (${diffLabel})` : ''}`;
    return { start, end, label: `Imprescrito (últimos 5 anos): ${range}` };
  })();

  const headerRow = new TableRow({
    children: [
      docxCell([docxCellText("Equipamento", { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
      docxCell([docxCellText("Proteção", { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
      docxCell([docxCellText("CA", { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
    ],
  });

  const rows: TableRow[] = [];
  rows.push(headerRow);
  if (Array.isArray(epis) && epis.length) {
    epis.forEach((e: any) => {
      const equipment = String(e?.equipment ?? e?.name ?? e ?? '').trim();
      const protection = String(e?.protection ?? e?.desc ?? e?.observation ?? '').trim();
      const ca = String(e?.ca ?? '').trim();
      rows.push(new TableRow({
        children: [
          docxCell([docxCellText(equipment)]),
          docxCell([docxCellText(protection)]),
          docxCell([docxCellText(ca)]),
        ],
      }));
    });
  } else if (typeof epis === 'string' && epis.trim()) {
    rows.push(new TableRow({
      children: [
        docxCell([docxCellText(String(epis).trim())]),
        docxCell([docxCellText('')]),
        docxCell([docxCellText('')]),
      ],
    }));
  } else {
    rows.push(new TableRow({
      children: [
        docxCell([docxCellText('Não informado')]),
        docxCell([docxCellText('')]),
        docxCell([docxCellText('')]),
      ],
    }));
  }

  const blocks = [
    new Paragraph({
      children: [new TextRun({ text: "13. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({ children: [new TextRun({ text: introText, size: 24 })], spacing: { after: 200, line: 360 }, alignment: AlignmentType.JUSTIFIED }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }),
  ];

  if (replEnabled) {
    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: "Avaliação da periodicidade de trocas de EPIs", bold: true, size: 24 })],
        spacing: { before: 240, after: 120 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );

    if (replText) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: replText, size: 24 })],
          spacing: { after: 200, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }

    const replHeaderRow = new TableRow({
      children: [
        docxCell([docxCellText("Equipamento fornecido", { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
        docxCell([docxCellText("CA", { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
        docxCell([docxCellText("Data de entrega", { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
      ],
    });

    const replTableRows: TableRow[] = [replHeaderRow];
    if (Array.isArray(replRows) && replRows.length) {
      replRows.forEach((r: any) => {
        const equipment = String(r?.equipment || "").trim();
        const ca = String(r?.ca || "").trim();
        const delivery = formatDateBR(String(r?.delivery_date || "").trim());
        replTableRows.push(
          new TableRow({
            children: [
              docxCell([docxCellText(equipment)]),
              docxCell([docxCellText(ca)]),
              docxCell([docxCellText(delivery)]),
            ],
          })
        );
      });
    } else {
      replTableRows.push(
        new TableRow({
          children: [
            docxCell([docxCellText("Não informado")]),
            docxCell([docxCellText("")]),
            docxCell([docxCellText("")]),
          ],
        })
      );
    }

    blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: replTableRows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));

    if (Array.isArray(usefulLifeItems) && usefulLifeItems.length) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: "Vida útil estimada (por EPI)", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );

      if (effectivePeriod.label) {
        blocks.push(
          new Paragraph({
            children: [new TextRun({ text: `Período considerado: ${effectivePeriod.label}`, size: 22 })],
            spacing: { after: 160, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
          })
        );
      }

      const ulHeaderRow = new TableRow({
        children: [
          docxCell([docxCellText("EPI", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
          docxCell([docxCellText("CA", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
          docxCell([docxCellText("Vida útil estimada", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 50, type: WidthType.PERCENTAGE } }),
        ],
      });

      const ulRows: TableRow[] = [ulHeaderRow];
      usefulLifeItems.forEach((it: any) => {
        const equipment = String(it?.equipment || "").trim();
        const ca = String(it?.ca || "").trim();
        const life = String(it?.estimated_life || "").trim();
        ulRows.push(
          new TableRow({
            children: [
              docxCell([docxCellText(equipment || "Não informado")], { width: { size: 35, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(ca || "")], { width: { size: 15, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(life || "")], { width: { size: 50, type: WidthType.PERCENTAGE } }),
            ],
          })
        );
      });

      blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: ulRows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
    }

    const deliveryByEquipment = new Map<string, Array<{ ca: string; date: Date }>>();
    if (Array.isArray(replRows) && replRows.length) {
      replRows.forEach((r: any) => {
        const equipment = String(r?.equipment || "").trim();
        const ca = String(r?.ca || "").trim();
        const dt = parseISODate(String(r?.delivery_date || "").trim());
        if (!equipment || !dt) return;
        const list = deliveryByEquipment.get(equipment) || [];
        list.push({ ca, date: dt });
        deliveryByEquipment.set(equipment, list);
      });
    }

    const getLifeDaysFor = (equipment: string, ca: string) => {
      const life = Array.isArray(usefulLifeItems)
        ? usefulLifeItems.find((i: any) => String(i?.equipment || "").trim() === equipment && String(i?.ca || "").trim() === ca)
        : null;
      return parseUsefulLifeDays(String((life as any)?.estimated_life || ""));
    };

    const buildBasisLabel = (equipment: string, usedDefault: boolean) => {
      const map = new Map<string, number>();
      (Array.isArray(usefulLifeItems) ? usefulLifeItems : [])
        .filter((i: any) => String(i?.equipment || "").trim() === equipment)
        .forEach((i: any) => {
          const ca = String(i?.ca || "").trim();
          const days = parseUsefulLifeDays(String(i?.estimated_life || ""));
          if (!ca || !days) return;
          map.set(ca, days);
        });
      if (!map.size) return "Base padrão: 6 meses";
      const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const shown = entries.slice(0, 3).map(([ca, days]) => `CA ${ca}: ${daysToMonthsDaysLabel(days)}`);
      const suffix = entries.length > shown.length ? ` | +${entries.length - shown.length}` : "";
      return `Vida útil por CA: ${shown.join(" | ")}${suffix}${usedDefault ? " | padrão: 6 meses" : ""}`;
    };

    const buildEquipmentLabel = (equipment: string, deliveries: Array<{ ca: string; date: Date }>) => {
      const cas = Array.from(new Set(deliveries.map((d) => String(d.ca || "").trim()).filter(Boolean)));
      if (!cas.length) return equipment;
      if (cas.length === 1) return `${equipment} (CA ${cas[0]})`;
      const shown = cas.slice(0, 3);
      const suffix = cas.length > shown.length ? `, +${cas.length - shown.length}` : "";
      return `${equipment} (CAs: ${shown.join(", ")}${suffix})`;
    };

    const deliveryEvaluation = Array.from(deliveryByEquipment.entries())
      .map(([equipment, deliveries]) => {
        const sortedDeliveries = [...deliveries].sort((a, b) => a.date.getTime() - b.date.getTime());
        const periodStartMs = effectivePeriod.start ? effectivePeriod.start.getTime() : null;
        const periodEndMs = effectivePeriod.end ? effectivePeriod.end.getTime() : null;
        const deliveriesInPeriod = (() => {
          if (periodStartMs == null || periodEndMs == null) return sortedDeliveries;
          return sortedDeliveries.filter((d) => d.date.getTime() >= periodStartMs && d.date.getTime() <= periodEndMs);
        })();

        const datesForIntervals = (() => {
          const dates = deliveriesInPeriod.map((d) => d.date);
          if (periodStartMs == null || periodEndMs == null) return dates;
          const prev = sortedDeliveries.filter((d) => d.date.getTime() < periodStartMs).slice(-1)[0]?.date;
          if (prev) dates.unshift(prev);
          return dates;
        })()
          .sort((a, b) => a.getTime() - b.getTime())
          .filter((d, idx, arr) => idx === 0 || d.getTime() !== arr[idx - 1].getTime());

        const intervals = Array.from({ length: Math.max(0, datesForIntervals.length - 1) })
          .map((_, i) => {
            const from = datesForIntervals[i];
            const to = datesForIntervals[i + 1];
            const deltaDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
            if (!Number.isFinite(deltaDays) || deltaDays < 0) return null;
            return { from, to, days: deltaDays, label: diffCalendarLabel(from, to) };
          })
          .filter(Boolean) as Array<{ from: Date; to: Date; days: number; label: string }>;

        const avgIntervalDays = intervals.length ? intervals.reduce((a, b) => a + b.days, 0) / intervals.length : null;
        const representativeInterval = (() => {
          if (!intervals.length) return null;
          if (intervals.length === 1) return intervals[0];
          const avg = avgIntervalDays ?? intervals[0].days;
          return intervals.reduce((best, curr) => (Math.abs(curr.days - avg) < Math.abs(best.days - avg) ? curr : best), intervals[0]);
        })();

        const intervalLabel = (() => {
          if (representativeInterval) {
            if (intervals.length === 1) return representativeInterval.label;
            const avgLabel = avgIntervalDays == null ? "" : daysToMonthsDaysLabel(avgIntervalDays);
            return avgLabel ? `${representativeInterval.label} (média aprox.: ${avgLabel})` : representativeInterval.label;
          }
          if (periodStartMs != null && periodEndMs != null) {
            if (!deliveriesInPeriod.length) return "Sem entregas no período";
            if (deliveriesInPeriod.length === 1) return "Apenas 1 entrega";
          }
          return sortedDeliveries.length ? "Apenas 1 entrega" : "Não informado";
        })();

        const insufficientRanges = (() => {
          if (!effectivePeriod.start || !effectivePeriod.end) return [] as Array<{ start: Date; end: Date }>;
          const start = effectivePeriod.start;
          const end = effectivePeriod.end;
          if (end.getTime() <= start.getTime()) return [] as Array<{ start: Date; end: Date }>;
          if (!sortedDeliveries.length) return [{ start, end }];

          const coverageIntervals: Array<{ start: Date; end: Date }> = [];
          sortedDeliveries.forEach((d) => {
            const lifeDays = getLifeDaysFor(equipment, String(d.ca || "").trim()) ?? 180;
            const covStart = d.date.getTime() > start.getTime() ? d.date : start;
            const covEndRaw = addDays(d.date, lifeDays);
            const covEnd = covEndRaw.getTime() < end.getTime() ? covEndRaw : end;
            if (covEnd.getTime() > covStart.getTime()) coverageIntervals.push({ start: covStart, end: covEnd });
          });
          if (!coverageIntervals.length) return [{ start, end }];
          coverageIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

          const merged: Array<{ start: Date; end: Date }> = [];
          coverageIntervals.forEach((it) => {
            const last = merged[merged.length - 1];
            if (!last) {
              merged.push({ start: it.start, end: it.end });
              return;
            }
            if (it.start.getTime() <= last.end.getTime()) {
              if (it.end.getTime() > last.end.getTime()) last.end = it.end;
              return;
            }
            merged.push({ start: it.start, end: it.end });
          });

          const gaps: Array<{ start: Date; end: Date }> = [];
          let cursor = start;
          merged.forEach((it) => {
            if (it.start.getTime() > cursor.getTime()) gaps.push({ start: cursor, end: it.start });
            if (it.end.getTime() > cursor.getTime()) cursor = it.end;
          });
          if (end.getTime() > cursor.getTime()) gaps.push({ start: cursor, end });
          return gaps;
        })();

        const insufficientDays = insufficientRanges.reduce((acc, r) => acc + diffDaysCeil(r.start, r.end), 0);
        const insufficientLabel = (() => {
          if (!effectivePeriod.start || !effectivePeriod.end) return "Não informado";
          if (insufficientDays <= 0) return "—";
          const totalLabel = daysToMonthsDaysLabel(insufficientDays);
          const shown = insufficientRanges.slice(0, 3);
          const rangesLabel = shown.map((r) => `${formatDateBRFromDate(r.start)} a ${formatDateBRFromDate(r.end)}`).join(" | ");
          const suffix = insufficientRanges.length > shown.length ? ` | +${insufficientRanges.length - shown.length}` : "";
          return `${totalLabel}: ${rangesLabel}${suffix}`;
        })();

        const usedDefault = sortedDeliveries.some((d) => getLifeDaysFor(equipment, String(d.ca || "").trim()) == null);
        const basis = buildBasisLabel(equipment, usedDefault);
        const status = insufficientDays > 0 ? "Insuficiente" : "Suficiente";

        return {
          equipment: buildEquipmentLabel(equipment, sortedDeliveries),
          deliveries: deliveriesInPeriod.length,
          intervalLabel,
          insufficientLabel,
          status,
          basis,
        };
      })
      .sort((a, b) => a.equipment.localeCompare(b.equipment));

    if (deliveryEvaluation.length) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: "Avaliação automática da periodicidade de entrega", bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
      if (effectivePeriod.label) {
        blocks.push(
          new Paragraph({
            children: [new TextRun({ text: `Período considerado: ${effectivePeriod.label}`, size: 22 })],
            spacing: { after: 160, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
          })
        );
      }

      const evHeaderRow = new TableRow({
        children: [
          docxCell(
            [docxCellText("EPI", { bold: true, alignment: AlignmentType.CENTER })],
            { header: true, width: { size: 20, type: WidthType.PERCENTAGE } }
          ),
          docxCell(
            [docxCellText("Entregas", { bold: true, alignment: AlignmentType.CENTER })],
            { header: true, width: { size: 10, type: WidthType.PERCENTAGE } }
          ),
          docxCell(
            [docxCellText("Intervalo entre entregas", { bold: true, alignment: AlignmentType.CENTER })],
            { header: true, width: { size: 18, type: WidthType.PERCENTAGE } }
          ),
          docxCell(
            [docxCellText("Período insuficiente (insalubre)", { bold: true, alignment: AlignmentType.CENTER })],
            { header: true, width: { size: 30, type: WidthType.PERCENTAGE } }
          ),
          docxCell(
            [docxCellText("Avaliação", { bold: true, alignment: AlignmentType.CENTER })],
            { header: true, width: { size: 12, type: WidthType.PERCENTAGE } }
          ),
          docxCell(
            [docxCellText("Base", { bold: true, alignment: AlignmentType.CENTER })],
            { header: true, width: { size: 10, type: WidthType.PERCENTAGE } }
          ),
        ],
      });

      const evRows: TableRow[] = [evHeaderRow];
      deliveryEvaluation.forEach((it) => {
        evRows.push(
          new TableRow({
            children: [
              docxCell([docxCellText(it.equipment)], { width: { size: 20, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(String(it.deliveries))], { width: { size: 10, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(it.intervalLabel)], { width: { size: 18, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(it.insufficientLabel, { size: 22 })], { width: { size: 30, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(it.status)], { width: { size: 12, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(it.basis, { size: 22 })], { width: { size: 10, type: WidthType.PERCENTAGE } }),
            ],
          })
        );
      });

      blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: evRows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
    }

    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: "Gestão de EPI", bold: true, size: 24 })],
        spacing: { before: 240, after: 120 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );

    const trainingEvidenceLabel = (trainingAudit as any)?.training_evidence === true ? "Sim" : (trainingAudit as any)?.training_evidence === false ? "Não" : "Não informado";
    const caCertificateLabel = (trainingAudit as any)?.ca_certificate === true ? "Sim" : (trainingAudit as any)?.ca_certificate === false ? "Não" : "Não informado";
    const inspectionLabel = (trainingAudit as any)?.inspection === true ? "Sim" : (trainingAudit as any)?.inspection === false ? "Não" : "Não informado";
    const trainingObs = String((trainingAudit as any)?.training_observation || "").trim();
    const inspectionObs = String((trainingAudit as any)?.inspection_observation || "").trim();

    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: `Apresentada evidências de treinamento: ${trainingEvidenceLabel}`, size: 24 })],
        spacing: { after: 120, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
    if (trainingObs) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: `Observação: ${trainingObs}`, size: 24 })],
          spacing: { after: 120, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }

    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: `Os equipamentos possuem certificado de aprovação: ${caCertificateLabel}`, size: 24 })],
        spacing: { after: 120, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );

    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: `Fiscalização: ${inspectionLabel}`, size: 24 })],
        spacing: { after: 120, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
    if (inspectionObs) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: `Observação: ${inspectionObs}`, size: 24 })],
          spacing: { after: 120, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }
  }

  return blocks;
}

// 14. Equipamentos de proteção coletiva (DOCX)
function createEPCSection(process: ProcessData) {
  const description = String((process as any).collective_protection || '').trim();
  const epcsRaw = String((process as any).epcs || (process as any).epc || '').trim();

  const items: string[] = [];
  const gatherFrom = [epcsRaw, description];
  gatherFrom.forEach((txt) => {
    if (!txt) return;
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let inSelectedBlock = false;
    lines.forEach((l) => {
      if (/EPCs selecionados:/i.test(l)) { inSelectedBlock = true; return; }
      const m = l.match(/^[-•]\s*(.+)$/);
      // Aceita bullets dentro do bloco "EPCs selecionados:" e também bullets isolados
      if ((inSelectedBlock && m) || m) items.push(m[1].trim());
    });
  });

  if (!items.length) {
    if (epcsRaw) items.push(epcsRaw);
    else if (description) items.push(description);
  }

  const headerRow = new TableRow({
    children: [
      docxCell([docxCellText('EPC', { bold: true, alignment: AlignmentType.CENTER })], { header: true }),
    ],
  });

  const rows: TableRow[] = items.length
    ? items.map((item) => new TableRow({
        children: [
          docxCell([docxCellText(String(item))]),
        ],
      }))
    : [
        new TableRow({
          children: [
            docxCell([docxCellText('Não informado')]),
          ],
        }),
      ];

  return [
    new Paragraph({
      children: [new TextRun({ text: "14. EQUIPAMENTOS DE PROTEÇÃO COLETIVA (EPCs)", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows], alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }),
  ];
}

// 15. Análise das exposições à insalubridade (DOCX)
function createInsalubrityExposuresSection(
  process: ProcessData,
  options?: { includeInsalubridade: boolean; includePericulosidade: boolean }
) {
  const exposuresText = String((process as any).insalubrity_analysis || (process as any).analise_exposicoes || "").trim();

  // Parser robusto das linhas inseridas via aba Laudo
  const parseRows = (text: string) => {
    const rows: { annex: string; agent: string; exposure: string; obs: string }[] = [];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      // Padrão 1: "- Anexo X — Agente | Exposição: Y | Obs: Z"
      let m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*?)\s*\|\s*Exposição:\s*(.*?)\s*\|\s*Obs:\s*(.*)$/);
      if (m) {
        const obs = (m[4] || "").trim();
        rows.push({ annex: m[1], agent: m[2].trim(), exposure: m[3].trim(), obs });
        continue;
      }

      // Padrão 2: "- Anexo X — Agente (Exposição) [Obs]"
      m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*?)\s*\((.*?)\)\s*(\[(.*)\])?$/);
      if (m) {
        let obs = (m[5] || "").trim();
        // Suprimir mensagem técnica da LLM no relatório
        if (/LLM\s+não\s+configurada|LLM\s+indisponível/i.test(obs)) {
          obs = "";
        }
        rows.push({ annex: m[1], agent: m[2].trim(), exposure: (m[3] || "").trim(), obs });
        continue;
      }

      // Padrão 3: "- Anexo X — Agente" (sem exposição/obs)
      m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*)$/);
      if (m) {
        rows.push({ annex: m[1], agent: m[2].trim(), exposure: "", obs: "" });
        continue;
      }
    }
    return rows;
  };

  // Se não houver linhas em insalubridade, tentar periculosidade para cobrir "conforme seleção"
  const parseRc = (rc: any) => {
    try {
      return typeof rc === "string" ? JSON.parse(rc || "{}") : (rc || {});
    } catch {
      return {};
    }
  };
  const rc = parseRc((process as any).report_config);
  const tables = rc?.analysis_tables || {};
  const flags = rc?.flags || {};
  const nr15Tables = Array.isArray(tables?.nr15) ? tables.nr15 : [];
  const nr16Tables = Array.isArray(tables?.nr16) ? tables.nr16 : [];
  const insaRows = nr15Tables.length ? nr15Tables.map((r: any) => ({ annex: String(r.annex), agent: String(r.agent), exposure: String(r.exposure || ""), obs: String(r.obs || "") })) : parseRows(exposuresText);
  const pericuText = String((process as any).periculosity_analysis || "").trim();
  const pericuRows = nr16Tables.length ? nr16Tables.map((r: any) => ({ annex: String(r.annex), agent: String(r.agent), exposure: String(r.exposure || ""), obs: String(r.obs || "") })) : parseRows(pericuText);

  const includeInsalubridade = options?.includeInsalubridade ?? true;
  const includePericulosidade = options?.includePericulosidade ?? true;

  const hasNR15 = includeInsalubridade && insaRows.length > 0;
  const hasNR16 = includePericulosidade && pericuRows.length > 0;
  const titleText = includeInsalubridade && includePericulosidade
    ? "15. ANÁLISES DAS EXPOSIÇÕES À INSALUBRIDADE E PERICULOSIDADE"
    : includePericulosidade && !includeInsalubridade
      ? "15. ANÁLISE DA EXPOSIÇÃO À PERICULOSIDADE"
      : "15. ANÁLISE DAS EXPOSIÇÕES À INSALUBRIDADE";

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: titleText, bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
  ];

  const addTable = (title: string, rows: { annex: string; agent: string; exposure: string; obs: string }[]) => {
    const header = new TableRow({
      children: [
        docxCell([docxCellText("Anexo", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText("Agente", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText("Exposição", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText("Obs", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
      ],
    });

    const dataRows = rows.length
      ? rows.map((r) =>
          new TableRow({
            children: [
              docxCell([docxCellText(`Anexo ${r.annex}`, { alignment: AlignmentType.CENTER })], { width: { size: 15, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(r.agent, { alignment: AlignmentType.CENTER })], { width: { size: 35, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(r.exposure, { alignment: AlignmentType.CENTER })], { width: { size: 35, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText(r.obs || "----------", { alignment: AlignmentType.CENTER })], { width: { size: 15, type: WidthType.PERCENTAGE } }),
            ],
          })
        )
      : [
          new TableRow({
            children: [
              docxCell([docxCellText("Não informado", { alignment: AlignmentType.CENTER })], { width: { size: 15, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText("", { alignment: AlignmentType.CENTER })], { width: { size: 35, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText("", { alignment: AlignmentType.CENTER })], { width: { size: 35, type: WidthType.PERCENTAGE } }),
              docxCell([docxCellText("", { alignment: AlignmentType.CENTER })], { width: { size: 15, type: WidthType.PERCENTAGE } }),
            ],
          }),
        ];

    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );
    blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...dataRows], alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
  };

  if (hasNR15) {
    addTable("Tabela NR-15 (Anexos e Exposição)", insaRows);
  }
  if (hasNR16) {
    addTable("Tabela NR-16 (Anexos e Exposição)", pericuRows);
  }
  if (!hasNR15 && !hasNR16) {
    const baseText = includePericulosidade && !includeInsalubridade
      ? pericuText
      : exposuresText;
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({ text: String(baseText || (includePericulosidade ? pericuText : "") || "Não informado"), size: 24 }),
        ],
        spacing: { after: 300, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
  }

  return blocks;
}

function createInsalubrityAnalysisSection(process: ProcessData) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "16. ANÁLISE DE INSALUBRIDADE",
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: process.insalubrity_analysis || "Análise dos agentes de risco presentes no ambiente de trabalho conforme NR-15.", size: 24, }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

function createPericulosityAnalysisSection(process: ProcessData) {
  const pericuText = String((process as any).periculosity_analysis || "").trim();

  // Reusar o parser do item 15 (formato com pipes, parênteses e colchetes)
  const parseRows = (text: string) => {
    const rows: { annex: string; agent: string; exposure: string; obs: string }[] = [];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*?)\s*\|\s*Exposição:\s*(.*?)\s*\|\s*Obs:\s*(.*)$/);
      if (m) {
        rows.push({ annex: m[1], agent: m[2].trim(), exposure: m[3].trim(), obs: (m[4] || "").trim() });
        continue;
      }
      m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*?)\s*\((.*?)\)\s*(\[(.*)\])?$/);
      if (m) {
        let obs = (m[5] || "").trim();
        if (/LLM\s+não\s+configurada|LLM\s+indisponível/i.test(obs)) obs = "";
        rows.push({ annex: m[1], agent: m[2].trim(), exposure: (m[3] || "").trim(), obs });
        continue;
      }
      m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*)$/);
      if (m) {
        rows.push({ annex: m[1], agent: m[2].trim(), exposure: "", obs: "" });
        continue;
      }
    }
    return rows;
  };

  const rows = parseRows(pericuText);

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: "19. ANÁLISE DA EXPOSIÇÃO À PERICULOSIDADE",
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: pericuText || "Análise dos agentes de risco que possam caracterizar periculosidade conforme NR-16.", size: 24, }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];

  if (rows.length) {
    const header = new TableRow({
      children: [
        docxCell([docxCellText("Anexo", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText("Agente", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText("Exposição", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 35, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText("Obs", { bold: true, alignment: AlignmentType.CENTER })], { header: true, width: { size: 15, type: WidthType.PERCENTAGE } }),
      ],
    });

    const dataRows = rows.map((r) => new TableRow({
      children: [
        docxCell([docxCellText(`Anexo ${r.annex}`, { alignment: AlignmentType.CENTER })], { width: { size: 15, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText(r.agent, { alignment: AlignmentType.CENTER })], { width: { size: 35, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText(r.exposure, { alignment: AlignmentType.CENTER })], { width: { size: 35, type: WidthType.PERCENTAGE } }),
        docxCell([docxCellText(r.obs || "----------", { alignment: AlignmentType.CENTER })], { width: { size: 15, type: WidthType.PERCENTAGE } }),
      ],
    }));

    blocks.push(new Paragraph({ children: [ new TextRun({ text: "Tabela NR-16 (Anexos e Exposição)", bold: true, size: 28 }) ], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...dataRows], alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }));
  }

  return blocks;
}

function createPericulosityConceptSection(process: ProcessData, sectionNumber: number) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `${sectionNumber}. CONCEITO DE PERICULOSIDADE`,
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: process.periculosity_concept || "Conforme NR-16, são consideradas atividades e operações perigosas aquelas relacionadas com explosivos, inflamáveis, energia elétrica e radiações ionizantes ou substâncias radioativas.",
          size: 24,
        }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

function createFlammableDefinitionSection(process: ProcessData, sectionNumber: number) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `${sectionNumber}. DEFINIÇÃO DE PRODUTOS INFLAMÁVEIS`,
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: process.flammable_definition || "De acordo com a NR 20, os líquidos inflamáveis possuem ponto de fulgor de < 60°C.",
          size: 24,
        }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

async function createPericulosityResultsSection(process: ProcessData, sectionNumber: number) {
  const results = process.periculosity_results || "Não foram identificados agentes de risco que caracterizem periculosidade.";
  const flags = getDocxFlags(process);
  const rcAny: any = (() => {
    try {
      return typeof (process as any).report_config === "string" ? JSON.parse((process as any).report_config || "{}") : ((process as any).report_config || {});
    } catch {
      return (process as any).report_config || {};
    }
  })();
  const item19Images = !flags.safeMode
    ? (Array.isArray(rcAny?.item19_images) ? rcAny.item19_images : [])
    : [];
  const legacy19Url = !flags.safeMode ? String(rcAny?.item19_imageDataUrl || "").trim() : "";
  const legacy19Caption = String(rcAny?.item19_imageCaption || "").trim();
  const normalized19Images: Array<{ dataUrl: string; caption?: string }> = (item19Images.length
    ? item19Images
    : (legacy19Url ? [{ dataUrl: legacy19Url, caption: legacy19Caption }] : []))
    .map((x: any) => ({ dataUrl: String(x?.dataUrl || '').trim(), caption: String(x?.caption || '').trim() }))
    .filter((x) => x.dataUrl);

  const resultParagraphs = textToDocxParagraphs(fixGrammar(results), { fontSize: 24, after: 120 });

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `${sectionNumber}. RESULTADOS DAS AVALIAÇÕES REFERENTES À PERICULOSIDADE`,
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),

    ...resultParagraphs,

    ...(normalized19Images.length
      ? (await (async () => {
          try {
            const makeCellForImage = async (img?: { dataUrl: string; caption?: string }): Promise<TableCell> => {
              const children: Paragraph[] = [];
              if (img?.dataUrl) {
                const mediaType = getSupportedImageType(img.dataUrl);
                if (mediaType) {
                  const dims = await getDataUrlDims(img.dataUrl);
                  const targetPxW = 280;
                  const targetPxH = dims?.naturalWidth && dims?.naturalHeight
                    ? Math.round(targetPxW * (dims.naturalHeight / dims.naturalWidth))
                    : 160;
                  const bytes = dataUrlToUint8Array(img.dataUrl);
                  const imgRun = new ImageRun({ data: bytes, transformation: { width: targetPxW, height: targetPxH }, type: mediaType });
                  children.push(new Paragraph({ children: [imgRun], alignment: AlignmentType.CENTER }));
                }
                const cap = String(img.caption || '').trim();
                if (cap) {
                  children.push(new Paragraph({ children: [new TextRun({ text: cap, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 120, line: 360 } }));
                }
              }
          return docxCell(children);
            };

            const rows: TableRow[] = [];
            for (let i = 0; i < normalized19Images.length; i += 2) {
              const left = await makeCellForImage(normalized19Images[i]);
              const right = await makeCellForImage(normalized19Images[i + 1]);
              rows.push(new TableRow({ children: [left, right] }));
            }

        return [
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, alignment: AlignmentType.CENTER, borders: DOCX_TABLE_BORDERS }),
          new Paragraph({ spacing: { after: 200 } }),
        ];
          } catch {
            return [] as any[];
          }
        })())
      : []),
  ];

  return blocks;
}

async function createConclusionSection(process: ProcessData, sectionNumber: number) {
  const headerCfg = process.report_config?.header || {};
  const signatureCfg = (process.report_config as any)?.signature || {};
  const peritoName = headerCfg.peritoName || "PERITO JUDICIAL";
  const professionalTitle = headerCfg.professionalTitle || "ENGENHEIRO CIVIL";
  const registrationNumber = headerCfg.registrationNumber || "CREA";
  const blocks: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `${sectionNumber}. CONCLUSÃO`,
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: (process.conclusion || "Considerando a visita pericial realizada, as informações obtidas, os fatos observados e as análises efetuadas, conclui-se, que as atividades desempenhadas pelo(a) reclamante, foram:"),
          size: 24,
        }),
      ],
      spacing: { after: 300, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];

  const dateText = new Date().toLocaleDateString('pt-BR');
  blocks.push(new Paragraph({ children: [ new TextRun({ text: `Diadema, ${dateText}`, size: 24 }) ], alignment: AlignmentType.CENTER, spacing: { before: 300, after: 300 } }));

  try {
    const flags = getDocxFlags(process);
    let dataUrl: string | undefined = flags.safeMode ? undefined : signatureCfg.imageDataUrl;
    let naturalWidth = 0;
    let naturalHeight = 0;
    if (!dataUrl && signatureCfg.imageUrl && !flags.safeMode) {
      const loaded = await loadUrlToDataUrl(signatureCfg.imageUrl);
      dataUrl = loaded.dataUrl;
      naturalWidth = loaded.naturalWidth;
      naturalHeight = loaded.naturalHeight;
    }
    if (dataUrl) {
      if (!naturalWidth || !naturalHeight) {
        const dims = await getDataUrlDims(dataUrl);
        naturalWidth = dims.naturalWidth;
        naturalHeight = dims.naturalHeight;
      }
      const desiredWpt = (signatureCfg.imageWidth as any) != null ? Number(signatureCfg.imageWidth as any) : 150;
      let desiredHpt = (signatureCfg.imageHeight as any) != null ? Number(signatureCfg.imageHeight as any) : undefined;
      if (!desiredHpt) desiredHpt = naturalWidth && naturalHeight ? Math.round(desiredWpt * (naturalHeight / naturalWidth)) : 40;
      const widthPx = Math.max(1, Math.round(desiredWpt * (96 / 72)));
      const heightPx = Math.max(1, Math.round((desiredHpt || 40) * (96 / 72)));
      const bytes = dataUrlToUint8Array(dataUrl);
      const mediaType = getSupportedImageType(dataUrl);
      if (mediaType) {
        const imageRun = new ImageRun({ data: bytes, transformation: { width: widthPx, height: heightPx }, type: mediaType });
        blocks.push(new Paragraph({ children: [ imageRun ], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 20 } }));
      }
    }
  } catch {}

  blocks.push(new Paragraph({ children: [ new TextRun({ text: "_________________________________", size: 24 }) ], alignment: AlignmentType.CENTER, spacing: { before: 20, after: 60 } }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: peritoName, bold: true, size: 24 }) ], alignment: AlignmentType.CENTER }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: professionalTitle, size: 24 }) ], alignment: AlignmentType.CENTER }));
  blocks.push(new Paragraph({ children: [ new TextRun({ text: registrationNumber, size: 24 }) ], alignment: AlignmentType.CENTER }));

  return blocks;
}

export async function exportReportAsDocx(
  content: string,
  process: ProcessData,
  options?: { reportType?: 'insalubridade' | 'periculosidade' | 'completo' }
): Promise<void> {
  try {
    const headerCfg = process.report_config?.header || {};
    const footerCfg = process.report_config?.footer || {};
    const zeroMargins = !!headerCfg.fillPage || !!footerCfg.fillPage;

    const parseRc = (rc: any) => { try { return typeof rc === 'string' ? JSON.parse(rc || '{}') : (rc || {}); } catch { return {}; } };
    const rc = parseRc((process as any).report_config);
    const flags = (rc?.flags || {}) as any;
    const reportTypeRaw = String(options?.reportType || flags?.reportType || '').trim();
    const reportTypeFromFlag: 'insalubridade' | 'periculosidade' | 'completo' | undefined =
      reportTypeRaw === 'insalubridade' || reportTypeRaw === 'periculosidade' || reportTypeRaw === 'completo'
        ? (reportTypeRaw as any)
        : undefined;
    const flagNr15 = typeof flags?.show_nr15_item15 === 'boolean' ? flags.show_nr15_item15 : undefined;
    const flagNr16 = typeof flags?.show_nr16_item15 === 'boolean' ? flags.show_nr16_item15 : undefined;
    const tables = (rc?.analysis_tables || {}) as any;
    const rows15 = Array.isArray(tables?.nr15) ? tables.nr15 : [];
    const rows16 = Array.isArray(tables?.nr16) ? tables.nr16 : [];
    const isMarkedExposure = (value: any) => {
      const s = String(value ?? '').trim().toLowerCase();
      return s === 'em análise' || s === 'em analise' || s === 'ocorre exposição' || s === 'ocorre exposicao';
    };
    const hasSelected = (rows: any[]) => rows.some((r) => isMarkedExposure(r?.exposure));
    const hasNr15Rows = hasSelected(rows15);
    const hasNr16Rows = hasSelected(rows16);
    const normText = (t: any) => {
      const s = String(t ?? '').trim();
      if (!s) return '';
      if (/^n[ãa]o\s+informado\.?$/i.test(s)) return '';
      return s;
    };
    const hasInsalubridadeText =
      !!normText((process as any).insalubrity_analysis || (process as any).analise_exposicoes) ||
      !!normText((process as any).insalubrity_results);
    const hasPericulosidadeText =
      !!normText((process as any).periculosity_analysis) ||
      !!normText((process as any).periculosity_concept) ||
      !!normText((process as any).periculosity_results) ||
      !!normText((process as any).flammable_definition);
    const reportType: 'insalubridade' | 'periculosidade' | 'completo' =
      reportTypeFromFlag
      ?? (flagNr15 === true && flagNr16 === false ? 'insalubridade' : undefined)
      ?? (flagNr16 === true && flagNr15 === false ? 'periculosidade' : undefined)
      ?? ((hasNr15Rows || hasInsalubridadeText) && !(hasNr16Rows || hasPericulosidadeText) ? 'insalubridade' : undefined)
      ?? ((hasNr16Rows || hasPericulosidadeText) && !(hasNr15Rows || hasInsalubridadeText) ? 'periculosidade' : undefined)
      ?? 'completo';
    let includeInsalubridade = reportType === 'insalubridade' || reportType === 'completo';
    const periculosidadeExplicitlySetNoExposure = rows16.length > 0 && !hasNr16Rows;
    const includePericulosidadeBase = reportType === 'periculosidade' || reportType === 'completo';
    const includePericulosidade = includePericulosidadeBase && !periculosidadeExplicitlySetNoExposure && (hasNr16Rows || hasPericulosidadeText);
    if (!includeInsalubridade && !includePericulosidade) {
      includeInsalubridade = hasNr15Rows || hasInsalubridadeText;
    }

    let nextNumber = 16;
    const insalubrityResultsNumber = includeInsalubridade ? nextNumber++ : undefined;
    const periculosityConceptNumber = includePericulosidade ? nextNumber++ : undefined;
    const flammableDefinitionNumber = includePericulosidade ? nextNumber++ : undefined;
    const periculosityResultsNumber = includePericulosidade ? nextNumber++ : undefined;
    const quesitosNumber = nextNumber++;
    const conclusaoNumber = nextNumber++;

    const page = {
      margin: {
        top: headerCfg?.fillPage ? cmToTwip(3.04) : 1440,
        bottom: footerCfg?.fillPage ? cmToTwip(3.04) : 1440,
        left: 1440,
        right: 1440,
        header: 0,
        footer: 0,
        gutter: 0,
      },
      size: {
        width: cmToTwip(21.0),
        height: cmToTwip(29.7),
      },
    };

    const header = new Header({
      children: await createProfessionalHeader(process),
    });
    const silentFooter = new Footer({
      children: await createFooterContact(process, { showPageNumbers: false }),
    });
    const numberedFooter = new Footer({
      children: await createFooterContact(process),
    });

    const includeToc = rc?.flags?.include_docx_toc !== false;

    const doc = new Document({
      features: { updateFields: true },
      styles: {
        default: {},
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 24 },
            paragraph: { spacing: { line: 360 }, alignment: AlignmentType.JUSTIFIED },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 28 },
            paragraph: { indent: { left: 0, right: 0 } },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 28 },
            paragraph: { indent: { left: 0, right: 0 } },
          },
          {
            id: "Heading3",
            name: "Heading 3",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 28 },
            paragraph: { indent: { left: 0, right: 0 } },
          },
        ],
      },
      sections: [
        {
          properties: {
            page,
            type: SectionType.NEXT_PAGE,
          },
          headers: { default: header },
          footers: { default: silentFooter },
          children: createCoverDocxSection(process),
        },
        ...(includeToc
          ? [
              {
                properties: {
                  page,
                  type: SectionType.NEXT_PAGE,
                },
                headers: { default: header },
                footers: { default: silentFooter },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "SUMÁRIO", bold: true, size: 28 })],
                    spacing: { before: 200, after: 100 },
                  }),
                  new TableOfContents("SUMÁRIO", { hyperlink: true, headingStyleRange: "1-7", useAppliedParagraphOutlineLevel: true }),
                  new Paragraph({ spacing: { after: 300 } }),
                ],
              },
            ]
          : []),
        {
          properties: {
            page: { ...page, pageNumbers: { start: 1 } },
            type: SectionType.NEXT_PAGE,
          },
          headers: { default: header },
          footers: { default: numberedFooter },
          children: [
            ...createProcessIdentification(process),
            ...createClaimantDataSection(process),
            ...createDefendantDataSection(process),
            ...createObjectiveSection(process),
            ...createInitialDataSection(process),
            ...createDefenseDataSection(process),
            ...createDiligencesSection(process),
            ...createAttendeesSection(process),
            ...createMethodologySection(process),
            ...createClaimantActivitiesSection(process),
            ...createWorkplaceCharacteristicsSection(process),
            ...createActivitiesSection(process),
            ...(await createPhotoRegisterDocxSection(process)),
            ...createDiscordancesPresentedSection(process),
            ...createEPISection(process),
            ...createEPCSection(process),
            ...createInsalubrityExposuresSection(process, { includeInsalubridade, includePericulosidade }),
            ...(includeInsalubridade && insalubrityResultsNumber != null ? await createInsalubrityResultsSection(process, insalubrityResultsNumber) : []),
            ...(includePericulosidade && periculosityConceptNumber != null ? createPericulosityConceptSection(process, periculosityConceptNumber) : []),
            ...(includePericulosidade && flammableDefinitionNumber != null ? createFlammableDefinitionSection(process, flammableDefinitionNumber) : []),
            ...(includePericulosidade && periculosityResultsNumber != null ? await createPericulosityResultsSection(process, periculosityResultsNumber) : []),
            ...createQuestionnairesSection(process, quesitosNumber),
            ...(await createConclusionSection(process, conclusaoNumber)),
          ],
        },
      ],
    });

    // No navegador, usar toBlob (evita 'nodebuffer is not supported')
    const blob = await Packer.toBlob(doc);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildReportFilename(process, 'docx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao exportar DOCX:", error);
    throw new Error("Falha na exportação do documento DOCX");
  }
}

// Quebra texto em linhas para PDF (largura aproximada)
function wrapText(text: string, maxCharsPerLine = 100): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function fixGrammar(text: string): string {
  let s = String(text || "");
  s = s.replace(/(atividade[^\.\n]{0,80}?)n[ãa]o\s+enquadrado/gi, (m) => m.replace(/enquadrado/gi, 'enquadrada'));
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim();
}

export async function exportReportAsPdf(
  content: string,
  process: ProcessData,
  options?: { returnUrl?: boolean; reportType?: 'insalubridade' | 'periculosidade' | 'completo' }
): Promise<string | void> {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 50;
    const marginRight = 50;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    // Dados do processo
    const headerCfg = process.report_config?.header || {};
    const footerCfg = process.report_config?.footer || {};
    const signatureCfg = (process.report_config as any)?.signature || {};

    const peritoName = String(headerCfg.peritoName || '').trim() || "PERITO JUDICIAL";
    const professionalTitle = String(headerCfg.professionalTitle || '').trim() || "ENGENHEIRO CIVIL";
    const registrationNumber = String(headerCfg.registrationNumber || '').trim() || "CREA";
    
    let currentPage = 0;
    let cursorY = 0;

    const parseRcType = (rcAny: any) => {
      try {
        return typeof rcAny === 'string' ? JSON.parse(rcAny || '{}') : (rcAny || {});
      } catch {
        return {};
      }
    };
    const rcType = parseRcType((process as any).report_config);
    const flagsType = (rcType?.flags || {}) as any;
    const reportTypeRaw = String(options?.reportType || flagsType?.reportType || '').trim();
    const reportTypeFromFlag: 'insalubridade' | 'periculosidade' | 'completo' | undefined =
      reportTypeRaw === 'insalubridade' || reportTypeRaw === 'periculosidade' || reportTypeRaw === 'completo'
        ? (reportTypeRaw as any)
        : undefined;
    const flagNr15 = typeof flagsType?.show_nr15_item15 === 'boolean' ? flagsType.show_nr15_item15 : undefined;
    const flagNr16 = typeof flagsType?.show_nr16_item15 === 'boolean' ? flagsType.show_nr16_item15 : undefined;
    const tablesType = (rcType?.analysis_tables || {}) as any;
    const rows15 = Array.isArray(tablesType?.nr15) ? tablesType.nr15 : [];
    const rows16 = Array.isArray(tablesType?.nr16) ? tablesType.nr16 : [];
    const isMarkedExposure = (value: any) => {
      const s = String(value ?? '').trim().toLowerCase();
      return s === 'em análise' || s === 'em analise' || s === 'ocorre exposição' || s === 'ocorre exposicao';
    };
    const hasSelected = (rows: any[]) => rows.some((r) => isMarkedExposure(r?.exposure));
    const hasNr15Rows = hasSelected(rows15);
    const hasNr16Rows = hasSelected(rows16);
    const normText = (t: any) => {
      const s = String(t ?? '').trim();
      if (!s) return '';
      if (/^n[ãa]o\s+informado\.?$/i.test(s)) return '';
      return s;
    };
    const hasInsalubridadeText =
      !!normText((process as any).insalubrity_analysis || (process as any).analise_exposicoes) ||
      !!normText((process as any).insalubrity_results);
    const hasPericulosidadeText =
      !!normText((process as any).periculosity_analysis) ||
      !!normText((process as any).periculosity_concept) ||
      !!normText((process as any).periculosity_results) ||
      !!normText((process as any).flammable_definition);
    const reportType: 'insalubridade' | 'periculosidade' | 'completo' =
      reportTypeFromFlag
      ?? (flagNr15 === true && flagNr16 === false ? 'insalubridade' : undefined)
      ?? (flagNr16 === true && flagNr15 === false ? 'periculosidade' : undefined)
      ?? ((hasNr15Rows || hasInsalubridadeText) && !(hasNr16Rows || hasPericulosidadeText) ? 'insalubridade' : undefined)
      ?? ((hasNr16Rows || hasPericulosidadeText) && !(hasNr15Rows || hasInsalubridadeText) ? 'periculosidade' : undefined)
      ?? 'completo';

    let includeInsalubridade = reportType === 'insalubridade' || reportType === 'completo';
    const periculosidadeExplicitlySetNoExposure = rows16.length > 0 && !hasNr16Rows;
    const includePericulosidadeBase = reportType === 'periculosidade' || reportType === 'completo';
    const includePericulosidade = includePericulosidadeBase && !periculosidadeExplicitlySetNoExposure && (hasNr16Rows || hasPericulosidadeText);
    if (!includeInsalubridade && !includePericulosidade) {
      includeInsalubridade = hasNr15Rows || hasInsalubridadeText;
    }

    let nextNumber = 16;
    const insalubrityResultsNumber = includeInsalubridade ? nextNumber++ : undefined;
    const periculosityConceptNumber = includePericulosidade ? nextNumber++ : undefined;
    const flammableDefinitionNumber = includePericulosidade ? nextNumber++ : undefined;
    const periculosityResultsNumber = includePericulosidade ? nextNumber++ : undefined;
    const quesitosNumber = nextNumber++;
    const conclusaoNumber = nextNumber++;

    const parseRcQ = (rc: any) => {
      try {
        return typeof rc === 'string' ? JSON.parse(rc || '{}') : (rc || {});
      } catch {
        return {};
      }
    };
    const rcQ = parseRcQ((process as any).report_config);
    const qc = rcQ?.questionnaires || {};
    const claimantText = String(qc?.claimantText || "").trim();
    const defendantQuesitosText = String(qc?.defendantText || "").trim();
    const judgeText = String(qc?.judgeText || "").trim();
    const claimantQuesitos = (process as any).claimant_questions || (process as any).quesitos_reclamante;
    const respondentQuesitos = (process as any).respondent_questions || (process as any).quesitos_reclamada;
    const judgeQuesitos = (process as any).judge_questions || (process as any).quesitos_juiz;
    const hasClaimant = !!claimantText || (Array.isArray(claimantQuesitos) && claimantQuesitos.length > 0);
    const hasDefendant = !!defendantQuesitosText || (Array.isArray(respondentQuesitos) && respondentQuesitos.length > 0);
    const hasJudge = !!judgeText || (Array.isArray(judgeQuesitos) && judgeQuesitos.length > 0);

    const tocPages = new Map<string, number>();
    const tocNumberSlots: Array<{ title: string; pageIndex: number; y: number; fontSize: number }> = [];
    const tocTitleBySectionKey: Record<string, string> = {
      "1": "1 - Identificações",
      "2": "2 - Dados da Reclamante",
      "3": "3 - Dados da Reclamada",
      "4": "4 - Objetivo",
      "5": "5 - Dados da Inicial",
      "6": "6 - Dados da Contestação da Reclamada",
      "7": "7 - Diligências / Vistorias",
      "8": "8 - Acompanhantes / Entrevistados",
      "9": "9 - Metodologia de Avaliação",
      "10": "10 - Documentações Apresentadas",
      "11": "11 - Características do Local de Trabalho",
      "12": "12 - Atividades da(o) Reclamante",
      "12.1": "12.1 - Registro fotográfico",
      "12.2": "12.2 - Discordâncias apresentadas pela reclamada",
      "13": "13 - Equipamentos de Proteção Individual (EPIs)",
      "14": "14 - Equipamentos de Proteção Coletiva",
      "15": "15 - Análise das exposições",
    };
    if (includeInsalubridade && insalubrityResultsNumber != null) {
      tocTitleBySectionKey[String(insalubrityResultsNumber)] = `${insalubrityResultsNumber} - Resultados das avaliações referentes à insalubridade`;
    }
    if (includePericulosidade) {
      if (periculosityConceptNumber != null) {
        tocTitleBySectionKey[String(periculosityConceptNumber)] = `${periculosityConceptNumber} - Conceito de Periculosidade`;
      }
      if (flammableDefinitionNumber != null) {
        tocTitleBySectionKey[String(flammableDefinitionNumber)] = `${flammableDefinitionNumber} - Definição de produtos inflamáveis`;
      }
      if (periculosityResultsNumber != null) {
        tocTitleBySectionKey[String(periculosityResultsNumber)] = `${periculosityResultsNumber} - Resultados das avaliações referentes à Periculosidade`;
      }
    }
    if (hasClaimant || hasDefendant || hasJudge) {
      tocTitleBySectionKey[String(quesitosNumber)] = `${quesitosNumber} - Quesitos da Perícia`;
      if (hasClaimant) tocTitleBySectionKey[`${quesitosNumber}.1`] = `${quesitosNumber}.1 - Quesitos da Reclamante`;
      if (hasDefendant) tocTitleBySectionKey[`${quesitosNumber}.2`] = `${quesitosNumber}.2 - Quesitos da Reclamada`;
      if (hasJudge) tocTitleBySectionKey[`${quesitosNumber}.3`] = `${quesitosNumber}.3 - Quesitos do Juíz(a)`;
    }
    tocTitleBySectionKey[String(conclusaoNumber)] = `${conclusaoNumber} - Conclusão`;

    // Utilitário para carregar imagem como DataURL e detectar formato
    const loadImageAsDataUrl = async (url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; naturalWidth: number; naturalHeight: number }> => {
      const res = await fetch(url);
      const blob = await res.blob();
      const format: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { naturalWidth, naturalHeight } = await new Promise<{ naturalWidth: number; naturalHeight: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ naturalWidth: img.naturalWidth || 0, naturalHeight: img.naturalHeight || 0 });
        img.src = dataUrl;
      });
      return { dataUrl, format, naturalWidth, naturalHeight };
    };

    // Normaliza qualquer DataURL para PNG usando canvas, e mede dimensões naturais
    const normalizeDataUrlToPng = async (dataUrl: string): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
          const pngDataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl: pngDataUrl, naturalWidth: w, naturalHeight: h });
        };
        img.src = dataUrl;
      });
    };

    const headerFill = headerCfg.fillPage !== false;

    let headerImageData: string | undefined;
    let headerImageFormat: 'PNG' | 'JPEG' = 'PNG';
    let headerW: number | undefined = (headerCfg.imageWidth as any) != null ? Number(headerCfg.imageWidth as any) : undefined;
    let headerH: number | undefined = (headerCfg.imageHeight as any) != null ? Number(headerCfg.imageHeight as any) : undefined;
    const headerAlign: 'left' | 'center' | 'right' = headerCfg.imageAlign || 'left';
    if (headerCfg.imageDataUrl && String(headerCfg.imageDataUrl).trim().length > 10) {
      try {
        const normalized = await normalizeDataUrlToPng(headerCfg.imageDataUrl);
        headerImageData = normalized.dataUrl;
        headerImageFormat = 'PNG';
        if (!headerW) {
          headerW = headerFill ? pageWidth : contentWidth;
        }
        if (!headerH && headerW) {
          if (normalized.naturalWidth && normalized.naturalHeight) {
            headerH = Math.round(headerW * (normalized.naturalHeight / normalized.naturalWidth));
          } else {
            headerH = 40;
          }
        }
      } catch {
        // fallback mínimo caso normalização falhe
        headerImageData = headerCfg.imageDataUrl;
        headerImageFormat = headerCfg.imageDataUrl.includes('image/jpeg') || headerCfg.imageDataUrl.includes('jpg') ? 'JPEG' : 'PNG';
        if (!headerW) headerW = headerFill ? pageWidth : contentWidth;
        if (!headerH && headerW) headerH = 40;
      }
    } else if (headerCfg.imageUrl && String(headerCfg.imageUrl).trim().length > 0) {
      try {
        const loaded = await loadUrlToDataUrl(headerCfg.imageUrl);
        headerImageData = loaded.dataUrl;
        headerImageFormat = loaded.format;
        if (!headerW) {
          headerW = headerFill ? pageWidth : contentWidth;
        }
        if (!headerH && headerW) {
          if (loaded.naturalWidth && loaded.naturalHeight) {
            headerH = Math.round(headerW * (loaded.naturalHeight / loaded.naturalWidth));
          } else {
            headerH = 40;
          }
        }
      } catch {}
    }

    if (headerImageData) {
      if (headerFill) {
        headerW = pageWidth;
        headerH = cmToPt(3.04);
      } else if (headerW) {
        const maxW = contentWidth;
        const maxH = 90;
        let w = headerW;
        let h = headerH || 40;
        if (w > maxW) {
          const scale = maxW / w;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        if (h > maxH) {
          const scale = maxH / h;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        headerW = Math.max(1, w);
        headerH = Math.max(1, h);
      }
    }

    // Declarar variáveis da assinatura (independente de rodapé)
    let signatureImageData: string | undefined;
    let signatureImageFormat: 'PNG' | 'JPEG' = 'PNG';
    let signatureW: number | undefined = (signatureCfg.imageWidth as any) != null ? Number(signatureCfg.imageWidth as any) : undefined;
    let signatureH: number | undefined = (signatureCfg.imageHeight as any) != null ? Number(signatureCfg.imageHeight as any) : undefined;
    const signatureAlign: 'left' | 'center' | 'right' = signatureCfg.imageAlign || 'center';

    if (signatureCfg.imageDataUrl && String(signatureCfg.imageDataUrl).trim().length > 10) {
      try {
        const normalized = await normalizeDataUrlToPng(signatureCfg.imageDataUrl);
        signatureImageData = normalized.dataUrl;
        signatureImageFormat = 'PNG';
        if (!signatureW) signatureW = Math.min(300, contentWidth);
        if (!signatureH && signatureW) {
          if (normalized.naturalWidth && normalized.naturalHeight) {
            signatureH = Math.round(signatureW * (normalized.naturalHeight / normalized.naturalWidth));
          } else {
            signatureH = 60;
          }
        }
      } catch (error) {
        signatureImageData = signatureCfg.imageDataUrl;
        signatureImageFormat = signatureCfg.imageDataUrl.includes('image/jpeg') || signatureCfg.imageDataUrl.includes('jpg') ? 'JPEG' : 'PNG';
        if (!signatureW) signatureW = Math.min(300, contentWidth);
        if (!signatureH && signatureW) signatureH = 60;
      }
    } else if (signatureCfg.imageUrl && String(signatureCfg.imageUrl).trim().length > 0) {
      try {
        const loaded = await loadUrlToDataUrl(signatureCfg.imageUrl);
        signatureImageData = loaded.dataUrl;
        signatureImageFormat = loaded.format;
        if (!signatureW) signatureW = Math.min(300, contentWidth);
        if (!signatureH && signatureW) {
          if (loaded.naturalWidth && loaded.naturalHeight) {
            signatureH = Math.round(signatureW * (loaded.naturalHeight / loaded.naturalWidth));
          } else {
            signatureH = 60;
          }
        }
      } catch {}
    }

    // Rodapé com imagem (configuração semelhante ao cabeçalho)
    let footerImageData: string | undefined;
    let footerImageFormat: 'PNG' | 'JPEG' = 'PNG';
    let footerW: number | undefined = (footerCfg.imageWidth as any) != null ? Number(footerCfg.imageWidth as any) : undefined;
    let footerH: number | undefined = (footerCfg.imageHeight as any) != null ? Number(footerCfg.imageHeight as any) : undefined;
    const footerAlign: 'left' | 'center' | 'right' = footerCfg.imageAlign || 'left';
    const footerFill = footerCfg.fillPage !== false;
    const footerGap = footerFill ? 0 : 10;

    if (footerCfg.imageDataUrl && String(footerCfg.imageDataUrl).trim().length > 10) {
      try {
        const normalized = await normalizeDataUrlToPng(footerCfg.imageDataUrl);
        footerImageData = normalized.dataUrl;
        footerImageFormat = 'PNG';
        if (!footerW) {
          footerW = footerFill ? pageWidth : contentWidth;
        }
        if (!footerH && footerW) {
          if (normalized.naturalWidth && normalized.naturalHeight) {
            footerH = Math.round(footerW * (normalized.naturalHeight / normalized.naturalWidth));
          } else {
            footerH = 40;
          }
        }
      } catch {
        footerImageData = footerCfg.imageDataUrl;
        footerImageFormat = footerCfg.imageDataUrl.includes('image/jpeg') || footerCfg.imageDataUrl.includes('jpg') ? 'JPEG' : 'PNG';
        if (!footerW) footerW = footerFill ? pageWidth : contentWidth;
        if (!footerH && footerW) footerH = 40;
      }
    } else if (footerCfg.imageUrl && String(footerCfg.imageUrl).trim().length > 0) {
      try {
        const loaded = await loadUrlToDataUrl(footerCfg.imageUrl);
        footerImageData = loaded.dataUrl;
        footerImageFormat = loaded.format;
        if (!footerW) {
          footerW = footerFill ? pageWidth : contentWidth;
        }
        if (!footerH && footerW) {
          if (loaded.naturalWidth && loaded.naturalHeight) {
            footerH = Math.round(footerW * (loaded.naturalHeight / loaded.naturalWidth));
          } else {
            footerH = 40;
          }
        }
      } catch {}
    }

    if (footerImageData) {
      if (footerFill) {
        footerW = pageWidth;
        footerH = cmToPt(3.04);
      } else if (footerW) {
        const maxW = contentWidth;
        const maxH = 90;
        let w = footerW;
        let h = footerH || 40;
        if (w > maxW) {
          const scale = maxW / w;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        if (h > maxH) {
          const scale = maxH / h;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        footerW = Math.max(1, w);
        footerH = Math.max(1, h);
      }
    }

    const hasHeaderText = !!(headerCfg.customText || headerCfg.peritoName || headerCfg.professionalTitle || headerCfg.registrationNumber);

    const renderHeaderFooterImages = () => {
      // Cabeçalho
      if (headerImageData && headerW && (headerH || 40)) {
        const h = headerH || 40;
        let x = headerFill ? 0 : marginLeft;
        if (!headerFill) {
          if (headerAlign === 'center') {
            x = (pageWidth - headerW) / 2;
          } else if (headerAlign === 'right') {
            x = pageWidth - marginRight - headerW;
          }
        }
        const y = 0; // remover espaçamento superior para evitar linha visível
        try {
          doc.addImage(headerImageData, headerImageFormat, x, y, headerW, h);
        } catch {}
      } else {
        // Fallback textual de cabeçalho quando não há imagem
        if (hasHeaderText) {
          try {
            const line1 = headerCfg.customText || headerCfg.peritoName || '';
            const line2Parts: string[] = [];
            if (!headerCfg.customText) {
              if (headerCfg.professionalTitle) line2Parts.push(headerCfg.professionalTitle);
              if (headerCfg.registrationNumber) line2Parts.push(headerCfg.registrationNumber);
            }
            const line2 = line2Parts.join(' - ');

            const yBase = 24;
            let x = marginLeft;
            // calcular alinhamento baseado no texto mais largo
            const maxWidthText = line2 && doc.getTextWidth(line2) > doc.getTextWidth(line1) ? line2 : line1;
            const textWidth = doc.getTextWidth(maxWidthText || '');
            if (headerAlign === 'center') {
              x = (pageWidth - textWidth) / 2;
            } else if (headerAlign === 'right') {
              x = pageWidth - marginRight - textWidth;
            }

            // Linha 1 em negrito
            if (line1) {
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text(line1, x, yBase);
            }
            // Linha 2 normal
            if (line2) {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              doc.text(line2, x, yBase + 6);
            }
          } catch {}
        }
      }
      
      // Rodapé
      if (footerImageData && footerW && (footerH || 40)) {
        const h = footerH || 40;
        let x = footerFill ? 0 : marginLeft;
        if (!footerFill) {
          if (footerAlign === 'center') {
            x = (pageWidth - footerW) / 2;
          } else if (footerAlign === 'right') {
            x = pageWidth - marginRight - footerW;
          }
        }
        const y = pageHeight - h;
        try {
          doc.addImage(footerImageData, footerImageFormat, x, y, footerW, h);
        } catch {}
      } else {
        const hasFooterText = !!(footerCfg.customText || footerCfg.contactEmail || footerCfg.showPageNumbers !== false);
        if (hasFooterText) {
          try {
            const y = pageHeight - 20;
            let footerText = footerCfg.customText || '';
            const emailText = footerCfg.contactEmail || '';
            if (!footerText && emailText) footerText = emailText;
            if (footerText) {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              const textWidth = doc.getTextWidth(footerText);
              let x = marginLeft;
              if (footerAlign === 'center') {
                x = (pageWidth - textWidth) / 2;
              } else if (footerAlign === 'right') {
                x = pageWidth - marginRight - textWidth;
              }
              doc.text(footerText, x, y);
            }
            const showPageNumbers = footerCfg.showPageNumbers !== false;
            if (showPageNumbers) {
              const pageText = String(currentPage);
              const pageTextWidth = doc.getTextWidth(pageText);
              const pageX = pageWidth - marginRight - pageTextWidth;
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              doc.text(pageText, pageX, y);
            }
          } catch {}
        }
      }
    };

    const addPage = () => {
      if (currentPage >= 1) {
        doc.addPage();
      }
      currentPage += 1;
      cursorY = 50;
      renderHeaderFooterImages();
      // Garantir que o conteúdo não sobreponha o cabeçalho
      const headerY = 0;
      const headerRenderedHeight = headerImageData ? (headerH || 40) : (hasHeaderText ? 40 : 0);
      const spacingBelow = headerFill ? 0 : ((headerCfg as any).spacingBelow != null ? Number((headerCfg as any).spacingBelow) : 30);
      const baselinePadding = headerFill ? 12 : 0;
      const afterHeaderY = headerY + headerRenderedHeight + spacingBelow + baselinePadding;
      cursorY = Math.max(cursorY, afterHeaderY);
    };

    const addText = (
      text: string,
      fontSize = 12,
      isBold = false,
      align: 'left' | 'center' | 'right' = 'left',
      lineSpacingMultiplier = 1
    ) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const rawLines = String(text || "").split(/\r?\n/);

      let tocTitleToMark: string | undefined;
      if (isBold && fontSize >= 13) {
        const firstNonEmpty = rawLines.find((l) => String(l || "").trim().length > 0);
        const head = String(firstNonEmpty || "").trim();
        const m = head.match(/^(\d+(?:\.\d+)?)(?:\s*[\.\-])?\s+/);
        if (m) {
          const key = String(m[1] || "");
          const mapped = tocTitleBySectionKey[key];
          if (mapped) tocTitleToMark = mapped;
        }
      }
      let tocMarked = false;

      for (const raw of rawLines) {
        if (!raw.trim()) {
          cursorY += (fontSize + 8) * lineSpacingMultiplier;
          continue;
        }
        const lines = wrapText(raw, Math.floor(contentWidth / (fontSize * 0.6)));
        for (const line of lines) {
          const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
          if (cursorY > pageHeight - reservedBottom) {
            addPage();
          }
          if (tocTitleToMark && !tocMarked && !tocPages.has(tocTitleToMark)) {
            tocPages.set(tocTitleToMark, currentPage);
            tocMarked = true;
          }
          let x = marginLeft;
          if (align === 'center') {
            x = (pageWidth - doc.getTextWidth(line)) / 2;
          } else if (align === 'right') {
            x = pageWidth - marginRight - doc.getTextWidth(line);
          }
          doc.text(line, x, cursorY);
          cursorY += (fontSize + 5) * lineSpacingMultiplier;
        }
        cursorY += 6 * lineSpacingMultiplier;
      }
    };

    // Parágrafo justificado com espaçamento 1,5
    const addParagraphJustified = (text: string, fontSize = 12) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      const effectiveWidth = contentWidth;
      const spaceWidth = doc.getTextWidth(" ");

      const blocks = String(text || "").replace(/\r/g, "").split("\n");
      blocks.forEach((block) => {
        if (!block.trim()) {
          cursorY += fontSize * 1.5;
          return;
        }

        const lines = doc.splitTextToSize(block.trimEnd(), effectiveWidth);
        lines.forEach((line, idx) => {
          const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
          if (cursorY > pageHeight - reservedBottom) {
            addPage();
          }

          const words = line.split(/\s+/).filter(Boolean);
          const isLast = idx === lines.length - 1;
          const lineWidth = doc.getTextWidth(line);
          const shouldJustify =
            !isLast &&
            words.length >= 6 &&
            lineWidth >= effectiveWidth * 0.75 &&
            !/^[-•]\s+/.test(line);

          if (!shouldJustify) {
            doc.text(line, marginLeft, cursorY);
          } else {
            const wordsWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
            const gaps = words.length - 1;
            const normalSpacesWidth = gaps * spaceWidth;
            const extra = Math.max(0, effectiveWidth - wordsWidth - normalSpacesWidth);
            const extraPerGap = extra / gaps;
            let x = marginLeft;
            words.forEach((w, i) => {
              doc.text(w, x, cursorY);
              const advance = doc.getTextWidth(w) + spaceWidth + (i < gaps ? extraPerGap : 0);
              x += advance;
            });
          }

          cursorY += fontSize * 1.5;
        });
      });
    };

    // Justificação com tratamento de bullets (§, romanos, números) e higienização
    const sanitizeLegalText = (t: string) => {
      let s = String(t || "");
      s = s.replace(/[“”"]/g, "");
      s = s.replace(/–/g, "-");
      s = s.replace(/[^\S\r\n]+/g, " ");
      s = s.replace(/\s*,\s*/g, ", ");
      s = s.replace(/\s*\.\s*/g, ". ");
      s = s.replace(/\s*;\s*/g, "; ");
      s = s.replace(/\s*°\s*([Cc])/g, "°$1");
      s = s.replace(/\s*º\s*(\d+)/g, "º $1");
      return s.trim();
    };

    const addParagraphSmartJustified = (text: string, fontSize = 12) => {
      const paragraphs = String(text || "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      const bulletRegex = /^(§|[IVX]+(?:\s|[-–])|\d+(?:\s|[-–]))/;
      if (paragraphs.length === 0) {
        addParagraphJustified("Não informado", fontSize);
        return;
      }
      paragraphs.forEach((p) => {
        const clean = sanitizeLegalText(p);
        if (bulletRegex.test(clean)) {
          addText(clean, fontSize, false, 'left', 1.5);
        } else {
          addParagraphJustified(clean, fontSize);
        }
      });
    };

    const addCompactLeftLines = (lines: string[], fontSize = 12) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');
      const maxChars = Math.max(20, Math.floor(contentWidth / (fontSize * 0.6)));
      for (const raw of lines) {
        const line = String(raw || '').trim();
        if (!line) {
          cursorY += fontSize * 1.2;
          continue;
        }
        const wrapped = wrapText(sanitizeLegalText(line), maxChars);
        for (const w of wrapped) {
          const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
          if (cursorY > pageHeight - reservedBottom) {
            addPage();
          }
          doc.text(w, marginLeft, cursorY);
          cursorY += fontSize + 4;
        }
        cursorY += 2;
      }
    };

    const addAnnexResultsWithThemeBox = (raw: string, fontSize = 12) => {
      const base = fixGrammar(String(raw || ''));
      const parsed = parseAnnexResultsChunks(base);
      const hasAnnex = parsed.some((p) => p.kind === 'annex');
      if (!hasAnnex) {
        addParagraphSmartJustified(base, fontSize);
        return;
      }

      parsed.forEach((p) => {
        if (p.kind === 'text') {
          addParagraphSmartJustified(p.text, fontSize);
          cursorY += 6;
          return;
        }

        const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
        const boxPaddingX = 4;
        const boxPaddingY = 3;
        const boxH = fontSize + boxPaddingY * 2 + 2;

        const approxBodyH = Math.max(1, p.lines.length) * (fontSize + 6) + 10;
        if (cursorY + boxH + approxBodyH > pageHeight - reservedBottom) {
          addPage();
        }

        const boxX = marginLeft;
        const boxW = contentWidth;
        const boxY = cursorY - (fontSize - 2) - boxPaddingY;
        doc.setLineWidth(0.3);
        doc.rect(boxX, boxY, boxW, boxH);

        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'bold');
        const title = sanitizeLegalText(p.title);
        const titleX = boxX + boxPaddingX;
        const titleY = boxY + boxPaddingY + fontSize - 1;
        doc.text(title, titleX, titleY);
        const titleW = doc.getTextWidth(title);
        doc.line(titleX, titleY + 1, titleX + titleW, titleY + 1);

        cursorY = boxY + boxH + 8;
        doc.setFont('helvetica', 'normal');
        addCompactLeftLines(p.lines, fontSize);
        cursorY += 8;
      });
    };

    const addJustifiedHangingItem = (prefix: string, body: string, fontSize = 12) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');
      const effectiveWidth = contentWidth;
      const spaceWidth = doc.getTextWidth(' ');
      const prefixText = String(prefix || '').trim();
      const prefixWithSpace = prefixText ? `${prefixText} ` : '';
      const indent = prefixWithSpace ? doc.getTextWidth(prefixWithSpace) : 0;
      const xBody = marginLeft + indent;
      const widthBody = Math.max(40, effectiveWidth - indent);
      const cleanBody = sanitizeLegalText(String(body || ''));
      const lines = doc.splitTextToSize(cleanBody, widthBody);

      lines.forEach((line, idx) => {
        const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
        if (cursorY > pageHeight - reservedBottom) {
          addPage();
        }

        if (idx === 0 && prefixText) {
          doc.text(prefixText, marginLeft, cursorY);
        }

        const words = String(line || '').split(/\s+/).filter(Boolean);
        const isLast = idx === lines.length - 1;
        const lineWidth = doc.getTextWidth(String(line || ''));
        const shouldJustify = !isLast && words.length >= 6 && lineWidth >= widthBody * 0.75;
        if (!shouldJustify) {
          doc.text(String(line || ''), xBody, cursorY);
        } else {
          const wordsWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
          const gaps = words.length - 1;
          const normalSpacesWidth = gaps * spaceWidth;
          const extra = Math.max(0, widthBody - wordsWidth - normalSpacesWidth);
          const extraPerGap = extra / gaps;
          let x = xBody;
          words.forEach((w, i) => {
            doc.text(w, x, cursorY);
            const advance = doc.getTextWidth(w) + spaceWidth + (i < gaps ? extraPerGap : 0);
            x += advance;
          });
        }

        cursorY += fontSize * 1.5;
      });
    };

    const addQuesitoLineJustified = (rawLine: string, fallbackIndex: number, fontSize = 12) => {
      const line = String(rawLine || '').trim();
      if (!line) return;
      const m = line.match(/^\s*(\d+)\s*[\)\.\-:]\s*(.*)$/);
      if (m) {
        addJustifiedHangingItem(`${m[1]})`, m[2] || '', fontSize);
      } else {
        addJustifiedHangingItem(`${fallbackIndex})`, line, fontSize);
      }
      cursorY += 2;
    };

    // Tabela centralizada moderna (cabeçalho cinza, bordas sutis)
    const drawCenteredTable = (
      headers: string[],
      rows: Array<{ [key: string]: string }>,
      columnRatios: number[] = []
    ) => {
      const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
      const tableWidth = contentWidth;
      const startX = marginLeft;
      const cellPadding = 4;

      const headerFontSize = 10;
      const headerLineHeight = 12;
      const bodyFontSize = 10;
      const bodyLineHeight = 12;

      const centerColumns = new Set(["Entregas", "Avaliação"]);

      const ratios = columnRatios.length === headers.length ? columnRatios : new Array(headers.length).fill(1 / headers.length);
      const colWidths = ratios.map((r) => tableWidth * r);

      const computeHeader = () => {
        doc.setFont('helvetica', 'bold');
        const headerCellFontSizes = headers.map(() => headerFontSize);
        const headerLines = headers.map((h, i) => {
          const text = String(h || '');
          const cellInnerWidth = Math.max(10, colWidths[i] - 2 * cellPadding);
          if (text === 'Entregas') {
            doc.setFontSize(headerFontSize);
            const w = doc.getTextWidth(text);
            if (w > cellInnerWidth) {
              const scaled = Math.floor(headerFontSize * (cellInnerWidth / w));
              headerCellFontSizes[i] = Math.max(7, scaled);
            }
            return [text];
          }
          doc.setFontSize(headerFontSize);
          return doc.splitTextToSize(text, cellInnerWidth);
        });
        const maxHeaderLines = Math.max(1, ...headerLines.map((ls) => ls.length));
        const headerH = Math.max(22, maxHeaderLines * headerLineHeight + cellPadding * 2);
        return { headerLines, headerH, headerCellFontSizes };
      };

      const drawHeader = (headerLines: string[][], headerH: number, headerCellFontSizes: number[]) => {
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(180, 180, 180);
        doc.rect(startX, cursorY, tableWidth, headerH, 'F');
        let x = startX;
        doc.setFont('helvetica', 'bold');
        headers.forEach((h, i) => {
          doc.rect(x, cursorY, colWidths[i], headerH);
          const fontSize = headerCellFontSizes[i] ?? headerFontSize;
          doc.setFontSize(fontSize);
          let ty = cursorY + cellPadding + fontSize;
          headerLines[i].forEach((line) => {
            const w = doc.getTextWidth(line);
            const left = x + cellPadding;
            const centered = x + (colWidths[i] - w) / 2;
            const tx = centerColumns.has(String(h)) && Number.isFinite(centered) && centered > left ? centered : left;
            doc.text(line, tx, ty);
            ty += headerLineHeight;
          });
          x += colWidths[i];
        });
        cursorY += headerH;
      };

      const { headerLines, headerH, headerCellFontSizes } = computeHeader();
      if (cursorY + headerH > pageHeight - reservedBottom) addPage();
      drawHeader(headerLines, headerH, headerCellFontSizes);

      rows.forEach((row) => {
        doc.setFontSize(bodyFontSize);
        doc.setFont('helvetica', 'normal');
        const texts = headers.map((h) => String(row[h] || ''));
        const cellLines = texts.map((t, i) => doc.splitTextToSize(t, Math.max(10, colWidths[i] - 2 * cellPadding)));
        const maxLines = Math.max(1, ...cellLines.map((ls) => ls.length));
        const rowH = Math.max(18, maxLines * bodyLineHeight + cellPadding * 2);

        if (cursorY + rowH > pageHeight - reservedBottom) {
          addPage();
          const nextHeader = computeHeader();
          if (cursorY + nextHeader.headerH > pageHeight - reservedBottom) addPage();
          drawHeader(nextHeader.headerLines, nextHeader.headerH, nextHeader.headerCellFontSizes);
        }

        let cx = startX;
        headers.forEach((h, i) => {
          doc.setDrawColor(210, 210, 210);
          doc.rect(cx, cursorY, colWidths[i], rowH);
          const lines = cellLines[i];
          let ty = cursorY + cellPadding + bodyFontSize;
          lines.forEach((line) => {
            const w = doc.getTextWidth(line);
            const left = cx + cellPadding;
            const centered = cx + (colWidths[i] - w) / 2;
            const tx = centerColumns.has(String(h)) && Number.isFinite(centered) && centered > left ? centered : left;
            doc.text(line, tx, ty);
            ty += bodyLineHeight;
          });
          cx += colWidths[i];
        });
        cursorY += rowH;
      });
    };

    // CAPA
    addPage();
    // Respeitar o espaçamento calculado após o cabeçalho (não redefinir cursorY)
    // Renderizar imagens na primeira página (já desenhadas no addPage)
    
    // Cabeçalho da capa: só exibe texto se NÃO houver imagem de cabeçalho
    const suppressPeritoText = !!headerImageData || hasHeaderText;
    if (!suppressPeritoText) {
      addText(peritoName, 16, true, 'center');
      addText(professionalTitle, 12, false, 'center');
      addText(registrationNumber, 12, false, 'center');
    }
    
    // Reduzir espaçamento antes do título principal para subir o bloco
    cursorY += 30;
    
    // Título principal (evitar duplicidade de "Vara do Trabalho")
    const courtText = (process.court || '').trim();
    if (courtText) {
      // Se já há texto completo do tribunal, usar como está
      addText(`Excelentíssimo Senhor Doutor Juiz da ${courtText}`, 14, true, 'center');
    } else {
      // Fallback: montar tribunal com cidade (em maiúsculas)
      const city = String((process as any).inspection_city || 'DIADEMA').toUpperCase();
      addText(`Excelentíssimo Senhor Doutor Juiz da 1ª VARA DO TRABALHO DE ${city} – SP`, 14, true, 'center');
    }
    
    cursorY += 30;
    
    // Dados do processo
    addText(`Proc.: ${process.process_number || ''}`, 12, false, 'left', 1.5);
    // Terminologia trabalhista padronizada: Reclamante/Reclamada
    addText(`Reclamante: ${process.claimant_name || ''}`, 12, false, 'left', 1.5);
    // Sanitizar possível texto de advogado acoplado ao nome da reclamada
    const defendantSanitizedCover = String(process.defendant_name || '')
      .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    addText(`Reclamada: ${defendantSanitizedCover}`, 12, false, 'left', 1.5);
    
    cursorY += 30;
    
    // Texto da capa
    const idLine = `${peritoName}, ${professionalTitle}${registrationNumber ? ", " + registrationNumber : ""}`;
    const coverText = `${idLine}, LEGALMENTE HABILITADO e COMPROMISSADO, nomeado por Vossa Excelência nos autos do processo acima epigrafado, vem mui respeitosamente à presença de V. Exa. apresentar o resultado do seu trabalho consistente do incluso LAUDO PERICIAL, e solicitar o aferimento de seus honorários profissionais em 03 (três) salários mínimos, consoante monetariamente na data de seu efetivo pagamento.`;
    
    addParagraphJustified(coverText, 12);
    
    cursorY += 50;
    
    
    const currentDate = new Date().toLocaleDateString('pt-BR');
    addText(`Diadema, ${currentDate}`, 12, false, 'center');
    
    if (signatureImageData) {
      let sigW = signatureW || Math.min(300, contentWidth);
      if (sigW > contentWidth) sigW = contentWidth;
      const sigH = signatureH || 60;
      let x = marginLeft + (contentWidth - sigW) / 2;
      if (signatureAlign === 'left') x = marginLeft;
      if (signatureAlign === 'right') x = marginLeft + contentWidth - sigW;
      const y = cursorY + 20;
      doc.addImage(signatureImageData, signatureImageFormat, x, y, sigW, sigH);
      cursorY += sigH + 10;
    }
    
    cursorY += 10;
    addText("_________________________________", 12, false, 'center');
    addText(peritoName, 12, true, 'center');
    addText(professionalTitle, 12, false, 'center');
    addText(registrationNumber, 12, false, 'center');
    
    cursorY += 40;

    // SUMÁRIO
    addPage();
    // Respeitar espaçamento após cabeçalho e dar folga extra
    cursorY += 20;
    
    addText("Sumário", 16, true, 'center');
    cursorY += 30;
    
    // Sumário moderno com líderes pontilhados
    const addTocItem = (title: string, pageNumber?: string | number, fontSize = 12) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      if (cursorY > pageHeight - 100) addPage();

      const linePageIndex = currentPage;
      const pageNumberY = cursorY;

      const titleX = marginLeft;
      const titleWidth = doc.getTextWidth(title);
      const xRight = pageWidth - marginRight;
      const reservedWidth = doc.getTextWidth("0000");
      const leadersEndX = xRight - reservedWidth;
      const pageText = pageNumber == null ? "" : String(pageNumber);
      const pageTextWidth = pageText ? doc.getTextWidth(pageText) : 0;
      const pageX = xRight - pageTextWidth;

      doc.text(title, titleX, cursorY);
      const dottedLineY = cursorY - fontSize * 0.35;
      const startX = titleX + titleWidth + 6;
      const endX = leadersEndX - 6;
      if (endX > startX) {
        // Alguns typings de jsPDF não expõem setLineDash; usamos cast para evitar erro de TS
        const anyDoc = doc as any;
        if (typeof anyDoc.setLineDash === 'function') {
          anyDoc.setLineDash([1, 2], 0);
            doc.line(startX, dottedLineY, endX, dottedLineY);
          anyDoc.setLineDash();
        } else {
          // Fallback: desenha uma sequência de pontos manualmente
          const dotSpacing = 3;
          for (let x = startX; x < endX; x += dotSpacing) {
            doc.text('.', x, cursorY);
          }
        }
      }
      if (pageText) {
        doc.text(pageText, pageX, cursorY);
      } else {
        tocNumberSlots.push({ title, pageIndex: linePageIndex, y: pageNumberY, fontSize });
      }
      cursorY += fontSize * 1.5;
    };

    const summaryItemsModern: Array<{ title: string }> = [
      { title: "1 - Identificações" },
      { title: "2 - Dados da Reclamante" },
      { title: "3 - Dados da Reclamada" },
      { title: "4 - Objetivo" },
      { title: "5 - Dados da Inicial" },
      { title: "6 - Dados da Contestação da Reclamada" },
      { title: "7 - Diligências / Vistorias" },
      { title: "8 - Acompanhantes / Entrevistados" },
      { title: "9 - Metodologia de Avaliação" },
      { title: "10 - Documentações Apresentadas" },
      { title: "11 - Características do Local de Trabalho" },
      { title: "12 - Atividades da(o) Reclamante" },
      { title: "12.1 - Registro fotográfico" },
      { title: "12.2 - Discordâncias apresentadas pela reclamada" },
      { title: "13 - Equipamentos de Proteção Individual (EPIs)" },
      { title: "14 - Equipamentos de Proteção Coletiva" },
      { title: "15 - Análise das exposições" },
      ...(includeInsalubridade && insalubrityResultsNumber != null
        ? [{ title: `${insalubrityResultsNumber} - Resultados das avaliações referentes à insalubridade` }]
        : []),
      ...(includePericulosidade
        ? [
            { title: `${periculosityConceptNumber} - Conceito de Periculosidade` },
            { title: `${flammableDefinitionNumber} - Definição de produtos inflamáveis` },
            { title: `${periculosityResultsNumber} - Resultados das avaliações referentes à Periculosidade` },
          ]
        : []),
      ...(hasClaimant || hasDefendant || hasJudge
        ? [
            { title: `${quesitosNumber} - Quesitos da Perícia` },
            ...(hasClaimant ? [{ title: `${quesitosNumber}.1 - Quesitos da Reclamante` }] : []),
            ...(hasDefendant ? [{ title: `${quesitosNumber}.2 - Quesitos da Reclamada` }] : []),
            ...(hasJudge ? [{ title: `${quesitosNumber}.3 - Quesitos do Juíz(a)` }] : []),
          ]
        : []),
      { title: `${conclusaoNumber} - Conclusão` },
    ];
    
    summaryItemsModern.forEach(({ title }) => addTocItem(title));

    // CONTEÚDO PRINCIPAL COM OS 21 ITENS
    addPage();
    // Respeitar espaçamento após cabeçalho e dar folga extra
    cursorY += 20;
    
    // 1. IDENTIFICAÇÕES
    addText("1. IDENTIFICAÇÕES", 14, true);
    cursorY += 10;
    // Campos: número do processo, reclamante e reclamada (sem advogado e sem vara)
    addText(`Número do Processo: ${process.process_number || 'Não informado'}`, 12, false, 'left', 1.5);
    addText(`Reclamante: ${process.claimant_name || 'Não informado'}`, 12, false, 'left', 1.5);
    const defendantSanitized = String(process.defendant_name || '')
      .replace(/\bADVOGAD[OA]\s*:\s*[^\n]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    addText(`Reclamada: ${defendantSanitized || 'Não informado'}`, 12, false, 'left', 1.5);
    cursorY += 20;

    // 2. Dados da Reclamante
    addText("2. DADOS DA RECLAMANTE", 14, true);
    cursorY += 10;
    const claimantData = (typeof process.claimant_data === 'object' && process.claimant_data) ? process.claimant_data as any : {};
    const claimantName = claimantData.name || process.claimant_name || 'Não informado';
    addText(`Nome Completo: ${claimantName}`, 12, false, 'left', 1.5);
    // Funções e Períodos Laborais (aba Laudo)
    const positions = Array.isArray(claimantData.positions) ? claimantData.positions : [];
    addText("Funções e Períodos Laborais", 12, false, 'left', 1.5);
    if (!positions.length) {
      addText("Nenhuma função adicionada.", 12, false, 'left', 1.5);
    } else {
      positions.forEach((p: any) => {
        const title = (p?.title || '').trim() || 'Não informado';
        const period = (p?.period || '').trim() || 'Não informado';
        const obs = (p?.obs || '').trim();
        const obsText = obs ? ` | Observações: ${obs}` : '';
        addText(`• Função: ${title} | Período: ${period}${obsText}`, 12, false, 'left', 1.5);
      });
    }
    cursorY += 20;

    // 3. Dados da Reclamada (alinhado à aba Laudo)
    addText("3. DADOS DA RECLAMADA", 14, true);
    cursorY += 10;
    const defendantText = typeof (process as any).defendant_data === 'string' ? String((process as any).defendant_data) : '';
    if (defendantText && defendantText.trim()) {
      addParagraphJustified(defendantText.trim(), 12);
    } else {
      addParagraphJustified("Não informado", 12);
    }
    cursorY += 20;

    // 4. Objetivo
    addText("4. OBJETIVO", 14, true);
    cursorY += 10;
    const objective = (process as any).objective || (process as any).objetivo || "Não informado";
    addParagraphJustified(String(objective), 12);
    cursorY += 20;

    // 5. Dados da Inicial
    addText("5. DADOS DA INICIAL", 14, true);
    cursorY += 10;
    const initialText = (process as any).initial_data || "Não informado";
    addParagraphJustified(String(initialText), 12);
    cursorY += 20;

    // Removido item 5.1 (Dados da Construção da Reclamada)

    // 6. Dados da Contestação da Reclamada
    addText("6. DADOS DA CONTESTAÇÃO DA RECLAMADA", 14, true);
    cursorY += 10;
    const defenseTextRaw = (process as any).defense_data || "Não informado";
    const defenseParagraphs = String(defenseTextRaw)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (defenseParagraphs.length === 0) {
      addParagraphJustified("Não informado", 12);
    } else {
      defenseParagraphs.forEach((p, idx) => {
        addParagraphJustified(p, 12);
        // pequeno respiro entre parágrafos para manter a estrutura do texto gerado
        if (idx < defenseParagraphs.length - 1) cursorY += 6;
      });
    }
    cursorY += 20;

    // (removido) Acompanhamento / Entrevistados como 6.1 — será o item 8

    // Itens 6.2 e 6.3 removidos conforme solicitação

    // 7. Diligências / Vistorias (alinhado à aba Laudo)
    addText("7. DILIGÊNCIAS / VISTORIAS", 14, true);
    cursorY += 10;
    // Texto introdutório conforme exibido na aba Laudo
    addParagraphJustified(
      "Para avaliação das condições em que trabalhava a Reclamante, foi realizada vistoria em seu local de trabalho, nas dependências da Reclamada, para atingirmos o adequado encaminhamento e correta interpretação final deste Laudo Pericial, sem subjetivismo e com embasamento técnico legal.",
      12
    );
    cursorY += 6;
    addParagraphJustified(
      "Realizou-se primeiramente o inquérito preliminar, item administrativo obrigatório em qualquer perícia trabalhista, prestando todas as informações necessárias e esclarecimentos de ordem prática, os profissionais abaixo relacionados, além da ouvida de outros trabalhadores presentes nas áreas ou postos de trabalho, visando com isto caracterizar itens básicos relativos ao objetivo desta avaliação.",
      12
    );
    cursorY += 10;
    const dils = Array.isArray((process as any).diligence_data) ? ((process as any).diligence_data as any[]) : [];
    const fmtDate = (s?: string) => {
      if (!s) return "";
      try {
        const [y, m, d] = String(s).split("-");
        return `${d?.padStart(2,"0")}/${m?.padStart(2,"0")}/${y}`;
      } catch { return String(s); }
    };
    const fmtTime = (s?: string) => (s ? String(s) : "");
    if (dils.length > 0) {
      dils.forEach((d, idx) => {
        addText(`Vistoria ${idx + 1}:`, 12, true);
        if (d?.location) addText(`Local: ${String(d.location)}`, 12);
        if (d?.date) addText(`Data: ${fmtDate(String(d.date))}`, 12);
        if (d?.time) addText(`Horário: ${fmtTime(String(d.time))}`, 12);
        if (d?.description) addParagraphJustified(String(d.description), 12);
        cursorY += 10;
      });
    } else {
      // Fallback para dados de inspeção do processo
      const iDate = (process as any).inspection_date;
      const iAddr = (process as any).inspection_address;
      const iCity = (process as any).inspection_city;
      const iTime = (process as any).inspection_time;
      if (iAddr) addText(`Local: ${String(iAddr)}${iCity ? `, ${String(iCity)}` : ''}`, 12);
      if (iDate) addText(`Data: ${fmtDate(String(iDate))}`, 12);
      if (iTime) addText(`Horário: ${fmtTime(String(iTime))}`, 12);
      if (!iAddr && !iDate && !iTime) addText("Não informado", 12, false, 'left', 1.5);
    }
    cursorY += 20;

    // 8. Acompanhantes / Entrevistados — tabela centralizada
    addText("8. ACOMPANHANTES / ENTREVISTADOS", 14, true);
    cursorY += 10;
    {
      const attendees = (process as any).attendees || (process as any).acompanhamento;
      const headers = ["Nome", "Função", "Empresa", "Observações"];
      const rows: Array<{ [key: string]: string }> = [];
      if (Array.isArray(attendees) && attendees.length) {
        attendees.forEach((p: any) => {
          rows.push({
            Nome: String(p?.name || p || ''),
            Função: String(p?.function || ''),
            Empresa: String(p?.company || ''),
            Observações: String(p?.obs || ''),
          });
        });
      } else if (typeof attendees === 'string' && attendees.trim()) {
        rows.push({ Nome: String(attendees), Função: '', Empresa: '', Observações: '' });
      } else {
        rows.push({ Nome: 'Não informado', Função: '', Empresa: '', Observações: '' });
      }
      drawCenteredTable(headers, rows, [0.35, 0.25, 0.2, 0.2]);
    }
    cursorY += 20;

    // 9 - Metodologia de Avaliação
    addText("9. METODOLOGIA DE AVALIAÇÃO", 14, true);
    cursorY += 10;
    {
      const methodologyText = (process.methodology || '').trim() || "Inspeção técnica no local de trabalho, análise documental, medições quantitativas quando aplicável, e avaliação conforme normas regulamentadoras vigentes.";
      // Texto justificado com espaçamento de 1,5
      addParagraphJustified(String(methodologyText), 12);
    }
    cursorY += 20;

    // 10 - Documentações Apresentadas
    addText("10. DOCUMENTAÇÕES APRESENTADAS", 14, true);
    cursorY += 10;
    const docs = (process as any).documents_presented || (process as any).documentos_apresentados || (process as any).documents || (process as any).docs;
    if (Array.isArray(docs) && docs.length) {
      docs.forEach((d: any) => {
        const nome = d?.title || d?.name || d?.nome || d;
        const tipo = d?.type || d?.tipo;
        const emissor = d?.issuer || d?.emissor;
        const data = d?.date || d?.data;
        const detalhes = [nome, tipo, emissor, data].filter(Boolean).join(" • ");
        addText(`• ${detalhes}`, 12, false, 'left', 1.5);
      });
    } else if (typeof docs === 'string' && docs.trim()) {
      addParagraphJustified(String(docs), 12);
    } else {
      addText('Não informado', 12, false, 'left', 1.5);
    }
    cursorY += 20;

    // 11 - Características do Local de Trabalho (tabela)
    addText("11. CARACTERÍSTICAS DO LOCAL DE TRABALHO", 14, true);
    cursorY += 10;
    {
      const wkcRaw = (process as any).workplace_characteristics
        || (process as any).caracteristicas_local
        || (process as any).workplace
        || (process as any).local_characteristics;

      // Se for condição especial (qualquer diferente de 'none'), usar apenas texto
      if (wkcRaw && typeof wkcRaw === 'object' && !Array.isArray(wkcRaw)) {
        const specialType = String(wkcRaw.special_condition_type || 'none');
        const specialDesc = String(wkcRaw.special_condition_description || '').trim();
        const typeLabel = specialType === 'ceu_aberto' ? 'Céu aberto'
          : specialType === 'veiculo' ? 'Veículo'
          : specialType === 'outra' ? 'Outra condição'
          : 'Usar tabela padrão';
        if (specialType !== 'none') {
          addText(`Condição especial: ${typeLabel}.`, 12, false, 'left', 1.5);
          addParagraphJustified(specialDesc || 'Não informado', 12);
        } else {
          // Tabela detalhada para condição padrão
          const headers = ["Característica", "Detalhe"];
          const rows: Array<{ [key: string]: string }> = [];

          const joinArr = (arr?: any[]) => Array.isArray(arr) && arr.length ? arr.map((v) => String(v)).join(', ') : '';
          const pushRow = (label: string, value: any) => {
            const valStr = Array.isArray(value) ? joinArr(value) : String(value ?? '').trim();
            if (valStr) rows.push({ [headers[0]]: label, [headers[1]]: valStr });
          };

          pushRow('Área superior (m²)', wkcRaw.area);
          pushRow('Pé-direito (m)', wkcRaw.ceiling_height);
          pushRow('Construção', joinArr(wkcRaw.construction));
          pushRow('Cobertura', joinArr(wkcRaw.roofing));
          pushRow('Iluminação', joinArr(wkcRaw.lighting));
          pushRow('Ventilação', joinArr(wkcRaw.ventilation));
          pushRow('Piso', wkcRaw.floor);
          pushRow('Revestimento do piso', joinArr(wkcRaw.flooring));
          pushRow('Paredes', joinArr(wkcRaw.walls));

          if (rows.length === 0) {
            rows.push({ [headers[0]]: 'Não informado', [headers[1]]: '' });
          }
          drawCenteredTable(headers, rows, [0.35, 0.65]);
        }
      } else if (typeof wkcRaw === 'string' && wkcRaw.trim()) {
        // Se vier como string (ex. descrição livre), imprimir texto
        addParagraphJustified(String(wkcRaw).trim(), 12);
      } else if (Array.isArray(wkcRaw) && wkcRaw.length) {
        // Array genérico: transformar em linhas simples
        const headers = ["Característica", "Detalhe"];
        const rows: Array<{ [key: string]: string }> = [];
        wkcRaw.forEach((item: any, idx: number) => {
          if (item && typeof item === 'object') {
            const name = item.name || item.nome || item.attribute || item.atributo || `Item ${idx + 1}`;
            const details = Object.entries(item)
              .filter(([k]) => !['name','nome','attribute','atributo'].includes(k))
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
              .join(' | ');
            rows.push({ [headers[0]]: String(name), [headers[1]]: details || '' });
          } else {
            rows.push({ [headers[0]]: `Item ${idx + 1}`, [headers[1]]: String(item ?? '') });
          }
        });
        drawCenteredTable(headers, rows, [0.35, 0.65]);
      } else {
        addText('Não informado', 12, false, 'left', 1.5);
      }
    }
    cursorY += 20;

    // 12 - Atividades da Reclamante
    addText("12. ATIVIDADES DA(O) RECLAMANTE", 14, true);
    cursorY += 10;
    {
      const activities = (process as any).activities_description
        || (process as any).atividades_reclamante
        || '';
      const txt = String(activities).trim();
      if (txt) {
        addParagraphJustified(txt, 12);
      } else {
        addText('Não informado', 12, false, 'left', 1.5);
      }
    }
    cursorY += 20;

    // 12.1 - Registro fotográfico
    addText("12.1 REGISTRO FOTOGRÁFICO", 13, true);
    cursorY += 10;
    {
      const photos: Array<{ id: string; type: 'url' | 'storage'; url?: string; file_path?: string; signed_url?: string; caption?: string }>
        = Array.isArray((process as any)?.report_config?.photo_register) ? ((process as any).report_config.photo_register as any[]) : [];
      if (!Array.isArray(photos) || photos.length === 0) {
        addText('Nenhuma foto adicionada.', 12, false, 'left', 1.5);
      } else {
        const gap = 14;
        const colW = Math.floor((contentWidth - gap) / 2);
        const maxW = Math.min(colW, 240);
        let colIndex = 0;
        let rowMaxH = 0;
        let rowStartY = cursorY;

        const renderCell = async (p: any, x: number) => {
          let cellH = 0;
          const src = p?.signed_url || p?.url;
          if (src) {
            try {
              const loaded = await loadUrlToDataUrl(src);
              const normalized = await normalizeDataUrlToPng(loaded.dataUrl);
              const w = maxW;
              const h = normalized.naturalWidth && normalized.naturalHeight ? Math.round(w * (normalized.naturalHeight / normalized.naturalWidth)) : Math.round(w * 0.6);
              const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
              if (rowStartY + h + 40 > pageHeight - reservedBottom) {
                addPage();
                rowStartY = cursorY;
              }
              doc.addImage(normalized.dataUrl, 'PNG', x, rowStartY, w, h);
              cellH += h;
              const caption = String(p?.caption || '').trim();
              if (caption) {
                const lines = doc.splitTextToSize(caption, w);
                let ty = rowStartY + h + 12;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                lines.forEach((ln: string) => {
                  doc.text(ln, x, ty);
                  ty += 12;
                  cellH += 12;
                });
              }
            } catch {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              doc.text('Imagem não disponível', x, rowStartY + 12);
              cellH += 24;
            }
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Imagem não disponível', x, rowStartY + 12);
            cellH += 24;
          }
          rowMaxH = Math.max(rowMaxH, cellH + 24);
        };

        for (let i = 0; i < photos.length; i++) {
          if (colIndex === 0) {
            rowMaxH = 0;
            rowStartY = cursorY;
          }
          const x = marginLeft + colIndex * (maxW + gap);
          await renderCell(photos[i], x);
          colIndex = (colIndex + 1) % 2;
          if (colIndex === 0 || i === photos.length - 1) {
            cursorY = rowStartY + rowMaxH + 10;
          }
        }
      }
    }
    cursorY += 10;

    // 12.2 - Discordâncias apresentadas
    addText("12.2 DISCORDÂNCIAS APRESENTADAS PELA RECLAMADA", 13, true);
    cursorY += 10;
    {
      const discordances = (process as any).discordances_presented || (process as any).discordancias_apresentadas;
      if (Array.isArray(discordances) && discordances.length) {
        discordances.forEach((d: any) => {
          const texto = d?.text || d;
          addText(`• ${String(texto ?? 'Não informado')}`, 12);
        });
      } else if (typeof discordances === 'string' && discordances.trim()) {
        addParagraphJustified(String(discordances).trim(), 12);
      } else {
        addText('Não informado', 12, false, 'left', 1.5);
      }
    }
    cursorY += 20;

    // 13 - Equipamentos de Proteção Individual (EPIs)
    addText("13. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)", 14, true);
    cursorY += 10;
    {
      const introDefault = "Para função exercida pela Reclamante a empresa realizava a entrega dos seguintes equipamentos de proteção individual - E.P.I. (Art. 166 da CLT e NR-6, item 6.2 da Portaria nº 3214/78 do MTE):";
const introText = String((process as any).epi_intro || (process as any).epi_introduction || introDefault).trim();
      if (introText) addParagraphJustified(introText, 12);
      cursorY += 8;

      const epis = (process as any).epis;
      const headers = ["Equipamento", "Proteção", "CA"];
      const rows: Array<{ [key: string]: string }> = [];
      if (Array.isArray(epis) && epis.length) {
        epis.forEach((e: any) => {
          const equipment = String(e?.equipment ?? e?.name ?? e ?? '').trim();
          const protection = String(e?.protection ?? e?.desc ?? e?.observation ?? '').trim();
          const ca = String(e?.ca ?? '').trim();
          rows.push({ Equipamento: equipment, Proteção: protection, CA: ca });
        });
      } else if (typeof epis === 'string' && epis.trim()) {
        rows.push({ Equipamento: String(epis).trim(), Proteção: '', CA: '' });
      } else {
        rows.push({ Equipamento: 'Não informado', Proteção: '', CA: '' });
      }
      drawCenteredTable(headers, rows, [0.5, 0.35, 0.15]);

      const parseRc = (rc: any) => { try { return typeof rc === 'string' ? JSON.parse(rc || '{}') : (rc || {}); } catch { return {}; } };
      const formatDateBR = (raw: string) => {
        const s = String(raw || '').trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
      };

      const formatDateBRFromDate = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = String(d.getFullYear());
        return `${dd}/${mm}/${yyyy}`;
      };
      const parseBRDate = (s: string) => {
        const m = String(s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!m) return null;
        const dd = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        const yyyy = parseInt(m[3], 10);
        const d = new Date(yyyy, mm - 1, dd);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const extractPeriodRange = (raw: any) => {
        const matches = String(raw || "").match(/\b\d{2}\/\d{2}\/\d{4}\b/g);
        if (!matches || matches.length < 2) return null;
        const startStr = matches[0];
        const endStr = matches[1];
        const start = parseBRDate(startStr);
        const end = parseBRDate(endStr);
        if (!start || !end) return null;
        return { startStr, endStr, start, end };
      };

      const daysInMonth = (year: number, monthIndex0: number) => {
        return new Date(year, monthIndex0 + 1, 0).getDate();
      };

      const diffCalendarParts = (start: Date, end: Date) => {
        const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        if (b.getTime() < a.getTime()) return { years: 0, months: 0, days: 0 };

        let years = b.getFullYear() - a.getFullYear();
        let months = b.getMonth() - a.getMonth();
        let days = b.getDate() - a.getDate();

        if (days < 0) {
          months -= 1;
          let borrowYear = b.getFullYear();
          let borrowMonth = b.getMonth() - 1;
          if (borrowMonth < 0) {
            borrowMonth = 11;
            borrowYear -= 1;
          }
          days += daysInMonth(borrowYear, borrowMonth);
        }
        if (months < 0) {
          years -= 1;
          months += 12;
        }

        return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
      };

      const diffCalendarLabel = (start: Date, end: Date) => {
        const { years, months, days } = diffCalendarParts(start, end);
        const parts: string[] = [];
        if (years) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
        if (months) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
        if (days || parts.length === 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
        return `${parts[0]}, ${parts[1]} e ${parts[2]}`;
      };
      const buildEmploymentPeriodInfo = () => {
        const claimant = (process as any).claimant_data;
        const parsed = (() => {
          try {
            return typeof claimant === 'string' ? JSON.parse(claimant || '{}') : (claimant || {});
          } catch {
            return {};
          }
        })();
        const positions = Array.isArray((parsed as any)?.positions) ? (parsed as any).positions : [];
        let minStart: Date | null = null;
        let minStartStr = '';
        let maxEnd: Date | null = null;
        let maxEndStr = '';
        positions.forEach((p: any) => {
          const range = extractPeriodRange(p?.period);
          if (!range) return;
          if (!minStart || range.start.getTime() < minStart.getTime()) {
            minStart = range.start;
            minStartStr = range.startStr;
          }
          if (!maxEnd || range.end.getTime() > maxEnd.getTime()) {
            maxEnd = range.end;
            maxEndStr = range.endStr;
          }
        });
        if (!minStart || !maxEnd) return { label: '', days: null as number | null, start: null as Date | null, end: null as Date | null };
        const ms = maxEnd.getTime() - minStart.getTime();
        const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        const diffLabel = diffCalendarLabel(minStart, maxEnd);
        return { label: `${minStartStr} a ${maxEndStr}${diffLabel ? ` (${diffLabel})` : ''}`, days, start: minStart, end: maxEnd };
      };

      const parseUsefulLifeDays = (raw: string) => {
        const text = String(raw || '').toLowerCase();
        if (!text.trim()) return null;
        const pick = (re: RegExp) => {
          const m = text.match(re);
          if (!m) return 0;
          const n = parseInt(m[1], 10);
          return Number.isFinite(n) ? n : 0;
        };
        const years = pick(/(\d+)\s*(ano|anos)\b/);
        const months = pick(/(\d+)\s*(m[eê]s|meses)\b/);
        const weeks = pick(/(\d+)\s*(semana|semanas)\b/);
        const days = pick(/(\d+)\s*(dia|dias)\b/);
        const total = years * 365 + months * 30 + weeks * 7 + days;
        return total > 0 ? total : null;
      };

      const daysToMonthsDaysLabel = (d: number) => {
        const days = Math.max(0, Math.round(d));
        const months = Math.floor(days / 30);
        const rem = days % 30;
        if (months > 0 && rem > 0) return `${months} mês(es) e ${rem} dia(s)`;
        if (months > 0) return `${months} mês(es)`;
        return `${rem} dia(s)`;
      };

      const parseISODate = (s: string) => {
        const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const rc = parseRc((process as any).report_config);
      const replCfg = rc?.epi_replacement_periodicity || {};
      const replEnabled = !!replCfg?.enabled;
      const imprescritoOnly = !!replCfg?.imprescrito_only;
      const replText = String(replCfg?.text || '').trim();
      const replRows = Array.isArray(replCfg?.rows) ? replCfg.rows : [];
      const usefulLifeItems = Array.isArray(replCfg?.useful_life_items) ? replCfg.useful_life_items : [];
      const trainingAudit = (() => {
        const raw = (replCfg as any)?.training_audit;
        if (!raw) return {};
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw || '{}') || {};
          } catch {
            return {};
          }
        }
        if (typeof raw === 'object') return raw;
        return {};
      })();
      const employmentPeriodInfo = buildEmploymentPeriodInfo();
      const employmentPeriodLabel = employmentPeriodInfo.label;
      const employmentPeriodDays = employmentPeriodInfo.days;
      const employmentStart = (employmentPeriodInfo as any).start as Date | null;
      const employmentEnd = (employmentPeriodInfo as any).end as Date | null;

      const distributionDate = parseISODate(String((process as any).distribution_date || '').trim());

      const effectivePeriod = (() => {
        if (!employmentStart || !employmentEnd) return { start: employmentStart, end: employmentEnd, label: employmentPeriodLabel || '' };
        if (!imprescritoOnly) return { start: employmentStart, end: employmentEnd, label: employmentPeriodLabel || '' };
        if (!distributionDate) return { start: employmentStart, end: employmentEnd, label: 'Período imprescrito selecionado, mas sem data de distribuição' };
        const start5y = new Date(distributionDate.getFullYear() - 5, distributionDate.getMonth(), distributionDate.getDate());
        const start = start5y.getTime() > employmentStart.getTime() ? start5y : employmentStart;
        const end = employmentEnd;
        if (end.getTime() <= start.getTime()) return { start, end, label: 'Período imprescrito selecionado, mas sem período válido' };
        const diffLabel = diffCalendarLabel(start, end);
        const range = `${formatDateBRFromDate(start)} a ${formatDateBRFromDate(end)}${diffLabel ? ` (${diffLabel})` : ''}`;
        return { start, end, label: `Imprescrito (últimos 5 anos): ${range}` };
      })();

      const addDays = (base: Date, days: number) => {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        d.setDate(d.getDate() + Math.trunc(days));
        return d;
      };

      const diffDaysCeil = (start: Date, end: Date) => {
        const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const ms = b.getTime() - a.getTime();
        if (!Number.isFinite(ms) || ms <= 0) return 0;
        return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      };

      if (replEnabled) {
        cursorY += 12;
        addText("Avaliação da periodicidade de trocas de EPIs", 12, true);
        cursorY += 8;
        if (replText) {
          addParagraphJustified(replText, 12);
          cursorY += 8;
        }

        const headers2 = ["Equipamento fornecido", "CA", "Data de entrega"];
        const rows2: Array<{ [key: string]: string }> = [];
        if (Array.isArray(replRows) && replRows.length) {
          replRows.forEach((r: any) => {
            const equipment = String(r?.equipment || '').trim();
            const ca = String(r?.ca || '').trim();
            const delivery = formatDateBR(String(r?.delivery_date || '').trim());
            rows2.push({ "Equipamento fornecido": equipment, CA: ca, "Data de entrega": delivery });
          });
        } else {
          rows2.push({ "Equipamento fornecido": "Não informado", CA: "", "Data de entrega": "" });
        }

        drawCenteredTable(headers2, rows2, [0.55, 0.15, 0.3]);

        if (Array.isArray(usefulLifeItems) && usefulLifeItems.length) {
          cursorY += 12;
          addText("Vida útil estimada (por EPI/CA)", 12, true);
          cursorY += 8;
          if (effectivePeriod.label) {
            addParagraphJustified(`Período considerado: ${effectivePeriod.label}`, 11);
            cursorY += 8;
          }

          const headers3 = ["EPI", "CA", "Vida útil estimada"];
          const rows3: Array<{ [key: string]: string }> = [];
          usefulLifeItems.forEach((it: any) => {
            const equipment = String(it?.equipment || '').trim();
            const ca = String(it?.ca || '').trim();
            const life = String(it?.estimated_life || '').trim();
            rows3.push({ EPI: equipment || 'Não informado', CA: ca, "Vida útil estimada": life });
          });
          drawCenteredTable(headers3, rows3, [0.35, 0.15, 0.5]);
        }

        const deliveryByEquipment = new Map<string, Array<{ ca: string; date: Date }>>();
        if (Array.isArray(replRows) && replRows.length) {
          replRows.forEach((r: any) => {
            const equipment = String(r?.equipment || '').trim();
            const ca = String(r?.ca || '').trim();
            const dt = parseISODate(String(r?.delivery_date || '').trim());
            if (!equipment || !dt) return;
            const list = deliveryByEquipment.get(equipment) || [];
            list.push({ ca, date: dt });
            deliveryByEquipment.set(equipment, list);
          });
        }

        const getLifeDaysFor = (equipment: string, ca: string) => {
          const life = Array.isArray(usefulLifeItems)
            ? usefulLifeItems.find((i: any) => String(i?.equipment || '').trim() === equipment && String(i?.ca || '').trim() === ca)
            : null;
          return parseUsefulLifeDays(String((life as any)?.estimated_life || ''));
        };

        const buildBasisLabel = (equipment: string, usedDefault: boolean) => {
          const map = new Map<string, number>();
          (Array.isArray(usefulLifeItems) ? usefulLifeItems : [])
            .filter((i: any) => String(i?.equipment || '').trim() === equipment)
            .forEach((i: any) => {
              const ca = String(i?.ca || '').trim();
              const days = parseUsefulLifeDays(String(i?.estimated_life || ''));
              if (!ca || !days) return;
              map.set(ca, days);
            });
          if (!map.size) return 'Base padrão: 6 meses';
          const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
          const shown = entries.slice(0, 3).map(([ca, days]) => `CA ${ca}: ${daysToMonthsDaysLabel(days)}`);
          const suffix = entries.length > shown.length ? ` | +${entries.length - shown.length}` : '';
          return `Vida útil por CA: ${shown.join(' | ')}${suffix}${usedDefault ? ' | padrão: 6 meses' : ''}`;
        };

        const buildEquipmentLabel = (equipment: string, deliveries: Array<{ ca: string; date: Date }>) => {
          const cas = Array.from(new Set(deliveries.map((d) => String(d.ca || '').trim()).filter(Boolean)));
          if (!cas.length) return equipment;
          if (cas.length === 1) return `${equipment} (CA ${cas[0]})`;
          const shown = cas.slice(0, 3);
          const suffix = cas.length > shown.length ? `, +${cas.length - shown.length}` : '';
          return `${equipment} (CAs: ${shown.join(', ')}${suffix})`;
        };

        const deliveryEvaluation = Array.from(deliveryByEquipment.entries())
          .map(([equipment, deliveries]) => {
            const sortedDeliveries = [...deliveries].sort((a, b) => a.date.getTime() - b.date.getTime());
            const periodStartMs = effectivePeriod.start ? effectivePeriod.start.getTime() : null;
            const periodEndMs = effectivePeriod.end ? effectivePeriod.end.getTime() : null;
            const deliveriesInPeriod = (() => {
              if (periodStartMs == null || periodEndMs == null) return sortedDeliveries;
              return sortedDeliveries.filter((d) => d.date.getTime() >= periodStartMs && d.date.getTime() <= periodEndMs);
            })();

            const datesForIntervals = (() => {
              const dates = deliveriesInPeriod.map((d) => d.date);
              if (periodStartMs == null || periodEndMs == null) return dates;
              const prev = sortedDeliveries.filter((d) => d.date.getTime() < periodStartMs).slice(-1)[0]?.date;
              if (prev) dates.unshift(prev);
              return dates;
            })()
              .sort((a, b) => a.getTime() - b.getTime())
              .filter((d, idx, arr) => idx === 0 || d.getTime() !== arr[idx - 1].getTime());

            const intervals = Array.from({ length: Math.max(0, datesForIntervals.length - 1) })
              .map((_, i) => {
                const from = datesForIntervals[i];
                const to = datesForIntervals[i + 1];
                const deltaDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
                if (!Number.isFinite(deltaDays) || deltaDays < 0) return null;
                return { from, to, days: deltaDays, label: diffCalendarLabel(from, to) };
              })
              .filter(Boolean) as Array<{ from: Date; to: Date; days: number; label: string }>;

            const avgIntervalDays = intervals.length ? intervals.reduce((a, b) => a + b.days, 0) / intervals.length : null;
            const representativeInterval = (() => {
              if (!intervals.length) return null;
              if (intervals.length === 1) return intervals[0];
              const avg = avgIntervalDays ?? intervals[0].days;
              return intervals.reduce((best, curr) => (Math.abs(curr.days - avg) < Math.abs(best.days - avg) ? curr : best), intervals[0]);
            })();

            const intervalLabel = (() => {
              if (representativeInterval) {
                if (intervals.length === 1) return representativeInterval.label;
                const avgLabel = avgIntervalDays == null ? '' : daysToMonthsDaysLabel(avgIntervalDays);
                return avgLabel ? `${representativeInterval.label} (média aprox.: ${avgLabel})` : representativeInterval.label;
              }
              if (periodStartMs != null && periodEndMs != null) {
                if (!deliveriesInPeriod.length) return 'Sem entregas no período';
                if (deliveriesInPeriod.length === 1) return 'Apenas 1 entrega';
              }
              return sortedDeliveries.length ? 'Apenas 1 entrega' : 'Não informado';
            })();

            const insufficientRanges = (() => {
              if (!effectivePeriod.start || !effectivePeriod.end) return [] as Array<{ start: Date; end: Date }>;
              const start = effectivePeriod.start;
              const end = effectivePeriod.end;
              if (end.getTime() <= start.getTime()) return [] as Array<{ start: Date; end: Date }>;
              if (!sortedDeliveries.length) return [{ start, end }];

              const coverageIntervals: Array<{ start: Date; end: Date }> = [];
              sortedDeliveries.forEach((d) => {
                const lifeDays = getLifeDaysFor(equipment, String(d.ca || '').trim()) ?? 180;
                const covStart = d.date.getTime() > start.getTime() ? d.date : start;
                const covEndRaw = addDays(d.date, lifeDays);
                const covEnd = covEndRaw.getTime() < end.getTime() ? covEndRaw : end;
                if (covEnd.getTime() > covStart.getTime()) coverageIntervals.push({ start: covStart, end: covEnd });
              });
              if (!coverageIntervals.length) return [{ start, end }];

              coverageIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

              const merged: Array<{ start: Date; end: Date }> = [];
              coverageIntervals.forEach((it) => {
                const last = merged[merged.length - 1];
                if (!last) {
                  merged.push({ start: it.start, end: it.end });
                  return;
                }
                if (it.start.getTime() <= last.end.getTime()) {
                  if (it.end.getTime() > last.end.getTime()) last.end = it.end;
                  return;
                }
                merged.push({ start: it.start, end: it.end });
              });

              const gaps: Array<{ start: Date; end: Date }> = [];
              let cursor = start;
              merged.forEach((it) => {
                if (it.start.getTime() > cursor.getTime()) gaps.push({ start: cursor, end: it.start });
                if (it.end.getTime() > cursor.getTime()) cursor = it.end;
              });
              if (end.getTime() > cursor.getTime()) gaps.push({ start: cursor, end });
              return gaps;
            })();

            const insufficientDays = insufficientRanges.reduce((acc, r) => acc + diffDaysCeil(r.start, r.end), 0);
            const insufficientLabel = (() => {
              if (!effectivePeriod.start || !effectivePeriod.end) return 'Não informado';
              if (insufficientDays <= 0) return '—';
              const totalLabel = daysToMonthsDaysLabel(insufficientDays);
              const shown = insufficientRanges.slice(0, 3);
              const rangesLabel = shown
                .map((r) => `${formatDateBRFromDate(r.start)} a ${formatDateBRFromDate(r.end)}`)
                .join(' | ');
              const suffix = insufficientRanges.length > shown.length ? ` | +${insufficientRanges.length - shown.length}` : '';
              return `${totalLabel}: ${rangesLabel}${suffix}`;
            })();

            const usedDefault = sortedDeliveries.some((d) => getLifeDaysFor(equipment, String(d.ca || '').trim()) == null);
            const basis = buildBasisLabel(equipment, usedDefault);
            const status = insufficientDays > 0 ? 'Insuficiente' : 'Suficiente';

            return {
              EPI: buildEquipmentLabel(equipment, sortedDeliveries),
              Entregas: String(deliveriesInPeriod.length),
              "Intervalo entre entregas": intervalLabel,
              "Período insuficiente (insalubre)": insufficientLabel,
              "Avaliação": status,
              Base: basis,
            };
          })
          .sort((a, b) => String(a.EPI).localeCompare(String(b.EPI)));

        if (deliveryEvaluation.length) {
          cursorY += 12;
          addText('Avaliação automática da periodicidade de entrega', 12, true);
          cursorY += 8;
          if (effectivePeriod.label) {
            addParagraphJustified(`Período considerado: ${effectivePeriod.label}`, 11);
            cursorY += 8;
          }
          const headers4 = ['EPI', 'Entregas', 'Intervalo entre entregas', 'Período insuficiente (insalubre)', 'Avaliação', 'Base'];
          drawCenteredTable(headers4, deliveryEvaluation as any, [0.2, 0.1, 0.17, 0.31, 0.12, 0.1]);
        }

        cursorY += 12;
        addText('Gestão de EPI', 12, true);
        cursorY += 8;
        {
          const trainingEvidenceLabel = (trainingAudit as any)?.training_evidence === true ? 'Sim' : (trainingAudit as any)?.training_evidence === false ? 'Não' : 'Não informado';
          const caCertificateLabel = (trainingAudit as any)?.ca_certificate === true ? 'Sim' : (trainingAudit as any)?.ca_certificate === false ? 'Não' : 'Não informado';
          const inspectionLabel = (trainingAudit as any)?.inspection === true ? 'Sim' : (trainingAudit as any)?.inspection === false ? 'Não' : 'Não informado';
          const trainingObs = String((trainingAudit as any)?.training_observation || '').trim();
          const inspectionObs = String((trainingAudit as any)?.inspection_observation || '').trim();
          addParagraphJustified(`Apresentada evidências de treinamento: ${trainingEvidenceLabel}`, 11);
          cursorY += 8;
          if (trainingObs) {
            addParagraphJustified(`Observação: ${trainingObs}`, 11);
            cursorY += 8;
          }
          addParagraphJustified(`Os equipamentos possuem certificado de aprovação: ${caCertificateLabel}`, 11);
          cursorY += 8;
          addParagraphJustified(`Fiscalização: ${inspectionLabel}`, 11);
          cursorY += 8;
          if (inspectionObs) {
            addParagraphJustified(`Observação: ${inspectionObs}`, 11);
            cursorY += 8;
          }
        }
      }
    }
    cursorY += 20;

    // 14 - Equipamentos de Proteção Coletiva
    addText("14. EQUIPAMENTOS DE PROTEÇÃO COLETIVA", 14, true);
    cursorY += 10;
    {
      const description = String((process as any).collective_protection || '').trim();
      const epcsRaw = String(((process as any).epcs || (process as any).epc || '')).trim();

      const items: string[] = [];
      const gatherFrom = [epcsRaw, description];
      gatherFrom.forEach((txt) => {
        if (!txt) return;
        const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let inSelectedBlock = false;
        lines.forEach((l) => {
          if (/EPCs selecionados:/i.test(l)) { inSelectedBlock = true; return; }
          const m = l.match(/^[-•]\s*(.+)$/);
          // Aceita bullets dentro do bloco "EPCs selecionados:" e também bullets isolados
          if ((inSelectedBlock && m) || m) items.push(m[1].trim());
        });
      });

      if (!items.length) {
        const single = epcsRaw || description || '';
        if (single) items.push(single);
      }

      const headers = ["EPC"];
      const rows: Array<{ [key: string]: string }> = items.length
        ? items.map((it) => ({ EPC: String(it) }))
        : [{ EPC: 'Não informado' }];
      drawCenteredTable(headers, rows, [1]);
    }
    cursorY += 20;

    // 15 - Análise das exposições à insalubridade
    const insalubrity = (process as any).insalubrity_analysis || (process as any).analise_insalubridade || "Não informado";
    {
      const parseRows = (text: string) => {
        const rows: { annex: string; agent: string; exposure: string; obs: string }[] = [];
        const lines = String(text || "").split(/\r?\n/);
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          let m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*?)\s*\|\s*Exposição:\s*(.*?)\s*\|\s*Obs:\s*(.*)$/);
          if (m) {
            rows.push({ annex: m[1], agent: m[2].trim(), exposure: (m[3] || "").trim(), obs: (m[4] || "").trim() });
            continue;
          }
          m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*?)\s*\((.*?)\)\s*(\[(.*)\])?$/);
          if (m) {
            let obs = (m[5] || "").trim();
            if (/LLM\s+não\s+configurada|LLM\s+indisponível/i.test(obs)) obs = "";
            rows.push({ annex: m[1], agent: m[2].trim(), exposure: (m[3] || "").trim(), obs });
            continue;
          }
          m = line.match(/^[-•]\s*Anexo\s*(\d+)\s*[—-]\s*(.*)$/);
          if (m) {
            rows.push({ annex: m[1], agent: m[2].trim(), exposure: "", obs: "" });
            continue;
          }
        }
        return rows;
      };
      const parseRc = (rc: any) => {
        try {
          return typeof rc === "string" ? JSON.parse(rc || "{}") : (rc || {});
        } catch {
          return {};
        }
      };
      const rc = parseRc((process as any).report_config);
      const tables = rc?.analysis_tables || {};
      const flags = rc?.flags || {};
      const nr15Tables = Array.isArray(tables?.nr15) ? tables.nr15 : [];
      const nr16Tables = Array.isArray(tables?.nr16) ? tables.nr16 : [];

      const normalizeExposure = (v: any) => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const autoShowNR15 = nr15Tables.some((r: any) => {
        const exp = normalizeExposure(r?.exposure);
        return exp === "em analise" || exp === "ocorre exposicao";
      });
      const autoShowNR16 = nr16Tables.some((r: any) => {
        const exp = normalizeExposure(r?.exposure);
        return exp === "em analise" || exp === "ocorre exposicao";
      });

      const showNR15 = !!flags?.include_nr15_item15_table || autoShowNR15;
      const showNR16 = !!flags?.include_nr16_item15_table || autoShowNR16;
      const insaRows = nr15Tables.length ? nr15Tables.map((r: any) => ({ annex: String(r.annex), agent: String(r.agent), exposure: String(r.exposure || ""), obs: String(r.obs || "") })) : parseRows(String(insalubrity));
      const pericuText = String((process as any).periculosity_analysis || "").trim();
      const pericuRows = nr16Tables.length ? nr16Tables.map((r: any) => ({ annex: String(r.annex), agent: String(r.agent), exposure: String(r.exposure || ""), obs: String(r.obs || "") })) : parseRows(pericuText);
      const hasNR15 = includeInsalubridade && showNR15 && insaRows.length > 0;
      const hasNR16 = includePericulosidade && showNR16 && pericuRows.length > 0;
      const sectionTitle = includeInsalubridade && includePericulosidade
        ? "15. ANÁLISES DAS EXPOSIÇÕES À INSALUBRIDADE E PERICULOSIDADE"
        : includePericulosidade && !includeInsalubridade
          ? "15. ANÁLISE DA EXPOSIÇÃO À PERICULOSIDADE"
          : "15. ANÁLISE DAS EXPOSIÇÕES À INSALUBRIDADE";
      addText(sectionTitle, 14, true);
      cursorY += 10;
      const headers = ["Anexo", "Agente", "Exposição", "Obs"];
      if (hasNR15) {
        addText("Tabela NR-15 (Anexos e Exposição)", 13, true);
        cursorY += 10;
        const rows15 = insaRows.map((r) => ({
          Anexo: `Anexo ${r.annex}`,
          Agente: r.agent,
          Exposição: r.exposure,
          Obs: r.obs || "----------",
        }));
        drawCenteredTable(headers, rows15, [0.15, 0.35, 0.25, 0.25]);
        cursorY += 20;
      }
      if (hasNR16) {
        addText("Tabela NR-16 (Anexos e Exposição)", 13, true);
        cursorY += 10;
        const rows16 = pericuRows.map((r) => ({
          Anexo: `Anexo ${r.annex}`,
          Agente: r.agent,
          Exposição: r.exposure,
          Obs: r.obs || "----------",
        }));
        drawCenteredTable(headers, rows16, [0.15, 0.35, 0.25, 0.25]);
      }
      if (!hasNR15 && !hasNR16) {
        const baseText = includePericulosidade && !includeInsalubridade ? pericuText : insalubrity;
        addParagraphSmartJustified(String(baseText), 12);
      }
    }
    cursorY += 20;

    if (includeInsalubridade && insalubrityResultsNumber != null) {
      addText(`${insalubrityResultsNumber}. RESULTADOS DAS AVALIAÇÕES REFERENTES À INSALUBRIDADE`, 14, true);
      cursorY += 10;
      const insalubrityResults =
        (process as any).insalubrity_results || (process as any).insalubridade_resultados || "Não informado";
      addAnnexResultsWithThemeBox(String(insalubrityResults), 12);
      cursorY += 10;

      try {
        const imgs = Array.isArray((rcQ as any)?.item16_images) ? (rcQ as any).item16_images : [];
        const legacyUrl = String((rcQ as any)?.item16_imageDataUrl || '').trim();
        const legacyCaption = String((rcQ as any)?.item16_imageCaption || '').trim();
        const list = (imgs.length ? imgs : (legacyUrl ? [{ dataUrl: legacyUrl, caption: legacyCaption }] : []))
          .map((x: any) => ({ dataUrl: String(x?.dataUrl || '').trim(), caption: String(x?.caption || '').trim() }))
          .filter((x: any) => x.dataUrl && x.dataUrl.length > 20);

        if (list.length > 0) {
          const gap = 14;
          const colW = Math.floor((contentWidth - gap) / 2);
          const maxW = Math.min(colW, 240);
          let colIndex = 0;
          let rowMaxH = 0;
          let rowStartY = cursorY;

          const renderCell = async (p: any, x: number) => {
            let cellH = 0;
            try {
              const normalized = await normalizeDataUrlToPng(p.dataUrl);
              const w = maxW;
              const h = normalized.naturalWidth && normalized.naturalHeight
                ? Math.round(w * (normalized.naturalHeight / normalized.naturalWidth))
                : Math.round(w * 0.6);
              const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
              if (rowStartY + h + 40 > pageHeight - reservedBottom) {
                addPage();
                rowStartY = cursorY;
              }
              doc.addImage(normalized.dataUrl, 'PNG', x, rowStartY, w, h);
              cellH += h;
              const caption = String(p.caption || '').trim();
              if (caption) {
                const lines = doc.splitTextToSize(caption, w);
                let ty = rowStartY + h + 12;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                lines.forEach((ln: string) => {
                  doc.text(ln, x, ty);
                  ty += 12;
                  cellH += 12;
                });
              }
            } catch {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              doc.text('Imagem não disponível', x, rowStartY + 12);
              cellH += 24;
            }
            rowMaxH = Math.max(rowMaxH, cellH + 24);
          };

          for (let i = 0; i < list.length; i++) {
            if (colIndex === 0) {
              rowMaxH = 0;
              rowStartY = cursorY;
            }
            const x = marginLeft + colIndex * (maxW + gap);
            await renderCell(list[i], x);
            colIndex = (colIndex + 1) % 2;
            if (colIndex === 0 || i === list.length - 1) {
              cursorY = rowStartY + rowMaxH + 10;
            }
          }
        }
      } catch {}

      cursorY += 10;
    }

    if (includePericulosidade) {
      addText(`${periculosityConceptNumber}. CONCEITO DE PERICULOSIDADE`, 14, true);
      cursorY += 10;
      const periculosityDef =
        (process as any).periculosity_concept || (process as any).conceito_periculosidade || "Não informado";
      addParagraphSmartJustified(String(periculosityDef), 12);
      cursorY += 20;

      addText(`${flammableDefinitionNumber}. DEFINIÇÃO DE PRODUTOS INFLAMÁVEIS`, 14, true);
      cursorY += 10;
      const flammableRaw =
        (process as any).flammable_definition || (process as any).definicao_produtos_inflamaveis || "Não informado";
      const sanitizeFlammableSimple = (t: string) => {
        let s = String(t || "");
        s = s.replace(/[“”"]/g, "");
        s = s.replace(/&/g, "");
        s = s.replace(/\s*°\s*([Cc])/g, "°$1");
        s = s.replace(/\s+/g, " ").trim();
        return s;
      };
      addParagraphJustified(sanitizeFlammableSimple(flammableRaw), 12);
      cursorY += 20;

      addText(`${periculosityResultsNumber}. RESULTADOS DAS AVALIAÇÕES REFERENTES À PERICULOSIDADE`, 14, true);
      cursorY += 10;
      const periculosityResults =
        (process as any).periculosity_results || (process as any).resultados_periculosidade || "Não informado";
      addParagraphSmartJustified(fixGrammar(String(periculosityResults)), 12);
      cursorY += 10;

      try {
        const imgs = Array.isArray((rcQ as any)?.item19_images) ? (rcQ as any).item19_images : [];
        const legacyUrl = String((rcQ as any)?.item19_imageDataUrl || '').trim();
        const legacyCaption = String((rcQ as any)?.item19_imageCaption || '').trim();
        const list = (imgs.length ? imgs : (legacyUrl ? [{ dataUrl: legacyUrl, caption: legacyCaption }] : []))
          .map((x: any) => ({ dataUrl: String(x?.dataUrl || '').trim(), caption: String(x?.caption || '').trim() }))
          .filter((x: any) => x.dataUrl && x.dataUrl.length > 20);

        if (list.length > 0) {
          const gap = 14;
          const colW = Math.floor((contentWidth - gap) / 2);
          const maxW = Math.min(colW, 240);
          let colIndex = 0;
          let rowMaxH = 0;
          let rowStartY = cursorY;

          const renderCell = async (p: any, x: number) => {
            let cellH = 0;
            try {
              const normalized = await normalizeDataUrlToPng(p.dataUrl);
              const w = maxW;
              const h = normalized.naturalWidth && normalized.naturalHeight
                ? Math.round(w * (normalized.naturalHeight / normalized.naturalWidth))
                : Math.round(w * 0.6);
              const reservedBottom = footerImageData ? ((footerH || 40) + footerGap) : 100;
              if (rowStartY + h + 40 > pageHeight - reservedBottom) {
                addPage();
                rowStartY = cursorY;
              }
              doc.addImage(normalized.dataUrl, 'PNG', x, rowStartY, w, h);
              cellH += h;
              const caption = String(p.caption || '').trim();
              if (caption) {
                const lines = doc.splitTextToSize(caption, w);
                let ty = rowStartY + h + 12;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                lines.forEach((ln: string) => {
                  doc.text(ln, x, ty);
                  ty += 12;
                  cellH += 12;
                });
              }
            } catch {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              doc.text('Imagem não disponível', x, rowStartY + 12);
              cellH += 24;
            }
            rowMaxH = Math.max(rowMaxH, cellH + 24);
          };

          for (let i = 0; i < list.length; i++) {
            if (colIndex === 0) {
              rowMaxH = 0;
              rowStartY = cursorY;
            }
            const x = marginLeft + colIndex * (maxW + gap);
            await renderCell(list[i], x);
            colIndex = (colIndex + 1) % 2;
            if (colIndex === 0 || i === list.length - 1) {
              cursorY = rowStartY + rowMaxH + 10;
            }
          }
        }
      } catch {}

      cursorY += 10;
    }

    // 20 - Quesitos da Perícia: imprimir somente se houver conteúdo
    if (hasClaimant || hasDefendant || hasJudge) {
      addText(`${quesitosNumber}. QUESITOS DA PERÍCIA`, 14, true);
      cursorY += 10;

      if (hasClaimant) {
        addText(`${quesitosNumber}.1 QUESITOS DA RECLAMANTE`, 13, true);
        cursorY += 10;
        if (claimantText) {
          claimantText.split(/\r?\n/).forEach((line: string, idx: number) => addQuesitoLineJustified(line, idx + 1, 12));
        } else if (Array.isArray(claimantQuesitos) && claimantQuesitos.length) {
          claimantQuesitos.forEach((q: any, idx: number) => {
            const pergunta = q?.question || q?.pergunta || q;
            addQuesitoLineJustified(String(pergunta), idx + 1, 12);
          });
        }
        cursorY += 20;
      }

      if (hasDefendant) {
        addText(`${quesitosNumber}.2 QUESITOS DA RECLAMADA`, 13, true);
        cursorY += 10;
        if (defendantQuesitosText) {
          defendantQuesitosText.split(/\r?\n/).forEach((line: string, idx: number) => addQuesitoLineJustified(line, idx + 1, 12));
        } else if (Array.isArray(respondentQuesitos) && respondentQuesitos.length) {
          respondentQuesitos.forEach((q: any, idx: number) => {
            const pergunta = q?.question || q?.pergunta || q;
            addQuesitoLineJustified(String(pergunta), idx + 1, 12);
          });
        }
        cursorY += 20;
      }

      if (hasJudge) {
        addText(`${quesitosNumber}.3 QUESITOS DO JUÍZ(A)`, 13, true);
        cursorY += 10;
        if (judgeText) {
          judgeText.split(/\r?\n/).forEach((line: string, idx: number) => addQuesitoLineJustified(line, idx + 1, 12));
        } else if (Array.isArray(judgeQuesitos) && judgeQuesitos.length) {
          judgeQuesitos.forEach((q: any, idx: number) => {
            const pergunta = q?.question || q?.pergunta || q;
            addQuesitoLineJustified(String(pergunta), idx + 1, 12);
          });
        }
        cursorY += 20;
      }
    } else {
    }

    // 21 - Conclusão (apenas dados informados)
    addText(`${conclusaoNumber}. CONCLUSÃO`, 14, true);
    cursorY += 10;
    const conclusion = String((process as any).conclusion || (process as any).conclusao || "Considerando a visita pericial realizada, as informações obtidas, os fatos observados e as análises efetuadas, conclui-se, que as atividades desempenhadas pelo(a) reclamante, foram:");
    addParagraphSmartJustified(conclusion, 12);
    
    

    // Rodapé final
    cursorY += 50;
    addText(`Diadema, ${currentDate}`, 12, false, 'center');
    if (signatureImageData) {
      let sigW = signatureW || Math.min(300, contentWidth);
      if (sigW > contentWidth) sigW = contentWidth;
      const sigH = signatureH || 60;
      let x = marginLeft + (contentWidth - sigW) / 2;
      if (signatureAlign === 'left') x = marginLeft;
      if (signatureAlign === 'right') x = marginLeft + contentWidth - sigW;
      const y = cursorY + 20;
      doc.addImage(signatureImageData, signatureImageFormat, x, y, sigW, sigH);
      cursorY += sigH + 10;
    }
    cursorY += 10;
    addText("_________________________________", 12, false, 'center');
    addText(`${peritoName}`, 12, true, 'center');
    addText(`${professionalTitle}`, 12, false, 'center');
    addText(`${registrationNumber}`, 12, false, 'center');
    cursorY += 40;

    const fillTocPageNumbers = () => {
      const xRight = pageWidth - marginRight;
      tocNumberSlots.forEach((slot) => {
        const pageNumber = tocPages.get(slot.title);
        if (!pageNumber) return;
        doc.setPage(slot.pageIndex);
        doc.setFontSize(slot.fontSize);
        doc.setFont("helvetica", "normal");
        const text = String(pageNumber);
        const w = doc.getTextWidth(text);
        doc.text(text, xRight - w, slot.y);
      });
    };
    fillTocPageNumbers();
    

    // Salvar PDF
    const filename = buildReportFilename(process, 'pdf');
    if (options?.returnUrl) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      return url;
    }
    doc.save(filename);
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    throw new Error("Falha na exportação do PDF");
  }
}
function createQuestionnairesSection(process: ProcessData, sectionNumber: number) {
  const parseRc = (rc: any) => { try { return typeof rc === 'string' ? JSON.parse(rc || '{}') : (rc || {}); } catch { return {}; } };
  const rc = parseRc((process as any).report_config);
  const q = rc?.questionnaires || {};
  const claimantText = String(q?.claimantText || '').trim();
  const defendantQuesitosText = String(q?.defendantText || '').trim();
  const judgeText = String(q?.judgeText || '').trim();
  const claimantQ = (process as any).claimant_questions || (process as any).quesitos_reclamante;
  const defendantQ = (process as any).respondent_questions || (process as any).quesitos_reclamada;
  const judgeQ = (process as any).judge_questions || (process as any).quesitos_juiz;
  const hasClaimant = !!claimantText || (Array.isArray(claimantQ) && claimantQ.length > 0);
  const hasDefendant = !!defendantQuesitosText || (Array.isArray(defendantQ) && defendantQ.length > 0);
  const hasJudge = !!judgeText || (Array.isArray(judgeQ) && judgeQ.length > 0);
  
  // Debug log para verificar os dados dos quesitos na função DOCX
  console.log("[DEBUG Quesitos DOCX] report_config:", rc);
  console.log("[DEBUG Quesitos DOCX] questionnaires:", q);
  console.log("[DEBUG Quesitos DOCX] defendantQuesitosText:", defendantQuesitosText);
  console.log("[DEBUG Quesitos DOCX] defendantQ:", defendantQ);
  console.log("[DEBUG Quesitos DOCX] hasDefendant:", hasDefendant);

  const blocks: Paragraph[] = [];
  blocks.push(new Paragraph({ children: [ new TextRun({ text: `${sectionNumber}. QUESITOS DA PERÍCIA`, bold: true, size: 28 }) ], heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));

  const sanitize = (t: string) => {
    let s = String(t || "");
    s = s.replace(/[“”"]/g, "");
    s = s.replace(/–/g, "-");
    s = s.replace(/[\t\u00A0]/g, " ");
    s = s.replace(/[\s]+/g, " ").trim();
    return s;
  };

  const buildQuesitoParagraph = (num: number, body: string) => {
    const prefix = `${num})`;
    const cleanBody = sanitize(body);
    const tabPos = 720;
    return new Paragraph({
      children: [ new TextRun({ text: `${prefix}\t${cleanBody}`, size: 24 }) ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: 360 },
      tabStops: [ { type: TabStopType.LEFT, position: tabPos } ],
    });
  };

  const parseLine = (raw: string, fallbackIndex: number) => {
    const s = sanitize(raw);
    const m = s.match(/^\s*(\d+)\s*[\)\.\-:]\s*(.*)$/);
    if (m) return { num: parseInt(m[1], 10) || fallbackIndex, body: m[2] || "" };
    return { num: fallbackIndex, body: s };
  };

  const pushLines = (title: string, text: string, fallback?: any[]) => {
    blocks.push(new Paragraph({ children: [ new TextRun({ text: title, bold: true, size: 28 }) ], spacing: { before: 200, after: 100 } }));
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length) {
      lines.forEach((line, idx) => {
        const { num, body } = parseLine(line, idx + 1);
        blocks.push(buildQuesitoParagraph(num, body));
      });
    } else if (Array.isArray(fallback) && fallback.length) {
      fallback.forEach((q: any, idx: number) => {
        const pergunta = String(q?.question || q?.pergunta || q);
        const { num, body } = parseLine(pergunta, idx + 1);
        blocks.push(buildQuesitoParagraph(num, body));
      });
    } else {
      blocks.push(new Paragraph({ children: [ new TextRun({ text: 'Não informado', size: 24 }) ] }));
    }
  };

  pushLines(`${sectionNumber}.1 QUESITOS DA RECLAMANTE`, claimantText, claimantQ);
  pushLines(`${sectionNumber}.2 QUESITOS DA RECLAMADA`, defendantQuesitosText, defendantQ);
  pushLines(`${sectionNumber}.3 QUESITOS DO JUÍZ(A)`, judgeText, judgeQ);

  return blocks;
}
