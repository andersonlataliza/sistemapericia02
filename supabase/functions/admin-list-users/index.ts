// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Método não permitido" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { success: false, error: "Variáveis de ambiente não configuradas" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Verificar autenticação e permissão de admin
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return json(401, { success: false, error: "Não autenticado" });
    }

    const requesterId = userData.user.id;
    const { data: adminRow, error: adminRowError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", requesterId)
      .maybeSingle();

    if (adminRowError) {
      return json(500, { success: false, error: "Falha ao validar permissões" });
    }
    if (!adminRow) {
      return json(403, { success: false, error: "Acesso restrito a administradores" });
    }

    const isMissingColumnError = (e: any) => {
      const msg = String(e?.message || "");
      const code = String(e?.code || "");
      return code === "42703" || /does not exist|undefined column|column\s+.+\s+does not exist/i.test(msg);
    };

    const trySelect = async (select: string, orderByCreatedAt: boolean) => {
      let q = supabaseAdmin.from("profiles").select(select);
      if (orderByCreatedAt) {
        q = q.order("created_at", { ascending: false });
      }
      const { data, error } = await q;
      return { data, error };
    };

    const candidates = [
      { select: "id, full_name, email, phone, created_at, is_blocked, blocked_at, blocked_reason, max_linked_users", order: true },
      { select: "id, full_name, email, phone, created_at, is_blocked, blocked_at, blocked_reason", order: true },
      { select: "id, full_name, email, phone, created_at", order: true },
      { select: "id, full_name, phone, created_at", order: true },
      { select: "id, full_name, created_at", order: true },
      { select: "id, full_name, email, phone", order: false },
      { select: "id, full_name, phone", order: false },
      { select: "id, full_name", order: false },
      { select: "id", order: false },
    ];

    let blockingSupported = true;
    let profiles: any[] | null = null;

    for (const c of candidates) {
      const { data, error } = await trySelect(c.select, c.order);
      if (!error) {
        profiles = (data || []) as any[];
        blockingSupported = c.select.includes("is_blocked");
        break;
      }

      if (!isMissingColumnError(error)) {
        return json(500, { success: false, error: String((error as any)?.message || "Falha ao listar perfis") });
      }
    }

    if (!profiles) {
      return json(500, { success: false, error: "Falha ao listar perfis" });
    }

    const normalized = (profiles || []).map((p) => ({
      id: p.id,
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      created_at: p.created_at ?? null,
      max_linked_users: typeof p.max_linked_users === "number" ? p.max_linked_users : null,
      is_blocked: blockingSupported ? !!p.is_blocked : false,
      blocked_at: blockingSupported ? (p.blocked_at ?? null) : null,
      blocked_reason: blockingSupported ? (p.blocked_reason ?? null) : null,
    }));

    return json(200, { success: true, users: normalized, blockingSupported });

  } catch (error: any) {
    return json(500, { success: false, error: error?.message || "Erro interno" });
  }
});
