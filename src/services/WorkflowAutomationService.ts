import { supabase } from '@/integrations/supabase/client';
import { workflowExecutor } from './WorkflowExecutor';
import { toast } from 'sonner';

/**
 * Service to handle workflow automation
 * Listens for new workflow executions and processes them
 */
export class WorkflowAutomationService {
  private static instance: WorkflowAutomationService;
  private subscription: any = null;
  private processingExecutions: Set<string> = new Set();

  static getInstance(): WorkflowAutomationService {
    if (!WorkflowAutomationService.instance) {
      WorkflowAutomationService.instance = new WorkflowAutomationService();
    }
    return WorkflowAutomationService.instance;
  }

  /**
   * Initialize the automation service
   * Listens for new workflow executions with 'pending' status
   */
  public start(): void {
    if (this.subscription) return;

    console.log('Starting workflow automation service...');

    // Subscribe to pending workflow executions
    this.subscription = supabase
      .channel('workflow-executions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workflow_executions',
          filter: 'status=eq.pending',
        },
        async (payload) => {
          const execution = payload.new;
          if (execution && !this.processingExecutions.has(execution.id)) {
            await this.processExecution(execution);
          }
        }
      )
      .subscribe();
  }

  /**
   * Stop the automation service
   */
  public stop(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Process a single workflow execution
   */
  private async processExecution(execution: any): Promise<void> {
    const executionId = execution.id;
    this.processingExecutions.add(executionId);

    try {
      // Fetch workflow data
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', execution.workflow_id)
        .single();

      if (workflowError || !workflow) {
        throw new Error('Workflow not found');
      }

      const triggerData = execution.trigger_data;

      // Execute workflow using WorkflowExecutor
      await workflowExecutor.executeWorkflow({
        workflowId: execution.workflow_id,
        triggerData,
      });

      console.log(`Workflow execution ${executionId} completed`);
    } catch (error) {
      console.error(`Error processing execution ${executionId}:`, error);

      // Update execution status to failed
      try {
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
          })
          .eq('id', executionId);
      } catch (updateError) {
        console.error('Failed to update execution status:', updateError);
      }
    } finally {
      this.processingExecutions.delete(executionId);
    }
  }

  /**
   * Manually trigger a workflow for a lead
   */
  public async triggerWorkflow(workflowId: string, triggerData: any): Promise<string | null> {
    try {
      return await workflowExecutor.executeWorkflow({
        workflowId,
        triggerData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger workflow';
      console.error(message, error);
      return null;
    }
  }
}

export const workflowAutomationService = WorkflowAutomationService.getInstance();
