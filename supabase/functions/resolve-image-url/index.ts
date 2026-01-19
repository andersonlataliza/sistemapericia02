import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ResolveRequest = { url?: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const decodeHtml = (s: string) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const decodeLikelyEscapes = (s: string) =>
  s
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/");

const extractMetaContent = (html: string, matcher: (tag: string) => boolean) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!matcher(tag)) continue;
    const m = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
    if (m?.[2]) return decodeHtml(m[2].trim());
  }
  return undefined;
};

const isLikelyImageUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes("googleusercontent.com")) return true;
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
};

const pickFirstLikelyImageUrlFromHtml = (html: string) => {
  const decoded = decodeLikelyEscapes(html);
  const matches = decoded.match(/https?:\/\/lh\d+\.googleusercontent\.com\/[^\s"'<>\\]+/gi) || [];
  for (const m of matches) {
    const candidate = m.trim();
    if (isLikelyImageUrl(candidate)) return candidate;
  }
  return undefined;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ResolveRequest = {};
  try {
    body = (await req.json()) as ResolveRequest;
  } catch (e) {
    void e;
  }

  const raw = String(body?.url || "").trim();
  if (!raw) {
    return new Response(JSON.stringify({ success: false, error: "url é obrigatória" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new Response(JSON.stringify({ success: false, error: "url inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return new Response(JSON.stringify({ success: false, error: "Protocolo inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; PericiaAutomata/1.0; +https://supabase.com)",
      },
    });

    const finalUrl = res.url || parsed.toString();
    const contentType = String(res.headers.get("content-type") || "");
    if (contentType.toLowerCase().startsWith("image/")) {
      return new Response(JSON.stringify({ success: true, resolved_url: finalUrl, content_type: contentType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await res.text();

    const ogImage = extractMetaContent(html, (tag) => /\bproperty\s*=\s*(["'])og:image(\1)/i.test(tag));
    const twitterImage = extractMetaContent(html, (tag) => /\bname\s*=\s*(["'])twitter:image(\1)/i.test(tag));
    const itemPropImage = extractMetaContent(html, (tag) => /\bitemprop\s*=\s*(["'])image(\1)/i.test(tag));

    const candidate = ogImage || twitterImage || itemPropImage;
    if (candidate) {
      let resolved = candidate;
      try {
        resolved = new URL(candidate, finalUrl).toString();
      } catch (e) {
        void e;
      }

      if (isLikelyImageUrl(resolved)) {
        return new Response(JSON.stringify({ success: true, resolved_url: resolved, content_type: contentType }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const fallback = pickFirstLikelyImageUrlFromHtml(html);
    if (fallback) {
      return new Response(JSON.stringify({ success: true, resolved_url: fallback, content_type: contentType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Não foi possível resolver a imagem" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha ao resolver URL";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
