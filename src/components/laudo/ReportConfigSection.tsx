import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, FileText, User, Mail } from "lucide-react";

export interface ReportConfig {
  header?: {
    peritoName?: string;
    professionalTitle?: string;
    registrationNumber?: string;
    customText?: string;
    imageDataUrl?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageAlign?: 'left' | 'center' | 'right';
    fillPage?: boolean;
    spacingBelow?: number;
  };
  footer?: {
    contactEmail?: string;
    customText?: string;
    showPageNumbers?: boolean;
    imageDataUrl?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageAlign?: 'left' | 'center' | 'right';
    fillPage?: boolean;
  };
  signature?: {
    imageDataUrl?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageAlign?: 'left' | 'center' | 'right';
  };
  court_options?: string[];
}

interface ReportConfigSectionProps {
  value: ReportConfig;
  onChange: (config: ReportConfig) => void;
}

export default function ReportConfigSection({ value, onChange }: ReportConfigSectionProps) {
  const updateHeaderField = (field: string, fieldValue: any) => {
    onChange({
      ...value,
      header: {
        ...value.header,
        [field]: fieldValue,
      },
    });
  };

  const updateFooterField = (field: string, fieldValue: any) => {
    onChange({
      ...value,
      footer: {
        ...value.footer,
        [field]: fieldValue,
      },
    });
  };

  const resetToDefaults = () => {
    onChange({
      header: {
        peritoName: "PERITO JUDICIAL",
        professionalTitle: "ENGENHEIRO CIVIL",
        registrationNumber: "CREA",
        customText: "",
        imageDataUrl: "",
        imageUrl: "",
        fillPage: true,
        spacingBelow: 30,
      },
      footer: {
        contactEmail: "contato@perito.com.br",
        customText: "",
        showPageNumbers: true,
        imageDataUrl: "",
        imageUrl: "",
        imageWidth: 150,
        imageHeight: 40,
        imageAlign: 'left',
        fillPage: true,
      },
      signature: {
        imageDataUrl: "",
        imageUrl: "",
        imageWidth: 150,
        imageHeight: 40,
        imageAlign: 'center',
      }
    });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <CardTitle>Configuração do Relatório</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            Restaurar Padrões
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuração do Cabeçalho */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold">Cabeçalho do Relatório</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="peritoName">Nome do Perito</Label>
              <Input
                id="peritoName"
                value={value.header?.peritoName || ""}
                onChange={(e) => updateHeaderField("peritoName", e.target.value)}
                placeholder="Ex: João Silva"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="professionalTitle">Título Profissional</Label>
              <Input
                id="professionalTitle"
                value={value.header?.professionalTitle || ""}
                onChange={(e) => updateHeaderField("professionalTitle", e.target.value)}
                placeholder="Ex: Engenheiro Civil"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="registrationNumber">Registro Profissional</Label>
            <Input
              id="registrationNumber"
              value={value.header?.registrationNumber || ""}
              onChange={(e) => updateHeaderField("registrationNumber", e.target.value)}
              placeholder="Ex: CREA-SP 123456"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="headerCustomText">Texto Personalizado do Cabeçalho (opcional)</Label>
            <Textarea
              id="headerCustomText"
              value={value.header?.customText || ""}
              onChange={(e) => updateHeaderField("customText", e.target.value)}
              placeholder="Texto adicional que aparecerá no cabeçalho do relatório"
              className="min-h-[80px] mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se preenchido, este texto substituirá o cabeçalho padrão do relatório.
            </p>
          </div>

          {/* Imagem do Cabeçalho */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="headerImageFile">Upload da Imagem do Cabeçalho</Label>
              <Input
                id="headerImageFile"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = String(reader.result || "");
                    console.log('[UI DEBUG] Header image loaded, length:', dataUrl.length);
                    // Atualiza ambos os campos em uma única chamada para evitar perda por estado obsoleto
                    const nextHeader = {
                      ...(value.header || {}),
                      imageDataUrl: dataUrl,
                      imageUrl: "",
                    };
                    onChange({
                      ...value,
                      header: nextHeader,
                    });
                  };
                  reader.readAsDataURL(file);
                }}
                className="mt-1"
              />
               {value.header?.imageDataUrl && (
                 <div className="mt-2 flex items-center gap-2">
                   <span className="text-xs text-muted-foreground">Imagem carregada</span>
                   <Button variant="outline" size="sm" onClick={() => { updateHeaderField("imageDataUrl", ""); }}>
                     Remover imagem
                   </Button>
                 </div>
               )}
             </div>
             <div>
               <Label htmlFor="headerImageUrl">URL da Imagem do Cabeçalho</Label>
               <Input
                 id="headerImageUrl"
                 value={value.header?.imageUrl || ""}
                 onChange={(e) => updateHeaderField("imageUrl", e.target.value)}
                 placeholder="Ex: /logo.png"
                 className="mt-1"
               />
               {(value.header?.imageDataUrl || value.header?.imageUrl) && (
                 <div className="mt-2">
                   <img 
                     src={value.header.imageDataUrl || value.header.imageUrl} 
                     alt="Prévia do cabeçalho" 
                     className="max-h-16 w-auto rounded border"
                   />
                 </div>
               )}
             </div>
             <div>
               <Label htmlFor="headerImageWidth">Largura (pt)</Label>
               <Input
                 id="headerImageWidth"
                 type="number"
                 value={value.header?.imageWidth ?? 150}
                 onChange={(e) => updateHeaderField("imageWidth", Number(e.target.value) || 150)}
                 placeholder="150"
                 className="mt-1"
               />
            </div>
            <div>
              <Label htmlFor="headerImageAlign">Alinhamento</Label>
              <select
                id="headerImageAlign"
                className="mt-1 border rounded h-9 px-2 bg-background"
                value={value.header?.imageAlign || 'left'}
                onChange={(e) => updateHeaderField("imageAlign", e.target.value)}
              >
                <option value="left">Esquerda</option>
                <option value="center">Centralizado</option>
                <option value="right">Direita</option>
             </select>
           </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="headerFillPage"
                checked={value.header?.fillPage !== false}
                onChange={(e) => updateHeaderField("fillPage", e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="headerFillPage" className="text-sm">
                Preencher página (sem margem)
              </Label>
            </div>
            <div>
              <Label htmlFor="headerSpacingBelow">Espaçamento abaixo (pt)</Label>
              <Input
                id="headerSpacingBelow"
                type="number"
                value={value.header?.spacingBelow ?? 30}
                onChange={(e) => updateHeaderField("spacingBelow", Number(e.target.value) || 0)}
                placeholder="30"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Configuração do Rodapé */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold">Rodapé do Relatório</h3>
          </div>

          <div>
            <Label htmlFor="contactEmail">E-mail de Contato</Label>
            <Input
              id="contactEmail"
              type="email"
              value={value.footer?.contactEmail || ""}
              onChange={(e) => updateFooterField("contactEmail", e.target.value)}
              placeholder="Ex: contato@perito.com.br"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="footerCustomText">Texto Personalizado do Rodapé (opcional)</Label>
            <Textarea
              id="footerCustomText"
              value={value.footer?.customText || ""}
              onChange={(e) => updateFooterField("customText", e.target.value)}
              placeholder="Texto adicional que aparecerá no rodapé do relatório"
              className="min-h-[80px] mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se preenchido, este texto será adicionado ao rodapé junto com o e-mail de contato.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showPageNumbers"
              checked={value.footer?.showPageNumbers !== false}
              onChange={(e) => updateFooterField("showPageNumbers", e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="showPageNumbers" className="text-sm">
              Mostrar numeração de páginas
            </Label>
          </div>

          {/* Imagem do Rodapé (independente da assinatura) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="footerImageFile">Upload da Imagem do Rodapé</Label>
              <Input
                id="footerImageFile"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = String(reader.result || "");
                    const nextFooter = {
                      ...(value.footer || {}),
                      imageDataUrl: dataUrl,
                      imageUrl: "",
                    };
                    onChange({
                      ...value,
                      footer: nextFooter,
                    });
                  };
                  reader.readAsDataURL(file);
                }}
                className="mt-1"
              />
              {value.footer?.imageDataUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Imagem carregada</span>
                  <Button variant="outline" size="sm" onClick={() => { updateFooterField("imageDataUrl", ""); }}>
                    Remover imagem
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="footerImageUrl">URL da Imagem do Rodapé</Label>
              <Input
                id="footerImageUrl"
                value={value.footer?.imageUrl || ""}
                onChange={(e) => updateFooterField("imageUrl", e.target.value)}
                placeholder="Ex: /rodape.png"
                className="mt-1"
              />
              {(value.footer?.imageDataUrl || value.footer?.imageUrl) && (
                <div className="mt-2">
                  <img
                    src={value.footer?.imageDataUrl || value.footer?.imageUrl}
                    alt="Prévia do rodapé"
                    className="max-h-16 w-auto rounded border"
                  />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="footerImageWidth">Largura (pt)</Label>
              <Input
                id="footerImageWidth"
                type="number"
                value={value.footer?.imageWidth ?? 150}
                onChange={(e) => updateFooterField("imageWidth", Number(e.target.value) || 150)}
                placeholder="Ex: 150"
                className="mt-1"
              />
              <div className="mt-3">
                <Label htmlFor="footerImageAlign">Alinhamento</Label>
                <select
                  id="footerImageAlign"
                  className="mt-1 border rounded h-9 px-2 bg-background"
                  value={value.footer?.imageAlign || 'left'}
                  onChange={(e) => updateFooterField("imageAlign", e.target.value)}
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centralizado</option>
                  <option value="right">Direita</option>
                </select>
              </div>
              <div className="flex items-center space-x-2 mt-3">
                <input
                  type="checkbox"
                  id="footerFillPage"
                  checked={value.footer?.fillPage !== false}
                  onChange={(e) => updateFooterField("fillPage", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="footerFillPage" className="text-sm">
                  Preencher página (sem margem)
                </Label>
              </div>
            </div>
          </div>

          {/* Assinatura (independente de cabeçalho/rodapé) */}
          <Separator />
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-lg font-semibold">Assinatura do Perito (imagem no final do relatório)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="signatureImageFile">Upload da Assinatura</Label>
              <Input
                id="signatureImageFile"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = String(reader.result || "");
                    const nextSignature = { ...(value.signature || {}), imageDataUrl: dataUrl, imageUrl: "" };
                    onChange({ ...value, signature: nextSignature });
                  };
                  reader.readAsDataURL(file);
                }}
                className="mt-1"
              />
              {value.signature?.imageDataUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Imagem carregada</span>
                  <Button variant="outline" size="sm" onClick={() => { onChange({ ...value, signature: { ...(value.signature || {}), imageDataUrl: "" } }); }}>
                    Remover imagem
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="signatureImageUrl">URL da Assinatura</Label>
              <Input
                id="signatureImageUrl"
                value={value.signature?.imageUrl || ""}
                onChange={(e) => onChange({ ...value, signature: { ...(value.signature || {}), imageUrl: e.target.value } })}
                placeholder="Ex: /assinatura.png"
                className="mt-1"
              />
              {(value.signature?.imageDataUrl || value.signature?.imageUrl) && (
                <div className="mt-2">
                  <img src={value.signature?.imageDataUrl || value.signature?.imageUrl} alt="Prévia da assinatura" className="max-h-20 w-auto rounded border" />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="signatureImageWidth">Largura (pt)</Label>
              <Input
                id="signatureImageWidth"
                type="number"
                value={value.signature?.imageWidth ?? 150}
                onChange={(e) => onChange({ ...value, signature: { ...(value.signature || {}), imageWidth: Number(e.target.value) || 150 } })}
                placeholder="Ex: 150"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="signatureImageAlign">Alinhamento</Label>
              <select
                id="signatureImageAlign"
                className="mt-1 border rounded h-9 px-2 bg-background"
                value={value.signature?.imageAlign || 'center'}
                onChange={(e) => onChange({ ...value, signature: { ...(value.signature || {}), imageAlign: e.target.value as any } })}
              >
                <option value="left">Esquerda</option>
                <option value="center">Centralizado</option>
                <option value="right">Direita</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <div
                className="mt-2 p-3 rounded border bg-muted/30 text-xs"
                onPaste={async (e) => {
                  const items = e.clipboardData?.items || [];
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.type && it.type.startsWith("image/")) {
                      const file = it.getAsFile();
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = String(reader.result || "");
                          const nextSignature = { ...(value.signature || {}), imageDataUrl: dataUrl, imageUrl: "" };
                          onChange({ ...value, signature: nextSignature });
                        };
                        reader.readAsDataURL(file);
                      }
                      break;
                    }
                  }
                }}
              >
                Cole aqui a assinatura (Ctrl+V) ou envie o arquivo acima.
              </div>
            </div>
          </div>
        </div>

        {/* Prévia das Configurações */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-semibold mb-3">Prévia das Configurações</h4>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cabeçalho:</p>
              {value.header?.customText ? (
                <p className="text-sm bg-background p-2 rounded border">
                  {value.header.customText}
                </p>
              ) : (
                <div className="text-sm bg-background p-2 rounded border text-center">
                  <p className="font-bold">
                    {value.header?.peritoName || "PERITO JUDICIAL"}
                  </p>
                  <p>{value.header?.professionalTitle || "ENGENHEIRO CIVIL"}</p>
                  <p>{value.header?.registrationNumber || "CREA"}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Rodapé:</p>
              <div className="text-sm bg-background p-2 rounded border">
                <p>
                  Contato: {value.footer?.contactEmail || "contato@perito.com.br"}
                </p>
                {value.footer?.customText && (
                  <p className="mt-1">{value.footer.customText}</p>
                )}
                {value.footer?.showPageNumbers !== false && (
                  <p className="text-center mt-1 text-muted-foreground">
                    Página [número] de [total]
                  </p>
                )}
              </div>
            </div>
          </div>

          
        </div>
      </CardContent>
    </Card>
  );
}
