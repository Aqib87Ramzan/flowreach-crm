import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Cloudmailin style parsing, but flexible enough if we send it standard JSON
    // Expected incoming JSON: { from: "...", subject: "...", text: "..." }
    const { from, subject, text, envelope } = payload;
    
    // Safely extract email regardless of parser type
    let senderEmail = from;
    if (envelope && envelope.from) {
      senderEmail = envelope.from;
    }
    
    // Clean up sender email if it's formatted like "Name <email@domain.com>"
    const emailMatch = senderEmail.match(/<([^>]+)>/);
    const cleanEmail = emailMatch ? emailMatch[1] : senderEmail;

    if (!cleanEmail) {
      return new Response(JSON.stringify({ error: "Missing sender email" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find which lead replied using their email address
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("email", cleanEmail)
      .single();

    if (leadError || !lead) {
      console.error(`Inbound email dropped. No lead found matching email: ${cleanEmail}`);
      // Return 200 anyway so the webhook service doesn't retry
      return new Response(JSON.stringify({ success: true, warning: 'Lead not found' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Insert the replied message into the DB!
    const { error: msgError } = await supabase.from("messages").insert([{
      lead_id: lead.id,
      message_type: "email",
      direction: "inbound",
      channel: "email",
      content: text || "No text content.",
      subject: subject || "Reply",
      sender_email: cleanEmail,
      status: "received",
    }]);

    if (msgError) {
      console.error("Error saving inbound message:", msgError);
      throw msgError;
    }

    console.log(`Successfully received and attached inbound reply from ${cleanEmail}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Webhook Inbound Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
