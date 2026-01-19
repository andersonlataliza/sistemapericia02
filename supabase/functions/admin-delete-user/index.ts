// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type DeleteUserRequest = {
  userId: string;
};

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

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

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

    let body: DeleteUserRequest | null = null;
    try {
      body = (await req.json()) as DeleteUserRequest;
    } catch {
      body = null;
    }

    const userId = String(body?.userId || "").trim();
    if (!userId || !isUuid(userId)) {
      return json(400, { success: false, error: "userId inválido" });
    }

    if (userId === requesterId) {
      return json(400, { success: false, error: "Não é possível deletar o próprio usuário" });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json(500, { success: false, error: deleteError.message || "Falha ao deletar usuário" });
    }

    return json(200, { success: true });
  } catch (error: any) {
    return json(500, { success: false, error: error?.message || "Erro interno" });
  }
});
