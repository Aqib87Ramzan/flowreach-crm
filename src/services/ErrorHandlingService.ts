import { supabase } from '@/integrations/supabase/client';
import { ErrorLog, FailedMessage } from '@/types/errors';

export interface SendOptions {
  leadId: string;
  workflowExecutionId?: string;
  messageId?: string;
  retryCount?: number;
  maxRetries?: number;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private readonly DEFAULT_MAX_RETRIES = 1;
  private readonly RETRY_DELAY_MS = 5000; // 5 seconds between retries

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Log a message sending error
   */
  async logError(
    leadId: string,
    channel: 'email',
    errorMessage: string,
    errorType: 'send_failed' | 'validation_error' | 'provider_error' = 'send_failed',
    options: { workflowExecutionId?: string; messageId?: string } = {}
  ): Promise<ErrorLog | null> {
    try {
      const { data: errorLog, error } = await supabase
        .from('error_logs')
        .insert([
          {
            lead_id: leadId,
            channel,
            error_type: errorType,
            error_message: errorMessage,
            workflow_execution_id: options.workflowExecutionId,
            message_id: options.messageId,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return errorLog as any as ErrorLog;
    } catch (err) {
      console.error('Failed to log error:', err);
      return null;
    }
  }

  /**
   * Check if we should retry sending a message
   */
  async shouldRetry(errorLogId: string): Promise<boolean> {
    try {
      const { data: errorLog, error } = await supabase
        .from('error_logs')
        .select('retry_count')
        .eq('id', errorLogId)
        .single();

      if (error) return false;
      return (errorLog?.retry_count || 0) < this.DEFAULT_MAX_RETRIES;
    } catch (err) {
      console.error('Failed to check retry status:', err);
      return false;
    }
  }

  /**
   * Record a retry attempt
   */
  async recordRetry(errorLogId: string): Promise<boolean> {
    try {
      const { data: currentLog } = await supabase
        .from('error_logs')
        .select('retry_count')
        .eq('id', errorLogId)
        .single();

      const { error } = await supabase
        .from('error_logs')
        .update({
          retry_count: (currentLog?.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', errorLogId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to record retry:', err);
      return false;
    }
  }

  /**
   * Mark error as resolved
   */
  async markResolved(errorLogId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          status: 'resolved',
        } as any)
        .eq('id', errorLogId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to mark error as resolved:', err);
      return false;
    }
  }

  /**
   * Mark error as abandoned (exceeded retries)
   */
  async markAbandoned(errorLogId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          status: 'abandoned',
        } as any)
        .eq('id', errorLogId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to mark error as abandoned:', err);
      return false;
    }
  }

  /**
   * Get failed messages for today
   */
  async getFailedMessagesForDay(days: number = 1): Promise<FailedMessage[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: errorLogs, error } = await supabase
        .from('error_logs')
        .select('*, leads(name)')
        .eq('status', 'pending')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (
        errorLogs?.map((log: any) => ({
          lead_id: log.lead_id,
          lead_name: log.leads?.name || 'Unknown',
          channel: log.channel as 'email',
          error_reason: log.error_message,
          retry_attempts: log.retry_count,
          created_at: log.created_at,
          error_log_id: log.id,
        })) || []
      );
    } catch (err) {
      console.error('Failed to fetch failed messages:', err);
      return [];
    }
  }

  /**
   * Get all pending errors
   */
  async getPendingErrors(): Promise<ErrorLog[]> {
    try {
      const { data: errorLogs, error } = await supabase
        .from('error_logs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (errorLogs || []) as any as ErrorLog[];
    } catch (err) {
      console.error('Failed to fetch pending errors:', err);
      return [];
    }
  }

  /**
   * Get failed messages count for dashboard
   */
  async getFailedMessagesCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Failed to count failed messages:', err);
      return 0;
    }
  }

  /**
   * Retry failed message
   */
  async retryFailedMessage(
    errorLogId: string,
    retryFunction: () => Promise<boolean>
  ): Promise<boolean> {
    try {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY_MS));

      // Record the retry attempt
      await this.recordRetry(errorLogId);

      // Try to send again
      const success = await retryFunction();

      if (success) {
        // Mark as resolved if successful
        await this.markResolved(errorLogId);
        return true;
      } else {
        // Check if we have more retries
        const shouldRetryAgain = await this.shouldRetry(errorLogId);
        if (!shouldRetryAgain) {
          await this.markAbandoned(errorLogId);
        }
        return false;
      }
    } catch (err) {
      console.error('Retry failed:', err);
      await this.markAbandoned(errorLogId);
      return false;
    }
  }
}

export const errorHandlingService = ErrorHandlingService.getInstance();
