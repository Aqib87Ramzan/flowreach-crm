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

    // Find active workflow
    let workflowQuery = supabase.from("workflows").select("*").eq("is_active", true);
    if (queryWorkflowId) {
      workflowQuery = workflowQuery.eq("id", queryWorkflowId);
    } else {
      workflowQuery = workflowQuery.eq("user_id", effectiveUserId);
    }

    const { data: workflows, error: workflowError } = await workflowQuery;

    if (workflowError) {
      console.error("Error fetching workflows:", workflowError);
    }

    // Trigger workflow execution if active workflow exists
    if (workflows && workflows.length > 0) {
      const workflow = workflows[0];

      const { data: execution, error: executionError } = await supabase
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
        ])
        .select("id")
        .single();

      if (executionError) {
        console.error("Error creating workflow execution:", executionError);
      } else if (execution) {
        // Execute workflow immediately
        try {
          await executeWorkflow(supabase, workflow, leadData.id, execution.id, {
            lead_id: leadData.id,
            name,
            email,
            phone,
            source,
          });

          // Mark execution as completed
          await supabase
            .from("workflow_executions")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", execution.id);
        } catch (error) {
          console.error("Error executing workflow:", error);
          // Mark as failed
          await supabase
            .from("workflow_executions")
            .update({
              status: "failed",
              error_message:
                error instanceof Error ? error.message : "Unknown error",
            })
            .eq("id", execution.id);
        }
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

async function executeWorkflow(
  supabase: any,
  workflow: any,
  leadId: string,
  executionId: string,
  triggerData: any
): Promise<void> {
  const nodes = workflow.nodes || [];
  const edges = workflow.edges || [];

  // Find trigger node
  const triggerNode = nodes.find((n: any) => n.type === "trigger");
  if (!triggerNode) {
    throw new Error("No trigger node found");
  }

  // Build execution path
  const executionPath = buildExecutionPath(nodes, edges, triggerNode.id);

  // Execute each node in the path
  for (const nodeId of executionPath) {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) continue;

    console.log(`Executing node: ${node.type}`);

    if (node.type === "trigger") {
      // Skip trigger node
      continue;
    } else if (node.type === "sms") {
      // Execute SMS
      await executeSMSNode(supabase, node, leadId, executionId);
    } else if (node.type === "email") {
      // Execute Email
      await executeEmailNode(supabase, node, leadId, executionId);
    } else if (node.type === "wait") {
      // Handle wait - would need background job for real delays
      console.log(`Wait node: ${node.data?.delay || "unknown"}`);
    } else if (node.type === "condition") {
      // Handle condition - check for lead reply
      const hasReply = await checkLeadReply(supabase, leadId);
      if (hasReply) {
        console.log("Lead has replied, stopping workflow");
        break;
      }
    } else if (node.type === "task") {
      // Execute task
      await executeTaskNode(supabase, node, leadId, executionId);
    }
  }
}

function buildExecutionPath(
  nodes: any[],
  edges: any[],
  startNodeId: string
): string[] {
  const path: string[] = [startNodeId];
  let currentNodeId = startNodeId;
  const visited = new Set<string>([startNodeId]);

  while (true) {
    const nextEdge = edges.find((e) => e.source === currentNodeId);
    if (!nextEdge || visited.has(nextEdge.target)) break;
    visited.add(nextEdge.target);
    path.push(nextEdge.target);
    currentNodeId = nextEdge.target;
  }

  return path;
}

async function executeSMSNode(
  supabase: any,
  node: any,
  leadId: string,
  executionId: string
): Promise<void> {
  try {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) throw new Error("Lead not found");
    if (!lead.phone) throw new Error("Lead has no phone number");

    const message =
      node.data?.message ||
      `Hi ${lead.name}, thanks for your interest! We'd love to help you. Reply to this message to get started.`;

    // Create message record in database
    const { error: msgError } = await supabase.from("messages").insert([
      {
        lead_id: leadId,
        workflow_execution_id: executionId,
        message_type: "sms",
        direction: "outbound",
        channel: "sms",
        content: message,
        recipient_phone: lead.phone,
        status: "sent",
      },
    ]);

    if (msgError) throw msgError;

    console.log(`SMS sent to ${lead.phone}: ${message}`);
  } catch (error) {
    console.error("SMS execution error:", error);
    throw error;
  }
}

async function executeEmailNode(
  supabase: any,
  node: any,
  leadId: string,
  executionId: string
): Promise<void> {
  try {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) throw new Error("Lead not found");
    if (!lead.email) throw new Error("Lead has no email");

    const message =
      node.data?.message ||
      `Hi ${lead.name}, thanks for reaching out! We're excited to work with you.`;

    // Create message record in database
    const { error: msgError } = await supabase.from("messages").insert([
      {
        lead_id: leadId,
        workflow_execution_id: executionId,
        message_type: "email",
        direction: "outbound",
        channel: "email",
        content: message,
        recipient_email: lead.email,
        status: "sent",
      },
    ]);

    if (msgError) throw msgError;

    console.log(`Email sent to ${lead.email}: ${message}`);
  } catch (error) {
    console.error("Email execution error:", error);
    throw error;
  }
}

async function executeTaskNode(
  supabase: any,
  node: any,
  leadId: string,
  executionId: string
): Promise<void> {
  try {
    const taskDescription = node.data?.description || "No description";

    // Log the task
    const { error } = await supabase.from("messages").insert([
      {
        lead_id: leadId,
        workflow_execution_id: executionId,
        message_type: "task",
        direction: "internal",
        channel: "task",
        content: taskDescription,
        status: "pending",
      },
    ]);

    if (error) throw error;
    console.log(`Task created: ${taskDescription}`);
  } catch (error) {
    console.error("Task execution error:", error);
    throw error;
  }
}

async function checkLeadReply(supabase: any, leadId: string): Promise<boolean> {
  try {
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("lead_id", leadId)
      .eq("direction", "inbound")
      .limit(1);

    if (error) throw error;
    return messages && messages.length > 0;
  } catch (error) {
    console.error("Error checking lead reply:", error);
    return false;
  }
}
