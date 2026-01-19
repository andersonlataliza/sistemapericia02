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

const normalizeEmail = (v: string) => String(v || "").trim().toLowerCase();
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const escapeHtml = (input: string) =>
  String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

type Recipient = { role: string; email: string };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Método não permitido" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("SCHEDULE_EMAIL_FROM")!;
  if (!supabaseUrl || !anonKey) return json(500, { success: false, error: "Ambiente não configurado" });
  if (!resendKey || !fromEmail) {
    const missing: string[] = [];
    if (!resendKey) missing.push("RESEND_API_KEY");
    if (!fromEmail) missing.push("SCHEDULE_EMAIL_FROM");
    return json(500, {
      success: false,
      error: `E-mail não configurado. Faltando: ${missing.join(", ")}`,
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json(401, { success: false, error: "Não autenticado" });
    const userId = userData.user.id;

    const body = await req.json();
    const processId = String(body?.processId || "").trim();
    const subject = String(body?.subject || "").trim();
    const messageBody = String(body?.body || "").trim();
    const recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];

    if (!processId) return json(400, { success: false, error: "processId é obrigatório" });
    if (!subject) return json(400, { success: false, error: "Assunto é obrigatório" });
    if (!messageBody) return json(400, { success: false, error: "Mensagem é obrigatória" });
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return json(400, { success: false, error: "Informe ao menos 1 destinatário" });
    }

    const normalizedRecipients = recipients
      .map((r) => ({ role: String(r?.role || "").trim() || "other", email: normalizeEmail(r?.email || "") }))
      .filter((r) => isValidEmail(r.email));

    if (normalizedRecipients.length === 0) {
      return json(400, { success: false, error: "Nenhum e-mail válido informado" });
    }

    const { data: processRow, error: processError } = await supabase
      .from("processes")
      .select("id,user_id")
      .eq("id", processId)
      .maybeSingle();

    if (processError) return json(500, { success: false, error: "Falha ao validar processo" });
    if (!processRow) return json(404, { success: false, error: "Processo não encontrado" });
    if (String(processRow.user_id) !== String(userId)) return json(403, { success: false, error: "Sem permissão" });

    const results: any[] = [];

    for (const r of normalizedRecipients) {
      const { data: receipt, error: receiptError } = await supabase
        .from("schedule_email_receipts")
        .insert({
          process_id: processId,
          user_id: userId,
          recipient_role: r.role,
          recipient_email: r.email,
          subject,
          body: messageBody,
          provider: "resend",
          status: "sending",
        })
        .select("id")
        .single();

      if (receiptError || !receipt?.id) {
        results.push({ role: r.role, email: r.email, success: false, error: "Falha ao registrar envio" });
        continue;
      }

      const receiptId = String(receipt.id);
      const openUrl = `${supabaseUrl}/functions/v1/schedule-email-track/open?id=${encodeURIComponent(receiptId)}`;
      const confirmUrl = `${supabaseUrl}/functions/v1/schedule-email-track/confirm?id=${encodeURIComponent(receiptId)}`;

      const safeBodyHtml = escapeHtml(messageBody).replaceAll("\n", "<br/>");
      const html = `<!doctype html><html><body><div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5"><div>${safeBodyHtml}</div><div style="margin-top:16px"><a href="${confirmUrl}">Confirmar recebimento</a></div><img src="${openUrl}" width="1" height="1" alt="" /></div></body></html>`;

      let providerMessageId: string | null = null;
      let providerError: string | null = null;

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [r.email],
            subject,
            html,
            text: messageBody,
          }),
        });

        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
          providerError = String(data?.message || data?.error || resp.statusText || "Falha ao enviar");
        } else {
          providerMessageId = String(data?.id || "");
        }
      } catch (e: any) {
        providerError = String(e?.message || "Falha ao enviar");
      }

      if (providerError) {
        await supabase
          .from("schedule_email_receipts")
          .update({ status: "error", error: providerError })
          .eq("id", receiptId);
        results.push({ role: r.role, email: r.email, receiptId, success: false, error: providerError });
        continue;
      }

      await supabase
        .from("schedule_email_receipts")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerMessageId || null })
        .eq("id", receiptId);

      results.push({ role: r.role, email: r.email, receiptId, success: true, providerMessageId });
    }

    return json(200, { success: true, results });
  } catch (e: any) {
    return json(500, { success: false, error: e?.message || "Falha inesperada" });
  }
});
