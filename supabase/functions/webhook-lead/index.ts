import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, phone, source, user_id } = await req.json();

    // Also check query params for user_id/workflow_id
    const url = new URL(req.url);
    const queryUserId = url.searchParams.get("user_id");
    const queryWorkflowId = url.searchParams.get("workflow_id");
    const effectiveUserId = user_id || queryUserId;

    // Validate required fields
    if (!name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, phone" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!effectiveUserId) {
      return new Response(
        JSON.stringify({ error: "Missing user_id (pass in body or as query param)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save lead to database
    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .insert([
        {
          name,
          email,
          phone,
          source: source || "webhook",
          status: "New",
          date_added: new Date().toISOString(),
          user_id: effectiveUserId,
        },
      ])
      .select()
      .single();

    if (leadError) {
      console.error("Error saving lead:", leadError);
      throw leadError;
    }

    // Find active workflow (assuming we need to get the workflow via webhook URL)
    const webhookUrl = `${req.headers.get("origin") || Deno.env.get("SUPABASE_URL")}/webhook/lead`;

    const { data: workflows, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("webhook_url", webhookUrl)
      .eq("is_active", true);

    if (workflowError) {
      console.error("Error fetching workflows:", workflowError);
    }

    // Trigger workflow execution if active workflow exists
    if (workflows && workflows.length > 0) {
      const workflow = workflows[0];

      const { error: executionError } = await supabase
        .from("workflow_executions")
        .insert([
          {
            workflow_id: workflow.id,
            trigger_type: "webhook",
            trigger_data: {
              lead_id: leadData.id,
              name,
              email,
              phone,
              source,
            },
            status: "pending",
          },
        ]);

      if (executionError) {
        console.error("Error creating workflow execution:", executionError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead captured successfully",
        lead: leadData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
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
