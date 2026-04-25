import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, lead_id, execution_id, in_reply_to } = await req.json();

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME");
    const SMTP_PORT = Deno.env.get("SMTP_PORT");
    const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
    const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

    if (!SMTP_HOSTNAME || !SMTP_PORT || !SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM_EMAIL) {
      throw new Error("SMTP credentials are not properly configured in secrets");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");

    let emailStatus = "failed";

    try {
      console.log(`Connecting to SMTP server ${SMTP_HOSTNAME}:${SMTP_PORT}...`);
      
      const portNumber = parseInt(SMTP_PORT);
      const transporter = nodemailer.createTransport({
        host: SMTP_HOSTNAME,
        port: portNumber,
        secure: portNumber === 465, // true for 465, false for 587
        auth: {
          user: SMTP_USERNAME,
          pass: SMTP_PASSWORD,
        },
      });

      console.log(`Sending email to ${to}...`);
      // Build mail options with optional threading headers
      const mailOptions: any = {
        from: SMTP_FROM_EMAIL,
        to: to,
        subject: subject,
        text: "Please view this email in a client that supports HTML.",
        html: html,
      };

      // Add threading headers so replies stay in the same Gmail thread
      if (in_reply_to) {
        mailOptions.inReplyTo = in_reply_to;
        mailOptions.references = [in_reply_to];
      }

      const info = await transporter.sendMail(mailOptions);

      console.log("Email successfully sent via SMTP!", info.messageId);
      emailStatus = "sent";
    } catch (smtpError) {
      console.error("SMTP Error Detail:", smtpError);
      emailStatus = "failed";
    }

    // Save message record to database
    if (lead_id && supabaseUrl && supabaseAnonKey && authHeader) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { error: msgError } = await supabase.from("messages").insert([{
        lead_id,
        workflow_execution_id: execution_id || null,
        message_type: "email",
        direction: "outbound",
        channel: "email",
        content: html,
        subject,
        recipient_email: to,
        status: emailStatus,
      }]);
      
      if (msgError) {
        console.error("Failed to insert message:", msgError);
        throw new Error("Failed to save message to DB: " + msgError.message);
      }

      if (emailStatus === "sent") {
        // Increment Lead Score automatically
        const { data: leadData } = await supabase.from('leads').select('score').eq('id', lead_id).single();
        if (leadData) {
          const newScore = (leadData.score || 0) + 5;
          const { error: leadUpdError } = await supabase.from('leads').update({ score: newScore }).eq('id', lead_id);
          if (leadUpdError) console.error("Failed to update lead score:", leadUpdError);
        }
      }
    }

    if (emailStatus === "failed") {
      throw new Error("Failed to send email via SMTP");
    }

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
