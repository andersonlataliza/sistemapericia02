// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const gifBytes = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
  (c) => c.charCodeAt(0)
);

const html = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return html(405, "Método não permitido");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!supabaseUrl || !serviceKey) return html(500, "Ambiente não configurado");
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return html(400, "Parâmetro inválido");

    const path = url.pathname || "";
    const nowIso = new Date().toISOString();

    if (path.endsWith("/open")) {
      await supabase
        .from("schedule_email_receipts")
        .update({ opened_at: nowIso })
        .eq("id", id)
        .is("opened_at", null);

      return new Response(gifBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    if (path.endsWith("/confirm")) {
      await supabase
        .from("schedule_email_receipts")
        .update({ confirmed_at: nowIso })
        .eq("id", id)
        .is("confirmed_at", null);

      return html(200, "Recebimento confirmado.");
    }

    return html(404, "Rota não encontrada");
  } catch {
    return html(500, "Falha inesperada");
  }
});

