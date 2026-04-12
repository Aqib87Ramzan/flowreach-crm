import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAILTRAP_USER = Deno.env.get("MAILTRAP_SMTP_USER");
    const MAILTRAP_PASS = Deno.env.get("MAILTRAP_SMTP_PASS");

    if (!MAILTRAP_USER || !MAILTRAP_PASS) {
      throw new Error("MAILTRAP_SMTP_USER or MAILTRAP_SMTP_PASS is not configured");
    }

    const client = new SMTPClient({
      connection: {
        hostname: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
          username: MAILTRAP_USER,
          password: MAILTRAP_PASS,
        },
      },
    });

    await client.send({
      from: "FlowReach <noreply@flowreach.app>",
      to,
      subject,
      html,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
