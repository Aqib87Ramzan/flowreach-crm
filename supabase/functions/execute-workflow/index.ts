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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending workflow executions
    const { data: pendingExecutions, error: fetchError } = await supabase
      .from("workflow_executions")
      .select("*")
      .eq("status", "pending")
      .limit(10);

    if (fetchError) {
      console.error("Error fetching pending executions:", fetchError);
      throw fetchError;
    }

    if (!pendingExecutions || pendingExecutions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending executions",
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processedCount = 0;

    // Process each pending execution
    for (const execution of pendingExecutions) {
      try {
        // Update status to running
        await supabase
          .from("workflow_executions")
          .update({ status: "running" })
          .eq("id", execution.id);

        // Get the workflow
        const { data: workflow, error: workflowError } = await supabase
          .from("workflows")
          .select("*")
          .eq("id", execution.workflow_id)
          .single();

        if (workflowError || !workflow) {
          throw new Error("Workflow not found");
        }

        // Parse nodes and edges
        const nodes = workflow.nodes || [];
        const edges = workflow.edges || [];

        // Build execution path
        const triggerNode = nodes.find((n: any) => n.type === "trigger");
        if (!triggerNode) throw new Error("No trigger node found");

        const executionPath = buildExecutionPath(nodes, edges, triggerNode.id);
        const triggerData = execution.trigger_data;

        // Execute each step in the path
        for (let i = 0; i < executionPath.length; i++) {
          const nodeId = executionPath[i];
          const node = nodes.find((n: any) => n.id === nodeId);

          if (!node) continue;

          console.log(`Executing node: ${node.type}`);

          if (node.type === "trigger") {
            // Skip trigger
            continue;
          } else if (node.type === "email") {
            // Execute Email
            await executeEmailNode(supabase, node, triggerData.lead_id, execution.id);
          } else if (node.type === "wait") {
            // Handle wait - for now, just skip (would need background job for real delays)
            console.log(`Wait node skipped: ${node.data?.delay || "unknown"}`);
          } else if (node.type === "condition") {
            // Handle condition - check for lead reply
            const hasReply = await checkLeadReply(supabase, triggerData.lead_id);
            if (hasReply) {
              // Stop execution if lead replied
              console.log("Lead has replied, stopping workflow");
              break;
            }
          } else if (node.type === "task") {
            // Execute task
            await executeTaskNode(supabase, node, triggerData.lead_id, execution.id);
          }
        }

        // Mark execution as completed
        await supabase
          .from("workflow_executions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", execution.id);

        processedCount++;
      } catch (error) {
        console.error(`Error processing execution ${execution.id}:`, error);
        // Mark as failed
        await supabase
          .from("workflow_executions")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", execution.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} workflow executions`,
        processed: processedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Workflow execution error:", error);
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

function buildExecutionPath(nodes: any[], edges: any[], startNodeId: string): string[] {
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

    // Call send-email function (you'd need to create this)
    console.log(`Email would be sent to ${lead.email}`);

    // For now, just log it
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
