// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type CreateUserRequest = {
  email: string;
  password: string;
  fullName?: string;
  cpf?: string;
  phone?: string;
  makeAdmin?: boolean;
  blocked?: boolean;
  blockedReason?: string;
  maxLinkedUsers?: number;
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
const normalizeCpf = (v?: string) => (v ? v.replace(/[^0-9]/g, "") : undefined);

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

    const body = (await req.json()) as CreateUserRequest;
    const email = normalizeEmail(body.email || "");
    const password = String(body.password || "");
    const fullName = (body.fullName || "").trim();
    const cpf = normalizeCpf(body.cpf);
    const phone = (body.phone || "").trim();
    const makeAdmin = Boolean(body.makeAdmin);
    const blocked = Boolean(body.blocked);
    const blockedReason = (body.blockedReason || "").trim();
    const maxLinkedUsersRaw = body.maxLinkedUsers;
    const maxLinkedUsers =
      typeof maxLinkedUsersRaw === "number" && Number.isFinite(maxLinkedUsersRaw)
        ? Math.trunc(maxLinkedUsersRaw)
        : undefined;

    if (!email || !email.includes("@")) {
      return json(400, { success: false, error: "Email inválido" });
    }
    if (!password || password.length < 6) {
      return json(400, { success: false, error: "Senha deve ter pelo menos 6 caracteres" });
    }
    if (cpf && cpf.length !== 11) {
      return json(400, { success: false, error: "CPF deve ter 11 dígitos" });
    }
    if (typeof maxLinkedUsers === "number" && maxLinkedUsers < 0) {
      return json(400, { success: false, error: "Limite de usuários vinculados inválido" });
    }

    let newUserId: string | null = null;
    let isNewUser = false;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(fullName ? { full_name: fullName } : {}),
        ...(cpf ? { cpf } : {}),
      },
    });

    if (createError) {
      // Se o erro for "User already registered", tentamos recuperar o ID do usuário
      if (createError.message?.toLowerCase().includes("already registered") || createError.status === 422) {
         console.log(`Usuário ${email} já existe. Tentando recuperar ID...`);
         
         // Tentativa de listar usuários para encontrar o ID pelo email
         // Nota: listUsers não tem filtro por email direto na API Admin do JS Client v2 padrão, 
         // então listamos uma página (ex: 1000) e filtramos.
         const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
           page: 1,
           perPage: 1000
         });
         
         if (listError) {
           return json(500, { success: false, error: "Falha ao listar usuários para recuperação" });
         }

         const existingUser = usersData.users.find(u => u.email?.toLowerCase() === email);
         if (existingUser) {
           newUserId = existingUser.id;
           // Atualizar senha se fornecida? Não, melhor não resetar senha silenciosamente.
           // Apenas garantimos que o perfil será criado.
         } else {
           // Se não achou na primeira página, pode ser que existam muitos usuários.
           // Nesse caso, retornamos o erro original.
           return json(400, { success: false, error: "Usuário já existe, mas não foi possível localizá-lo." });
         }
      } else {
        return json(400, { success: false, error: createError.message || "Falha ao criar usuário" });
      }
    } else if (created?.user) {
      newUserId = created.user.id;
      isNewUser = true;
    }

    if (!newUserId) {
       return json(500, { success: false, error: "Falha ao obter ID do usuário" });
    }

    // Criar ou atualizar perfil
    const profileData = {
      email, // Garante que o email esteja no perfil
      updated_at: new Date().toISOString(),
      ...(fullName ? { full_name: fullName } : {}),
      ...(phone ? { phone } : {}),
      ...(typeof maxLinkedUsers === "number" ? { max_linked_users: maxLinkedUsers } : {}),
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
         { id: newUserId, ...profileData },
         { onConflict: "id" }
      );

    if (profileError) {
       console.error("Erro ao atualizar perfil:", profileError);
       // Não falhamos a requisição se o usuário foi criado/recuperado, apenas logamos
    }

    if (blocked) {
      try {
        const { error: blockError } = await supabaseAdmin
          .from("profiles")
          .update({
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_reason: blockedReason || "Bloqueado pelo administrador",
            blocked_by: requesterId,
          })
          .eq("id", newUserId);
        if (blockError) {
          const msg = String((blockError as any)?.message || "");
          const code = String((blockError as any)?.code || "");
          if (!(code === "42703" || /does not exist|undefined column/i.test(msg))) {
            console.error("Erro ao bloquear usuário:", blockError);
          }
        }
      } catch {}
    }

    if (makeAdmin) {
      await supabaseAdmin
        .from("admin_users")
        .upsert({ user_id: newUserId, email, created_by: requesterId }, { onConflict: "user_id" });
    }

    return json(200, {
      success: true,
      user: { id: newUserId, email },
      restored: !isNewUser
    });
  } catch (error: any) {
    return json(500, { success: false, error: error?.message || "Erro interno" });
  }
});
