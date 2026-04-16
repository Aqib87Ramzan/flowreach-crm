import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== SEND-WHATSAPP FUNCTION CALLED ===");

    const { phone, message, lead_id, execution_id } = await req.json();

    console.log("Received request:", { phone, message: message?.substring(0, 50), lead_id, execution_id });

    if (!phone || !message || !lead_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, message, lead_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    console.log("WhatsApp credentials check:", {
      hasToken: !!WHATSAPP_API_TOKEN,
      hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID,
    });

    // Clean phone number — ensure it has no + prefix for WhatsApp API
    const cleanPhone = phone.replace(/[^0-9]/g, "");

    // Create message record in database
    const { data: msgData, error: msgError } = await supabase
      .from("messages")
      .insert([{
        lead_id,
        workflow_execution_id: execution_id || null,
        message_type: "whatsapp",
        direction: "outbound",
        channel: "whatsapp",
        content: message,
        recipient_phone: phone,
        status: WHATSAPP_API_TOKEN ? "sending" : "pending",
      }])
      .select()
      .single();

    if (msgError) {
      console.error("Error saving WhatsApp message:", msgError);
      throw msgError;
    }

    console.log("Message record created:", { id: msgData.id });

    // Send via Meta WhatsApp Business API
    if (WHATSAPP_API_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      try {
        console.log("Sending WhatsApp message via Meta API...");

        const metaUrl = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

        const metaRes = await fetch(metaUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { body: message },
          }),
        });

        const metaData = await metaRes.json();
        console.log("Meta API response:", JSON.stringify(metaData));

        if (!metaRes.ok) {
          console.error(`Meta WhatsApp API error (${metaRes.status}):`, JSON.stringify(metaData));
          await supabase
            .from("messages")
            .update({ status: "failed" })
            .eq("id", msgData.id);
        } else {
          console.log("WhatsApp message sent. ID:", metaData.messages?.[0]?.id);
          await supabase
            .from("messages")
            .update({ status: "sent" })
            .eq("id", msgData.id);
        }
      } catch (waError) {
        console.error("WhatsApp send error:", waError instanceof Error ? waError.message : waError);
        await supabase
          .from("messages")
          .update({ status: "failed" })
          .eq("id", msgData.id);
      }
    } else {
      console.log("WhatsApp credentials not configured — message logged but not sent.");
    }

    console.log("=== SEND-WHATSAPP FUNCTION COMPLETED ===");

    return new Response(
      JSON.stringify({ success: true, message: "WhatsApp message processed", data: msgData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp error:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
