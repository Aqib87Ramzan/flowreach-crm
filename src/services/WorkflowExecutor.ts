import { Node, Edge } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';
import { Workflow } from '@/types/workflow';

export interface WorkflowExecutorOptions {
  workflowId: string;
  triggerData: {
    lead_id: string;
    name: string;
    email: string;
    phone: string;
    source: string;
  };
}

export class WorkflowExecutor {
  private static instance: WorkflowExecutor;
  private activeExecutions: Map<string, boolean> = new Map();

  static getInstance(): WorkflowExecutor {
    if (!WorkflowExecutor.instance) {
      WorkflowExecutor.instance = new WorkflowExecutor();
    }
    return WorkflowExecutor.instance;
  }

  async executeWorkflow(options: WorkflowExecutorOptions): Promise<string | null> {
    const { workflowId, triggerData } = options;

    try {
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (workflowError || !workflow) {
        console.error('Workflow not found:', workflowError);
        return null;
      }

      const { data: execution, error: executionError } = await supabase
        .from('workflow_executions')
        .insert([{
          workflow_id: workflowId,
          trigger_type: 'webhook',
          trigger_data: triggerData,
          status: 'running',
        }])
        .select('id')
        .single();

      if (executionError || !execution) {
        console.error('Failed to create workflow execution:', executionError);
        return null;
      }

      const executionId = execution.id;
      this.activeExecutions.set(executionId, true);

      await this.executeSteps(workflow as any as Workflow, triggerData.lead_id, executionId);

      await supabase
        .from('workflow_executions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', executionId);

      this.activeExecutions.delete(executionId);
      return executionId;
    } catch (error) {
      console.error('Workflow execution failed:', error);
      return null;
    }
  }

  private async executeSteps(
    workflow: Workflow,
    leadId: string,
    executionId: string
  ): Promise<void> {
    const nodes: Node[] = workflow.nodes || [];
    const edges: Edge[] = workflow.edges || [];

    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) return;

    const executionPath = this.buildExecutionPath(nodes, edges, triggerNode.id);

