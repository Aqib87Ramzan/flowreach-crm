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
    const { phone, message, lead_id, execution_id } = await req.json();

    if (!phone || !message || !lead_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Twilio credentials from environment variables
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
      console.warn(
        "Twilio credentials not configured. SMS will be logged but not sent.",
        {
          hasSid: !!TWILIO_ACCOUNT_SID,
          hasToken: !!TWILIO_AUTH_TOKEN,
          hasPhone: !!TWILIO_PHONE,
        }
      );
    }

    // Create message record in database
    const { data: smsData, error: smsError } = await supabase
      .from("messages")
      .insert([
        {
          lead_id,
          workflow_execution_id: execution_id,
          message_type: "sms",
          direction: "outbound",
          channel: "sms",
          content: message,
          recipient_phone: phone,
          status: TWILIO_ACCOUNT_SID ? "sent" : "pending",
        },
      ])
      .select()
      .single();

    if (smsError) {
      console.error("Error saving SMS message:", smsError);
      throw smsError;
    }

    // Send SMS via Twilio if credentials are available
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE) {
      try {
        const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${credentials}`,
            },
            body: new URLSearchParams({
              From: TWILIO_PHONE,
              To: phone,
              Body: message,
            }).toString(),
          }
        );

        if (!twilioRes.ok) {
          const errorData = await twilioRes.text();
          console.error(
            `Twilio API error (${twilioRes.status}):`,
            errorData
          );
          // Update message status to failed if Twilio call failed
          await supabase
            .from("messages")
            .update({ status: "failed" })
            .eq("id", smsData.id);
        } else {
          const twilioData = await twilioRes.json();
          console.log(`SMS sent via Twilio. SID: ${twilioData.sid}`);
          // Update message with Twilio SID
          await supabase
            .from("messages")
            .update({ status: "sent" })
            .eq("id", smsData.id);
        }
      } catch (twilioError) {
        console.error("Error sending SMS via Twilio:", twilioError);
        // Mark as failed but don't throw - message is already recorded
        await supabase
          .from("messages")
          .update({ status: "failed" })
          .eq("id", smsData.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS queued for sending",
        data: smsData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("SMS error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
