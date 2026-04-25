import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Send Email through Supabase function
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  leadId?: string,
  executionId?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html,
        lead_id: leadId,
        execution_id: executionId,
      },
    });

    if (error) throw error;
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to send email';
    toast.error(errorMsg);
    console.error('Email send error:', err);
    return false;
  }
}

/**
 * Create a message record in the database
 */
export async function createMessageRecord(
  leadId: string,
  messageType: 'email',
  direction: 'inbound' | 'outbound',
  channel: 'email',
  content: string,
  options?: {
    subject?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    workflowExecutionId?: string;
  }
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('messages').insert([
      {
        lead_id: leadId,
        message_type: messageType,
        direction,
        channel,
        content,
        sender_id: direction === 'outbound' ? user?.id : undefined,
        recipient_email: options?.recipientEmail,
        recipient_phone: options?.recipientPhone,
        subject: options?.subject,
        workflow_execution_id: options?.workflowExecutionId,
        status: direction === 'outbound' ? 'sent' : 'delivered',
      },
    ]);

    if (error) throw error;
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create message';
    console.error('Create message error:', err);
    return false;
  }
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Mark as read error:', err);
    return false;
  }
}
