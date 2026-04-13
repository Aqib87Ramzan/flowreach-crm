import { Node, Edge } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';
import { Message, CommunicationLog, WorkflowStepLog } from '@/types/communications';
import { Workflow } from '@/types/workflow';
import { toast } from 'sonner';

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

  /**
   * Execute a workflow for a new lead
   */
  async executeWorkflow(options: WorkflowExecutorOptions): Promise<string | null> {
    const { workflowId, triggerData } = options;

    try {
      // Fetch workflow definition
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (workflowError || !workflow) {
        console.error('Workflow not found:', workflowError);
        return null;
      }

      // Create workflow execution record
      const { data: execution, error: executionError } = await supabase
        .from('workflow_executions')
        .insert([
          {
            workflow_id: workflowId,
            trigger_type: 'webhook',
            trigger_data: triggerData,
            status: 'running',
          },
        ])
        .select('id')
        .single();

      if (executionError || !execution) {
        console.error('Failed to create workflow execution:', executionError);
        return null;
      }

      const executionId = execution.id;
      this.activeExecutions.set(executionId, true);

      // Execute workflow steps
      await this.executeSteps(workflow as any as Workflow, triggerData.lead_id, executionId);

      // Update execution status
      await supabase
        .from('workflow_executions')
        .update({ status: 'completed' })
        .eq('id', executionId);

      this.activeExecutions.delete(executionId);
      return executionId;
    } catch (error) {
      console.error('Workflow execution failed:', error);
      return null;
    }
  }

  /**
   * Execute all steps in a workflow
   */
  private async executeSteps(
    workflow: Workflow,
    leadId: string,
    executionId: string
  ): Promise<void> {
    const nodes: Node[] = workflow.nodes || [];
    const edges: Edge[] = workflow.edges || [];

    // Start from trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) return;

    // Build execution path using edges
    const executionPath = this.buildExecutionPath(nodes, edges, triggerNode.id);

    for (let i = 0; i < executionPath.length; i++) {
      const nodeId = executionPath[i];
      const node = nodes.find((n) => n.id === nodeId);

      if (!node) continue;

      // Log step start
      await this.logWorkflowStep({
        workflow_execution_id: executionId,
        step_index: i,
        step_type: node.type,
        status: 'running',
        input_data: node.data,
      });

      try {
        // Execute node based on type
        switch (node.type) {
          case 'trigger':
            // Already triggered
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
          case 'condition':
            // Check reply condition
            const hasReply = await this.checkLeadReply(leadId);
            if (!hasReply) {
              // Continue to next node
              continue;
            } else {
              // Stop execution if lead replied
              return;
            }
          case 'task':
            await this.executeTaskNode(node, leadId, executionId);
            break;
        }

        // Log step completion
        await this.logWorkflowStep({
          workflow_execution_id: executionId,
          step_index: i,
          step_type: node.type,
          status: 'completed',
        });
      } catch (error) {
        console.error(`Error executing ${node.type} node:`, error);

        // Log step failure
        await this.logWorkflowStep({
          workflow_execution_id: executionId,
          step_index: i,
          step_type: node.type,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        // Continue to next step or break (depending on node config)
      }
    }
  }

  /**
   * Build execution path following edges
   */
  private buildExecutionPath(nodes: Node[], edges: Edge[], startNodeId: string): string[] {
    const path: string[] = [startNodeId];
    let currentNodeId = startNodeId;

    while (true) {
      const nextEdge = edges.find((e) => e.source === currentNodeId);
      if (!nextEdge) break;

      path.push(nextEdge.target);
      currentNodeId = nextEdge.target;
    }

    return path;
  }

  /**
   * Execute SMS node - send SMS to lead
   */
  private async executeSMSNode(
    node: Node,
    leadId: string,
    executionId: string
  ): Promise<void> {
    try {
      // Get lead details
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) throw new Error('Lead not found');

      const message = node.data.message || 'Hi, we wanted to follow up with you!';

      // Call Supabase function to send SMS
      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone: lead.phone,
          message,
          lead_id: leadId,
          execution_id: executionId,
        },
      });

      if (error) throw error;

      // Log communication
      await this.logCommunication({
        lead_id: leadId,
        workflow_execution_id: executionId,
        step: 'initial_contact',
        channel: 'sms',
        status: 'completed',
        action_data: { phone: lead.phone, message },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to send SMS';
      await this.logCommunication({
        lead_id: leadId,
        workflow_execution_id: executionId,
        step: 'initial_contact',
        channel: 'sms',
        status: 'failed',
        error_message: errorMsg,
      });
      throw error;
    }
  }

  /**
   * Execute Email node - send email to lead
   */
  private async executeEmailNode(
    node: Node,
    leadId: string,
    executionId: string
  ): Promise<void> {
    try {
      // Get lead details
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) throw new Error('Lead not found');

      const subject = node.data.subject || 'Hello from FlowReach';
      const message = node.data.message || 'Hi, thanks for your interest!';

      // Call Supabase function to send email
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: lead.email,
          subject,
          html: `<p>${message}</p>`,
          lead_id: leadId,
          execution_id: executionId,
        },
      });

      if (error) throw error;

      // Log communication
      await this.logCommunication({
        lead_id: leadId,
        workflow_execution_id: executionId,
        step: 'initial_contact',
        channel: 'email',
        status: 'completed',
        action_data: { email: lead.email, subject, message },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to send email';
      await this.logCommunication({
        lead_id: leadId,
        workflow_execution_id: executionId,
        step: 'initial_contact',
        channel: 'email',
        status: 'failed',
        error_message: errorMsg,
      });
      throw error;
    }
  }

  /**
   * Execute Wait node - pause workflow for configured time
   */
  private async executeWaitNode(
    node: Node,
    leadId: string,
    executionId: string
  ): Promise<void> {
    const hours = node.data.hours || 24;
    const milliseconds = hours * 60 * 60 * 1000;

    await this.logCommunication({
      lead_id: leadId,
      workflow_execution_id: executionId,
      step: 'wait_period',
      channel: 'sms',
      status: 'in_progress',
      action_data: { wait_hours: hours },
    });

    // Schedule next check using browser setTimeout (for MVP)
    // In production, use Supabase cron or database scheduling
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
      }, milliseconds);
    });
  }

  /**
   * Check if lead has replied to any message
   */
  private async checkLeadReply(leadId: string): Promise<boolean> {
    try {
      const { data: inboundMessages, error } = await supabase
        .from('messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      return !!inboundMessages && inboundMessages.length > 0;
    } catch (error) {
      console.error('Failed to check lead reply:', error);
      return false;
    }
  }

  /**
   * Execute Task node - create task for sales rep
   */
  private async executeTaskNode(
    node: Node,
    leadId: string,
    executionId: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (node.data.due_days || 1));

      const { error } = await supabase.from('tasks').insert([
        {
          user_id: user.id,
          lead_id: leadId,
          workflow_execution_id: executionId,
          task_type: 'call',
          title: node.data.title || `Call ${leadId}`,
          description:
            node.data.description || 'Follow up with lead - no response to messages',
          due_date: dueDate.toISOString(),
          status: 'pending',
          priority: 'high',
        },
      ]);

      if (error) throw error;

      await this.logCommunication({
        lead_id: leadId,
        workflow_execution_id: executionId,
        step: 'create_task',
        channel: 'sms',
        status: 'completed',
        action_data: { task_type: 'call', title: 'Follow-up call' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create task';
      await this.logCommunication({
        lead_id: leadId,
        workflow_execution_id: executionId,
        step: 'create_task',
        channel: 'sms',
        status: 'failed',
        error_message: errorMsg,
      });
      throw error;
    }
  }

  /**
   * Log communication action
   */
  private async logCommunication(data: Partial<CommunicationLog>): Promise<void> {
    try {
      await supabase.from('communication_logs').insert([
        {
          lead_id: data.lead_id,
          workflow_execution_id: data.workflow_execution_id,
          step: data.step || 'initial_contact',
          channel: data.channel || 'sms',
          status: data.status || 'pending',
          action_data: data.action_data,
          error_message: data.error_message,
        },
      ]);
    } catch (error) {
      console.error('Failed to log communication:', error);
    }
  }

  /**
   * Log workflow step execution
   */
  private async logWorkflowStep(data: Partial<WorkflowStepLog>): Promise<void> {
    try {
      await supabase.from('workflow_step_logs').insert([
        {
          workflow_execution_id: data.workflow_execution_id,
          step_index: data.step_index || 0,
          step_type: data.step_type || 'unknown',
          status: data.status || 'pending',
          input_data: data.input_data,
          output_data: data.output_data,
          error_message: data.error_message,
        },
      ]);
    } catch (error) {
      console.error('Failed to log workflow step:', error);
    }
  }
}

export const workflowExecutor = WorkflowExecutor.getInstance();