    for (let i = 0; i < executionPath.length; i++) {
      const nodeId = executionPath[i];
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      // Check if execution was cancelled
      if (!this.activeExecutions.has(executionId)) return;

      await this.logWorkflowStep({
        workflow_execution_id: executionId,
        step_index: i,
        step_type: node.type || 'unknown',
        status: 'running',
        input_data: node.data,
      });

      try {
        switch (node.type) {
          case 'trigger':
            // Already triggered, skip
            break;
          case 'sms':
            await this.executeSMSNode(node, leadId, executionId);
            break;
          case 'email':
            await this.executeEmailNode(node, leadId, executionId);
            break;
          case 'wait':
            await this.executeWaitNode(node, leadId, executionId);
            break;
          case 'condition': {
            const hasReply = await this.checkLeadReply(leadId);
            if (hasReply) {
              // Lead replied — stop workflow
              await this.logCommunication({
                lead_id: leadId,
                workflow_execution_id: executionId,
                step: 'check_reply',
                channel: 'sms',
                status: 'completed',
                action_data: { result: 'lead_replied', action: 'stop_workflow' },
              });
              return;
            }
            // No reply — continue to next node
            await this.logCommunication({
              lead_id: leadId,
              workflow_execution_id: executionId,
              step: 'check_reply',
              channel: 'sms',
              status: 'completed',
              action_data: { result: 'no_reply', action: 'continue' },
            });
            break;
          }
          case 'task':
            await this.executeTaskNode(node, leadId, executionId);
            break;
        }

        await this.logWorkflowStep({
          workflow_execution_id: executionId,
          step_index: i,
          step_type: node.type || 'unknown',
          status: 'completed',
        });
      } catch (error) {
        console.error(`Error executing ${node.type} node:`, error);
        await this.logWorkflowStep({
          workflow_execution_id: executionId,
          step_index: i,
          step_type: node.type || 'unknown',
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't break — continue to next step
      }
    }
  }

  private buildExecutionPath(nodes: Node[], edges: Edge[], startNodeId: string): string[] {
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

  private async executeSMSNode(node: Node, leadId: string, executionId: string): Promise<void> {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) throw new Error('Lead not found');
    if (!lead.phone) throw new Error('Lead has no phone number');

    const message = node.data.message || `Hi ${lead.name}, thanks for your interest! We'd love to help you. Reply to this message to get started.`;

    const { error } = await supabase.functions.invoke('send-sms', {
      body: {
        phone: lead.phone,
        message,
        lead_id: leadId,
        execution_id: executionId,
      },
    });

    if (error) throw error;

    await this.logCommunication({
      lead_id: leadId,
      workflow_execution_id: executionId,
      step: 'initial_contact',
      channel: 'sms',
      status: 'completed',
      action_data: { phone: lead.phone, message },
    });
  }

  private async executeEmailNode(node: Node, leadId: string, executionId: string): Promise<void> {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) throw new Error('Lead not found');
    if (!lead.email) throw new Error('Lead has no email');

    const subject = node.data.subject || `Hello ${lead.name} - Welcome!`;
    const message = node.data.message || `Hi ${lead.name},\n\nThank you for your interest! We'd love to help you achieve your goals.\n\nBest regards,\nFlowReach Team`;

    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: lead.email,
        subject,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
        lead_id: leadId,
        execution_id: executionId,
      },
    });

    if (error) throw error;

    await this.logCommunication({
      lead_id: leadId,
      workflow_execution_id: executionId,
      step: 'initial_contact',
      channel: 'email',
      status: 'completed',
      action_data: { email: lead.email, subject, message },
    });
  }

  private async executeWaitNode(node: Node, leadId: string, executionId: string): Promise<void> {
    const hours = node.data.hours || 24;
    // For MVP, cap wait at 5 minutes max to allow testing
    const maxWaitMs = 5 * 60 * 1000; // 5 minutes
    const requestedMs = hours * 60 * 60 * 1000;
    const actualWaitMs = Math.min(requestedMs, maxWaitMs);

    await this.logCommunication({
      lead_id: leadId,
      workflow_execution_id: executionId,
      step: 'wait_period',
      channel: 'sms',
      status: 'in_progress',
      action_data: { wait_hours: hours, actual_wait_ms: actualWaitMs },
    });

    return new Promise((resolve) => {
      setTimeout(async () => {
        await this.logCommunication({
          lead_id: leadId,
          workflow_execution_id: executionId,
          step: 'wait_period',
          channel: 'sms',
          status: 'completed',
        });
        resolve();
      }, actualWaitMs);
    });
  }

  private async checkLeadReply(leadId: string): Promise<boolean> {
    try {
      const { data: inboundMessages, error } = await supabase
        .from('messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('direction', 'inbound')
        .limit(1);

      if (error) throw error;
      return !!inboundMessages && inboundMessages.length > 0;
    } catch (error) {
      console.error('Failed to check lead reply:', error);
      return false;
    }
  }

  private async executeTaskNode(node: Node, leadId: string, executionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get lead name for task title
    const { data: lead } = await supabase
      .from('leads')
      .select('name, phone')
      .eq('id', leadId)
      .single();

    const leadName = lead?.name || 'Unknown Lead';

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (node.data.due_days || 1));

    const { error } = await supabase.from('tasks').insert([{
      user_id: user.id,
      lead_id: leadId,
      workflow_execution_id: executionId,
      task_type: 'call',
      title: node.data.title || `Call ${leadName}`,
      description: node.data.description || `Follow up with ${leadName} - no response to automated messages. Phone: ${lead?.phone || 'N/A'}`,
      due_date: dueDate.toISOString(),
      status: 'pending',
      priority: 'high',
    }]);

    if (error) throw error;

    await this.logCommunication({
      lead_id: leadId,
      workflow_execution_id: executionId,
      step: 'create_task',
      channel: 'sms',
      status: 'completed',
      action_data: { task_type: 'call', title: `Call ${leadName}` },
    });
  }

  private async logCommunication(data: {
    lead_id?: string;
    workflow_execution_id?: string;
    step?: string;
    channel?: string;
    status?: string;
    action_data?: any;
    error_message?: string;
  }): Promise<void> {
    try {
      await supabase.from('communication_logs').insert([{
        lead_id: data.lead_id,
        workflow_execution_id: data.workflow_execution_id,
        step: data.step || 'initial_contact',
        channel: data.channel || 'sms',
        status: data.status || 'pending',
        action_data: data.action_data,
        error_message: data.error_message,
      }]);
    } catch (error) {
      console.error('Failed to log communication:', error);
    }
  }

  private async logWorkflowStep(data: {
    workflow_execution_id?: string;
    step_index?: number;
    step_type?: string;
    status?: string;
    input_data?: any;
    output_data?: any;
    error_message?: string;
  }): Promise<void> {
    try {
      await supabase.from('workflow_step_logs').insert([{
        workflow_execution_id: data.workflow_execution_id,
        step_index: data.step_index || 0,
        step_type: data.step_type || 'unknown',
        status: data.status || 'pending',
        input_data: data.input_data,
        output_data: data.output_data,
        error_message: data.error_message,
      }]);
    } catch (error) {
      console.error('Failed to log workflow step:', error);
    }
  }
}

export const workflowExecutor = WorkflowExecutor.getInstance();
