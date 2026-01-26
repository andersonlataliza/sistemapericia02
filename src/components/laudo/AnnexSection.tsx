import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import FileUpload from "@/components/storage/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { Download, Eye, Plus, Trash2 } from "lucide-react";

type Item22Annex = {
  id: string;
  filePath: string;
  fileName: string;
  displayName?: string;
  source?: "upload" | "material";
  includeInPrint?: boolean;
};

type MaterialDoc = {
  id: string;
  theme: string;
  fileName: string;
  displayName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
};

const extractDisplayName = (fileName: string) => {
  const base = String(fileName || "").replace(/\.[^/.]+$/, "");
  return base.replace(/[_-]+/g, " ").trim() || fileName;
};

interface AnnexSectionProps {
  processId: string;
  targetUserId: string;
  value: Item22Annex[];
  onChange: (next: Item22Annex[]) => void;
  readOnly?: boolean;
}

export default function AnnexSection({ processId, targetUserId, value, onChange, readOnly }: AnnexSectionProps) {
  const { toast } = useToast();
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [, setMaterialOwnerId] = useState<string | null>(null);
  const [materialDocs, setMaterialDocs] = useState<MaterialDoc[]>([]);
  const [materialQuery, setMaterialQuery] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Record<string, boolean>>({});

  const normalized = useMemo(() => {
    const list = Array.isArray(value) ? value : [];
    return list.map((a) => ({
      id: String(a?.id || a?.filePath || `${Date.now()}_${Math.random()}`),
      filePath: String(a?.filePath || ""),
      fileName: String(a?.fileName || ""),
      displayName: String(a?.displayName || "").trim() || undefined,
      source: a?.source === "material" || a?.source === "upload" ? a.source : undefined,
      includeInPrint: !!a?.includeInPrint,
    })) as Item22Annex[];
  }, [value]);

  const upsertAnnexes = useCallback(
    (items: Item22Annex[]) => {
      const map = new Map<string, Item22Annex>();
      items.forEach((a) => {
        const key = String(a.filePath || a.id || "").trim();
        if (!key) return;
        map.set(key, a);
      });
      onChange(Array.from(map.values()));
    },
    [onChange],
  );

  const preview = useCallback(
    async (a: Item22Annex) => {
      try {
        const { data, error } = await supabase.storage.from("process-documents").createSignedUrl(a.filePath, 3600);
        if (error) throw error;
        window.open(data.signedUrl, "_blank");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erro ao visualizar";
        toast({ title: "Erro", description: message, variant: "destructive" });
      }
    },
    [toast],
  );

  const download = useCallback(
    async (a: Item22Annex) => {
      try {
        const { data, error } = await supabase.storage.from("process-documents").download(a.filePath);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = a.fileName || "anexo.pdf";
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erro ao baixar";
        toast({ title: "Erro", description: message, variant: "destructive" });
      }
    },
    [toast],
  );

  const remove = (a: Item22Annex) => {
    const key = String(a.filePath || a.id).trim();
    const next = normalized.filter((x) => String(x.filePath || x.id).trim() !== key);
    onChange(next);
  };

  const toggleInclude = (a: Item22Annex, checked: boolean) => {
    const key = String(a.filePath || a.id).trim();
    const next = normalized.map((x) => (String(x.filePath || x.id).trim() === key ? { ...x, includeInPrint: checked } : x));
    onChange(next);
  };

  const fetchMaterialDocs = useCallback(async () => {
    setMaterialLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Usuário não autenticado");

      const userId = userRes.user.id;
      const userMetadata = (userRes.user as any)?.user_metadata;
      const ownerId = await (async () => {
        const metaOwner = typeof userMetadata?.linked_owner_id === "string" ? String(userMetadata.linked_owner_id) : "";
        try {
          const { data, error } = await supabase
            .from("linked_users")
            .select("owner_user_id")
            .eq("auth_user_id", userId)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
          if (!error && data?.owner_user_id) return String(data.owner_user_id);
        } catch {
        }
        return metaOwner || userId;
      })();

      setMaterialOwnerId(ownerId);
      const root = `${ownerId}/material-consulta`;

      const { data: themeEntries, error: themesErr } = await supabase.storage.from("process-documents").list(root, {
        limit: 200,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

      if (themesErr) {
        const msg = String((themesErr as any)?.message || "");
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("does not exist")) {
          setMaterialDocs([]);
          return;
        }
        throw themesErr;
      }

      const themeNames = (themeEntries || []).map((x) => x.name).filter(Boolean);
      const perTheme = await Promise.all(
        themeNames.map(async (t) => {
          const { data: files, error } = await supabase.storage.from("process-documents").list(`${root}/${t}`, {
            limit: 500,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
          });
          if (error) return { theme: t, files: [] as any[] };
          return { theme: t, files: files || [] };
        }),
      );

      const next: MaterialDoc[] = perTheme.flatMap(({ theme, files }) => {
        return (files || [])
          .filter((f: any) => Boolean(f?.metadata))
          .map((f: any) => {
            const fileName = String(f.name || "");
            const filePath = `${root}/${theme}/${fileName}`;
            return {
              id: filePath,
              theme,
              fileName,
              displayName: extractDisplayName(fileName),
              filePath,
              fileSize: Number(f?.metadata?.size || 0),
              fileType: String(f?.metadata?.mimetype || "application/octet-stream"),
              createdAt: String(f?.created_at || f?.updated_at || new Date().toISOString()),
            };
          });
      });

      const onlyPdf = next.filter((d) => {
        const t = String(d.fileType || "").toLowerCase();
        const name = String(d.fileName || "").toLowerCase();
        return t.includes("pdf") || name.endsWith(".pdf");
      });

      setMaterialDocs(onlyPdf);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar materiais";
      toast({ title: "Erro", description: message, variant: "destructive" });
      setMaterialDocs([]);
    } finally {
      setMaterialLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!materialOpen) return;
    fetchMaterialDocs();
  }, [fetchMaterialDocs, materialOpen]);

  const filteredMaterialDocs = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    if (!q) return materialDocs;
    return materialDocs.filter((d) => {
      return (
        String(d.displayName || "").toLowerCase().includes(q) ||
        String(d.fileName || "").toLowerCase().includes(q) ||
        String(d.theme || "").toLowerCase().includes(q)
      );
    });
  }, [materialDocs, materialQuery]);

  const addSelectedMaterial = () => {
    const ids = Object.keys(selectedMaterialIds).filter((k) => !!selectedMaterialIds[k]);
    if (!ids.length) {
      toast({ title: "Nada selecionado", description: "Selecione ao menos um PDF." });
      return;
    }
    const picked = materialDocs.filter((d) => ids.includes(d.id));
    const next = [
      ...normalized,
      ...picked.map((d) => ({
        id: d.filePath,
        filePath: d.filePath,
        fileName: d.fileName,
        displayName: d.displayName,
        source: "material" as const,
        includeInPrint: false,
      })),
    ];
    upsertAnnexes(next);
    setSelectedMaterialIds({});
    setMaterialOpen(false);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>22. Anexo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Anexar PDF (upload)</Label>
              <FileUpload
                bucketName="process-documents"
                processId={processId}
                targetUserId={targetUserId}
                acceptedFileTypes={["application/pdf"]}
                maxFileSize={50 * 1024 * 1024}
                multiple={true}
                enableTextExtraction={false}
                onUploadComplete={(filePath, fileName) => {
                  const next = [
                    ...normalized,
                    {
                      id: filePath,
                      filePath,
                      fileName,
                      displayName: extractDisplayName(fileName),
                      source: "upload" as const,
                      includeInPrint: false,
                    },
                  ];
                  upsertAnnexes(next);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Selecionar do Material de Consulta</Label>
              <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full" disabled={readOnly}>
                    <Plus className="w-4 h-4 mr-2" /> Adicionar do Material Consulta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Material de Consulta (PDF)</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <Label htmlFor="material-query">Pesquisar</Label>
                        <Input
                          id="material-query"
                          value={materialQuery}
                          onChange={(e) => setMaterialQuery(e.target.value)}
                          placeholder="Nome, tema, arquivo..."
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {materialLoading ? "Carregando..." : `${filteredMaterialDocs.length} arquivo(s)`}
                      </div>
                    </div>

                    <ScrollArea className="h-[420px] border rounded">
                      <div className="p-2 space-y-1">
                        {filteredMaterialDocs.map((d) => {
                          const checked = !!selectedMaterialIds[d.id];
                          return (
                            <div key={d.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted/40">
                              <div className="flex items-start gap-3 min-w-0">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    const next = { ...selectedMaterialIds };
                                    next[d.id] = v === true;
                                    setSelectedMaterialIds(next);
                                  }}
                                  disabled={materialLoading}
                                />
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{d.displayName}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {d.theme} • {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    try {
                                      const { data, error } = await supabase.storage
                                        .from("process-documents")
                                        .createSignedUrl(d.filePath, 3600);
                                      if (error) throw error;
                                      window.open(data.signedUrl, "_blank");
                                    } catch (e) {
                                      const message = e instanceof Error ? e.message : "Erro ao visualizar";
                                      toast({ title: "Erro", description: message, variant: "destructive" });
                                    }
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {!materialLoading && filteredMaterialDocs.length === 0 && (
                          <div className="text-sm text-muted-foreground p-2">Nenhum PDF encontrado</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMaterialOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={addSelectedMaterial} disabled={materialLoading}>
                      Adicionar selecionados
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Arquivos anexados</div>
            <div className="text-xs text-muted-foreground">
              {normalized.length} item(ns)
            </div>
          </div>
          <div className="border rounded">
            <ScrollArea className="h-[280px]">
              <div className="p-2 space-y-2">
                {normalized.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/40">
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium truncate">{a.displayName || a.fileName || "Arquivo"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{a.fileName}</span>
                        <span>•</span>
                        <span>{a.source === "material" ? "Material Consulta" : a.source === "upload" ? "Upload" : "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!a.includeInPrint}
                          onCheckedChange={(v) => toggleInclude(a, v === true)}
                          disabled={readOnly}
                        />
                        <span className="text-sm">Anexar na impressão</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" size="sm" variant="outline" onClick={() => preview(a)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => download(a)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      {!readOnly && (
                        <Button type="button" size="sm" variant="destructive" onClick={() => remove(a)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {normalized.length === 0 && <div className="text-sm text-muted-foreground p-2">Nenhum anexo</div>}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
