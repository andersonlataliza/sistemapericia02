import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type PhotoItem = {
  id: string;
  type: "url" | "storage";
  url?: string; // direct image url (e.g., Google Fotos)
  file_path?: string; // Supabase storage path
  signed_url?: string; // preview url for private buckets
  caption?: string;
};

interface PhotoRegisterSectionProps {
  processId: string;
  value: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
}

export default function PhotoRegisterSection({ processId, value, onChange }: PhotoRegisterSectionProps) {
  const [items, setItems] = useState<PhotoItem[]>(Array.isArray(value) ? value : []);
  const [addingUrl, setAddingUrl] = useState<string>("");
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [googleToken, setGoogleToken] = useState<string | undefined>(undefined);
  const [googlePhotos, setGooglePhotos] = useState<any[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedGoogle, setSelectedGoogle] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const ENV_GOOGLE_CLIENT_ID = (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const [clientIdInput, setClientIdInput] = useState<string>('');

  useEffect(() => {
    setItems(Array.isArray(value) ? value : []);
  }, [value]);

  const updateAndPropagate = (next: PhotoItem[]) => {
    setItems(next);
    onChange(next);
  };

  const isProbablyDirectImageUrl = (raw: string) => {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();

      if (host.includes("googleusercontent.com")) return true;
      if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)) return true;
      if (u.searchParams.has("raw")) return true;
      return false;
    } catch {
      return false;
    }
  };

  const shouldResolveUrl = (raw: string) => {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      if (host === "photos.app.goo.gl") return true;
      if (host.endsWith(".photos.app.goo.gl")) return true;
      if (host === "photos.google.com") return true;
      if (host.endsWith(".google.com") && u.pathname.toLowerCase().includes("/photos")) return true;
      return false;
    } catch {
      return false;
    }
  };

  const resolveUrlToDirectImage = async (raw: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("resolve-image-url", {
        body: { url: raw },
      });
      if (error) throw error;
      const resolved = (data as any)?.resolved_url || (data as any)?.resolvedUrl || (data as any)?.url;
      return typeof resolved === "string" && resolved.trim() ? resolved.trim() : raw;
    } catch {
      return raw;
    }
  };

  const addUrlItem = async () => {
    const raw = String(addingUrl || "").trim();
    if (!raw) return;

    setResolvingUrl(true);
    try {
      let url = raw;

      try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const pathname = u.pathname;
        if (host === "photos.google.com" && pathname.startsWith("/photo/")) {
          const idFromPath = pathname.split("/").filter(Boolean)[1];
          const photoId = typeof idFromPath === "string" ? idFromPath.trim() : "";
          if (!photoId) {
            toast({
              title: "Link do Google Fotos inválido",
              description: "Não foi possível identificar o ID da foto nesse link.",
              variant: "destructive",
            });
            return;
          }

          if (!googleToken) {
            toast({
              title: "Conecte o Google",
              description: "Esse tipo de link exige autenticação. Use Google Fotos (Conectar/Carregar) ou importe para o Storage.",
              variant: "destructive",
            });
            return;
          }

          const res = await fetch(`https://photoslibrary.googleapis.com/v1/mediaItems/${encodeURIComponent(photoId)}`, {
            headers: { Authorization: `Bearer ${googleToken}`, Accept: "application/json" },
          });

          if (!res.ok) {
            let msg = `Erro ${res.status}`;
            try {
              const body = await res.json();
              const em = body?.error?.message || body?.message || "";
              const es = body?.error?.status || body?.status || "";
              msg = [msg, es, em].filter(Boolean).join(" | ");
            } catch {
            }
            toast({
              title: "Não foi possível acessar a foto",
              description: msg,
              variant: "destructive",
            });
            return;
          }

          const data = await res.json();
          const baseUrl = String(data?.baseUrl || "").trim();
          const mimeType = String(data?.mimeType || "").trim();
          if (baseUrl && mimeType.startsWith("image/")) {
            url = `${baseUrl}=w1600`;
          } else {
            toast({
              title: "Link do Google Fotos não suportado",
              description: "Não foi possível obter a imagem por esse link. Use Google Fotos (Conectar/Carregar) ou importe para o Storage.",
              variant: "destructive",
            });
            return;
          }
        }
      } catch {
      }

      if (url === raw && !isProbablyDirectImageUrl(raw) && shouldResolveUrl(raw)) {
        url = await resolveUrlToDirectImage(raw);
      }

      if (!isProbablyDirectImageUrl(url) && shouldResolveUrl(raw)) {
        toast({
          title: "Link do Google Fotos não é direto",
          description: "Use a opção Google Fotos (Conectar/Carregar) ou copie o endereço direto da imagem.",
          variant: "destructive",
        });
        return;
      }

      const id = Math.random().toString(36).slice(2);
      const item: PhotoItem = { id, type: "url", url, caption: "" };
      const next = [...items, item];
      updateAndPropagate(next);
      setAddingUrl("");
    } finally {
      setResolvingUrl(false);
    }
  };

  const sanitizeName = (s: string) => s.replace(/[^a-zA-Z0-9.-]/g, "_");

  const compressImage = async (file: File, quality = 0.9): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;
    if (file.size < 700 * 1024) return file;

    const outputType = file.type.includes("png") ? "image/png" : "image/jpeg";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const outputName = outputType === "image/png" ? `${baseName}.png` : `${baseName}.jpg`;

    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");
    ctx.drawImage(bmp, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error("Falha ao compactar imagem"));
            return;
          }
          resolve(b);
        },
        outputType,
        outputType === "image/jpeg" ? quality : undefined,
      );
    });

    const out = new File([blob], outputName, { type: outputType });
    return out.size < file.size ? out : file;
  };

  const handleFiles = async (filesList: FileList | null) => {
    try {
      if (!filesList || filesList.length === 0) return;
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        toast({ title: "Sessão expirada", description: "Entre novamente para anexar fotos.", variant: "destructive" });
        return;
      }
      const formatErr = (e: any) => {
        try {
          const parts = [e?.name, e?.statusCode, e?.message, e?.error].filter(Boolean);
          return parts.join(" | ");
        } catch {
          return String(e);
        }
      };
      try {
        const prefix = `${user.id}/${processId}/photos`;
        const { error: accessErr } = await supabase.storage.from("process-documents").list(prefix, { limit: 1 });
        if (accessErr) {
          toast({ title: "Sem acesso ao Storage", description: formatErr(accessErr), variant: "destructive" });
          return;
        }
      } catch (preflightErr: any) {
        toast({ title: "Falha ao verificar acesso ao Storage", description: formatErr(preflightErr), variant: "destructive" });
        return;
      }
      const added: PhotoItem[] = [];
      for (const file of Array.from(filesList)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImage(file);
        const ts = Date.now();
        const path = `${user.id}/${processId}/photos/${ts}_${sanitizeName(compressed.name)}`;
        const { data, error } = await supabase.storage
          .from("process-documents")
          .upload(path, compressed, { cacheControl: "3600", upsert: false });
        if (error) {
          toast({ title: "Erro no upload", description: formatErr(error), variant: "destructive" });
          throw error;
        }
        try {
          await supabase.from("documents").insert({
            process_id: processId,
            name: compressed.name,
            file_path: data.path,
            file_size: compressed.size,
            file_type: compressed.type,
            category: "photo",
            description: null,
          });
        } catch {}
        let signed_url: string | undefined;
        try {
          const { data: sign } = await supabase.storage.from("process-documents").createSignedUrl(data.path, 60 * 60 * 24 * 7);
          signed_url = sign?.signedUrl;
        } catch (signErr: any) {
          toast({ title: "Falha ao gerar link", description: formatErr(signErr) });
        }
        added.push({ id: Math.random().toString(36).slice(2), type: "storage", file_path: data.path, signed_url, caption: "" });
      }
      if (added.length > 0) {
        updateAndPropagate([...items, ...added]);
        toast({ title: "Fotos anexadas", description: `${added.length} foto(s) enviada(s) com compressão.` });
      }
    } catch (err: any) {
      const d = err?.statusCode || err?.message ? `${err?.statusCode || ''} ${err?.message || ''}`.trim() : "Erro ao processar/imprimir imagens.";
      toast({ title: "Falha ao anexar fotos", description: d, variant: "destructive" });
    } finally {
      try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {}
    }
  };

  const removeItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    updateAndPropagate(next);
  };

  const gridCols = useMemo(() => {
    const len = items.length;
    if (len >= 3) return "md:grid-cols-3";
    if (len === 2) return "md:grid-cols-2";
    return "md:grid-cols-2";
  }, [items.length]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = (session as any)?.provider_token;
        if (token) setGoogleToken(String(token));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('google_client_id') || '';
      if (saved) setClientIdInput(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        const token = (session as any)?.provider_token;
        if (token) setGoogleToken(String(token));
      } catch {}
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, []);

  const getClientId = (): string | undefined => {
    const v = String(clientIdInput || ENV_GOOGLE_CLIENT_ID || '').trim();
    return v ? v : undefined;
  };

  const loadGsiScript = async () => {
    if (typeof window === 'undefined') return;
    if ((window as any).google?.accounts?.oauth2) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'));
      document.head.appendChild(s);
    });
  };

  const ensureGoogleTokenWithScope = async (): Promise<string | undefined> => {
    try {
      const token = googleToken;
      if (token) {
        try {
          const r = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
          if (r.ok) {
            const info = await r.json();
            const scope = String(info.scope || '');
            const s = scope.split(/\s+/);
            const hasPhotos = scope.includes('https://www.googleapis.com/auth/photoslibrary.readonly')
              || scope.includes('https://www.googleapis.com/auth/photoslibrary')
              || s.includes('photoslibrary.readonly');
            if (hasPhotos) return token;
          }
        } catch {}
      }
      const cid = getClientId();
      if (!cid) return undefined;
      await loadGsiScript();
      return await new Promise<string | undefined>((resolve) => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: cid,
            scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
            prompt: 'consent',
            callback: (resp: any) => {
              const at = resp?.access_token as string | undefined;
              if (at) {
                setGoogleToken(at);
                resolve(at);
              } else {
                resolve(undefined);
              }
            }
          });
          client.requestAccessToken();
        } catch {
          resolve(undefined);
        }
      });
    } catch {
      return undefined;
    }
  };

  const connectGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/photoslibrary.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
          redirectTo: (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:82')
        }
      });
    } catch (err: any) {
      toast({ title: "Falha ao conectar Google", description: err?.message || "Não foi possível iniciar OAuth.", variant: "destructive" });
    }
  };

  const fetchGooglePhotos = async () => {
    try {
      const token = await ensureGoogleTokenWithScope();
      if (!token) {
        toast({ title: "Sem autorização", description: "Token ausente ou sem escopo. Ajuste Client ID e reautentique.", variant: "destructive" });
        return;
      }
      setGoogleLoading(true);
      const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const body = await res.json();
          const em = body?.error?.message || body?.message || '';
          const es = body?.error?.status || body?.status || '';
          msg = [msg, es, em].filter(Boolean).join(' | ');
        } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      const items = Array.isArray(data?.mediaItems) ? data.mediaItems.filter((m: any) => String(m?.mimeType || '').startsWith('image/')) : [];
      setGooglePhotos(items);
      setSelectedGoogle({});
      toast({ title: "Google Fotos", description: `${items.length} imagem(ns) carregada(s).` });
    } catch (err: any) {
      const msg = String(err?.message || '').includes('403')
        ? 'Permissão negada (403). Reautentique e confirme escopo.'
        : (String(err?.message || '').includes('401')
            ? 'Token ausente/expirado (401). Entre novamente.'
            : (err?.message || 'Não foi possível listar Google Fotos.'));
      toast({ title: "Falha ao carregar fotos", description: msg, variant: "destructive" });
      try {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            scopes: 'https://www.googleapis.com/auth/photoslibrary.readonly',
            queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
            redirectTo: (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:82')
          }
        });
      } catch {}
    } finally {
      setGoogleLoading(false);
    }
  };

  const addSelectedGooglePhotos = () => {
    const chosen = googlePhotos.filter((p: any) => selectedGoogle[p.id]);
    if (!chosen.length) {
      toast({ title: "Nenhuma foto selecionada", description: "Selecione ao menos uma imagem." });
      return;
    }
    const appended: PhotoItem[] = chosen.map((p: any) => ({ id: Math.random().toString(36).slice(2), type: 'url', url: `${p.baseUrl}=w1600`, caption: '' }));
    updateAndPropagate([...items, ...appended]);
    toast({ title: "Fotos adicionadas", description: `${appended.length} imagem(ns) vinculada(s) do Google.` });
  };

  const importSelectedGoogleToStorage = async () => {
    try {
      const chosen = googlePhotos.filter((p: any) => selectedGoogle[p.id]);
      if (!chosen.length) {
        toast({ title: "Nenhuma foto selecionada", description: "Selecione ao menos uma imagem." });
        return;
      }
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        toast({ title: "Sessão expirada", description: "Entre novamente para importar fotos.", variant: "destructive" });
        return;
      }
      setImporting(true);
      const added: PhotoItem[] = [];
      for (const p of chosen) {
        const url = `${p.baseUrl}=d`;
        let blob: Blob | null = null;
        try {
          const res = await fetch(url);
          if (res.ok) blob = await res.blob();
        } catch {}
        if (!blob) {
          try {
            const res2 = await fetch(`${p.baseUrl}=w1600`);
            if (res2.ok) blob = await res2.blob();
          } catch {}
        }
        if (!blob) continue;
        const name = sanitizeName((p.filename || `google_${p.id}.jpg`).toString());
        const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
        const compressed = await compressImage(file);
        const ts = Date.now();
        const path = `${user.id}/${processId}/photos/${ts}_${sanitizeName(compressed.name)}`;
        const { data, error } = await supabase.storage
          .from("process-documents")
          .upload(path, compressed, { cacheControl: "3600", upsert: false });
        if (error) continue;
        try {
          await supabase.from("documents").insert({
            process_id: processId,
            name: compressed.name,
            file_path: data.path,
            file_size: compressed.size,
            file_type: compressed.type,
            category: "photo",
            description: null,
          });
        } catch {}
        let signed_url: string | undefined;
        try {
          const { data: sign } = await supabase.storage.from("process-documents").createSignedUrl(data.path, 60 * 60 * 24 * 7);
          signed_url = sign?.signedUrl;
        } catch {}
        added.push({ id: Math.random().toString(36).slice(2), type: "storage", file_path: data.path, signed_url, caption: "" });
      }
      if (added.length) {
        updateAndPropagate([...items, ...added]);
        toast({ title: "Importação concluída", description: `${added.length} foto(s) importada(s) para o Storage.` });
      } else {
        toast({ title: "Nada importado", description: "Não foi possível importar as imagens selecionadas.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Falha ao importar", description: err?.message || "Erro na importação para o Storage.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const validateGoogleToken = async () => {
    try {
      if (!googleToken) {
        toast({ title: "Sem token", description: "Conecte sua conta Google primeiro.", variant: "destructive" });
        return;
      }
      const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(googleToken)}`);
      if (!res.ok) {
        toast({ title: "Token inválido", description: `Erro ${res.status}. Reautentique para renovar o token.`, variant: "destructive" });
        return;
      }
      const info = await res.json();
      const scope = String(info.scope || "");
      const aud = String(info.aud || "");
      const exp = String(info.expires_in || info.exp || "");
      const s = scope.split(/\s+/);
      const hasPhotosScope = scope.includes("https://www.googleapis.com/auth/photoslibrary.readonly") || s.includes('photoslibrary.readonly') || scope.includes('https://www.googleapis.com/auth/photoslibrary');
      toast({ title: hasPhotosScope ? "Token válido" : "Escopo ausente", description: `aud: ${aud} | escopos: ${scope} | exp: ${exp}` });
      if (!hasPhotosScope) {
        try {
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              scopes: 'https://www.googleapis.com/auth/photoslibrary.readonly',
              queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
              redirectTo: (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:82')
            }
          });
        } catch {}
      }
    } catch (err: any) {
      toast({ title: "Falha ao validar token", description: err?.message || "Erro ao consultar tokeninfo.", variant: "destructive" });
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>12.1. Registro fotográfico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Adicionar por link (Google Fotos)</Label>
            <div className="flex gap-2">
              <Input value={addingUrl} onChange={(e) => setAddingUrl(e.target.value)} placeholder="Cole o link direto da imagem" />
              <Button type="button" onClick={addUrlItem} disabled={resolvingUrl}>{resolvingUrl ? "Validando..." : "Adicionar"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Dica: abra a foto no Google Fotos e copie o endereço direto da imagem.</p>
          </div>
          <div className="space-y-2">
            <Label>Selecionar imagens (com compressão)</Label>
            <Input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
            <p className="text-xs text-muted-foreground">Imagens são reduzidas e enviadas para o armazenamento, evitando arquivos pesados.</p>
          </div>
          <div className="space-y-2">
            <Label>Google Fotos</Label>
            {!googleToken ? (
              <Button type="button" onClick={connectGoogle}>Conectar Google</Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" onClick={fetchGooglePhotos} disabled={googleLoading}>{googleLoading ? "Carregando..." : "Carregar Fotos"}</Button>
                <Button type="button" variant="secondary" onClick={addSelectedGooglePhotos}>Adicionar selecionadas</Button>
                <Button type="button" variant="default" onClick={importSelectedGoogleToStorage} disabled={importing}>{importing ? "Importando..." : "Importar para Storage"}</Button>
                <Button type="button" variant="outline" onClick={validateGoogleToken}>Validar token</Button>
                {!ENV_GOOGLE_CLIENT_ID && (
                  <div className="flex items-center gap-2">
                    <Input placeholder="Client ID do Google" value={clientIdInput} onChange={(e) => { setClientIdInput(e.target.value); try { localStorage.setItem('google_client_id', e.target.value); } catch {} }} />
                  </div>
                )}
              </div>
            )}
            {googlePhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {googlePhotos.map((p: any) => (
                  <button key={p.id} type="button" className={`relative border rounded overflow-hidden ${selectedGoogle[p.id] ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedGoogle(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                    <img src={`${p.baseUrl}=w400`} alt={p.filename || "Google Photo"} className="w-full h-32 object-cover" />
                    <div className="absolute top-1 left-1 bg-background/70 text-xs px-1 rounded">{selectedGoogle[p.id] ? "Selecionada" : ""}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Conecte sua conta Google e selecione fotos diretamente.</p>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
          {items.map((it) => {
            const src = it.type === "url"
              ? (it.url && isProbablyDirectImageUrl(it.url) ? it.url : undefined)
              : (it.signed_url || undefined);
            return (
              <div key={it.id} className="border rounded p-2">
                <div className="aspect-video bg-muted rounded overflow-hidden">
                  {src ? (
                    <img src={src} alt={it.caption || "Foto"} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Prévia indisponível</div>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <Label>Comentário</Label>
                  <Textarea value={it.caption || ""} onChange={(e) => {
                    const next = items.map((x) => x.id === it.id ? { ...x, caption: e.target.value } : x);
                    updateAndPropagate(next);
                  }} placeholder="Escreva observações sobre esta foto" />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => removeItem(it.id)}>Remover</Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
