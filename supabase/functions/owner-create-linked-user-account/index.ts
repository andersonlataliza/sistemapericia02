// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type OwnerCreateLinkedAccountRequest = {
  linkedUserId: string;
  email: string;
  password: string;
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

const normalizeEmail = (v: string) => v.trim().toLowerCase();
const normalizeCpfDigits = (v: unknown) => String(v || "").replace(/[^0-9]/g, "");

const findExistingUserByEmail = async (supabaseAdmin: any, email: string) => {
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError) {
      return { user: null, error: listError };
    }

    const users = usersData?.users || [];
    const existing = users.find((u: any) => normalizeEmail(String(u.email || "")) === email);
    if (existing) {
      return { user: existing, error: null };
    }

    if (users.length < perPage) {
      return { user: null, error: null };
    }
  }

  return { user: null, error: null };
};

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
    const body = (await req.json()) as OwnerCreateLinkedAccountRequest;
    const linkedUserId = String(body.linkedUserId || "").trim();
    const email = normalizeEmail(body.email || "");
    const password = String(body.password || "");

    if (!linkedUserId) {
      return json(400, { success: false, error: "linkedUserId é obrigatório" });
    }
    if (!email || !email.includes("@")) {
      return json(400, { success: false, error: "Email inválido" });
    }
    if (!password || password.length < 6) {
      return json(400, { success: false, error: "Senha deve ter pelo menos 6 caracteres" });
    }

    const { data: linkedRow, error: linkedErr } = await supabaseAdmin
      .from("linked_users")
      .select("id, owner_user_id, linked_user_cpf, linked_user_name, linked_user_email, auth_user_id, status, permissions")
      .eq("id", linkedUserId)
      .maybeSingle();

    if (linkedErr) {
      return json(500, { success: false, error: "Falha ao buscar usuário vinculado" });
    }
    if (!linkedRow) {
      return json(404, { success: false, error: "Usuário vinculado não encontrado" });
    }
    if (linkedRow.owner_user_id !== requesterId) {
      return json(403, { success: false, error: "Acesso negado" });
    }
    if (String(linkedRow.status || "") !== "active") {
      return json(400, { success: false, error: "Usuário vinculado não está ativo" });
    }
    if (linkedRow.auth_user_id) {
      return json(400, { success: false, error: "A conta deste usuário vinculado já foi criada" });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: linkedRow.linked_user_name,
        cpf: linkedRow.linked_user_cpf,
        is_linked: true,
        linked_owner_id: linkedRow.owner_user_id,
        linked_user_id: linkedRow.id,
      },
    });

    let newUserId: string | null = created?.user?.id || null;
    let linkedExisting = false;

    if (createError || !newUserId) {
      const msg = String(createError?.message || "Falha ao criar usuário");
      const already = msg.toLowerCase().includes("already registered") || createError?.status === 422;
      if (!already) {
        return json(400, { success: false, error: msg });
      }

      const { user: existing, error: findError } = await findExistingUserByEmail(supabaseAdmin, email);
      if (findError) {
        return json(500, { success: false, error: "Falha ao localizar usuário existente" });
      }
      if (!existing) {
        return json(400, { success: false, error: "Email já cadastrado" });
      }

      const linkedCpf = normalizeCpfDigits(linkedRow.linked_user_cpf);
      const meta = existing.user_metadata || {};
      const metaCpf = normalizeCpfDigits((meta as any).cpf);
      const canClaimByCpf = linkedCpf && metaCpf && linkedCpf === metaCpf;
      const canClaimByMeta =
        (meta as any).is_linked === true &&
        String((meta as any).linked_owner_id || "") === String(linkedRow.owner_user_id || "") &&
        String((meta as any).linked_user_id || "") === String(linkedRow.id || "");

      if (!(canClaimByCpf || canClaimByMeta)) {
        return json(400, {
          success: false,
          error: "Este email já pertence a outra conta. Use outro email para o usuário vinculado.",
        });
      }

      newUserId = existing.id;
      linkedExisting = true;

      try {
        await supabaseAdmin.auth.admin.updateUserById(newUserId, {
          user_metadata: {
            ...(meta as any),
            full_name: linkedRow.linked_user_name,
            cpf: linkedRow.linked_user_cpf,
            is_linked: true,
            linked_owner_id: linkedRow.owner_user_id,
            linked_user_id: linkedRow.id,
          },
        });
      } catch {}
    }

    if (!newUserId) {
      return json(500, { success: false, error: "Falha ao identificar usuário" });
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: newUserId,
        email,
        full_name: linkedRow.linked_user_name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    const { error: updateLinkedErr } = await supabaseAdmin
      .from("linked_users")
      .update({ auth_user_id: newUserId, linked_user_email: email, updated_at: new Date().toISOString() })
      .eq("id", linkedRow.id);

    if (updateLinkedErr) {
      return json(500, { success: false, error: "Conta criada, mas falhou ao atualizar o vínculo" });
    }

    try {
      const perms = linkedRow.permissions || {};
      const canViewProcesses = Boolean((perms as any)?.view_processes ?? true);
      if (canViewProcesses) {
        const { data: ownerProcesses, error: ownerProcErr } = await supabaseAdmin
          .from("processes")
          .select("id")
          .eq("user_id", linkedRow.owner_user_id);

        if (!ownerProcErr && Array.isArray(ownerProcesses) && ownerProcesses.length > 0) {
          const rows = ownerProcesses.map((p: any) => ({
            process_id: p.id,
            linked_user_id: linkedRow.id,
            granted_by: linkedRow.owner_user_id,
          }));
          await supabaseAdmin
            .from("process_access")
            .upsert(rows, { onConflict: "process_id,linked_user_id" });
        }
      }
    } catch {}

    return json(200, { success: true, user: { id: newUserId, email }, linkedExisting });
  } catch (error: any) {
    return json(500, { success: false, error: error?.message || "Erro interno" });
  }
});
